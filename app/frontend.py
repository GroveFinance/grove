"""Serve the built frontend (production only)."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response
from starlette.types import Scope

# index.html and un-hashed root files must be revalidated so a new release is
# picked up immediately; Vite's hashed /assets files never change.
NO_CACHE = "no-cache"
IMMUTABLE = "public, max-age=31536000, immutable"


class ImmutableStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = IMMUTABLE
        return response


def mount_frontend(app: FastAPI, dist_dir: Path) -> None:
    dist = dist_dir.resolve()
    index = dist / "index.html"

    # StaticFiles rejects paths outside its directory.
    app.mount("/assets", ImmutableStaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> Response:
        if full_path.startswith("api/"):
            return JSONResponse({"error": "Not found"}, status_code=404)

        # Serve root-level files (logos, favicon) only if they resolve inside dist.
        candidate = (dist / full_path).resolve()
        if candidate.is_relative_to(dist) and candidate.is_file():
            return FileResponse(candidate, headers={"Cache-Control": NO_CACHE})

        # Everything else is a client-side route.
        return FileResponse(index, headers={"Cache-Control": NO_CACHE})
