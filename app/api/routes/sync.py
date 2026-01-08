from datetime import UTC

from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import schemas
from app.crud import sync_config as crud
from app.crud import sync_run as sync_run_crud
from app.db import get_db
from app.logger import logger
from app.sync import manager  # assuming this is the module where sync logic is defined

# from app.sync.manager import sync_by_provider  # assuming this dispatch function exists

router = APIRouter()


# List all sync configs
@router.get("/", response_model=list[schemas.SyncConfigOut], operation_id="list_sync_configs")
def list_sync_configs(db: Session = Depends(get_db)):
    return crud.get_sync_config(db)


# Create a new sync config
@router.post("/", response_model=schemas.SyncConfigOut, operation_id="create_sync_config")
def create_sync_config(sync_config: schemas.SyncConfigCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_sync_config(db, sync_config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating sync config: {str(e)}") from e


# Run validation, which for simplefin only takes the token and gets the username/password
@router.post("/{config_id}/validate", response_model=schemas.SyncConfigOut)
def validate_sync_config(config_id: int, db: Session = Depends(get_db)):
    config = crud.get_sync_config(db, str(config_id))
    if not config:
        raise HTTPException(status_code=404, detail="Sync config not found")

    from app.sync.manager import validate_sync_config

    try:
        return validate_sync_config(db, config)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


# Get a single sync config by ID or name
@router.get(
    "/{sync_id_or_name}",
    response_model=schemas.SyncConfigOut,
    operation_id="get_sync_config",
)
def get_sync_config(
    sync_id_or_name: str = Path(..., description="ID or name of the sync config"),
    db: Session = Depends(get_db),
):
    sync = crud.get_sync_config(db, sync_id_or_name)
    if not sync:
        raise HTTPException(status_code=404, detail="Sync config not found")
    return sync


# Update a sync config by ID or name
@router.put(
    "/{sync_id_or_name}",
    response_model=schemas.SyncConfigOut,
    operation_id="update_sync_config",
)
def update_sync_config(
    sync_id_or_name: str,
    update_data: schemas.SyncConfigUpdate,
    db: Session = Depends(get_db),
):
    sync = crud.get_sync_config(db, sync_id_or_name)
    if not sync:
        raise HTTPException(status_code=404, detail="Sync config not found")
    try:
        return crud.update_sync_config(db, sync.id, update_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error updating sync config") from e


# Trigger all syncs
@router.post("/trigger", operation_id="trigger_all_syncs")
def trigger_all_syncs(db: Session = Depends(get_db)):
    syncs = crud.get_sync_config(db)
    results = {}

    for sync in syncs:
        manager.run_sync(sync, on_schedule=False)  # manager handles threading
        logger.info(f"Triggered sync for {sync.name or sync.id}")
        results[sync.name or sync.id] = "scheduled"

    return results


# Trigger a single sync by ID or name
@router.post("/{sync_id_or_name}/trigger", operation_id="trigger_single_sync")
def trigger_single_sync(sync_id_or_name: str, db: Session = Depends(get_db)):
    sync = crud.get_sync_config(db, sync_id_or_name)
    if not sync:
        raise HTTPException(status_code=404, detail="Sync config not found")

    manager.run_sync(sync, on_schedule=False)  # manager handles threading
    logger.info(f"Triggered sync for {sync.name or sync.id}")

    return {"status": "scheduled", "sync": sync.name or sync.id}


# Trigger a manual sync from a specific date (re-sync last N days)
@router.post("/{sync_id_or_name}/trigger-from-date", operation_id="trigger_sync_from_date")
def trigger_sync_from_date(
    sync_id_or_name: str,
    days_back: int = 30,
    capture_raw: bool = False,
    db: Session = Depends(get_db),
):
    """
    Trigger a manual sync starting from N days ago.

    Args:
        sync_id_or_name: ID or name of the sync config
        days_back: Number of days to sync back from today (default: 30)
        capture_raw: If True, capture raw API response for download (default: False)
    """
    from datetime import datetime, timedelta

    sync = crud.get_sync_config(db, sync_id_or_name)
    if not sync:
        raise HTTPException(status_code=404, detail="Sync config not found")

    if days_back < 1:
        raise HTTPException(status_code=400, detail="days_back must be at least 1")

    from_date = datetime.now(UTC) - timedelta(days=days_back)

    manager.run_sync(sync, on_schedule=False, from_date=from_date, capture_raw=capture_raw)
    logger.info(
        f"Triggered sync for {sync.name or sync.id} from {from_date.date()} "
        f"({days_back} days back, capture_raw={capture_raw})"
    )

    return {
        "status": "scheduled",
        "sync": sync.name or sync.id,
        "from_date": from_date.isoformat(),
        "days_back": days_back,
        "capture_raw": capture_raw,
    }


# Get sync runs for a config
@router.get(
    "/{sync_id_or_name}/runs",
    response_model=list[schemas.SyncRunOut],
    operation_id="get_sync_runs",
)
def get_sync_runs(sync_id_or_name: str, limit: int = 10, db: Session = Depends(get_db)):
    sync = crud.get_sync_config(db, sync_id_or_name)
    if not sync:
        raise HTTPException(status_code=404, detail="Sync config not found")

    return sync_run_crud.get_sync_runs(db, sync.id, limit)


# Get a specific sync run by ID
@router.get("/runs/{run_id}", response_model=schemas.SyncRunOut, operation_id="get_sync_run")
def get_sync_run(run_id: int, db: Session = Depends(get_db)):
    run = sync_run_crud.get_sync_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Sync run not found")
    return run


# Get the latest sync run for a config
@router.get(
    "/{sync_id_or_name}/runs/latest",
    response_model=schemas.SyncRunOut,
    operation_id="get_latest_sync_run",
)
def get_latest_sync_run(sync_id_or_name: str, db: Session = Depends(get_db)):
    sync = crud.get_sync_config(db, sync_id_or_name)
    if not sync:
        raise HTTPException(status_code=404, detail="Sync config not found")

    run = sync_run_crud.get_latest_sync_run(db, sync.id)
    if not run:
        raise HTTPException(status_code=404, detail="No sync runs found")

    return run


# Download raw SimpleFin API response for a sync run
@router.get(
    "/runs/{run_id}/raw-response",
    operation_id="download_raw_response",
    responses={
        200: {
            "content": {"application/json": {}},
            "description": "Raw SimpleFin API response",
        },
        404: {"description": "Raw response not found or expired"},
    },
)
def download_raw_response(run_id: int, db: Session = Depends(get_db)):
    """
    Download the raw SimpleFin API response for a sync run.

    The raw response is only available if:
    1. The sync was triggered with capture_raw=true
    2. Less than 5 minutes have passed since sync completion
    3. The response hasn't been downloaded yet (one-time download)
    """
    # Verify sync run exists
    run = sync_run_crud.get_sync_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Sync run not found")

    # Retrieve from cache (this also removes it)
    raw_json = manager.get_raw_response(run_id)
    if not raw_json:
        raise HTTPException(
            status_code=404,
            detail="Raw response not available (may have expired or already been downloaded)",
        )

    # Generate filename with timestamp
    filename = f"simplefin_raw_{run.started_at.strftime('%Y%m%d_%H%M%S')}.json"

    logger.info(f"Downloaded raw response for sync_run {run_id} ({len(raw_json)} bytes)")

    return Response(
        content=raw_json,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
