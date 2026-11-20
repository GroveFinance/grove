from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models import Payee, SyncConfig
from app.schemas import OnboardingStatus


def get_onboarding_status(db: Session) -> OnboardingStatus:
    has_synced = db.scalar(select(exists().where(SyncConfig.last_sync.is_not(None))))
    has_rules = db.scalar(select(exists().where(Payee.category_id != 0)))
    return OnboardingStatus(has_synced=bool(has_synced), has_rules=bool(has_rules))
