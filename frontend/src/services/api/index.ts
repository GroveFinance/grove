/**
 * API layer with mock mode support
 *
 * When VITE_API_MODE=mock, all API calls use generated mock data
 * Otherwise, uses real backend API
 */

const API_MODE = import.meta.env.VITE_API_MODE || "real";
const USE_MOCK = API_MODE === "mock" || API_MODE === "demo";

// Import from the appropriate module based on mode
import * as mockAPI from "./mock";
import * as realAccounts from "./accounts";
import * as realTransactions from "./transactions";
import * as realCategories from "./categories";
import * as realGroups from "./groups";
import * as realPayees from "./payee";
import * as realReports from "./reports";
import * as realHoldings from "./holdings";
import * as realOrgs from "./orgs";

// Export the appropriate API functions
export const getAccounts = USE_MOCK ? mockAPI.getAccounts : realAccounts.getAccounts;
export const updateAccount = USE_MOCK ? mockAPI.updateAccount : realAccounts.updateAccount;
export const deleteAccount = USE_MOCK ? mockAPI.deleteAccount : realAccounts.deleteAccount;
export const getDuplicateAccounts = USE_MOCK ? mockAPI.getDuplicateAccounts : realAccounts.getDuplicateAccounts;
export const mergeAccounts = USE_MOCK ? mockAPI.mergeAccounts : realAccounts.mergeAccounts;

export const getTransactions = USE_MOCK ? mockAPI.getTransactions : realTransactions.getTransactions;
export const updateTransaction = USE_MOCK ? mockAPI.updateTransaction : realTransactions.updateTransaction;
export const getTransactionsSummary = USE_MOCK ? mockAPI.getTransactionsSummary : realTransactions.getTransactionsSummary;

export const getCategories = USE_MOCK ? mockAPI.getCategories : realCategories.getCategories;
export const updateCategory = USE_MOCK ? mockAPI.updateCategory : realCategories.updateCategory;
export const createCategory = USE_MOCK ? mockAPI.createCategory : realCategories.createCategory;
export const deleteCategory = USE_MOCK ? mockAPI.deleteCategory : realCategories.deleteCategory;

export const getGroups = USE_MOCK ? mockAPI.getGroups : realGroups.getGroups;
export const updateGroup = USE_MOCK ? mockAPI.updateGroup : realGroups.updateGroup;
export const createGroup = USE_MOCK ? mockAPI.createGroup : realGroups.createGroup;
export const deleteGroup = USE_MOCK ? mockAPI.deleteGroup : realGroups.deleteGroup;

export const getPayees = USE_MOCK ? mockAPI.getPayees : realPayees.getPayees;
export const updatePayee = USE_MOCK ? mockAPI.updatePayee : realPayees.updatePayee;

export const getReport = USE_MOCK ? mockAPI.getReport : realReports.getReport;

export const getHoldings = USE_MOCK ? mockAPI.getHoldings : realHoldings.getHoldings;

export const getOrg = USE_MOCK ? mockAPI.getOrg : realOrgs.getOrg;
export const getOrgs = USE_MOCK ? mockAPI.getOrgs : realOrgs.getOrg;  // Note: realOrgs only exports getOrg, not getOrgs

// Re-export types
export type { TransactionUpdatePayload, TransactionSummary } from "./transactions";
export type { GetHoldingsParams } from "./holdings";
export type { DuplicateGroup } from "./accounts";

// Sync API - conditionally mock
import * as realSync from "./sync";

export const getSync = USE_MOCK ? mockAPI.getSync : realSync.getSync;
export const createSync = USE_MOCK ? mockAPI.createSync : realSync.createSync;
export const updateSync = USE_MOCK ? mockAPI.updateSync : realSync.updateSync;
export const triggerSync = USE_MOCK ? mockAPI.triggerSync : realSync.triggerSync;
export const triggerSyncFromDate = USE_MOCK ? mockAPI.triggerSyncFromDate : realSync.triggerSyncFromDate;
export const getLatestSyncRun: typeof realSync.getLatestSyncRun = USE_MOCK ? mockAPI.getLatestSyncRun : realSync.getLatestSyncRun;
export const getSyncRuns: typeof realSync.getSyncRuns = USE_MOCK ? mockAPI.getSyncRuns : realSync.getSyncRuns;

// Account balance is always from real API (not critical for demo)
export * from "./account_balance";
