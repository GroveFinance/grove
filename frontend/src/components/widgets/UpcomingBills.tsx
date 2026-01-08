"use client"
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, TrendingUp } from "lucide-react";
import Widget from "@/components/widgets/Widget";
import { getReport } from "@/services/api";
import type { UpcomingBillDataPoint, ReportOut } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface UpcomingBillsWidgetProps {
  title: string;
  className?: string;
  lookforwardDays?: number;
}

export default function UpcomingBills({
  title,
  className,
  lookforwardDays = 30
}: UpcomingBillsWidgetProps) {
  const { data: reportData, isLoading, error } = useQuery({
    queryKey: ["report", "upcoming_bills", lookforwardDays],
    queryFn: async () => {
      const result = await getReport({
        report_type: "upcoming_bills",
        lookforward_days: lookforwardDays,
      });
      return result as unknown as ReportOut<UpcomingBillDataPoint>;
    },
  });

  const allBills = reportData?.data ?? [];
  const bills = allBills.slice(0, 5);

  const totalAmount = bills.reduce((sum, bill) => sum + bill.average_amount, 0);

  const getDaysUntilColor = (days: number) => {
    if (days <= 3) return "text-red-500";
    if (days <= 7) return "text-orange-500";
    return "text-muted-foreground";
  };

  const getRecurrenceBadge = (type: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      monthly: { label: "Monthly", color: "bg-blue-500/10 text-blue-500" },
      quarterly: { label: "Quarterly", color: "bg-purple-500/10 text-purple-500" },
      "bi-monthly": { label: "Bi-Monthly", color: "bg-green-500/10 text-green-500" },
      annual: { label: "Annual", color: "bg-orange-500/10 text-orange-500" },
    };
    return badges[type] || { label: type, color: "bg-gray-500/10 text-gray-500" };
  };

  if (isLoading) {
    return (
      <Widget title={title} className={className}>
        <div className="flex items-center justify-center h-32">
          <div className="text-sm text-muted-foreground">Loading upcoming bills...</div>
        </div>
      </Widget>
    );
  }

  if (error) {
    return (
      <Widget title={title} className={className}>
        <div className="flex items-center justify-center h-32">
          <div className="text-sm text-destructive">Failed to load upcoming bills</div>
        </div>
      </Widget>
    );
  }

  return (
    <Widget
      title={title}
      className={className}
      headerActions={
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Next {lookforwardDays} days</span>
          <span className="font-semibold text-sm">{formatCurrency(totalAmount)}</span>
        </div>
      }
    >
      {bills.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No upcoming bills detected</p>
          <p className="text-xs text-muted-foreground mt-1">
            We analyze your Bills & Utilities transactions to predict recurring payments
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {bills.map((bill, index) => {
            const badge = getRecurrenceBadge(bill.recurrence_type);
            const daysColor = getDaysUntilColor(bill.days_until_due);

            return (
              <div
                key={`${bill.payee}-${bill.expected_date}-${index}`}
                className="flex items-start justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors border border-border/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-medium text-sm truncate">{bill.payee}</h4>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", badge.color)}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {bill.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(bill.expected_date), "MMM d")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex flex-col items-end">
                    <span className="font-semibold text-sm whitespace-nowrap">
                      ~{formatCurrency(bill.average_amount)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">avg</span>
                  </div>
                  <span className={cn("flex items-center gap-1 text-xs font-medium", daysColor)}>
                    <Clock className="h-3 w-3" />
                    {bill.days_until_due === 0 ? "Today" :
                     bill.days_until_due === 1 ? "Tomorrow" :
                     `${bill.days_until_due} days`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}
