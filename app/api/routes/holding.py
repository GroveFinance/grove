from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud import holding as crud
from app.db import get_db
from app.schemas import HoldingCreate, HoldingOut, HoldingUpdate

router = APIRouter()


@router.post("/", response_model=HoldingOut, operation_id="create_holding")
def create(data: HoldingCreate, db: Session = Depends(get_db)):
    return crud.create_holding(db, data)


@router.get("/{id}", response_model=HoldingOut, operation_id="read_holding")
def read(id: str, db: Session = Depends(get_db)):
    result = crud.get_holding(db, id)
    if not result:
        raise HTTPException(status_code=404, detail="Holding not found")
    return result


@router.get("/", response_model=list[HoldingOut], operation_id="list_holdings")
def list_holdings(
    account_id: str | None = None,
    created_start: datetime | None = Query(None),
    created_end: datetime | None = Query(None),
    include_hidden: bool = Query(False, description="Include holdings from hidden accounts"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return crud.get_holdings(
        db, account_id, created_start, created_end, include_hidden, skip, limit
    )


@router.put("/{id}", response_model=HoldingOut, operation_id="update_holding")
def update(id: str, data: HoldingUpdate, db: Session = Depends(get_db)):
    result = crud.update_holding(db, id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Holding not found")
    return result


@router.delete("/{id}", operation_id="delete_holding")
def delete(id: str, db: Session = Depends(get_db)):
    success = crud.delete_holding(db, id)
    if not success:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"success": True}
