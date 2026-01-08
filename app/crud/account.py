import os
from datetime import UTC, datetime, timedelta

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, aliased

from app import models
from app.logger import logger
from app.models import (
    Account,
    AccountBalance,
    Holding,
    Org,
    Transaction,
    TransactionSplit,
)
from app.schemas import AccountCreate, AccountDetailsOut, AccountUpdate


def create_account(db: Session, data: AccountCreate) -> Account:
    account = Account(**data.dict(), created_at=datetime.now(UTC))
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


# this isnt really used, the details is used instead
# but keeping it for reference
# and in case we need to use it later
def get_accounts(
    db: Session,
    is_hidden: bool | None = False,
    org_id: str | None = None,
    account_id: str | None = None,
) -> list[Account]:
    query = db.query(Account)

    if not is_hidden:
        query = query.filter(Account.is_hidden == False)  # noqa: E712

    if org_id:
        query = query.filter(Account.org_id == org_id)

    if account_id:
        query = query.filter(Account.id == account_id)

    return query.order_by(Account.name).all()


def update_account(db: Session, id: str, data: AccountUpdate):
    account = db.query(Account).filter(Account.id == id).first()
    if not account:
        return None

    # Track if account_type is changing to loan/mortgage
    old_account_type = account.account_type
    account_type_changed_to_loan = False

    for key, value in data.dict(exclude_unset=True).items():
        if key == "account_type" and value in ["loan", "mortgage"] and old_account_type != value:
            account_type_changed_to_loan = True
        setattr(account, key, value)

    db.commit()
    db.refresh(account)

    # If account type changed to loan/mortgage, re-categorize existing payees
    if account_type_changed_to_loan:
        _recategorize_payees_for_loan_account(db, account)

    return account


def _recategorize_payees_for_loan_account(db: Session, account: Account):
    """Re-categorize payees for an account that was just changed to loan/mortgage type.

    This applies smart categorization to existing payees that are still uncategorized.
    Only updates payees where category_id == 0 (uncategorized).
    """
    from app.models import Payee

    # Import the categorization helper
    # Avoid circular import by importing here
    try:
        from app.sync.simplefin import _suggest_category_for_loan_transaction
    except ImportError:
        logger.warning("Could not import categorization helper, skipping payee re-categorization")
        return

    # Get all transactions for this account
    transactions = db.query(Transaction).filter(Transaction.account_id == account.id).all()

    # Track payees we've already processed to avoid duplicates
    processed_payee_ids = set()
    updated_count = 0

    for txn in transactions:
        if not txn.payee_id or txn.payee_id in processed_payee_ids:
            continue

        payee = db.query(Payee).filter(Payee.id == txn.payee_id).first()
        if not payee or payee.category_id != 0:
            # Skip if payee doesn't exist or already has a category
            processed_payee_ids.add(txn.payee_id)
            continue

        # Suggest category based on transaction description
        suggested_category_id = _suggest_category_for_loan_transaction(
            db,
            str(txn.description or ""),
            str(account.account_type) if account.account_type else "",
        )

        if suggested_category_id:
            payee.category_id = int(suggested_category_id)  # type: ignore[assignment]
            updated_count += 1
            logger.info(
                f"Auto-categorized payee '{payee.name}' to category {suggested_category_id} (account type changed to {account.account_type})"
            )

        processed_payee_ids.add(txn.payee_id)

    if updated_count > 0:
        db.commit()
        logger.info(
            f"Re-categorized {updated_count} payee(s) for account {account.id} (changed to {account.account_type})"
        )


def delete_account(db: Session, id: str):
    account = db.query(Account).filter(Account.id == id).first()
    if not account:
        return None
    db.delete(account)
    db.commit()
    return account


def get_account_by_id(db: Session, id: str) -> Account | None:
    return db.query(Account).filter(Account.id == id).first()


def _get_latest_balance(db: Session, account_id: str):
    """Helper to get the latest balance for an account."""
    latest = (
        db.query(AccountBalance)
        .filter(AccountBalance.account_id == account_id)
        .order_by(desc(AccountBalance.balance_date))
        .first()
    )
    if latest:
        return {"balance": latest.balance, "balance_date": latest.balance_date}
    return {"balance": None, "balance_date": None}


def find_duplicate_accounts(
    db: Session,
    transaction_sample_size: int | None = None,
    min_match_ratio: float | None = None,
) -> list[dict]:
    """Find accounts that are duplicates based on org_id + name + transaction overlap.

    Strategy:
    1. Find accounts with same org_id + name (candidate duplicates)
    2. For each group, validate by checking if recent transactions overlap
    3. Compare the N most recent transactions from older account to newer account
    4. Only flag as duplicates if we find high overlap (80%+ by default)

    Args:
        transaction_sample_size: Number of recent transactions to compare
                                (default from DUPLICATE_DETECTION_SAMPLE_SIZE env var or 5)
        min_match_ratio: Minimum ratio of matches required
                        (default from DUPLICATE_DETECTION_MIN_MATCH_RATIO env var or 0.8 = 80%)
                        For 5 transactions, this means 4+ must match

    Returns:
        List of duplicate groups with account details (including balance).
    """
    # Load defaults from environment variables
    if transaction_sample_size is None:
        transaction_sample_size = int(os.getenv("DUPLICATE_DETECTION_SAMPLE_SIZE", "5"))
    if min_match_ratio is None:
        min_match_ratio = float(os.getenv("DUPLICATE_DETECTION_MIN_MATCH_RATIO", "0.8"))

    # Find accounts with same org_id + name
    duplicates_query = (
        db.query(Account.org_id, Account.name, func.count(Account.id).label("count"))
        .group_by(Account.org_id, Account.name)
        .having(func.count(Account.id) > 1)
    )

    duplicate_groups = []
    for org_id, name, _count in duplicates_query.all():
        accounts = (
            db.query(Account)
            .filter(Account.org_id == org_id, Account.name == name)
            # Order by created_at (oldest first), with id as fallback for accounts without created_at
            .order_by(Account.created_at.asc().nulls_last(), Account.id)
            .all()
        )

        # Validate this is a real duplicate by checking transaction overlap
        if len(accounts) == 2:
            # For pairs, check if older account's recent transactions exist in newer
            older_account = accounts[0]  # Oldest by created_at
            newer_account = accounts[1]  # Newest by created_at

            # Get recent transactions from older account
            older_transactions = (
                db.query(Transaction)
                .filter(Transaction.account_id == older_account.id)
                .order_by(desc(Transaction.posted))
                .limit(transaction_sample_size)
                .all()
            )

            if not older_transactions:
                # No transactions in old account, skip this group
                logger.debug(
                    f"Skipping potential duplicate {name} - no transactions in older account"
                )
                continue

            # Get transactions from newer account
            newer_transactions = (
                db.query(Transaction).filter(Transaction.account_id == newer_account.id).all()
            )

            # Build lookup map for newer account transactions
            newer_txn_map = {
                (txn.posted, float(txn.amount), txn.description or ""): txn
                for txn in newer_transactions
            }

            # Count matches
            matches = 0
            for old_txn in older_transactions:
                key = (old_txn.posted, float(old_txn.amount), old_txn.description or "")
                if key in newer_txn_map:
                    matches += 1

            # Calculate match ratio
            match_ratio = matches / len(older_transactions) if older_transactions else 0

            # Only include if we have enough matches
            if match_ratio >= min_match_ratio:
                logger.info(
                    f"Found duplicate: {name} ({org_id}) - {matches}/{len(older_transactions)} transactions match ({match_ratio:.0%})"
                )
                duplicate_groups.append(
                    {
                        "org_id": org_id,
                        "name": name,
                        "accounts": accounts,
                    }
                )
            else:
                logger.debug(
                    f"Skipping {name} ({org_id}) - only {matches}/{len(older_transactions)} transactions match ({match_ratio:.0%})"
                )
        else:
            # For groups with 3+ accounts, find pairs that have transaction overlap
            # Only include accounts that actually match, not the entire group
            duplicate_pairs = []

            for i in range(len(accounts)):
                for j in range(i + 1, len(accounts)):
                    older = accounts[i]
                    newer = accounts[j]

                    older_txns = (
                        db.query(Transaction)
                        .filter(Transaction.account_id == older.id)
                        .order_by(desc(Transaction.posted))
                        .limit(transaction_sample_size)
                        .all()
                    )

                    if not older_txns:
                        continue

                    newer_txns = (
                        db.query(Transaction).filter(Transaction.account_id == newer.id).all()
                    )

                    if not newer_txns:
                        continue

                    newer_map = {
                        (t.posted, float(t.amount), t.description or ""): t for t in newer_txns
                    }

                    matches = sum(
                        1
                        for old in older_txns
                        if (old.posted, float(old.amount), old.description or "") in newer_map
                    )

                    match_ratio = matches / len(older_txns) if older_txns else 0
                    if match_ratio >= min_match_ratio:
                        # Found a duplicate pair
                        duplicate_pairs.append((older, newer))

            # For each duplicate pair found, create a separate group
            # Group accounts that are transitively related
            if duplicate_pairs:
                # Build a graph of which accounts are related
                account_sets: list[set[models.Account]] = []
                for older, newer in duplicate_pairs:
                    # Find if either account is already in a set
                    merged = False
                    for acc_set in account_sets:
                        if older in acc_set or newer in acc_set:
                            acc_set.add(older)
                            acc_set.add(newer)
                            merged = True
                            break

                    if not merged:
                        account_sets.append({older, newer})

                # Merge any overlapping sets
                i = 0
                while i < len(account_sets):
                    j = i + 1
                    while j < len(account_sets):
                        if account_sets[i] & account_sets[j]:  # If sets overlap
                            account_sets[i] |= account_sets[j]  # Merge them
                            account_sets.pop(j)
                        else:
                            j += 1
                    i += 1

                # Create duplicate groups for each set
                for acc_set in account_sets:
                    # Sort by created_at (oldest first), with id as fallback
                    acc_list = sorted(
                        acc_set,
                        key=lambda a: (
                            a.created_at if a.created_at else datetime.max.replace(tzinfo=UTC),
                            a.id,
                        ),
                    )
                    logger.info(
                        f"Found duplicate group: {name} ({org_id}) - {len(acc_list)} accounts"
                    )
                    duplicate_groups.append(
                        {
                            "org_id": org_id,
                            "name": name,
                            "accounts": acc_list,
                        }
                    )

    return duplicate_groups


def merge_accounts(
    db: Session,
    source_account_id: str,
    target_account_id: str,
    preserve_categorization: bool = True,
    simplefin_lookback_months: int = 12,
) -> dict:
    """Merge source account into target account, optionally preserving user categorization.

    Strategy:
    1. Match source transactions to target transactions by (posted, amount, description)
    2. For matches: Copy splits/categories from source to target if preserve_categorization=True
    3. For old transactions (beyond SimpleFIN lookback): Reassign to target account
    4. Delete remaining source transactions
    5. Reassign holdings
    6. Delete source account

    Args:
        source_account_id: Account to merge FROM (will be deleted)
        target_account_id: Account to merge TO (will be kept)
        preserve_categorization: If True, copy splits/categories from matched transactions
        simplefin_lookback_months: How far back SimpleFIN can see (default 12)

    Returns:
        dict with merge statistics
    """
    logger.info(
        f"Merging account {source_account_id} into {target_account_id}, preserve_cat={preserve_categorization}"
    )

    source_account = db.query(Account).filter(Account.id == source_account_id).first()
    target_account = db.query(Account).filter(Account.id == target_account_id).first()

    if not source_account or not target_account:
        raise ValueError("Source or target account not found")

    if source_account.org_id != target_account.org_id or source_account.name != target_account.name:
        raise ValueError("Can only merge accounts with matching org_id and name")

    stats = {
        "transactions_reassigned": 0,
        "transactions_removed": 0,
        "transactions_matched": 0,
        "holdings_reassigned": 0,
        "source_account_deleted": False,
    }

    # Calculate cutoff date for SimpleFIN lookback
    cutoff_date = datetime.now(UTC) - timedelta(days=simplefin_lookback_months * 30)

    # Get all transactions from both accounts
    source_transactions = (
        db.query(Transaction).filter(Transaction.account_id == source_account_id).all()
    )

    target_transactions = (
        db.query(Transaction).filter(Transaction.account_id == target_account_id).all()
    )

    # Build lookup for target transactions by (posted, amount, description)
    target_txn_map = {}
    for txn in target_transactions:
        key = (txn.posted, float(txn.amount), txn.description or "")
        target_txn_map[key] = txn

    # Process source transactions
    for source_txn in source_transactions:
        if source_txn.posted >= cutoff_date:
            # Recent transaction - try to match with target
            key = (
                source_txn.posted,
                float(source_txn.amount),
                source_txn.description or "",
            )
            target_txn = target_txn_map.get(key)

            if target_txn and preserve_categorization:
                # Found matching transaction - copy splits/categories
                logger.debug(f"Matched {source_txn.id} -> {target_txn.id}, copying categorization")

                # Delete existing splits on target
                db.query(TransactionSplit).filter(
                    TransactionSplit.transaction_id == target_txn.id
                ).delete()

                # Copy splits from source to target
                for split in source_txn.splits:
                    new_split = TransactionSplit(
                        transaction_id=target_txn.id,
                        category_id=split.category_id,
                        amount=split.amount,
                    )
                    db.add(new_split)

                # Copy payee if exists
                if source_txn.payee_id:
                    target_txn.payee_id = source_txn.payee_id

                stats["transactions_matched"] += 1

            # Delete source transaction (whether matched or not)
            db.delete(source_txn)
            stats["transactions_removed"] += 1
        else:
            # Old transaction - beyond SimpleFIN's reach, just reassign
            logger.debug(f"Reassigning old transaction {source_txn.id} to target account")
            source_txn.account_id = str(target_account_id)  # type: ignore[assignment]
            stats["transactions_reassigned"] += 1

    # Reassign holdings to target account
    holdings = db.query(Holding).filter(Holding.account_id == source_account_id).all()
    for holding in holdings:
        holding.account_id = str(target_account_id)  # type: ignore[assignment]
        stats["holdings_reassigned"] += 1

    # Delete source account (cascades balances)
    db.delete(source_account)
    stats["source_account_deleted"] = True

    db.commit()
    logger.info(f"Merge complete: {stats}")
    return stats


def get_account_details(
    db: Session,
    account_id: str | None = None,
    org_id: str | None = None,
    is_hidden: bool | None = False,
) -> list[AccountDetailsOut]:
    # 1. Create a subquery to find the latest balance_date for each account.
    # This is a common and efficient pattern for "latest record" problems.
    latest_balance_date_subq = (
        select(
            AccountBalance.account_id,
            func.max(AccountBalance.balance_date).label("latest_date"),
        )
        .group_by(AccountBalance.account_id)
        .subquery("latest_balance_date")
    )

    # 2. Join the AccountBalance table with the subquery to get the full latest balance record.
    # We use an aliased AccountBalance for clarity.
    latest_balance = aliased(AccountBalance, name="latest_balance")

    # 3. Construct the main query using select()
    query = (
        select(
            Account.id.label("account_id"),
            Account.name,
            Account.alt_name,
            Account.currency,
            Account.account_type,
            Org.name.label("org_name"),
            Org.domain.label("org_domain"),
            latest_balance.balance,
            latest_balance.balance_date,
            Account.created_at,
            Account.is_hidden,
        )
        .join(Org, Org.id == Account.org_id)
        # Outer join to the latest_balance_date subquery to link to the correct date
        .outerjoin(
            latest_balance_date_subq,
            Account.id == latest_balance_date_subq.c.account_id,
        )
        # Outer join again to the aliased AccountBalance to get the actual balance record
        .outerjoin(
            latest_balance,
            (Account.id == latest_balance.account_id)
            & (latest_balance_date_subq.c.latest_date == latest_balance.balance_date),
        )
    )

    # 4. Apply filters if they exist
    if account_id is not None:
        query = query.filter(Account.id == account_id)
    if org_id is not None:
        query = query.filter(Account.org_id == org_id)
    if not is_hidden:
        query = query.filter(Account.is_hidden == False)  # noqa: E712

    # 5. Order by account name for consistency
    query = query.order_by(Org.name.asc(), Account.name.asc())
    # 6. Execute the query and fetch all results
    results = db.execute(query).all()

    # 7. Map the results to the Pydantic schema
    return [
        AccountDetailsOut(
            account_id=r.account_id,
            name=r.name,
            alt_name=r.alt_name,
            display_name=r.alt_name if r.alt_name else r.name,
            currency=r.currency,
            account_type=r.account_type,
            org_name=r.org_name,
            org_domain=r.org_domain,
            balance=r.balance,
            balance_date=r.balance_date,
            created_at=r.created_at,
            is_hidden=r.is_hidden if hasattr(r, "is_hidden") else False,
        )
        for r in results
    ]
