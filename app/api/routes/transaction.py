from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud import transaction as crud
from app.db import get_db
from app.schemas import TransactionCreate, TransactionOut, TransactionUpdate

router = APIRouter()


@router.post("/", response_model=TransactionOut, operation_id="create_transaction")
def create(data: TransactionCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_transaction(db, data)
    except crud.SplitMismatchError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.get("/{id}", response_model=TransactionOut, operation_id="read_transaction")
def read(id: str, db: Session = Depends(get_db)):
    result = crud.get_transaction(db, id)
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return result


@router.get("/", response_model=list[TransactionOut], operation_id="list_transactions")
def list_transactions(
    account_ids: list[str] | None = Query(None),
    excluded_account_ids: list[str] | None = Query(None),
    category_ids: list[str] | None = Query(None),
    excluded_category_ids: list[str] | None = Query(None),
    payee_ids: list[str] | None = Query(None),
    payee_name: str | None = Query(None),
    transacted_start: datetime | None = Query(None),
    transacted_end: datetime | None = Query(None),
    skip: int = 0,
    limit: int = 1000,
    sort_by: str = "transacted_at",
    sort_order: str = "desc",
    skip_transfers: bool = False,
    split_mode: bool = False,
    account_types: list[str] | None = Query(
        None,
        description="Filter by account types (e.g., 'bank', 'credit_card', 'investment', 'loan')",
    ),
    exclude_account_types: list[str] | None = Query(
        None, description="Exclude account types (e.g., 'investment')"
    ),
    include_hidden: bool = Query(False, description="Include hidden accounts (default: False)"),
    db: Session = Depends(get_db),
):
    # Convert string IDs to integers for CRUD layer (except account_ids which are strings)
    category_ids_int = [int(id) for id in category_ids] if category_ids else []
    excluded_category_ids_int = (
        [int(id) for id in excluded_category_ids] if excluded_category_ids else []
    )
    payee_ids_int = [int(id) for id in payee_ids] if payee_ids else []

    return crud.get_transactions(
        db,
        account_ids or [],
        excluded_account_ids or [],
        category_ids_int,
        excluded_category_ids_int,
        payee_ids_int,
        payee_name,
        transacted_start,
        transacted_end,
        skip,
        limit,
        sort_by,
        sort_order,
        skip_transfers,
        split_mode,
        account_types,
        exclude_account_types,
        include_hidden,
    )


@router.put("/{id}", response_model=TransactionOut, operation_id="update_transaction")
def update(id: str, data: TransactionUpdate, db: Session = Depends(get_db)):
    result = crud.update_transaction(db, id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return result


@router.delete("/{id}", operation_id="delete_transaction")
def delete(id: str, db: Session = Depends(get_db)):
    crud.delete_transaction(db, id)
    return {"success": True}


@router.get("/summary/stats", operation_id="get_transaction_summary")
def get_summary(
    account_ids: list[str] | None = Query(None),
    excluded_account_ids: list[str] | None = Query(None),
    category_ids: list[str] | None = Query(None),
    excluded_category_ids: list[str] | None = Query(None),
    payee_ids: list[str] | None = Query(None),
    payee_name: str | None = Query(None),
    transacted_start: datetime | None = Query(None),
    transacted_end: datetime | None = Query(None),
    skip_transfers: bool = False,
    account_types: list[str] | None = Query(
        None,
        description="Filter by account types (e.g., 'bank', 'credit_card', 'investment', 'loan')",
    ),
    exclude_account_types: list[str] | None = Query(
        None, description="Exclude account types (e.g., 'investment')"
    ),
    include_hidden: bool = Query(False, description="Include hidden accounts (default: False)"),
    db: Session = Depends(get_db),
):
    """
    Get summary statistics (total income, total expense, net, count) for transactions
    matching the given filters. Returns aggregated totals across ALL matching transactions,
    not just the paginated results.
    """
    # Convert string IDs to integers for CRUD layer (except account_ids which are strings)
    category_ids_int = [int(id) for id in category_ids] if category_ids else []
    excluded_category_ids_int = (
        [int(id) for id in excluded_category_ids] if excluded_category_ids else []
    )
    payee_ids_int = [int(id) for id in payee_ids] if payee_ids else []

    return crud.get_transactions_summary(
        db,
        account_ids or [],
        excluded_account_ids or [],
        category_ids_int,
        excluded_category_ids_int,
        payee_ids_int,
        payee_name,
        transacted_start,
        transacted_end,
        skip_transfers,
        account_types,
        exclude_account_types,
        include_hidden,
    )
