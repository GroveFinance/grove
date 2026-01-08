from sqlalchemy.orm import Session

from app.logger import logger
from app.models import SyncConfig
from app.schemas import SyncConfigCreate, SyncConfigUpdate
from app.sync import simplefin
from app.sync.manager import validate_sync_config


def get_sync_config(db: Session, name: str | None = None):
    query = db.query(SyncConfig)
    result = query.filter(SyncConfig.name == name).first() if name else query.all()
    return result


def create_sync_config(db: Session, schema: SyncConfigCreate):
    sync = SyncConfig(
        name=schema.name,
        provider_name=schema.provider_name,
        config=schema.config or {},
        active=schema.active,
    )

    db.add(sync)
    db.commit()
    db.refresh(sync)

    # failure will bubble to provide http error
    validate_sync_config(db, sync)
    logger.info(f"Created sync config: {sync.name} with provider {sync.provider_name}")

    return sync


def validate_and_update_sync_config(db: Session, config: SyncConfig) -> SyncConfig | None:
    if config.provider_name == "simplefin":
        return simplefin.get_credentials(db, config)
    raise ValueError(f"Unsupported provider {config.provider_name}")


def delete_sync_config(db: Session, name: str):
    config = db.query(SyncConfig).filter(SyncConfig.name == name).first()
    if config:
        db.delete(config)
        db.commit()
    return config


def update_sync_config(db: Session, config_id: int, updates: SyncConfigUpdate) -> SyncConfig | None:
    sync_config = db.query(SyncConfig).filter(SyncConfig.id == config_id).first()
    if not sync_config:
        return None

    update_data = updates.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(sync_config, key, value)
    db.commit()
    db.refresh(sync_config)
    logger.info(f"Updated sync config: {sync_config.name}")
    return sync_config
