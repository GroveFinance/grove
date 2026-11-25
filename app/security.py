"""HTTP-level protections for a deployment without authentication.

Grove trusts whoever can reach it, so it must make sure *other websites* can't
use the user's browser to reach it:
- no CORS: the SPA and API are always served from the same origin;
- Host allow-list (ALLOWED_HOSTS): blocks DNS rebinding;
- same-origin guard: rejects state-changing requests initiated by other sites,
  including "simple" requests (forms, body-less POSTs) that never preflight.
"""

from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

DEFAULT_ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def parse_allowed_hosts(value: str | None) -> list[str]:
    """Parse a comma-separated ALLOWED_HOSTS value; default to local-only access."""
    hosts = [h.strip() for h in (value or "").split(",") if h.strip()]
    return hosts or list(DEFAULT_ALLOWED_HOSTS)


def _host_allowed(host: str, allowed_hosts: list[str]) -> bool:
    for pattern in allowed_hosts:
        if pattern == "*" or host == pattern:
            return True
        if pattern.startswith("*.") and host.endswith(pattern[1:]):
            return True
    return False


class SameOriginGuardMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, allowed_hosts: list[str]):
        super().__init__(app)
        self.allowed_hosts = allowed_hosts

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in UNSAFE_METHODS and self._is_cross_site(request):
            return JSONResponse({"detail": "Cross-site request blocked"}, status_code=403)
        return await call_next(request)

    def _is_cross_site(self, request: Request) -> bool:
        fetch_site = request.headers.get("sec-fetch-site")
        if fetch_site is not None:
            # "same-origin" = our own pages; "none" = user typed/bookmarked it.
            return fetch_site in ("cross-site", "same-site")
        # Older browsers: fall back to Origin. No Origin at all = non-browser client.
        origin = request.headers.get("origin")
        if not origin:
            return False
        origin_host = urlsplit(origin).hostname or ""
        return not _host_allowed(origin_host, self.allowed_hosts)


def add_security_middleware(app: FastAPI, allowed_hosts: list[str]) -> None:
    app.add_middleware(SameOriginGuardMiddleware, allowed_hosts=allowed_hosts)
    # Added last so it runs first: unknown Host headers never reach the app.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)
