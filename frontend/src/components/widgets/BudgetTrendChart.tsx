import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";

interface BudgetTrendChartProps {
  categoryData: {
    category_id: number;
    category: string;
    budget: number;
    monthlyData: Array<{
      month: string;
      spent: number;
    }>;
  };
}

export function BudgetTrendChart({ categoryData }: BudgetTrendChartProps) {
  const { category, category_id, budget, monthlyData } = categoryData;
  const navigate = useNavigate();

  // Check if category has any spending - hide if not
  const totalSpent = monthlyData.reduce((sum, m) => sum + m.spent, 0);
  if (totalSpent === 0) return null;

  // Transform data for Recharts - monthly bars
  const monthlyChartData = monthlyData.map((month) => ({
    month: format(new Date(month.month + "-01"), "MMM"),
    monthDate: month.month, // Keep original YYYY-MM for filtering
    spent: month.spent,
    budget: budget,
    isOverBudget: month.spent > budget,
  }));

  // Separate total data
  const annualBudget = budget * monthlyData.length;
  const totalData = [{
    month: "",
    spent: totalSpent,
    budget: annualBudget,
    isOverBudget: totalSpent > annualBudget,
  }];

  const chartConfig = {
    spent: {
      label: "Spent",
    },
    budget: {
      label: "Budget",
    },
  };

  // Handle monthly bar click - navigate to transactions page with filters for that month
  const handleMonthlyBarClick = (data: any) => {
    if (!data || !data.monthDate) return; // Don't navigate if no month data

    const monthDate = new Date(data.monthDate + "-01");
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);

    // Navigate to transactions page with category and date filters
    // (investment accounts are excluded by default on TransactionsPage)
    navigate(
      `/transactions?category_ids=${category_id}&transacted_start=${start.toISOString()}&transacted_end=${end.toISOString()}`
    );
  };

  // Handle YTD bar click - navigate to transactions for the full date range
  const handleYTDBarClick = () => {
    // Use the first and last month from monthlyData to determine the full range
    if (monthlyData.length === 0) return;

    const sortedMonths = [...monthlyData].sort((a, b) => a.month.localeCompare(b.month));
    const firstMonth = new Date(sortedMonths[0].month + "-01");
    const lastMonth = new Date(sortedMonths[sortedMonths.length - 1].month + "-01");

    const start = startOfMonth(firstMonth);
    const end = endOfMonth(lastMonth);

    // (investment accounts are excluded by default on TransactionsPage)
    navigate(
      `/transactions?category_ids=${category_id}&transacted_start=${start.toISOString()}&transacted_end=${end.toISOString()}`
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex justify-between items-center text-base">
          <span>{category}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {formatCurrency(budget, "USD", "en-US", { maximumFractionDigits: 0 })}/mo
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Monthly chart */}
        <div>
          <ChartContainer config={chartConfig} className="h-32 w-full">
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis hide />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [formatCurrency(Number(value)), " Spent"]}
                  />
                }
              />
              <Bar
                dataKey="spent"
                radius={[4, 4, 0, 0]}
                onClick={handleMonthlyBarClick}
                className="cursor-pointer"
              >
                {monthlyChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isOverBudget ? "var(--destructive)" : "var(--chart-1)"}
                  />
                ))}
              </Bar>
              <ReferenceLine
                y={budget}
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Total chart - horizontal */}
        <div className="border-t pt-3">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Last 12 months</span>
            <span className={totalData[0].isOverBudget ? "text-destructive font-medium" : ""}>
              {formatCurrency(totalSpent, "USD", "en-US", { maximumFractionDigits: 0 })} / {formatCurrency(annualBudget, "USD", "en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <ChartContainer config={chartConfig} className="h-16 w-full">
            <BarChart data={totalData} layout="vertical">
              <XAxis type="number" hide domain={[0, Math.max(totalSpent, annualBudget) * 1.1]} />
              <YAxis type="category" dataKey="month" hide />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [formatCurrency(Number(value)), " Total Spent"]}
                  />
                }
              />
              <Bar
                dataKey="spent"
                radius={[0, 4, 4, 0]}
                fill={"var(--chart-2)"}
                onClick={handleYTDBarClick}
                className="cursor-pointer"
              />
              <ReferenceLine
                x={annualBudget}
                stroke="var(--muted-foreground)"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{
                  value: `Budget: ${formatCurrency(annualBudget, "USD", "en-US", { maximumFractionDigits: 0 })}`,
                  position: "insideTopRight",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
