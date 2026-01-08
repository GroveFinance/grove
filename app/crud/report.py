import statistics
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import case, extract, func
from sqlalchemy.orm import Session, aliased

from app import models
from app.crud.query_builder import (
    apply_account_type_filters,
    apply_transfer_exclusion,
    build_base_split_query,
    get_effective_category_id,
)
from app.schemas import (
    BudgetUsageRow,
    IncomeExpenseDataPoint,
    MonthSeries,
    NetWorthDataPoint,
    TopTransactionDataPoint,
    UpcomingBillDataPoint,
)


def get_category_trends(
    db: Session,
    start: datetime,
    end: datetime,
    limit: int | None = None,
    mode: str = "per_month",
    exclude_account_types: list[str] | None = None,
) -> list[MonthSeries]:
    """
    Sum negative amounts by category per month.
    - Use TransactionSplit.category_id when set (>0).
    - If split.category_id is 0/None → fall back to transaction.payee.category_id.
    - If payee has no category → use 0 ("Uncategorized").
    - Excludes transfers (category name ilike "%transfer%").
    - By default excludes investment accounts unless overridden.
    """
    # Default to excluding investment accounts
    if exclude_account_types is None:
        exclude_account_types = ["investment"]

    # Use centralized category fallback logic
    resolved_category_id = get_effective_category_id()
    resolved_category_name = func.coalesce(models.Category.name, "Uncategorized")
    resolved_group_name = func.coalesce(models.Group.name, "Other")

    base_query = (
        db.query(
            func.date_trunc("month", models.Transaction.transacted_at).label("month"),
            resolved_category_id.label("category_id"),
            resolved_category_name.label("category"),
            resolved_group_name.label("group_name"),
            func.sum(models.TransactionSplit.amount).label("total"),
        )
        .join(
            models.Transaction,
            models.TransactionSplit.transaction_id == models.Transaction.id,
        )
        .join(models.Account, models.Transaction.account_id == models.Account.id)
        .outerjoin(models.Payee, models.Transaction.payee_id == models.Payee.id)
        .outerjoin(models.Category, resolved_category_id == models.Category.id)
        .outerjoin(models.Group, models.Category.group_id == models.Group.id)
        .filter(
            models.Transaction.transacted_at.is_not(None),
            models.Transaction.transacted_at >= start,
            models.Transaction.transacted_at <= end,
            models.TransactionSplit.amount < 0,
        )
    )

    # Apply account type exclusion
    base_query = apply_account_type_filters(base_query, exclude_types=exclude_account_types)

    # Exclude transfers using centralized logic
    base_query = apply_transfer_exclusion(base_query, db)

    base = base_query.group_by(
        func.date_trunc("month", models.Transaction.transacted_at),
        resolved_category_id,
        resolved_category_name,
        resolved_group_name,
    ).subquery()

    if mode == "per_month":
        ranked = (
            db.query(
                base.c.month,
                base.c.category_id,
                base.c.category,
                base.c.group_name,
                base.c.total,
                func.row_number()
                .over(partition_by=base.c.month, order_by=base.c.total.asc())
                .label("rnk"),
            )
        ).subquery()

        if limit is not None:
            rows = db.query(
                ranked.c.month,
                case((ranked.c.rnk <= limit, ranked.c.category_id), else_=-1).label("category_id"),
                case((ranked.c.rnk <= limit, ranked.c.category), else_="Other").label("category"),
                case((ranked.c.rnk <= limit, ranked.c.group_name), else_="Other").label(
                    "group_name"
                ),
                ranked.c.total,
            ).all()
        else:
            rows = db.query(
                ranked.c.month,
                ranked.c.category_id,
                ranked.c.category,
                ranked.c.group_name,
                ranked.c.total,
            ).all()

    elif mode == "global":
        # Calculate global totals across all months first
        global_totals = (
            db.query(
                base.c.category_id,
                base.c.category,
                base.c.group_name,
                func.sum(base.c.total).label("total"),
            )
            .group_by(base.c.category_id, base.c.category, base.c.group_name)
            .subquery()
        )

        if limit is None:
            # No limit - return all categories with a dummy month
            from sqlalchemy import literal_column

            rows = (
                db.query(
                    literal_column(f"'{end.strftime('%Y-%m-%d')}'::date").label(
                        "month"
                    ),  # Use end date as month
                    global_totals.c.category_id,
                    global_totals.c.category,
                    global_totals.c.group_name,
                    global_totals.c.total,
                )
                .select_from(global_totals)
                .all()
            )
        else:
            # Rank categories by total spending (ascending = most negative first)
            ranked = (
                db.query(
                    global_totals.c.category_id,
                    global_totals.c.category,
                    global_totals.c.group_name,
                    global_totals.c.total,
                    func.row_number().over(order_by=global_totals.c.total.asc()).label("rnk"),
                )
            ).subquery()

            # Select top categories and mark others, then aggregate "Other"
            from sqlalchemy import literal_column

            rows = (
                db.query(
                    literal_column(f"'{end.strftime('%Y-%m-%d')}'::date").label(
                        "month"
                    ),  # Use end date as month
                    case((ranked.c.rnk <= limit, ranked.c.category_id), else_=-1).label(
                        "category_id"
                    ),
                    case((ranked.c.rnk <= limit, ranked.c.category), else_="Other").label(
                        "category"
                    ),
                    case((ranked.c.rnk <= limit, ranked.c.group_name), else_="Other").label(
                        "group_name"
                    ),
                    ranked.c.total,
                )
                .select_from(ranked)
                .all()
            )
    else:
        raise ValueError("mode must be 'per_month' or 'global'")

    collapsed: dict[tuple[str, str, int, str], float] = {}
    for row in rows:
        key = (
            row.month.strftime("%Y-%m"),
            row.category,
            row.category_id,
            row.group_name,
        )
        collapsed[key] = collapsed.get(key, 0.0) + float(row.total)

    return [
        MonthSeries(month=m, category=c, category_id=cid, group_name=gn, total=t)
        for (m, c, cid, gn), t in collapsed.items()
    ]


def get_budget_usage(
    db: Session,
    start: datetime,
    end: datetime,
    limit: int = 5,
    mode: str = "per_month",
    exclude_account_types: list[str] | None = None,
) -> list[BudgetUsageRow]:
    """
    Get budget usage by category.
    By default excludes investment accounts and transfers.
    """
    # Default to excluding investment accounts
    if exclude_account_types is None:
        exclude_account_types = ["investment"]

    # Use centralized category fallback logic
    effective_category_id = get_effective_category_id()

    query = (
        db.query(
            models.Category.id.label("category_id"),
            models.Category.name.label("category"),
            models.Category.budget.label("budget"),
            func.abs(func.sum(models.TransactionSplit.amount)).label("actual"),
        )
        .join(
            models.Transaction,
            models.Transaction.id == models.TransactionSplit.transaction_id,
        )
        .join(models.Account, models.Transaction.account_id == models.Account.id)
        .outerjoin(models.Payee, models.Transaction.payee_id == models.Payee.id)
        .join(models.Category, models.Category.id == effective_category_id)
        .filter(
            models.Transaction.transacted_at >= start,
            models.Transaction.transacted_at <= end,
            models.TransactionSplit.amount < 0,
            models.Category.budget > 0,
        )
    )

    # Apply account type exclusion
    query = apply_account_type_filters(query, exclude_types=exclude_account_types)

    # Exclude transfers
    query = apply_transfer_exclusion(query, db)

    # Group and order
    query = query.group_by(
        models.Category.id, models.Category.name, models.Category.budget
    ).order_by((func.abs(func.sum(models.TransactionSplit.amount)) / models.Category.budget).desc())

    if limit:
        query = query.limit(limit)

    rows = query.all()

    result: list[BudgetUsageRow] = [
        BudgetUsageRow(
            category_id=r.category_id,
            category=r.category,
            budget=float(r.budget or 0),
            actual=float(r.actual or 0),
            utilization=(float(r.actual or 0) / float(r.budget) if r.budget else 0),
            over_budget=(float(r.actual or 0) > float(r.budget) if r.budget else False),
        )
        for r in rows
    ]

    return result


def get_budget_trends(
    db: Session,
    start: datetime,
    end: datetime,
    exclude_account_types: list[str] | None = None,
) -> list[dict]:
    """
    Get monthly spending vs budget for all categories with budgets set.
    Returns data for the last 12 months (or within start/end range).
    By default excludes investment accounts and transfers.
    """
    # Default to excluding investment accounts
    if exclude_account_types is None:
        exclude_account_types = ["investment"]

    # Use centralized category fallback logic
    effective_category_id = get_effective_category_id()

    # Query monthly spending by category
    query = (
        db.query(
            func.date_trunc("month", models.Transaction.transacted_at).label("month"),
            models.Category.id.label("category_id"),
            models.Category.name.label("category"),
            models.Category.budget.label("budget"),
            func.abs(func.sum(models.TransactionSplit.amount)).label("spent"),
        )
        .join(
            models.Transaction,
            models.TransactionSplit.transaction_id == models.Transaction.id,
        )
        .join(models.Account, models.Transaction.account_id == models.Account.id)
        .outerjoin(models.Payee, models.Transaction.payee_id == models.Payee.id)
        .join(models.Category, effective_category_id == models.Category.id)
        .filter(
            models.Transaction.transacted_at >= start,
            models.Transaction.transacted_at <= end,
            models.TransactionSplit.amount < 0,  # Only expenses
            models.Category.budget > 0,  # Only categories with budgets
        )
    )

    # Apply account type exclusion
    query = apply_account_type_filters(query, exclude_types=exclude_account_types)

    # Exclude transfers
    query = apply_transfer_exclusion(query, db)

    # Group and order
    query = query.group_by(
        func.date_trunc("month", models.Transaction.transacted_at),
        models.Category.id,
        models.Category.name,
        models.Category.budget,
    ).order_by(
        models.Category.name,
        func.date_trunc("month", models.Transaction.transacted_at),
    )

    rows = query.all()

    return [
        {
            "month": row.month.strftime("%Y-%m"),
            "category_id": row.category_id,
            "category": row.category,
            "budget": float(row.budget or 0),
            "spent": float(row.spent or 0),
        }
        for row in rows
    ]


def get_utilities_report(
    db: Session,
    start: datetime,
    end: datetime,
    mode: str = "monthly",
    exclude_account_types: list[str] | None = None,
) -> list[dict]:
    """
    Get utility spending data.

    Modes:
    - 'monthly': Spending by month for each utility category
    - 'year_comparison': Compare this year vs last year by utility category

    By default excludes investment accounts unless overridden.
    """
    # Default to excluding investment accounts
    if exclude_account_types is None:
        exclude_account_types = ["investment"]

    # Get the "Bills & Utilities" group
    utility_group = db.query(models.Group).filter(models.Group.name.ilike("%util%")).first()

    if not utility_group:
        return []

    # Get all utility categories, excluding Mortgage and Rent (these are housing costs, not utilities)
    utility_category_ids = (
        db.query(models.Category.id)
        .filter(
            models.Category.group_id == utility_group.id,
            ~models.Category.name.ilike("%mortgage%"),
            ~models.Category.name.ilike("%rent%"),
        )
        .all()
    )
    category_ids = [cid[0] for cid in utility_category_ids]

    # Use centralized category fallback logic
    effective_category_id = get_effective_category_id()

    if mode == "monthly":
        # Get spending by month for each utility
        query = (
            db.query(
                func.date_trunc("month", models.Transaction.transacted_at).label("month"),
                models.Category.name.label("category"),
                func.abs(func.sum(models.TransactionSplit.amount)).label("amount"),
            )
            .join(
                models.Transaction,
                models.TransactionSplit.transaction_id == models.Transaction.id,
            )
            .join(models.Account, models.Transaction.account_id == models.Account.id)
            .outerjoin(models.Payee, models.Transaction.payee_id == models.Payee.id)
            .join(models.Category, effective_category_id == models.Category.id)
            .filter(
                effective_category_id.in_(category_ids),
                models.Transaction.transacted_at >= start,
                models.Transaction.transacted_at <= end,
                models.TransactionSplit.amount < 0,  # Only expenses
            )
        )

        # Apply account type exclusion
        query = apply_account_type_filters(query, exclude_types=exclude_account_types)

        # Exclude transfers
        query = apply_transfer_exclusion(query, db)

        # Group and order
        query = query.group_by(
            func.date_trunc("month", models.Transaction.transacted_at),
            models.Category.name,
        ).order_by(
            func.date_trunc("month", models.Transaction.transacted_at),
            models.Category.name,
        )

        rows = query.all()

        return [
            {
                "month": row.month.strftime("%Y-%m"),
                "category": row.category,
                "amount": float(row.amount or 0),
            }
            for row in rows
        ]

    elif mode == "year_comparison":
        # Get current year and last year from the date range
        current_year = end.year
        last_year = current_year - 1

        # Get this year's data
        this_year_query = (
            db.query(
                models.Category.name.label("category"),
                func.abs(func.sum(models.TransactionSplit.amount)).label("amount"),
            )
            .join(
                models.Transaction,
                models.TransactionSplit.transaction_id == models.Transaction.id,
            )
            .join(models.Account, models.Transaction.account_id == models.Account.id)
            .outerjoin(models.Payee, models.Transaction.payee_id == models.Payee.id)
            .join(models.Category, effective_category_id == models.Category.id)
            .filter(
                effective_category_id.in_(category_ids),
                extract("year", models.Transaction.transacted_at) == current_year,
                models.TransactionSplit.amount < 0,
            )
        )

        # Apply account type exclusion and transfer exclusion
        this_year_query = apply_account_type_filters(
            this_year_query, exclude_types=exclude_account_types
        )
        this_year_query = apply_transfer_exclusion(this_year_query, db)
        this_year_query = this_year_query.group_by(models.Category.name)

        this_year_rows = this_year_query.all()

        # Get last year's data
        last_year_query = (
            db.query(
                models.Category.name.label("category"),
                func.abs(func.sum(models.TransactionSplit.amount)).label("amount"),
            )
            .join(
                models.Transaction,
                models.TransactionSplit.transaction_id == models.Transaction.id,
            )
            .join(models.Account, models.Transaction.account_id == models.Account.id)
            .outerjoin(models.Payee, models.Transaction.payee_id == models.Payee.id)
            .join(models.Category, effective_category_id == models.Category.id)
            .filter(
                effective_category_id.in_(category_ids),
                extract("year", models.Transaction.transacted_at) == last_year,
                models.TransactionSplit.amount < 0,
            )
        )

        # Apply account type exclusion and transfer exclusion
        last_year_query = apply_account_type_filters(
            last_year_query, exclude_types=exclude_account_types
        )
        last_year_query = apply_transfer_exclusion(last_year_query, db)
        last_year_query = last_year_query.group_by(models.Category.name)

        last_year_rows = last_year_query.all()

        # Combine into a map
        data_map = {}
        for row in this_year_rows:
            data_map[row.category] = {
                "category": row.category,
                "this_year": float(row.amount or 0),
                "last_year": 0,
            }

        for row in last_year_rows:
            if row.category in data_map:
                data_map[row.category]["last_year"] = float(row.amount or 0)
            else:
                data_map[row.category] = {
                    "category": row.category,
                    "this_year": 0,
                    "last_year": float(row.amount or 0),
                }

        # Sort by this year's amount
        result = sorted(data_map.values(), key=lambda x: x["this_year"], reverse=True)
        return result

    else:
        raise ValueError("mode must be 'monthly' or 'year_comparison'")


def get_income_vs_expenses(
    db: Session,
    start: datetime,
    end: datetime,
    exclude_account_types: list[str] | None = None,
) -> list[IncomeExpenseDataPoint]:
    """
    Get monthly income vs expenses for the given date range.
    Dates are adjusted to the start/end of each month.

    Income: positive transaction amounts (amount > 0)
    Expenses: negative transaction amounts (amount < 0), excluding transfers

    Uses category fallback logic to exclude transfers properly.
    By default excludes investment accounts unless overridden.
    """
    # Default to excluding investment accounts
    if exclude_account_types is None:
        exclude_account_types = ["investment"]

    # Build base query for income (positive amounts, excluding transfers)
    # Using build_base_split_query ensures consistent category fallback and transfer exclusion
    income_base = build_base_split_query(
        db,
        start=start,
        end=end,
        exclude_transfers=True,
        income_only=True,
        exclude_account_types=exclude_account_types,
    )

    # Group by month and sum income
    income_query = (
        income_base.with_entities(
            func.date_trunc("month", models.Transaction.transacted_at).label("month"),
            func.sum(models.TransactionSplit.amount).label("income"),
        ).group_by(func.date_trunc("month", models.Transaction.transacted_at))
    ).subquery()

    # Build query for paycheck income specifically (category_id = 51)
    # Get the effective category ID using fallback logic
    effective_category_id = get_effective_category_id()

    paycheck_base = build_base_split_query(
        db,
        start=start,
        end=end,
        exclude_transfers=True,
        income_only=True,
        exclude_account_types=exclude_account_types,
    )

    # Filter for Paycheck category (id 51) using the effective category
    paycheck_query = (
        paycheck_base.filter(effective_category_id == 51)
        .with_entities(
            func.date_trunc("month", models.Transaction.transacted_at).label("month"),
            func.sum(models.TransactionSplit.amount).label("paycheck_income"),
        )
        .group_by(func.date_trunc("month", models.Transaction.transacted_at))
    ).subquery()

    # Build base query for expenses (negative amounts, excluding transfers)
    expense_base = build_base_split_query(
        db,
        start=start,
        end=end,
        exclude_transfers=True,
        expense_only=True,
        exclude_account_types=exclude_account_types,
    )

    # Group by month and sum expenses
    expense_query = (
        expense_base.with_entities(
            func.date_trunc("month", models.Transaction.transacted_at).label("month"),
            func.sum(models.TransactionSplit.amount).label("expenses"),
        ).group_by(func.date_trunc("month", models.Transaction.transacted_at))
    ).subquery()

    # Generate all months in the range (not just months with transactions)
    from dateutil.relativedelta import relativedelta
    from sqlalchemy import literal_column

    # Create a month series from start to end
    month_series = []
    current = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end_month = end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    while current <= end_month:
        month_series.append(current)
        current = current + relativedelta(months=1)

    # Build array literal for PostgreSQL UNNEST
    array_elements = ",".join([f"'{m.isoformat()}'::timestamp" for m in month_series])
    array_literal = f"ARRAY[{array_elements}]"

    # Create a CTE with all months
    all_months = db.query(func.unnest(literal_column(array_literal)).label("month")).subquery()

    # Combine income, paycheck income, and expenses with all months
    results = (
        db.query(
            all_months.c.month,
            func.coalesce(income_query.c.income, 0).label("income"),
            func.coalesce(paycheck_query.c.paycheck_income, 0).label("paycheck_income"),
            func.coalesce(expense_query.c.expenses, 0).label("expenses"),
        )
        .outerjoin(income_query, income_query.c.month == all_months.c.month)
        .outerjoin(paycheck_query, paycheck_query.c.month == all_months.c.month)
        .outerjoin(expense_query, expense_query.c.month == all_months.c.month)
        .order_by(all_months.c.month)
        .all()
    )

    return [
        IncomeExpenseDataPoint(
            month=row.month.strftime("%Y-%m"),
            income=float(row.income or 0),
            expenses=abs(float(row.expenses or 0)),  # Convert to positive for display
            net=float(row.income or 0) - abs(float(row.expenses or 0)),  # income - expenses
            paycheck_income=float(row.paycheck_income or 0),
        )
        for row in results
    ]


def get_net_worth_history(
    db: Session,
    start: datetime,
    end: datetime,
) -> list[NetWorthDataPoint]:
    """
    Calculate net worth history for the given date range.

    Strategy:
    1. Get current net worth from all accounts (sum of latest balances)
    2. For each month working backwards from current:
       - Calculate the net change (income - expenses) for that month
       - Subtract that from the running net worth to get the net worth at the start of that month

    This works backwards from the current account balances using the income vs expense data.
    """
    from sqlalchemy import select

    # Get the latest balance for each account
    # First, find the most recent balance_date for each account
    latest_balance_date_subq = (
        select(
            models.AccountBalance.account_id,
            func.max(models.AccountBalance.balance_date).label("latest_date"),
        )
        .group_by(models.AccountBalance.account_id)
        .subquery("latest_balance_date")
    )

    # Join to get the actual balance values
    latest_balance = aliased(models.AccountBalance, name="latest_balance")

    # Get current total net worth from all accounts (sum of latest balances)
    current_net_worth = (
        db.query(func.coalesce(func.sum(latest_balance.balance), 0))
        .select_from(models.Account)
        .outerjoin(
            latest_balance_date_subq,
            models.Account.id == latest_balance_date_subq.c.account_id,
        )
        .outerjoin(
            latest_balance,
            (models.Account.id == latest_balance.account_id)
            & (latest_balance_date_subq.c.latest_date == latest_balance.balance_date),
        )
        .scalar()
    )

    # Get income vs expenses data for the same period
    income_expense_data = get_income_vs_expenses(db, start, end)

    # Sort by month descending (most recent first) to work backwards
    income_expense_data.sort(key=lambda x: x.month, reverse=True)

    # Build net worth history working backwards from current
    net_worth_history = []
    running_net_worth = float(current_net_worth or 0)

    # Add current month data point (most recent month's ending balance)
    if income_expense_data:
        latest_month = income_expense_data[0]
        net_worth_history.append(
            NetWorthDataPoint(month=latest_month.month, net_worth=running_net_worth)
        )

        # Work backwards through remaining months
        for data_point in income_expense_data[1:]:
            # To get the net worth at the END of this earlier month,
            # we subtract the net change of all months between this month and now
            # Actually, we just need to subtract the previous month's net to go back one month
            prev_month_net = income_expense_data[income_expense_data.index(data_point) - 1].net
            running_net_worth -= prev_month_net

            net_worth_history.append(
                NetWorthDataPoint(month=data_point.month, net_worth=running_net_worth)
            )

    # Reverse to get chronological order (oldest to newest)
    net_worth_history.reverse()

    return net_worth_history


def get_upcoming_bills(
    db: Session,
    lookforward_days: int = 30,
    exclude_account_types: list[str] | None = None,
) -> list[UpcomingBillDataPoint]:
    """
    Predict upcoming bills based on historical transaction patterns.

    Analyzes transactions in the Bills & Utilities group to detect recurring payments.
    Supports monthly, bi-monthly, quarterly, and annual recurrence patterns.

    Args:
        db: Database session
        lookforward_days: How many days ahead to predict (default 30)
        exclude_account_types: Account types to exclude from analysis

    Returns:
        List of predicted upcoming bills with expected dates and amounts
    """
    from datetime import timedelta

    # Default to excluding investment accounts
    if exclude_account_types is None:
        exclude_account_types = ["investment"]

    # Get the "Bills & Utilities" group
    utility_group = db.query(models.Group).filter(models.Group.name.ilike("%util%")).first()

    if not utility_group:
        return []

    # Get all categories in the Bills & Utilities group
    utility_category_ids = (
        db.query(models.Category.id).filter(models.Category.group_id == utility_group.id).all()
    )
    category_ids = [cid[0] for cid in utility_category_ids]

    if not category_ids:
        return []

    # Use centralized category fallback logic
    effective_category_id = get_effective_category_id()

    # Get all bill/utility transactions from the last 12 months (to detect patterns)
    from_date = datetime.now(UTC) - timedelta(days=365)

    base_query = (
        db.query(
            models.Payee.name.label("payee"),
            models.Category.name.label("category"),
            models.Transaction.transacted_at,
            models.TransactionSplit.amount,
        )
        .join(
            models.Transaction,
            models.TransactionSplit.transaction_id == models.Transaction.id,
        )
        .join(models.Account, models.Transaction.account_id == models.Account.id)
        .join(models.Payee, models.Transaction.payee_id == models.Payee.id)
        .join(models.Category, effective_category_id == models.Category.id)
        .filter(
            effective_category_id.in_(category_ids),
            models.Transaction.transacted_at >= from_date,
            models.TransactionSplit.amount < 0,  # Only expenses
            models.Transaction.transacted_at.is_not(None),
        )
    )

    # Apply account type exclusion
    query = apply_account_type_filters(base_query, exclude_types=exclude_account_types)

    # Order by payee and date
    query = query.order_by(models.Payee.name, models.Transaction.transacted_at)

    rows = query.all()

    # Group transactions by payee
    payee_transactions: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        payee_transactions[row.payee].append(
            {
                "date": row.transacted_at,
                "amount": abs(float(row.amount)),
                "category": row.category,
            }
        )

    # Analyze each payee's transaction pattern
    upcoming_bills = []
    # Use timezone-aware datetime to match transaction dates
    today = datetime.now(UTC)

    for payee, transactions in payee_transactions.items():
        if len(transactions) < 2:
            # Need at least 2 transactions to detect a pattern
            continue

        # Sort by date
        transactions.sort(key=lambda x: x["date"])

        # Calculate intervals between transactions (in days)
        intervals = []
        for i in range(1, len(transactions)):
            delta = (transactions[i]["date"] - transactions[i - 1]["date"]).days
            intervals.append(delta)

        if not intervals:
            continue

        # Determine recurrence pattern
        avg_interval = sum(intervals) / len(intervals)

        # Classify recurrence type based on average interval
        # Allow some variance (±7 days for monthly, ±14 for quarterly)
        if 23 <= avg_interval <= 37:  # ~monthly (30 days ± 7)
            recurrence_type = "monthly"
            expected_interval = 30
        elif 55 <= avg_interval <= 69:  # ~bi-monthly (60 days ± 7)
            recurrence_type = "bi-monthly"
            expected_interval = 60
        elif 76 <= avg_interval <= 106:  # ~quarterly (90 days ± 14)
            recurrence_type = "quarterly"
            expected_interval = 90
        elif 350 <= avg_interval <= 380:  # ~annual (365 days ± 15)
            recurrence_type = "annual"
            expected_interval = 365
        else:
            # Irregular pattern, skip
            continue

        # Calculate average amount
        avg_amount = sum(t["amount"] for t in transactions) / len(transactions)

        # Predict next payment date based on last transaction
        last_transaction = transactions[-1]
        expected_date = last_transaction["date"] + timedelta(days=expected_interval)
        days_until = (expected_date - today).days

        # Only include bills that are due within the lookforward window
        if 0 <= days_until <= lookforward_days:
            upcoming_bills.append(
                UpcomingBillDataPoint(
                    payee=payee,
                    category=last_transaction["category"],
                    average_amount=round(avg_amount, 2),
                    expected_date=expected_date.date().isoformat(),
                    recurrence_type=recurrence_type,
                    days_until_due=days_until,
                    last_transaction_date=last_transaction["date"].date().isoformat(),
                )
            )

    # Sort by days until due (soonest first)
    upcoming_bills.sort(key=lambda x: x.days_until_due)

    return upcoming_bills


def get_paycheck_analysis(
    db: Session,
    start: datetime,
    end: datetime,
    lookback_months: int = 6,
    exclude_account_types: list[str] | None = None,
) -> dict:
    """
    Analyze paycheck income patterns to detect anomalies and provide insights.

    Returns:
    - Individual paycheck transactions (date, amount, payee)
    - Average paycheck amount
    - Deviation analysis (standard deviation, variance)
    - Per-payee breakdown (for multiple employers/income sources)
    - Trend indicators (increasing/decreasing/stable)

    Args:
        db: Database session
        start: Start date for analysis
        end: End date for analysis
        lookback_months: Number of months to analyze (default 6)
        exclude_account_types: Account types to exclude
    """
    from collections import defaultdict

    # Default to excluding investment accounts
    if exclude_account_types is None:
        exclude_account_types = ["investment"]

    # Get all paycheck transactions (category_id = 51)
    # Query at the Transaction level so we can use apply_category_filter
    from app.crud.query_builder import (
        apply_account_type_filters,
        apply_category_filter,
        apply_transfer_exclusion_transaction_level,
    )

    query = (
        db.query(models.Transaction)
        .join(models.Account, models.Transaction.account_id == models.Account.id)
        .outerjoin(models.Payee, models.Transaction.payee_id == models.Payee.id)
        .filter(models.Transaction.transacted_at >= start)
        .filter(models.Transaction.transacted_at <= end)
    )

    # Apply account type filters
    query = apply_account_type_filters(query, exclude_types=exclude_account_types)

    # Apply transfer exclusion
    query = apply_transfer_exclusion_transaction_level(query, db)

    # Apply category filter for Paycheck (category_id = 51) using proper fallback logic
    query = apply_category_filter(query, [51], db)

    # Filter for income only (positive amounts)
    # Need to check that at least one split is positive
    query = query.filter(models.Transaction.splits.any(models.TransactionSplit.amount > 0))

    # Get the results with transaction details
    transactions = query.order_by(models.Transaction.transacted_at.desc()).all()

    # Extract paycheck data from transactions
    rows: list[dict[str, Any]] = []
    for txn in transactions:
        # Find the positive split(s) that match the paycheck category
        for split in txn.splits:
            if split.amount > 0:
                # Check if this split is a paycheck using fallback logic
                effective_cat = (
                    split.category_id
                    if split.category_id != 0
                    else (txn.payee.category_id if txn.payee else 0)
                )
                if effective_cat == 51:
                    rows.append(
                        {
                            "id": txn.id,
                            "transacted_at": txn.transacted_at,
                            "amount": float(split.amount),
                            "payee": txn.payee.name if txn.payee else None,
                            "account": txn.account.display_name if txn.account else None,
                            "description": txn.description,
                        }
                    )
                    break  # Only count each transaction once

    if not rows:
        return {
            "paychecks": [],
            "summary": {
                "total_count": 0,
                "average_amount": 0,
                "median_amount": 0,
                "std_deviation": 0,
                "min_amount": 0,
                "max_amount": 0,
                "total_income": 0,
            },
            "by_payee": {},
            "trend": "insufficient_data",
        }

    # Extract paycheck data
    paychecks = []
    amounts: list[float] = []
    payee_data: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"amounts": [], "dates": [], "count": 0}
    )

    for row in rows:
        amount = float(row["amount"])
        paychecks.append(
            {
                "id": row["id"],
                "date": row["transacted_at"].date().isoformat(),
                "amount": amount,
                "payee": row["payee"] or "Unknown",
                "account": row["account"],
                "description": row["description"],
            }
        )
        amounts.append(amount)

        # Group by payee
        payee_key = row["payee"] or "Unknown"
        payee_data[payee_key]["amounts"].append(amount)
        payee_data[payee_key]["dates"].append(row["transacted_at"])
        payee_data[payee_key]["count"] += 1

    # Calculate summary statistics
    avg_amount = statistics.mean(amounts)
    median_amount = statistics.median(amounts)
    std_dev = statistics.stdev(amounts) if len(amounts) > 1 else 0
    min_amount = min(amounts)
    max_amount = max(amounts)
    total_income = sum(amounts)

    # Calculate per-payee statistics
    by_payee = {}
    for payee, data in payee_data.items():
        payee_amounts = data["amounts"]
        payee_avg = statistics.mean(payee_amounts)
        payee_std = statistics.stdev(payee_amounts) if len(payee_amounts) > 1 else 0

        # Calculate trend (compare first half to second half)
        if len(payee_amounts) >= 4:
            mid = len(payee_amounts) // 2
            first_half_avg = statistics.mean(payee_amounts[:mid])
            second_half_avg = statistics.mean(payee_amounts[mid:])
            if second_half_avg > first_half_avg * 1.05:
                trend = "increasing"
            elif second_half_avg < first_half_avg * 0.95:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            trend = "insufficient_data"

        by_payee[payee] = {
            "count": data["count"],
            "average_amount": round(payee_avg, 2),
            "std_deviation": round(payee_std, 2),
            "min_amount": round(min(payee_amounts), 2),
            "max_amount": round(max(payee_amounts), 2),
            "total_income": round(sum(payee_amounts), 2),
            "trend": trend,
            "last_paycheck_date": max(data["dates"]).date().isoformat(),
        }

    # Calculate overall trend
    if len(amounts) >= 4:
        mid = len(amounts) // 2
        # Reverse because we're ordered descending
        first_half_avg = statistics.mean(amounts[mid:])  # older paychecks
        second_half_avg = statistics.mean(amounts[:mid])  # recent paychecks
        if second_half_avg > first_half_avg * 1.05:
            overall_trend = "increasing"
        elif second_half_avg < first_half_avg * 0.95:
            overall_trend = "decreasing"
        else:
            overall_trend = "stable"
    else:
        overall_trend = "insufficient_data"

    # Detect anomalies using median-based approach (more robust to patterns)
    # This helps with bi-weekly patterns where one check has deductions
    anomalies = []

    # Use median absolute deviation (MAD) for more robust anomaly detection
    if len(amounts) >= 3:
        # For bi-weekly paychecks, group by position in month
        # Extract day of month for pattern detection
        from datetime import datetime as dt

        dated_amounts = [(dt.fromisoformat(pc["date"]).day, pc["amount"]) for pc in paychecks]

        # Simple heuristic: if we have >6 paychecks, check for early-month vs late-month pattern
        early_month = [amt for day, amt in dated_amounts if day <= 15]
        late_month = [amt for day, amt in dated_amounts if day > 15]

        # If we have both early and late month checks, analyze them separately
        if len(early_month) >= 2 and len(late_month) >= 2:
            early_median = statistics.median(early_month)
            late_median = statistics.median(late_month)
            early_mad = (
                statistics.median([abs(x - early_median) for x in early_month])
                if len(early_month) > 1
                else 0
            )
            late_mad = (
                statistics.median([abs(x - late_median) for x in late_month])
                if len(late_month) > 1
                else 0
            )

            # Check each paycheck against its pattern group
            for pc in paychecks:
                day = dt.fromisoformat(pc["date"]).day
                if day <= 15:
                    baseline = early_median
                    mad = early_mad
                else:
                    baseline = late_median
                    mad = late_mad

                # MAD-based threshold (3.5 * MAD is roughly equivalent to 2 std devs)
                if mad > 0:
                    deviation = abs(pc["amount"] - baseline) / (
                        1.4826 * mad
                    )  # 1.4826 converts MAD to std dev equivalent
                    if deviation > 2.5:
                        anomalies.append(
                            {
                                **pc,
                                "deviation_sigma": round(deviation, 2),
                                "difference_from_avg": round(pc["amount"] - baseline, 2),
                                "expected_amount": round(baseline, 2),
                            }
                        )
        else:
            # Fallback to simple median-based detection for all paychecks
            median = statistics.median(amounts)
            mad = statistics.median([abs(x - median) for x in amounts])

            if mad > 0:
                for pc in paychecks:
                    deviation = abs(pc["amount"] - median) / (1.4826 * mad)
                    if deviation > 2.5:
                        anomalies.append(
                            {
                                **pc,
                                "deviation_sigma": round(deviation, 2),
                                "difference_from_avg": round(pc["amount"] - median, 2),
                                "expected_amount": round(median, 2),
                            }
                        )

    return {
        "paychecks": paychecks,
        "summary": {
            "total_count": len(amounts),
            "average_amount": round(avg_amount, 2),
            "median_amount": round(median_amount, 2),
            "std_deviation": round(std_dev, 2),
            "min_amount": round(min_amount, 2),
            "max_amount": round(max_amount, 2),
            "total_income": round(total_income, 2),
        },
        "by_payee": by_payee,
        "trend": overall_trend,
        "anomalies": anomalies,
    }


def get_top_transactions(
    db: Session,
    start: datetime,
    end: datetime,
    limit: int = 5,
    expense_only: bool = True,
    exclude_account_types: list[str] | None = None,
) -> list[TopTransactionDataPoint]:
    """
    Get top transactions by amount for the given date range.

    By default returns the largest expenses (most negative amounts).
    Excludes transfers and hidden accounts.
    By default excludes investment accounts unless overridden.

    Args:
        db: Database session
        start: Start date for transactions
        end: End date for transactions
        limit: Maximum number of transactions to return
        expense_only: If True, only include expenses (negative amounts)
        exclude_account_types: Account types to exclude (default: ["investment"])

    Returns:
        List of top transactions ordered by amount (largest expenses first)
    """
    # Default to excluding investment accounts
    if exclude_account_types is None:
        exclude_account_types = ["investment"]

    # Use the centralized query builder with all standard filters
    # This ensures hidden accounts and transfers are excluded properly
    query = build_base_split_query(
        db,
        start=start,
        end=end,
        exclude_transfers=True,
        expense_only=expense_only,
        exclude_account_types=exclude_account_types,
        include_hidden=False,  # Always exclude hidden accounts
    )

    # Get the effective category for display
    effective_category_id = get_effective_category_id()

    # Add the necessary fields for the response
    query = (
        query.add_columns(
            models.Transaction.id,
            models.Transaction.transacted_at,
            models.Transaction.description,
            models.Payee.name.label("payee_name"),
            models.Account.alt_name,
            models.Account.name.label("account_name"),
            effective_category_id.label("effective_category_id"),
        )
        .outerjoin(models.Category, models.Category.id == effective_category_id)
        .add_columns(
            func.coalesce(models.Category.name, "Uncategorized").label("category_name"),
        )
        # Order by amount ascending (most negative first = biggest expenses)
        .order_by(models.TransactionSplit.amount.asc())
        .limit(limit)
    )

    rows = query.all()

    return [
        TopTransactionDataPoint(
            id=row.id,
            date=row.transacted_at.date().isoformat() if row.transacted_at else "",
            payee=row.payee_name,
            category=row.category_name,
            account=row.alt_name or row.account_name,
            amount=float(row.TransactionSplit.amount),
            description=row.description,
        )
        for row in rows
    ]
