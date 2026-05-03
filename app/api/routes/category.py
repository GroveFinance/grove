import json

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import crud, schemas
from app.db import get_db

router = APIRouter(tags=["category"])


@router.post("", response_model=schemas.CategoryOut, operation_id="create_category")
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    group = crud.get_group(db, category.group_id)
    if not group:
        raise HTTPException(status_code=400, detail="Group does not exist")
    return crud.create_category(db, category)


@router.get("", response_model=list[schemas.CategoryOut], operation_id="list_categories")
def list_categories(db: Session = Depends(get_db)):
    return crud.get_categories(db)


@router.get("/{category_id}", response_model=schemas.CategoryOut, operation_id="get_category")
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = crud.get_category(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.put("/{category_id}", response_model=schemas.CategoryOut, operation_id="update_category")
def update_category(
    category_id: int,
    category_update: schemas.CategoryUpdate,
    db: Session = Depends(get_db),
):
    category = crud.get_category(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    updated_category = crud.update_category(db, category_id, category_update)
    if not updated_category:
        raise HTTPException(status_code=400, detail="Failed to update category")
    return updated_category


@router.delete("/{category_id}", operation_id="delete_category")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = crud.get_category(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    success = crud.delete_category(db, category_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete category")
    return {"success": True}


@router.get("/export", operation_id="export_categories")
def export_categories(db: Session = Depends(get_db)):
    """Export all categories and groups as JSON"""
    json_content = crud.export_categories_to_json(db)
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="categories_export.json"'},
    )


@router.post(
    "/import", response_model=schemas.CategoryImportResponse, operation_id="import_categories"
)
async def import_categories(
    file: UploadFile = File(...),
    mode: str = Query("merge", pattern="^(merge|overwrite)$"),
    db: Session = Depends(get_db),
):
    """Import categories and groups from JSON"""
    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="File must be JSON")

    content = await file.read()
    try:
        json_text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8") from None

    try:
        return crud.import_categories_from_json(db, json_text, mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}") from None
