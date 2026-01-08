import type { Transaction, TransactionSplit, Account, Payee, Category } from "@/types";
import type { SeededRandom, MockConfig, MockDateUtils } from "../config";
import {
  getCreditCardAccounts,
  getPrimaryCheckingAccount,
  getTransactionAccounts,
} from "./accounts";
import { findPayeeByName, getPayeeFrequency } from "./payees";

/**
 * Generate realistic transactions with proper splits
 *
 * BUDGET TARGETS (from seed.py - we aim for 70-85% utilization):
 * - Gas & Fuel: $200/mo → target ~$150/mo
 * - Parking: $40/mo → target ~$25/mo
 * - Public Transit: $60/mo → target ~$40/mo
 * - Groceries: $500/mo → target ~$380/mo
 * - Restaurants: $200/mo → target ~$150/mo
 * - Fast Food: $100/mo → target ~$70/mo
 * - Coffee Shops: $50/mo → target ~$35/mo
 * - Alcohol & Bars: $75/mo → target ~$50/mo
 * - Delivery: $60/mo → target ~$40/mo
 * - Clothing: $100/mo → target ~$70/mo
 * - Hobbies: $75/mo → target ~$50/mo
 * - Subscription Services: $100/mo → target ~$70/mo (fixed subscriptions)
 *
 * FIXED MONTHLY EXPENSES (non-budgeted):
 * - Rent: $1,650
 * - Utilities (Electric/Gas/Water): ~$200
 * - Internet: $70
 * - Mobile Phone: $85
 * - TV/Streaming: $45
 * - Auto Payment: $350
 * - Auto Insurance: $140
 * - Health Insurance: $280
 *
 * INCOME: $4,000 x 2 = $8,000/month
 * FIXED EXPENSES: ~$2,820/month
 * VARIABLE EXPENSES (budgeted): ~$1,000/month
 * TOTAL: ~$3,820/month → NET POSITIVE: ~$4,180/month
 */

export function generateTransactions(
  accounts: Account[],
  payees: Payee[],
  categories: Category[],
  config: MockConfig,
  rng: SeededRandom,
  dateUtils: MockDateUtils
): Transaction[] {
  const transactions: Transaction[] = [];
  let transactionCounter = 1;

  const checkingAccount = getPrimaryCheckingAccount(accounts);
  const creditCards = getCreditCardAccounts(accounts);
  const transactionAccounts = getTransactionAccounts(accounts);

  // Generate transactions day by day
  for (let daysAgo = config.transactionHistoryDays; daysAgo >= 0; daysAgo--) {
    const date = dateUtils.daysAgo(daysAgo);

    // Paycheck on 1st and 15th
    if (dateUtils.isPayday(date)) {
      const paycheckTx = createPaycheckTransaction(
        checkingAccount,
        payees,
        categories,
        date,
        transactionCounter++,
        rng
      );
      transactions.push(paycheckTx);
    }

    // Recurring bills ONLY on 1st of month (avoid duplicates from isNearMonthStart)
    if (date.getDate() === 1) {
      const billTransactions = createRecurringBills(
        checkingAccount,
        payees,
        categories,
        date,
        transactionCounter,
        rng
      );
      transactions.push(...billTransactions);
      transactionCounter += billTransactions.length;
    }

    // Random daily transactions (variable spending)
    // Use lower probability to keep spending reasonable
    const dailyTxCount = Math.max(
      0,
      Math.round(rng.nextFloat(0, config.transactionsPerDay * 1.2))
    );

    for (let i = 0; i < dailyTxCount; i++) {
      // Decide which account (60% credit card, 40% checking)
      const useCredit = creditCards.length > 0 && rng.nextBool(0.6);
      const account = useCredit
        ? rng.choice(creditCards)
        : rng.choice(transactionAccounts);

      const tx = createRandomTransaction(
        account,
        payees,
        categories,
        date,
        transactionCounter++,
        rng
      );

      if (tx) {
        transactions.push(tx);
      }
    }
  }

  // Sort by date (newest first)
  transactions.sort(
    (a, b) =>
      new Date(b.transacted_at).getTime() - new Date(a.transacted_at).getTime()
  );

  return transactions;
}

function createPaycheckTransaction(
  account: Account,
  payees: Payee[],
  categories: Category[],
  date: Date,
  id: number,
  rng: SeededRandom
): Transaction {
  const payee = findPayeeByName(payees, "Employer Inc") || payees[0];
  const category = categories.find((c) => c.name === "Paycheck") || categories[0];

  // Consistent paycheck: $3,950-4,050 (bi-weekly) = ~$8,000/month
  const amount = rng.nextFloat(3950, 4050).toFixed(2);

  return createTransaction(
    id,
    account,
    payee,
    category,
    amount,
    date,
    "Direct Deposit - Payroll"
  );
}

function createRecurringBills(
  account: Account,
  payees: Payee[],
  categories: Category[],
  date: Date,
  startId: number,
  _rng: SeededRandom
): Transaction[] {
  const bills: Transaction[] = [];
  let id = startId;

  // Fixed monthly bills - these happen every month, no randomness
  // Total: ~$2,820/month
  const fixedBills = [
    { payeeName: "Landlord Property Mgmt", amount: -1650 },      // Rent
    { payeeName: "City Electric Co", amount: -95 },               // Electric ~$95
    { payeeName: "Gas Utility", amount: -55 },                    // Gas ~$55
    { payeeName: "Water District", amount: -45 },                 // Water ~$45
    { payeeName: "FastNet Internet", amount: -70 },               // Internet
    { payeeName: "Verizon Wireless", amount: -85 },               // Phone
    { payeeName: "Auto Finance Co", amount: -350 },               // Car payment
    { payeeName: "State Farm", amount: -140 },                    // Auto insurance
    { payeeName: "Blue Cross", amount: -280 },                    // Health insurance
  ];

  // Subscriptions (part of $100 Subscription Services budget)
  const subscriptions = [
    { payeeName: "Netflix", amount: -15.99 },
    { payeeName: "Spotify", amount: -10.99 },
    { payeeName: "Planet Fitness", amount: -24.99 },
  ];

  // Create all fixed bills
  for (const bill of fixedBills) {
    const payee = findPayeeByName(payees, bill.payeeName);
    if (!payee) continue;

    const category = categories.find((c) => c.id === payee.category_id) || categories[0];

    bills.push(
      createTransaction(
        id++,
        account,
        payee,
        category,
        bill.amount.toFixed(2),
        date,
        `${bill.payeeName}`
      )
    );
  }

  // Create subscriptions
  for (const sub of subscriptions) {
    const payee = findPayeeByName(payees, sub.payeeName);
    if (!payee) continue;

    const category = categories.find((c) => c.id === payee.category_id) || categories[0];

    bills.push(
      createTransaction(
        id++,
        account,
        payee,
        category,
        sub.amount.toFixed(2),
        date,
        `${sub.payeeName}`
      )
    );
  }

  return bills;
}

function createRandomTransaction(
  account: Account,
  payees: Payee[],
  categories: Category[],
  date: Date,
  id: number,
  rng: SeededRandom
): Transaction | null {
  // Filter out income, transfers, and monthly recurring payees
  const expensePayees = payees.filter(
    (p) =>
      !p.name.includes("Employer") &&
      !p.name.includes("Payment") &&
      !p.name.includes("Transfer") &&
      !p.name.includes("Insurance") &&
      !p.name.includes("Finance") &&
      getPayeeFrequency(p.name) !== "monthly" &&
      getPayeeFrequency(p.name) !== "biweekly"
  );

  if (expensePayees.length === 0) return null;

  const payee = rng.choice(expensePayees);
  const category = categories.find((c) => c.id === payee.category_id) || categories[0];

  // Amount ranges designed to stay UNDER budget
  // With ~2 transactions/day and 30 days, we get ~60 transactions/month
  // But many categories only get a few transactions each
  let amountRange: [number, number] = [-5, -15];

  switch (category.name) {
    // Groceries: $500 budget → target ~$380 → 4-5 trips @ $75-95 each
    case "Groceries":
      amountRange = [-65, -95];
      break;

    // Restaurants: $200 budget → target ~$150 → 5-6 meals @ $25-35 each
    case "Restaurants":
      amountRange = [-22, -35];
      break;

    // Fast Food: $100 budget → target ~$70 → 6-8 meals @ $9-12 each
    case "Fast Food":
      amountRange = [-9, -13];
      break;

    // Coffee Shops: $50 budget → target ~$35 → 7-8 coffees @ $4.50-5.50 each
    case "Coffee Shops":
      amountRange = [-4.5, -6];
      break;

    // Delivery: $60 budget → target ~$40 → 2-3 orders @ $15-20 each
    case "Delivery":
      amountRange = [-15, -22];
      break;

    // Gas & Fuel: $200 budget → target ~$150 → 3-4 fillups @ $38-45 each
    case "Gas & Fuel":
      amountRange = [-38, -48];
      break;

    // Clothing: $100 budget → target ~$70 → 1-2 purchases @ $30-45 each
    case "Clothing":
      amountRange = [-28, -45];
      break;

    // Electronics & Software: no budget, occasional purchases
    case "Electronics & Software":
      amountRange = [-25, -75];
      break;

    // Online Shopping: no budget, misc purchases
    case "Online Shopping":
      amountRange = [-15, -40];
      break;

    // Pharmacy: occasional purchases
    case "Pharmacy":
      amountRange = [-12, -28];
      break;

    // Movies: $20 budget → target ~$15 → 1 movie @ $12-16
    case "Movies":
      amountRange = [-12, -16];
      break;

    // Games: $30 budget → target ~$20 → occasional purchase
    case "Games":
      amountRange = [-10, -25];
      break;

    // Hair: $40 budget → target ~$30 → 1 haircut
    case "Hair":
      amountRange = [-25, -35];
      break;

    // Cosmetics: $30 budget → target ~$20
    case "Cosmetics":
      amountRange = [-15, -25];
      break;

    // Parking: $40 budget → target ~$25 → a few parking fees
    case "Parking":
      amountRange = [-5, -12];
      break;

    // Ride Share: occasional, no budget
    case "Ride Share":
      amountRange = [-12, -25];
      break;

    // Hobbies: $75 budget → target ~$50
    case "Hobbies":
      amountRange = [-20, -35];
      break;

    default:
      amountRange = [-8, -20];
  }

  const amount = rng.nextFloat(amountRange[0], amountRange[1]).toFixed(2);

  return createTransaction(
    id,
    account,
    payee,
    category,
    amount,
    date,
    payee.name
  );
}

function createTransaction(
  id: number,
  account: Account,
  payee: Payee,
  category: Category,
  amount: string,
  date: Date,
  description: string
): Transaction {
  const transactionId = `txn-${id.toString().padStart(12, "0")}-mock`;

  // Add some time variance to the date
  const transactedAt = new Date(date);
  transactedAt.setHours(
    Math.floor(Math.random() * 14) + 8, // 8am - 10pm
    Math.floor(Math.random() * 60),
    0,
    0
  );

  // Create a single split for the full amount
  const split: TransactionSplit = {
    id: id * 1000,
    transaction_id: transactionId,
    category_id: category.id,
    category: category,
    amount: amount,
  };

  return {
    id: transactionId,
    account_id: account.account_id,
    account: account,
    amount: amount,
    posted: transactedAt.toISOString(),
    transacted_at: transactedAt.toISOString(),
    payee_id: payee.id,
    description: description,
    memo: "",
    category_id: category.id,
    payee: payee,
    category: category,
    splits: [split],
  };
}

/**
 * Create a transaction with multiple splits
 */
export function createSplitTransaction(
  id: number,
  account: Account,
  payee: Payee,
  splits: Array<{ category: Category; amount: number }>,
  date: Date,
  description: string
): Transaction {
  const transactionId = `txn-${id.toString().padStart(12, "0")}-mock`;
  const totalAmount = splits.reduce((sum, s) => sum + s.amount, 0).toFixed(2);

  const transactedAt = new Date(date);
  transactedAt.setHours(
    Math.floor(Math.random() * 14) + 8,
    Math.floor(Math.random() * 60),
    0,
    0
  );

  const transactionSplits: TransactionSplit[] = splits.map((s, idx) => ({
    id: id * 1000 + idx,
    transaction_id: transactionId,
    category_id: s.category.id,
    category: s.category,
    amount: s.amount.toFixed(2),
  }));

  return {
    id: transactionId,
    account_id: account.account_id,
    account: account,
    amount: totalAmount,
    posted: transactedAt.toISOString(),
    transacted_at: transactedAt.toISOString(),
    payee_id: payee.id,
    description: description,
    memo: "",
    category_id: splits[0].category.id,
    payee: payee,
    category: splits[0].category,
    splits: transactionSplits,
  };
}
