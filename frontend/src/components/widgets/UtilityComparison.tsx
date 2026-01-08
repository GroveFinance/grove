"use client"

import Widget from "@/components/widgets/Widget"
import { useQuery } from "@tanstack/react-query"
import { fetchJSON } from "@/services/api/base"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ComposedChart } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { useMemo } from "react"
import type { DateRange } from "react-day-picker"
import EmptyState from "@/components/ui/EmptyState"
import { formatCurrency } from "@/lib/utils"

interface UtilityDataPoint {
  category: string
  month?: string
  amount?: number
  this_year?: number
  last_year?: number
}

interface UtilityComparisonProps {
  mode?: "monthly" | "period_comparison"
  title?: string
  dateRange?: DateRange
}

export default function UtilityComparison({
  mode = "period_comparison",
  title = "Utility Spending",
  dateRange,
}: UtilityComparisonProps) {
  // Calculate date ranges - current period and same period last year
  const { currentStart, currentEnd, lastYearStart, lastYearEnd, periodLabel } = useMemo(() => {
    const now = new Date()

    // If dateRange provided, use it; otherwise default to current month
    let rangeStart = dateRange?.from || new Date(now.getFullYear(), now.getMonth(), 1)
    let rangeEnd = dateRange?.to || new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // Normalize current period dates to full month boundaries
    // Get the year/month from the dates in local time
    const startYear = rangeStart.getFullYear()
    const startMonth = rangeStart.getMonth()
    const endYear = rangeEnd.getFullYear()
    const endMonth = rangeEnd.getMonth()

    // Use UTC methods to avoid timezone conversion issues
    // Set rangeStart to beginning of its month in UTC (00:00:00)
    rangeStart = new Date(Date.UTC(startYear, startMonth, 1, 0, 0, 0, 0))
    // Set rangeEnd to last millisecond of its month in UTC (23:59:59.999)
    rangeEnd = new Date(Date.UTC(endYear, endMonth + 1, 0, 23, 59, 59, 999))

    // Create last year's range using the same months, but from the previous year
    // Start at beginning of month in UTC (00:00:00)
    const lastYearStart = new Date(Date.UTC(startYear - 1, startMonth, 1, 0, 0, 0, 0))
    // End at last millisecond of the month in UTC (23:59:59.999)
    const lastYearEnd = new Date(Date.UTC(endYear - 1, endMonth + 1, 0, 23, 59, 59, 999))

    // Create period label for the chart using the year/month we extracted in local time
    const monthName = new Date(startYear, startMonth, 1).toLocaleDateString('en-US', { month: 'short' })
    const thisYear = startYear
    const lastYear = startYear - 1

    return {
      currentStart: rangeStart,
      currentEnd: rangeEnd,
      lastYearStart,
      lastYearEnd,
      periodLabel: { thisYear: `${monthName} ${thisYear}`, lastYear: `${monthName} ${lastYear}` }
    }
  }, [dateRange])

  // Fetch data for current period
  const currentPeriodQuery = useQuery({
    queryKey: ["utilities", "current", currentStart.toISOString(), currentEnd.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        report_type: "utilities",
        mode: "monthly",
        start: currentStart.toISOString(),
        end: currentEnd.toISOString(),
      })
      return fetchJSON<{ data: UtilityDataPoint[] }>(`/report/?${params}`)
    },
  })

  // Fetch data for same period last year
  const lastYearQuery = useQuery({
    queryKey: ["utilities", "lastYear", lastYearStart.toISOString(), lastYearEnd.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        report_type: "utilities",
        mode: "monthly",
        start: lastYearStart.toISOString(),
        end: lastYearEnd.toISOString(),
      })
      return fetchJSON<{ data: UtilityDataPoint[] }>(`/report/?${params}`)
    },
  })

  // Combine the data for comparison
  const combinedData = useMemo(() => {
    // Return empty only if BOTH queries haven't loaded yet
    if (!currentPeriodQuery.data?.data && !lastYearQuery.data?.data) return []

    const dataMap: { [category: string]: { category: string; this_period: number; last_year: number } } = {}

    // Add current period data
    ;(currentPeriodQuery.data?.data ?? []).forEach((item) => {
      if (!dataMap[item.category]) {
        dataMap[item.category] = { category: item.category, this_period: 0, last_year: 0 }
      }
      dataMap[item.category].this_period += item.amount || 0
    })

    // Add last year data
    ;(lastYearQuery.data?.data ?? []).forEach((item) => {
      if (!dataMap[item.category]) {
        dataMap[item.category] = { category: item.category, this_period: 0, last_year: 0 }
      }
      dataMap[item.category].last_year += item.amount || 0
    })

    // Sort by whichever period has more spending (prioritize current period)
    return Object.values(dataMap).sort((a, b) => {
      const aTotal = a.this_period || a.last_year
      const bTotal = b.this_period || b.last_year
      return bTotal - aTotal
    })
  }, [currentPeriodQuery.data, lastYearQuery.data])

  // Check if last year has any non-zero data
  const hasLastYearData = useMemo(() => {
    return combinedData.some((item) => item.last_year > 0)
  }, [combinedData])

  const chartConfig = {
    this_period: {
      label: periodLabel.thisYear,
      color: "var(--primary)",
    },
    last_year: {
      label: periodLabel.lastYear,
      color: "var(--destructive)",
    },
  }

  const renderChart = () => {
    const isLoading = currentPeriodQuery.isLoading || lastYearQuery.isLoading
    const error = currentPeriodQuery.error || lastYearQuery.error

    if (isLoading) return <div className="text-muted-foreground">Loading...</div>
    if (error) return <div className="text-destructive">Error loading data</div>
    if (combinedData.length === 0)
      return <EmptyState dateRange={dateRange} type="spending" />

    if (mode === "period_comparison") {
      // Calculate the max value across both periods to set proper axis domain
      const maxValue = Math.max(...combinedData.map(d => Math.max(d.this_period, d.last_year)))

      return (
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ComposedChart
            data={combinedData}
            layout="vertical"
            margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              type="number"
              domain={[0, maxValue]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
            />
            <YAxis
              type="category"
              dataKey="category"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={120}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null

                const data = payload[0].payload

                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="font-semibold mb-1">{data.category}</div>
                    <div className="text-xs space-y-0.5">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{periodLabel.thisYear}:</span>
                        <span className="font-medium">{formatCurrency(data.this_period)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{periodLabel.lastYear}:</span>
                        <span className="font-medium">{formatCurrency(data.last_year)}</span>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            <ChartLegend content={<ChartLegendContent />} wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
            <Bar
              dataKey="this_period"
              fill="var(--primary)"
              radius={[0, 4, 4, 0]}
              shape={(props: any) => {
                const { x, y, width, height, payload, background } = props
                const lastYearValue = payload.last_year

                // Calculate x position for last year marker if it exists
                const hasLastYear = hasLastYearData && lastYearValue > 0

                // Calculate the scale based on the background width (full chart width)
                // The background represents the full available width for the max value
                let lastYearX = x
                if (hasLastYear && background) {
                  // Get the max value across all data
                  const maxValue = Math.max(...combinedData.map(d => Math.max(d.this_period, d.last_year)))

                  // Calculate the scale: pixels per dollar
                  const chartWidth = background.width
                  const scale = chartWidth / maxValue

                  // Position the line at the correct pixel position
                  lastYearX = background.x + (lastYearValue * scale)
                }

                return (
                  <g>
                    {/* Main bar */}
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill="var(--primary)"
                      rx={4}
                    />
                    {/* Last year marker - vertical line */}
                    {hasLastYear && (
                      <line
                        x1={lastYearX}
                        y1={y}
                        x2={lastYearX}
                        y2={y + height}
                        stroke="var(--destructive)"
                        strokeWidth={3}
                        opacity={0.9}
                      />
                    )}
                  </g>
                )
              }}
            />
            {/* Hidden bar just for legend - only show if we have last year data */}
            {hasLastYearData && (
              <Bar
                dataKey="last_year"
                fill="var(--destructive)"
                hide={true}
              />
            )}
          </ComposedChart>
        </ChartContainer>
      )
    } else {
      // Monthly mode - show trends over multiple months
      const currentData = currentPeriodQuery.data?.data || []

      if (currentData.length === 0) {
        return <EmptyState dateRange={dateRange} type="spending" />
      }

      // Group by month, with each category as a separate bar
      const monthlyData: { [month: string]: any } = {}
      currentData.forEach((item) => {
        if (!item.month) return
        if (!monthlyData[item.month]) {
          monthlyData[item.month] = { month: item.month }
        }
        monthlyData[item.month][item.category] = item.amount
      })

      const chartData = Object.values(monthlyData).sort((a, b) =>
        a.month.localeCompare(b.month)
      )

      // Get unique categories for the chart config
      const categories = [...new Set((currentData ?? []).map((d) => d.category))]
      const colors = [
        "hsl(var(--chart-1))",
        "hsl(var(--chart-2))",
        "hsl(var(--chart-3))",
        "hsl(var(--chart-4))",
        "hsl(var(--chart-5))",
      ]
      const monthlyChartConfig = (categories ?? []).reduce((acc, cat, idx) => {
        acc[cat] = {
          label: cat,
          color: colors[idx % colors.length],
        }
        return acc
      }, {} as any)

      return (
        <ChartContainer config={monthlyChartConfig} className="min-h-[300px] w-full">
          <BarChart data={chartData} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                const [year, month] = value.split("-")
                return `${month}/${year.slice(2)}`
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    formatCurrency(Number(value))
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {categories.map((category) => (
              <Bar
                key={category}
                dataKey={category}
                fill={`var(--color-${category})`}
                radius={[4, 4, 0, 0]}
                stackId="a"
              />
            ))}
          </BarChart>
        </ChartContainer>
      )
    }
  }

  return (
    <Widget title={title}>
      {renderChart()}
    </Widget>
  )
}
