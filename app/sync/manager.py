import threading
from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.crud import sync_config
from app.db import SessionLocal
from app.logger import logger
from app.sync.simplefin import get_credentials as validate_simplefin
from app.sync.simplefin import run as run_simplefin

scheduler = BackgroundScheduler()
scheduler.start()

# In-memory cache for raw SimpleFin API responses
# Structure: {sync_run_id: {"data": str, "timestamp": datetime}}
_raw_response_cache: dict[int, dict] = {}
_cache_lock = threading.Lock()
_cache_expiry_minutes = 5


def store_raw_response(sync_run_id: int, raw_json: str):
    """Store raw API response temporarily for download."""
    with _cache_lock:
        _raw_response_cache[sync_run_id] = {
            "data": raw_json,
            "timestamp": datetime.now(UTC),
        }
        # Cleanup expired entries
        _cleanup_expired_cache()
        logger.info(f"Stored raw response for sync_run {sync_run_id} ({len(raw_json)} bytes)")


def get_raw_response(sync_run_id: int) -> str | None:
    """Retrieve and remove raw API response from cache."""
    with _cache_lock:
        entry = _raw_response_cache.pop(sync_run_id, None)
        if entry:
            logger.info(f"Retrieved and cleared raw response for sync_run {sync_run_id}")
        return entry["data"] if entry else None


def _cleanup_expired_cache():
    """Remove cache entries older than expiry time. Must be called with lock held."""
    cutoff = datetime.now(UTC) - timedelta(minutes=_cache_expiry_minutes)
    expired = [
        run_id for run_id, entry in _raw_response_cache.items() if entry["timestamp"] < cutoff
    ]
    for run_id in expired:
        del _raw_response_cache[run_id]
        logger.debug(f"Expired raw response cache for sync_run {run_id}")


def init_sync_scheduler():
    db = SessionLocal()
    try:
        logger.info("Initializing sync scheduler")
        configs = sync_config.get_sync_config(db)
        for config in configs:
            if config.active:
                run_sync(config, on_schedule=True)
    finally:
        db.close()


def _build_job(config, from_date=None, capture_raw=False):
    def job():
        db = SessionLocal()
        try:
            logger.info(f"Running sync for {config.name} (provider {config.provider_name})")
            if not config.active:
                logger.warning(f"Sync {config.name} inactive, skipping")
                return

            # Create SyncRun record
            from datetime import datetime

            from app.models import SyncRun

            sync_run = SyncRun(
                sync_config_id=config.id, status="running", started_at=datetime.now(UTC)
            )
            db.add(sync_run)
            db.commit()
            db.refresh(sync_run)

            if config.provider_name == "simplefin":
                run_simplefin(
                    db,
                    config,
                    sync_run_id=sync_run.id,
                    from_date=from_date,
                    capture_raw=capture_raw,
                )
            else:
                raise ValueError(f"Unsupported provider {config.provider_name}")

        except Exception as e:
            logger.exception(f"Sync failed for {config.name}: {e}")
        finally:
            db.close()

    return job


def run_sync(config, on_schedule: bool = False, from_date=None, capture_raw: bool = False):
    """
    Run or schedule a sync job.
    - If on_schedule=True and config.schedule is set → schedule recurring job
    - Else → run once immediately
    - from_date: Optional datetime to sync from (for manual re-syncs)
    - capture_raw: If True, capture raw API response for download
    """
    job_id = f"sync:{config.id}"
    job = _build_job(config, from_date=from_date, capture_raw=capture_raw)

    if on_schedule and config.schedule:
        scheduler.add_job(
            job,
            CronTrigger.from_crontab(config.schedule),
            id=job_id,
            replace_existing=True,
        )
        logger.info(f"Scheduled recurring sync for {config.name} with schedule {config.schedule}")
    else:
        scheduler.add_job(
            job,
            id=f"{job_id}:once",
            replace_existing=True,
            next_run_time=datetime.now(),  # fire immediately
        )
        logger.info(f"Scheduled one-off sync for {config.name}")


def validate_sync_config(db: Session, config: sync_config.SyncConfig):
    if config.provider_name == "simplefin":
        return validate_simplefin(db, config)
    else:
        raise ValueError(f"Unsupported provider {config.provider_name}")
