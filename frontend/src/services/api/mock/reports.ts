/**
 * Mock report implementations
 */

import type { GetReportParams, ReportOut } from "@/types";

/**
 * Helper to generate month list between two dates
 */
function generateMonthList(from: Date, to: Date): string[] {
  const months: string[] = [];
  const current = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);

  while (current <= end) {
    months.push(current.toISOString().slice(0, 7));
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

/**
 * Generate mock report data based on transactions
 */
export async function generateMockReport(
  params: GetReportParams,
  getTransactions: (params: any) => Promise<any[]>,
  getAccounts: () => any[],
  getCategories: () => any[],
  getGroups: () => any[]
): Promise<ReportOut<any>> {
  const { report_type } = params;

  const dateRange = params.dateRange || {
    from: params.start ? new Date(params.start) : new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
    to: params.end ? new Date(params.end) : new Date(),
  };

  // Helper to get filtered transactions
  const getFilteredTransactions = async () => {
    return await getTransactions({
      transacted_range: dateRange,
      exclude_account_types: params.exclude_account_types || ["investment"],
    });
  };

  switch (report_type) {
    case "category_trends": {
      const transactions = await getFilteredTransactions();
      const months = generateMonthList(dateRange.from!, dateRange.to!);
      const groups = getGroups();

      // Create a map of category_id to group_name
      const categoryToGroup = new Map<number, string>();
      for (const group of groups) {
        for (const category of group.categories) {
          categoryToGroup.set(category.id, group.name);
        }
      }

      // Group by category across all months to find top categories
      const categoryTotals = new Map<number, { name: string; group_name: string; total: number }>();

      for (const tx of transactions) {
        for (const split of tx.splits) {
          // Only count expenses (negative amounts)
          if (parseFloat(split.amount) < 0) {
            const existing = categoryTotals.get(split.category_id) || {
              name: split.category.name,
              group_name: categoryToGroup.get(split.category_id) || "Other",
              total: 0,
            };
            existing.total += Math.abs(parseFloat(split.amount));
            categoryTotals.set(split.category_id, existing);
          }
        }
      }

      // Sort by total spending
      const sortedCategories = Array.from(categoryTotals.entries())
        .sort((a, b) => b[1].total - a[1].total);

      // Apply limit and calculate "Other" if needed
      const limit = params.limit || 10;
      const topCategories = sortedCategories.slice(0, limit);
      const remainingCategories = sortedCategories.slice(limit);
      const topCategoryIds = new Set(topCategories.map(([id]) => id));

      const data: any[] = [];

      if (params.mode === "per_month") {
        // Group by month for top categories + "Other"
        const monthCategoryTotals = new Map<string, Map<number, number>>();
        const monthOtherTotals = new Map<string, number>();

        for (const tx of transactions) {
          const month = tx.transacted_at.slice(0, 7);
          if (!monthCategoryTotals.has(month)) {
            monthCategoryTotals.set(month, new Map());
          }
          const categoryMap = monthCategoryTotals.get(month)!;

          for (const split of tx.splits) {
            if (parseFloat(split.amount) < 0) {
              if (topCategoryIds.has(split.category_id)) {
                // Top category - track individually
                const current = categoryMap.get(split.category_id) || 0;
                categoryMap.set(split.category_id, current + Math.abs(parseFloat(split.amount)));
              } else {
                // Other category - aggregate
                const current = monthOtherTotals.get(month) || 0;
                monthOtherTotals.set(month, current + Math.abs(parseFloat(split.amount)));
              }
            }
          }
        }

        // Create data points for each month/category combination
        for (const month of months) {
          const categoryMap = monthCategoryTotals.get(month);
          if (categoryMap) {
            for (const [id, { name, group_name }] of topCategories) {
              const total = categoryMap.get(id) || 0;
              if (total > 0) {
                data.push({ month, category: name, category_id: id, group_name, total });
              }
            }
          }

          // Add "Other" if there are remaining categories
          const otherTotal = monthOtherTotals.get(month);
          if (otherTotal && otherTotal > 0) {
            data.push({ month, category: "Other", category_id: -1, group_name: "Other", total: otherTotal });
          }
        }
      } else {
        // Global mode - one data point per category + "Other"
        const month = months[months.length - 1] || new Date().toISOString().slice(0, 7);

        // Add top categories
        for (const [id, { name, group_name, total }] of topCategories) {
          data.push({ month, category: name, category_id: id, group_name, total });
        }

        // Add "Other" if there are remaining categories
        if (remainingCategories.length > 0) {
          const otherTotal = remainingCategories.reduce((sum, [, { total }]) => sum + total, 0);
          if (otherTotal > 0) {
            data.push({ month, category: "Other", category_id: -1, group_name: "Other", total: otherTotal });
          }
        }
      }

      return {
        report_type: "category_trends",
        period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
        data,
      };
    }

    case "budget_usage": {
      const transactions = await getFilteredTransactions();
      const categories = getCategories();

      const categorySpending = new Map<number, number>();

      for (const tx of transactions) {
        for (const split of tx.splits) {
          // Only count expenses
          if (parseFloat(split.amount) < 0) {
            const current = categorySpending.get(split.category_id) || 0;
            categorySpending.set(split.category_id, current + Math.abs(parseFloat(split.amount)));
          }
        }
      }

      const data = categories
        .filter((c: any) => c.budget && c.budget > 0)
        .map((c: any) => {
          const actual = categorySpending.get(c.id) || 0;
          const budget = c.budget || 0;
          return {
            category_id: c.id,
            category: c.name,
            budget,
            actual,
            utilization: budget > 0 ? (actual / budget) * 100 : 0,
            over_budget: actual > budget,
          };
        })
        .sort((a, b) => b.utilization - a.utilization) // Sort by highest utilization first
        .slice(0, params.limit || 10); // Apply limit

      return {
        report_type: "budget_usage",
        period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
        data,
      };
    }

    case "budget_trends": {
      // Monthly spending vs budget for all categories with budgets
      const transactions = await getFilteredTransactions();
      const months = generateMonthList(dateRange.from!, dateRange.to!);
      const categories = getCategories();

      // Get categories with budgets set
      const budgetedCategories = categories.filter((c: any) => c.budget && c.budget > 0);

      if (budgetedCategories.length === 0) {
        return {
          report_type: "budget_trends",
          period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
          data: [],
        };
      }

      // Group spending by category and month
      const spendingByMonthCategory = new Map<string, Map<number, number>>();

      for (const tx of transactions) {
        const month = tx.transacted_at.slice(0, 7);
        if (!months.includes(month)) continue;

        if (!spendingByMonthCategory.has(month)) {
          spendingByMonthCategory.set(month, new Map());
        }
        const monthMap = spendingByMonthCategory.get(month)!;

        for (const split of tx.splits) {
          const amount = parseFloat(split.amount);
          if (amount < 0) { // Only expenses
            const categoryId = split.category_id;
            const current = monthMap.get(categoryId) || 0;
            monthMap.set(categoryId, current + Math.abs(amount));
          }
        }
      }

      // Generate data points for each category for each month
      const data: any[] = [];
      for (const category of budgetedCategories) {
        for (const month of months) {
          const monthMap = spendingByMonthCategory.get(month);
          const spent = monthMap?.get(category.id) || 0;

          data.push({
            month,
            category_id: category.id,
            category: category.name,
            budget: Number(category.budget) || 0,
            spent,
          });
        }
      }

      return {
        report_type: "budget_trends",
        period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
        data,
      };
    }

    case "income_vs_expenses": {
      const transactions = await getFilteredTransactions();
      const categories = getCategories();
      const months = generateMonthList(dateRange.from!, dateRange.to!);

      // Find transfer-related categories to exclude (matching backend behavior)
      const transferCategoryNames = ["Transfer", "Credit Card Payment"];
      const transferCategoryIds = new Set(
        categories
          .filter((c: any) => transferCategoryNames.includes(c.name))
          .map((c: any) => c.id)
      );

      const monthlyData = new Map<string, { income: number; expenses: number }>();

      for (const tx of transactions) {
        // Skip transfer transactions (like backend's exclude_transfers=True)
        const isTransfer = tx.splits.some((s: any) => transferCategoryIds.has(s.category_id));
        if (isTransfer) continue;

        const month = tx.transacted_at.slice(0, 7);
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { income: 0, expenses: 0 });
        }
        const data = monthlyData.get(month)!;
        const amount = parseFloat(tx.amount);

        if (amount > 0) {
          data.income += amount;
        } else {
          data.expenses += Math.abs(amount);
        }
      }

      const data = months.map(month => {
        const monthData = monthlyData.get(month) || { income: 0, expenses: 0 };
        return {
          month,
          income: monthData.income,
          expenses: monthData.expenses,
          net: monthData.income - monthData.expenses,
        };
      });

      return {
        report_type: "income_vs_expenses",
        period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
        data,
      };
    }

    case "net_worth_history": {
      const accounts = getAccounts();
      const months = generateMonthList(dateRange.from!, dateRange.to!);

      // For simplicity, assume net worth is relatively stable with small monthly changes
      const currentNetWorth = accounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0);
      const monthlyGrowth = currentNetWorth * 0.005; // 0.5% monthly growth

      const data = months.map((month, idx) => {
        const monthsFromEnd = months.length - 1 - idx;
        const netWorth = currentNetWorth - (monthlyGrowth * monthsFromEnd);
        return {
          month,
          net_worth: Math.round(netWorth * 100) / 100,
        };
      });

      return {
        report_type: "net_worth_history",
        period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
        data,
      };
    }

    case "utilities": {
      const transactions = await getFilteredTransactions();
      const categories = getCategories();

      // Find utility categories (Bills & Utilities group) - match seed.py category names
      const utilityNames = ["Electric", "Gas", "Water", "Internet", "Mobile Phone", "TV/Streaming"];
      const utilityCategories = categories.filter((c: any) =>
        utilityNames.includes(c.name)
      );
      const utilityCategoryIds = new Set(utilityCategories.map((c: any) => c.id));

      // Default to monthly mode if not specified
      const mode = params.mode || "monthly";

      if (mode === "monthly") {
        // Monthly mode - spending by month for each utility
        const months = generateMonthList(dateRange.from!, dateRange.to!);
        const monthCategorySpending = new Map<string, Map<number, number>>();

        for (const tx of transactions) {
          const month = tx.transacted_at.slice(0, 7);
          if (!monthCategorySpending.has(month)) {
            monthCategorySpending.set(month, new Map());
          }
          const categoryMap = monthCategorySpending.get(month)!;

          for (const split of tx.splits) {
            if (parseFloat(split.amount) < 0 && utilityCategoryIds.has(split.category_id)) {
              const current = categoryMap.get(split.category_id) || 0;
              categoryMap.set(split.category_id, current + Math.abs(parseFloat(split.amount)));
            }
          }
        }

        const data: any[] = [];
        for (const month of months) {
          const categoryMap = monthCategorySpending.get(month);
          if (categoryMap) {
            for (const cat of utilityCategories) {
              const amount = categoryMap.get(cat.id) || 0;
              if (amount > 0) {
                data.push({ category: cat.name, month, amount });
              }
            }
          }
        }

        return {
          report_type: "utilities",
          period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
          data,
        };
      } else if (mode === "year_comparison") {
        // Year comparison mode - this year vs last year
        const currentYearStart = new Date(dateRange.from!);
        const currentYearEnd = new Date(dateRange.to!);

        const lastYearStart = new Date(currentYearStart);
        lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
        const lastYearEnd = new Date(currentYearEnd);
        lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);

        // Get spending for both periods
        const thisYearTx = await getTransactions({
          transacted_range: { from: currentYearStart, to: currentYearEnd },
          exclude_account_types: params.exclude_account_types || ["investment"],
        });

        const lastYearTx = await getTransactions({
          transacted_range: { from: lastYearStart, to: lastYearEnd },
          exclude_account_types: params.exclude_account_types || ["investment"],
        });

        const thisYearSpending = new Map<number, number>();
        const lastYearSpending = new Map<number, number>();

        for (const tx of thisYearTx) {
          for (const split of tx.splits) {
            if (parseFloat(split.amount) < 0 && utilityCategoryIds.has(split.category_id)) {
              const current = thisYearSpending.get(split.category_id) || 0;
              thisYearSpending.set(split.category_id, current + Math.abs(parseFloat(split.amount)));
            }
          }
        }

        for (const tx of lastYearTx) {
          for (const split of tx.splits) {
            if (parseFloat(split.amount) < 0 && utilityCategoryIds.has(split.category_id)) {
              const current = lastYearSpending.get(split.category_id) || 0;
              lastYearSpending.set(split.category_id, current + Math.abs(parseFloat(split.amount)));
            }
          }
        }

        const data = utilityCategories.map((cat: any) => ({
          category: cat.name,
          this_year: thisYearSpending.get(cat.id) || 0,
          last_year: lastYearSpending.get(cat.id) || 0,
        }));

        return {
          report_type: "utilities",
          period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
          data,
        };
      } else {
        // Unsupported mode - return empty
        return {
          report_type: "utilities",
          period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
          data: [],
        };
      }
    }

    case "upcoming_bills": {
      const transactions = await getTransactions({
        exclude_account_types: params.exclude_account_types || ["investment"],
      });
      const groups = getGroups();

      // Find Bills & Utilities group (matching backend behavior)
      const utilityGroup = groups.find((g: any) => g.name.toLowerCase().includes("util"));
      if (!utilityGroup) {
        return {
          report_type: "upcoming_bills",
          period: { start: new Date().toISOString(), end: new Date().toISOString() },
          data: [],
        };
      }

      // Get all category IDs in the Bills & Utilities group
      const utilityCategoryIds = new Set(utilityGroup.categories.map((c: any) => c.id));

      // Find recurring expenses (same payee, similar amounts) - ONLY from Bills & Utilities categories
      const payeeTransactions = new Map<number, typeof transactions>();

      for (const tx of transactions) {
        if (parseFloat(tx.amount) < 0) { // Only expenses
          // Check if this transaction has any splits in the Bills & Utilities group
          const hasBillCategory = tx.splits.some((split: any) => {
            // Apply category fallback logic: use split category if set, else payee default category
            const effectiveCategoryId = split.category_id !== 0
              ? split.category_id
              : (tx.payee?.category_id || 0);
            return utilityCategoryIds.has(effectiveCategoryId);
          });

          if (hasBillCategory) {
            const existing = payeeTransactions.get(tx.payee_id) || [];
            existing.push(tx);
            payeeTransactions.set(tx.payee_id, existing);
          }
        }
      }

      const data: any[] = [];
      const today = new Date();
      const lookforwardDays = params.lookforward_days || 30;

      for (const [, txs] of payeeTransactions.entries()) {
        if (txs.length >= 2) { // At least 2 transactions to establish pattern
          const amounts = txs.map((t: any) => Math.abs(parseFloat(t.amount)));
          const avgAmount = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;

          // Check if amounts are similar (within 30% to be more lenient)
          const isSimilar = amounts.every((a: number) => Math.abs(a - avgAmount) / avgAmount < 0.3);

          if (isSimilar) {
            // Sort transactions by date descending (most recent first)
            const sortedTxs = [...txs].sort((a, b) =>
              new Date(b.transacted_at).getTime() - new Date(a.transacted_at).getTime()
            );

            const mostRecentTx = sortedTxs[0]; // Get most recent, not oldest
            const lastDate = new Date(mostRecentTx.transacted_at);

            // Assume monthly recurrence - calculate next expected date
            const nextDate = new Date(lastDate);
            nextDate.setMonth(nextDate.getMonth() + 1);

            const daysUntil = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            // Include bills that are due within the lookforward period (even if slightly past)
            if (daysUntil >= -5 && daysUntil <= lookforwardDays) {
              data.push({
                payee: mostRecentTx.payee.name,
                category: mostRecentTx.splits[0]?.category.name || "Uncategorized",
                average_amount: Math.round(avgAmount * 100) / 100,
                expected_date: nextDate.toISOString().split('T')[0],
                recurrence_type: "monthly",
                days_until_due: Math.max(0, daysUntil), // Show 0 for overdue
                last_transaction_date: lastDate.toISOString().split('T')[0],
              });
            }
          }
        }
      }

      // Sort by days until due and apply limit
      data.sort((a, b) => a.days_until_due - b.days_until_due);
      const limitedData = data.slice(0, params.limit || 10);

      return {
        report_type: "upcoming_bills",
        period: { start: today.toISOString(), end: new Date(today.getTime() + lookforwardDays * 24 * 60 * 60 * 1000).toISOString() },
        data: limitedData,
      };
    }

    case "paycheck_analysis": {
      const transactions = await getFilteredTransactions();
      const categories = getCategories();

      // Find Paycheck or Salary category (backend uses Paycheck with id 51, mock may use Salary)
      const paycheckCategory = categories.find((c: any) => c.name === "Paycheck") ||
        categories.find((c: any) => c.name === "Salary");
      const paycheckCategoryId = paycheckCategory?.id || 51;

      // Filter for paycheck transactions (positive amounts in Paycheck category)
      const paycheckTransactions = transactions.filter((tx: any) => {
        if (parseFloat(tx.amount) <= 0) return false;

        // Check if any split is in the Paycheck category
        return tx.splits.some((split: any) => {
          const effectiveCategoryId = split.category_id !== 0
            ? split.category_id
            : (tx.payee?.category_id || 0);
          return effectiveCategoryId === paycheckCategoryId;
        });
      });

      if (paycheckTransactions.length === 0) {
        return {
          report_type: "paycheck_analysis",
          period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
          data: [{
            paychecks: [],
            summary: {
              total_count: 0,
              average_amount: 0,
              median_amount: 0,
              std_deviation: 0,
              min_amount: 0,
              max_amount: 0,
              total_income: 0,
            },
            by_payee: {},
            trend: "insufficient_data",
            anomalies: [],
          }],
        };
      }

      // Extract paycheck data
      const paychecks = paycheckTransactions.map((tx: any) => ({
        id: tx.id,
        date: tx.transacted_at.split('T')[0],
        amount: parseFloat(tx.amount),
        payee: tx.payee?.name || "Unknown",
        account: tx.account?.display_name || "",
        description: tx.description || "",
      }));

      // Sort by date descending (most recent first)
      paychecks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const amounts = paychecks.map((pc: any) => pc.amount);

      // Calculate summary statistics
      const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const median = (arr: number[]) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      };
      const stdDev = (arr: number[]) => {
        const avg = mean(arr);
        const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
        return Math.sqrt(mean(squareDiffs));
      };

      const avgAmount = mean(amounts);
      const medianAmount = median(amounts);
      const stdDeviation = amounts.length > 1 ? stdDev(amounts) : 0;
      const minAmount = Math.min(...amounts);
      const maxAmount = Math.max(...amounts);
      const totalIncome = amounts.reduce((a, b) => a + b, 0);

      // Group by payee
      const byPayee: Record<string, any> = {};
      const payeeData: Record<string, { amounts: number[]; dates: string[] }> = {};

      for (const pc of paychecks) {
        if (!payeeData[pc.payee]) {
          payeeData[pc.payee] = { amounts: [], dates: [] };
        }
        payeeData[pc.payee].amounts.push(pc.amount);
        payeeData[pc.payee].dates.push(pc.date);
      }

      for (const [payee, data] of Object.entries(payeeData)) {
        const payeeAvg = mean(data.amounts);
        const payeeStd = data.amounts.length > 1 ? stdDev(data.amounts) : 0;

        // Calculate trend (compare first half to second half)
        let trend: "increasing" | "decreasing" | "stable" | "insufficient_data" = "insufficient_data";
        if (data.amounts.length >= 4) {
          const mid = Math.floor(data.amounts.length / 2);
          // Amounts are already sorted by date descending, so reverse for trend calc
          const firstHalfAvg = mean(data.amounts.slice(mid)); // older
          const secondHalfAvg = mean(data.amounts.slice(0, mid)); // recent
          if (secondHalfAvg > firstHalfAvg * 1.05) {
            trend = "increasing";
          } else if (secondHalfAvg < firstHalfAvg * 0.95) {
            trend = "decreasing";
          } else {
            trend = "stable";
          }
        }

        byPayee[payee] = {
          count: data.amounts.length,
          average_amount: Math.round(payeeAvg * 100) / 100,
          std_deviation: Math.round(payeeStd * 100) / 100,
          min_amount: Math.round(Math.min(...data.amounts) * 100) / 100,
          max_amount: Math.round(Math.max(...data.amounts) * 100) / 100,
          total_income: Math.round(data.amounts.reduce((a, b) => a + b, 0) * 100) / 100,
          trend,
          last_paycheck_date: data.dates[0], // Already sorted descending
        };
      }

      // Calculate overall trend
      let overallTrend: "increasing" | "decreasing" | "stable" | "insufficient_data" = "insufficient_data";
      if (amounts.length >= 4) {
        const mid = Math.floor(amounts.length / 2);
        const firstHalfAvg = mean(amounts.slice(mid)); // older
        const secondHalfAvg = mean(amounts.slice(0, mid)); // recent
        if (secondHalfAvg > firstHalfAvg * 1.05) {
          overallTrend = "increasing";
        } else if (secondHalfAvg < firstHalfAvg * 0.95) {
          overallTrend = "decreasing";
        } else {
          overallTrend = "stable";
        }
      }

      // Detect anomalies (simple approach: more than 2 std devs from mean)
      const anomalies = [];
      if (amounts.length >= 3 && stdDeviation > 0) {
        for (const pc of paychecks) {
          const deviation = Math.abs(pc.amount - avgAmount) / stdDeviation;
          if (deviation > 2) {
            anomalies.push({
              ...pc,
              deviation_sigma: Math.round(deviation * 100) / 100,
              difference_from_avg: Math.round((pc.amount - avgAmount) * 100) / 100,
              expected_amount: Math.round(avgAmount * 100) / 100,
            });
          }
        }
      }

      return {
        report_type: "paycheck_analysis",
        period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
        data: [{
          paychecks,
          summary: {
            total_count: amounts.length,
            average_amount: Math.round(avgAmount * 100) / 100,
            median_amount: Math.round(medianAmount * 100) / 100,
            std_deviation: Math.round(stdDeviation * 100) / 100,
            min_amount: Math.round(minAmount * 100) / 100,
            max_amount: Math.round(maxAmount * 100) / 100,
            total_income: Math.round(totalIncome * 100) / 100,
          },
          by_payee: byPayee,
          trend: overallTrend,
          anomalies,
        }],
      };
    }

    case "top_transactions": {
      const transactions = await getFilteredTransactions();
      const categories = getCategories();

      // Find transfer-related categories to exclude (matching backend behavior)
      const transferCategoryNames = ["Transfer", "Credit Card Payment"];
      const transferCategoryIds = new Set(
        categories
          .filter((c: any) => transferCategoryNames.includes(c.name))
          .map((c: any) => c.id)
      );

      // Filter for expenses only, exclude transfers, and sort by amount (most negative first)
      const expenseTransactions = transactions
        .filter((tx: any) => {
          // Only expenses
          if (parseFloat(tx.amount) >= 0) return false;

          // Skip transfers
          const isTransfer = tx.splits.some((s: any) => transferCategoryIds.has(s.category_id));
          if (isTransfer) return false;

          return true;
        })
        .sort((a: any, b: any) => parseFloat(a.amount) - parseFloat(b.amount)) // Most negative first
        .slice(0, params.limit || 5);

      const data = expenseTransactions.map((tx: any) => {
        // Get effective category using fallback logic
        const split = tx.splits[0];
        const effectiveCategoryId = split?.category_id !== 0
          ? split?.category_id
          : (tx.payee?.category_id || 0);
        const effectiveCategory = categories.find((c: any) => c.id === effectiveCategoryId);

        return {
          id: tx.id,
          date: tx.transacted_at.split('T')[0],
          payee: tx.payee?.name || null,
          category: effectiveCategory?.name || "Uncategorized",
          account: tx.account?.display_name || tx.account?.name || null,
          amount: parseFloat(tx.amount),
          description: tx.description || null,
        };
      });

      return {
        report_type: "top_transactions",
        period: { start: dateRange.from!.toISOString(), end: dateRange.to!.toISOString() },
        data,
      };
    }

    default:
      // Default empty response
      return {
        report_type,
        period: {
          start: dateRange.from?.toISOString() || "",
          end: dateRange.to?.toISOString() || "",
        },
        data: [],
      };
  }
}
