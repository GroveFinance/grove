"use client"

import { Line, XAxis, YAxis, CartesianGrid, LineChart } from "recharts"
import { TrendingUp, TrendingDown } from "lucide-react"
import Widget from "@/components/widgets/Widget"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { useNetWorthHistory } from "@/hooks/queries/reports"
import type { NetWorthDataPoint, ReportOut } from "@/types/api-types"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface NetWorthChartProps {
  dateRange?: DateRange
  title?: string
}

export default function NetWorthChart({
  title = "Net Worth",
  dateRange,
}: NetWorthChartProps) {
  const query = useNetWorthHistory({
    dateRange,
  })

  // Calculate percentage change for header
  const headerActions = query.data && (query.data.data as unknown as NetWorthDataPoint[]).length >= 2 ? (
    (() => {
      const rawData = query.data.data as unknown as NetWorthDataPoint[]
      const firstValue = rawData[0].net_worth
      const lastValue = rawData[rawData.length - 1].net_worth
      const change = lastValue - firstValue
      const percentChange = firstValue !== 0 ? (change / firstValue) * 100 : 0
      const isPositive = percentChange >= 0

      return (
        <div className="flex items-center gap-1">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-positive" />
          ) : (
            <TrendingDown className="h-4 w-4 text-negative" />
          )}
          <span className={cn(
            "text-sm font-semibold",
            isPositive ? "text-positive" : "text-negative"
          )}>
            {isPositive ? "+" : ""}{percentChange.toFixed(1)}%
          </span>
        </div>
      )
    })()
  ) : null

  return (
    <Widget title={title} data={query.data} headerActions={headerActions}>
      {(data: ReportOut | undefined) => {
        if (query.isLoading) return <div>Loading...</div>
        if (query.error || !data?.data.length)
          return <div className="text-muted-foreground">No data</div>

        // Transform data
        const rawData = data.data as unknown as NetWorthDataPoint[]

        const chartData = rawData.map((row) => {
          // Parse YYYY-MM format safely without timezone issues
          const [year, month] = row.month.split('-').map(Number);
          const date = new Date(year, month - 1, 15); // Use mid-month to avoid timezone edge cases

          return {
            month: row.month,
            monthLabel: format(date, "MMM"),
            netWorth: row.net_worth,
          };
        })

        const chartConfig: ChartConfig = {
          netWorth: {
            label: "Net Worth",
            color: "var(--chart-2)",
          },
        }

        // Calculate min/max for Y-axis domain
        const values = chartData.map((d) => d.netWorth)
        const minValue = Math.min(...values)
        const maxValue = Math.max(...values)
        const range = maxValue - minValue
        const padding = range * 0.1 // 10% padding
        const yDomain = [minValue - padding, maxValue + padding]

        return (
          <ChartContainer
            config={chartConfig}
            className="w-full h-full min-h-[300px]"
          >
            <LineChart data={chartData}>
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
                  `$${value.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}`
                }
                domain={yDomain}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => {
                      return [
                        Number(value).toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                        }),
                        " ",
                        "Net Worth",
                      ]
                    }}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--chart-2)" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        )
      }}
    </Widget>
  )
}
