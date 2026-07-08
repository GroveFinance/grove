# Sync Safe Field Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update existing transactions with safe fields (mcc, description, is_pending) during advanced resyncs to enable automatic backfill of new SimpleFin data.

**Architecture:** Modify `process_transactions()` to detect existing transactions and update safe fields instead of skipping. Change return value to tuple (new_count, updated_count). Update all callers to handle tuple and track both counts in stats.

**Tech Stack:** Python, SQLAlchemy, SimpleFin API integration

## Global Constraints

- Only update safe fields: `mcc`, `description`, `is_pending`
- Never update unsafe fields: `amount`, `memo`, `payee_id`, `posted`, `transacted_at`
- Don't overwrite existing data with null values
- Log updates at DEBUG level (per-transaction) and INFO level (summary)
- Track both new and updated transaction counts

---

## File Structure

**Modified:**
- `app/sync/simplefin.py` - Core sync logic
  - `process_transactions()` (line 630) - Add safe field update logic, change return type
  - `process_sync_range()` (line 403) - Handle tuple return, track update counts
  - `handle_new_account()` (line 286) - Handle tuple return

---

### Task 1: Update process_transactions to Update Safe Fields

**Files:**
- Modify: `app/sync/simplefin.py:630-703` (process_transactions function)

**Interfaces:**
- Consumes: Incoming SimpleFin transaction dicts with fields: `id`, `mcc`, `description`, `is_pending`
- Produces: `process_transactions(db, transactions, account_id) -> tuple[int, int]` - Returns (new_count, updated_count)

- [ ] **Step 1: Add update counter initialization**

In `process_transactions()` function (around line 645), add update counter alongside the existing counter:

```python
cnt = 0
updates_count = 0  # NEW: Track updated transactions
for txn in transactions:
```

- [ ] **Step 2: Replace skip logic with safe field update logic**

Find the existing skip logic (around line 651-652):

```python
# Fast path: Check if transaction ID already exists
if db.get(Transaction, txn_id):
    continue
```

Replace with:

```python
# Fast path: Check if transaction ID already exists
existing_txn = db.get(Transaction, txn_id)
if existing_txn:
    # Update safe fields that won't break user edits or splits
    updated_fields = []

    # Update mcc if incoming has it and it's different
    if txn.get("mcc") and txn.get("mcc") != existing_txn.mcc:
        updated_fields.append(f"mcc={existing_txn.mcc}→{txn['mcc']}")
        existing_txn.mcc = txn["mcc"]

    # Update description if different
    if txn.get("description") and txn.get("description") != existing_txn.description:
        updated_fields.append("description")
        existing_txn.description = txn["description"]

    # Update is_pending if different
    incoming_pending = txn.get("is_pending", False)
    if incoming_pending != existing_txn.is_pending:
        updated_fields.append(f"is_pending={existing_txn.is_pending}→{incoming_pending}")
        existing_txn.is_pending = incoming_pending

    if updated_fields:
        db.commit()
        logger.debug(f"Updated txn {txn_id}: {', '.join(updated_fields)}")
        updates_count += 1

    continue
```

- [ ] **Step 3: Change return statement to return both counts**

Find the return statement at the end of `process_transactions()` (around line 703):

```python
return cnt
```

Replace with:

```python
return cnt, updates_count
```

- [ ] **Step 4: Add summary logging before return**

Just before the return statement, add summary logging:

```python
if cnt > 0 or updates_count > 0:
    logger.info(f"Processed {cnt} new, updated {updates_count} existing transactions")

return cnt, updates_count
```

- [ ] **Step 5: Test the update logic manually**

Create a test transaction and verify update logic works:

Run:
```bash
docker compose exec app python -c "
from app.db import SessionLocal
from app.models import Transaction, Account
from datetime import datetime, UTC
from decimal import Decimal

db = SessionLocal()

# Find an existing transaction
txn = db.query(Transaction).first()
if txn:
    print(f'Found transaction: {txn.id}')
    print(f'Current mcc: {txn.mcc}')
    print(f'Current description: {txn.description}')
    print(f'Current is_pending: {txn.is_pending}')

    # Test update logic (simulate what sync would do)
    if txn.mcc != '9999':
        old_mcc = txn.mcc
        txn.mcc = '9999'
        db.commit()
        print(f'Updated mcc from {old_mcc} to {txn.mcc}')
    else:
        print('Transaction already has test mcc')
else:
    print('No transactions found')

db.close()
"
```

Expected: Should show transaction and successfully update mcc field

- [ ] **Step 6: Commit process_transactions changes**

```bash
git add app/sync/simplefin.py
git commit -m "feat: update existing transactions with safe fields during sync

- Modify process_transactions to update mcc, description, is_pending
- Only update when incoming has value and it differs from existing
- Add update counter tracking
- Change return type to tuple (new_count, updated_count)
- Add DEBUG logging for individual updates
- Add INFO logging for summary counts"
```

---

### Task 2: Update Callers to Handle Tuple Return

**Files:**
- Modify: `app/sync/simplefin.py:403-513` (process_sync_range function)
- Modify: `app/sync/simplefin.py:286-365` (handle_new_account function)

**Interfaces:**
- Consumes: `process_transactions(db, transactions, account_id) -> tuple[int, int]` from Task 1
- Produces: Updated stats dict with `total_transactions`, `total_updates`, and per-account `transactions_new`, `transactions_updated`

- [ ] **Step 1: Update process_sync_range to handle tuple return**

Find the call to `process_transactions()` in `process_sync_range()` (around line 484):

```python
txn_count = process_transactions(db, account_data.get("transactions", []), account_id)
```

Replace with:

```python
new_txns, updated_txns = process_transactions(db, account_data.get("transactions", []), account_id)
```

- [ ] **Step 2: Update total counter tracking**

Find where `total_txns` is updated (around line 487):

```python
total_txns += txn_count
```

Replace with:

```python
total_txns += new_txns
```

- [ ] **Step 3: Add total_updates counter initialization**

Find where `total_txns` is initialized in `process_sync_range()` (around line 466):

```python
total_txns = 0
```

Add below it:

```python
total_updates = 0
```

- [ ] **Step 4: Add updates tracking to total counter**

Where you just updated `total_txns += new_txns`, add below it:

```python
total_updates += updated_txns
```

- [ ] **Step 5: Update stats dict to track both counts per account**

Find where stats are tracked for accounts (around line 495-503):

```python
if stats is not None:
    if account_id not in stats["accounts"]:
        account = db.query(Account).get(account_id)
        stats["accounts"][account_id] = {
            "name": account.display_name if account else account_id,
            "transactions": 0,
            "holdings": 0,
        }
    stats["accounts"][account_id]["transactions"] += txn_count
    stats["accounts"][account_id]["holdings"] += holding_count
    stats["total_transactions"] += txn_count
    stats["total_holdings"] += holding_count
```

Replace with:

```python
if stats is not None:
    if account_id not in stats["accounts"]:
        account = db.query(Account).get(account_id)
        stats["accounts"][account_id] = {
            "name": account.display_name if account else account_id,
            "transactions_new": 0,
            "transactions_updated": 0,
            "holdings": 0,
        }
    stats["accounts"][account_id]["transactions_new"] += new_txns
    stats["accounts"][account_id]["transactions_updated"] += updated_txns
    stats["accounts"][account_id]["holdings"] += holding_count
    stats["total_transactions"] += new_txns
    stats["total_updates"] += updated_txns
    stats["total_holdings"] += holding_count
```

- [ ] **Step 6: Update summary logging in process_sync_range**

Find the summary log statement (around line 508):

```python
if total_txns > 0:
    logger.info(f"Processed {total_txns} transactions between {start.date()} and {end.date()}")
```

Replace with:

```python
if total_txns > 0 or total_updates > 0:
    logger.info(f"Processed {total_txns} new, {total_updates} updated transactions between {start.date()} and {end.date()}")
```

- [ ] **Step 7: Update return statement to use new counter name**

Find where `total_txns` is returned in `process_sync_range()` (around line 513):

```python
return total_txns
```

Keep as is (only returns new transactions count, which is correct for the initial sync logic).

- [ ] **Step 8: Update handle_new_account to handle tuple return**

Find the call to `process_transactions()` in `handle_new_account()` (around line 349):

```python
txn_count = process_transactions(db, txns, account_id)
```

Replace with:

```python
new_count, updated_count = process_transactions(db, txns, account_id)
```

- [ ] **Step 9: Update handle_new_account counter usage**

Find where `txn_count` is used (around lines 351-357):

```python
if txn_count == 0:
    empty_months += 1
else:
    empty_months = 0
    logger.debug(
        f"Pulled {txn_count} transactions for {account_id} in {start.date()} to {end.date()}"
    )
```

Replace with:

```python
if new_count == 0:
    empty_months += 1
else:
    empty_months = 0
    logger.debug(
        f"Pulled {new_count} new transactions for {account_id} in {start.date()} to {end.date()}"
    )
```

- [ ] **Step 10: Initialize stats with new structure**

Find where stats dict is initialized in the `run()` function (around line 217):

```python
stats = {"accounts": {}, "total_transactions": 0, "total_holdings": 0}
```

Replace with:

```python
stats = {"accounts": {}, "total_transactions": 0, "total_updates": 0, "total_holdings": 0}
```

- [ ] **Step 11: Test with a manual sync**

Run a sync and verify the new/updated counts appear in logs:

```bash
# Trigger sync via API (if sync endpoint exists)
curl -X POST http://localhost:8000/api/sync/simplefin/run

# Check logs for new counts
docker compose logs app | grep -E "Processed.*new.*updated" | tail -5
```

Expected: Should see log lines like "Processed 3 new, 0 updated transactions"

- [ ] **Step 12: Verify stats structure with database query**

Check that stats are being tracked correctly:

```bash
docker compose exec db psql -U dev -d budget -c "
SELECT id, status, transactions_found, details
FROM sync_runs
ORDER BY started_at DESC
LIMIT 1;
"
```

Expected: Should see `details` JSON containing account-level `transactions_new` and `transactions_updated` counts

- [ ] **Step 13: Commit caller updates**

```bash
git add app/sync/simplefin.py
git commit -m "feat: track new and updated transaction counts in sync stats

- Update process_sync_range to handle tuple return from process_transactions
- Add total_updates counter tracking
- Update stats dict structure to separate new vs updated counts
- Update handle_new_account to handle tuple return
- Initialize stats with total_updates field
- Update logging to show both new and updated counts"
```

---

## Testing Checklist

After completing both tasks, verify the complete feature:

- [ ] Create test transaction with mcc=None
- [ ] Run advanced sync for date range containing that transaction
- [ ] Verify mcc is backfilled from SimpleFin
- [ ] Check logs show "Updated N existing transactions" message
- [ ] Check logs show per-transaction DEBUG messages
- [ ] Verify stats include both new and updated counts
- [ ] Verify transaction splits are unchanged
- [ ] Verify user memo edits are preserved
- [ ] Verify regular sync (from last_sync) shows 0 updates
- [ ] Verify advanced sync shows non-zero updates when overlapping

---

## Manual Testing Commands

**Trigger advanced sync for last 30 days:**
```bash
curl -X POST http://localhost:8000/api/sync/simplefin/run \
  -H "Content-Type: application/json" \
  -d "{\"from_date\": \"$(date -d '30 days ago' -I)T00:00:00Z\"}"
```

**Check MCC backfill results:**
```bash
docker compose exec db psql -U dev -d budget -c "
SELECT
  COUNT(*) as total,
  COUNT(mcc) as with_mcc,
  COUNT(DISTINCT mcc) as unique_mccs
FROM transactions;
"
```

**View sync run details:**
```bash
curl http://localhost:8000/api/sync/simplefin/runs/latest | python -m json.tool
```

**Check logs for update activity:**
```bash
docker compose logs app | grep -E "Updated txn|Processed.*new.*updated" | tail -20
```

---

## Deployment Notes

1. No database migrations needed - all fields already exist
2. No API changes - backward compatible
3. Update logic only triggers during advanced sync (rare)
4. Regular scheduled syncs unaffected (only fetch new data)
5. Safe to deploy - gracefully handles missing fields
