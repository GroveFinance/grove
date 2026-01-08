# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Grove is a personal finance management tool built with:
- **Backend**: FastAPI (Python 3.12), SQLAlchemy, PostgreSQL
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS 4, shadcn/ui components
- **Architecture**: Full-stack monorepo with Docker Compose orchestration

The application syncs financial data from providers (SimpleFin), manages transactions with category splits, tracks budgets, and provides financial reporting and visualization.

## Development Setup

### Starting the Application

```bash
# Start all services (backend, frontend, database)
docker compose up

# Backend runs on: http://localhost:8000
# Frontend runs on: http://localhost:5173
# API docs: http://localhost:8000/api/docs
```

The application uses Traefik as a reverse proxy. The `SERVICE` environment variable must be set (referenced in docker-compose.yaml labels).

**Hot Reload**: Both the backend (FastAPI with uvicorn --reload) and frontend (Vite) support hot reload. Code changes are automatically detected and applied without requiring a restart.

### Database Migrations

Migrations are managed with Alembic and run automatically on startup via `app/main.py:run_migrations()`.

```bash
# Generate a new migration (run inside the backend container)
docker compose exec app alembic revision --autogenerate -m "description"

# Manually run migrations
docker compose exec app alembic upgrade head

# Rollback one migration
docker compose exec app alembic downgrade -1
```

**Important**: The DATABASE_URL environment variable must be set. Migrations are found in `alembic/versions/`.

### Frontend Development

```bash
# Install dependencies (happens automatically via docker-compose)
cd frontend && npm install

# Run dev server
npm run dev

# Type check and build
npm run build

# Lint
npm run lint
```

Frontend path aliases are configured in `vite.config.ts` - use `@/` for imports from `src/`.

## Architecture

### Backend Structure

- **app/main.py**: FastAPI application entry point, initializes scheduler and runs migrations on startup
- **app/models.py**: SQLAlchemy ORM models - all database tables defined here
- **app/schemas.py**: Pydantic schemas for request/response validation
- **app/db.py**: Database session management and `get_db()` dependency
- **app/api/routes/**: API route modules auto-discovered and mounted at `/api/<module-name>`
- **app/crud/**: Database operations layer - all DB queries should go through CRUD functions
- **app/sync/**: Financial data sync providers
  - `manager.py`: APScheduler-based sync orchestration
  - `simplefin.py`: SimpleFin API integration

**Route Auto-Discovery**: Routes in `app/api/routes/` are automatically registered with the prefix `/api/<module-name>` (underscores converted to hyphens). Each route module exports a `router` object.

### Data Model Key Concepts

**Transaction Splits**: Transactions can be split across multiple categories via the `TransactionSplit` model. Each transaction has a `splits` relationship containing one or more splits that must sum to the transaction amount.

**Payees**: Transactions link to a `Payee` which has a default `category_id`. The payee system enables automatic categorization rules.

**Sync Configs**: The `SyncConfig` model stores credentials and schedules for financial data providers. Syncs run via APScheduler background jobs initialized in `app/sync/manager.py`.

**Category ID 0**: Reserved for "Uncategorized" - this is the default when no category is assigned.

**Category Fallback Logic**: This is a critical pattern used throughout the application for determining a transaction's category:

1. **Primary**: Check if the split has an explicit category assigned (`split.category_id != 0`)
2. **Fallback**: If the split is uncategorized (`split.category_id == 0`), use the payee's default category (`payee.category_id`)
3. **Default**: If neither exists or both are 0, display/use "Uncategorized"

This fallback logic MUST be implemented consistently in:
- **Display logic** (frontend and backend): When showing a transaction's category to the user
- **Filter logic** (backend queries): When filtering transactions by category - must match both explicit split categories AND payee default categories for uncategorized splits
- **Reporting logic** (backend aggregations): When grouping/summing by category

Example implementation in queries:
```python
# Filtering by category - must include fallback logic
if category_ids:
    query = query.filter(
        # Match if split has the category directly
        models.Transaction.splits.any(
            models.TransactionSplit.category_id.in_(category_ids)
        )
        |  # OR
        # Match if split is uncategorized AND payee has the default category
        (
            models.Transaction.splits.any(models.TransactionSplit.category_id == 0)
            & models.Transaction.payee.has(models.Payee.category_id.in_(category_ids))
        )
    )
```

See `app/crud/transaction.py` and `frontend/src/hooks/queries/useTransactions.ts` for reference implementations.

### Frontend Structure

- **src/App.tsx**: Main router and layout configuration
- **src/pages/**: Page components for each route
- **src/components/**: Reusable UI components
  - `components/ui/`: shadcn/ui primitive components
  - `components/widgets/`: Dashboard widget components (e.g., AccountSummary, BudgetUsage)
- **src/services/api/**: API client functions using axios
- **src/hooks/**: React hooks including TanStack Query hooks
- **src/types/**: TypeScript type definitions

**State Management**: Uses TanStack Query (React Query) for server state. No global client state manager.

**UI Components**: Built with Radix UI primitives via shadcn/ui. Uses TailwindCSS 4 for styling.

**CSS Variables**: When referencing CSS custom properties (e.g., colors, spacing), use the `var()` syntax directly without `hsl()` wrapper:
- ✅ Correct: `fill="var(--primary)"`, `stroke="var(--muted-foreground)"`
- ❌ Incorrect: `fill="hsl(var(--primary))"`, `stroke="hsl(var(--muted-foreground))"`

The project's CSS variables are already in the correct color format and don't require the `hsl()` wrapper.

## Common Commands

### Backend

```bash
# Run FastAPI server with auto-reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Access Python shell in container
docker compose exec app python

# View logs
docker compose logs -f app
```

### Database

```bash
# Access PostgreSQL
docker compose exec db psql -U dev -d budget

# Reset database (WARNING: destructive)
docker compose down -v  # Removes volumes
docker compose up
```

### Frontend

```bash
# Type checking
cd frontend && npx tsc --noEmit

# Dev mode with host access (for Docker)
npm run dev -- --host 0.0.0.0
```

## Key Development Patterns

### Adding a New API Route

1. Create a new file in `app/api/routes/<name>.py`
2. Define a router: `router = APIRouter()`
3. Add route handlers with appropriate schemas
4. Route is auto-mounted at `/api/<name>` (no manual registration needed)

### Adding a New Database Model

1. Add model class to `app/models.py`
2. Add corresponding Pydantic schemas to `app/schemas.py`
3. Create CRUD operations in `app/crud/<name>.py`
4. Generate migration: `alembic revision --autogenerate -m "add <model>"`
5. Review and test the migration before committing

### Working with Transactions and Splits

When creating/updating transactions, always handle splits:
- If no splits provided, create a single split with the full transaction amount and category_id 0
- Splits must sum to the transaction amount
- See `app/crud/transaction.py` for reference implementation

### Syncing Financial Data

SimpleFin is the currently supported provider. To add a new sync provider:
1. Create `app/sync/<provider>.py` with `run()` and `get_credentials()` functions
2. Update `app/sync/manager.py` to handle the new provider
3. SyncConfig.provider_name should match the provider module name

### Duplicate Account Detection and Merging

When SimpleFIN credentials are refreshed, it creates new account IDs and transaction IDs, resulting in duplicate accounts. The system automatically detects and allows merging of these duplicates.

**Detection Logic** ([app/crud/account.py:find_duplicate_accounts](app/crud/account.py)):
1. **Stage 1 - Name Matching**: Find accounts with same `(org_id, name)` - these are candidates
2. **Stage 2 - Transaction Validation**: Only flag as duplicates if they share recent transactions
   - Compares N most recent transactions from older account (default: 5)
   - Matches by `(posted, amount, description)` tuple
   - Requires minimum match ratio (default: 80%, meaning 4 out of 5 must match)

**Configuration** (via environment variables in `.env`):
```bash
# Number of recent transactions to compare (default: 5)
DUPLICATE_DETECTION_SAMPLE_SIZE=5

# Minimum match ratio required (default: 0.8 = 80%)
# For 5 transactions, this means 4+ must match
DUPLICATE_DETECTION_MIN_MATCH_RATIO=0.8
```

**Merge Strategy** ([app/crud/account.py:merge_accounts](app/crud/account.py)):
1. Match source transactions to target transactions by `(posted, amount, description)`
2. For matches: Copy splits/categories/payees from source to target (preserves categorization)
3. For old transactions (beyond SimpleFIN lookback): Reassign to target account
4. Delete duplicate recent transactions
5. Reassign holdings to target account
6. Delete source account

**UI Flow** ([frontend/src/pages/settings/AccountsPage.tsx](frontend/src/pages/settings/AccountsPage.tsx)):
- Yellow warning banner appears for detected duplicates
- Shows which account is new (SimpleFIN will sync here) vs old (has your categorization)
- Merge button on old accounts to transfer categorization to new account
- Manual delete button available if merge isn't appropriate

**Edge Cases**:
- Accounts with same name but different transactions (e.g., multiple E*TRADE "Stock Plan" accounts) won't be flagged as duplicates
- Users can adjust detection sensitivity via env vars or manually merge using the API

## Important Notes

- **Migrations run automatically** on app startup via `app/main.py`
- **CORS is wide open** (`allow_origins=["*"]`) - only suitable for local development
- **Database echo is enabled** (`echo=True` in `app/db.py`) - disable for production
- Frontend base path configuration can be found in vite.config.ts
- **Category ID 0** is reserved for uncategorized transactions
- The sync scheduler starts on application startup and runs jobs based on cron schedules in SyncConfig

## Future Enhancements

### Investment Transaction-to-Holding Linking (Planned)

**Goal**: Link investment transactions to specific holdings to enable detailed portfolio tracking, cost basis accuracy, and performance attribution.

**Current State**:
- Holdings and Transactions are separate entities only related via `account_id`
- SimpleFin provides investment transaction descriptions with embedded metadata (e.g., "9 of PALO ALTO NETWORKS INC SELL SHORT EXEMPT UNSOLICITED TRADE @ $187.3802 Sold")
- No direct foreign key relationship exists between Transaction and Holding models

**Implementation Plan** (95%+ automatic, minimal user work):

1. **Schema Changes**:
   ```python
   # Add to Transaction model in app/models.py
   holding_id = Column(String, ForeignKey("holdings.id"), nullable=True)
   transaction_type = Column(String, nullable=True)  # 'buy', 'sell', 'dividend', 'reinvest', etc.
   quantity = Column(Numeric(18, 6), nullable=True)  # shares/units
   price_per_share = Column(Numeric(18, 6), nullable=True)
   ```

2. **Automatic Linking Strategy**:
   - Parse transaction `description` field to extract:
     - Security name (e.g., "PALO ALTO NETWORKS INC")
     - Action (BUY, SELL, DIVIDEND, etc.)
     - Quantity (shares)
     - Price (optional)
   - Match to holdings by:
     - Primary: Exact symbol match (if extractable)
     - Fallback: Fuzzy string match on holding.description vs transaction.description
     - Scope: Within same `account_id` only

3. **Transaction Description Parsing Pattern**:
   ```
   "[quantity] of [SECURITY NAME] [ACTION] ... @ $[price] [status]"
   Examples:
   - "9 of PALO ALTO NETWORKS INC SELL SHORT EXEMPT UNSOLICITED TRADE @ $187.3802 Sold"
   - "SCHWAB VALUE ADVANTAGE MONEY INVESTOR SHARES" (dividend/interest)
   ```

4. **Benefits**:
   - Track actual purchase transactions that built current positions
   - Calculate realized vs unrealized gains
   - Handle partial sales (FIFO, LIFO, specific lot identification)
   - Link dividends/interest to generating holdings
   - Enable performance attribution and yield calculations
   - Improve tax reporting (wash sales, capital gains by lot)

5. **Implementation Files**:
   - Parser: `app/utils/investment_parser.py` (new)
   - Migration: `alembic/versions/xxx_add_investment_transaction_fields.py`
   - CRUD update: `app/crud/transaction.py` - add auto-linking on create/update
   - Backfill script: `app/scripts/backfill_investment_links.py` (one-time)

6. **User Intervention** (edge cases only):
   - Optional UI for manually linking ambiguous transactions
   - Only needed when description doesn't match any holding clearly (~5% of cases)

**Reference**: See conversation from 2025-12-15 about investment transaction analysis and SimpleFin data structure
