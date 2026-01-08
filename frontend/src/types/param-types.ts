import type { DateRange } from "react-day-picker";

export interface GetTransactionsParams {
  account_ids?: string[]
  excluded_account_ids?: string[]
  category_ids?: number[]
  excluded_category_ids?: number[]
  payee_ids?: number[]
  payee_name?: string
  transacted_range?: DateRange
  skip?: number
  limit?: number
  sort_by?: "transacted_at" | "posted" | "amount"
  sort_order?: "asc" | "desc"
  skip_transfers?: boolean
  split_mode?: boolean
  account_types?: string[]
  exclude_account_types?: string[]
}

export interface GetAccountsParams {
  org_id?: string
  is_hidden?: boolean
  account_id?: string
}

export interface GetOrgParams {
  id?: number; // If not provided, fetch all orgs
}

export interface GetReportParams {
  report_type: "summary" | "income_vs_expenses" | "net_worth_history" | "category_trends" | "utilities" | "budget_usage" | "budget_trends" | "upcoming_bills" | "paycheck_analysis" | "top_transactions";
  dateRange?: DateRange; // alternative to start/end
  start?: string; // ISO date string
  end?: string;   // ISO date string
  limit?: number;
  mode?: "per_month" | "global" | "monthly" | "year_comparison"; // per_month/global for category_trends, monthly/year_comparison for utilities
  exclude_account_types?: string[]; // defaults to ["investment"] for most reports
  lookforward_days?: number; // only used for upcoming_bills
  lookback_months?: number; // only used for paycheck_analysis
}


export interface UseTransactionsParams {
  enabled?: boolean
  account_ids?: string[]
  excluded_account_ids?: string[]
  category_ids?: number[]
  excluded_category_ids?: number[]
  payee_ids?: number[]
  payee_name?: string
  transacted_range?: DateRange
  skip?: number
  limit?: number
  sort_by?: "transacted_at" | "posted" | "amount"
  sort_order?: "asc" | "desc"
  skip_transfers?: boolean
  split_mode?: boolean
  account_types?: string[]
  exclude_account_types?: string[]
}