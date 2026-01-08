export type AccountType = "bank" | "credit_card" | "investment" | "loan";

export const ACCOUNT_TYPE_OPTIONS = [
  { value: "bank", label: "Bank Accounts" },
  { value: "credit_card", label: "Credit Cards" },
  { value: "investment", label: "Investments" },
  { value: "loan", label: "Loans" },
  { value: "other", label: "Other" },
] as const;

// Generic API response wrapper (specifically for list endpoints with pagination)
export type ApiResponse<T> = {
  data: T
  total?: number         // total items (for paging)
  page?: number          // current page
  page_size?: number     // items per page
  next_page?: number     // optional cursor-based
  prev_page?: number
}

export interface AccountUpdate {
  name?: string;
  currency?: string;
  org_id?: string;
  account_type?: AccountType | null;
  is_hidden?: boolean; // Whether this account should be hidden from views
}

export interface Account {
  account_id: string;      // string UUID
  name: string;
  alt_name?: string | null;
  display_name: string;
  currency: string;
  account_type: AccountType | null;
  org_name: string;
  org_domain: string;
  balance: number | null;
  balance_date?: string | null;
  created_at?: string | null;
  is_hidden?: boolean;
}


export interface Category {
  id: number;
  name: string;
  budget?: number | null;
}

export interface CategoryUpdate {
  name?: string;
  budget?: number | null;
  group_id?: number;
}

export interface CategoryCreate {
  name: string;
  budget?: number;
  group_id: number;
}

export interface Group {
  id: number;
  name: string;
  categories: Category[];
}

export interface GroupUpdate {
  name?: string;
}

export interface GroupCreate {
  name: string;
}

export interface Payee {
  id: number;
  name: string;
  category_id: number;
  category: Category;
}

export interface Org {
  id: number;
  name: string;
  domain: string;
}

export interface ReportOut<T = MonthSeries> {
  report_type: string | null; // e.g., "spending", "income", etc.
  period: { start: string; end: string; }; // { "start": "2025-01-01", "end": "2025-08-21" }
  data: T[];  // Array of data points (MonthSeries, UpcomingBillDataPoint, etc.)
}

export interface MonthSeries {
  month: string;   // "YYYY-MM"
  category: string | null;
  category_id?: number; // added to help with linking
  group_name?: string; // category group name
  total: number;
}

export interface IncomeExpenseDataPoint {
  month: string;   // "YYYY-MM"
  income: number;
  expenses: number;
  net: number;
  paycheck_income: number;
}

export interface NetWorthDataPoint {
  month: string;   // "YYYY-MM"
  net_worth: number;
}

export interface UpcomingBillDataPoint {
  payee: string;
  category: string;
  average_amount: number;
  expected_date: string;  // ISO date format
  recurrence_type: string;  // "monthly", "quarterly", "annual", etc.
  days_until_due: number;
  last_transaction_date?: string;  // ISO date format
}

export interface BudgetUsageDataPoint {
  category_id: number;
  category: string;
  budget: number;
  actual: number;
  utilization: number;  // percentage (0-1+)
  over_budget: boolean;
}

export interface TopTransactionDataPoint {
  id: string;
  date: string;  // ISO date format
  payee: string | null;
  category: string;
  account: string | null;
  amount: number;
  description: string | null;
}

export interface BudgetTrendDataPoint {
  month: string;  // "YYYY-MM"
  category_id: number;
  category: string;
  budget: number;
  spent: number;
}

export interface Transaction {
  id: string; // looks like UUID-ish string from API
  account_id: string;
  account: Account | null;
  amount: string; // API sends it as string
  posted: string; // ISO timestamp
  transacted_at: string; // ISO timestamp
  payee_id: number;
  description: string;
  memo: string;
  category_id: number;
  payee: Payee;
  category: Category;
  splits: TransactionSplit[];
}

export interface TransactionSplit {
  id: number;
  transaction_id: string; // UUID of parent transaction
  category_id: number;
  category: Category;
  amount: string; // API sends it as string
}

export interface SyncItem {
  name?: string;
  provider_name?: string;
  config?: Record<string, unknown>;
  active?: boolean;
  schedule?: string | null;
  last_sync?: string | null;
  errors?: string | null;
  id?: number;
}

export interface SyncRun {
  id: number;
  sync_config_id: number;
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  accounts_processed: number;
  transactions_found: number;
  holdings_found: number;
  error_message: string | null;
  details: Record<string, { name: string; transactions: number; holdings: number }> | null;
}

export interface Holding {
  id: string;
  account_id: string;
  created: string; // ISO timestamp
  currency: string;
  cost_basis: string; // Decimal as string
  description: string | null;
  market_value: string; // Decimal as string
  purchase_price: string; // Decimal as string
  shares: string; // Decimal as string
  symbol: string;
}