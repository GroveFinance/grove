import base64
import collections
import json
import os
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Any

import requests
from sqlalchemy.orm import Session

from app import models
from app.crud import account as account_crud
from app.crud import holding as holding_crud
from app.crud import org as org_crud
from app.crud import transaction as transaction_crud
from app.db import SessionLocal
from app.logger import logger
from app.models import Account, Holding, Org, SyncConfig, Transaction
from app.schemas import (
    AccountBalanceCreate,
    AccountCreate,
    AccountUpdate,
    HoldingCreate,
    OrgCreate,
    OrgUpdate,
    SyncConfigOut,
    SyncConfigUpdate,
)

# Max months to sync backwards during initial sync
# If not set, will sync until 2 empty months (no limit)
# Set this for dev/testing to speed up initial sync (e.g., "12")
INITIAL_SYNC_MAX_MONTHS_STR = os.getenv("SIMPLEFIN_INITIAL_SYNC_MONTHS")
INITIAL_SYNC_MAX_MONTHS: int | None
if INITIAL_SYNC_MAX_MONTHS_STR:
    INITIAL_SYNC_MAX_MONTHS = int(INITIAL_SYNC_MAX_MONTHS_STR)
else:
    INITIAL_SYNC_MAX_MONTHS = None  # No limit, walk back until 2 empty months


def _find_category_by_name(db: Session, category_names: list[str]) -> int | None:
    """Look up category ID by trying multiple name variations.

    Args:
        db: Database session
        category_names: List of category name variants to try (in priority order)

    Returns:
        Category ID if found, None otherwise
    """
    for name in category_names:
        category = db.query(models.Category).filter(models.Category.name == name).first()
        if category:
            return int(category.id)
    return None


def _suggest_category_for_loan_transaction(
    db: Session, description: str, account_type: str
) -> int | None:
    """Suggest category for loan account transactions based on description patterns.

    This is called during transaction sync to auto-categorize payees on loan accounts.
    Only sets category on payee creation or when account type changes to loan.

    Args:
        db: Database session
        description: Transaction description to analyze
        account_type: Account type (loan, mortgage, credit_card, etc.)

    Returns:
        Category ID suggestion or None if no suggestion
    """
    if not description:
        return None

    desc_lower = description.lower()

    # Escrow disbursements - check these first (more specific)
    if any(
        kw in desc_lower
        for kw in ["property tax", "tax disbursement", "county tax", "real estate tax"]
    ):
        # Look for "Property Tax" first, fall back to "Taxes"
        category_id = _find_category_by_name(db, ["Property Tax", "Taxes"])
        if category_id:
            logger.debug(f"Suggested category for property tax disbursement: {description[:50]}")
            return category_id

    if any(kw in desc_lower for kw in ["insurance", "homeowner", "hazard", "home insurance"]):
        # Look for "Home Insurance" first, fall back to "Insurance"
        category_id = _find_category_by_name(db, ["Home Insurance", "Insurance"])
        if category_id:
            logger.debug(f"Suggested category for insurance disbursement: {description[:50]}")
            return category_id

    if any(kw in desc_lower for kw in ["pmi", "mortgage insurance"]):
        category_id = _find_category_by_name(db, ["Insurance"])
        if category_id:
            logger.debug(f"Suggested category for PMI: {description[:50]}")
            return category_id

    # Default for loan/mortgage payments: Transfer
    # This prevents double-counting when the payment shows on both bank and loan sides
    if account_type in ["loan", "mortgage"]:
        category_id = _find_category_by_name(db, ["Transfer"])
        if category_id:
            logger.debug(f"Suggested Transfer category for loan payment: {description[:50]}")
            return category_id
        else:
            # Transfer category missing - log error but don't fail
            logger.error(
                f"Cannot auto-categorize loan transaction - 'Transfer' category not found. "
                f"Transaction: {description[:50]}"
            )

    return None


def get_credentials(db: Session, config: SyncConfig) -> SyncConfig | None:
    # todo: maybe make this better
    # keep inside to prevent circular dependency
    from app.crud.sync_config import update_sync_config

    cfg = config.config
    if all(cfg.get(k) for k in ("username", "password", "endpoint")):
        return config

    token = cfg.get("setup_token")
    if not token:
        logger.warning(
            f"Sync config {config.name} missing setup_token, cannot retrieve credentials"
        )
        return None

    try:
        logger.info(f"Retrieving credentials for {config.name}")
        claim_url = base64.b64decode(token).decode("utf-8")
        response = requests.post(claim_url)
        response.raise_for_status()
        access_url = response.text

        scheme, rest = access_url.split("//", 1)
        auth, rest = rest.split("@", 1)
        username, password = auth.split(":", 1)
        endpoint = f"{scheme}//{rest}/accounts"

        cfg["username"] = username
        cfg["password"] = base64.b64encode(password.encode()).decode()
        cfg["endpoint"] = endpoint
        logger.info(f"Successfully retrieved credentials for {config.name}")

        # Use a separate session to persist credentials
        with SessionLocal() as local_db:
            updated_config = update_sync_config(
                local_db,
                int(config.id),
                SyncConfigUpdate(config=cfg),  # type: ignore[arg-type]
            )
            if updated_config:
                config = updated_config

        return config
    except Exception as e:
        logger.error(f"Failed to retrieve credentials via setup_token: {e}")
        config.errors = str(json.dumps([f"Failed to retrieve credentials via setup token: {e}"]))  # type: ignore[assignment]
        db.commit()
        return None


def run(
    db: Session,
    config: SyncConfigOut,
    sync_run_id: int | None = None,
    from_date: datetime | None = None,
    capture_raw: bool = False,
):
    """Entrypoint called by manager. Handles credential validation and initial vs incremental sync.

    Args:
        db: Database session
        config: Sync configuration
        sync_run_id: Optional sync run ID for tracking
        from_date: Optional start date for manual sync (overrides config.last_sync)
        capture_raw: If True, capture raw SimpleFin API response for download
    """
    logger.debug(f"Running sync for config: {config.name} with ID {config.id}")

    from app.models import SyncRun

    # Get or create sync run record
    sync_run = None
    if sync_run_id:
        sync_run = db.query(SyncRun).get(sync_run_id)

    # Clear previous error state at the start of each run
    config.errors = None
    db.merge(config)
    db.commit()

    # Step 1: Ensure credentials
    if not all(k in config.config for k in ("username", "password", "endpoint")):
        updated_config = get_credentials(db, config)  # type: ignore[arg-type]
        if updated_config:
            config = updated_config
        if not updated_config:
            logger.warning("Could not fetch credentials, skipping sync")
            if sync_run:
                sync_run.status = "failed"
                sync_run.error_message = "Could not fetch credentials"
                sync_run.completed_at = datetime.now(UTC)
                db.commit()
            return

    cfg = config.config
    stats = {"accounts": {}, "total_transactions": 0, "total_holdings": 0}

    try:
        if from_date:
            # Manual sync from specified date
            start = from_date
            process_sync_range(
                cfg,
                db,
                config,
                start,
                datetime.now(UTC),
                stats,
                is_incremental=False,
                sync_run_id=sync_run_id,
                capture_raw=capture_raw,
            )
            logger.info(
                f"Manual sync from {start.date()} completed: processed {stats['total_transactions']} transactions"
            )
        elif config.last_sync:
            # Incremental sync from last sync to now (subtract 1 day for overlap)
            # Enable smart new account onboarding
            start = config.last_sync - timedelta(days=1)
            process_sync_range(
                cfg,
                db,
                config,
                start,
                datetime.now(UTC),
                stats,
                is_incremental=True,
                sync_run_id=sync_run_id,
                capture_raw=capture_raw,
            )
            logger.info(
                f"Incremental sync completed: processed {stats['total_transactions']} new transactions"
            )
        else:
            # First sync → walk backwards by month until 2 empty months
            logger.info("No previous sync found, performing initial sync")
            process_initial_sync(cfg, db, config, stats)
            logger.info("Initial sync completed")

        # Update last sync timestamp
        config.last_sync = datetime.now(UTC)
        db.merge(config)

        # Update sync run with success
        if sync_run:
            sync_run.status = "completed"
            sync_run.completed_at = datetime.now(UTC)
            sync_run.accounts_processed = len(stats["accounts"])  # type: ignore[arg-type]
            sync_run.transactions_found = stats["total_transactions"]
            sync_run.holdings_found = stats["total_holdings"]
            sync_run.details = stats["accounts"]

        db.commit()

    except Exception as e:
        logger.exception(f"Sync failed: {e}")
        if sync_run:
            sync_run.status = "failed"
            sync_run.error_message = str(e)
            sync_run.completed_at = datetime.now(UTC)
            db.commit()
        raise


def handle_new_account(cfg: dict, db: Session, account_id: str, already_synced_from: datetime):
    """Smart onboarding for a newly discovered account.

    Strategy:
    1. We already pulled 1-2 days of transactions (from incremental sync)
    2. Check if this account is a duplicate of an existing account
    3. If duplicate: Stop here, user will merge (which migrates old transactions)
    4. If NOT duplicate: Walk back to get full history
    """
    logger.info(f"Smart onboarding for new account {account_id}")

    # Check for duplicates using our existing duplicate detection logic
    duplicates = account_crud.find_duplicate_accounts(db)
    is_duplicate = any(account_id in [acc.id for acc in group["accounts"]] for group in duplicates)

    if is_duplicate:
        logger.info(
            f"Account {account_id} appears to be a duplicate. "
            "Stopping sync - user should merge accounts to preserve history."
        )
        # The duplicate warning will appear in the UI, prompting user to merge
        return

    # Not a duplicate - pull full history via walkback
    logger.info(f"Account {account_id} is genuinely new, pulling full history")

    # Walk back month by month from where we already synced
    end = already_synced_from
    empty_months = 0
    months_synced = 0

    while empty_months < 2:
        # Check if we've hit the optional limit
        if INITIAL_SYNC_MAX_MONTHS and months_synced >= INITIAL_SYNC_MAX_MONTHS:
            logger.info(
                f"Reached max walkback limit of {INITIAL_SYNC_MAX_MONTHS} months for {account_id}"
            )
            break

        start = (end - timedelta(days=1)).replace(day=1)

        # Fetch just this account's data for this range
        # Note: SimpleFIN doesn't support per-account filtering, so we fetch all and filter
        logger.debug(f"Walking back {account_id}: {start.date()} to {end.date()}")
        params = {
            "start-date": int(start.timestamp()),
            "end-date": int(end.timestamp()),
        }

        response = requests.get(
            cfg["endpoint"],
            auth=(cfg["username"], base64.b64decode(cfg["password"]).decode()),
            params=params,
        )
        response.raise_for_status()
        data = response.json()

        # Find our account in the response
        accounts = data.get("accounts", [])
        account_data = next((acc for acc in accounts if acc["id"] == account_id), None)

        if account_data:
            txns = account_data.get("transactions", [])
            txn_count = process_transactions(db, txns, account_id)

            if txn_count == 0:
                empty_months += 1
            else:
                empty_months = 0
                logger.debug(
                    f"Pulled {txn_count} transactions for {account_id} in {start.date()} to {end.date()}"
                )
        else:
            # Account not in response for this range
            empty_months += 1

        end = start
        months_synced += 1

    logger.info(f"Completed walkback for {account_id}: pulled {months_synced} months of history")


def process_initial_sync(
    cfg: dict, db: Session, config: SyncConfigOut, stats: dict[str, Any] | None = None
):
    """Walk backwards month by month until 2 consecutive months with no data or max months reached."""
    end = datetime.now(UTC).replace(day=1)
    empty_months = 0
    months_synced = 0

    if INITIAL_SYNC_MAX_MONTHS:
        logger.info(f"Starting initial sync (max {INITIAL_SYNC_MAX_MONTHS} months)")
    else:
        logger.info("Starting initial sync (no limit, will walk back until 2 empty months)")

    while empty_months < 2:
        # Check if we've hit the optional limit
        if INITIAL_SYNC_MAX_MONTHS and months_synced >= INITIAL_SYNC_MAX_MONTHS:
            break

        start = (end - timedelta(days=1)).replace(day=1)
        processed = process_sync_range(cfg, db, config, start, end, stats)
        if processed == 0:
            empty_months += 1
        else:
            empty_months = 0
        end = start
        months_synced += 1

    if INITIAL_SYNC_MAX_MONTHS and months_synced >= INITIAL_SYNC_MAX_MONTHS:
        logger.info(f"Initial sync reached max limit of {INITIAL_SYNC_MAX_MONTHS} months")
    else:
        logger.info(
            f"Initial sync completed after {months_synced} months (found 2 consecutive empty months)"
        )


def process_sync_range(
    cfg: dict,
    db: Session,
    config: SyncConfigOut,
    start: datetime,
    end: datetime,
    stats: dict[str, Any] | None = None,
    is_incremental: bool = False,
    sync_run_id: int | None = None,
    capture_raw: bool = False,
) -> int:
    """Fetch and process SimpleFIN data for a given range. Returns number of transactions processed.

    Args:
        is_incremental: If True, enables smart new account onboarding with duplicate detection
        sync_run_id: Optional sync run ID for raw response capture
        capture_raw: If True, capture and cache raw SimpleFin API response
    """
    logger.info(f"Syncing from {start.date()} to {end.date()}")
    params = {
        "start-date": int(start.timestamp()),
        "end-date": int(end.timestamp()),
    }

    response = requests.get(
        cfg["endpoint"],
        auth=(cfg["username"], base64.b64decode(cfg["password"]).decode()),
        params=params,
    )
    response.raise_for_status()

    # Capture raw JSON before parsing if requested
    if capture_raw and sync_run_id:
        raw_json = response.text
        from app.sync.manager import store_raw_response

        store_raw_response(sync_run_id, raw_json)
        logger.info(f"Captured raw SimpleFin response for sync_run {sync_run_id}")

    data = response.json()

    # Log errors from SimpleFIN API but continue processing
    errors = data.get("errors", [])
    if errors:
        logger.warning(f"SimpleFIN returned {len(errors)} error(s): {errors}")
        # Store errors as JSON array for frontend to display individually
        config.errors = json.dumps(errors)
        db.merge(config)
        db.commit()

    accounts = data.get("accounts", [])
    if not accounts:
        logger.debug("No accounts found in this range")
        return 0

    # Detect new accounts if this is an incremental sync
    new_account_ids = set()
    if is_incremental:
        existing_account_ids = {acc.id for acc in db.query(Account).all()}
        new_account_ids = {acc["id"] for acc in accounts if acc["id"] not in existing_account_ids}
        if new_account_ids:
            logger.info(f"Detected {len(new_account_ids)} new account(s): {new_account_ids}")

    total_txns = 0
    for account_data in accounts:
        org_data = account_data.get("org")
        if not org_data:
            continue

        process_org(db, org_data)
        org_id = org_data["id"]
        account_data["org_id"] = org_id

        # Check if this is a new account that needs smart onboarding
        account_id = account_data["id"]
        is_new_account = account_id in new_account_ids

        process_accounts(db, [account_data], org_id)
        process_account_balance(db, account_data)

        # Process transactions (current time range)
        txn_count = process_transactions(db, account_data.get("transactions", []), account_id)
        holding_count = process_holdings(db, account_data.get("holdings", []), account_id)

        total_txns += txn_count

        # If this is a new account, check for duplicates and optionally pull more history
        if is_new_account:
            handle_new_account(cfg, db, account_id, start)

        # Track stats per account if stats dict provided
        if stats is not None:
            if account_id not in stats["accounts"]:
                account = db.query(Account).get(account_id)
                stats["accounts"][account_id] = {
                    "name": account.display_name if account else account_id,
                    "transactions": 0,
                    "holdings": 0,
                }
            stats["accounts"][account_id]["transactions"] += txn_count
            stats["accounts"][account_id]["holdings"] += holding_count
            stats["total_transactions"] += txn_count
            stats["total_holdings"] += holding_count

    if total_txns > 0:
        logger.info(f"Processed {total_txns} transactions between {start.date()} and {end.date()}")

    return total_txns


def process_org(db: Session, org_data: dict):
    org_id = org_data["id"]
    org_input = OrgCreate(**org_data)
    existing = db.get(Org, org_id)
    if existing:
        org_crud.update_org(db, org_id, OrgUpdate(**org_data))
    else:
        org_crud.create_org(db, org_input)


def classify_account(acct: dict) -> str | None:
    """Classify account type based on holdings, name keywords, and balance heuristics."""
    # Check if "holdings" exists and is a non-empty collection
    holdings = acct.get("holdings")
    if isinstance(holdings, collections.abc.Collection) and len(holdings) > 0:
        return "investment"

    # Check account name for investment keywords
    name = acct.get("name", "").lower()
    investment_keywords = [
        "brokerage",
        "investment",
        "401k",
        "403b",
        "roth",
        "ira",
        "retirement",
        "portfolio",
        "trading",
        "stock plan",
        "etrade",
        "robinhood",
        "schwab",
        "fidelity",
        "vanguard",
        "merrill",
        "td ameritrade",
        "fund",
        "mutual",
        "equity",
        "securities",
    ]
    if any(keyword in name for keyword in investment_keywords):
        return "investment"

    # Check for credit card keywords
    credit_keywords = ["card", "credit", "visa", "mastercard", "amex", "discover"]
    if any(keyword in name for keyword in credit_keywords):
        return "credit_card"

    # Check for bank account keywords
    bank_keywords = [
        "checking",
        "savings",
        "spending",
        "deposit",
        "dda",
        "mma",
        "money market",
    ]
    if any(keyword in name for keyword in bank_keywords):
        return "bank"

    # Fallback to balance-based heuristics
    balance_str = acct.get("balance")
    avail_str = acct.get("available_balance")
    balance = None
    avail = None

    try:
        if balance_str is not None:
            balance = float(balance_str)
    except (ValueError, TypeError):
        # Handle cases where balance is not a valid number
        pass

    try:
        if avail_str is not None:
            avail = float(avail_str)
    except (ValueError, TypeError):
        # Handle cases where available_balance is not a valid number
        pass
    if balance is not None and avail is None:
        if balance <= 0:
            return "credit_card"

    if balance is not None and balance >= 0 and (avail is None or avail >= 0):
        return "bank"

    return None


def process_accounts(db: Session, accounts: list[dict], org_id: str):
    for acct in accounts:
        acct["org_id"] = org_id
        account_id = acct["id"]
        data = AccountCreate(**acct)
        existing = account_crud.get_accounts(db=db, account_id=account_id, is_hidden=True)

        # Classify only if account_type is missing
        if not existing or existing[0].account_type is None:
            acct_type_str = classify_account(acct)
            from app.models import AccountType

            if acct_type_str:
                data.account_type = AccountType(acct_type_str)

        if existing:
            account_crud.update_account(db, account_id, AccountUpdate(**acct))
        else:
            # Set created_at timestamp for new accounts (used for duplicate detection ordering)
            acct["created_at"] = datetime.now(UTC)
            data = AccountCreate(**acct)
            account_crud.create_account(db, data)


def process_transactions(db: Session, transactions: list[dict], account_id: str) -> int:
    """Process transactions with hash-based deduplication.

    This prevents duplicate transactions in two scenarios:
    1. Normal case: SimpleFIN sends same transaction ID twice (rare)
    2. Post-merge case: SimpleFIN sends same transaction with different ID after account merge

    Uses content_hash (SHA256) for O(1) duplicate detection.
    """
    from app.utils.hash import compute_transaction_hash

    # Get account info for smart categorization
    account = db.get(Account, account_id)
    account_type = account.account_type if account else None

    cnt = 0
    for txn in transactions:
        txn["account_id"] = account_id
        txn_id = txn["id"]

        # Fast path: Check if transaction ID already exists
        if db.get(Transaction, txn_id):
            continue

        # Compute content hash for this transaction
        posted_timestamp = txn.get("posted")
        # Convert Unix timestamp to datetime for hash computation
        posted = datetime.fromtimestamp(posted_timestamp, tz=UTC) if posted_timestamp else None
        amount = txn.get("amount")
        description = txn.get("description", "")

        from decimal import Decimal

        txn_hash = compute_transaction_hash(
            account_id,
            posted,
            Decimal(str(amount)) if amount else Decimal(0),
            description,
        )

        # Check if hash already exists (indexed lookup - very fast)
        existing_by_hash = (
            db.query(Transaction)
            .filter(
                Transaction.account_id == account_id,
                Transaction.content_hash == txn_hash,
            )
            .first()
        )

        if existing_by_hash:
            # Duplicate by content hash - skip
            logger.debug(
                f"Skipping duplicate transaction: {description[:50] if description else 'no description'} "
                f"(${amount} on {posted.date() if posted else 'unknown'})"
            )
            continue

        # New transaction - add hash and create
        txn["content_hash"] = txn_hash

        # Smart payee categorization for loan/mortgage accounts
        suggested_category_id = None
        if account_type in ["loan", "mortgage"]:
            suggested_category_id = _suggest_category_for_loan_transaction(
                db, description, str(account_type) if account_type else ""
            )

        transaction_crud.create_transaction(
            db, txn, suggested_payee_category_id=suggested_category_id
        )
        cnt += 1

    return cnt


def process_holdings(db: Session, holdings: list[dict], account_id: str) -> int:
    cnt = 0
    for holding in holdings:
        holding["account_id"] = account_id
        holding_id = holding["id"]
        if not db.get(Holding, holding_id):
            data = HoldingCreate(**holding)
            holding_crud.create_holding(db, data)
            cnt += 1
    return cnt


def process_account_balance(db: Session, account_data: dict):
    from app.crud import account_balance as balance_crud

    balance_date = account_data.get("balance-date")
    if not balance_date:
        logger.warning(
            f"No balance-date for account {account_data.get('id')}, skipping balance processing."
        )
        return

    try:
        balance_dt = datetime.fromtimestamp(int(balance_date), tz=UTC)
    except Exception:
        logger.warning(f"Invalid balance-date format: {balance_date}, skipping balance processing.")
        return

    balance_record = {
        "account_id": account_data["id"],
        "balance": account_data.get("balance"),
        "available_balance": account_data.get("available-balance"),
        "balance_date": balance_dt,
    }

    exists = (
        db.query(balance_crud.AccountBalance)
        .filter_by(account_id=balance_record["account_id"], balance_date=balance_dt)
        .first()
    )

    if not exists:
        data = AccountBalanceCreate(**balance_record)
        balance_crud.create_account_balance(db, data)


def classify_accounts(db: Session):
    """Batch classify accounts based on keywords and transaction patterns.

    This function is useful for reclassifying existing accounts after sync.
    """
    keywords = {
        "credit_card": ["card", "credit", "visa", "mastercard", "amex", "discover"],
        "bank_account": [
            "checking",
            "spending",
            "savings",
            "deposit",
            "dda",
            "mma",
            "money market",
        ],
        "investment": [
            "brokerage",
            "investment",
            "401k",
            "403b",
            "roth",
            "ira",
            "retirement",
            "portfolio",
            "trading",
            "stock plan",
            "etrade",
            "robinhood",
            "schwab",
            "fidelity",
            "vanguard",
            "merrill",
            "td ameritrade",
            "fund",
            "mutual",
            "equity",
            "securities",
        ],
    }

    accounts: list[Account] = db.query(Account).all()
    changed_accounts = []

    for account in accounts:
        if account.account_type:  # skip if already set
            continue

        acct_type = None

        # 1. Holdings present → investment
        if hasattr(account, "holdings") and account.holdings:
            acct_type = "investment"

        # 2. Keyword match in name
        elif account.name:
            lower_name = account.name.lower()
            for k_type, words in keywords.items():
                if any(w in lower_name for w in words):
                    acct_type = k_type
                    break

        # 3. Transaction sign analysis
        if not acct_type:
            txs = db.query(Transaction).filter(Transaction.account_id == account.id).all()
            if txs:
                signs = Counter("positive" if t.amount > 0 else "negative" for t in txs)
                if signs["negative"] > signs["positive"]:
                    acct_type = "credit_card"
                else:
                    acct_type = "bank_account"

        # 4. Available balance heuristic
        if not acct_type and getattr(account, "available_balance", None) == 0:
            acct_type = "credit_card"

        # 5. Fallback: use SimpleFIN `type` string
        if not acct_type and account.type:
            acct_type = account.type.lower()

        if acct_type:
            from app.models import AccountType

            account.account_type = AccountType(acct_type)  # type: ignore[assignment]
            changed_accounts.append(account)

    if changed_accounts:
        db.commit()
        print(f"Updated {len(changed_accounts)} accounts with inferred types.")
