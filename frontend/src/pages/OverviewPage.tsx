import { useState, useMemo } from "react"
import { WidthProvider, Responsive } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import { MainLayout } from "@/layouts/MainLayout"
import { subMonths, startOfMonth, endOfDay, lastDayOfMonth } from "date-fns"

import MonthSelector from "@/components/ui/MonthSelector"
import type { DateRange } from "react-day-picker";

import AccountSummary from "@/components/widgets/AccountSummary"
import CategoryTrendsWidget from "@/components/widgets/CategoryTrends"
import BudgetUsageWidget from "@/components/widgets/BudgetUsage"
import TopTransactionsWidget from "@/components/widgets/TopTransactions"
import UtilityComparison from "@/components/widgets/UtilityComparison"
import IncomeExpenseChart from "@/components/widgets/IncomeExpenseChart"
import NetWorthChart from "@/components/widgets/NetWorthChart"
import UpcomingBills from "@/components/widgets/UpcomingBills"
import PaycheckAnalysis from "@/components/widgets/PaycheckAnalysis"

const ResponsiveGridLayout = WidthProvider(Responsive)

export default function OverviewPage() {
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined);

  const handleUpdate = (dateRange: DateRange | undefined) => {
    setSelectedRange(dateRange);
  };

  // Single month range - for category trends, budget usage, top transactions, utilities
  const singleMonthRange = useMemo(() => {
    if (!selectedRange?.to) {
      // Fallback to current month if no selection yet
      const today = new Date();
      return {
        from: startOfMonth(today),
        to: endOfDay(lastDayOfMonth(today)),
      };
    }

    const selectedMonthEnd = selectedRange.to;
    return {
      from: startOfMonth(selectedMonthEnd), // Start of selected month
      to: endOfDay(lastDayOfMonth(selectedMonthEnd)), // End of selected month
    };
  }, [selectedRange]);

  // Multi-month range - for income/expense and net worth trend charts (6 months)
  const multiMonthRange = useMemo(() => {
    if (!selectedRange?.to) {
      // Fallback to current month + 5 prior if no selection yet
      const today = new Date();
      return {
        from: startOfMonth(subMonths(today, 5)),
        to: endOfDay(lastDayOfMonth(today)),
      };
    }

    const selectedMonthEnd = selectedRange.to;
    return {
      from: startOfMonth(subMonths(selectedMonthEnd, 5)), // 5 months before selected month
      to: endOfDay(lastDayOfMonth(selectedMonthEnd)), // End of selected month
    };
  }, [selectedRange]);

  const [layout, setLayout] = useState([
    {w: 12, h: 3, x: 0, y: 0, i: 'summary'},
    {w: 3, h: 4, x: 0, y: 3, i: 'categoryTrends'},
    {w: 3, h: 4, x: 3, y: 3, i: 'budgetUsage'},
    {w: 3, h: 4, x: 6, y: 3, i: 'upcomingBills'},
    {w: 3, h: 4, x: 9, y: 3, i: 'paycheckAnalysis'},
    {w: 6, h: 3, x: 0, y: 7, i: 'incomeVsExpense'},
    {w: 6, h: 3, x: 6, y: 7, i: 'networth'},
    {w: 6, h: 3, x: 0, y: 10, i: 'topTransactions'},
    {w: 6, h: 3, x: 6, y: 10, i: 'utilities'},
  ])

  return (
    <MainLayout title="Overview">
      <MonthSelector onUpdate={handleUpdate} />
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 2 }}
        rowHeight={120}
        onLayoutChange={(layout) => { setLayout(layout); }}
        isDraggable={false} //draggableHandle=".widget-drag-handle" -- IGNORE --
        isResizable={true}
      >
        <div className="h-full" key="summary"><AccountSummary title="Summary" /></div>
        <div className="h-full" key="categoryTrends"><CategoryTrendsWidget dateRange={singleMonthRange} /></div>
        <div className="h-full" key="budgetUsage"><BudgetUsageWidget title="Budget Usage" dateRange={singleMonthRange} /></div>
        <div className="h-full" key="upcomingBills"><UpcomingBills title="Upcoming Bills" lookforwardDays={30} /></div>
        <div className="h-full" key="paycheckAnalysis"><PaycheckAnalysis title="Paycheck Analysis" dateRange={multiMonthRange} limit={5} /></div>
        <div className="h-full" key="incomeVsExpense"><IncomeExpenseChart dateRange={multiMonthRange} title="Income vs Expenses" /></div>
        <div className="h-full" key="networth"><NetWorthChart dateRange={multiMonthRange} title="Net Worth" /></div>
        <div className="h-full" key="topTransactions"><TopTransactionsWidget dateRange={singleMonthRange} title="Top Transactions" /></div>
        <div className="h-full" key="utilities"><UtilityComparison mode="period_comparison" title="Utility Spending Comparison" dateRange={singleMonthRange} /></div>
      </ResponsiveGridLayout>
    </MainLayout>
  )
}

