"use client"
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react"
import { useAccounts } from "@/hooks/queries/useAccounts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button";
import Widget from "@/components/widgets/Widget";
import type { Account } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { ACCOUNT_TYPE_OPTIONS } from "@/types";

interface AccountSummaryWidgetProps {
  title: string
  className?: string
}

interface AccountTableProps {
  title: string
  accounts: Account[]
  defaultOpen?: boolean
}

function AccountTable({ title, accounts, defaultOpen = false }: AccountTableProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const totalBalance = (accounts ?? []).reduce(
    (sum, account) => sum + (account.balance != null ? Number(account.balance) : 0),
    0
  )

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4 last:mb-0">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-3 h-auto hover:bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium text-sm">{title}</span>
            <span className="text-xs text-muted-foreground">({accounts.length} accounts)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn("font-semibold text-sm", totalBalance >= 0 ? "text-positive" : "text-negative")}>{formatCurrency(totalBalance)}</span>
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="bg-muted/20 rounded-lg overflow-hidden">
          {accounts.map((account) => (
            <div key={account.account_id} className="grid grid-cols-3 gap-px bg-border">
              <div className="bg-card px-3 py-2">
                <span className="text-sm text-card-foreground">{account.display_name}</span>
              </div>
              <div className="bg-card px-3 py-2">
                <span className="text-sm text-muted-foreground">{account.org_name}</span>
              </div>
              <div className="bg-card px-3 py-2 text-right">
                <span className={cn("text-sm font-mono font-medium", (account.balance || 0) >= 0 ? "text-positive" : "text-negative")}>
                  {formatCurrency(account.balance || 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function AccountSummary({ title, className }: AccountSummaryWidgetProps) {

  const { data: accounts } = useAccounts();

  const groupedAccounts = (accounts ?? []).reduce(
    (acc: Record<string, Account[]>, acct) => {
      const type = acct.account_type || "other";
      if (!acc[type]) acc[type] = [];
      acc[type].push(acct);
      return acc;
    },
    {}
  );

  // category totals
  const categoryTotals: Record<string, number> = {};
  for (const [type, accts] of Object.entries(groupedAccounts)) {
    categoryTotals[type] = accts.reduce(
      (sum, acct) => sum + (parseFloat(String(acct.balance ?? 0)) || 0),
      0
    );
  }

  // overall total
  const overallTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  const accountsByType = ACCOUNT_TYPE_OPTIONS.reduce(
    (acc, typeOption) => {
      const accountsOfType = (accounts || []).filter((account) => account.account_type === typeOption.value)
      if (accountsOfType.length > 0) {
        acc.push({
          title: typeOption.label,
          accounts: accountsOfType,
        })
      }
      return acc
    },
    [] as { title: string; accounts: Account[] }[],
  )

  return (
    <Widget
      title={title}
      className={className}
      //isLoading={isLoading}
      //error={error}
      headerActions={
        <div className="flex items-center gap-1">
          <span className={cn("font-bold text-sm", overallTotal >= 0 ? "text-positive" : "text-negative")}>{formatCurrency(overallTotal)}</span>
        </div>
      }
    >
      <div className="space-y-1">
        {accountsByType.map((table) => (
          <AccountTable key={table.title} title={table.title} accounts={table.accounts} defaultOpen={false} />
        ))}
      </div>
    </Widget>
  )
}
