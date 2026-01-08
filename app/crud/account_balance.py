from sqlalchemy.orm import Session

from app.models import AccountBalance
from app.schemas import AccountBalanceCreate, AccountBalanceUpdate


def create_account_balance(db: Session, data: AccountBalanceCreate):
    balance = AccountBalance(**data.dict())
    db.add(balance)
    db.commit()
    db.refresh(balance)
    return balance


def get_account_balances(db: Session, account_id=None, start_date=None, end_date=None):
    query = db.query(AccountBalance)
    if account_id:
        query = query.filter(AccountBalance.account_id == account_id)
    if start_date:
        query = query.filter(AccountBalance.balance_date >= start_date)
    if end_date:
        query = query.filter(AccountBalance.balance_date <= end_date)
    return query.order_by(AccountBalance.balance_date.desc()).all()


def get_account_balance_by_id(db: Session, id: int):
    return db.query(AccountBalance).filter(AccountBalance.id == id).first()


def get_account_balance_by_account_id(db: Session, account_id: int):
    return (
        db.query(AccountBalance)
        .filter(AccountBalance.account_id == account_id)
        .order_by(AccountBalance.balance_date.desc())
        .first()
    )


def update_account_balance(db: Session, id: int, data: AccountBalanceUpdate):
    bal = get_account_balance_by_id(db, id)
    if not bal:
        return None
    for key, value in data.dict(exclude_unset=True).items():
        setattr(bal, key, value)
    db.commit()
    db.refresh(bal)
    return bal


def delete_account_balance(db: Session, id: int):
    bal = get_account_balance_by_id(db, id)
    if not bal:
        return None
    db.delete(bal)
    db.commit()
    return bal
