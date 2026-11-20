# Server-Side User Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store all browser-only preferences in the database per user (seeded default user), and make Getting Started server-backed with no polling.

**Architecture:** New `users` + `user_settings` tables (one row per key, JSON value) behind a backend registry of allowed keys/types/defaults. `GET`/`PATCH /api/settings` resolve the user through `get_current_user` (always the default user for now). The frontend reads settings via one TanStack Query (`["settings"]`), with a one-time push of legacy localStorage values.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, pytest (SQLite in-memory); React 19, TypeScript, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-11-20-server-side-settings-design.md`

## Global Constraints

- Allowed setting keys, types, defaults (exact):
  - `theme.mode`: `"dark" | "light" | "system"`, default `"dark"`
  - `theme.name`: `"grove" | "ocean" | "sunset" | "forest" | "slate"`, default `"grove"`
  - `onboarding.dismissed`: bool, default `false`
  - `onboarding.visited.accounts`: bool, default `false`
  - `onboarding.visited.categories`: bool, default `false`
  - `updates.dismissed_version`: string | null, default `null` (nullable)
- Default user `username = 'default'`; `get_current_user` creates it if missing.
- Unknown key or wrong type → HTTP 422, and nothing in that PATCH is written.
- `null` deletes the row for non-nullable keys; for nullable keys it is stored as an explicit value.
- Upserts must be portable (no Postgres-only `ON CONFLICT`).
- No `setInterval` polling for onboarding.
- Mock mode (`VITE_API_MODE=mock|demo`) must keep working without a backend.
- CSS vars: use `var(--x)`, never `hsl(var(--x))` (project rule).

**Backend test command** (app image has no pytest/httpx installed; this does not touch running containers):
```bash
docker run --rm -v "$PWD":/app -w /app grove-dev-app sh -c 'pip install -q pytest httpx >/dev/null 2>&1; python -m pytest -q -p no:warnings tests'
```
**Frontend checks:** `cd frontend && npm run build && npm run lint`
**Pre-commit:** `pre-commit run --files <changed files>`

## Review Focus

1. A legacy localStorage theme value is not in `explicit` yet → the theme must **not** flip to the server default (`dark`) before the migration PATCH lands. (Task 4: ThemeProvider applies server values only for keys in `explicit`.)
2. A bool sent as a string (`"true"`) or a theme name that no longer exists → 422, not silently coerced or stored. (Task 1: strict types test.)
3. PATCH with one valid and one invalid key → nothing written. (Task 1 test.)
4. Two devices each change a different key → neither overwrites the other. (Task 1 test.)
5. Getting Started dismissed on another device → this device must not briefly show it while settings load. (Task 5: render nothing while loading.)

---

### Task 1: Data layer — models, migration, registry, CRUD, current user

**Files:**
- Modify: `app/models.py` (add `User`, `UserSetting` after `Meta`)
- Create: `alembic/versions/a1b2c3d4e5f6_add_users_and_user_settings.py` (revises `f64746021b4e`; generate id with `alembic revision -m ...` or pick a random 12-hex id)
- Create: `app/settings_registry.py`
- Create: `app/crud/user_settings.py`
- Create: `app/api/deps.py`
- Modify: `app/schemas.py` (add `SettingsOut`)
- Modify: `requirements.txt` (add `httpx`, needed by FastAPI TestClient in Task 2)
- Modify: `tests/conftest.py` (create **all** tables: `models.Base.metadata.create_all(engine)` — verified to work on SQLite)
- Test: `tests/test_user_settings.py`

**Interfaces:**
- Produces:
  - `models.User`: `id: int PK`, `username: str unique not null`, `created_at: timestamptz not null server_default now()`
  - `models.UserSetting` (`__tablename__ = "user_settings"`): `user_id: int FK users.id ondelete CASCADE`, `key: str`, `value: JSON not null`, `updated_at: timestamptz not null server_default now(), onupdate now()`; composite PK `(user_id, key)`
  - `app/settings_registry.py`: `SETTINGS_REGISTRY: dict[str, SettingDef]`; `SettingDef` dataclass `(adapter: TypeAdapter, default: Any, nullable: bool)`; `class SettingsValidationError(ValueError)`; `validate_setting(key: str, value: Any) -> Any` (raises on unknown key / bad value). Use `Literal[...]` for enums, `StrictBool` for bools, `StrictStr | None` for the version.
  - `app/crud/user_settings.py`: `get_settings(db, user: User) -> SettingsOut`; `update_settings(db, user: User, changes: dict[str, Any]) -> SettingsOut` (validates every key first, then upserts/deletes, single commit)
  - `app/schemas.py`: `SettingsOut(BaseModel)`: `values: dict[str, Any]` (every registry key), `explicit: list[str]` (keys stored in DB, sorted)
  - `app/api/deps.py`: `get_current_user(db: Session = Depends(get_db)) -> models.User` — returns user `default`, creating and committing it if missing; also expose `DEFAULT_USERNAME = "default"`
- Migration: create both tables, then `op.execute("INSERT INTO users (username) VALUES ('default')")`. Downgrade drops `user_settings` then `users`.

- [ ] **Step 1: Write failing tests** in `tests/test_user_settings.py` (fixture `user` = `get_current_user(db)`):

```python
def test_defaults_when_nothing_stored(db, user):
    out = get_settings(db, user)
    assert out.values == {
        "theme.mode": "dark", "theme.name": "grove",
        "onboarding.dismissed": False,
        "onboarding.visited.accounts": False,
        "onboarding.visited.categories": False,
        "updates.dismissed_version": None,
    }
    assert out.explicit == []

def test_update_is_persisted_and_marked_explicit(db, user):
    update_settings(db, user, {"theme.mode": "light"})
    out = get_settings(db, user)
    assert out.values["theme.mode"] == "light"
    assert out.explicit == ["theme.mode"]

def test_updating_one_key_leaves_others(db, user):
    update_settings(db, user, {"theme.mode": "light"})
    update_settings(db, user, {"onboarding.dismissed": True})
    out = get_settings(db, user)
    assert out.values["theme.mode"] == "light"
    assert out.values["onboarding.dismissed"] is True

@pytest.mark.parametrize("changes", [
    {"nope": 1},
    {"theme.name": "neon"},
    {"onboarding.dismissed": "true"},
    {"updates.dismissed_version": 5},
])
def test_invalid_changes_rejected(db, user, changes):
    with pytest.raises(SettingsValidationError):
        update_settings(db, user, changes)

def test_invalid_change_writes_nothing(db, user):
    with pytest.raises(SettingsValidationError):
        update_settings(db, user, {"theme.mode": "light", "theme.name": "neon"})
    assert get_settings(db, user).explicit == []

def test_null_resets_non_nullable_key(db, user):
    update_settings(db, user, {"theme.mode": "light"})
    update_settings(db, user, {"theme.mode": None})
    out = get_settings(db, user)
    assert out.values["theme.mode"] == "dark"
    assert "theme.mode" not in out.explicit

def test_null_is_stored_for_nullable_key(db, user):
    update_settings(db, user, {"updates.dismissed_version": "v1.2.0"})
    update_settings(db, user, {"updates.dismissed_version": None})
    out = get_settings(db, user)
    assert out.values["updates.dismissed_version"] is None
    assert "updates.dismissed_version" in out.explicit

def test_current_user_created_once(db):
    assert get_current_user(db).id == get_current_user(db).id
    assert db.query(User).count() == 1
```

- [ ] **Step 2: Run tests — expect FAIL** (ImportError: `app.crud.user_settings` / `app.api.deps` missing).
- [ ] **Step 3: Implement** models, registry, schema, CRUD, deps, migration, conftest change, `httpx` in requirements. Do **not** add `user_settings` to `app/crud/__init__.py` star-imports (avoids name collisions; import the module directly).
- [ ] **Step 4: Run tests — expect PASS** (all, including `tests/test_simplefin_holdings.py`).
- [ ] **Step 5: Apply migration in dev and confirm:**
  `docker compose exec app alembic upgrade head` then
  `docker compose exec db psql -U dev -d budget -c "select id, username from users;"` → one row, `default`.
  (The app also runs migrations on startup/reload.)
- [ ] **Step 6: pre-commit, then commit** `feat: add users and per-user settings data layer`

---

### Task 2: Settings API and onboarding status

**Files:**
- Create: `app/api/routes/settings.py` (auto-mounted at `/api/settings`)
- Create: `app/crud/onboarding.py`
- Modify: `app/schemas.py` (add `OnboardingStatus`)
- Test: `tests/test_settings_api.py`

**Interfaces:**
- Consumes: Task 1 `get_current_user`, `get_settings`, `update_settings`, `SettingsValidationError`, `SettingsOut`.
- Produces:
  - `GET /api/settings` → `SettingsOut`, `operation_id="get_settings"`
  - `PATCH /api/settings` body `dict[str, Any]` → `SettingsOut`, `operation_id="update_settings"`; `SettingsValidationError` → `HTTPException(422, detail=str(e))`
  - `GET /api/settings/onboarding` → `OnboardingStatus`, `operation_id="get_onboarding_status"`
  - `schemas.OnboardingStatus`: `has_synced: bool`, `has_rules: bool`
  - `crud/onboarding.py`: `get_onboarding_status(db) -> OnboardingStatus` using `EXISTS` queries: any `SyncConfig.last_sync IS NOT NULL`; any `Payee.category_id != 0`.

- [ ] **Step 1: Write failing tests.** Build a test app in the test module (do not import `app.main`, which runs migrations on startup):

```python
@pytest.fixture
def client(db):
    api = FastAPI()
    api.include_router(settings_routes.router, prefix="/api/settings")
    api.dependency_overrides[get_db] = lambda: db
    return TestClient(api)

def test_get_returns_defaults(client):
    body = client.get("/api/settings").json()
    assert body["values"]["theme.mode"] == "dark"
    assert body["explicit"] == []

def test_patch_then_get(client):
    r = client.patch("/api/settings", json={"theme.name": "ocean"})
    assert r.status_code == 200
    assert client.get("/api/settings").json()["values"]["theme.name"] == "ocean"

def test_patch_invalid_is_422(client):
    assert client.patch("/api/settings", json={"theme.name": "neon"}).status_code == 422
    assert client.patch("/api/settings", json={"bogus": True}).status_code == 422

def test_onboarding_empty_db(client):
    assert client.get("/api/settings/onboarding").json() == {"has_synced": False, "has_rules": False}

def test_onboarding_reflects_sync_and_rules(client, db):
    # seed: Group + Category id=0 ("Uncategorized") and id=5; SyncConfig with last_sync set; Payee category_id=5
    ...
    assert client.get("/api/settings/onboarding").json() == {"has_synced": True, "has_rules": True}

def test_payee_without_category_is_not_a_rule(client, db):
    # seed a Payee with category_id=0 only
    assert client.get("/api/settings/onboarding").json()["has_rules"] is False
```

- [ ] **Step 2: Run tests — expect FAIL** (module `app.api.routes.settings` missing).
- [ ] **Step 3: Implement** routes, onboarding CRUD, schema.
- [ ] **Step 4: Run tests — expect PASS.**
- [ ] **Step 5: Live check:** `curl -s localhost:8000/api/settings` returns all six keys; `curl -s localhost:8000/api/settings/onboarding` returns `{"has_synced":true,"has_rules":true}` on the dev data.
- [ ] **Step 6: pre-commit, commit** `feat: add settings and onboarding status API`

---

### Task 3: Frontend settings client, hooks, mock, legacy migration

**Files:**
- Create: `frontend/src/types/settings.ts` (re-export from `frontend/src/types/index.ts`)
- Create: `frontend/src/services/api/settings.ts`
- Modify: `frontend/src/services/api/index.ts` (export real/mock switch for the three functions)
- Modify: `frontend/src/services/api/mock/index.ts` (in-memory mock implementations seeded with defaults)
- Create: `frontend/src/hooks/queries/useSettings.ts`
- Create: `frontend/src/hooks/useLegacySettingsMigration.ts`
- Modify: `frontend/src/App.tsx` (call `useLegacySettingsMigration()` once; place it in a small component rendered inside `ThemeProvider`, or in `AppWrapper`)

**Interfaces:**
- Produces (types):
  ```ts
  export type ThemeMode = "dark" | "light" | "system";
  export type ThemeName = "grove" | "ocean" | "sunset" | "forest" | "slate";
  export interface SettingsValues {
    "theme.mode": ThemeMode;
    "theme.name": ThemeName;
    "onboarding.dismissed": boolean;
    "onboarding.visited.accounts": boolean;
    "onboarding.visited.categories": boolean;
    "updates.dismissed_version": string | null;
  }
  export type SettingKey = keyof SettingsValues;
  export interface SettingsResponse { values: SettingsValues; explicit: SettingKey[] }
  export interface OnboardingStatus { has_synced: boolean; has_rules: boolean }
  ```
- Produces (API): `getSettings(): Promise<SettingsResponse>`, `updateSettings(changes: Partial<SettingsValues>): Promise<SettingsResponse>` (PATCH, JSON body), `getOnboardingStatus(): Promise<OnboardingStatus>` — all via `fetchJSON`.
- Produces (hooks):
  - `useSettings()` → TanStack `useQuery<SettingsResponse>` with key `SETTINGS_QUERY_KEY = ["settings"]`.
  - `useUpdateSettings()` → `useMutation` taking `Partial<SettingsValues>`; `onMutate` optimistically merges into cached `values` and adds keys to `explicit` (snapshot for rollback), `onError` restores the snapshot, `onSuccess` sets cache to the server response.
  - `useLegacySettingsMigration(): void`.
- Legacy mapping (validate each against the allowed values; skip invalid/missing):

  | localStorage key | setting | conversion |
  |---|---|---|
  | `vite-ui-theme-mode` | `theme.mode` | as-is if valid |
  | `vite-ui-theme-name` | `theme.name` | as-is if valid |
  | `grove_onboarding_dismissed` | `onboarding.dismissed` | `"true"` → `true` |
  | `grove_accounts_visited` | `onboarding.visited.accounts` | `"true"` → `true` |
  | `grove_categories_visited` | `onboarding.visited.categories` | `"true"` → `true` |
  | `grove_dismissed_update` | `updates.dismissed_version` | non-empty string |

  Behavior: runs once settings have loaded and `localStorage.grove_settings_migrated` is absent. Include only keys **not** in `explicit`. If the patch is non-empty, send it with `useUpdateSettings`; on success (or if empty) remove the four `grove_*` legacy keys and set `grove_settings_migrated = "1"`. On failure, leave everything for the next load. Never remove `vite-ui-theme-*` (still the theme cache). Use a `useRef` guard so StrictMode double-effects don't send twice.

- [ ] **Step 1: Implement types, API, mock, hooks, migration hook; wire into `App.tsx`.** (No frontend test runner exists; verification is build/lint plus live checks.)
- [ ] **Step 2: `cd frontend && npm run build && npm run lint`** → both succeed with no new errors.
- [ ] **Step 3: Live check in the dev browser** (https://grove-dev.jrich.cyou or Playwright): after load, `GET /api/settings` shows `explicit` containing every legacy key that was set in that browser; `localStorage.grove_settings_migrated === "1"`; `grove_onboarding_dismissed`/`grove_*_visited`/`grove_dismissed_update` are gone.
- [ ] **Step 4: pre-commit, commit** `feat: add frontend settings client with legacy migration`

---

### Task 4: Theme backed by settings

**Files:**
- Modify: `frontend/src/components/theme-provider.tsx`
- Modify: `frontend/src/App.tsx` only if the `ThemeProvider` props change (keep `defaultMode`/`defaultTheme`/`storageKey`)

**Interfaces:**
- Consumes: `useSettings`, `useUpdateSettings`, `ThemeMode`, `ThemeName` (Task 3). Replace the local `Mode`/`ThemeName` types with the shared ones.
- Context shape stays the same (`mode`, `themeName`, `theme`, `setMode`, `setThemeName`, `setTheme`) so `mode-toggle.tsx` and others are untouched.

Behavior:
- Initial state from localStorage cache (unchanged) → no flash.
- When settings data arrives, for `theme.mode` / `theme.name`: **only if the key is in `explicit`** and differs from local state, set state and write the cache. (Keys not in `explicit` keep the local value until the Task 3 migration makes them explicit — see Review Focus #1.)
- `setMode` / `setThemeName` / `setTheme`: update state, write the cache, call `updateSettings({"theme.mode": ...})` / `({"theme.name": ...})`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `npm run build && npm run lint`** pass.
- [ ] **Step 3: Live check:** change the theme in browser A; in browser B (or a private window with empty localStorage), load the app → it shows browser A's theme after settings load; reloading B shows it with no flash. A fresh private window shows the server value, not `dark`, once loaded.
- [ ] **Step 4: pre-commit, commit** `feat: sync theme preference via server settings`

---

### Task 5: Getting Started backed by settings, no polling

**Files:**
- Modify: `frontend/src/hooks/useOnboardingProgress.ts` (rewrite)
- Modify: `frontend/src/components/GettingStarted.tsx` (render `null` while `isLoading`)
- Modify: `frontend/src/pages/settings/AccountsPage.tsx:31-34` (replace localStorage effect)
- Modify: `frontend/src/pages/settings/CategoriesPage.tsx:308-310` (replace localStorage effect)
- Modify: `frontend/src/hooks/mutations/useUpdatePayee.ts` (both `onSuccess` also invalidate `["onboarding-status"]`)
- Modify: `frontend/src/hooks/useGlobalSyncStatus.ts` (when `latestRun.status` moves from `running` to anything else, invalidate `["onboarding-status"]`)

**Interfaces:**
- Consumes: `useSettings`, `useUpdateSettings`, `getOnboardingStatus` (Task 3).
- Produces:
  - `useOnboardingProgress()` returns the existing `OnboardingProgress` shape **plus** `isLoading: boolean`. `refetch` refetches the onboarding-status query.
  - `useMarkOnboardingVisited(page: "accounts" | "categories"): void` — after settings load, if `onboarding.visited.<page>` is `false`, call `updateSettings({ [key]: true })` once.
  - Remove the exports `CATEGORIES_VISITED_KEY` and `ACCOUNTS_VISITED_KEY`.
- Onboarding status: `useQuery({ queryKey: ["onboarding-status"], queryFn: getOnboardingStatus, enabled: settingsLoaded && !values["onboarding.dismissed"] })`. No `refetchInterval`, no `setInterval`.
- Step completion: `sync` = `has_synced`; `accounts` = `onboarding.visited.accounts`; `categories` = `onboarding.visited.categories`; `rules` = `has_rules`; `overview` = `has_synced && onboarding.visited.categories` (unchanged rule). Step titles/descriptions/hrefs unchanged.
- `dismiss()` → `updateSettings({"onboarding.dismissed": true})`; `restore()` → `updateSettings({"onboarding.dismissed": false})`.
- `isLoading` = settings not yet loaded, or (not dismissed and onboarding status not yet loaded).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `npm run build && npm run lint`** pass; `grep -rn "setInterval\|grove_onboarding\|_VISITED_KEY" frontend/src` → no matches in onboarding code.
- [ ] **Step 3: Live check:** with the app open for 2 minutes, `docker logs --since 2m grove-dev_app 2>&1 | grep -c 'GET /api/payee '` → 0 (was ~26). Dismiss Getting Started in one browser → after reload in another browser it does not appear (and doesn't flash). Restore it via `PATCH {"onboarding.dismissed": false}` if you need to test the checklist.
- [ ] **Step 4: pre-commit, commit** `feat: server-backed getting started without polling`

---

### Task 6: Update-available dismissal backed by settings

**Files:**
- Modify: `frontend/src/components/VersionUpdateDialog.tsx` (`handleDismiss`)
- Modify: `frontend/src/components/app-sidebar.tsx:74-77` (`shouldShowUpdateBadge`)

**Interfaces:**
- Consumes: `useSettings`, `useUpdateSettings` (Task 3).
- `handleDismiss` → `updateSettings({"updates.dismissed_version": versionInfo.latest_version ?? null})`, then close.
- `shouldShowUpdateBadge` = `update_available && latest_version && settingsLoaded && values["updates.dismissed_version"] !== latest_version` (hidden until settings load).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `npm run build && npm run lint`** pass; `grep -rn "grove_dismissed_update" frontend/src` → only in `useLegacySettingsMigration.ts`.
- [ ] **Step 3: Live check:** `PATCH /api/settings {"updates.dismissed_version": null}`; if an update is available the badge shows; dismiss in the UI → `GET /api/settings` shows the version and the badge stays hidden in another browser. (If no update is currently available, verify only the PATCH/GET round-trip and the code path by reading it.)
- [ ] **Step 4: pre-commit, commit** `feat: sync update dismissal via server settings`

---

### Task 7: Final verification and docs

**Files:**
- Modify: `CLAUDE.md` (short "User Settings" section under Architecture: tables, registry location, `get_current_user` as the auth seam, how to add a new setting: registry entry + `SettingsValues` type + mock default)

- [ ] **Step 1: Full backend test run** (command above) → all pass. Run `pre-commit run --all-files` → pass.
- [ ] **Step 2: Mock mode check:** `./rebuild-mock.sh`, open http://localhost:5174 → app loads, theme toggle and Getting Started dismiss work, no failed `/api/settings` requests in the browser console. Stop the mock container afterwards if it wasn't running before (it was exited before this work).
- [ ] **Step 3: Commit** `docs: document user settings`
