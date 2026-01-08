"use client"

import Widget from "@/components/widgets/Widget"
import { useTopTransactions } from "@/hooks/queries/reports"
import { useGroups } from "@/hooks/queries/useGroups"
import { useNavigate } from "react-router-dom"
import { useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import EmptyState from "@/components/ui/EmptyState"
import type { TopTransactionDataPoint } from "@/types/api-types"

interface TopTransactionsWidgetProps {
  limit?: number
  dateRange?: DateRange
  title?: string
}

export default function TopTransactionsWidget({
  limit = 5,
  dateRange,
  title = "Top Transactions",
}: TopTransactionsWidgetProps) {
  const navigate = useNavigate()
  const { data: groups } = useGroups()

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

  // Use the report endpoint which already handles:
  // - Excluding transfers
  // - Excluding investment accounts
  // - Excluding hidden accounts
  // - Category fallback logic
  const reportQuery = useTopTransactions({
    dateRange,
    limit,
  })

  const transactions = (reportQuery.data?.data ?? []) as TopTransactionDataPoint[]

  return (
    <Widget title={title} data={transactions}>
      {(data: TopTransactionDataPoint[] | undefined) => {
        if (reportQuery.isLoading)
          return <div>Loading...</div>
        if (reportQuery.error || !data?.length)
          return <EmptyState dateRange={dateRange} type="transactions" />

        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payee</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden lg:table-cell">Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    const params = new URLSearchParams({
                      id: tx.id,
                    });

                    // Add date range if provided
                    if (dateRange?.from) {
                      params.append('transacted_start', dateRange.from.toISOString());
                    }
                    if (dateRange?.to) {
                      params.append('transacted_end', dateRange.to.toISOString());
                    }

                    // Exclude transfer categories to match report filter
                    // (investment accounts are excluded by default on TransactionsPage)
                    if (transferCategoryIds.length > 0) {
                      params.append('excluded_category_ids', transferCategoryIds.join(','));
                    }

                    // Sort by amount ascending (most negative = largest expenses first)
                    params.append('sort_by', 'amount');
                    params.append('sort_order', 'asc');

                    navigate(`/transactions?${params.toString()}`);
                  }}
                >
                  <TableCell className="max-w-[150px] truncate">
                    {tx.payee ?? tx.description ?? "Unknown"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground truncate">
                    {tx.category}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground truncate">
                    {tx.account}
                  </TableCell>
                  <TableCell className={cn("text-right font-medium whitespace-nowrap", tx.amount >= 0 ? "text-positive" : "text-negative")}>
                    ${Math.abs(tx.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      }}
    </Widget>
  )
}
