from sqlalchemy.orm import Session

from app.models import Payee, Transaction
from app.schemas import PayeeCreate, PayeeUpdate


def create_payee(db: Session, data: PayeeCreate) -> Payee:
    obj = Payee(**data.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_payee(db: Session, id: int) -> Payee | None:
    return db.query(Payee).filter(Payee.id == id).first()


def get_payees(db: Session) -> list[Payee]:
    return db.query(Payee).order_by(Payee.name.asc()).all()


def update_payee(db: Session, id: int, data: PayeeUpdate) -> Payee | None:
    obj = get_payee(db, id)
    if not obj:
        return None
    for key, value in data.dict(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_payee(db: Session, id: int) -> bool:
    obj = get_payee(db, id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


def apply_payees_to_transactions(db: Session, transaction_ids: list[str]) -> int:
    payees = db.query(Payee).all()
    txns = db.query(Transaction).filter(Transaction.id.in_(transaction_ids)).all()
    updated = 0

    for txn in txns:
        for payee in payees:
            if payee.keyword.lower() in (txn.description or "").lower():
                txn.category_id = payee.category_id
                updated += 1
                break  # only apply the first matching payee
    db.commit()
    return updated
