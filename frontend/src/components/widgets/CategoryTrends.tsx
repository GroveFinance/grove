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
        if (query.error || !data?.data?.length)
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

        const handleClick = (entry: Record<string, unknown>) => {
          if (entry?.categoryId === undefined || entry.categoryId === null) return;

          const categoryId = entry.categoryId as number;
          const params = new URLSearchParams();

          // Add date range if provided
          if (dateRange?.from) {
            params.append('transacted_start', dateRange.from.toISOString());
          }
          if (dateRange?.to) {
            params.append('transacted_end', dateRange.to.toISOString());
          }

          if (categoryId === -1) {
            // "Other" category - exclude all the categories shown in the chart
            const shownCategoryIds = chartData
              .filter(item => item.categoryId !== -1)
              .map(item => item.categoryId);

            if (shownCategoryIds.length > 0) {
              params.append('exclude_category_ids', shownCategoryIds.join(','));
            }
          } else {
            // Regular category - filter to show only this category
            params.append('category_id', categoryId.toString());
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
                  formatter={(value: number, _name: string, props) => {
                    const percent = ((value / totalSpent) * 100).toFixed(0);
                    const amount = value.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    });
                    return [`${props.payload.category} - ${percent}% • ${amount}`];
                  }}
                />
                <Pie
                  data={chartData}
                  dataKey="total"
                  nameKey="category"
                  innerRadius="45%"
                  outerRadius="70%"
                  strokeWidth={2}
                  label={({ cx, cy, midAngle, outerRadius, innerRadius, payload }) => {
                    const categoryName = payload.category;
                    const percent = ((payload.total / totalSpent) * 100).toFixed(0);
                    const showPercentInside = (payload.total / totalSpent) * 100 >= 8;

                    const RADIAN = Math.PI / 180;

                    // Outer label (category name)
                    const outerLabelRadius = outerRadius * 1.08;
                    const outerX = cx + outerLabelRadius * Math.cos(-midAngle * RADIAN);
                    const outerY = cy + outerLabelRadius * Math.sin(-midAngle * RADIAN);

                    // Inner label (percentage) - positioned at midpoint between inner and outer radius
                    const innerLabelRadius = (innerRadius + outerRadius) / 2;
                    const innerX = cx + innerLabelRadius * Math.cos(-midAngle * RADIAN);
                    const innerY = cy + innerLabelRadius * Math.sin(-midAngle * RADIAN);

                    return (
                      <g>
                        {/* Outer label - category name */}
                        <text
                          x={outerX}
                          y={outerY}
                          fill="var(--foreground)"
                          textAnchor={outerX > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          className="text-xs font-medium"
                        >
                          {categoryName}
                        </text>
                        {/* Inner label - percentage (only if >= 8%) */}
                        {showPercentInside && (
                          <text
                            x={innerX}
                            y={innerY}
                            fill="var(--background)"
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="text-xs font-bold"
                          >
                            {percent}%
                          </text>
                        )}
                      </g>
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
            {/* Compact legend with percentages and amounts */}
            <div className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-1 text-xs flex-shrink-0">
              {chartDataWithPercent.map((item, index) => (
                <div
                  key={`${item.categoryId}-${index}`}
                  className="flex items-center gap-1 cursor-pointer hover:opacity-80 min-w-0"
                  onClick={() => handleClick(item)}
                >
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.fill }} />
                  <span className="truncate flex-1">{item.category}</span>
                  <span className="text-muted-foreground flex-shrink-0">
                    {item.percent.toFixed(0)}% • ${item.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      }}
    </Widget>
  )
}
