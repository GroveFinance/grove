from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.crud import payee as crud
from app.db import get_db
from app.schemas import PayeeCreate, PayeeImportResponse, PayeeOut, PayeeUpdate

router = APIRouter()


@router.post("", response_model=PayeeOut, operation_id="create_payee")
def create_payee(data: PayeeCreate, db: Session = Depends(get_db)):
    return crud.create_payee(db, data)


@router.get("", response_model=list[PayeeOut], operation_id="list_payees")
def list_payees(exclude_investment: bool = False, db: Session = Depends(get_db)):
    return crud.get_payees(db, exclude_investment=exclude_investment)


@router.get("/export", operation_id="export_payees")
def export_payees(db: Session = Depends(get_db)):
    """Export all payees as CSV"""
    csv_content = crud.export_payees_to_csv(db)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="payees_export.csv"'},
    )


@router.get("/{id}", response_model=PayeeOut, operation_id="get_payee")
def get_payee(id: int, db: Session = Depends(get_db)):
    result = crud.get_payee(db, id)
    if not result:
        raise HTTPException(status_code=404, detail="Payee not found")
    return result


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


@router.post("/import", response_model=PayeeImportResponse, operation_id="import_payees")
async def import_payees(
    file: UploadFile = File(...),
    mode: str = Query("merge", pattern="^(merge|overwrite)$"),
    db: Session = Depends(get_db),
):
    """Import payees from CSV file"""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be CSV")

    content = await file.read()
    try:
        csv_text = content.decode("utf-8-sig")  # Handle BOM
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8") from None

    try:
        return crud.import_payees_from_csv(db, csv_text, mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
