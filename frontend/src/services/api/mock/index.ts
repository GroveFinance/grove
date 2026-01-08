/**
 * Mock API implementation
 * Provides a drop-in replacement for the real API using generated mock data
 */

import type {
  Account,
  Category,
  Group,
  Payee,
  Transaction,
  Holding,
  Org,
  GetTransactionsParams,
  GetAccountsParams,
  ReportOut,
  GetReportParams,
  CategoryUpdate,
  GroupUpdate,
  PayeeUpdate,
} from "@/types";
import { generateMockReport } from "./reports";

// Transaction update payload type
interface TransactionUpdatePayload {
  splits?: Array<{
    category_id: number;
    amount: string;
  }>;
  memo?: string;
}
import { generateScenario, type ScenarioType, type MockDataSet } from "./generators";

/**
 * Mock data store (singleton)
 */
class MockDataStore {
  private data: MockDataSet | null = null;
  private scenario: ScenarioType = "demo";

  initialize(scenario: ScenarioType = "demo") {
    this.scenario = scenario;
    this.data = generateScenario(scenario);
  }

  getData(): MockDataSet {
    if (!this.data) {
      this.initialize();
    }
    return this.data!;
  }

  reset(scenario?: ScenarioType) {
    this.initialize(scenario || this.scenario);
  }
}

const store = new MockDataStore();

/**
 * Initialize mock API with a specific scenario
 */
export function initializeMockAPI(scenario: ScenarioType = "demo") {
  store.initialize(scenario);
}

/**
 * Reset mock data (useful for testing)
 */
export function resetMockData(scenario?: ScenarioType) {
  store.reset(scenario);
}

/**
 * Simulate network delay
 */
function delay(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Account API
// ============================================================================

export async function getAccounts(
  params: GetAccountsParams = {}
): Promise<Account[]> {
  await delay();
  let accounts = store.getData().accounts;

  if (params.org_id) {
    accounts = accounts.filter((a) => a.org_domain === params.org_id);
  }

  if (params.is_hidden !== undefined) {
    accounts = accounts.filter((a) => a.is_hidden === params.is_hidden);
  }

  if (params.account_id) {
    accounts = accounts.filter((a) => a.account_id === params.account_id);
  }

  return accounts;
}

export async function updateAccount(
  accountId: string,
  updates: Partial<Pick<Account, "account_type" | "is_hidden" | "alt_name">>
): Promise<Account> {
  await delay();
  const accounts = store.getData().accounts;
  const account = accounts.find((a) => a.account_id === accountId);

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  Object.assign(account, updates);
  return account;
}

export async function deleteAccount(accountId: string): Promise<Account> {
  await delay();
  const data = store.getData();
  const accountIndex = data.accounts.findIndex((a) => a.account_id === accountId);

  if (accountIndex === -1) {
    throw new Error(`Account ${accountId} not found`);
  }

  const [deleted] = data.accounts.splice(accountIndex, 1);
  return deleted;
}

export async function getDuplicateAccounts(): Promise<any[]> {
  await delay();
  // No duplicates in mock data
  return [];
}

export async function mergeAccounts(): Promise<any> {
  await delay();
  throw new Error("Merge not supported in mock mode");
}

// ============================================================================
// Transaction API
// ============================================================================

export async function getTransactions(
  params: GetTransactionsParams = {}
): Promise<Transaction[]> {
  await delay();
  let transactions = [...store.getData().transactions];

  // Filter by account_ids
  if (params.account_ids && params.account_ids.length > 0) {
    transactions = transactions.filter((t) =>
      params.account_ids!.includes(t.account_id)
    );
  }

  // Filter by excluded_account_ids
  if (params.excluded_account_ids && params.excluded_account_ids.length > 0) {
    transactions = transactions.filter(
      (t) => !params.excluded_account_ids!.includes(t.account_id)
    );
  }

  // Filter by category_ids
  if (params.category_ids && params.category_ids.length > 0) {
    transactions = transactions.filter((t) =>
      t.splits.some((s) => params.category_ids!.includes(s.category_id))
    );
  }

  // Filter by excluded_category_ids
  if (params.excluded_category_ids && params.excluded_category_ids.length > 0) {
    transactions = transactions.filter(
      (t) =>
        !t.splits.some((s) =>
          params.excluded_category_ids!.includes(s.category_id)
        )
    );
  }

  // Filter by payee_ids
  if (params.payee_ids && params.payee_ids.length > 0) {
    transactions = transactions.filter((t) =>
      params.payee_ids!.includes(t.payee_id)
    );
  }

  // Filter by payee_name
  if (params.payee_name) {
    transactions = transactions.filter((t) =>
      t.payee.name.toLowerCase().includes(params.payee_name!.toLowerCase())
    );
  }

  // Filter by date range
  if (params.transacted_range) {
    const { from, to } = params.transacted_range;
    transactions = transactions.filter((t) => {
      const date = new Date(t.transacted_at);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  }

  // Filter by account_types
  if (params.account_types && params.account_types.length > 0) {
    transactions = transactions.filter(
      (t) => t.account && params.account_types!.includes(t.account.account_type || "")
    );
  }

  // Filter by exclude_account_types
  if (params.exclude_account_types && params.exclude_account_types.length > 0) {
    transactions = transactions.filter(
      (t) =>
        !t.account ||
        !params.exclude_account_types!.includes(t.account.account_type || "")
    );
  }

  // Sort
  const sortBy = params.sort_by || "transacted_at";
  const sortOrder = params.sort_order || "desc";

  transactions.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    if (sortBy === "amount") {
      aVal = parseFloat(a.amount);
      bVal = parseFloat(b.amount);
    } else {
      aVal = new Date(a[sortBy]).getTime();
      bVal = new Date(b[sortBy]).getTime();
    }

    return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
  });

  // Pagination
  const skip = params.skip || 0;
  const limit = params.limit || transactions.length;

  return transactions.slice(skip, skip + limit);
}

export async function updateTransaction(
  id: string,
  data: TransactionUpdatePayload
): Promise<Transaction> {
  await delay();
  const transactions = store.getData().transactions;
  const transaction = transactions.find((t) => t.id === id);

  if (!transaction) {
    throw new Error(`Transaction ${id} not found`);
  }

  if (data.splits) {
    // Update splits
    const categories = store.getData().categories;
    transaction.splits = data.splits.map((s: { category_id: number; amount: string }, idx: number) => ({
      id: transaction.splits[idx]?.id || idx,
      transaction_id: id,
      category_id: s.category_id,
      category: categories.find((c) => c.id === s.category_id)!,
      amount: s.amount,
    }));
  }

  if (data.memo !== undefined) {
    transaction.memo = data.memo;
  }

  return transaction;
}

export async function getTransactionsSummary(
  params: GetTransactionsParams = {}
): Promise<any> {
  await delay();
  const transactions = await getTransactions(params);

  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of transactions) {
    const amount = parseFloat(tx.amount);
    if (amount > 0) {
      totalIncome += amount;
    } else {
      totalExpense += Math.abs(amount);
    }
  }

  return {
    count: transactions.length,
    total_income: totalIncome,
    total_expense: totalExpense,
    net: totalIncome - totalExpense,
  };
}

// ============================================================================
// Category API
// ============================================================================

export async function getCategories(): Promise<Category[]> {
  await delay();
  return store.getData().categories;
}

export async function updateCategory(
  id: number,
  data: CategoryUpdate
): Promise<Category> {
  await delay();
  const categories = store.getData().categories;
  const category = categories.find((c) => c.id === id);

  if (!category) {
    throw new Error(`Category ${id} not found`);
  }

  Object.assign(category, data);
  return category;
}

export async function createCategory(data: any): Promise<Category> {
  await delay();
  const categories = store.getData().categories;
  const newId = Math.max(...categories.map((c) => c.id)) + 1;

  const newCategory: Category = {
    id: newId,
    name: data.name,
    budget: data.budget || null,
  };

  categories.push(newCategory);
  return newCategory;
}

export async function deleteCategory(id: number): Promise<{ success: boolean }> {
  await delay();
  const data = store.getData();
  const index = data.categories.findIndex((c) => c.id === id);

  if (index === -1) {
    throw new Error(`Category ${id} not found`);
  }

  data.categories.splice(index, 1);
  return { success: true };
}

// ============================================================================
// Group API
// ============================================================================

export async function getGroups(): Promise<Group[]> {
  await delay();
  return store.getData().groups;
}

export async function updateGroup(id: number, data: GroupUpdate): Promise<Group> {
  await delay();
  const groups = store.getData().groups;
  const group = groups.find((g) => g.id === id);

  if (!group) {
    throw new Error(`Group ${id} not found`);
  }

  Object.assign(group, data);
  return group;
}

export async function createGroup(data: any): Promise<Group> {
  await delay();
  const groups = store.getData().groups;
  const newId = Math.max(...groups.map((g) => g.id)) + 1;

  const newGroup: Group = {
    id: newId,
    name: data.name,
    categories: [],
  };

  groups.push(newGroup);
  return newGroup;
}

export async function deleteGroup(id: number): Promise<{ success: boolean }> {
  await delay();
  const data = store.getData();
  const index = data.groups.findIndex((g) => g.id === id);

  if (index === -1) {
    throw new Error(`Group ${id} not found`);
  }

  data.groups.splice(index, 1);
  return { success: true };
}

// ============================================================================
// Payee API
// ============================================================================

export async function getPayees(): Promise<Payee[]> {
  await delay();
  return store.getData().payees;
}

export async function updatePayee(id: number, data: PayeeUpdate): Promise<Payee> {
  await delay();
  const payees = store.getData().payees;
  const payee = payees.find((p) => p.id === id);

  if (!payee) {
    throw new Error(`Payee ${id} not found`);
  }

  if (data.category_id !== undefined && data.category_id !== null) {
    payee.category_id = data.category_id;
    const category = store.getData().categories.find((c) => c.id === data.category_id);
    if (category) {
      payee.category = category;
    }
  }

  return payee;
}

// ============================================================================
// Holdings API
// ============================================================================

export async function getHoldings(params: any = {}): Promise<Holding[]> {
  await delay();
  let holdings = store.getData().holdings;

  if (params.account_id) {
    holdings = holdings.filter((h) => h.account_id === params.account_id);
  }

  return holdings;
}

// ============================================================================
// Org API
// ============================================================================

export async function getOrg(params: any = {}): Promise<Org> {
  await delay();
  const orgs = store.getData().orgs;

  if (params.id) {
    const org = orgs.find((o) => o.id === params.id);
    if (!org) {
      throw new Error(`Org ${params.id} not found`);
    }
    return org;
  }

  // Return first org if no ID specified
  return orgs[0];
}

export async function getOrgs(): Promise<Org[]> {
  await delay();
  return store.getData().orgs;
}

// ============================================================================
// Report API
// ============================================================================

export async function getReport(params: GetReportParams): Promise<ReportOut> {
  await delay();

  const result = await generateMockReport(
    params,
    getTransactions,
    () => store.getData().accounts,
    () => store.getData().categories,
    () => store.getData().groups
  );

  return result;
}

// ============================================================================
// Sync API (mock implementations)
// ============================================================================

// Mock sync config - pretend we have a SimpleFin sync configured
const mockSyncConfig = {
  id: 1,
  name: "simplefin",
  provider_name: "simplefin",
  config: { setup_token: "mock_token" },
  schedule: "0 2 * * *",
  enabled: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_sync: new Date(Date.now() - 3000000).toISOString(), // 50 min ago
  errors: null,
};

const mockLatestSyncRun = {
  id: 1,
  sync_config_id: 1,
  started_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  completed_at: new Date(Date.now() - 3000000).toISOString(), // 50 min ago
  status: "completed" as const,
  accounts_processed: 5,
  transactions_found: 127,
  holdings_found: 42,
  error_message: null,
  details: {
    "acc-00000001-mock": { name: "Checking", transactions: 45, holdings: 0 },
    "acc-00000002-mock": { name: "Savings", transactions: 12, holdings: 0 },
    "acc-00000003-mock": { name: "Credit Card", transactions: 38, holdings: 0 },
    "acc-00000004-mock": { name: "Brokerage", transactions: 32, holdings: 42 },
  },
};

export async function getSync(name: string): Promise<any> {
  await delay();
  if (name === "simplefin") {
    return mockSyncConfig;
  }
  return null;
}

export async function getSyncConfigs(): Promise<any[]> {
  await delay();
  return [mockSyncConfig];
}

export async function createSync(): Promise<any> {
  await delay();
  return mockSyncConfig;
}

export async function updateSync(): Promise<any> {
  await delay();
  return mockSyncConfig;
}

export async function triggerSync(): Promise<any> {
  await delay();
  return { status: "started", message: "Mock sync triggered" };
}

export async function triggerSyncFromDate(): Promise<any> {
  await delay();
  return {
    status: "started",
    sync: "simplefin",
    from_date: new Date().toISOString(),
    days_back: 30,
  };
}

export async function getLatestSyncRun(_name = "simplefin"): Promise<any> {
  await delay();
  // In mock mode, we only have simplefin data
  return mockLatestSyncRun;
}

export async function getSyncRuns(_name = "simplefin", _limit = 10): Promise<any[]> {
  await delay();
  return [mockLatestSyncRun];
}
