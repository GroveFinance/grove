"use client"

import Widget from "@/components/widgets/Widget"
import { useBudgetUsage } from "@/hooks/queries/reports"
import type { ReportOut, BudgetUsageDataPoint } from "@/types/api-types"
import { Progress } from "@/components/ui/progress"
import type { DateRange } from "react-day-picker"
import { useNavigate } from "react-router-dom"
import EmptyState from "@/components/ui/EmptyState"

interface BudgetUsageWidgetProps {
  mode?: "per_month" | "global"
  dateRange?: DateRange
  limit?: number
  title?: string
}

export default function BudgetUsageWidget({
  limit = 5,
  title = "Budget Usage",
  mode = "global",
  dateRange,
}: BudgetUsageWidgetProps) {
  const navigate = useNavigate()
  const query = useBudgetUsage({dateRange, limit, mode })

  const handleClick = (categoryId: number) => {
    const params = new URLSearchParams({
      category_id: categoryId.toString(),
    });

    // Add date range if provided
    if (dateRange?.from) {
      params.append('transacted_start', dateRange.from.toISOString());
    }
    if (dateRange?.to) {
      params.append('transacted_end', dateRange.to.toISOString());
    }

    // Investment accounts are excluded by default on TransactionsPage
    navigate(`/transactions?${params.toString()}`);
  }

  return (
    <Widget title={title} data={query.data}>
      {(data: ReportOut<BudgetUsageDataPoint> | undefined) => {
        if (query.isLoading) return <div>Loading...</div>
        if (query.error || !data?.data.length)
          return <EmptyState dateRange={dateRange} type="spending" />

        return (
          <div className="space-y-2.5">
            {data.data.map((row, idx: number) => {
              const spent = row.actual ?? 0
              const budget = row.budget ?? 0
              const remaining = budget - spent
              const percent = budget > 0 ? (spent / budget) * 100 : 0

              // color thresholds
              let barColor = "bg-green-500"
              if (percent >= 80 && percent <= 100) barColor = "bg-yellow-500"
              if (percent > 100) barColor = "bg-red-500"

              const isOver = spent > budget

              return (
                <div
                  key={idx}
                  onClick={() => handleClick(row.category_id)}
                  className="cursor-pointer hover:bg-muted/50 px-1.5 py-1 -mx-1.5 -my-1 rounded transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-0.5 text-xs font-medium">
                    <span className="truncate">{row.category ?? "Uncategorized"}</span>
                    <span
                      className={`ml-2 flex-shrink-0 ${
                        isOver ? "text-negative" : "text-muted-foreground"
                      }`}
                    >
                      {isOver
                        ? `-${Math.abs(remaining).toLocaleString(undefined, {
                            style: "currency",
                            currency: "USD",
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })} Over`
                        : `${remaining.toLocaleString(undefined, {
                            style: "currency",
                            currency: "USD",
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })} Left`}
                    </span>
                  </div>

                  {/* Progress bar with overlay text */}
                  <div className="relative">
                    <Progress value={Math.min(percent, 100)} className="h-5 bg-muted" />
                    <div
                      className={`absolute left-0 top-0 h-5 rounded transition-all ${barColor}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white">
                      {`${spent.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })} of ${budget.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }}
    </Widget>
  )
}
