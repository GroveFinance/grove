/**
 * Main data generator that orchestrates all mock data generation
 */

import type { MockConfig } from "../config";
import {
  SeededRandom,
  MockDateUtils,
  DEFAULT_CONFIG,
  DEMO_CONFIG,
  TEST_CONFIG,
} from "../config";
import { generateGroups, getAllCategories } from "./categories";
import { generateOrgs, generateAccounts } from "./accounts";
import { generatePayees } from "./payees";
import { generateTransactions } from "./transactions";
import { generateHoldings } from "./holdings";

export interface MockDataSet {
  groups: ReturnType<typeof generateGroups>;
  categories: ReturnType<typeof getAllCategories>;
  orgs: ReturnType<typeof generateOrgs>;
  accounts: ReturnType<typeof generateAccounts>;
  payees: ReturnType<typeof generatePayees>;
  transactions: ReturnType<typeof generateTransactions>;
  holdings: ReturnType<typeof generateHoldings>;
}

/**
 * Generate a complete dataset
 */
export function generateMockData(
  config: MockConfig = DEFAULT_CONFIG
): MockDataSet {
  const rng = new SeededRandom(config.seed || Date.now());
  const dateUtils = new MockDateUtils(config.baseDate);

  // Generate in dependency order
  const groups = generateGroups(rng);
  const categories = getAllCategories(groups);
  const orgs = generateOrgs(rng);
  const accounts = generateAccounts(orgs, rng, {
    includeEdgeCases: config.includeEdgeCases,
    baseDate: config.baseDate,
  });
  const payees = generatePayees(categories, rng);
  const transactions = generateTransactions(
    accounts,
    payees,
    categories,
    config,
    rng,
    dateUtils
  );
  const holdings = generateHoldings(accounts, rng, {
    baseDate: config.baseDate,
  });

  return {
    groups,
    categories,
    orgs,
    accounts,
    payees,
    transactions,
    holdings,
  };
}

/**
 * Scenario presets
 */
export type ScenarioType =
  | "default"
  | "demo"
  | "test"
  | "new-user"
  | "overbudget"
  | "investment-heavy"
  | "minimal";

export function generateScenario(scenario: ScenarioType): MockDataSet {
  switch (scenario) {
    case "demo":
      return generateMockData(DEMO_CONFIG);

    case "test":
      return generateMockData(TEST_CONFIG);

    case "new-user":
      return generateMockData({
        ...DEFAULT_CONFIG,
        transactionHistoryDays: 7,
        transactionsPerDay: 1,
      });

    case "overbudget":
      return generateMockData({
        ...DEFAULT_CONFIG,
        transactionsPerDay: 6, // More spending
        seed: 54321,
      });

    case "investment-heavy": {
      // Generate data with more investment accounts
      const rng = new SeededRandom(DEFAULT_CONFIG.seed || 12345);
      const dateUtils = new MockDateUtils(DEFAULT_CONFIG.baseDate);

      const groups = generateGroups(rng);
      const categories = getAllCategories(groups);
      const orgs = generateOrgs(rng);

      // Manually create more investment accounts
      const accounts = generateAccounts(orgs, rng, {
        includeEdgeCases: false,
        baseDate: DEFAULT_CONFIG.baseDate,
      });

      const payees = generatePayees(categories, rng);
      const transactions = generateTransactions(
        accounts,
        payees,
        categories,
        DEFAULT_CONFIG,
        rng,
        dateUtils
      );
      const holdings = generateHoldings(accounts, rng, {
        baseDate: DEFAULT_CONFIG.baseDate,
      });

      return {
        groups,
        categories,
        orgs,
        accounts,
        payees,
        transactions,
        holdings,
      };
    }

    case "minimal":
      return generateMockData({
        ...DEFAULT_CONFIG,
        transactionHistoryDays: 14,
        transactionsPerDay: 1,
        seed: 11111,
      });

    case "default":
    default:
      return generateMockData(DEFAULT_CONFIG);
  }
}

// Export all generator functions for granular control
export * from "./categories";
export * from "./accounts";
export * from "./payees";
export * from "./transactions";
export * from "./holdings";
