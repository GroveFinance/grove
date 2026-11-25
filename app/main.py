import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from alembic.config import Config
from fastapi import FastAPI

from alembic import command
from app.api import router as api_router
from app.logger import logger
from app.security import add_security_middleware, parse_allowed_hosts
from app.seed import seed_initial_categories
from app.sync.manager import init_sync_scheduler


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logger.info("Starting Grove")
    run_migrations()
    seed_initial_categories()
    init_sync_scheduler()
    logger.info("Grove startup complete")
    yield


app = FastAPI(
    title="Grove",
    description="A personal finance management tool",
    version=os.getenv("APP_VERSION", "dev"),
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    redirect_slashes=False,  # Prevent redirect interference with SPA catch-all
    lifespan=lifespan,
)

# No CORS: the SPA and API are same-origin. Host allow-list + cross-site guard
# protect a deployment that has no authentication (see app/security.py).
add_security_middleware(app, parse_allowed_hosts(os.getenv("ALLOWED_HOSTS")))

# Include API routes
app.include_router(api_router)

# Serve static frontend files in production
if os.getenv("ENV") == "production":
    from pathlib import Path

    from app.frontend import mount_frontend

    mount_frontend(app, Path("/app/frontend/dist"))


def run_migrations():
    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "../alembic.ini"))
    command.upgrade(alembic_cfg, "head")
