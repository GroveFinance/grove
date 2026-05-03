import json
from datetime import UTC, datetime
from typing import Any, TypedDict

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas


class CategoryExportData(TypedDict):
    version: str
    exported_at: str
    groups: list[dict[str, Any]]
    ungrouped_categories: list[dict[str, Any]]


class CategoryImportStats(TypedDict):
    success: bool
    mode: str
    groups_created: int
    groups_updated: int
    categories_created: int
    categories_updated: int
    categories_skipped: int
    errors: list[str]
    warnings: list[str]


def create_category(db: Session, category: schemas.CategoryCreate):
    db_category = models.Category(
        name=category.name, budget=category.budget, group_id=category.group_id
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def get_categories(db: Session):
    return db.query(models.Category).order_by(models.Category.name).all()


def get_category(db: Session, category_id: int):
    return db.query(models.Category).filter(models.Category.id == category_id).first()


def update_category(db: Session, category_id: int, category_update: schemas.CategoryUpdate):
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not db_category:
        return None
    for key, value in category_update.dict(exclude_unset=True).items():
        setattr(db_category, key, value)

    db.commit()
    db.refresh(db_category)
    return db_category


def delete_category(db: Session, category_id: int):
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not db_category:
        return False
    db.delete(db_category)
    db.commit()
    return True


def _find_category_by_name_case_insensitive(
    db: Session, category_name: str
) -> models.Category | None:
    """Find category by name (case-insensitive)"""
    return (
        db.query(models.Category)
        .filter(func.lower(models.Category.name) == category_name.lower())
        .first()
    )


def export_categories_to_json(db: Session) -> str:
    """Export all categories and groups to JSON"""
    from app.crud.group import get_groups

    groups = get_groups(db)

    export_data: CategoryExportData = {
        "version": "1.0",
        "exported_at": datetime.now(UTC).isoformat(),
        "groups": [],
        "ungrouped_categories": [],
    }

    # Export grouped categories
    for group in groups:
        export_data["groups"].append(
            {
                "name": group.name,
                "categories": [
                    {"name": cat.name, "budget": cat.budget} for cat in group.categories
                ],
            }
        )

    # Export ungrouped categories
    ungrouped = (
        db.query(models.Category)
        .filter(models.Category.group_id.is_(None))
        .order_by(models.Category.name)
        .all()
    )
    for cat in ungrouped:
        export_data["ungrouped_categories"].append({"name": cat.name, "budget": cat.budget})

    return json.dumps(export_data, indent=2)


def import_categories_from_json(db: Session, json_content: str, mode: str) -> CategoryImportStats:
    """Import categories and groups from JSON"""
    from app.crud.group import create_group

    data = json.loads(json_content)

    if data.get("version") != "1.0":
        raise ValueError(f"Unsupported schema version: {data.get('version')}")

    stats: CategoryImportStats = {
        "success": True,
        "mode": mode,
        "groups_created": 0,
        "groups_updated": 0,
        "categories_created": 0,
        "categories_updated": 0,
        "categories_skipped": 0,
        "errors": [],
        "warnings": [],
    }

    # Helper to find group by name (case-insensitive)
    def find_group(name):
        return db.query(models.Group).filter(func.lower(models.Group.name) == name.lower()).first()

    # Process groups and their categories
    for group_data in data.get("groups", []):
        group_name = group_data.get("name", "").strip()
        if not group_name:
            stats["errors"].append("Found group with empty name")
            continue

        # Find or create group
        existing_group = find_group(group_name)
        if existing_group:
            group_id = existing_group.id
            if mode == "overwrite":
                stats["groups_updated"] += 1
        else:
            new_group = create_group(db, schemas.GroupCreate(name=group_name))
            group_id = new_group.id
            stats["groups_created"] += 1

        # Process categories
        for cat_data in group_data.get("categories", []):
            cat_name = cat_data.get("name", "").strip()
            cat_budget = cat_data.get("budget", 0)

            if not cat_name:
                continue

            existing_cat = _find_category_by_name_case_insensitive(db, cat_name)

            if existing_cat:
                if mode == "overwrite":
                    existing_cat.budget = cat_budget
                    existing_cat.group_id = group_id
                    stats["categories_updated"] += 1
                else:
                    stats["categories_skipped"] += 1
            else:
                create_category(
                    db, schemas.CategoryCreate(name=cat_name, budget=cat_budget, group_id=group_id)
                )
                stats["categories_created"] += 1

    # Process ungrouped categories
    for cat_data in data.get("ungrouped_categories", []):
        cat_name = cat_data.get("name", "").strip()
        cat_budget = cat_data.get("budget", 0)

        if not cat_name:
            continue

        existing_cat = _find_category_by_name_case_insensitive(db, cat_name)

        if existing_cat:
            if mode == "overwrite":
                existing_cat.budget = cat_budget
                existing_cat.group_id = None  # type: ignore[assignment]
                stats["categories_updated"] += 1
            else:
                stats["categories_skipped"] += 1
        else:
            db_cat = models.Category(name=cat_name, budget=cat_budget, group_id=None)
            db.add(db_cat)
            db.commit()
            db.refresh(db_cat)
            stats["categories_created"] += 1

    db.commit()
    return stats
