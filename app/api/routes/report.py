from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.reports import (
    build_budget_trends,
    build_budget_usage,
    build_category_trends,
    build_income_vs_expenses,
    build_net_worth_history,
    build_paycheck_analysis,
    build_top_transactions,
    build_upcoming_bills,
    build_utilities_report,
)
from app.schemas import ReportOut

router = APIRouter()


@router.get("/", response_model=ReportOut)
def get_report(
    report_type: str = Query(
        ...,
        description="summary | income_vs_expenses | net_worth_history | category_trends | utilities | budget_usage | budget_trends | upcoming_bills | paycheck_analysis | top_transactions",
    ),
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int | None = Query(
        None, description="Limit number of results (for reports that support it)"
    ),
    mode: str | None = Query(
        None,
        description="Mode for certain reports, e.g., 'per_month' or 'global' for category_trends/budget_vs_actual",
    ),
    exclude_account_types: list[str] | None = Query(
        None,
        description="Exclude account types from report (defaults to ['investment'] for most reports)",
    ),
    lookforward_days: int | None = Query(
        30, description="For upcoming_bills: number of days to look ahead"
    ),
    lookback_months: int | None = Query(
        6, description="For paycheck_analysis: number of months to analyze"
    ),
    db: Session = Depends(get_db),
):
    # Convert datetime to date if provided
    start_date = start.date() if start else None
    end_date = end.date() if end else None

    if report_type == "category_trends":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start and end dates required")
        return build_category_trends(start_date, end_date, db, limit, mode, exclude_account_types)
    elif report_type == "budget_usage":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start and end dates required")
        return build_budget_usage(start_date, end_date, db, limit, mode, exclude_account_types)
    elif report_type == "budget_trends":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start and end dates required")
        return build_budget_trends(start_date, end_date, db, exclude_account_types)
    elif report_type == "utilities":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start and end dates required")
        return build_utilities_report(start_date, end_date, db, mode, exclude_account_types)
    elif report_type == "income_vs_expenses":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start and end dates required")
        return build_income_vs_expenses(start_date, end_date, db, exclude_account_types)
    elif report_type == "net_worth_history":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start and end dates required")
        return build_net_worth_history(start_date, end_date, db)
    elif report_type == "upcoming_bills":
        if lookforward_days is None:
            raise HTTPException(status_code=400, detail="lookforward_days required")
        return build_upcoming_bills(db, lookforward_days, exclude_account_types)
    elif report_type == "paycheck_analysis":
        if not start_date or not end_date or lookback_months is None:
            raise HTTPException(status_code=400, detail="start, end, and lookback_months required")
        return build_paycheck_analysis(
            start_date, end_date, db, lookback_months, exclude_account_types
        )
    elif report_type == "top_transactions":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start and end dates required")
        return build_top_transactions(start_date, end_date, db, limit or 5, exclude_account_types)
    # elif report_type == "summary":
    #    return build_summary_report(start, end, db)
    else:
        raise HTTPException(status_code=400, detail="Unknown report type")
