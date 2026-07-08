# MCC Display in Transaction Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display Merchant Category Code (MCC) and human-readable description in transaction details popup for credit card transactions.

**Architecture:** Backend uses Pydantic computed field with iso18245 library to automatically lookup MCC descriptions during serialization. Frontend conditionally renders MCC section in existing TransactionDetailsPopover component.

**Tech Stack:** Python iso18245, Pydantic computed_field, React/TypeScript, shadcn/ui components

## Global Constraints

- Python 3.12+ (existing project requirement)
- No new frontend dependencies (use existing React/TypeScript stack)
- MCC display is optional - only show when data exists
- Graceful degradation if iso18245 lookup fails

---

## File Structure

**Backend:**
- `requirements.txt` - Add iso18245 dependency
- `app/schemas.py` - Add mcc_description computed field to TransactionOut

**Frontend:**
- `frontend/src/types/api-types.ts` - Add mcc and mcc_description to Transaction interface
- `frontend/src/pages/TransactionsPage.tsx` - Update TransactionDetailsPopover component and props

---

### Task 1: Backend - Add MCC Description Lookup

**Files:**
- Modify: `requirements.txt:15`
- Modify: `app/schemas.py:347-352` (TransactionOut class)

**Interfaces:**
- Consumes: Existing `TransactionBase` schema with `mcc: str | None` field
- Produces: `TransactionOut.mcc_description: str | None` - Computed field returning human-readable MCC description

- [ ] **Step 1: Add iso18245 dependency**

Add to `requirements.txt` after line 15 (after pre-commit):

```
iso18245
```

- [ ] **Step 2: Install dependency in Docker container**

Run: `docker compose exec app pip install iso18245`

Expected: Successfully installed iso18245-x.x.x

- [ ] **Step 3: Verify iso18245 works**

Test the library works correctly:

Run:
```bash
docker compose exec app python -c "import iso18245; mcc = iso18245.get_mcc('5300'); print(f'{mcc.mcc} - {mcc.description}')"
```

Expected output: `5300 - Wholesale Clubs`

- [ ] **Step 4: Add import and computed field to TransactionOut schema**

In `app/schemas.py`, add import at the top with other imports (around line 1-10):

```python
from pydantic import computed_field
```

Add another import for iso18245 after the pydantic imports:

```python
try:
    import iso18245
    HAS_ISO18245 = True
except ImportError:
    HAS_ISO18245 = False
```

Find the `TransactionOut` class (around line 347) and add the computed field after the `splits` field:

```python
class TransactionOut(TransactionBase):
    id: str
    payee: PayeeOut | None = None
    account: AccountOut | None = None
    splits: list[TransactionSplitOut] = []  # expose splits instead of flat category

    @computed_field
    @property
    def mcc_description(self) -> str | None:
        """Lookup human-readable MCC description from code.

        Returns None if:
        - MCC code is not present
        - iso18245 library is not available
        - MCC code is invalid/unknown
        """
        if not self.mcc or not HAS_ISO18245:
            return None
        try:
            mcc_obj = iso18245.get_mcc(self.mcc)
            return mcc_obj.description
        except (KeyError, AttributeError, ValueError):
            # Unknown/invalid MCC code
            return None

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Step 5: Test the computed field**

Create a quick test to verify the computed field works:

Run:
```bash
docker compose exec app python -c "
from app.schemas import TransactionOut, TransactionBase
from datetime import datetime, UTC

# Create a mock transaction with MCC
tx_data = {
    'id': 'test-123',
    'account_id': 'acc-1',
    'amount': '100.00',
    'posted': datetime.now(UTC),
    'transacted_at': datetime.now(UTC),
    'payee_id': 1,
    'is_pending': False,
    'description': 'COSTCO WHSE',
    'memo': '',
    'mcc': '5300'
}

# Test with valid MCC
tx = TransactionOut(**tx_data, payee=None, account=None, splits=[])
print(f'MCC: {tx.mcc}')
print(f'Description: {tx.mcc_description}')
assert tx.mcc_description == 'Wholesale Clubs', f'Expected \"Wholesale Clubs\", got \"{tx.mcc_description}\"'

# Test with invalid MCC
tx_data['mcc'] = '9999'
tx2 = TransactionOut(**tx_data, payee=None, account=None, splits=[])
print(f'Invalid MCC: {tx2.mcc}')
print(f'Description: {tx2.mcc_description}')
assert tx2.mcc_description is None, f'Expected None for invalid MCC, got \"{tx2.mcc_description}\"'

# Test with no MCC
tx_data['mcc'] = None
tx3 = TransactionOut(**tx_data, payee=None, account=None, splits=[])
print(f'No MCC: {tx3.mcc}')
print(f'Description: {tx3.mcc_description}')
assert tx3.mcc_description is None, f'Expected None for missing MCC, got \"{tx3.mcc_description}\"'

print('✅ All tests passed!')
"
```

Expected output:
```
MCC: 5300
Description: Wholesale Clubs
Invalid MCC: 9999
Description: None
No MCC: None
Description: None
✅ All tests passed!
```

- [ ] **Step 6: Verify API returns mcc_description**

Test that the API endpoint returns the new field:

Run:
```bash
# Find a transaction with MCC in the database
docker compose exec db psql -U dev -d budget -c "SELECT id FROM transactions WHERE mcc IS NOT NULL LIMIT 1;" -t | xargs -I {} curl -s http://localhost:8000/api/transaction/{} | python -m json.tool | grep -A 1 mcc
```

Expected output should show both `mcc` and `mcc_description` fields:
```json
    "mcc": "5300",
    "mcc_description": "Wholesale Clubs",
```

- [ ] **Step 7: Commit backend changes**

```bash
git add requirements.txt app/schemas.py
git commit -m "feat: add MCC description lookup to transaction API

- Add iso18245 dependency for MCC lookups
- Add computed field mcc_description to TransactionOut schema
- Gracefully handles missing library or invalid MCC codes
- Returns human-readable description (e.g., '5300 - Wholesale Clubs')"
```

---

### Task 2: Frontend - Display MCC in Transaction Details

**Files:**
- Modify: `frontend/src/types/api-types.ts:155-169` (Transaction interface)
- Modify: `frontend/src/pages/TransactionsPage.tsx:112-179` (TransactionDetailsPopover component)

**Interfaces:**
- Consumes: `TransactionOut.mcc: string | null` and `TransactionOut.mcc_description: string | null` from backend API
- Produces: Conditional MCC display in transaction details popover UI

- [ ] **Step 1: Update Transaction type definition**

In `frontend/src/types/api-types.ts`, find the `Transaction` interface (around line 155) and add the MCC fields:

```typescript
export interface Transaction {
  id: string; // looks like UUID-ish string from API
  account_id: string;
  account: Account | null;
  amount: string; // API sends it as string
  posted: string; // ISO timestamp
  transacted_at: string; // ISO timestamp
  payee_id: number;
  description: string;
  memo: string;
  mcc: string | null;              // NEW: Merchant Category Code
  mcc_description: string | null;  // NEW: Human-readable MCC description
  category_id: number;
  payee: Payee;
  category: Category;
  splits: TransactionSplit[];
}
```

- [ ] **Step 2: Run TypeScript type check**

Verify types compile:

Run: `cd frontend && npm run type-check`

Expected: No errors (build may show warnings about unused variables, that's OK)

- [ ] **Step 3: Update TransactionDetailsPopoverProps interface**

In `frontend/src/pages/TransactionsPage.tsx`, find the `TransactionDetailsPopoverProps` interface (around line 112) and add the new props:

```typescript
interface TransactionDetailsPopoverProps {
  transactionId: string;
  description: string;
  memo: string;
  mcc: string | null;              // NEW
  mcc_description: string | null;  // NEW
  onMemoUpdate: (transactionId: string, memo: string) => void;
}
```

- [ ] **Step 4: Update TransactionDetailsPopover component signature**

In the same file, update the `TransactionDetailsPopover` function signature (around line 119) to destructure the new props:

```typescript
function TransactionDetailsPopover({
  transactionId,
  description,
  memo,
  mcc,              // NEW
  mcc_description,  // NEW
  onMemoUpdate
}: TransactionDetailsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [editedMemo, setEditedMemo] = useState(memo || "");

  // ... rest of component unchanged until the return statement
```

- [ ] **Step 5: Add MCC display section to popover content**

In the same component, find the `PopoverContent` section (around line 152-176) and add the MCC section between Description and Notes:

```typescript
      <PopoverContent className="w-[350px]" align="start">
        <div className="space-y-3">
          {/* Description section */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
            <div className="text-sm">{description || "—"}</div>
          </div>

          {/* NEW: MCC section - conditional */}
          {mcc && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Merchant Category
              </div>
              <div className="text-sm">
                {mcc_description ? `${mcc} - ${mcc_description}` : mcc}
              </div>
            </div>
          )}

          {/* Notes section */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Notes</div>
            <Input
              value={editedMemo}
              onChange={(e) => setEditedMemo(e.target.value)}
              placeholder="Add notes..."
              className="text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
```

- [ ] **Step 6: Update TransactionDetailsPopover call sites to pass new props**

Find where `TransactionDetailsPopover` is called in the table rendering (search for `<TransactionDetailsPopover` in the same file). There should be at least one call site in the desktop table view. Update it to pass the new props:

```typescript
<TransactionDetailsPopover
  transactionId={tx.id}
  description={tx.description}
  memo={tx.memo}
  mcc={tx.mcc}                          // NEW
  mcc_description={tx.mcc_description}  // NEW
  onMemoUpdate={handleMemoUpdate}
/>
```

Note: There may be multiple call sites (desktop table, mobile view). Update all instances.

- [ ] **Step 7: Check mobile card component**

Check if `TransactionMobileCard` component also uses transaction details. If it does, update it similarly:

Run: `grep -n "TransactionDetailsPopover" frontend/src/components/TransactionMobileCard.tsx`

If found, update that component's call site too. If not found, skip this step.

- [ ] **Step 8: Run TypeScript type check again**

Verify all type errors are resolved:

Run: `cd frontend && npm run type-check`

Expected: No errors

- [ ] **Step 9: Run ESLint**

Check for any linting issues:

Run: `cd frontend && npm run lint`

Expected: No errors (warnings are OK)

- [ ] **Step 10: Test in browser with a transaction that has MCC**

Start the dev server if not already running and test manually:

1. Navigate to http://localhost:5173/transactions
2. Find a transaction from Costco or another credit card transaction (these are most likely to have MCC)
3. Click the notes icon (FileText icon) to open the transaction details popover
4. Verify you see:
   - Description section (existing)
   - **NEW:** Merchant Category section showing something like "5300 - Wholesale Clubs"
   - Notes section (existing)

- [ ] **Step 11: Test with a transaction without MCC**

1. Find a transaction that doesn't have MCC (most bank transactions won't)
2. Click the notes icon to open details popover
3. Verify the Merchant Category section does NOT appear
4. Verify Description and Notes sections still display correctly

- [ ] **Step 12: Commit frontend changes**

```bash
git add frontend/src/types/api-types.ts frontend/src/pages/TransactionsPage.tsx
git commit -m "feat: display MCC in transaction details popup

- Add mcc and mcc_description to Transaction type
- Update TransactionDetailsPopover to show MCC conditionally
- Display format: '{code} - {description}' when available
- Only renders MCC section when transaction has MCC data"
```

---

## Testing Checklist

After completing both tasks, verify the complete feature:

- [ ] Backend returns `mcc_description` field in transaction API responses
- [ ] MCC section appears for transactions with MCC codes (e.g., Costco = "5300 - Wholesale Clubs")
- [ ] MCC section does NOT appear for transactions without MCC codes
- [ ] Invalid MCC codes gracefully show code only (no description)
- [ ] Transaction details popover still works for all transactions (no regressions)
- [ ] No TypeScript errors in frontend
- [ ] No console errors in browser

---

## Deployment Notes

1. Backend requires `pip install iso18245` in production environment (already in requirements.txt)
2. Frontend changes are purely additive - no breaking changes
3. No database migrations needed (mcc column already exists from previous work)
4. No environment variables or configuration changes needed
