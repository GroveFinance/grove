# Stale Holdings Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remove superseded holdings during sync and add a per-account "Reset holdings" action.
**Architecture:** Sync treats the feed's holdings list as authoritative for accounts present in the feed (empty list = keep + warn). New account endpoint + `holdings_count` on account details drive a button on the Accounts page.
**Tech Stack:** FastAPI, SQLAlchemy 2.1, pytest (SQLite); React/TanStack Query.
**Spec:** `docs/superpowers/specs/2026-11-20-stale-holdings-design.md`

## Global Constraints
- Never delete holdings for accounts absent from the feed; empty feed list keeps holdings and logs a warning.
- Holdings that fail validation are not deleted (their id still counts as present).
- Backend tests: `docker run --rm -v /data/compose/grove-dev:/app -w /app grove-dev-app sh -c 'python -m pytest -q -p no:warnings tests'`

## Review Focus
1. Feed with an invalid holding for an existing id → that holding is kept (not deleted as "missing").
2. Holdings of a *different* account are never deleted by another account's sync or reset.
3. Reset on an account with zero holdings → `{"deleted": 0}`, not an error.

### Task 1: Sync removes superseded holdings
**Files:** Modify `app/sync/simplefin.py` (`process_holdings`); Test `tests/test_simplefin_holdings.py`
- [ ] Tests (RED): `test_holding_missing_from_feed_is_removed`, `test_other_accounts_holdings_untouched`, `test_empty_feed_keeps_existing_holdings`, `test_invalid_holding_is_not_removed`
- [ ] Implement; tests GREEN; commit `fix: remove holdings superseded in the SimpleFIN feed`

### Task 2: Reset holdings endpoint + holdings_count
**Files:** Modify `app/crud/holding.py` (`delete_holdings_for_account(db, account_id) -> int`), `app/api/routes/account.py`, `app/schemas.py` (`AccountDetailsOut.holdings_count: int = 0`), `app/crud/account.py` (`get_account_details`); Test `tests/test_reset_holdings.py`
- [ ] Tests (RED): reset deletes only that account's holdings and returns count; zero holdings → 0; unknown account → 404; account details include `holdings_count`
- [ ] Implement; GREEN; commit `feat: add reset-holdings endpoint and holdings_count`

### Task 3: Accounts page button
**Files:** `frontend/src/services/api/accounts.ts` (`resetAccountHoldings(id)`), `frontend/src/services/api/index.ts` (+mock), `frontend/src/types` (`holdings_count`), `frontend/src/pages/settings/AccountsPage.tsx`
- [ ] Button + confirm dialog; build + lint; browser check; commit `feat: reset holdings button on accounts page`
