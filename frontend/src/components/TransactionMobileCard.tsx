import { useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { TransactionUI } from "@/hooks/queries/useTransactions";

// Simple split type for saving (minimal data needed)
interface SimpleSplit {
  category_id: number;
  amount: string;
}

interface TransactionMobileCardProps {
  txn: TransactionUI;
  locale: string;
  onSaveSplits: (splits: SimpleSplit[]) => void;
  onCategoryChange: (categoryId: number, amount: string) => void;
  onMemoUpdate: (transactionId: string, memo: string) => void;
  SplitTransactionDialog: React.ComponentType<{ transaction: TransactionUI; onSave: (splits: SimpleSplit[]) => void }>;
  InlineCategorySelector: React.ComponentType<{ categoryName: string; categoryId: number; onCategoryChange: (categoryId: number) => void }>;
  PayeeCategorySelector: React.ComponentType<{ payeeId: number; payeeName: string; currentCategoryId: number | null; currentCategoryName: string }>;
}

export function TransactionMobileCard({
  txn,
  locale,
  onSaveSplits,
  onCategoryChange,
  onMemoUpdate,
  SplitTransactionDialog,
  InlineCategorySelector,
  PayeeCategorySelector,
}: TransactionMobileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [editedMemo, setEditedMemo] = useState(txn.memo || "");
  const isSplit = txn.splits.length > 1;

  const handleSaveMemo = () => {
    onMemoUpdate(txn.id, editedMemo);
    setIsEditingMemo(false);
  };

  const handleCancelMemo = () => {
    setEditedMemo(txn.memo || "");
    setIsEditingMemo(false);
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Compact Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-accent/50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{txn.payeeName}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(txn.transacted_at).toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
            })}{" "}
            • {txn.categoryName}
          </div>
        </div>
        <div
          className={cn(
            "text-lg font-semibold ml-3 shrink-0",
            parseFloat(txn.amount) >= 0 ? "text-positive" : "text-negative"
          )}
        >
          {formatCurrency(Math.abs(parseFloat(txn.amount)))}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-2 border-t space-y-2">
          {/* Description */}
          {txn.description && txn.description !== txn.payeeName && (
            <div className="text-xs text-muted-foreground">
              {txn.description}
            </div>
          )}

          {/* Account & Actions */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{txn.accountName}</span>
            <div className="flex items-center gap-1">
              <PayeeCategorySelector
                payeeId={txn.payee_id}
                payeeName={txn.payeeName}
                currentCategoryId={txn.payee?.category_id ?? null}
                currentCategoryName={txn.payee?.category?.name ?? ""}
              />
              <SplitTransactionDialog transaction={txn} onSave={onSaveSplits} />
            </div>
          </div>

          {/* Category - single or split */}
          {isSplit ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Splits:
              </div>
              {txn.splits.map((s: any) => (
                <div
                  key={s.id}
                  className="flex justify-between text-sm pl-2 border-l-2"
                >
                  <span>{s.category?.name ?? "Uncategorized"}</span>
                  <span
                    className={cn(
                      "font-medium",
                      parseFloat(s.amount) >= 0
                        ? "text-positive"
                        : "text-negative"
                    )}
                  >
                    {formatCurrency(Math.abs(parseFloat(s.amount)))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs">Category:</span>
              <div className="flex-1">
                <InlineCategorySelector
                  categoryName={txn.categoryName}
                  categoryId={txn.splits[0]?.category_id ?? 0}
                  onCategoryChange={(categoryId: number) =>
                    onCategoryChange(categoryId, txn.amount)
                  }
                />
              </div>
            </div>
          )}

          {/* Memo/Notes */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Notes:</div>
            {isEditingMemo ? (
              <div className="space-y-2">
                <Input
                  value={editedMemo}
                  onChange={(e) => setEditedMemo(e.target.value)}
                  placeholder="Add notes..."
                  className="text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveMemo} className="flex-1">
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelMemo} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingMemo(true)}
                className="text-sm cursor-pointer hover:bg-accent/50 rounded p-2 transition-colors"
              >
                {txn.memo || <span className="text-muted-foreground italic">Tap to add notes...</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
