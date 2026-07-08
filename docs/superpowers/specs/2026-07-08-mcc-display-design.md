# MCC Display in Transaction Details Design

**Date:** 2026-07-08
**Status:** Approved
**Author:** Claude + User

## Overview

Display Merchant Category Code (MCC) information in the transaction details popup. SimpleFin now provides MCC codes for credit card transactions, and we want to expose this metadata to users with human-readable descriptions.

## Background

- SimpleFin started sending `mcc` field in transaction data (4-digit merchant category codes)
- Currently 7 out of 1265 transactions have MCC data (primarily credit card transactions)
- MCC codes are standardized (ISO 18245) and provide merchant type information
- Examples: 5300 = Wholesale Clubs, 5542 = Automated Fuel Dispensers

## Goals

1. Display MCC code and human-readable description in transaction details popup
2. Only show MCC section when data exists (avoid clutter for 99% of transactions without MCC)
3. Position backend for future use of MCC in automatic categorization during sync

## Non-Goals

- Automatic categorization based on MCC (future enhancement)
- Display MCC in transaction list table (keep it in details only)
- MCC editing/override functionality

## Design

### Backend Changes

**Dependencies:**
- Add `iso18245` to `requirements.txt` - Python library for MCC lookups

**Schema Changes (`app/schemas.py`):**
- Add computed field `mcc_description: str | None` to `TransactionOut` schema
- Use Pydantic's `@computed_field` decorator for automatic population
- Lookup description using `iso18245.get_mcc(code).description`

**Implementation:**
```python
from pydantic import computed_field
import iso18245

class TransactionOut(TransactionBase):
    id: str
    payee: PayeeOut | None = None
    account: AccountOut | None = None
    splits: list[TransactionSplitOut] = []

    @computed_field
    @property
    def mcc_description(self) -> str | None:
        """Lookup human-readable MCC description from code."""
        if not self.mcc:
            return None
        try:
            return iso18245.get_mcc(self.mcc).description
        except (KeyError, AttributeError):
            # Unknown/invalid MCC code
            return None
```

**Error Handling:**
- Gracefully handle unknown MCC codes by returning `None`
- No API disruption if iso18245 lookup fails
- Invalid codes display as code-only in frontend

### Frontend Changes

**Type Updates (`frontend/src/types/api-types.ts`):**
```typescript
export interface Transaction {
  id: string;
  account_id: string;
  account: Account | null;
  amount: string;
  posted: string;
  transacted_at: string;
  payee_id: number;
  description: string;
  memo: string;
  mcc: string | null;              // NEW
  mcc_description: string | null;  // NEW
  category_id: number;
  payee: Payee;
  category: Category;
  splits: TransactionSplit[];
}
```

**UI Changes (`frontend/src/pages/TransactionsPage.tsx`):**

Update `TransactionDetailsPopover` component to conditionally render MCC section:

**Display Rules:**
- Show only when `transaction.mcc` exists (conditional rendering)
- Position: Between "Description" and "Notes" (system data before user data)
- Format: `{mcc} - {mcc_description}` if both exist, just `{mcc}` if lookup failed
- Label: "Merchant Category"

**Component Update:**
```tsx
function TransactionDetailsPopover({
  transactionId,
  description,
  memo,
  mcc,              // NEW PROP
  mcc_description,  // NEW PROP
  onMemoUpdate
}: TransactionDetailsPopoverProps) {
  // ... existing state ...

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {/* ... existing trigger ... */}
      </PopoverTrigger>
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

          {/* ... existing buttons ... */}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Props Interface Update:**
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

**Caller Update (TransactionsPage table):**
Pass `mcc` and `mcc_description` props from transaction data to the popover component.

## Data Flow

1. SimpleFin sends MCC code during sync → stored in `transactions.mcc` column
2. Frontend requests transaction via API
3. Backend serializes transaction using `TransactionOut` schema
4. Pydantic computed field automatically looks up `mcc_description` using iso18245
5. API returns both `mcc` and `mcc_description` to frontend
6. Frontend conditionally renders MCC section if `mcc` exists
7. Display shows `{code} - {description}` format

## Edge Cases

| Case | Behavior |
|------|----------|
| MCC is null/empty | Don't render MCC section |
| MCC exists but description lookup fails | Show code only: "5300" |
| MCC exists and description found | Show both: "5300 - Wholesale Clubs" |
| iso18245 library missing | Computed field returns None, degrades gracefully |
| Invalid MCC format | Lookup fails, show code only |

## Testing Considerations

**Backend:**
- Test computed field with valid MCC (5300 → "Wholesale Clubs")
- Test with invalid MCC (should return None)
- Test with null MCC (should return None)
- Test serialization doesn't break when iso18245 unavailable

**Frontend:**
- Test conditional rendering (show when mcc exists, hide when null)
- Test display with both code and description
- Test display with code only (description null)
- Verify no visual regression for transactions without MCC

## Future Enhancements

- Use MCC for automatic categorization during sync (e.g., 5411 → Groceries, 5812 → Restaurants)
- Add MCC filter in transaction search
- Display MCC statistics in reports
- Create mapping UI for MCC → Category rules

## Files Changed

**Backend:**
- `requirements.txt` - Add iso18245 dependency
- `app/schemas.py` - Add mcc_description computed field to TransactionOut

**Frontend:**
- `frontend/src/types/api-types.ts` - Add mcc and mcc_description to Transaction interface
- `frontend/src/pages/TransactionsPage.tsx` - Update TransactionDetailsPopover component and props
- `frontend/package.json` - No changes needed (no new dependencies)

## Dependencies

- **iso18245** (Python) - MCC lookup library, ~40KB, no external dependencies
  - PyPI: https://pypi.org/project/iso18245/
  - Provides `get_mcc(code)` function returning object with `.description` attribute
