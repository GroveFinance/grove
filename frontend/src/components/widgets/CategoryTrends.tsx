"use client"

import { Pie, PieChart, Cell, Label } from "recharts"
import Widget from "@/components/widgets/Widget"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { useCategoryTrends } from "@/hooks/queries/reports"
import type { MonthSeries, ReportOut } from "@/types/api-types"
import type { DateRange } from "react-day-picker";
import { useNavigate } from "react-router-dom";
import EmptyState from "@/components/ui/EmptyState";

interface CategoryTrendsWidgetProps {
  limit?: number
  mode?: "per_month" | "global"
  dateRange?: DateRange
  title?: string
}

export default function CategoryTrendsWidget({
  limit = 5,
  mode = "global",
  title = "Category Trends",
  dateRange
}: CategoryTrendsWidgetProps) {
  const navigate = useNavigate()
  const query = useCategoryTrends({
    dateRange: dateRange,
    limit,
    mode
  })

  return (
    <Widget title={title} data={query.data}>
      {(data: ReportOut | undefined) => {
        if (query.isLoading) return <div>Loading...</div>
        if (query.error || !data?.data.length)
          return <EmptyState dateRange={dateRange} type="spending" />

        const chartData = (data.data ?? []).map((row: MonthSeries, idx) => ({
          categoryId: row.category_id, // <--- pass along
          category: row.category ?? "Uncategorized",
          total: Math.abs(row.total),
          fill: `var(--chart-${(idx % 12) + 1})`,
        }))

        const totalSpent = (chartData ?? []).reduce((sum, row) => sum + row.total, 0)

        // Calculate percentages for legend
        const chartDataWithPercent = chartData.map(item => ({
          ...item,
          percent: (item.total / totalSpent) * 100
        }))
        const chartConfig: ChartConfig = {}
        chartData.forEach((row) => {
          chartConfig[row.category] = { label: row.category, color: row.fill }
        })

        const handleClick = (entry: any) => {
          if (entry?.categoryId === undefined) return;

          const params = new URLSearchParams();

          // Add date range if provided
          if (dateRange?.from) {
            params.append('transacted_start', dateRange.from.toISOString());
          }
          if (dateRange?.to) {
            params.append('transacted_end', dateRange.to.toISOString());
          }

          if (entry.categoryId === -1) {
            // "Other" category - exclude all the categories shown in the chart
            const shownCategoryIds = chartData
              .filter(item => item.categoryId !== -1)
              .map(item => item.categoryId);

            if (shownCategoryIds.length > 0) {
              params.append('exclude_category_ids', shownCategoryIds.join(','));
            }
          } else {
            // Regular category - filter to show only this category
            params.append('category_id', entry.categoryId.toString());
          }

          // Investment accounts are excluded by default on TransactionsPage
          navigate(`/transactions?${params.toString()}`);
        }

        return (
          <div className="flex flex-col h-full">
            <ChartContainer
              config={chartConfig}
              className="w-full flex-1 min-h-0 px-2 sm:px-4"
            >
              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <ChartTooltip
                  content={<ChartTooltipContent nameKey="total" hideLabel />}
                  formatter={(value: number, _name: string, props) => [
                    value.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }),
                    " - ",
                    props.payload.category,
                  ]}
                />
                <Pie
                  data={chartData}
                  dataKey="total"
                  nameKey="category"
                  innerRadius="45%"
                  outerRadius="70%"
                  strokeWidth={2}
                  label={({ cx, cy, midAngle, outerRadius, value }) => {
                    // Format dollar amount with compact notation for large values
                    const formatted = value > 9999
                      ? `$${(value / 1000).toFixed(0)}k`
                      : `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

                    // Position label closer to the pie - reduced from default distance
                    const RADIAN = Math.PI / 180;
                    const radius = outerRadius * 1.08; // Reduced from default ~1.2 to bring labels closer
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);

                    return (
                      <text
                        x={x}
                        y={y}
                        fill="var(--foreground)"
                        textAnchor={x > cx ? 'start' : 'end'}
                        dominantBaseline="central"
                        className="text-xs font-medium"
                      >
                        {formatted}
                      </text>
                    );
                  }}
                  labelLine={false}
                  onClick={handleClick}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill}
                      cursor="pointer"
                      onClick={() => handleClick(entry)}
                    />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) - 10}
                              className="fill-muted-foreground text-[10px] sm:text-xs"
                            >
                              Total
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 10}
                              className="fill-foreground text-sm sm:text-base font-bold"
                            >
                              ${totalSpent.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                                notation: totalSpent > 999999 ? "compact" : "standard"
                              })}
                            </tspan>
                          </text>
                        )
                      }
                      return null
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            {/* Compact legend with percentages */}
            <div className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-1 text-xs flex-shrink-0">
              {chartDataWithPercent.map((item, index) => (
                <div
                  key={`${item.categoryId}-${index}`}
                  className="flex items-center gap-1 cursor-pointer hover:opacity-80 min-w-0"
                  onClick={() => handleClick(item)}
                >
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.fill }} />
                  <span className="truncate flex-1">{item.category}</span>
                  <span className="text-muted-foreground flex-shrink-0">{item.percent.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )
      }}
    </Widget>
  )
}