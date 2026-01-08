"use client"

import Widget from "@/components/widgets/Widget"
import { usePaycheckAnalysis } from "@/hooks/queries/reports"
import type { ReportOut } from "@/types/api-types"
import type { DateRange } from "react-day-picker"
import { useNavigate } from "react-router-dom"
import { ArrowUpIcon, ArrowDownIcon, MinusIcon, AlertTriangleIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import EmptyState from "@/components/ui/EmptyState"
import { format } from "date-fns"

interface PaycheckAnalysisProps {
  dateRange?: DateRange
  title?: string
  limit?: number
}

interface PaycheckData {
  id: string
  date: string
  amount: number
  payee: string
  account: string
  description: string
}

interface PaycheckSummary {
  total_count: number
  average_amount: number
  median_amount: number
  std_deviation: number
  min_amount: number
  max_amount: number
  total_income: number
}

interface PayeeBreakdown {
  count: number
  average_amount: number
  std_deviation: number
  min_amount: number
  max_amount: number
  total_income: number
  trend: "increasing" | "decreasing" | "stable" | "insufficient_data"
  last_paycheck_date: string
}

interface Anomaly extends PaycheckData {
  deviation_sigma: number
  difference_from_avg: number
  expected_amount?: number
}

interface PaycheckAnalysisData {
  paychecks: PaycheckData[]
  summary: PaycheckSummary
  by_payee: Record<string, PayeeBreakdown>
  trend: "increasing" | "decreasing" | "stable" | "insufficient_data"
  anomalies: Anomaly[]
}

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === "increasing") {
    return <ArrowUpIcon className="h-4 w-4 text-positive" />
  }
  if (trend === "decreasing") {
    return <ArrowDownIcon className="h-4 w-4 text-destructive" />
  }
  if (trend === "stable") {
    return <MinusIcon className="h-4 w-4 text-muted-foreground" />
  }
  return null
}

export default function PaycheckAnalysis({
  title = "Paycheck Analysis",
  dateRange,
  limit = 5,
}: PaycheckAnalysisProps) {
  const navigate = useNavigate()
  const query = usePaycheckAnalysis({ dateRange })

  return (
    <Widget title={title} data={query.data}>
      {(data: ReportOut | undefined) => {
        if (query.isLoading) return <div>Loading...</div>
        if (query.error || !data?.data)
          return <EmptyState dateRange={dateRange} type="transactions" />

        // Data is wrapped in an array by the backend
        const analysisData = (data.data as unknown as PaycheckAnalysisData[])[0]

        if (analysisData.summary.total_count === 0) {
          return (
            <EmptyState
              dateRange={dateRange}
              type="transactions"
              message="No paycheck income found in this period"
            />
          )
        }

        const { summary, by_payee, trend, anomalies, paychecks } = analysisData
        const recentPaychecks = paychecks.slice(0, limit)

        return (
          <div className="space-y-3">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Average</p>
                <p className="text-lg font-semibold">
                  ${summary.average_amount.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Median</p>
                <p className="text-lg font-semibold">
                  ${summary.median_amount.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Std Dev</p>
                <p className="text-lg font-semibold">
                  ±${summary.std_deviation.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Trend
                  <TrendIcon trend={trend} />
                </p>
                <p className="text-lg font-semibold capitalize">{trend.replace("_", " ")}</p>
              </div>
            </div>

            {/* Anomalies Warning */}
            {anomalies.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2">
                <div className="flex items-start gap-2">
                  <AlertTriangleIcon className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-destructive">
                      {anomalies.length} Unusual Paycheck{anomalies.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {anomalies.map((a, idx) => (
                        <span key={a.id}>
                          {format(new Date(a.date), "MMM d")}: ${a.amount.toLocaleString()}
                          {a.expected_amount ? ` (exp: $${a.expected_amount.toLocaleString()})` : ` (${a.difference_from_avg > 0 ? "+" : ""}$${Math.abs(a.difference_from_avg).toLocaleString()})`}
                          {idx < anomalies.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* By Payee Breakdown - hide if only one employer to save space */}
            {Object.keys(by_payee).length > 1 && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium">By Employer</h4>
                <div className="space-y-1">
                  {Object.entries(by_payee).map(([payee, stats]) => (
                    <div
                      key={payee}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded"
                    >
                      <div>
                        <p className="text-sm font-medium">{payee}</p>
                        <p className="text-xs text-muted-foreground">
                          {stats.count} checks • {format(new Date(stats.last_paycheck_date), "MMM d")}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <p className="text-sm font-semibold">
                            ${stats.average_amount.toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </p>
                          <TrendIcon trend={stats.trend} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Paychecks */}
            <div className="space-y-1">
              <h4 className="text-xs font-medium">Recent Paychecks</h4>
              <div className="space-y-0.5">
                {recentPaychecks.map((paycheck) => {
                  const isAnomaly = anomalies.some((a) => a.id === paycheck.id)

                  return (
                    <div
                      key={paycheck.id}
                      className={cn(
                        "flex items-center justify-between p-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors",
                        isAnomaly && "bg-destructive/5"
                      )}
                      onClick={() => {
                        const params = new URLSearchParams({
                          id: paycheck.id,
                        })
                        if (dateRange?.from) {
                          params.append("transacted_start", dateRange.from.toISOString())
                        }
                        if (dateRange?.to) {
                          params.append("transacted_end", dateRange.to.toISOString())
                        }
                        navigate(`/transactions?${params.toString()}`)
                      }}
                    >
                      <div>
                        <p className="text-xs font-medium">
                          {format(new Date(paycheck.date), "MMM d")}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {paycheck.payee}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-sm font-semibold",
                          isAnomaly && "text-destructive"
                        )}>
                          ${paycheck.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
              {paychecks.length > limit && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams({
                      category_ids: "51", // Paycheck category
                    })
                    if (dateRange?.from) {
                      params.append("transacted_start", dateRange.from.toISOString())
                    }
                    if (dateRange?.to) {
                      params.append("transacted_end", dateRange.to.toISOString())
                    }
                    navigate(`/transactions?${params.toString()}`)
                  }}
                  className="text-xs text-primary hover:underline w-full text-center pt-1"
                >
                  View all {paychecks.length} →
                </button>
              )}
            </div>
          </div>
        )
      }}
    </Widget>
  )
}
