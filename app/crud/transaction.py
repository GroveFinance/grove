from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.crud.query_builder import (
    apply_category_exclusion_filter,
    apply_category_filter,
    apply_transfer_exclusion_transaction_level,
)
from app.logger import logger
from app.utils.payee_normalizer import normalize_check_payee


def _convert_epoch(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=UTC)
    if isinstance(value, str) and value.isdigit():
        return datetime.fromtimestamp(int(value), tz=UTC)
    return value


def _validate_splits(transaction: models.Transaction):
    if transaction.splits:
        split_total = sum([s.amount for s in transaction.splits])
        if split_total != transaction.amount:
            raise SplitMismatchError(str(transaction.id), transaction.amount, split_total)


class SplitMismatchError(Exception):
    def __init__(self, transaction_id: str, expected, actual):
        super().__init__(f"Transaction {transaction_id}: amount={expected}, splits total={actual}")
        self.transaction_id = transaction_id
        self.expected = expected
        self.actual = actual


# CREATE
def create_transaction(
    db: Session,
    transaction_in: schemas.TransactionCreate | dict,
    suggested_payee_category_id: int | None = None,
) -> models.Transaction:
    data = transaction_in.dict() if not isinstance(transaction_in, dict) else transaction_in.copy()

    # Convert epoch → datetime
    data["posted"] = _convert_epoch(data.get("posted"))
    data["transacted_at"] = _convert_epoch(data.get("transacted_at"))

    # Handle payee string → Payee object
    payee_name = data.pop("payee", None)
    if payee_name:
        # Normalize check payees to avoid clutter from check numbers
        description = data.get("description", "")
        payee_name = normalize_check_payee(payee_name, description)

        payee = db.query(models.Payee).filter(models.Payee.name == payee_name).first()
        if not payee:
            # Create new payee with suggested category (defaults to 0 if no suggestion)
            category_id = (
                suggested_payee_category_id if suggested_payee_category_id is not None else 0
            )
            payee = models.Payee(name=payee_name, category_id=category_id)
            db.add(payee)
            db.flush()
            if suggested_payee_category_id:
                logger.debug(
                    f"Created payee '{payee_name}' with auto-suggested category {category_id}"
                )
        data["payee_id"] = payee.id

    splits_data = data.pop("splits", None)

    txn = models.Transaction(**data)

    _validate_splits(txn)

    db.add(txn)
    db.flush()  # ensures txn.id is available

    # Handle splits
    if splits_data:
        for split_in in splits_data:
            split = models.TransactionSplit(**split_in)
            split.transaction_id = txn.id
            db.add(split)
    else:
        # Default split (whole amount, uncategorized)
        default_split = models.TransactionSplit(
            transaction_id=txn.id, amount=txn.amount, category_id=0
        )
        db.add(default_split)

    db.commit()
    db.refresh(txn)
    return txn


# GET by ID
def get_transaction(db: Session, transaction_id: str) -> models.Transaction | None:
    return (
        db.query(models.Transaction)
        .options(
            joinedload(models.Transaction.payee),
            joinedload(models.Transaction.splits).joinedload(models.TransactionSplit.category),
        )
        .filter(models.Transaction.id == transaction_id)
        .first()
    )


# LIST
def get_transactions(
    db: Session,
    account_ids: list[str] | None = None,
    excluded_account_ids: list[str] | None = None,
    category_ids: list[int] | None = None,
    excluded_category_ids: list[int] | None = None,
    payee_ids: list[int] | None = None,
    payee_name: str | None = None,
    transacted_start: datetime | None = None,
    transacted_end: datetime | None = None,
    skip: int = 0,
    limit: int = 100,
    sort_by: str = "transacted_at",
    sort_order: str = "desc",
    skip_transfers: bool = False,
    split_mode: bool = False,
    account_types: list[str] | None = None,
    exclude_account_types: list[str] | None = None,
    include_hidden: bool = False,
) -> list[models.Transaction]:
    # Initialize mutable defaults
    if account_ids is None:
        account_ids = []
    if excluded_account_ids is None:
        excluded_account_ids = []
    if category_ids is None:
        category_ids = []
    if excluded_category_ids is None:
        excluded_category_ids = []
    if payee_ids is None:
        payee_ids = []

    query = db.query(models.Transaction).options(
        joinedload(models.Transaction.payee).joinedload(models.Payee.category),
        joinedload(models.Transaction.splits).joinedload(models.TransactionSplit.category),
        joinedload(models.Transaction.account),
    )

    if account_ids:
        query = query.filter(models.Transaction.account_id.in_(account_ids))

    if excluded_account_ids:
        query = query.filter(~models.Transaction.account_id.in_(excluded_account_ids))

    # Apply account type filters using centralized logic
    # Note: For transactions, we filter at the Transaction level, not joins
    if account_types:
        query = query.filter(
            models.Transaction.account.has(models.Account.account_type.in_(account_types))
        )

    if exclude_account_types:
        query = query.filter(
            ~models.Transaction.account.has(models.Account.account_type.in_(exclude_account_types))
        )

    # Apply hidden account filter using centralized logic
    # Need to join Account for the filter to work
    if not include_hidden:
        query = query.filter(models.Transaction.account.has(~models.Account.is_hidden))

    # Apply category filter using centralized logic
    if category_ids:
        query = apply_category_filter(query, category_ids, db)

    # Apply category exclusion using centralized logic
    if excluded_category_ids:
        query = apply_category_exclusion_filter(query, excluded_category_ids, db)

    if payee_ids:
        query = query.filter(models.Transaction.payee_id.in_(payee_ids))

    if payee_name:
        query = query.filter(
            models.Transaction.payee.has(models.Payee.name.ilike(f"%{payee_name}%"))
        )

    if transacted_start:
        query = query.filter(models.Transaction.transacted_at >= transacted_start)

    if transacted_end:
        query = query.filter(models.Transaction.transacted_at <= transacted_end)

    # Apply transfer exclusion using centralized logic
    if skip_transfers:
        query = apply_transfer_exclusion_transaction_level(query, db)

    # Sorting logic
    sort_column = getattr(models.Transaction, sort_by, models.Transaction.transacted_at)
    sort_func = sort_column.desc() if sort_order.lower() == "desc" else sort_column.asc()
    query = query.order_by(sort_func)

    if split_mode:
        # Fetch top splits directly instead of whole transactions
        subq = (
            db.query(models.TransactionSplit)
            .join(models.Transaction)
            .filter(models.TransactionSplit.amount < 0)
            .order_by(func.abs(models.TransactionSplit.amount).desc())
            .limit(limit)
        )
        return subq.all()

    return query.offset(skip).limit(limit).all()


def get_transactions_summary(
    db: Session,
    account_ids: list[str] | None = None,
    excluded_account_ids: list[str] | None = None,
    category_ids: list[int] | None = None,
    excluded_category_ids: list[int] | None = None,
    payee_ids: list[int] | None = None,
    payee_name: str | None = None,
    transacted_start: datetime | None = None,
    transacted_end: datetime | None = None,
    skip_transfers: bool = False,
    account_types: list[str] | None = None,
    exclude_account_types: list[str] | None = None,
    include_hidden: bool = False,
) -> dict:
    """
    Calculate summary statistics (total income, total expense, net, count) for transactions
    matching the given filters. This applies the same filters as get_transactions but returns
    aggregated totals instead of paginated results.
    """
    # Initialize mutable defaults
    if account_ids is None:
        account_ids = []
    if excluded_account_ids is None:
        excluded_account_ids = []
    if category_ids is None:
        category_ids = []
    if excluded_category_ids is None:
        excluded_category_ids = []
    if payee_ids is None:
        payee_ids = []

    query = db.query(
        func.count(models.Transaction.id).label("count"),
        func.coalesce(
            func.sum(case((models.Transaction.amount > 0, models.Transaction.amount), else_=0)),
            0,
        ).label("total_income"),
        func.coalesce(
            func.sum(
                case(
                    (
                        models.Transaction.amount < 0,
                        func.abs(models.Transaction.amount),
                    ),
                    else_=0,
                )
            ),
            0,
        ).label("total_expense"),
    )

    # Apply the same filters as get_transactions
    if account_ids:
        query = query.filter(models.Transaction.account_id.in_(account_ids))

    if excluded_account_ids:
        query = query.filter(~models.Transaction.account_id.in_(excluded_account_ids))

    if account_types:
        query = query.filter(
            models.Transaction.account.has(models.Account.account_type.in_(account_types))
        )

    if exclude_account_types:
        query = query.filter(
            ~models.Transaction.account.has(models.Account.account_type.in_(exclude_account_types))
        )

    # Apply hidden account filter
    if not include_hidden:
        query = query.filter(models.Transaction.account.has(~models.Account.is_hidden))

    if category_ids:
        query = apply_category_filter(query, category_ids, db)

    if excluded_category_ids:
        query = apply_category_exclusion_filter(query, excluded_category_ids, db)

    if payee_ids:
        query = query.filter(models.Transaction.payee_id.in_(payee_ids))

    if payee_name:
        query = query.filter(
            models.Transaction.payee.has(models.Payee.name.ilike(f"%{payee_name}%"))
        )

    if transacted_start:
        query = query.filter(models.Transaction.transacted_at >= transacted_start)

    if transacted_end:
        query = query.filter(models.Transaction.transacted_at <= transacted_end)

    if skip_transfers:
        query = apply_transfer_exclusion_transaction_level(query, db)

    result = query.one()

    total_income = float(result.total_income) if result.total_income else 0.0
    total_expense = float(result.total_expense) if result.total_expense else 0.0

    return {
        "count": result.count or 0,
        "total_income": total_income,
        "total_expense": total_expense,
        "net": total_income - total_expense,
    }


# UPDATE
def update_transaction(
    db: Session, transaction_id: str, transaction_in: schemas.TransactionUpdate
) -> models.Transaction | None:
    db_obj = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not db_obj:
        return None

    update_data = transaction_in.dict(exclude_unset=True)

    # Handle payee string → id
    if "payee" in update_data and update_data["payee"]:
        payee = db.query(models.Payee).filter(models.Payee.name == update_data["payee"]).first()
        if not payee:
            payee = models.Payee(name=update_data["payee"])
            db.add(payee)
            db.flush()
        update_data["payee_id"] = payee.id
        del update_data["payee"]

    # Handle splits update separately
    splits_data = update_data.pop("splits", None)

    for field, value in update_data.items():
        setattr(db_obj, field, value)

    if splits_data is not None:
        # Replace splits wholesale (simplest strategy)
        db.query(models.TransactionSplit).filter(
            models.TransactionSplit.transaction_id == db_obj.id
        ).delete()
        for split_in in splits_data:
            split = models.TransactionSplit(**split_in)
            split.transaction_id = db_obj.id
            db.add(split)

        # Validate splits sum to transaction amount
        db.flush()  # Ensure splits are in session
        db.refresh(db_obj)  # Reload with splits
        _validate_splits(db_obj)

    db.commit()
    db.refresh(db_obj)
    return db_obj


# DELETE
def delete_transaction(db: Session, transaction_id: str) -> None:
    db_obj = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(db_obj)
    db.commit()
