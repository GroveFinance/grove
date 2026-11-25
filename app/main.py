import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from alembic import command
from app.api import router as api_router
from app.logger import logger
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

# Trust proxy headers for HTTPS redirects - allow all hosts
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

# CORS setup (open for local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
