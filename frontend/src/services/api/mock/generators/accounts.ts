import type { Account, AccountType, Org } from "@/types";
import type { SeededRandom } from "../config";

/**
 * Generate realistic financial institutions (orgs) and accounts
 */

interface OrgData {
  name: string;
  domain: string;
}

const ORGS: OrgData[] = [
  { name: "Chase", domain: "chase.com" },
  { name: "Bank of America", domain: "bankofamerica.com" },
  { name: "Wells Fargo", domain: "wellsfargo.com" },
  { name: "Citi", domain: "citi.com" },
  { name: "Fidelity", domain: "fidelity.com" },
  { name: "Vanguard", domain: "vanguard.com" },
  { name: "Charles Schwab", domain: "schwab.com" },
  { name: "American Express", domain: "americanexpress.com" },
  { name: "Capital One", domain: "capitalone.com" },
];

interface AccountTemplate {
  namePattern: string;
  type: AccountType;
  balanceRange: [number, number];
  currency: string;
}

const ACCOUNT_TEMPLATES: Record<AccountType | "other", AccountTemplate[]> = {
  bank: [
    {
      namePattern: "Checking",
      type: "bank",
      balanceRange: [1000, 15000],
      currency: "USD",
    },
    {
      namePattern: "Savings",
      type: "bank",
      balanceRange: [5000, 50000],
      currency: "USD",
    },
    {
      namePattern: "High Yield Savings",
      type: "bank",
      balanceRange: [10000, 100000],
      currency: "USD",
    },
  ],
  credit_card: [
    {
      namePattern: "Visa",
      type: "credit_card",
      balanceRange: [-5000, -500],
      currency: "USD",
    },
    {
      namePattern: "Mastercard",
      type: "credit_card",
      balanceRange: [-3000, -200],
      currency: "USD",
    },
    {
      namePattern: "Rewards Card",
      type: "credit_card",
      balanceRange: [-8000, -1000],
      currency: "USD",
    },
  ],
  investment: [
    {
      namePattern: "Individual Brokerage",
      type: "investment",
      balanceRange: [25000, 250000],
      currency: "USD",
    },
    {
      namePattern: "401(k)",
      type: "investment",
      balanceRange: [50000, 500000],
      currency: "USD",
    },
    {
      namePattern: "Roth IRA",
      type: "investment",
      balanceRange: [20000, 150000],
      currency: "USD",
    },
    {
      namePattern: "Traditional IRA",
      type: "investment",
      balanceRange: [30000, 200000],
      currency: "USD",
    },
  ],
  loan: [
    {
      namePattern: "Mortgage",
      type: "loan",
      balanceRange: [-300000, -100000],
      currency: "USD",
    },
    {
      namePattern: "Auto Loan",
      type: "loan",
      balanceRange: [-25000, -5000],
      currency: "USD",
    },
    {
      namePattern: "Student Loan",
      type: "loan",
      balanceRange: [-50000, -10000],
      currency: "USD",
    },
  ],
  other: [
    {
      namePattern: "Miscellaneous",
      type: null as any,
      balanceRange: [0, 10000],
      currency: "USD",
    },
  ],
};

export function generateOrgs(rng: SeededRandom): Org[] {
  // Select a subset of orgs for variety
  const selectedOrgs = rng.sample(ORGS, rng.nextInt(4, 7));

  return selectedOrgs.map((org, idx) => ({
    id: idx + 1,
    name: org.name,
    domain: org.domain,
  }));
}

export function generateAccounts(
  orgs: Org[],
  rng: SeededRandom,
  config: { includeEdgeCases: boolean; baseDate: Date }
): Account[] {
  const accounts: Account[] = [];
  let accountCounter = 1;

  // For each org, create 1-3 accounts
  for (const org of orgs) {
    const accountCount = rng.nextInt(1, 4);

    for (let i = 0; i < accountCount; i++) {
      // Pick a random account type
      const accountTypes: (AccountType | "other")[] = [
        "bank",
        "credit_card",
        "investment",
      ];

      // Occasionally add loans
      if (rng.nextBool(0.3)) {
        accountTypes.push("loan");
      }

      const accountType = rng.choice(accountTypes);
      const templates = ACCOUNT_TEMPLATES[accountType];
      const template = rng.choice(templates);

      const balance = rng.nextFloat(
        template.balanceRange[0],
        template.balanceRange[1]
      );

      // Generate account ID as UUID-like string
      const accountId = `acc-${accountCounter.toString().padStart(8, "0")}-mock`;

      accounts.push({
        account_id: accountId,
        name: template.namePattern,
        alt_name: null,
        display_name: template.namePattern,
        currency: template.currency,
        account_type: template.type,
        org_name: org.name,
        org_domain: org.domain,
        balance: Math.round(balance * 100) / 100,
        balance_date: config.baseDate.toISOString(),
        is_hidden: false,
      });

      accountCounter++;
    }
  }

  // Edge cases
  if (config.includeEdgeCases) {
    accounts.push({
      account_id: `acc-edge-001-mock`,
      name: "Zero Balance Account",
      alt_name: null,
      display_name: "Zero Balance Account",
      currency: "USD",
      account_type: "bank",
      org_name: orgs[0].name,
      org_domain: orgs[0].domain,
      balance: 0,
      balance_date: config.baseDate.toISOString(),
      is_hidden: false,
    });

    accounts.push({
      account_id: `acc-edge-002-mock`,
      name: "Closed Account",
      alt_name: "Old Checking",
      display_name: "Old Checking",
      currency: "USD",
      account_type: "bank",
      org_name: orgs[0].name,
      org_domain: orgs[0].domain,
      balance: 0,
      balance_date: config.baseDate.toISOString(),
      is_hidden: true,
    });
  }

  return accounts;
}

/**
 * Get primary checking account (for paycheck deposits)
 */
export function getPrimaryCheckingAccount(accounts: Account[]): Account {
  return (
    accounts.find(
      (a) => a.account_type === "bank" && a.name.includes("Checking")
    ) || accounts[0]
  );
}

/**
 * Get credit card accounts
 */
export function getCreditCardAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.account_type === "credit_card");
}

/**
 * Get investment accounts
 */
export function getInvestmentAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.account_type === "investment");
}

/**
 * Get all non-hidden transaction accounts (bank + credit_card)
 */
export function getTransactionAccounts(accounts: Account[]): Account[] {
  return accounts.filter(
    (a) =>
      !a.is_hidden &&
      (a.account_type === "bank" || a.account_type === "credit_card")
  );
}
