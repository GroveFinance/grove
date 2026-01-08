import React from "react";
import { MainLayout } from "@/layouts/MainLayout";
import { AsyncRenderer } from "@/components/ui/AsyncRenderer";
import { useInfiniteTransactions, useUpdateTransaction, useTransactionsSummary } from "@/hooks/queries/useTransactions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CategoryCombobox from "@/components/ui/CategoryCombobox";
import AccountCombobox from "@/components/ui/AccountCombobox";
import TimeRangeSelector from "@/components/ui/TimeRangeSelector";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import { subMonths, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { SplitIcon, X, Plus, Trash2, Check, Filter, User, FileText, Loader2 } from "lucide-react";
import { useUpdatePayee } from "@/hooks/mutations/useUpdatePayee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { DialogTrigger } from "@radix-ui/react-dialog";
import type { TransactionUI } from "@/hooks/queries/useTransactions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useGroups } from "@/hooks/queries/useGroups";
import { cn, formatCurrency } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TransactionMobileCard } from "@/components/TransactionMobileCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Split {
  category_id: number;
  amount: string;
}

interface SplitDialogProps {
  transaction: TransactionUI;
  onSave: (splits: Split[]) => void;
}

interface InlineCategorySelectorProps {
  categoryName: string;
  categoryId: number;
  onCategoryChange: (categoryId: number) => void;
}

function InlineCategorySelector({ categoryName, categoryId, onCategoryChange }: InlineCategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: groups, isLoading } = useGroups();
  const flatCategories = groups?.flatMap((g) => g.categories) ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "px-2 py-1 rounded-md text-sm font-medium transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "text-left w-full",
            categoryId === 0 ? "text-muted-foreground italic" : ""
          )}
        >
          {categoryName}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search category..." />
          <CommandList>
            {isLoading ? (
              <CommandEmpty>Loading categories…</CommandEmpty>
            ) : flatCategories.length === 0 ? (
              <CommandEmpty>No categories found.</CommandEmpty>
            ) : null}

            {groups?.map((group) => (
              <CommandGroup key={group.id} heading={group.name}>
                {group.categories?.map((cat) => (
                  <CommandItem
                    key={cat.id}
                    value={cat.name}
                    onSelect={() => {
                      onCategoryChange(cat.id);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        categoryId === cat.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {cat.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface PayeeCategorySelectorProps {
  payeeId: number;
  payeeName: string;
  currentCategoryId: number | null;
  currentCategoryName: string;
}

interface TransactionDetailsPopoverProps {
  transactionId: string;
  description: string;
  memo: string;
  onMemoUpdate: (transactionId: string, memo: string) => void;
}

function TransactionDetailsPopover({ transactionId, description, memo, onMemoUpdate }: TransactionDetailsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [editedMemo, setEditedMemo] = useState(memo || "");

  const handleSave = () => {
    onMemoUpdate(transactionId, editedMemo);
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setEditedMemo(memo || "");
    }
  };

  const hasMemo = memo && memo.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "p-1.5 rounded-md transition-colors inline-flex items-center",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            hasMemo ? "text-primary" : "text-muted-foreground"
          )}
          title={hasMemo ? "View/edit notes" : "Add notes"}
        >
          <FileText className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px]" align="start">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
            <div className="text-sm">{description || "—"}</div>
          </div>
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
    </Popover>
  );
}

function PayeeCategorySelector({ payeeId, payeeName, currentCategoryId, currentCategoryName }: PayeeCategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: groups, isLoading } = useGroups();
  const updatePayeeMutation = useUpdatePayee();
  const flatCategories = groups?.flatMap((g) => g.categories) ?? [];

  const handleCategoryChange = (categoryId: number) => {
    updatePayeeMutation.mutate({
      id: payeeId,
      data: { category_id: categoryId },
    });
    setOpen(false);
  };

  const tooltipText = currentCategoryId && currentCategoryId !== 0
    ? `Payee default: ${currentCategoryName}`
    : `Set default category for ${payeeName}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "p-1.5 rounded-md transition-colors inline-flex items-center ml-2",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            currentCategoryId && currentCategoryId !== 0
              ? "text-primary"
              : "text-muted-foreground border border-dashed"
          )}
          title={tooltipText}
        >
          <User className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search category..." />
          <CommandList>
            {isLoading ? (
              <CommandEmpty>Loading categories…</CommandEmpty>
            ) : flatCategories.length === 0 ? (
              <CommandEmpty>No categories found.</CommandEmpty>
            ) : null}

            {groups?.map((group) => (
              <CommandGroup key={group.id} heading={group.name}>
                {group.categories?.map((cat) => (
                  <CommandItem
                    key={cat.id}
                    value={cat.name}
                    onSelect={() => handleCategoryChange(cat.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        currentCategoryId === cat.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {cat.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SplitTransactionDialog({ transaction, onSave }: SplitDialogProps) {
  const [splits, setSplits] = useState<Split[]>(() => {
    // Initialize with existing splits or a single split with the full amount
    if (transaction.splits.length > 0) {
      return transaction.splits.map(s => ({
        category_id: s.category_id,
        amount: s.amount,
      }));
    }
    return [{ category_id: 0, amount: transaction.amount }];
  });
  const [open, setOpen] = useState(false);

  const transactionAmount = parseFloat(transaction.amount);

  const totalSplits = splits.reduce((sum, split) => {
    return sum + (parseFloat(split.amount) || 0);
  }, 0);

  const isValid = Math.abs(totalSplits - transactionAmount) < 0.01;
  const difference = transactionAmount - totalSplits;

  const addSplit = () => {
    setSplits([...splits, { category_id: 0, amount: "0.00" }]);
  };

  const removeSplit = (index: number) => {
    if (splits.length > 1) {
      const newSplits = splits.filter((_, i) => i !== index);

      // If only 1 split remains, set it to the full transaction amount
      if (newSplits.length === 1) {
        newSplits[0].amount = transaction.amount;
      }

      setSplits(newSplits);
    }
  };

  const updateSplit = (index: number, field: keyof Split, value: string | number) => {
    const newSplits = [...splits];
    if (field === 'category_id') {
      newSplits[index].category_id = value as number;
    } else {
      newSplits[index].amount = value as string;

      // Auto-balance when there are exactly 2 splits
      if (splits.length === 2) {
        const otherIndex = index === 0 ? 1 : 0;
        const currentAmount = parseFloat(value as string) || 0;
        const remainder = transactionAmount - currentAmount;
        newSplits[otherIndex].amount = remainder.toFixed(2);
      }
    }
    setSplits(newSplits);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      onSave(splits);
      setOpen(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Reset splits when opening
      if (transaction.splits.length > 0) {
        setSplits(transaction.splits.map(s => ({
          category_id: s.category_id,
          amount: s.amount,
        })));
      } else {
        setSplits([{ category_id: 0, amount: transaction.amount }]);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Split Transaction">
          <SplitIcon className="inline-block mb-1" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Split Transaction</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="text-sm text-muted-foreground">
              <div>Transaction: {transaction.payeeName}</div>
              <div>Total Amount: {formatCurrency(transactionAmount)}</div>
            </div>

            <div className="space-y-2">
              {splits.map((split, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <CategoryCombobox
                      selectedId={split.category_id}
                      onChange={(id) => updateSplit(index, 'category_id', id || 0)}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      step="0.01"
                      value={split.amount}
                      onChange={(e) => updateSplit(index, 'amount', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSplit(index)}
                    disabled={splits.length === 1}
                    aria-label="Remove split"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSplit}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Split
            </Button>

            <div className="border-t pt-2">
              <div className="flex justify-between text-sm">
                <span>Total of splits:</span>
                <span className={!isValid ? "text-destructive font-semibold" : ""}>
                  {formatCurrency(totalSplits)}
                </span>
              </div>
              {!isValid && (
                <div className="text-sm text-destructive mt-1">
                  Difference: {formatCurrency(Math.abs(difference))}
                  {difference > 0 ? " remaining" : " over"}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={!isValid}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Calculate default date range (last 3 months) outside component to avoid recalculation
const getDefault3MonthRange = (): DateRange => {
  const today = new Date();
  const threeMonthsAgo = subMonths(today, 3);
  return {
    from: startOfDay(startOfMonth(threeMonthsAgo)),
    to: endOfDay(today),
  };
};

export default function Transactions() {
  const location = useLocation()
  // add variable for selected category filter
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [excludedCategoryIds, setExcludedCategoryIds] = useState<number[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [excludedAccountIds, setExcludedAccountIds] = useState<string[]>([]);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(getDefault3MonthRange());
  const [payeeFilter, setPayeeFilter] = useState<string>("")
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false)
  const [sortBy, setSortBy] = useState<"transacted_at" | "amount">("transacted_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [transactionType, setTransactionType] = useState<"all" | "income" | "expense">("all");
  const updateTransactionMutation = useUpdateTransaction();

  const handleSaveSplits = (transactionId: string, splits: Split[]) => {
    updateTransactionMutation.mutate({
      id: transactionId,
      data: { splits },
    });
  };

  const handleCategoryChange = (transactionId: string, categoryId: number, currentAmount: string) => {
    // Update the single split's category
    updateTransactionMutation.mutate({
      id: transactionId,
      data: {
        splits: [{
          category_id: categoryId,
          amount: currentAmount,
        }],
      },
    });
  };

  const handleMemoUpdate = (transactionId: string, memo: string) => {
    updateTransactionMutation.mutate({
      id: transactionId,
      data: { memo },
    });
  };

  const handleUpdate = (dateRange: DateRange | undefined, _byMonthMode: boolean) => {
    setSelectedRange(dateRange);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    // Handle category_ids (support both singular and plural param names)
    const categoryIdsParam = params.get("category_ids");
    let categoryIds: number[] = [];
    if (categoryIdsParam) {
      // Support comma-separated values in category_ids parameter
      categoryIds = categoryIdsParam.split(",").map(Number).filter(id => !isNaN(id));
    } else {
      // Fallback to multiple category_id parameters
      categoryIds = params.getAll("category_id").map(Number).filter(id => !isNaN(id));
    }
    setSelectedCategoryIds(categoryIds.length > 0 ? categoryIds : []);

    // Handle excluded_category_ids (support both singular and plural param names)
    const excludedCategoryIdsParam = params.get("exclude_category_ids") || params.get("excluded_category_ids");
    let excludedCatIds: number[] = [];
    if (excludedCategoryIdsParam) {
      // Support comma-separated values
      excludedCatIds = excludedCategoryIdsParam.split(",").map(Number).filter(id => !isNaN(id));
    }
    setExcludedCategoryIds(excludedCatIds.length > 0 ? excludedCatIds : []);

    // Handle account_ids (support both singular and plural param names)
    const accountIdsParam = params.get("account_ids");
    let accountIds: string[] = [];
    if (accountIdsParam) {
      accountIds = accountIdsParam.split(",").filter(Boolean);
    } else {
      accountIds = params.getAll("account_id").map(String).filter(Boolean);
    }
    setSelectedAccountIds(accountIds.length > 0 ? accountIds : []);

    // Handle payee_name parameter
    const payeeNameParam = params.get("payee_name");
    setPayeeFilter(payeeNameParam || "");

    // Handle date range from URL params (important for deep links and summary accuracy)
    const transactedStart = params.get("transacted_start");
    const transactedEnd = params.get("transacted_end");

    if (transactedStart && transactedEnd) {
      // URL params take precedence - parse dates from URL
      // Support both ISO strings (2024-01-15T00:00:00.000Z) and simple dates (2024-01-15)
      const parseDate = (dateStr: string): Date => {
        // If it's an ISO string, parse it directly
        if (dateStr.includes('T')) {
          return new Date(dateStr);
        }
        // Otherwise, parse as YYYY-MM-DD to avoid timezone issues
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
      };

      const urlDateRange = {
        from: startOfDay(parseDate(transactedStart)),
        to: endOfDay(parseDate(transactedEnd)),
      };
      setSelectedRange(urlDateRange);
    } else if (!transactedStart && !transactedEnd) {
      // No date params in URL - use default 3 months
      // Only set if not already set (to avoid overwriting user selections)
      setSelectedRange(prev => prev || getDefault3MonthRange());
    }

    // Handle sort params from URL
    const sortByParam = params.get("sort_by");
    const sortOrderParam = params.get("sort_order");
    if (sortByParam === "transacted_at" || sortByParam === "amount") {
      setSortBy(sortByParam);
    }
    if (sortOrderParam === "asc" || sortOrderParam === "desc") {
      setSortOrder(sortOrderParam);
    }
  }, [location.search]);


  const {
    data,
    isLoading,
    error,
    isSuccess,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTransactions({
    account_ids: selectedAccountIds,
    excluded_account_ids: excludedAccountIds,
    category_ids: selectedCategoryIds,
    excluded_category_ids: excludedCategoryIds,
    payee_name: payeeFilter || undefined,
    transacted_range: selectedRange,
    exclude_account_types: ["investment"], // Exclude investment accounts from transaction page
    sort_by: sortBy,
    sort_order: sortOrder,
  })

  // Fetch summary statistics from the server (not paginated)
  const {
    data: summaryData,
  } = useTransactionsSummary({
    account_ids: selectedAccountIds,
    excluded_account_ids: excludedAccountIds,
    category_ids: selectedCategoryIds,
    excluded_category_ids: excludedCategoryIds,
    payee_name: payeeFilter || undefined,
    transacted_range: selectedRange,
    exclude_account_types: ["investment"],
  })

  // Flatten all pages into a single array
  const allTransactions = React.useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flat();
  }, [data]);

  // Filter transactions by type (income/expense/all) - for display only
  const filteredData = React.useMemo(() => {
    if (!allTransactions || transactionType === "all") return allTransactions;

    return allTransactions.filter((txn: TransactionUI) => {
      const amount = parseFloat(txn.amount);
      if (transactionType === "income") {
        return amount > 0;
      } else if (transactionType === "expense") {
        return amount < 0;
      }
      return true;
    });
  }, [allTransactions, transactionType]);

  // Get summary statistics from server - this reflects ALL matching transactions, not just the loaded page
  const summary = React.useMemo(() => {
    if (!summaryData) {
      return { totalIncome: 0, totalExpense: 0, net: 0, count: 0 };
    }

    // Filter summary based on transaction type if needed
    if (transactionType === "income") {
      return {
        totalIncome: summaryData.total_income,
        totalExpense: 0,
        net: summaryData.total_income,
        count: summaryData.count, // Note: count is approximate when filtered by type
      };
    } else if (transactionType === "expense") {
      return {
        totalIncome: 0,
        totalExpense: summaryData.total_expense,
        net: -summaryData.total_expense,
        count: summaryData.count, // Note: count is approximate when filtered by type
      };
    }

    return {
      totalIncome: summaryData.total_income,
      totalExpense: summaryData.total_expense,
      net: summaryData.net,
      count: summaryData.count,
    };
  }, [summaryData, transactionType]);

  // Intersection observer ref for infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);

  // Set up intersection observer for auto-scroll detection
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Calculate net (income - expense)
  summary.net = summary.totalIncome - summary.totalExpense;
  const locale = 'en-US' // todo: make dynamic based on user preference
  const defaultDateRange = "3m" // default to last 3 months, make sure we dont query too much by default

  const handleSortChange = (value: string) => {
    const [field, order] = value.split("-") as [typeof sortBy, typeof sortOrder];
    setSortBy(field);
    setSortOrder(order);
  };

  const filterControls = (
    <>
      <AccountCombobox
        multiSelect
        selectedIds={selectedAccountIds}
        onChange={setSelectedAccountIds}
        excludedIds={excludedAccountIds}
        onExcludeChange={setExcludedAccountIds}
        excludeTypes={["investment"]}
      />
      <CategoryCombobox
        multiSelect
        selectedIds={selectedCategoryIds}
        onChange={setSelectedCategoryIds}
        excludedIds={excludedCategoryIds}
        onExcludeChange={setExcludedCategoryIds}
      />
      <div className="relative w-full sm:w-[250px]">
        <Input
          placeholder="Payee"
          value={payeeFilter}
          onChange={(e) => setPayeeFilter(e.target.value)}
          className="pr-8"
        />
        {payeeFilter && (
          <button
            onClick={() => setPayeeFilter("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear payee filter"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <TimeRangeSelector onUpdate={handleUpdate} showCustom defaultSelection={defaultDateRange} />

      <Select value={transactionType} onValueChange={(value) => setTransactionType(value as typeof transactionType)}>
        <SelectTrigger className="w-full sm:w-[250px] bg-background dark:bg-background hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="income">Income</SelectItem>
          <SelectItem value="expense">Expense</SelectItem>
        </SelectContent>
      </Select>

      <Select value={`${sortBy}-${sortOrder}`} onValueChange={handleSortChange}>
        <SelectTrigger className="w-full sm:w-[250px] bg-background dark:bg-background hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="transacted_at-desc">Date (Newest)</SelectItem>
          <SelectItem value="transacted_at-asc">Date (Oldest)</SelectItem>
          <SelectItem value="amount-desc">Amount (High-Low)</SelectItem>
          <SelectItem value="amount-asc">Amount (Low-High)</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  // Check if any filters are active
  const hasActiveFilters = selectedCategoryIds.length > 0 ||
                          excludedCategoryIds.length > 0 ||
                          selectedAccountIds.length > 0 ||
                          excludedAccountIds.length > 0 ||
                          payeeFilter !== "";

  const clearAllFilters = () => {
    setSelectedCategoryIds([]);
    setExcludedCategoryIds([]);
    setSelectedAccountIds([]);
    setExcludedAccountIds([]);
    setPayeeFilter("");
  };

  return (
    <MainLayout>
      <div className="p-4 w-full">
        {/* Collapsible filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="mb-4">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2">
                <Filter className="h-4 w-4" />
                <span>{filtersOpen ? 'Hide filters' : 'Show filters'}</span>
                {hasActiveFilters && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </button>
            </CollapsibleTrigger>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                Clear all
              </button>
            )}
          </div>
          <CollapsibleContent className="mt-2">
            <div className="flex flex-col md:flex-row md:flex-wrap gap-2">
              {filterControls}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Summary Section */}
        {filteredData && filteredData.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Summary
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">Income</div>
                <div className="text-lg sm:text-xl font-bold text-positive">
                  {formatCurrency(summary.totalIncome)}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">Expense</div>
                <div className="text-lg sm:text-xl font-bold text-negative">
                  {formatCurrency(summary.totalExpense)}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">Net</div>
                <div className={cn(
                  "text-lg sm:text-xl font-bold",
                  summary.net >= 0 ? "text-positive" : "text-negative"
                )}>
                  {summary.net >= 0 ? '' : '-'}{formatCurrency(Math.abs(summary.net))}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">Count</div>
                <div className="text-lg sm:text-xl font-bold">
                  {summary.count}
                </div>
              </div>
            </div>
          </div>
        )}

        <AsyncRenderer
          isLoading={isLoading}
          error={error}
          noData={isSuccess && (!filteredData || filteredData.length === 0) ? "No transactions found" : null}
          data={filteredData}
        >
          {(transactions) => (
            <>
              {/* Desktop/Tablet Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Payee</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Actions</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      let rowIndex = 0;
                      return transactions.map((txn) => {
                        const isSplit = txn.splits.length > 1;
                        const mainRowIndex = rowIndex++;

                        return (
                          <React.Fragment key={txn.id}>
                            {/* Main transaction row */}
                            <TableRow
                              className={mainRowIndex % 2 === 0 ? "bg-[var(--table-row-even)]" : "bg-[var(--table-row-odd)]"}
                            >
                              <TableCell>
                                {new Date(txn.transacted_at).toLocaleDateString(locale, {
                                  year: "2-digit",
                                  month: "numeric",
                                  day: "numeric",
                                })}
                              </TableCell>
                              <TableCell>{txn.accountName}</TableCell>
                              <TableCell>{txn.payeeName}</TableCell>
                              <TableCell>
                                {isSplit ? "" : (
                                  <InlineCategorySelector
                                    categoryName={txn.categoryName}
                                    categoryId={txn.splits[0]?.category_id ?? 0}
                                    onCategoryChange={(categoryId) =>
                                      handleCategoryChange(txn.id, categoryId, txn.amount)
                                    }
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <TransactionDetailsPopover
                                    transactionId={txn.id}
                                    description={txn.description}
                                    memo={txn.memo}
                                    onMemoUpdate={handleMemoUpdate}
                                  />
                                  <PayeeCategorySelector
                                    payeeId={txn.payee_id}
                                    payeeName={txn.payeeName}
                                    currentCategoryId={txn.payee?.category_id ?? null}
                                    currentCategoryName={txn.payee?.category?.name ?? ""}
                                  />
                                  <SplitTransactionDialog
                                    transaction={txn}
                                    onSave={(splits) => handleSaveSplits(txn.id, splits)}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className={cn("text-right font-medium", parseFloat(txn.amount) >= 0 ? "text-positive" : "text-negative")}>
                                {formatCurrency(Math.abs(parseFloat(txn.amount)))}
                              </TableCell>
                            </TableRow>

                            {/* Split rows - only show if there's more than 1 split */}
                            {isSplit &&
                              txn.splits.map((s) => {
                                const splitRowIndex = rowIndex++;
                                return (
                                  <TableRow
                                    key={`${txn.id}-${s.id}`}
                                    className={splitRowIndex % 2 === 0 ? "bg-[var(--table-row-even)]" : "bg-[var(--table-row-odd)]"}
                                  >
                                    <TableCell /> {/* empty date */}
                                    <TableCell /> {/* empty account */}
                                    <TableCell /> {/* empty payee */}
                                    <TableCell>{s.category?.name ?? "Uncategorized"}</TableCell>
                                    <TableCell /> {/* empty actions */}
                                    <TableCell className={cn("text-right font-medium", parseFloat(s.amount) >= 0 ? "text-positive" : "text-negative")}>
                                      {formatCurrency(Math.abs(parseFloat(s.amount)))}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-2">
                {transactions.map((txn: TransactionUI) => (
                  <TransactionMobileCard
                    key={txn.id}
                    txn={txn}
                    locale={locale}
                    onSaveSplits={(splits) => handleSaveSplits(txn.id, splits)}
                    onCategoryChange={(categoryId, amount) =>
                      handleCategoryChange(txn.id, categoryId, amount)
                    }
                    onMemoUpdate={handleMemoUpdate}
                    SplitTransactionDialog={SplitTransactionDialog}
                    InlineCategorySelector={InlineCategorySelector}
                    PayeeCategorySelector={PayeeCategorySelector}
                  />
                ))}
              </div>

              {/* Infinite scroll loading indicator / trigger */}
              <div ref={observerTarget} className="py-8 flex justify-center">
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading more transactions...</span>
                  </div>
                )}
                {!hasNextPage && transactions.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    No more transactions to load
                  </div>
                )}
              </div>
            </>
          )}
        </AsyncRenderer>
      </div>
    </MainLayout>
  )
}
