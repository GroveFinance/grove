from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud import org as crud
from app.db import get_db
from app.schemas import OrgCreate, OrgOut, OrgUpdate

router = APIRouter()


@router.get("/", response_model=list[OrgOut], operation_id="list_orgs")
def list_orgs(db: Session = Depends(get_db)):
    return crud.get_orgs(db)


@router.get("/{id}", response_model=OrgOut, operation_id="get_org")
def get_org(id: str, db: Session = Depends(get_db)):
    org = crud.get_org_by_id(db, id)
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")
    return org


@router.post("/", response_model=OrgOut, operation_id="create_org")
def create_org(data: OrgCreate, db: Session = Depends(get_db)):
    return crud.create_org(db, data)


@router.put("/{id}", response_model=OrgOut, operation_id="update_org")
def update_org(id: str, data: OrgUpdate, db: Session = Depends(get_db)):
    org = crud.update_org(db, id, data)
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")
    return org


@router.delete("/{id}", response_model=OrgOut, operation_id="delete_org")
def delete_org(id: str, db: Session = Depends(get_db)):
    org = crud.delete_org(db, id)
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")
    return org
