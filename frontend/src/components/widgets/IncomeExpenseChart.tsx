"use client"

import { useMemo } from "react"
import { Bar, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ComposedChart } from "recharts"
import Widget from "@/components/widgets/Widget"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { useIncomeVsExpenses } from "@/hooks/queries/reports"
import { useGroups } from "@/hooks/queries/useGroups"
import type { IncomeExpenseDataPoint, ReportOut } from "@/types/api-types"
import type { DateRange } from "react-day-picker"
import { format, endOfMonth, startOfDay, endOfDay } from "date-fns"
import { useNavigate } from "react-router-dom"
import EmptyState from "@/components/ui/EmptyState"

interface IncomeExpenseChartProps {
  dateRange?: DateRange
  title?: string
}

export default function IncomeExpenseChart({
  title = "Income vs Expenses",
  dateRange,
}: IncomeExpenseChartProps) {
  const navigate = useNavigate()
  const { data: groups } = useGroups()
  const query = useIncomeVsExpenses({
    dateRange,
  })

  // Get transfer category IDs to exclude (matches report filter)
  const transferCategoryIds = useMemo(() => {
    if (!groups) return []
    const ids: number[] = []
    for (const group of groups) {
      for (const category of group.categories) {
        const name = category.name.toLowerCase()
        if (name === "transfer" || name === "credit card payment") {
          ids.push(category.id)
        }
      }
    }
    return ids
  }, [groups])

  const handleBarClick = (data: any) => {
    if (data && data.month) {
      // Parse the YYYY-MM format to get the month
      const [year, month] = data.month.split('-').map(Number);

      // Create date for the first day of the month at 00:00:00
      const firstDay = startOfDay(new Date(year, month - 1, 1));
      // Get last day of the month at 23:59:59
      const lastDay = endOfDay(endOfMonth(firstDay));

      // Format dates as ISO strings
      const fromDate = format(firstDay, "yyyy-MM-dd")
      const toDate = format(lastDay, "yyyy-MM-dd")

      // Navigate to transactions page with date range
      // Exclude transfer categories to match report filter
      // (investment accounts are excluded by default on TransactionsPage)
      const params = new URLSearchParams({
        transacted_start: fromDate,
        transacted_end: toDate,
      });
      if (transferCategoryIds.length > 0) {
        params.append('excluded_category_ids', transferCategoryIds.join(','));
      }
      navigate(`/transactions?${params.toString()}`)
    }
  }

  return (
    <Widget title={title} data={query.data}>
      {(data: ReportOut | undefined) => {
        if (query.isLoading) return <div>Loading...</div>
        if (query.error || !data?.data.length)
          return <EmptyState dateRange={dateRange} type="transactions" />

        // Transform data - keep income and expense in same data point
        const rawData = data.data as unknown as IncomeExpenseDataPoint[]

        const chartData = rawData.map((row) => {
          // Parse YYYY-MM format safely without timezone issues
          // Split the month string and create date in local timezone
          const [year, month] = row.month.split('-').map(Number);
          const date = new Date(year, month - 1, 15); // Use mid-month to avoid timezone edge cases

          return {
            month: row.month,
            monthLabel: format(date, "MMM"),
            income: row.income,
            expenses: -row.expenses, // Negative for display below axis
            net: row.net,
          };
        })

        const chartConfig: ChartConfig = {
          income: {
            label: "Income",
            color: "var(--chart-1)",
          },
          expenses: {
            label: "Expenses",
            color: "var(--destructive)",
          },
          net: {
            label: "Net Savings",
            color: "var(--foreground)",
          },
        }

        // Calculate max values for Y-axis domain
        // Use separate max for income (positive) and expenses (negative) for a tighter fit
        const maxIncome = Math.max(...chartData.map((d) => d.income))
        const maxExpense = Math.max(...chartData.map((d) => Math.abs(d.expenses)))
        const yDomain = [-maxExpense * 1.1, maxIncome * 1.1]

        return (
          <ChartContainer
            config={chartConfig}
            className="w-full h-full min-h-[300px]"
          >
            <ComposedChart data={chartData} stackOffset="sign">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) =>
                  value === 0
                    ? '$0'
                    : `$${Math.abs(value).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}`
                }
                domain={yDomain}
                ticks={[
                  -Math.ceil(maxExpense / 5000) * 5000,
                  -Math.ceil(maxExpense / 10000) * 5000,
                  0,
                  Math.ceil(maxIncome / 10000) * 5000,
                  Math.ceil(maxIncome / 5000) * 5000,
                ]}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      // Use absolute value for income/expenses, but preserve sign for net savings
                      const displayValue = name === "net" ? Number(value) : Math.abs(Number(value))
                      const label =
                        name === "expenses"
                          ? "Expenses"
                          : name === "income"
                          ? "Income"
                          : "Net Savings"
                      return [
                        displayValue.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        }),
                        " ",
                        label,
                      ]
                    }}
                  />
                }
              />
              <ReferenceLine y={0} stroke="var(--border)" strokeWidth={2} />

              {/* Income and expense bars with sign-based stacking */}
              <Bar
                dataKey="income"
                stackId="stack"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                onClick={handleBarClick}
                cursor="pointer"
              />
              <Bar
                dataKey="expenses"
                stackId="stack"
                fill="var(--destructive)"
                radius={[4, 4, 0, 0]}
                onClick={handleBarClick}
                cursor="pointer"
              />

              {/* Net savings line */}
              <Line
                //type="monotone"
                dataKey="net"
                stroke="var(--foreground)"
                strokeWidth={2}
                dot={{ r: 2, fill: "var(--foreground)" }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ChartContainer>
        )
      }}
    </Widget>
  )
}
