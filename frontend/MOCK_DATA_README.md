# Mock Data System

This directory contains a comprehensive mock data system for testing and demo purposes.

## Overview

The mock data system provides:
- **Realistic financial data** generated programmatically
- **Type-safe API layer** that matches production API
- **Configurable scenarios** for different use cases
- **Deterministic data** using seeded random generation
- **No backend required** - runs entirely in the browser

## Quick Start

### Development with Mock Data

```bash
# Run dev server with mock data
npm run dev:mock

# Or set environment variable
VITE_API_MODE=mock npm run dev
```

### Building for GitHub Pages Demo

```bash
# Build demo version
npm run build:demo

# Preview demo build
npm run preview:demo
```

### Testing

```typescript
import { generateScenario } from '@/services/api/mock/generators';

// Generate test data
const testData = generateScenario('test');

// Use in tests
expect(testData.accounts).toHaveLength(10);
```

## Environment Variables

Create a `.env.local` file with:

```bash
# API Mode: real | mock | demo
VITE_API_MODE=mock
```

Available modes:
- `real` - Uses backend API (default for production)
- `mock` - Uses mock data (for testing)
- `demo` - Uses mock data with polished demo scenario (for GitHub Pages)

## Scenarios

The system provides pre-configured scenarios:

### `demo` (Default for GitHub Pages)
- 90 days of transaction history
- ~4 transactions per day
- Multiple accounts (checking, savings, credit cards, investments)
- Realistic bills and recurring payments
- Investment holdings with gains/losses

### `test` (For Unit Tests)
- 30 days of history
- ~2 transactions per day
- Includes edge cases
- Deterministic seed for reproducibility

### `new-user`
- Only 7 days of history
- Minimal transactions
- Good for testing onboarding flow

### `overbudget`
- Higher spending than budgets
- Useful for testing warning states

### `investment-heavy`
- More investment accounts
- Extensive holdings
- Portfolio tracking features

### `minimal`
- 14 days of history
- 1 transaction per day
- Lightweight for quick testing

## Architecture

```
frontend/src/services/api/mock/
├── config.ts                 # Configuration and utilities
├── generators/
│   ├── index.ts             # Main generator orchestration
│   ├── categories.ts        # Category and group generation
│   ├── accounts.ts          # Accounts and orgs
│   ├── payees.ts            # Payees with default categories
│   ├── transactions.ts      # Transaction generation with patterns
│   └── holdings.ts          # Investment holdings
└── index.ts                 # Mock API implementation
```

## Data Generation

### Seeded Random Generation

All data uses seeded random generation for deterministic output:

```typescript
import { SeededRandom } from '@/services/api/mock/config';

const rng = new SeededRandom(12345);
const randomNumber = rng.nextInt(1, 100);
const randomItem = rng.choice(['a', 'b', 'c']);
```

### Date Utilities

Dates are generated relative to "today" so data always appears current:

```typescript
import { MockDateUtils } from '@/services/api/mock/config';

const dateUtils = new MockDateUtils(new Date());
const lastWeek = dateUtils.daysAgo(7);
const nextMonth = dateUtils.daysFromNow(30);
```

### Transaction Patterns

Transactions follow realistic patterns:

- **Paychecks**: Every 1st and 15th of the month
- **Recurring bills**: Start of each month (rent, utilities, subscriptions)
- **Credit card payments**: 3rd of each month
- **Daily expenses**: Random throughout the day
  - 70% on credit cards
  - 30% on checking/debit

### Category Fallback Logic

The mock system implements the same category fallback logic as production:

1. Check split's explicit category (`split.category_id != 0`)
2. Fall back to payee's default category if split is uncategorized
3. Default to "Uncategorized" if neither exists

## Custom Scenarios

Create custom scenarios for specific test cases:

```typescript
import { generateMockData } from '@/services/api/mock/generators';
import { DEFAULT_CONFIG } from '@/services/api/mock/config';

const customData = generateMockData({
  ...DEFAULT_CONFIG,
  transactionHistoryDays: 45,
  transactionsPerDay: 5,
  seed: 99999,
  includeEdgeCases: true,
  baseDate: new Date('2024-01-01'),
});
```

## API Coverage

Currently mocked APIs:
- ✅ Accounts (get, update, delete)
- ✅ Transactions (get, update, summary)
- ✅ Categories (get, create, update, delete)
- ✅ Groups (get, create, update, delete)
- ✅ Payees (get, update)
- ✅ Holdings (get)
- ✅ Orgs (get)
- ✅ Reports (basic implementation)
- ❌ Sync (not applicable for demo)
- ❌ Account Balance History (TODO)

## Testing Examples

### Unit Testing with Mock Data

```typescript
import { generateScenario } from '@/services/api/mock/generators';
import { describe, it, expect } from 'vitest';

describe('Transaction Filtering', () => {
  it('filters by category', () => {
    const data = generateScenario('test');
    const groceryCategory = data.categories.find(c => c.name === 'Groceries');
    const groceryTransactions = data.transactions.filter(t =>
      t.splits.some(s => s.category_id === groceryCategory.id)
    );

    expect(groceryTransactions.length).toBeGreaterThan(0);
  });
});
```

### Integration Testing

```typescript
import { initializeMockAPI, getTransactions } from '@/services/api/mock';

beforeEach(() => {
  initializeMockAPI('test');
});

it('fetches transactions', async () => {
  const transactions = await getTransactions();
  expect(transactions).toBeDefined();
  expect(transactions.length).toBeGreaterThan(0);
});
```

### Visual/Snapshot Testing

```typescript
import { initializeMockAPI } from '@/services/api/mock';

beforeAll(() => {
  // Deterministic data for consistent snapshots
  initializeMockAPI('demo');
});

it('renders transaction list', () => {
  const { container } = render(<TransactionList />);
  expect(container).toMatchSnapshot();
});
```

## GitHub Pages Deployment

The GitHub Actions workflow automatically deploys the demo on push to `main`:

1. Builds with `vite.config.demo.ts`
2. Sets `VITE_API_MODE=demo`
3. Deploys to GitHub Pages

### Manual Deployment

```bash
# Build
npm run build:demo

# The dist/ folder can be deployed to any static host
```

## Configuration Options

```typescript
interface MockConfig {
  transactionHistoryDays: number;    // Days of history to generate
  transactionsPerDay: number;        // Average daily transactions
  seed: number | null;               // RNG seed (null = random)
  includeEdgeCases: boolean;         // Add edge case data
  baseDate: Date;                    // Reference date for generation
}
```

## Benefits

### For Demos
- Always shows current data
- No backend setup required
- Fast and responsive
- Showcases all features

### For Testing
- Deterministic and reproducible
- No database state to manage
- Fast test execution
- Isolated test environments

### For Development
- Work offline
- Instant feedback
- No API latency
- Test edge cases easily

## Limitations

- Data resets on page refresh (no persistence)
- Sync functionality unavailable
- Historical reports are simplified
- No real-time updates

## Future Enhancements

- [ ] LocalStorage persistence option
- [ ] More sophisticated report calculations
- [ ] Account balance history generation
- [ ] Investment transaction linking (planned feature)
- [ ] Custom scenario builder UI
- [ ] Export/import mock datasets

## Troubleshooting

### Mock mode not activating

Check that `.env` or `.env.local` has:
```bash
VITE_API_MODE=mock
```

Restart dev server after changing env files.

### Data looks wrong

Mock data is deterministic by default. Clear browser cache and reload.

### Type errors

Ensure mock API signatures match real API in `frontend/src/types/`.

## Contributing

When adding new API endpoints:

1. Add types to `frontend/src/types/`
2. Create mock implementation in `frontend/src/services/api/mock/index.ts`
3. Update this README
4. Add tests

When updating data models:

1. Update generators in `frontend/src/services/api/mock/generators/`
2. Ensure realistic data patterns
3. Test with different scenarios
