/**
 * Mock data configuration
 * Controls the generation of mock data for testing and demo purposes
 */

export interface MockConfig {
  /** Number of days of transaction history to generate */
  transactionHistoryDays: number;
  /** Number of transactions per day (average) */
  transactionsPerDay: number;
  /** Seed for deterministic random generation (null = random) */
  seed: number | null;
  /** Whether to include edge cases */
  includeEdgeCases: boolean;
  /** Base date for relative date calculations (defaults to today) */
  baseDate: Date;
}

export const DEFAULT_CONFIG: MockConfig = {
  transactionHistoryDays: 450,  // ~15 months for year-over-year comparisons
  transactionsPerDay: 2,  // Reduced to keep spending reasonable
  seed: 12345, // Deterministic by default for consistent demos
  includeEdgeCases: false,
  baseDate: new Date(),
};

export const DEMO_CONFIG: MockConfig = {
  ...DEFAULT_CONFIG,
  transactionHistoryDays: 450,  // ~15 months for year-over-year comparisons
  transactionsPerDay: 2,  // Keep it moderate for positive cash flow picture
  includeEdgeCases: false,
};

export const TEST_CONFIG: MockConfig = {
  ...DEFAULT_CONFIG,
  transactionHistoryDays: 90,  // 3 months for testing
  transactionsPerDay: 2,
  includeEdgeCases: true,
};

/**
 * Seeded pseudo-random number generator
 * Uses a simple Linear Congruential Generator (LCG)
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /** Returns a number between 0 and 1 */
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /** Returns an integer between min (inclusive) and max (exclusive) */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /** Returns a float between min and max */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Returns true with given probability (0-1) */
  nextBool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /** Returns a random element from an array */
  choice<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length)];
  }

  /** Returns a random subset of an array */
  sample<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => this.next() - 0.5);
    return shuffled.slice(0, count);
  }
}

/**
 * Date utilities for mock data generation
 */
export class MockDateUtils {
  private baseDate: Date;

  constructor(baseDate: Date) {
    this.baseDate = baseDate;
  }

  /** Get date N days ago from base date */
  daysAgo(days: number): Date {
    const date = new Date(this.baseDate);
    date.setDate(date.getDate() - days);
    return date;
  }

  /** Get date N days from base date */
  daysFromNow(days: number): Date {
    const date = new Date(this.baseDate);
    date.setDate(date.getDate() + days);
    return date;
  }

  /** Get start of current month */
  startOfMonth(): Date {
    const date = new Date(this.baseDate);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  /** Get start of month N months ago */
  startOfMonthsAgo(months: number): Date {
    const date = new Date(this.baseDate);
    date.setMonth(date.getMonth() - months);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  /** Format date as ISO string */
  toISO(date: Date): string {
    return date.toISOString();
  }

  /** Check if date is the 1st or 15th (payday) */
  isPayday(date: Date): boolean {
    const day = date.getDate();
    return day === 1 || day === 15;
  }

  /** Check if date is near start of month (for bills) */
  isNearMonthStart(date: Date): boolean {
    const day = date.getDate();
    return day >= 1 && day <= 5;
  }

  /** Get base date */
  getBaseDate(): Date {
    return this.baseDate;
  }
}
