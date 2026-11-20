from fastapi import Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User

DEFAULT_USERNAME = "default"


def get_current_user(db: Session = Depends(get_db)) -> User:
    """Resolve the current user.

    There is no authentication yet, so this always returns the default user
    (creating it if missing). When auth is added, only this function changes.
    """
    user = db.query(User).filter_by(username=DEFAULT_USERNAME).first()
    if user is None:
        user = User(username=DEFAULT_USERNAME)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
