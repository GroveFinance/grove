from sqlalchemy.orm import Session

from app.models import SyncRun
from app.schemas import SyncRunCreate, SyncRunUpdate


def create_sync_run(db: Session, sync_run: SyncRunCreate) -> SyncRun:
    """Create a new sync run record"""
    db_sync_run = SyncRun(**sync_run.model_dump())
    db.add(db_sync_run)
    db.commit()
    db.refresh(db_sync_run)
    return db_sync_run


def update_sync_run(db: Session, run_id: int, update_data: SyncRunUpdate) -> SyncRun | None:
    """Update a sync run record"""
    db_sync_run = db.query(SyncRun).get(run_id)
    if not db_sync_run:
        return None

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(db_sync_run, key, value)

    db.commit()
    db.refresh(db_sync_run)
    return db_sync_run


def get_sync_runs(db: Session, sync_config_id: int, limit: int = 10) -> list[SyncRun]:
    """Get sync runs for a specific sync config"""
    return (
        db.query(SyncRun)
        .filter(SyncRun.sync_config_id == sync_config_id)
        .order_by(SyncRun.started_at.desc())
        .limit(limit)
        .all()
    )


def get_sync_run(db: Session, run_id: int) -> SyncRun | None:
    """Get a specific sync run by ID"""
    return db.query(SyncRun).get(run_id)


def get_latest_sync_run(db: Session, sync_config_id: int) -> SyncRun | None:
    """Get the most recent sync run for a config"""
    return (
        db.query(SyncRun)
        .filter(SyncRun.sync_config_id == sync_config_id)
        .order_by(SyncRun.started_at.desc())
        .first()
    )
