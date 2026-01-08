import { Calendar, TrendingDown, AlertCircle } from "lucide-react"
import type { DateRange } from "react-day-picker"

interface EmptyStateProps {
  dateRange?: DateRange
  type?: "transactions" | "spending" | "data"
  message?: string
}

export default function EmptyState({ dateRange, type = "data", message }: EmptyStateProps) {
  // If custom message provided, use it
  if (message) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-muted-foreground">
        <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm text-center">{message}</p>
      </div>
    )
  }

  // Determine context based on date range
  const now = new Date()
  const from = dateRange?.from
  const to = dateRange?.to

  let contextMessage = "No data available"
  let icon = <AlertCircle className="w-8 h-8 mb-2 opacity-50" />

  if (from && to) {
    const daysSinceStart = Math.floor((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
    const isCurrentMonth = from.getMonth() === now.getMonth() && from.getFullYear() === now.getFullYear()
    const isStartOfMonth = daysSinceStart <= 3
    const isEndOfRange = now > to

    if (isCurrentMonth && isStartOfMonth) {
      icon = <Calendar className="w-8 h-8 mb-2 opacity-50" />
      contextMessage = type === "transactions"
        ? "Month just started—no transactions yet"
        : "Month just started—check back soon"
    } else if (isEndOfRange) {
      icon = <TrendingDown className="w-8 h-8 mb-2 opacity-50" />
      contextMessage = type === "spending"
        ? "No spending in this period"
        : "No data for this period"
    } else if (isCurrentMonth && daysSinceStart <= 7) {
      icon = <Calendar className="w-8 h-8 mb-2 opacity-50" />
      contextMessage = "Early in the month—limited data"
    } else {
      icon = <TrendingDown className="w-8 h-8 mb-2 opacity-50" />
      contextMessage = type === "spending"
        ? "No spending found"
        : "No data available"
    }
  } else if (from) {
    // Open-ended range starting from a date
    const daysSinceStart = Math.floor((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSinceStart <= 3) {
      icon = <Calendar className="w-8 h-8 mb-2 opacity-50" />
      contextMessage = "Just started tracking—no data yet"
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-muted-foreground">
      {icon}
      <p className="text-sm text-center">{contextMessage}</p>
    </div>
  )
}
