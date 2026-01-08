import type { Holding, Account } from "@/types";
import type { SeededRandom } from "../config";
import { getInvestmentAccounts } from "./accounts";

/**
 * Generate realistic investment holdings
 */

interface HoldingTemplate {
  symbol: string;
  description: string;
  priceRange: [number, number];
  sharesRange: [number, number];
}

const STOCK_HOLDINGS: HoldingTemplate[] = [
  {
    symbol: "AAPL",
    description: "Apple Inc",
    priceRange: [170, 190],
    sharesRange: [10, 100],
  },
  {
    symbol: "MSFT",
    description: "Microsoft Corporation",
    priceRange: [370, 390],
    sharesRange: [5, 50],
  },
  {
    symbol: "GOOGL",
    description: "Alphabet Inc Class A",
    priceRange: [135, 145],
    sharesRange: [10, 80],
  },
  {
    symbol: "AMZN",
    description: "Amazon.com Inc",
    priceRange: [170, 185],
    sharesRange: [5, 40],
  },
  {
    symbol: "TSLA",
    description: "Tesla Inc",
    priceRange: [240, 280],
    sharesRange: [5, 30],
  },
  {
    symbol: "NVDA",
    description: "NVIDIA Corporation",
    priceRange: [480, 520],
    sharesRange: [5, 25],
  },
  {
    symbol: "META",
    description: "Meta Platforms Inc",
    priceRange: [480, 520],
    sharesRange: [5, 40],
  },
  {
    symbol: "JPM",
    description: "JPMorgan Chase & Co",
    priceRange: [195, 215],
    sharesRange: [10, 60],
  },
  {
    symbol: "V",
    description: "Visa Inc Class A",
    priceRange: [280, 300],
    sharesRange: [5, 40],
  },
  {
    symbol: "DIS",
    description: "Walt Disney Company",
    priceRange: [90, 110],
    sharesRange: [10, 80],
  },
];

const ETF_HOLDINGS: HoldingTemplate[] = [
  {
    symbol: "VOO",
    description: "Vanguard S&P 500 ETF",
    priceRange: [450, 470],
    sharesRange: [20, 200],
  },
  {
    symbol: "VTI",
    description: "Vanguard Total Stock Market ETF",
    priceRange: [260, 270],
    sharesRange: [30, 300],
  },
  {
    symbol: "QQQ",
    description: "Invesco QQQ Trust",
    priceRange: [470, 490],
    sharesRange: [10, 100],
  },
  {
    symbol: "VEA",
    description: "Vanguard FTSE Developed Markets ETF",
    priceRange: [48, 52],
    sharesRange: [50, 500],
  },
  {
    symbol: "BND",
    description: "Vanguard Total Bond Market ETF",
    priceRange: [73, 77],
    sharesRange: [50, 400],
  },
  {
    symbol: "SCHD",
    description: "Schwab US Dividend Equity ETF",
    priceRange: [28, 32],
    sharesRange: [100, 800],
  },
];

const MUTUAL_FUND_HOLDINGS: HoldingTemplate[] = [
  {
    symbol: "VFIAX",
    description: "Vanguard 500 Index Fund Admiral Shares",
    priceRange: [450, 470],
    sharesRange: [50, 500],
  },
  {
    symbol: "VTSAX",
    description: "Vanguard Total Stock Market Index Fund",
    priceRange: [120, 130],
    sharesRange: [100, 800],
  },
  {
    symbol: "FXAIX",
    description: "Fidelity 500 Index Fund",
    priceRange: [180, 190],
    sharesRange: [50, 400],
  },
];

export function generateHoldings(
  accounts: Account[],
  rng: SeededRandom,
  config: { baseDate: Date }
): Holding[] {
  const holdings: Holding[] = [];
  const investmentAccounts = getInvestmentAccounts(accounts);

  if (investmentAccounts.length === 0) {
    return holdings;
  }

  let holdingCounter = 1;

  for (const account of investmentAccounts) {
    // Determine portfolio mix based on account type
    let stockCount = 0;
    let etfCount = 0;
    let mfCount = 0;

    if (account.name.includes("401(k)") || account.name.includes("IRA")) {
      // Retirement accounts: mostly mutual funds and ETFs
      etfCount = rng.nextInt(2, 5);
      mfCount = rng.nextInt(1, 3);
      stockCount = rng.nextInt(0, 2);
    } else {
      // Brokerage: mix of everything
      stockCount = rng.nextInt(3, 8);
      etfCount = rng.nextInt(2, 5);
      mfCount = rng.nextInt(0, 2);
    }

    // Generate stock holdings
    const selectedStocks = rng.sample(STOCK_HOLDINGS, stockCount);
    for (const template of selectedStocks) {
      holdings.push(
        createHolding(
          account,
          template,
          holdingCounter++,
          rng,
          config.baseDate
        )
      );
    }

    // Generate ETF holdings
    const selectedETFs = rng.sample(ETF_HOLDINGS, etfCount);
    for (const template of selectedETFs) {
      holdings.push(
        createHolding(
          account,
          template,
          holdingCounter++,
          rng,
          config.baseDate
        )
      );
    }

    // Generate mutual fund holdings
    const selectedMFs = rng.sample(MUTUAL_FUND_HOLDINGS, mfCount);
    for (const template of selectedMFs) {
      holdings.push(
        createHolding(
          account,
          template,
          holdingCounter++,
          rng,
          config.baseDate
        )
      );
    }
  }

  return holdings;
}

function createHolding(
  account: Account,
  template: HoldingTemplate,
  id: number,
  rng: SeededRandom,
  baseDate: Date
): Holding {
  const shares = rng
    .nextFloat(template.sharesRange[0], template.sharesRange[1])
    .toFixed(6);

  // Purchase price is slightly lower than current price (gains)
  const purchasePrice = rng
    .nextFloat(template.priceRange[0] * 0.7, template.priceRange[0] * 0.95)
    .toFixed(6);

  // Current price
  const currentPrice = rng
    .nextFloat(template.priceRange[0], template.priceRange[1])
    .toFixed(6);

  const sharesNum = parseFloat(shares);
  const purchasePriceNum = parseFloat(purchasePrice);
  const currentPriceNum = parseFloat(currentPrice);

  const costBasis = (sharesNum * purchasePriceNum).toFixed(2);
  const marketValue = (sharesNum * currentPriceNum).toFixed(2);

  const holdingId = `hold-${id.toString().padStart(8, "0")}-mock`;

  return {
    id: holdingId,
    account_id: account.account_id,
    created: baseDate.toISOString(),
    currency: "USD",
    cost_basis: costBasis,
    description: template.description,
    market_value: marketValue,
    purchase_price: purchasePrice,
    shares: shares,
    symbol: template.symbol,
  };
}

/**
 * Calculate total portfolio value
 */
export function calculatePortfolioValue(holdings: Holding[]): number {
  return holdings.reduce(
    (sum, h) => sum + parseFloat(h.market_value),
    0
  );
}

/**
 * Calculate total gains/losses
 */
export function calculatePortfolioGains(holdings: Holding[]): number {
  return holdings.reduce(
    (sum, h) =>
      sum + (parseFloat(h.market_value) - parseFloat(h.cost_basis)),
    0
  );
}
