import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay, addDays } from "date-fns";
import type { Transaction } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Utensils } from "lucide-react";

interface MealCalendarProps {
  transactions: Transaction[];
  month: Date;
}

interface TransactionDetail {
  id: string;
  payee: string;
  amount: string;
  time: string;
}

interface DayData {
  date: Date;
  count: number;
  transactions: TransactionDetail[];
  isCurrentMonth: boolean;
}


export default function MealCalendar({ transactions, month }: MealCalendarProps) {
  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Group transactions by date
    const transactionsByDate = new Map<string, {
      count: number;
      transactions: TransactionDetail[];
    }>();

    transactions.forEach((txn) => {
      if (!txn.transacted_at) return;

      // Parse the ISO string - this will convert from UTC to local timezone
      const txnDate = new Date(txn.transacted_at);
      const utcDate = new Date(txn.transacted_at);

      // Get UTC hour to detect date-only transactions
      const utcHour = utcDate.getUTCHours();
      const utcMinute = utcDate.getUTCMinutes();
      const utcSecond = utcDate.getUTCSeconds();

      // Check if this is a date-only transaction (SimpleFin sets these to noon UTC)
      const isDateOnly = utcHour === 12 && utcMinute === 0 && utcSecond === 0;

      // Use UTC date for date-only transactions to avoid timezone shifts
      let year, month, day;
      if (isDateOnly) {
        year = utcDate.getUTCFullYear();
        month = utcDate.getUTCMonth() + 1;
        day = utcDate.getUTCDate();
      } else {
        // For transactions with actual times, use local timezone
        year = txnDate.getFullYear();
        month = txnDate.getMonth() + 1;
        day = txnDate.getDate();
      }

      // Format as YYYY-MM-DD
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      if (!transactionsByDate.has(dateKey)) {
        transactionsByDate.set(dateKey, {
          count: 0,
          transactions: []
        });
      }

      const dayData = transactionsByDate.get(dateKey)!;

      // Create transaction detail
      const detail: TransactionDetail = {
        id: txn.id,
        payee: txn.payee?.name || 'Unknown',
        amount: txn.amount,
        time: isDateOnly ? '' : txnDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      };

      dayData.count++;
      dayData.transactions.push(detail);
    });

    // Build calendar grid
    const dayData: DayData[] = daysInMonth.map((date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const dayTransactions = transactionsByDate.get(dateKey) || {
        count: 0,
        transactions: []
      };

      return {
        date,
        count: dayTransactions.count,
        transactions: dayTransactions.transactions,
        isCurrentMonth: isSameMonth(date, month),
      };
    });

    // Add padding days for the calendar grid
    const firstDayOfWeek = getDay(monthStart);
    const paddingDays: DayData[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      const paddingDate = addDays(monthStart, -(firstDayOfWeek - i));
      paddingDays.push({
        date: paddingDate,
        count: 0,
        transactions: [],
        isCurrentMonth: false,
      });
    }

    return [...paddingDays, ...dayData];
  }, [transactions, month]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">
          {format(month, "MMMM yyyy")}
        </h2>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-muted">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-medium border-b"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {calendarData.map((dayData, idx) => {
            const hasTransactions = dayData.count > 0;

            return (
              <Popover key={idx}>
                <PopoverTrigger asChild>
                  <div
                    className={`
                      min-h-[80px] p-2 border-b border-r relative
                      ${!dayData.isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""}
                      ${hasTransactions ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}
                    `}
                  >
                    {/* Day number */}
                    <div className="text-sm font-medium mb-2">
                      {format(dayData.date, "d")}
                    </div>

                    {/* Utensils icons */}
                    {hasTransactions && (
                      <div className="flex flex-wrap gap-1.5 items-center justify-center">
                        {Array.from({ length: Math.min(dayData.count, 12) }).map((_, i) => {
                          const colorIndex = (i % 12) + 1;
                          return (
                            <Utensils
                              key={i}
                              className="h-5 w-5"
                              style={{ color: `var(--chart-${colorIndex})` }}
                              strokeWidth={2.5}
                            />
                          );
                        })}
                        {dayData.count > 12 && (
                          <span className="text-xs font-semibold text-[var(--chart-1)]">
                            +{dayData.count - 12}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </PopoverTrigger>
                {hasTransactions && (
                  <PopoverContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">
                        Transactions ({dayData.count})
                      </h4>
                      <div className="space-y-2">
                        {dayData.transactions.map((txn) => (
                          <div key={txn.id} className="flex justify-between items-start text-sm border-b pb-2 last:border-b-0">
                            <div className="flex-1">
                              <div className="font-medium">{txn.payee}</div>
                              {txn.time && (
                                <div className="text-xs text-muted-foreground">{txn.time}</div>
                              )}
                            </div>
                            <div className="font-semibold">${txn.amount}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            );
          })}
        </div>
      </div>
    </div>
  );
}
