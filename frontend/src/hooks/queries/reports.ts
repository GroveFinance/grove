import { useQuery } from "@tanstack/react-query";
import { getReport } from "@/services/api";
import type { ReportOut, TopTransactionDataPoint, BudgetUsageDataPoint } from "@/types/api-types";
import type { GetReportParams } from "@/types";
import type { DateRange } from "react-day-picker";



interface ReportParams {
  dateRange?: DateRange;
  limit?: number;
  mode?: "per_month" | "global";
}

export function useCategoryTrends(params: ReportParams = {}) {
  const { dateRange } = params;
  const isEnabled = !!dateRange?.from && !!dateRange?.to;

  return useQuery<ReportOut, Error>({
    queryKey: ["categoryTrends", params],
    queryFn: () =>
      getReport({ report_type: "category_trends", ...params } as GetReportParams),
    enabled: isEnabled,
  });
}

export function useBudgetUsage(params: ReportParams = {}) {
  const { dateRange } = params;
  const isEnabled = !!dateRange?.from && !!dateRange?.to;

  return useQuery<ReportOut<BudgetUsageDataPoint>, Error>({
    queryKey: ["budgetUsage", params],
    queryFn: async () => {
      const result = await getReport({ report_type: "budget_usage", ...params } as GetReportParams);
      return result as unknown as ReportOut<BudgetUsageDataPoint>;
    },
    enabled: isEnabled,
  });
}

export function useIncomeVsExpenses(params: ReportParams = {}) {
  const { dateRange } = params;

  return useQuery<ReportOut, Error>({
    queryKey: ["incomeVsExpenses", params],
    queryFn: () => getReport({ report_type: "income_vs_expenses", ...params } as GetReportParams),
    enabled: !!dateRange?.from && !!dateRange?.to, // 👈 prevents unnecessary API calls
  });
}

export function useNetWorthHistory(params: ReportParams = {}) {
  const { dateRange } = params;

  return useQuery<ReportOut, Error>({
    queryKey: ["netWorthHistory", params],
    queryFn: () => getReport({ report_type: "net_worth_history", ...params } as GetReportParams),
    enabled: !!dateRange?.from && !!dateRange?.to, // 👈 prevents unnecessary API calls
  });
}

export function usePaycheckAnalysis(params: ReportParams = {}) {
  const { dateRange } = params;

  return useQuery<ReportOut, Error>({
    queryKey: ["paycheckAnalysis", params],
    queryFn: () => getReport({ report_type: "paycheck_analysis", ...params } as GetReportParams),
    enabled: !!dateRange?.from && !!dateRange?.to, // 👈 prevents unnecessary API calls
  });
}

export function useTopTransactions(params: ReportParams = {}) {
  const { dateRange, limit = 5 } = params;

  return useQuery<ReportOut<TopTransactionDataPoint>, Error>({
    queryKey: ["topTransactions", params],
    queryFn: async () => {
      const result = await getReport({ report_type: "top_transactions", limit, ...params } as GetReportParams);
      return result as unknown as ReportOut<TopTransactionDataPoint>;
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
  });
}