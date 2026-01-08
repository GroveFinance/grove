from datetime import date

from sqlalchemy.orm import Session

from app.crud.report import (
    get_budget_trends,
    get_budget_usage,
    get_category_trends,
    get_income_vs_expenses,
    get_net_worth_history,
    get_paycheck_analysis,
    get_top_transactions,
    get_upcoming_bills,
    get_utilities_report,
)
from app.schemas import (
    BudgetUsageRow,
    IncomeExpenseDataPoint,
    MonthSeries,
    NetWorthDataPoint,
    ReportOut,
    TopTransactionDataPoint,
    UpcomingBillDataPoint,
)


def build_category_trends(
    start: date,
    end: date,
    db: Session,
    limit: int | None = None,
    mode: str | None = None,
    exclude_account_types: list[str] | None = None,
) -> ReportOut:
    from datetime import datetime, time

    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)
    ms = get_category_trends(
        db, start_dt, end_dt, limit, mode or "per_month", exclude_account_types
    )

    return ReportOut[MonthSeries](
        report_type="category_trends",
        period={"start": start.isoformat(), "end": end.isoformat()},
        data=ms,
    )


def build_budget_usage(
    start: date,
    end: date,
    db: Session,
    limit: int | None = None,
    mode: str | None = None,
    exclude_account_types: list[str] | None = None,
) -> ReportOut:
    from datetime import datetime, time

    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)
    ms = get_budget_usage(
        db, start_dt, end_dt, limit or 5, mode or "per_month", exclude_account_types
    )

    return ReportOut[BudgetUsageRow](
        report_type="budget_usage",
        period={"start": start.isoformat(), "end": end.isoformat()},
        data=ms,
    )


def build_budget_trends(
    start: date, end: date, db: Session, exclude_account_types: list[str] | None = None
) -> ReportOut:
    from datetime import datetime, time

    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)
    data = get_budget_trends(db, start_dt, end_dt, exclude_account_types)

    return ReportOut(
        report_type="budget_trends",
        period={"start": start.isoformat(), "end": end.isoformat()},
        data=data,
    )


def build_utilities_report(
    start: date,
    end: date,
    db: Session,
    mode: str | None = None,
    exclude_account_types: list[str] | None = None,
) -> ReportOut:
    from datetime import datetime, time

    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)
    data = get_utilities_report(db, start_dt, end_dt, mode or "monthly", exclude_account_types)

    return ReportOut(
        report_type="utilities",
        period={"start": start.isoformat(), "end": end.isoformat()},
        data=data,  # type: ignore[arg-type]
    )


def build_income_vs_expenses(
    start: date, end: date, db: Session, exclude_account_types: list[str] | None = None
) -> ReportOut:
    """
    Build income vs expenses report.
    Dates are always adjusted to month boundaries (start of start month to end of end month).
    """
    from datetime import datetime, time

    from dateutil.relativedelta import relativedelta

    # Convert date to datetime
    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)

    # Adjust start to beginning of month
    month_start = start_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Adjust end to end of month (last day, 23:59:59)
    # Important: If end date is the 1st of a month at midnight, subtract 1 day first
    # This handles timezone edge cases where Nov 30 23:59 PST becomes Dec 1 07:59 UTC
    adjusted_end = end_dt
    if end_dt.day == 1 and end_dt.hour < 12:  # Likely a timezone-shifted end-of-month
        adjusted_end = end_dt - relativedelta(days=1)

    month_end = (
        adjusted_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        + relativedelta(months=1)
    ) - relativedelta(seconds=1)

    data = get_income_vs_expenses(db, month_start, month_end, exclude_account_types)

    return ReportOut[IncomeExpenseDataPoint](
        report_type="income_vs_expenses",
        period={"start": month_start.isoformat(), "end": month_end.isoformat()},
        data=data,
    )


def build_net_worth_history(start: date, end: date, db: Session) -> ReportOut:
    """
    Build net worth history report.
    Dates are always adjusted to month boundaries (start of start month to end of end month).
    """
    from datetime import datetime, time

    from dateutil.relativedelta import relativedelta

    # Convert date to datetime
    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)

    # Adjust start to beginning of month
    month_start = start_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Adjust end to end of month
    adjusted_end = end_dt
    if end_dt.day == 1 and end_dt.hour < 12:
        adjusted_end = end_dt - relativedelta(days=1)

    month_end = (
        adjusted_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        + relativedelta(months=1)
    ) - relativedelta(seconds=1)

    data = get_net_worth_history(db, month_start, month_end)

    return ReportOut[NetWorthDataPoint](
        report_type="net_worth_history",
        period={"start": month_start.isoformat(), "end": month_end.isoformat()},
        data=data,
    )


def build_upcoming_bills(
    db: Session,
    lookforward_days: int = 30,
    exclude_account_types: list[str] | None = None,
) -> ReportOut:
    """
    Build upcoming bills report based on recurring payment patterns.
    """
    from datetime import datetime, timedelta

    data = get_upcoming_bills(db, lookforward_days, exclude_account_types)

    today = datetime.now().date()
    end_date = today + timedelta(days=lookforward_days)

    return ReportOut[UpcomingBillDataPoint](
        report_type="upcoming_bills",
        period={"start": today.isoformat(), "end": end_date.isoformat()},
        data=data,
    )


def build_paycheck_analysis(
    start: date,
    end: date,
    db: Session,
    lookback_months: int = 6,
    exclude_account_types: list[str] | None = None,
) -> ReportOut:
    """
    Build paycheck analysis report with statistics and anomaly detection.
    """
    from datetime import datetime, time

    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)
    data = get_paycheck_analysis(db, start_dt, end_dt, lookback_months, exclude_account_types)

    # ReportOut expects data to be a list, so wrap the dict in a list
    return ReportOut(
        report_type="paycheck_analysis",
        period={"start": start.isoformat(), "end": end.isoformat()},
        data=[data],
    )


def build_top_transactions(
    start: date,
    end: date,
    db: Session,
    limit: int = 5,
    exclude_account_types: list[str] | None = None,
) -> ReportOut:
    """
    Build top transactions report showing largest expenses.
    Excludes transfers, hidden accounts, and investment accounts by default.
    """
    from datetime import datetime, time

    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)
    data = get_top_transactions(db, start_dt, end_dt, limit, True, exclude_account_types)

    return ReportOut[TopTransactionDataPoint](
        report_type="top_transactions",
        period={"start": start.isoformat(), "end": end.isoformat()},
        data=data,
    )
