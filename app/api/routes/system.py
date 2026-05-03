import os

from fastapi import APIRouter

from app import schemas
from app.utils.version_checker import get_version_info

router = APIRouter()


@router.get("/info", response_model=schemas.SystemInfo, operation_id="get_system_info")
def get_system_info():
    """
    Get system information including version and environment.
    Checks GitHub Releases API for latest version (cached for 6 hours).
    """
    version_info = get_version_info()

    return schemas.SystemInfo(
        version=schemas.VersionInfo(**version_info),
        environment=os.getenv("ENV", "development"),
    )
