import { MainLayout } from "@/layouts/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { subMonths, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { AsyncRenderer } from "@/components/ui/AsyncRenderer";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getReport } from "@/services/api";
import { formatCurrency } from "@/lib/utils";

interface GroupedCategoryData {
  groupName: string;
  categories: {
    categoryName: string;
    categoryId: number;
    total: number;
    monthlyData: { month: string; amount: number }[];
  }[];
  groupTotal: number;
}

// Custom tooltip component with proper dark mode support
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold text-foreground mb-1">{label}</p>
        <p className="text-sm text-muted-foreground">
          Spent: <span className="font-bold text-foreground">{formatCurrency(payload[0].value)}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function CategoriesPage() {
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Fetch category trends for last 12 months
  const { start, end } = useMemo(() => ({
    start: startOfMonth(subMonths(new Date(), 11)),
    end: new Date(),
  }), []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["categoryTrends", start, end],
    queryFn: () =>
      getReport({
        report_type: "category_trends",
        dateRange: { from: start, to: end },
        mode: "per_month",
      }),
  });

  // Process data: group by category group, calculate totals
  const groupedData = useMemo(() => {
    if (!data?.data || data.data.length === 0) return [];

    // Get all unique months for completeness
    const allMonths = Array.from(new Set(data.data.map(d => d.month))).sort();

    // Group by group name
    const groupMap = new Map<string, GroupedCategoryData>();

    data.data.forEach(item => {
      const groupName = item.group_name || "Other";

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, {
          groupName,
          categories: [],
          groupTotal: 0,
        });
      }

      const group = groupMap.get(groupName)!;

      // Find or create category in this group
      let category = group.categories.find(c => c.categoryId === item.category_id);
      if (!category) {
        category = {
          categoryName: item.category || "Unknown",
          categoryId: item.category_id || 0,
          total: 0,
          monthlyData: allMonths.map(month => ({ month, amount: 0 })),
        };
        group.categories.push(category);
      }

      // Add monthly data (use absolute value since backend returns negative for expenses)
      const amount = Math.abs(item.total);
      const monthIndex = category.monthlyData.findIndex(m => m.month === item.month);
      if (monthIndex !== -1) {
        category.monthlyData[monthIndex].amount = amount;
      }

      category.total += amount;
      group.groupTotal += amount;
    });

    // Sort categories within each group by total spending
    groupMap.forEach(group => {
      group.categories.sort((a, b) => b.total - a.total);
    });

    // Convert to array and sort by group total
    return Array.from(groupMap.values()).sort((a, b) => b.groupTotal - a.groupTotal);
  }, [data]);

  // Calculate overall statistics
  const stats = useMemo(() => {
    if (!data?.data || data.data.length === 0) return { totalSpending: 0, categoryCount: 0, avgMonthly: 0 };

    const totalSpending = data.data.reduce((sum, item) => sum + Math.abs(item.total), 0);
    const uniqueCategories = new Set(data.data.map(d => d.category_id));
    const categoryCount = uniqueCategories.size;
    const avgMonthly = totalSpending / 12;

    return { totalSpending, categoryCount, avgMonthly };
  }, [data]);

  // Prepare data for pie chart (top groups)
  const pieChartData = useMemo(() => {
    return groupedData.slice(0, 8).map(group => ({
      name: group.groupName,
      value: group.groupTotal,
    }));
  }, [groupedData]);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  // Navigate to transactions filtered by category
  const handleCategoryClick = (categoryId: number) => {
    navigate(`/transactions?category_ids=${categoryId}`);
  };

  // Chart colors (using your existing chart colors from CSS)
  const COLORS = [
    'oklch(62% 0.20 145)',
    'oklch(65% 0.18 250)',
    'oklch(63% 0.19 340)',
    'oklch(70% 0.21 75)',
    'oklch(58% 0.20 25)',
    'oklch(68% 0.17 285)',
    'oklch(62% 0.19 110)',
    'oklch(64% 0.18 210)',
  ];

  return (
    <MainLayout title="Category Spending Trends">
      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Spending (12 mo)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.totalSpending.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.categoryCount}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Monthly
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.avgMonthly.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>

        <AsyncRenderer
          isLoading={isLoading}
          error={error}
          noData={!isLoading && (!data?.data || data.data.length === 0) ? "No category spending data found for the last 12 months." : null}
          data={data?.data}
        >
          {() => (
            <>
              {/* Pie Chart - Desktop Only */}
              <Card className="hidden md:block">
                <CardHeader>
                  <CardTitle>Spending by Category Group</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${formatCurrency(entry.value, undefined, undefined, { maximumFractionDigits: 0 })}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Category Groups */}
              <div className="space-y-3 md:space-y-4">
                {groupedData.map((group, groupIndex) => (
                  <Card key={group.groupName}>
                    <CardHeader className="cursor-pointer" onClick={() => toggleGroup(group.groupName)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: COLORS[groupIndex % COLORS.length] }}
                          />
                          <div>
                            <CardTitle className="text-lg">{group.groupName}</CardTitle>
                            <div className="text-sm text-muted-foreground">
                              {group.categories.length} {group.categories.length === 1 ? 'category' : 'categories'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xl font-bold">
                              ${group.groupTotal.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {((group.groupTotal / stats.totalSpending) * 100).toFixed(1)}% of total
                            </div>
                          </div>
                          {expandedGroups.has(group.groupName) ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {expandedGroups.has(group.groupName) && (
                      <CardContent className="space-y-4 md:space-y-6">
                        {/* Category List - Mobile */}
                        <div className="md:hidden space-y-3">
                          {group.categories.map(category => (
                            <div
                              key={category.categoryId}
                              className="border-l-4 pl-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors rounded"
                              style={{ borderColor: COLORS[groupIndex % COLORS.length] }}
                              onClick={() => handleCategoryClick(category.categoryId)}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-semibold">{category.categoryName}</div>
                                <div className="text-right">
                                  <div className="font-bold">{formatCurrency(category.total, undefined, undefined, { maximumFractionDigits: 0 })}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatCurrency(category.total / 12, undefined, undefined, { maximumFractionDigits: 0 })}/mo
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Last 3 months: {category.monthlyData.slice(-3).map(m =>
                                  formatCurrency(m.amount, undefined, undefined, { maximumFractionDigits: 0 })
                                ).join(', ')}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Category Charts - Desktop */}
                        {group.categories.map(category => (
                          <div key={category.categoryId} className="hidden md:block">
                            <div className="flex justify-between items-center mb-3">
                              <h4
                                className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors"
                                onClick={() => handleCategoryClick(category.categoryId)}
                              >
                                {category.categoryName}
                              </h4>
                              <div className="text-right">
                                <div className="text-xl font-bold">
                                  ${category.total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {formatCurrency(category.total / 12)}/month avg
                                </div>
                              </div>
                            </div>
                            <ResponsiveContainer width="100%" height={150}>
                              <BarChart
                                data={category.monthlyData}
                                onClick={() => handleCategoryClick(category.categoryId)}
                                className="cursor-pointer"
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis
                                  dataKey="month"
                                  tickFormatter={(value) => {
                                    const date = new Date(value + '-01');
                                    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                                  }}
                                  stroke="var(--muted-foreground)"
                                  fontSize={12}
                                />
                                <YAxis
                                  tickFormatter={(value) => `$${value}`}
                                  stroke="var(--muted-foreground)"
                                  fontSize={12}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar
                                  dataKey="amount"
                                  fill={COLORS[groupIndex % COLORS.length]}
                                  radius={[4, 4, 0, 0]}
                                  cursor="pointer"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </AsyncRenderer>
      </div>
    </MainLayout>
  );
}
