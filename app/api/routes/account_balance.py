from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud import account_balance as crud
from app.db import get_db
from app.schemas import AccountBalanceOut

router = APIRouter()


@router.get("/", response_model=list[AccountBalanceOut], operation_id="list_account_balances")
def list_account_balances(
    account_id: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    db: Session = Depends(get_db),
):
    return crud.get_account_balances(db, account_id, start_date, end_date)


@router.get(
    "/{account_id}",
    response_model=AccountBalanceOut,
    operation_id="get_account_balance",
)
def get_account_balance(account_id: int, db: Session = Depends(get_db)):
    bal = crud.get_account_balance_by_account_id(db, account_id)
    if not bal:
        raise HTTPException(status_code=404, detail="Account balance not found")
    return bal


# @router.post("/", response_model=AccountBalanceOut, operation_id="create_account_balance")
# def create_account_balance(data: AccountBalanceCreate, db: Session = Depends(get_db)):
#    return crud.create_account_balance(db, data)
#
#
# @router.put("/{id}", response_model=AccountBalanceOut, operation_id="update_account_balance")
# def update_account_balance(id: int, data: AccountBalanceUpdate, db: Session = Depends(get_db)):
#    bal = crud.update_account_balance(db, id, data)
#    if not bal:
#        raise HTTPException(status_code=404, detail="Account balance not found")
#    return bal
#
#
# @router.delete("/{id}", response_model=AccountBalanceOut, operation_id="delete_account_balance")
# def delete_account_balance(id: int, db: Session = Depends(get_db)):
#    bal = crud.delete_account_balance(db, id)
#    if not bal:
#        raise HTTPException(status_code=404, detail="Account balance not found")
#    return bal
