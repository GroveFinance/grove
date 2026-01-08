from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.db import get_db

router = APIRouter()


@router.post("/", response_model=schemas.GroupOut, operation_id="create_group")
def create_group(group: schemas.GroupCreate, db: Session = Depends(get_db)):
    return crud.create_group(db, group)


@router.get("/", response_model=list[schemas.GroupOut], operation_id="list_groups")
def list_groups(db: Session = Depends(get_db)):
    return crud.get_groups(db)


@router.get("/{group_id}", response_model=schemas.GroupOut, operation_id="get_group")
def get_group(group_id: int, db: Session = Depends(get_db)):
    group = crud.get_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.put("/{group_id}", response_model=schemas.GroupOut, operation_id="update_group")
def update_group(group_id: int, group_update: schemas.GroupUpdate, db: Session = Depends(get_db)):
    group = crud.get_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    updated_group = crud.update_group(db, group_id, group_update)
    if not updated_group:
        raise HTTPException(status_code=400, detail="Failed to update group")
    return updated_group


@router.delete("/{group_id}", operation_id="delete_group")
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = crud.get_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    success = crud.delete_group(db, group_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete group")
    return {"success": True}
