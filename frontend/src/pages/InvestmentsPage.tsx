import { MainLayout } from "@/layouts/MainLayout"
import { useInfiniteTransactions } from "@/hooks/queries/useTransactions"
import { useHoldings } from "@/hooks/queries/useHoldings"
import { useAccounts } from "@/hooks/queries/useAccounts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import AccountCombobox from "@/components/ui/AccountCombobox"
import TimeRangeSelector from "@/components/ui/TimeRangeSelector"
import { useState, useMemo, useEffect, useRef } from "react"
import type { DateRange } from "react-day-picker"
import { AsyncRenderer } from "@/components/ui/AsyncRenderer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { TrendingUp, TrendingDown, Loader2, ChevronDown } from "lucide-react"
import type { Holding } from "@/types"

export default function InvestmentsPage() {
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
    const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined)
    const [summaryOpen, setSummaryOpen] = useState(true)
    const [accountSummaryOpen, setAccountSummaryOpen] = useState(true)
    const [holdingsOpen, setHoldingsOpen] = useState(true)
    const [transactionsOpen, setTransactionsOpen] = useState(true)

    const handleUpdate = (dateRange: DateRange | undefined, _byMonthMode: boolean) => {
        setSelectedRange(dateRange)
    }

    const { data: accounts } = useAccounts()

    const { data: holdings, isLoading: holdingsLoading, error: holdingsError } = useHoldings({
        account_id: selectedAccountIds.length === 1 ? selectedAccountIds[0] : undefined,
    })

    const {
        data,
        isLoading,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteTransactions({
        account_ids: selectedAccountIds,
        transacted_range: selectedRange,
        account_types: ["investment"], // Only show investment account transactions
        limit: 100,
    })

    // Flatten all pages into a single array
    const allTransactions = useMemo(() => {
        if (!data?.pages) return []
        return data.pages.flat()
    }, [data])

    // Intersection observer ref for infinite scroll
    const observerTarget = useRef<HTMLDivElement>(null)

    // Set up intersection observer for auto-scroll detection
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage()
                }
            },
            { threshold: 0.1 }
        )

        const currentTarget = observerTarget.current
        if (currentTarget) {
            observer.observe(currentTarget)
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget)
            }
        }
    }, [fetchNextPage, hasNextPage, isFetchingNextPage])

    const defaultDateRange = "3m" // default to last 3 months for investments

    // Calculate per-account summary
    const accountSummaries = useMemo(() => {
        if (!holdings || holdings.length === 0 || !accounts) return []

        // Group holdings by account
        const byAccount = holdings.reduce((acc, holding) => {
            if (!acc[holding.account_id]) {
                acc[holding.account_id] = []
            }
            acc[holding.account_id].push(holding)
            return acc
        }, {} as Record<string, Holding[]>)

        // Calculate summary for each account
        return Object.entries(byAccount).map(([accountId, accountHoldings]) => {
            const account = accounts.find(a => a.account_id === accountId)
            const marketValue = accountHoldings.reduce((sum, h) => sum + parseFloat(h.market_value), 0)
            const costBasis = accountHoldings.reduce((sum, h) => sum + parseFloat(h.cost_basis), 0)
            const gainLoss = marketValue - costBasis
            const returnPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0

            return {
                accountId,
                accountName: account?.display_name || account?.name || 'Unknown Account',
                marketValue,
                costBasis,
                gainLoss,
                returnPercent,
                holdingsCount: accountHoldings.length,
            }
        }).sort((a, b) => b.marketValue - a.marketValue) // Sort by market value descending
    }, [holdings, accounts])

    // Calculate holdings summary
    const holdingsSummary = useMemo(() => {
        if (!holdings || holdings.length === 0) return null

        const totalMarketValue = holdings.reduce((sum, h) => sum + parseFloat(h.market_value), 0)
        const totalCostBasis = holdings.reduce((sum, h) => sum + parseFloat(h.cost_basis), 0)
        const totalGainLoss = totalMarketValue - totalCostBasis
        const gainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0

        return {
            totalMarketValue,
            totalCostBasis,
            totalGainLoss,
            gainLossPercent,
        }
    }, [holdings])

    return (
        <MainLayout title="Investments">
            <div className="p-3 md:p-4 w-full space-y-4 md:space-y-6">
                <div className="flex flex-wrap gap-2">
                    <AccountCombobox
                        multiSelect
                        selectedIds={selectedAccountIds}
                        onChange={setSelectedAccountIds}
                        includeTypes={["investment"]}
                    />
                    <TimeRangeSelector onUpdate={handleUpdate} showCustom defaultSelection={defaultDateRange} />
                </div>

                {/* Holdings Summary Cards */}
                {holdingsSummary && (
                    <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full group">
                            <h2 className="text-xl font-semibold">Summary</h2>
                            <ChevronDown className={`h-5 w-5 transition-transform ${summaryOpen ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Total Market Value
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            ${holdingsSummary.totalMarketValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Total Cost Basis
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            ${holdingsSummary.totalCostBasis.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Total Gain/Loss
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className={`text-2xl font-bold flex items-center gap-2 ${holdingsSummary.totalGainLoss >= 0 ? "text-positive" : "text-negative"}`}>
                                            {holdingsSummary.totalGainLoss >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                                            ${Math.abs(holdingsSummary.totalGainLoss).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Return %
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className={`text-2xl font-bold ${holdingsSummary.gainLossPercent >= 0 ? "text-positive" : "text-negative"}`}>
                                            {holdingsSummary.gainLossPercent >= 0 ? "+" : ""}{holdingsSummary.gainLossPercent.toFixed(2)}%
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                {/* Per-Account Summary */}
                {accountSummaries.length > 0 && (
                    <Collapsible open={accountSummaryOpen} onOpenChange={setAccountSummaryOpen}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full group">
                            <h2 className="text-xl font-semibold">Account Summary</h2>
                            <ChevronDown className={`h-5 w-5 transition-transform ${accountSummaryOpen ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-2">
                            {accountSummaries.map((summary) => (
                                <Card key={summary.accountId}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">
                                            {summary.accountName}
                                        </CardTitle>
                                        <div className="text-xs text-muted-foreground">
                                            {summary.holdingsCount} {summary.holdingsCount === 1 ? 'holding' : 'holdings'}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <div className="text-muted-foreground">Market Value</div>
                                                <div className="font-semibold">
                                                    ${summary.marketValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Cost Basis</div>
                                                <div className="font-semibold">
                                                    ${summary.costBasis.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Gain/Loss</div>
                                                <div className={`font-semibold ${summary.gainLoss >= 0 ? "text-positive" : "text-negative"}`}>
                                                    {summary.gainLoss >= 0 ? "+" : ""}${summary.gainLoss.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Return</div>
                                                <div className={`font-semibold flex items-center gap-1 ${summary.returnPercent >= 0 ? "text-positive" : "text-negative"}`}>
                                                    {summary.returnPercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                    {summary.returnPercent >= 0 ? "+" : ""}{summary.returnPercent.toFixed(2)}%
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Account</TableHead>
                                        <TableHead className="text-right">Holdings</TableHead>
                                        <TableHead className="text-right">Market Value</TableHead>
                                        <TableHead className="text-right">Cost Basis</TableHead>
                                        <TableHead className="text-right">Gain/Loss</TableHead>
                                        <TableHead className="text-right">Return %</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {accountSummaries.map((summary, index) => (
                                        <TableRow key={summary.accountId} className={index % 2 === 0 ? "bg-[var(--table-row-even)]" : "bg-[var(--table-row-odd)]"}>
                                            <TableCell className="font-medium">{summary.accountName}</TableCell>
                                            <TableCell className="text-right">{summary.holdingsCount}</TableCell>
                                            <TableCell className="text-right">
                                                ${summary.marketValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                ${summary.costBasis.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className={`text-right font-medium ${summary.gainLoss >= 0 ? "text-positive" : "text-negative"}`}>
                                                {summary.gainLoss >= 0 ? "+" : ""}${summary.gainLoss.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className={`text-right font-medium flex items-center justify-end gap-1 ${summary.returnPercent >= 0 ? "text-positive" : "text-negative"}`}>
                                                {summary.returnPercent >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                                {summary.returnPercent >= 0 ? "+" : ""}{summary.returnPercent.toFixed(2)}%
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                {/* Holdings Table */}
                <AsyncRenderer
                    isLoading={holdingsLoading}
                    error={holdingsError}
                    noData={holdings && holdings.length === 0 ? "No holdings found." : null}
                    data={holdings}
                >
                    {(holdingsData) => (
                        <Collapsible open={holdingsOpen} onOpenChange={setHoldingsOpen}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full group">
                                <h2 className="text-xl font-semibold">Current Holdings</h2>
                                <ChevronDown className={`h-5 w-5 transition-transform ${holdingsOpen ? "rotate-180" : ""}`} />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3">

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-1.5">
                                {holdingsData.map((holding) => {
                                    const marketValue = parseFloat(holding.market_value)
                                    const costBasis = parseFloat(holding.cost_basis)
                                    const gainLoss = marketValue - costBasis
                                    const returnPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0

                                    return (
                                        <div key={holding.id} className="border rounded-lg p-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-baseline gap-1.5">
                                                    <div className="text-sm font-bold">{holding.symbol}</div>
                                                    <div className="text-[10px] text-muted-foreground">
                                                        {parseFloat(holding.shares).toFixed(0)}
                                                    </div>
                                                </div>
                                                <div className={`text-xs font-semibold flex items-center gap-0.5 ${returnPercent >= 0 ? "text-positive" : "text-negative"}`}>
                                                    {returnPercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                    {returnPercent >= 0 ? "+" : ""}{returnPercent.toFixed(1)}%
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                                                <div>
                                                    <div className="text-muted-foreground">Val</div>
                                                    <div className="font-medium text-xs">
                                                        ${(marketValue / 1000).toFixed(1)}k
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">Cost</div>
                                                    <div className="font-medium text-xs">
                                                        ${(costBasis / 1000).toFixed(1)}k
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">G/L</div>
                                                    <div className={`font-medium text-xs ${gainLoss >= 0 ? "text-positive" : "text-negative"}`}>
                                                        {gainLoss >= 0 ? "+" : ""}{(gainLoss / 1000).toFixed(1)}k
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Symbol</TableHead>
                                            <TableHead className="text-right">Shares</TableHead>
                                            <TableHead className="text-right">Market Value</TableHead>
                                            <TableHead className="text-right">Cost Basis</TableHead>
                                            <TableHead className="text-right">Gain/Loss</TableHead>
                                            <TableHead className="text-right">Return %</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {holdingsData.map((holding, index) => {
                                            const marketValue = parseFloat(holding.market_value)
                                            const costBasis = parseFloat(holding.cost_basis)
                                            const gainLoss = marketValue - costBasis
                                            const returnPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0

                                            return (
                                                <TableRow key={holding.id} className={index % 2 === 0 ? "bg-[var(--table-row-even)]" : "bg-[var(--table-row-odd)]"}>
                                                    <TableCell className="font-medium">{holding.symbol}</TableCell>
                                                    <TableCell className="text-right">
                                                        {parseFloat(holding.shares).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        ${marketValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        ${costBasis.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className={`text-right ${gainLoss >= 0 ? "text-positive" : "text-negative"}`}>
                                                        {gainLoss >= 0 ? "+" : "-"}${Math.abs(gainLoss).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className={`text-right font-medium ${returnPercent >= 0 ? "text-positive" : "text-negative"}`}>
                                                        {returnPercent >= 0 ? "+" : ""}{returnPercent.toFixed(2)}%
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </AsyncRenderer>

                {/* Transactions Section */}
                <AsyncRenderer
                    isLoading={isLoading}
                    error={error}
                    noData={allTransactions && allTransactions.length === 0 ? "No investment transactions found for the selected period." : null}
                    data={allTransactions}
                >
                    {(transactions) => (
                        <Collapsible open={transactionsOpen} onOpenChange={setTransactionsOpen}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full group">
                                <h2 className="text-xl font-semibold">Recent Transactions</h2>
                                <ChevronDown className={`h-5 w-5 transition-transform ${transactionsOpen ? "rotate-180" : ""}`} />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3">

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-1.5">
                                {transactions.map((transaction) => (
                                    <div key={transaction.id} className="border rounded-lg p-2">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(transaction.transacted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </div>
                                            <div className={`text-sm font-semibold ${Number(transaction.amount) >= 0 ? "text-positive" : "text-negative"}`}>
                                                {Number(transaction.amount) >= 0 ? "+" : "-"}${Math.abs(Number(transaction.amount)).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                            </div>
                                        </div>
                                        <div className="text-sm font-medium truncate">
                                            {transaction.payeeName || transaction.description || "—"}
                                        </div>
                                        {transaction.accountName && (
                                            <div className="text-[10px] text-muted-foreground truncate">
                                                {transaction.accountName}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Account</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.map((transaction, index) => (
                                            <TableRow key={transaction.id} className={index % 2 === 0 ? "bg-[var(--table-row-even)]" : "bg-[var(--table-row-odd)]"}>
                                                <TableCell>
                                                    {new Date(transaction.transacted_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>{transaction.accountName}</TableCell>
                                                <TableCell>
                                                    {transaction.payeeName || transaction.description || "—"}
                                                </TableCell>
                                                <TableCell className={`text-right font-medium ${Number(transaction.amount) >= 0 ? "text-positive" : "text-negative"}`}>
                                                    ${Math.abs(Number(transaction.amount)).toLocaleString("en-US", {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    })}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Infinite scroll loading indicator / trigger */}
                            <div ref={observerTarget} className="py-8 flex justify-center">
                                {isFetchingNextPage && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>Loading more transactions...</span>
                                    </div>
                                )}
                                {!hasNextPage && transactions.length > 0 && (
                                    <div className="text-sm text-muted-foreground">
                                        No more transactions to load
                                    </div>
                                )}
                            </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </AsyncRenderer>
            </div>
        </MainLayout>
    )
}