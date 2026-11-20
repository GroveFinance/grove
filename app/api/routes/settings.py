from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.crud import onboarding as onboarding_crud
from app.crud import user_settings as crud
from app.db import get_db
from app.models import User
from app.schemas import OnboardingStatus, SettingsOut
from app.settings_registry import SettingsValidationError

router = APIRouter()


@router.get("", response_model=SettingsOut, operation_id="get_settings")
def get_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return crud.get_settings(db, user)


@router.patch("", response_model=SettingsOut, operation_id="update_settings")
def update_settings(
    changes: dict[str, Any],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return crud.update_settings(db, user, changes)
    except SettingsValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.get("/onboarding", response_model=OnboardingStatus, operation_id="get_onboarding_status")
def get_onboarding_status(db: Session = Depends(get_db)):
    return onboarding_crud.get_onboarding_status(db)
