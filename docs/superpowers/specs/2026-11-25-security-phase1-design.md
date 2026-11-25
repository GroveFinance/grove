# Security Hardening Phase 1 Design

**Date:** 2026-11-25
**Status:** Approved
**Author:** Claude + User

## Why

Grove has no authentication by design (single user, private network). A security
review (2026-11-25) found that the app itself disables the browser and network
protections that make that safe: wildcard CORS with credentials lets any website
read/modify data; the sync API returns SimpleFIN credentials; the server fetches
arbitrary user-supplied URLs (SSRF); the raw-response download is guessable.
Any self-hoster must be able to run it under their own domain.

## Goals

1. No website other than Grove itself can read data or perform changes via the user's browser.
2. Each deployment declares the host names it answers to (`ALLOWED_HOSTS`).
3. SimpleFIN credentials never leave the server; clients can only supply a setup token.
4. The server only contacts SimpleFIN over https on allow-listed hosts, with timeouts and no redirects.
5. Raw-response downloads require an unguessable one-time token.
6. Dev Postgres is not exposed to the LAN.

## Non-Goals (Phase 2)

Encryption at rest, non-root containers, security headers/CSP, input size/range
limits, sync rate limiting, npm upgrades, docs-off-in-prod.

## Approaches

- **Remove CORS + Host allow-list + same-origin guard for unsafe methods (chosen).**
  The SPA and API are always same-origin (prod serves both; dev routes `/api` through
  Traefik on the same host), so CORS is unnecessary. Removing it blocks cross-origin
  reads and preflighted writes; the guard closes "simple" requests (multipart forms,
  body-less POSTs) that never preflight.
- CORS restricted to a configured origin: unnecessary complexity, still needs the guard.
- CSRF tokens: heavier, needs frontend plumbing; `Sec-Fetch-Site` is supported by all
  current browsers and costs nothing.

## Design

- `app/security.py`:
  - `parse_allowed_hosts(value: str | None) -> list[str]` — comma-separated, trimmed;
    default `localhost,127.0.0.1` when unset/empty.
  - `SameOriginGuardMiddleware`: for POST/PUT/PATCH/DELETE, reject (403) when
    `Sec-Fetch-Site` is `cross-site` or `same-site`; if the header is absent and an
    `Origin` header is present whose host is not in the allowed hosts, reject. Requests
    with neither header (curl, scripts) are allowed — they aren't browser CSRF.
  - `add_security_middleware(app, allowed_hosts)` installs TrustedHostMiddleware + the guard.
- `app/main.py`: remove CORSMiddleware; call `add_security_middleware(app, parse_allowed_hosts(os.getenv("ALLOWED_HOSTS")))`.
- Sync API:
  - `SyncConfigOut` no longer has `config`; it exposes `has_credentials: bool`.
  - `SyncConfigCreate`/`SyncConfigUpdate.config` may only contain `setup_token` (422 otherwise).
  - Claimed credentials are written to the model directly (not via the client schema).
- SimpleFIN outbound (`app/sync/simplefin.py`):
  - `validate_simplefin_url(url)` raises `ValueError` unless scheme is https and host is
    in `SIMPLEFIN_ALLOWED_HOSTS` (default `bridge.simplefin.org,beta-bridge.simplefin.org`).
  - Applied to the claim URL, the claimed access URL, and the stored endpoint before every fetch.
  - All requests: `timeout=(5, 30)`, `allow_redirects=False`.
- Raw response: `trigger-from-date?capture_raw=true` returns `download_token`; cache stores it;
  `GET /runs/{id}/raw-response?token=` must match (mismatch → 404, entry kept). Frontend passes it.
- `compose-dev.yaml`: Postgres published on `127.0.0.1` only; `ALLOWED_HOSTS` passed to the app.
- Docs: `ALLOWED_HOSTS` / `SIMPLEFIN_ALLOWED_HOSTS` in `.env.*.example`, README/CLAUDE.md; release
  notes call out that self-hosters must set `ALLOWED_HOSTS`.
