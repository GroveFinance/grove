from sqlalchemy.orm import Session

from app.models import Org
from app.schemas import OrgCreate, OrgUpdate


def create_org(db: Session, data: OrgCreate) -> Org:
    org = Org(**data.dict())
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def get_orgs(db: Session):
    return db.query(Org).all()


def get_org_by_id(db: Session, id: str):
    return db.query(Org).filter(Org.id == id).first()


def update_org(db: Session, id: str, data: OrgUpdate):
    org = get_org_by_id(db, id)
    if not org:
        return None
    for key, value in data.dict(exclude_unset=True).items():
        setattr(org, key, value)
    db.commit()
    db.refresh(org)
    return org


def delete_org(db: Session, id: str):
    org = get_org_by_id(db, id)
    if not org:
        return None
    db.delete(org)
    db.commit()
    return org
