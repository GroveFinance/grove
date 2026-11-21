# Server-Side User Settings Design

**Date:** 2026-11-20
**Status:** Approved
**Author:** Claude + User

## Overview

Move every browser-only (localStorage) preference into the database, keyed by
user, so settings follow the user across devices. Introduce a `users` table now
with a single seeded default user so the schema is ready for real users later.
Rework Getting Started to read its state from the server and remove its
5-second polling loop.

## Why

Getting Started progress, its dismissal, the theme, and the "update available"
dismissal all live in localStorage. On another device (phone, second browser)
the checklist reappears, the theme resets, and the update dialog shows again.
That is annoying today, and it would be wrong once there are multiple users.

Separately, `useOnboardingProgress` polls `/api/sync/simplefin` and the full
`/api/payee` list every 5 seconds forever (~720 request pairs/hour per open
tab), even after onboarding is complete or dismissed.

## Goals

1. All current localStorage preferences are stored server-side per user.
2. A user table exists with one default user; all settings belong to a user.
3. Adding authentication later only changes how the "current user" is
   resolved — no schema or frontend API changes.
4. Getting Started state is consistent across devices.
5. No interval polling for Getting Started.
6. Existing preferences in a browser are carried over once, not lost.

## Non-Goals

- Authentication, login, multiple users, or user management UI.
- New preferences (e.g. locale/currency — `TransactionsPage.tsx` has a TODO for
  locale; it can use this system later).
- Changing the Getting Started steps or their wording.
- Per-device overrides (a setting is the same on every device).

## Anti-Goals

- Theme flashing the wrong colors on page load because it waits on the API.
- Two devices clobbering each other's unrelated settings.
- Arbitrary keys accumulating in the DB (unknown keys are rejected).

## Current State

| Preference | localStorage key | Read/written in |
|---|---|---|
| Theme mode | `vite-ui-theme-mode` | `components/theme-provider.tsx` |
| Theme name | `vite-ui-theme-name` | `components/theme-provider.tsx` |
| Onboarding dismissed | `grove_onboarding_dismissed` | `hooks/useOnboardingProgress.ts` |
| Accounts page visited | `grove_accounts_visited` | `pages/settings/AccountsPage.tsx`, `useOnboardingProgress.ts` |
| Categories page visited | `grove_categories_visited` | `pages/settings/CategoriesPage.tsx`, `useOnboardingProgress.ts` |
| Dismissed update version | `grove_dismissed_update` | `components/VersionUpdateDialog.tsx`, `components/app-sidebar.tsx` |

The `meta` table (`app/models.py`) is a global string key/value table used only
for the `initial_seed_complete` system flag. It stays as-is for system flags.

Getting Started steps (`useOnboardingProgress.ts`): sync configured (has
`last_sync`), accounts visited, categories visited, payee rules exist (any payee
with `category_id != 0`), overview (derived: synced && categories visited).

## Approaches

**A. `users` + `user_settings` (one row per setting), seeded default user — chosen.**
Per-key rows mean concurrent writes from different devices to different
settings never conflict. The `current_user` dependency is the only thing that
changes when auth arrives.

**B. Namespaced keys in `meta`.** Least work, but `meta` is global and
string-only; adding users would require migrating everything out again, and it
mixes system flags with user preferences. Rejected.

**C. `users` table with one JSON `settings` column.** Simple, but whole-blob
writes from two devices clobber each other unless the server deep-merges every
write. A gives the same simplicity without the risk. Rejected.

## Design

### Database (one Alembic migration)

```
users
  id          integer PK
  username    varchar unique not null
  created_at  timestamptz not null default now()

user_settings
  user_id     integer FK users.id ON DELETE CASCADE
  key         varchar not null
  value       json not null
  updated_at  timestamptz not null default now()
  PRIMARY KEY (user_id, key)
```

The migration inserts the default user: `username = 'default'`.

### Settings registry (backend)

A single registry defines every allowed key, its type, and its default
(e.g. `app/settings_registry.py` or in `schemas.py`):

| Key | Type | Default |
|---|---|---|
| `theme.mode` | `"dark" \| "light" \| "system"` | `"dark"` (matches current `App.tsx` default) |
| `theme.name` | `"grove" \| "ocean" \| "sunset" \| "forest" \| "slate"` | `"grove"` |
| `onboarding.dismissed` | bool | `false` |
| `onboarding.visited.accounts` | bool | `false` |
| `onboarding.visited.categories` | bool | `false` |
| `updates.dismissed_version` | string \| null | `null` |

Validation uses Pydantic. Unknown keys or wrong types → 422.

### Current user

`app/api/deps.py: get_current_user(db) -> User` returns the user with
`username == 'default'`. All settings routes depend on it. When auth is added,
only this function changes.

### API

Route module `app/api/routes/settings.py` → mounted at `/api/settings`.

- `GET /api/settings` →
  `{ "values": { <every registry key>: <stored value or default> }, "explicit": [<keys stored in DB>] }`
  `explicit` exists so the frontend can tell "never set" from "set to the
  default value" (needed for the one-time localStorage migration).
- `PATCH /api/settings` with body `{ <key>: <value>, ... }` → upserts each key
  for the current user; a value of `null` for a key whose type is not nullable
  deletes the row (resets to default). Returns the same shape as GET.

Route module for onboarding facts: `GET /api/settings/onboarding` (or a separate
`/api/onboarding` module) →
`{ "has_synced": bool, "has_rules": bool }` using cheap `EXISTS` queries
(`SyncConfig.last_sync IS NOT NULL` for any config; any `Payee.category_id != 0`).
No full payee list is sent.

### Frontend

- `services/api/settings.ts`: `getSettings`, `updateSettings`,
  `getOnboardingStatus`, exported through `services/api/index.ts` with mock
  equivalents in `services/api/mock` (mock mode has no backend; mock settings
  can live in memory/localStorage).
- `hooks/queries/useSettings.ts`: TanStack Query `["settings"]`;
  `useUpdateSettings` mutation with optimistic update of the cache, rollback
  on error.
- **Getting Started** (`useOnboardingProgress`): built from `useSettings` +
  `["onboarding-status"]` query. No `setInterval`. Freshness comes from
  TanStack defaults (refetch on window focus) plus invalidating
  `["onboarding-status"]` when a sync completes and when payees are
  created/updated. Visiting Accounts/Categories pages writes
  `onboarding.visited.*` via the mutation (only if not already true). Dismiss/
  restore write `onboarding.dismissed`. Step definitions stay client-side.
  When dismissed, the onboarding-status query is disabled.
- **Theme** (`theme-provider.tsx`): initial render still reads localStorage as a
  cache to avoid a flash. When settings load, the server value wins and the
  cache is updated. `setMode`/`setThemeName` update local state, the cache, and
  the server.
- **Update dialog**: `VersionUpdateDialog` dismiss writes
  `updates.dismissed_version`; `app-sidebar.tsx` compares against the setting.

### One-time migration of existing browser values

On first settings load in a browser: for each legacy localStorage key that has a
value and whose setting key is **not** in `explicit`, send it in a single PATCH.
Then remove the legacy keys (except the theme cache keys, which remain as the
anti-flash cache). Whichever device loads first wins; later devices see the keys
as explicit and just discard their local values.

### Testing

- Backend (pytest, SQLite in-memory, existing `tests/conftest.py` pattern):
  GET returns defaults for an empty DB; PATCH upserts and is reflected in GET
  and `explicit`; unknown key and wrong type → 422; null resets to default;
  updating one key doesn't touch another; onboarding endpoint reflects
  synced/rules state.
- Frontend has no test runner; verify with `npm run build`, `npm run lint`, and
  a manual browser check: change theme on one browser, load another, confirm it
  follows; dismiss Getting Started and confirm it stays dismissed elsewhere;
  confirm no repeating `/api/payee` requests in the app logs.

## Decisions Made During Review (Claude's calls)

- **Default user resilience:** `get_current_user` creates the `default` user if
  it is missing (covers test DBs built with `create_all` and any DB where the
  seed row was removed). The migration still seeds it.
- **Legacy migration safety:** legacy values that fail validation (e.g. a theme
  name that no longer exists) are dropped client-side before the PATCH. Legacy
  keys are removed only after the PATCH succeeds, and a
  `grove_settings_migrated` flag in localStorage makes it run once per browser.
- **Null semantics:** `null` deletes the row only for non-nullable keys. For
  nullable keys (`updates.dismissed_version`) `null` is stored as an explicit
  value.
- **"Has synced" check:** any `SyncConfig` with `last_sync IS NOT NULL`
  (identical to today's behavior while SimpleFin is the only provider).
- **Loading state:** Getting Started renders nothing until settings have loaded
  (no flash for users who dismissed it), and `onboarding.visited.*` writes wait
  for loaded settings so "only if not already true" is checked against real data.
- **Upserts:** implemented portably (select-then-update/insert in one
  transaction), not with Postgres-only `ON CONFLICT`, so tests on SQLite
  exercise the same code.

## Left to the Builder

- Exact file placement of the registry and current-user dependency.
- Whether onboarding facts live under `/api/settings/onboarding` or their own
  route module.
- Query invalidation wiring details (which mutation hooks invalidate
  `["onboarding-status"]`).
