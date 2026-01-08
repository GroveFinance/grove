from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud import payee as crud
from app.db import get_db
from app.schemas import PayeeCreate, PayeeOut, PayeeUpdate

router = APIRouter()


@router.post("/", response_model=PayeeOut, operation_id="create_payee")
def create_payee(data: PayeeCreate, db: Session = Depends(get_db)):
    return crud.create_payee(db, data)


@router.get("/{id}", response_model=PayeeOut, operation_id="get_payee")
def get_payee(id: int, db: Session = Depends(get_db)):
    result = crud.get_payee(db, id)
    if not result:
        raise HTTPException(status_code=404, detail="Payee not found")
    return result


@router.get("/", response_model=list[PayeeOut], operation_id="list_payees")
def list_payees(db: Session = Depends(get_db)):
    return crud.get_payees(db)


@router.put("/{id}", response_model=PayeeOut, operation_id="update_payee")
def update_payee(id: int, data: PayeeUpdate, db: Session = Depends(get_db)):
    result = crud.update_payee(db, id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Payee not found")
    return result


@router.delete("/{id}", operation_id="delete_payee")
def delete_payee(id: int, db: Session = Depends(get_db)):
    success = crud.delete_payee(db, id)
    if not success:
        raise HTTPException(status_code=404, detail="Payee not found")
    return {"success": True}


@router.post("/apply", response_model=dict, operation_id="apply_payees")
def apply_payees(transaction_ids: list[str], db: Session = Depends(get_db)):
    updated = crud.apply_payees_to_transactions(db, transaction_ids)
    return {"updated": updated}
