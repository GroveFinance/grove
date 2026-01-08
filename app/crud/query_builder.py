"""
Centralized query building utilities for consistent transaction filtering across the application.

This module provides reusable query components to ensure that:
1. Category fallback logic (split.category_id -> payee.category_id) is consistent
2. Transfer exclusion is applied uniformly
3. Account type filtering is standardized
4. Query logic is not duplicated across CRUD functions
"""

from datetime import datetime

from sqlalchemy import case
from sqlalchemy.orm import Query, Session

from app import models


def get_effective_category_id():
    """
    Returns a SQLAlchemy expression for the effective category ID.
    Uses fallback logic: split.category_id if non-zero, otherwise payee.category_id.

    Usage in queries:
        effective_category_id = get_effective_category_id()
        query = query.filter(effective_category_id == some_category_id)
    """
    return case(
        (models.TransactionSplit.category_id != 0, models.TransactionSplit.category_id),
        else_=models.Payee.category_id,
    )


def get_transfer_category(db: Session) -> models.Category | None:
    """
    Get the Transfer category (case-insensitive search for '%transfer%').
    Returns None if not found.

    Cached on the session to avoid repeated queries.
    """
    # Check if already cached on the session
    if not hasattr(db, "_transfer_category_cache"):
        transfer_cat = (
            db.query(models.Category).filter(models.Category.name.ilike("%transfer%")).first()
        )
        db._transfer_category_cache = transfer_cat  # type: ignore[attr-defined]

    return db._transfer_category_cache  # type: ignore[attr-defined]


def apply_transfer_exclusion(query: Query, db: Session) -> Query:
    """
    Apply transfer exclusion filter to a query.
    Uses category fallback logic to properly identify transfers:
    - Excludes if split.category_id is Transfer
    - Excludes if split.category_id is 0 AND payee.category_id is Transfer

    Requires the query to already have TransactionSplit joined.
    Should have Payee outer joined if using fallback logic.

    Args:
        query: SQLAlchemy query with TransactionSplit already joined
        db: Database session (used to get transfer category)

    Returns:
        Modified query with transfer exclusion filter applied
    """
    transfer_category = get_transfer_category(db)

    if not transfer_category:
        # No transfer category defined, nothing to exclude
        return query

    # Apply exclusion filter with fallback logic
    query = query.filter(
        ~(
            # Exclude if split is explicitly "Transfer"
            (models.TransactionSplit.category_id == transfer_category.id)
            |
            # Exclude if split is uncategorized (0) AND payee category is "Transfer"
            (
                (models.TransactionSplit.category_id == 0)
                & (models.Payee.category_id == transfer_category.id)
            )
        )
    )

    return query


def apply_account_type_filters(
    query: Query,
    include_types: list[str] | None = None,
    exclude_types: list[str] | None = None,
) -> Query:
    """
    Apply account type filtering to a query.

    Requires the query to already have Account joined.

    Args:
        query: SQLAlchemy query with Account already joined
        include_types: If provided, only include these account types
        exclude_types: If provided, exclude these account types (takes precedence over include)

    Returns:
        Modified query with account type filters applied
    """
    if include_types:
        query = query.filter(models.Account.account_type.in_(include_types))

    if exclude_types:
        query = query.filter(~models.Account.account_type.in_(exclude_types))

    return query


def apply_hidden_account_filter(
    query: Query,
    include_hidden: bool = False,
) -> Query:
    """
    Apply hidden account filtering to a query.

    By default, excludes hidden accounts. Pass include_hidden=True to include them.

    Requires the query to already have Account joined.

    Args:
        query: SQLAlchemy query with Account already joined
        include_hidden: If True, include hidden accounts; if False (default), exclude them

    Returns:
        Modified query with hidden account filter applied
    """
    if not include_hidden:
        query = query.filter(models.Account.is_hidden == False)  # noqa: E712

    return query


def build_base_split_query(
    db: Session,
    start: datetime | None = None,
    end: datetime | None = None,
    exclude_transfers: bool = False,
    expense_only: bool = False,
    income_only: bool = False,
    exclude_account_types: list[str] | None = None,
    include_account_types: list[str] | None = None,
    include_hidden: bool = False,
) -> Query:
    """
    Build a base query for transaction splits with common filters applied.

    This query includes:
    - TransactionSplit as the primary table
    - Inner join to Transaction
    - Inner join to Account
    - Outer join to Payee (for category fallback)

    Args:
        db: Database session
        start: Start date filter (inclusive)
        end: End date filter (inclusive)
        exclude_transfers: If True, exclude transfer transactions
        expense_only: If True, only include negative amounts (expenses)
        income_only: If True, only include positive amounts (income)
        exclude_account_types: Account types to exclude (e.g., ["investment"])
        include_account_types: Account types to include (exclusive with exclude)
        include_hidden: If True, include hidden accounts; if False (default), exclude them

    Returns:
        SQLAlchemy query ready for further customization
    """

    # Start with basic query and joins
    query = (
        db.query(models.TransactionSplit)
        .join(
            models.Transaction,
            models.TransactionSplit.transaction_id == models.Transaction.id,
        )
        .join(models.Account, models.Transaction.account_id == models.Account.id)
        .outerjoin(models.Payee, models.Transaction.payee_id == models.Payee.id)
    )

    # Date filters
    if start:
        query = query.filter(models.Transaction.transacted_at >= start)

    if end:
        query = query.filter(models.Transaction.transacted_at <= end)

    # Amount filters (mutually exclusive)
    if expense_only and income_only:
        raise ValueError("expense_only and income_only cannot both be True")

    if expense_only:
        query = query.filter(models.TransactionSplit.amount < 0)

    if income_only:
        query = query.filter(models.TransactionSplit.amount > 0)

    # Account type filters
    query = apply_account_type_filters(query, include_account_types, exclude_account_types)

    # Hidden account filter
    query = apply_hidden_account_filter(query, include_hidden)

    # Transfer exclusion
    if exclude_transfers:
        query = apply_transfer_exclusion(query, db)

    return query


def apply_transfer_exclusion_transaction_level(query: Query, db: Session) -> Query:
    """
    Apply transfer exclusion filter to a Transaction-level query.
    This is used when the query is for Transaction objects (not TransactionSplit).

    Uses category fallback logic to properly identify transfers:
    - Excludes if any split has category Transfer
    - Excludes if any split is uncategorized (0) AND payee category is Transfer

    Requires the query to be at the Transaction model level.

    Args:
        query: SQLAlchemy query at Transaction level
        db: Database session (used to get transfer category)

    Returns:
        Modified query with transfer exclusion filter applied
    """
    transfer_category = get_transfer_category(db)

    if not transfer_category:
        # No transfer category defined, nothing to exclude
        return query

    # Apply exclusion filter with fallback logic
    query = query.filter(
        ~(
            # exclude if:
            # 1. split is explicitly "Transfer"
            models.Transaction.splits.any(
                models.TransactionSplit.category_id == transfer_category.id
            )
            |
            # 2. split is uncategorized (0) AND payee category is "Transfer"
            models.Transaction.splits.any(
                (models.TransactionSplit.category_id == 0)
                & models.Transaction.payee.has(models.Payee.category_id == transfer_category.id)
            )
        )
    )

    return query


def build_base_transaction_query(
    db: Session,
    start: datetime | None = None,
    end: datetime | None = None,
    exclude_transfers: bool = False,
    exclude_account_types: list[str] | None = None,
    include_account_types: list[str] | None = None,
    include_hidden: bool = False,
) -> Query:
    """
    Build a base query for Transaction objects with standard joins and filters.

    This query includes:
    - Transaction as the primary table
    - Inner join to Account
    - Outer join to Payee (for category fallback)

    Args:
        db: Database session
        start: Start date filter (inclusive)
        end: End date filter (inclusive)
        exclude_transfers: If True, exclude transfer transactions
        exclude_account_types: Account types to exclude (e.g., ["investment"])
        include_account_types: Account types to include (exclusive with exclude)
        include_hidden: If True, include hidden accounts; if False (default), exclude them

    Returns:
        SQLAlchemy query ready for further customization
    """
    # Start with basic query and joins
    query = (
        db.query(models.Transaction)
        .join(models.Account, models.Transaction.account_id == models.Account.id)
        .outerjoin(models.Payee, models.Transaction.payee_id == models.Payee.id)
    )

    # Date filters
    if start:
        query = query.filter(models.Transaction.transacted_at >= start)

    if end:
        query = query.filter(models.Transaction.transacted_at <= end)

    # Account type filters
    query = apply_account_type_filters(query, include_account_types, exclude_account_types)

    # Hidden account filter
    query = apply_hidden_account_filter(query, include_hidden)

    # Transfer exclusion (uses transaction-level function)
    if exclude_transfers:
        query = apply_transfer_exclusion_transaction_level(query, db)

    return query


def apply_category_filter(
    query: Query,
    category_ids: list[int],
    db: Session,
) -> Query:
    """
    Apply category filtering with proper fallback logic.

    Handles the special case of category_id 0 (Uncategorized):
    - For category 0: match only if split is 0 AND payee category is also 0 (or no payee)
    - For other categories: match if split has category OR (split is 0 AND payee has category)

    Requires the query to already have TransactionSplit and Payee joined.

    Args:
        query: SQLAlchemy query with TransactionSplit and Payee joined
        category_ids: List of category IDs to filter by
        db: Database session

    Returns:
        Modified query with category filter applied
    """
    if not category_ids:
        return query

    # Special handling for category_id 0 (Uncategorized)
    if 0 in category_ids:
        # For uncategorized: split must be 0 AND payee category must also be 0 (or no payee)
        uncategorized_filter = models.Transaction.splits.any(
            models.TransactionSplit.category_id == 0
        ) & (
            models.Transaction.payee.has(models.Payee.category_id == 0)
            | (models.Transaction.payee_id.is_(None))
        )

        # If there are other categories selected too, combine with OR
        other_category_ids = [cid for cid in category_ids if cid != 0]
        if other_category_ids:
            query = query.filter(
                uncategorized_filter
                |
                # Match if split has the category directly
                models.Transaction.splits.any(
                    models.TransactionSplit.category_id.in_(other_category_ids)
                )
                |
                # Match if split is uncategorized AND payee has the default category
                (
                    models.Transaction.splits.any(models.TransactionSplit.category_id == 0)
                    & models.Transaction.payee.has(models.Payee.category_id.in_(other_category_ids))
                )
            )
        else:
            # Only category 0 selected
            query = query.filter(uncategorized_filter)
    else:
        # No category 0 selected - use the standard fallback logic
        query = query.filter(
            models.Transaction.splits.any(
                # Match if split has the category directly
                models.TransactionSplit.category_id.in_(category_ids)
            )
            |  # OR
            # Match if split is uncategorized AND payee has the default category
            (
                models.Transaction.splits.any(models.TransactionSplit.category_id == 0)
                & models.Transaction.payee.has(models.Payee.category_id.in_(category_ids))
            )
        )

    return query


def apply_category_exclusion_filter(
    query: Query,
    excluded_category_ids: list[int],
    db: Session,
) -> Query:
    """
    Apply category exclusion filtering with proper fallback logic.

    A transaction is EXCLUDED if it would be INCLUDED by the inclusion filter with these categories.
    In other words, we exclude transactions where:
    - ANY split has a category directly in the excluded list, OR
    - ANY split is uncategorized (0) AND the payee's default category is in the excluded list

    This is the exact inverse of apply_category_filter.

    Args:
        query: SQLAlchemy query at Transaction level with Payee joined
        excluded_category_ids: List of category IDs to exclude
        db: Database session

    Returns:
        Modified query with category exclusion filter applied
    """
    if not excluded_category_ids:
        return query

    # Special handling if category 0 (Uncategorized) is in the excluded list
    if 0 in excluded_category_ids:
        # Split into two groups: category 0 and others
        other_excluded_ids = [cid for cid in excluded_category_ids if cid != 0]

        if other_excluded_ids:
            # Exclude transactions where:
            # 1. Split has a category in other_excluded_ids, OR
            # 2. Split is uncategorized AND payee has category in other_excluded_ids, OR
            # 3. Split is uncategorized AND payee is also uncategorized (truly uncategorized)
            query = query.filter(
                ~(
                    # Match non-zero excluded categories
                    models.Transaction.splits.any(
                        models.TransactionSplit.category_id.in_(other_excluded_ids)
                    )
                    |
                    # Match uncategorized splits with excluded payee category
                    (
                        models.Transaction.splits.any(models.TransactionSplit.category_id == 0)
                        & models.Transaction.payee.has(
                            models.Payee.category_id.in_(other_excluded_ids)
                        )
                    )
                    |
                    # Match truly uncategorized (split=0 AND payee=0 or no payee)
                    (
                        models.Transaction.splits.any(models.TransactionSplit.category_id == 0)
                        & (
                            models.Transaction.payee.has(models.Payee.category_id == 0)
                            | models.Transaction.payee_id.is_(None)
                        )
                    )
                )
            )
        else:
            # Only excluding category 0 - exclude truly uncategorized only
            query = query.filter(
                ~(
                    models.Transaction.splits.any(models.TransactionSplit.category_id == 0)
                    & (
                        models.Transaction.payee.has(models.Payee.category_id == 0)
                        | models.Transaction.payee_id.is_(None)
                    )
                )
            )
    else:
        # Category 0 not in excluded list - use standard exclusion
        query = query.filter(
            ~(
                models.Transaction.splits.any(
                    models.TransactionSplit.category_id.in_(excluded_category_ids)
                )
                | (
                    models.Transaction.splits.any(models.TransactionSplit.category_id == 0)
                    & models.Transaction.payee.has(
                        models.Payee.category_id.in_(excluded_category_ids)
                    )
                )
            )
        )

    return query
