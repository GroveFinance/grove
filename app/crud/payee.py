import csv
import io
from typing import TypedDict

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.models import Account, AccountType, Payee, Transaction
from app.schemas import PayeeCreate, PayeeUpdate


class PayeeImportStats(TypedDict):
    success: bool
    mode: str
    payees_created: int
    payees_updated: int
    payees_skipped: int
    errors: list[str]
    warnings: list[str]


def create_payee(db: Session, data: PayeeCreate) -> Payee:
    obj = Payee(**data.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_payee(db: Session, id: int) -> Payee | None:
    return db.query(Payee).filter(Payee.id == id).first()


def get_payees(db: Session, exclude_investment: bool = False) -> list[Payee]:
    # Subquery to count transactions per payee
    transaction_count_subquery = (
        db.query(Transaction.payee_id, func.count(Transaction.id).label("transaction_count"))
        .group_by(Transaction.payee_id)
        .subquery()
    )

    # Main query joining with transaction counts
    query = db.query(
        Payee,
        func.coalesce(transaction_count_subquery.c.transaction_count, 0).label("transaction_count"),
    ).outerjoin(transaction_count_subquery, Payee.id == transaction_count_subquery.c.payee_id)

    if exclude_investment:
        # Get payee IDs that have at least one transaction in a non-investment account
        non_investment_payee_ids = (
            db.query(Transaction.payee_id)
            .join(Account, Transaction.account_id == Account.id)
            .filter(Account.account_type != AccountType.investment)
            .filter(Transaction.payee_id.isnot(None))
            .distinct()
            .subquery()
        )
        query = query.filter(Payee.id.in_(non_investment_payee_ids))  # type: ignore[arg-type]

    results = query.order_by(Payee.name.asc()).all()

    # Add transaction_count as an attribute to each Payee object
    payees = []
    for payee, transaction_count in results:
        payee.transaction_count = transaction_count
        payees.append(payee)

    return payees


def update_payee(db: Session, id: int, data: PayeeUpdate) -> Payee | None:
    obj = get_payee(db, id)
    if not obj:
        return None
    for key, value in data.dict(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_payee(db: Session, id: int) -> bool:
    obj = get_payee(db, id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


def apply_payees_to_transactions(db: Session, transaction_ids: list[str]) -> int:
    payees = db.query(Payee).all()
    txns = db.query(Transaction).filter(Transaction.id.in_(transaction_ids)).all()
    updated = 0

    for txn in txns:
        for payee in payees:
            if payee.keyword.lower() in (txn.description or "").lower():
                txn.category_id = payee.category_id
                updated += 1
                break  # only apply the first matching payee
    db.commit()
    return updated


def _find_category_by_name_case_insensitive(
    db: Session, category_name: str
) -> models.Category | None:
    """Find category by name (case-insensitive)"""
    return (
        db.query(models.Category)
        .filter(func.lower(models.Category.name) == category_name.lower())
        .first()
    )


def _find_payee_by_name_case_insensitive(db: Session, payee_name: str) -> Payee | None:
    """Find payee by name (case-insensitive)"""
    return db.query(Payee).filter(func.lower(Payee.name) == payee_name.lower()).first()


def export_payees_to_csv(db: Session) -> str:
    """Export payees with categorization rules to CSV format.

    Only exports payees that have a category assigned (category_id != 0).
    Uncategorized payees are excluded since they provide no useful rule.
    """
    payees = get_payees(db, exclude_investment=False)

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["payee_name", "category_name"])

    for payee in payees:
        # Skip uncategorized payees - they provide no rule to export
        if payee.category_id == 0:
            continue

        category_name = payee.category.name if payee.category else "Uncategorized"
        writer.writerow([payee.name, category_name])

    return output.getvalue()


def import_payees_from_csv(db: Session, csv_content: str, mode: str) -> PayeeImportStats:
    """Import payees from CSV content"""
    reader = csv.DictReader(io.StringIO(csv_content))

    # Validate headers
    if reader.fieldnames != ["payee_name", "category_name"]:
        raise ValueError(
            f"Invalid CSV headers. Expected: payee_name,category_name. "
            f"Got: {','.join(reader.fieldnames or [])}"
        )

    stats: PayeeImportStats = {
        "success": True,
        "mode": mode,
        "payees_created": 0,
        "payees_updated": 0,
        "payees_skipped": 0,
        "errors": [],
        "warnings": [],
    }

    for row_num, row in enumerate(reader, start=2):  # Start at 2 (after header)
        payee_name = row["payee_name"].strip()
        category_name = row["category_name"].strip()

        if not payee_name:
            stats["errors"].append(f"Row {row_num}: Empty payee name")
            continue

        # Find category (case-insensitive)
        category = _find_category_by_name_case_insensitive(db, category_name)
        if not category:
            stats["warnings"].append(
                f"Row {row_num}: Category '{category_name}' not found. Using Uncategorized."
            )
            category_id = 0
        else:
            category_id = category.id  # type: ignore[assignment]

        # Check if payee exists (case-insensitive)
        existing = _find_payee_by_name_case_insensitive(db, payee_name)

        if existing:
            if mode == "overwrite":
                existing.category_id = category_id  # type: ignore[assignment]
                stats["payees_updated"] += 1
            else:  # merge
                stats["payees_skipped"] += 1
        else:
            new_payee = Payee(name=payee_name, category_id=category_id)
            db.add(new_payee)
            stats["payees_created"] += 1

    db.commit()
    return stats
