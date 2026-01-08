from datetime import datetime

from sqlalchemy.orm import Session

from app import models
from app.models import Holding
from app.schemas import HoldingCreate, HoldingUpdate


def create_holding(db: Session, data: HoldingCreate) -> Holding:
    obj = Holding(**data.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_holding(db: Session, id: str) -> Holding | None:
    return db.query(Holding).filter(Holding.id == id).first()


def get_holdings(
    db: Session,
    account_id: str | None = None,
    created_start: datetime | None = None,
    created_end: datetime | None = None,
    include_hidden: bool = False,
    skip: int = 0,
    limit: int = 100,
) -> list[Holding]:
    query = db.query(Holding)
    if account_id:
        query = query.filter(Holding.account_id == account_id)
    if created_start:
        query = query.filter(Holding.created >= created_start)
    if created_end:
        query = query.filter(Holding.created <= created_end)

    # Filter out hidden accounts by default
    if not include_hidden:
        query = query.filter(Holding.account.has(models.Account.is_hidden == False))  # noqa: E712

    return query.offset(skip).limit(limit).all()


def update_holding(db: Session, id: str, data: HoldingUpdate) -> Holding | None:
    obj = get_holding(db, id)
    if not obj:
        return None
    for key, value in data.dict(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_holding(db: Session, id: str) -> bool:
    obj = get_holding(db, id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True
