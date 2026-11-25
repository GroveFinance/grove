# Security Hardening Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close cross-origin access, credential exposure, SSRF and guessable raw downloads.
**Spec:** `docs/superpowers/specs/2026-11-25-security-phase1-design.md`
**Tests:** `docker run --rm -v /data/compose/grove-dev:/app -w /app grove-dev-app sh -c 'python -m pytest -q -p no:warnings tests'`

## Review Focus
1. The SPA's own requests (same-origin, `Sec-Fetch-Site: same-origin`) must keep working, including multipart imports.
2. Existing stored SimpleFIN credentials (beta-bridge host) must keep syncing.
3. Token refresh flow (PUT with new `setup_token`) still re-claims credentials.
4. The dev site through Traefik keeps working once `ALLOWED_HOSTS` is set.

### Task 1: Security middleware + remove CORS
`app/security.py`, `app/main.py`; tests `tests/test_security_middleware.py`
- [ ] RED: hosts parsing/default; unknown Host → 400; cross-site/same-site POST → 403; same-origin POST ok; no-header POST ok; Origin not allowed (no Sec-Fetch-Site) → 403; GET cross-site ok (no CORS headers on app.main)
- [ ] GREEN; commit

### Task 2: Sync config never exposes credentials
`app/schemas.py`, `app/sync/simplefin.py` (get_credentials), `app/crud/sync_config.py`; tests `tests/test_sync_config_api.py`
- [ ] RED: GET /api/sync has no `config`, has `has_credentials`; create/update with `endpoint`/`username`/`password` → 422; update with `setup_token` ok
- [ ] GREEN; commit

### Task 3: SimpleFIN URL allow-list + timeouts
`app/sync/simplefin.py`; tests `tests/test_simplefin_urls.py`
- [ ] RED: http / other host / IP rejected; allowed hosts accepted; env override
- [ ] GREEN (apply to claim, access URL, every fetch; timeout + no redirects); commit

### Task 4: Raw-response one-time token
`app/sync/manager.py`, `app/sync/simplefin.py`, `app/api/routes/sync.py`, frontend sync download; tests `tests/test_raw_response_token.py`
- [ ] RED: wrong/missing token → 404 and kept; right token → data then gone
- [ ] GREEN; frontend passes token; commit

### Task 5: Config + docs
`compose-dev.yaml`, `.env.*.example`, `CLAUDE.md`, README; local `.env` gets `ALLOWED_HOSTS`
- [ ] Dev site works via Traefik; Postgres bound to 127.0.0.1; commit
