# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Local Overrides**: You can create a `CLAUDE.local.md` file (gitignored) to add local-specific configuration that extends this file. This is useful for documenting your personal setup (domains, infrastructure) without checking it into the repository.

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

The application can optionally use Traefik as a reverse proxy. If using Traefik, configure routing in `.local.yaml` files (gitignored).

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

### Pre-commit Hooks

The project uses pre-commit hooks to enforce code quality standards before commits. These hooks run the same checks as CI to catch issues early and **automatically fix most issues**.

**Setup** (one-time):
```bash
# Install pre-commit (already in requirements.txt)
pip install pre-commit

# Install the git hooks
pre-commit install
```

**Usage**:
```bash
# Hooks run automatically on git commit
git commit -m "Your message"

# If auto-fixes are applied, re-add and commit again:
git add -u
git commit -m "Your message"

# Run manually on all files
pre-commit run --all-files

# Skip hooks (not recommended)
git commit --no-verify
```

**Auto-Fix Behavior**:
- ✅ **Ruff**: Auto-fixes linting issues (import sorting, syntax modernization, etc.)
- ✅ **Ruff-format**: Auto-formats Python code
- ✅ **ESLint**: Auto-fixes JavaScript/TypeScript linting issues
- ✅ **Whitespace**: Auto-fixes trailing spaces, line endings, missing newlines
- ❌ **Type errors**: MyPy and TypeScript errors require manual fixes

**Checks performed**:
- Backend: ruff (linter + formatter), mypy (type checker)
- Frontend: ESLint, TypeScript type check
- General: trailing whitespace, end-of-file fixer, YAML validation, merge conflict detection

**Configuration**: See [.pre-commit-config.yaml](.pre-commit-config.yaml) and [mypy.ini](mypy.ini)

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

## Multi-Environment Deployment

Grove supports three local environments with complete isolation for development, testing, and validation workflows. Public release deployment is handled separately in a standalone setup.

### Environments Overview

1. **Development Environment**
   - Hot reload for both backend and frontend
   - Volume mounts for live code editing
   - Database: `budget` (existing development data)
   - Ports: Backend 8000, Frontend 5173
   - Compose: `compose-dev.yaml` + `compose-dev.local.yaml` (optional)

2. **Mock Frontend Environment**
   - Frontend-only with mock API data
   - No backend or database required
   - Port: 5174 (avoids conflicts with dev)
   - Compose: `compose-mock.yaml` + `compose-mock.local.yaml` (optional)

3. **Production Test Environment**
   - Locally built production image
   - Isolated database for testing
   - Database: `budget-prod` (separate from dev)
   - Port: 8002
   - Compose: `compose-prod.yaml` + `compose-prod.local.yaml` (optional)

**Note**: Public release is managed separately as a standalone setup.

### Database Architecture

All environments use a **single PostgreSQL instance** with separate databases:
- **Dev**: `budget` (existing development database, unchanged)
- **Prod**: `budget-prod` (isolated for production testing)
- **Mock**: No database (frontend-only)

Database initialization is handled by `scripts/init-databases.sh`, which runs automatically on PostgreSQL first startup. The script creates `budget-prod` if it doesn't exist.

### File Naming Convention

**Git-tracked base files:**
- `compose-dev.yaml` - Development environment
- `compose-mock.yaml` - Mock frontend environment
- `compose-prod.yaml` - Production test environment

**Gitignored local files** (Traefik configuration):
- `compose-dev.local.yaml` - Dev Traefik config (optional, user-specific)
- `compose-mock.local.yaml` - Mock Traefik config (optional, user-specific)
- `compose-prod.local.yaml` - Prod Traefik config (optional, user-specific)

**Environment files:**
- `.env.dev.example` - Dev configuration template
- `.env.mock.example` - Mock configuration template
- `.env.prod.example` - Prod configuration template
- `.env` - Active environment config (gitignored)

**Note**: If you're not using Traefik, simply don't include the `.local.yaml` files in your `COMPOSE_FILE` setting.

### Rebuilding Environments

Each environment can be rebuilt and restarted independently. The rebuild scripts automatically detect and use `.local.yaml` files if they exist (for Traefik integration).

```bash
# Development (uses your current .env)
docker compose up -d
# Access: http://localhost:8000 (backend), http://localhost:5173 (frontend)

# Rebuild mock frontend
./rebuild-mock.sh
# Access: http://localhost:5174
# (Automatically uses compose-mock.local.yaml if it exists)

# Rebuild prod environment
./rebuild-prod.sh
# Access: http://localhost:8002
# (Automatically uses compose-prod.local.yaml if it exists)
```

**Switching Environments:**

To switch between environments, update your `.env` file:

```bash
# Switch to mock
cp .env.mock.example .env
docker compose up -d

# Switch to prod
cp .env.prod.example .env
./rebuild-prod.sh

# Switch back to dev
cp .env.dev.example .env
docker compose up -d
```

**Or** use separate terminal windows and specify compose files directly:

```bash
# Terminal 1: Dev
docker compose -f compose-dev.yaml -f compose-dev.local.yaml up

# Terminal 2: Mock
docker compose -f compose-mock.yaml -f compose-mock.local.yaml up

# Terminal 3: Prod
docker compose -f compose-prod.yaml -f compose-prod.local.yaml up
```

### Environment Configuration

Key environment variables (set in `.env` file):

- **COMPOSE_PROJECT_NAME**: Docker Compose project name (isolates containers/volumes)
- **COMPOSE_FILE**: Compose files to use (colon-separated)
- **POSTGRES_DB**: Database name (budget, budget-prod, or not set for mock)
- **POSTGRES_USER**: Database user (default: dev)
- **POSTGRES_PASSWORD**: Database password (default: dev)
- **WEB_PORT**: Backend port mapping (8000, 8002)
- **FRONTEND_PORT**: Frontend port mapping (5173 for dev, 5174 for mock)

**Note**: Traefik routing (service names, domains) is configured directly in `.local.yaml` files, which are gitignored and user-specific.

### Traefik Configuration

Traefik routing is configured in `.local.yaml` files (gitignored, user-specific). These files contain hardcoded service names and domains for your specific setup.

**If you're using Traefik**, create these files with your domain:

**compose-dev.local.yaml** example:
- Backend: `Host(grove-dev.yourdomain.com) && PathPrefix(/api)` → service port 8000
- Frontend: `Host(grove-dev.yourdomain.com)` → service port 5173

**compose-mock.local.yaml** example:
- Frontend: `Host(grove-mock.yourdomain.com)` → service port 5173

**compose-prod.local.yaml** example:
- App: `Host(grove-prod.yourdomain.com)` → service port 8000 (single container)

**Direct Access (no Traefik needed):**
- Dev: http://localhost:8000 (backend), http://localhost:5173 (frontend)
- Mock: http://localhost:5174
- Prod: http://localhost:8002

### Database Migrations

Each environment maintains its own schema state:
- **Dev**: Frequent schema changes during development
- **Prod**: Stable schema for production testing

Migrations run automatically on startup via `app/main.py:run_migrations()`.

To manually run migrations in a specific environment:

```bash
# Ensure correct .env is active (check with: cat .env | grep COMPOSE_PROJECT_NAME)
docker compose exec app alembic upgrade head
```

### Backup and Recovery

Each environment can have isolated backups:

```bash
# Backup specific database
docker compose exec db pg_dump -U dev budget > backups/budget-$(date +%Y%m%d).sql
docker compose exec db pg_dump -U dev budget-prod > backups/budget-prod-$(date +%Y%m%d).sql

# Restore to specific database
docker compose exec -T db psql -U dev budget < backups/budget-20260322.sql
docker compose exec -T db psql -U dev budget-prod < backups/budget-prod-20260322.sql
```

The `./backups` directory is mounted in all environments for easy access.

### Troubleshooting

**Check current environment:**
```bash
cat .env | grep COMPOSE_PROJECT_NAME
docker compose ps
```

**View environment-specific logs:**
```bash
docker compose logs -f app
docker compose logs -f frontend  # dev only
```

**Reset environment (preserves database):**
```bash
docker compose down
docker compose up -d
```

**Reset specific database:**
```bash
docker compose exec db psql -U dev -d postgres -c "DROP DATABASE \"budget-prod\";"
docker compose exec db psql -U dev -d postgres -c "CREATE DATABASE \"budget-prod\";"
docker compose restart app  # Re-run migrations
```

**Connect to specific database:**
```bash
docker compose exec db psql -U dev -d budget
docker compose exec db psql -U dev -d budget-prod
```

**List all databases:**
```bash
docker compose exec db psql -U dev -l
# Should show: budget, budget-prod (and postgres, template0, template1)
```

**Access via Traefik vs direct ports:**
- Traefik requires DNS setup and .local.yaml configuration
- Direct ports work immediately after `docker compose up`
- Both access methods work simultaneously

### Container Isolation

Each environment uses `COMPOSE_PROJECT_NAME` to create separate Docker resources:
- Dev containers: `grove-dev_app`, `grove-dev_db`, `grove-dev_frontend`
- Mock containers: `grove-mock_frontend`
- Prod containers: `grove-prod_app`, `grove-prod_db`

This allows running multiple environments simultaneously (different ports prevent conflicts).

### Benefits

- **Standardized naming**: Consistent compose-{env}.yaml pattern
- **Database isolation**: Prod testing won't affect dev data
- **Port flexibility**: Run multiple environments simultaneously
- **Resource efficient**: Single PostgreSQL with separate databases
- **Simple promotion**: One script per environment transition
- **Developer-friendly**: Scripts, examples, comprehensive documentation
- **Git-friendly**: DNS/Traefik config gitignored, base files and examples committed
- **Dual access**: Traefik routing + direct localhost ports

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

### Hardcoded Category/Group Name Assumptions (Multi-Language Preparation)

**Status**: Acceptable for current English-only usage. Document for future internationalization work.

**Context**: The application currently uses name-based pattern matching to identify special categories and groups. This works fine for English but would require refactoring for multi-language support. Any changes would also require new settings UI, which isn't a priority now.

**Current Name-Based Lookups** (working as designed):

1. **Transfer Category** (`app/crud/query_builder.py:44`)
   - Pattern: `Category.name.ilike("%transfer%")`
   - Used for: Excluding transfers from income/expense reports
   - Risk: Could match unintended categories; won't work in other languages

2. **Paycheck Category** (`app/crud/report.py:570, 941`)
   - Exact match: `Category.name == "Paycheck"`
   - Used for: Paycheck analysis widget, income vs expenses report
   - Has null checks, returns empty data if not found

3. **Bills & Utilities Group** (`app/crud/report.py:370, 777`)
   - Pattern: `Group.name.ilike("%util%")`
   - Used for: Utilities report, upcoming bills widget
   - Excludes: `Category.name.ilike("%mortgage%")` and `Category.name.ilike("%rent%")`
   - Risk: Pattern could match unintended groups; language-specific

**Future Architecture Options** (for multi-language support):

**Option 1: Category Type Enum** (Recommended)
```python
class Category(Base):
    # ...
    category_type = Column(Enum('expense', 'income', 'transfer', name='category_type'))
    is_utility = Column(Boolean, default=False)  # For utility categorization
    exclude_from_utility_reports = Column(Boolean, default=False)  # For mortgage/rent
```

**Option 2: System Configuration Table**
```python
class SystemConfig(Base):
    key = Column(String, primary_key=True)
    value = Column(JSON)

# Examples:
# {"special_categories": {"transfer": 42, "paycheck": 1}}
# {"report_groups": {"utilities": 7}}
```

**Option 3: Category Tags**
```python
class Category(Base):
    # ...
    tags = Column(ARRAY(String))  # ["income", "recurring", "exclude_utilities"]
```

**Required Changes for Multi-Language Support**:
- Add category type/tag fields to database schema
- Create settings UI to configure special categories/groups
- Update all name-based queries to use type/tag filters instead
- Migration script to auto-detect and tag existing categories based on current names
- Localization of category/group names separate from system functionality

**Tracking**: This is prep work for multi-language support. Not a priority until internationalization is needed.

**Reference**: See conversation from 2026-02-28 about hardcoded ID audit and category name assumptions
