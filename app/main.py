import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from alembic import command
from alembic.config import Config
from app.api import router as api_router
from app.logger import logger
from app.seed import seed_initial_categories
from app.sync.manager import init_sync_scheduler

app = FastAPI(
    title="Grove",
    description="A personal finance management tool",
    version=os.getenv("APP_VERSION", "dev"),
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    redirect_slashes=False,  # Prevent redirect interference with SPA catch-all
    logger=logger,
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

    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    # Mount static files
    app.mount("/assets", StaticFiles(directory="/app/frontend/dist/assets"), name="assets")

    # Serve index.html for all other routes (SPA routing)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            return {"error": "Not found"}

        # Check if file exists in dist directory (for root-level assets like logos)
        file_path = Path(f"/app/frontend/dist/{full_path}")
        if file_path.is_file():
            return FileResponse(file_path)

        # Default to SPA index.html
        return FileResponse("/app/frontend/dist/index.html")


@app.on_event("startup")
def startup():
    logger.info("Starting Grove")
    run_migrations()
    seed_initial_categories()
    init_sync_scheduler()
    logger.info("Grove startup complete")


def run_migrations():
    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "../alembic.ini"))
    command.upgrade(alembic_cfg, "head")
