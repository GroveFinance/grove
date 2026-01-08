import { MainLayout } from "@/layouts/MainLayout";
import { useState, useMemo } from "react";
import { subMonths, startOfDay, endOfDay, startOfMonth, eachMonthOfInterval, differenceInDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import TimeRangeSelector from "@/components/ui/TimeRangeSelector";
import MealCalendar from "@/components/MealCalendar";
import { useTransactions } from "@/hooks/queries/useTransactions";
import { useGroups } from "@/hooks/queries/useGroups";
import { AsyncRenderer } from "@/components/ui/AsyncRenderer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function RestaurantsPage() {
  // Default to last 3 months
  const defaultDateRange: DateRange = {
    from: startOfDay(subMonths(new Date(), 3)),
    to: endOfDay(new Date()),
  };

  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(defaultDateRange);

  const handleUpdate = (dateRange: DateRange | undefined, _byMonthMode: boolean) => {
    setSelectedRange(dateRange);
  };

  // Get the Restaurant category ID
  const { data: groups } = useGroups();
  const restaurantCategoryId = useMemo(() => {
    if (!groups) return null;
    const flatCategories = groups.flatMap((g) => g.categories);
    const restaurantCategory = flatCategories.find((c) => c.name.toLowerCase().includes('restaurant'));
    return restaurantCategory?.id || null;
  }, [groups]);

  // Fetch transactions with restaurant category and date filters
  const { data: transactions, isLoading, error } = useTransactions({
    category_ids: restaurantCategoryId ? [restaurantCategoryId] : [],
    transacted_range: selectedRange,
  });

  // Calculate all months to display based on the selected range
  const monthsToDisplay = useMemo(() => {
    if (!selectedRange?.from || !selectedRange?.to) {
      return [new Date()];
    }

    // Get all months in the selected range
    const months = eachMonthOfInterval({
      start: startOfMonth(selectedRange.from),
      end: startOfMonth(selectedRange.to),
    });

    // Reverse to show newest first
    return months.reverse();
  }, [selectedRange]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (!transactions || !selectedRange?.from || !selectedRange?.to) {
      return { timesEatingOut: 0, totalDays: 0, percentage: 0, totalSpent: 0 };
    }

    const timesEatingOut = transactions.length;
    const totalDays = differenceInDays(selectedRange.to, selectedRange.from) + 1;
    const mealOpportunities = totalDays * 2; // Lunch and dinner
    const percentage = mealOpportunities > 0 ? (timesEatingOut / mealOpportunities) * 100 : 0;
    const totalSpent = Math.abs((transactions ?? []).reduce((sum, txn) => sum + parseFloat(txn.amount), 0));

    return { timesEatingOut, totalDays, percentage, totalSpent };
  }, [transactions, selectedRange]);

  return (
    <MainLayout title="Restaurant Trends">
      <div className="p-6 space-y-6">
        {/* Time Range Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Time Range</label>
            <TimeRangeSelector
              onUpdate={handleUpdate}
              showCustom
              defaultSelection="3m"
            />
          </div>
        </div>

        {/* Summary Statistics */}
        {!isLoading && transactions && transactions.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-4 border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">
                  {stats.timesEatingOut} / {stats.totalDays} days
                </h3>
                <span className="text-2xl font-bold text-primary">
                  {stats.percentage.toFixed(1)}%
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Percentage calculated assuming 2 meal opportunities per day (lunch & dinner)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.timesEatingOut} meals / ({stats.totalDays} days × 2) = {stats.percentage.toFixed(1)}%
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-lg font-semibold">
                Total: {formatCurrency(stats.totalSpent)}
              </div>
            </div>
          </div>
        )}

        {/* Calendars - show one for each month in the range */}
        <AsyncRenderer
          isLoading={isLoading}
          error={error}
          noData={!isLoading && (!transactions || transactions.length === 0) ? "No restaurant transactions found for the selected filters" : null}
          data={transactions}
        >
          {(txns) => (
            <div className="mt-6 space-y-8">
              {monthsToDisplay.map((month, idx) => (
                <MealCalendar key={idx} transactions={txns} month={month} />
              ))}
            </div>
          )}
        </AsyncRenderer>
      </div>
    </MainLayout>
  );
}
