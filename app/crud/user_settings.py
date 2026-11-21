from typing import Any

from sqlalchemy.orm import Session

from app.models import User, UserSetting
from app.schemas import SettingsOut
from app.settings_registry import SETTINGS_REGISTRY, validate_setting


def get_settings(db: Session, user: User) -> SettingsOut:
    rows = db.query(UserSetting).filter_by(user_id=user.id)
    stored: dict[str, Any] = {str(row.key): row.value for row in rows}
    # Ignore rows for keys no longer in the registry.
    stored = {k: v for k, v in stored.items() if k in SETTINGS_REGISTRY}
    values = {key: stored.get(key, d.default) for key, d in SETTINGS_REGISTRY.items()}
    return SettingsOut(values=values, explicit=sorted(stored))


def update_settings(db: Session, user: User, changes: dict[str, Any]) -> SettingsOut:
    """Upsert the given settings. Validates everything before writing anything.

    A null value deletes the row (reset to default) for non-nullable keys;
    for nullable keys null is stored as an explicit value.
    """
    validated = {key: validate_setting(key, value) for key, value in changes.items()}

    for key, value in validated.items():
        row = db.get(UserSetting, (user.id, key))
        if value is None and not SETTINGS_REGISTRY[key].nullable:
            if row is not None:
                db.delete(row)
        elif row is None:
            db.add(UserSetting(user_id=user.id, key=key, value=value))
        else:
            row.value = value  # type: ignore[assignment]
    db.commit()
    return get_settings(db, user)
