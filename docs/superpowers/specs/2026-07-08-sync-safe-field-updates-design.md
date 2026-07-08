# Sync Safe Field Updates Design

**Date:** 2026-07-08
**Status:** Approved
**Author:** Claude + User

## Overview

Modify SimpleFin sync logic to update existing transactions with safe fields (mcc, description, is_pending) during advanced/manual resyncs. This enables automatic backfill of new SimpleFin data like MCC codes without breaking user edits or transaction splits.

## Background

- SimpleFin recently started providing MCC (Merchant Category Code) data for credit card transactions
- Current sync logic skips existing transactions entirely - no updates happen
- Users can trigger advanced sync to resync specific date ranges
- Need to backfill MCC data on existing transactions without requiring manual intervention
- Future SimpleFin data improvements should also auto-backfill

## Goals

1. Update existing transactions with safe fields during advanced resyncs
2. Enable automatic MCC backfill for existing transactions
3. Future-proof for new SimpleFin fields - they auto-backfill without code changes
4. Log update activity for debugging and confirmation
5. Never break user edits (manual splits, memo edits, payee corrections)

## Non-Goals

- Update during regular scheduled syncs (those only fetch new data, so no overlap)
- Update unsafe fields that could break user edits (amount, memo, payee_id, posted dates)
- Add UI for selective field updates
- Batch update API endpoint (use advanced sync instead)

## Design

### Safe vs Unsafe Fields

**Safe to update** (won't break user data):
- `mcc` - New field, no user edits possible yet
- `description` - SimpleFin source of truth, not user-editable in UI
- `is_pending` - Status can change (pending → posted) legitimately

**Unsafe to update** (preserve user edits and data integrity):
- `amount` - Would break manually split transactions (splits must sum to amount)
- `memo` - User can manually edit this field
- `payee_id` - User can manually correct payee assignments
- `posted` - Transaction date should be immutable
- `transacted_at` - Transaction date should be immutable

### Architecture

**Modify `process_transactions()` in `app/sync/simplefin.py`:**

Current behavior:
```python
# Fast path: Check if transaction ID already exists
if db.get(Transaction, txn_id):
    continue  # Skip entirely
```

New behavior:
```python
# Fast path: Check if transaction ID already exists
existing_txn = db.get(Transaction, txn_id)
if existing_txn:
    # Update safe fields
    update_safe_fields(existing_txn, txn, db)
    continue
```

**When does this trigger?**
- **Regular sync:** Fetches from `last_sync` timestamp → only new transactions → no updates
- **Advanced sync:** User-specified date range → overlaps existing data → updates happen

Result: Update logic only runs during advanced/manual resyncs, not regular scheduled syncs.

### Implementation

**Update Logic:**

```python
existing_txn = db.get(Transaction, txn_id)
if existing_txn:
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

**Tracking and Logging:**

1. **Counter tracking:**
   - Add `updates_count = 0` alongside existing `cnt = 0` in `process_transactions()`
   - Increment when fields are updated
   - Return both: `return cnt, updates_count`

2. **Summary logging** (INFO level):
   ```python
   logger.info(f"Processed {cnt} new, updated {updates_count} existing transactions")
   ```

3. **Detail logging** (DEBUG level):
   ```python
   logger.debug(f"Updated txn {txn_id}: mcc=None→5300, is_pending=True→False")
   ```

4. **Sync stats:**
   - Track both counts in stats dict
   - Include in SyncRun details
   - Display in sync UI/API response

### Callers Update

**`process_sync_range()` in `simplefin.py`:**

Current:
```python
txn_count = process_transactions(db, account_data.get("transactions", []), account_id)
total_txns += txn_count
```

New:
```python
new_txns, updated_txns = process_transactions(db, account_data.get("transactions", []), account_id)
total_txns += new_txns
total_updates += updated_txns  # New counter
```

**Stats tracking:**
```python
stats["accounts"][account_id]["transactions_new"] = new_txns
stats["accounts"][account_id]["transactions_updated"] = updated_txns
stats["total_transactions"] += new_txns
stats["total_updates"] += updated_txns  # New field
```

**`handle_new_account()` caller:**
Already uses return value, just needs to handle tuple:
```python
new_count, updated_count = process_transactions(db, txns, account_id)
# Only log new_count for new account walkback (updates shouldn't happen)
```

### Data Flow

1. User triggers advanced sync with date range (e.g., last 30 days)
2. SimpleFin returns transactions including those that already exist in DB
3. `process_transactions()` loops through incoming transactions
4. For existing transaction: check each safe field, update if different, log changes
5. For new transaction: create as before (existing behavior)
6. Return counts: (new_transactions, updated_transactions)
7. Log summary: "Processed 3 new, updated 47 existing transactions"
8. Include counts in SyncRun details for UI display

### Edge Cases

| Case | Behavior |
|------|----------|
| Incoming has mcc=None, existing has mcc=5300 | No update (don't overwrite with null) |
| Incoming has mcc=5300, existing has mcc=None | Update to 5300 (backfill) |
| Incoming has mcc=5300, existing has mcc=5300 | No update (already matches) |
| Incoming missing description field | No update (don't overwrite with null) |
| Transaction has manual splits | Safe - splits not touched, amount not changed |
| Transaction has edited memo | Safe - memo not in safe fields list |
| User corrected payee | Safe - payee_id not in safe fields list |
| Regular scheduled sync | No updates - only fetches new transactions after last_sync |
| Advanced sync with no overlaps | No updates - all transactions are new |

## Testing Considerations

**Manual testing:**
1. Create test transaction with mcc=None
2. Run advanced sync for date range containing that transaction
3. Verify mcc backfilled from SimpleFin
4. Check logs show update count
5. Verify splits unchanged, user edits preserved

**Test scenarios:**
- Backfill mcc on transaction without it
- Update description that changed in SimpleFin
- Update pending status (pending → posted)
- No update when fields already match
- No update when incoming field is null
- Preserve user memo edits
- Preserve user payee corrections
- Preserve transaction splits

**Verification:**
- Check database: `SELECT id, mcc, description FROM transactions WHERE mcc IS NOT NULL`
- Check logs: grep for "Updated X existing transactions"
- Check SyncRun details: verify updated_count field

## Future Enhancements

**Automatic new field handling:**
When SimpleFin adds new fields in the future, they'll automatically backfill by:
1. Adding field to Transaction model
2. SimpleFin starts sending the field
3. Advanced sync automatically updates existing transactions (no code changes needed)

The update logic is intentional: "update if incoming has value and it's different" means new fields get backfilled automatically.

**UI improvements:**
- Show update counts in sync results UI
- "Updated 47 transactions with new MCC data" message
- Breakdown by field type in sync details

**Performance optimization:**
If update logging becomes verbose, could batch commits:
- Collect all updates
- Single commit after processing all transactions
- Log aggregated stats

## Files Changed

**Backend:**
- `app/sync/simplefin.py` - Modify `process_transactions()` to update existing transactions
  - Add safe field update logic
  - Add update counter tracking
  - Change return value to tuple: `(new_count, updated_count)`
  - Update callers: `process_sync_range()`, `handle_new_account()`
  - Add logging for update summary and details

**No schema changes needed** - all fields already exist in models.

## Migration Notes

**No data migration required** - this is purely behavioral:
- Existing transactions unchanged until next advanced sync
- MCC backfill happens naturally when user runs advanced sync
- No breaking changes to API or database schema

**Testing advanced sync:**
```bash
# Trigger manual sync via API
curl -X POST http://localhost:8000/api/sync/simplefin/run \
  -H "Content-Type: application/json" \
  -d '{"from_date": "2026-06-01T00:00:00Z"}'

# Check results
curl http://localhost:8000/api/sync/simplefin/runs/latest
# Should show: transactions_found (new + updated)
```

## Benefits

1. **MCC backfill** - Automatically populate MCC on existing credit card transactions
2. **Future-proof** - New SimpleFin fields auto-backfill without code changes
3. **Safe** - Never breaks user edits or transaction splits
4. **Transparent** - Logging shows what was updated
5. **Simple** - One-time advanced sync backfills all historical data
6. **Efficient** - Only runs during manual resyncs, not regular scheduled syncs
