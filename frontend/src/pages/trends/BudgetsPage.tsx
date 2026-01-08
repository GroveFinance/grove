import { MainLayout } from "@/layouts/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { BudgetTrendChart } from "@/components/widgets/BudgetTrendChart";
import { subMonths, startOfMonth } from "date-fns";
import { useMemo } from "react";
import { getReport } from "@/services/api";
import type { BudgetTrendDataPoint, ReportOut } from "@/types/api-types";

export default function BudgetsPage() {
  // Fetch budget trends for last 12 months - memoize dates to prevent endless re-renders
  const { start, end } = useMemo(() => ({
    start: startOfMonth(subMonths(new Date(), 11)),
    end: new Date(),
  }), []);

  const { data, isLoading } = useQuery<ReportOut<BudgetTrendDataPoint>>({
    queryKey: ["budgetTrends", start, end],
    queryFn: async () => {
      const result = await getReport({
        report_type: "budget_trends",
        dateRange: { from: start, to: end },
      });
      return result as unknown as ReportOut<BudgetTrendDataPoint>;
    },
  });

  if (isLoading) {
    return (
      <MainLayout title="Budget Trends">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Budget Trends</h1>
          <div>Loading...</div>
        </div>
      </MainLayout>
    );
  }

  if (!data?.data || data.data.length === 0) {
    return (
      <MainLayout title="Budget Trends">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Budget Trends</h1>
          <div className="text-muted-foreground">
            No budgets configured or no spending data. Set budgets for categories to see trends here.
          </div>
        </div>
      </MainLayout>
    );
  }

  // Transform API data into chart format
  // Group by category and create array of monthly data
  const categoryMap = new Map<number, {
    category_id: number;
    category: string;
    budget: number;
    monthlyData: Array<{ month: string; spent: number }>;
  }>();

  // Create a set of all unique months to ensure we have all 12 months for each category
  const allMonths = new Set<string>();
  data.data.forEach(item => allMonths.add(item.month));
  const sortedMonths = Array.from(allMonths).sort();

  // Group data by category
  data.data.forEach(item => {
    if (!categoryMap.has(item.category_id)) {
      categoryMap.set(item.category_id, {
        category_id: item.category_id,
        category: item.category,
        budget: item.budget,
        monthlyData: [],
      });
    }

    const categoryData = categoryMap.get(item.category_id)!;
    categoryData.monthlyData.push({
      month: item.month,
      spent: item.spent,
    });
  });

  // Fill in missing months with 0 spending for each category
  categoryMap.forEach(categoryData => {
    const existingMonths = new Set(categoryData.monthlyData.map(m => m.month));
    sortedMonths.forEach(month => {
      if (!existingMonths.has(month)) {
        categoryData.monthlyData.push({ month, spent: 0 });
      }
    });
    // Sort monthly data chronologically
    categoryData.monthlyData.sort((a, b) => a.month.localeCompare(b.month));
  });

  const categories = Array.from(categoryMap.values()).sort((a, b) =>
    a.category.localeCompare(b.category)
  );

  return (
    <MainLayout title="Budget Trends">
      <div className="max-w-7xl mx-auto">
        <div className="space-y-8">
          {categories.map(categoryData => (
            <BudgetTrendChart
              key={categoryData.category_id}
              categoryData={categoryData}
            />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
