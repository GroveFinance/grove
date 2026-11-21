# Stale Holdings Cleanup Design

**Date:** 2026-11-20
**Status:** Approved
**Author:** Claude + User

## Why

SimpleFIN occasionally re-issues holding IDs for the same positions (seen on
2026-06-29 when E*Trade was re-linked). The sync only creates/updates holdings,
so the old IDs linger forever. The Investments page sums holdings, so PANW is
counted twice (~$652k + ~$584k against a $213k account balance).

Investigation (raw SimpleFIN response, 2026-11-20): only 2 of 58 holdings were
absent from the feed (the superseded PANW/AVGO rows). Broken connections do not
drop holdings: SimpleFIN keeps sending the account and its last-known holdings
with an old `balance-date` (already shown as "Last synced" on the Accounts page).
The TriNet 401(k) "triplicates" are real distinct lots (they sum exactly to the
account balance).

## Goals

1. Holdings no longer reported for an account that is present in the feed are removed.
2. A manual "Reset holdings" action per account for anything the rule can't fix.

## Non-Goals / Anti-Goals

- No holding history / soft delete (holdings are snapshots; buy/sell history
  belongs to investment transactions — see "Investment Transaction-to-Holding
  Linking" in CLAUDE.md; per-position performance would be a separate snapshot table).
- Never remove holdings for accounts missing from the feed.
- Never wipe an account's holdings because the feed sent an empty list.

## Approaches

- **Feed is authoritative per present account + manual reset (chosen).**
- Soft-delete (inactive flag): adds a column and filtering everywhere for no benefit.
- Match old/new IDs by symbol and merge: pointless, the feed already has the full current list.

## Design

- `process_holdings(db, holdings, account_id)`: after create/update, delete DB
  holdings for `account_id` whose id is not in the feed list. If the feed list is
  empty and the DB has holdings for the account, keep them and log a warning.
  Holdings skipped for invalid data still count as "present" (not deleted).
- `POST /api/account/{id}/reset-holdings` → `{"deleted": n}`; 404 for unknown account.
- `AccountDetailsOut.holdings_count: int`.
- Accounts page: "Reset holdings" button (only when `holdings_count > 0`) with a
  confirmation dialog like Delete; invalidates accounts and holdings queries.
  Holdings repopulate on the next sync.
