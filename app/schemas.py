from datetime import datetime
from decimal import Decimal
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from .models import AccountType


# ===== Category =====
class CategoryBase(BaseModel):
    name: str
    budget: int = 0


class CategoryCreate(CategoryBase):
    group_id: int


class CategoryOut(CategoryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class CategoryUpdate(BaseModel):
    name: str | None = None
    budget: float | None = None
    group_id: int | None = None


# ===== Group =====
class GroupBase(BaseModel):
    name: str


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: str | None = None


class GroupOut(GroupBase):
    id: int
    categories: list[CategoryOut] = []

    model_config = ConfigDict(from_attributes=True)


# ===== Sync Config =====
class SyncConfigBase(BaseModel):
    name: str | None = Field(None, description="Optional friendly name")
    provider_name: str = Field(..., description="Name of the sync provider")
    config: dict[str, Any] = Field(..., description="Provider-specific config data")
    active: bool = Field(True, description="Whether this sync config is active")
    schedule: str | None = Field(
        None,
        description="Cron schedule for automatic syncs, e.g., '0 0 * * *' for daily at midnight",
    )
    last_sync: datetime | None = Field(None, description="Timestamp of the last successful sync")
    errors: str | None = Field(None, description="Any errors encountered during the last sync")


class SyncConfigCreate(SyncConfigBase):
    pass


class SyncConfigUpdate(BaseModel):
    name: str | None = None
    config: dict[str, Any] | None = None
    active: bool | None = None
    schedule: str | None = None
    last_sync: datetime | None = None
    errors: str | None = None


class SyncConfigOut(SyncConfigBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ===== Sync Run =====
class SyncRunBase(BaseModel):
    sync_config_id: int
    status: str = "running"  # running, completed, failed
    started_at: datetime
    completed_at: datetime | None = None
    accounts_processed: int = 0
    transactions_found: int = 0
    holdings_found: int = 0
    error_message: str | None = None
    details: dict[str, Any] | None = None


class SyncRunCreate(BaseModel):
    sync_config_id: int
    started_at: datetime


class SyncRunUpdate(BaseModel):
    status: str | None = None
    completed_at: datetime | None = None
    accounts_processed: int | None = None
    transactions_found: int | None = None
    holdings_found: int | None = None
    error_message: str | None = None
    details: dict[str, Any] | None = None


class SyncRunOut(SyncRunBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ===== Org =====
class OrgBase(BaseModel):
    name: str
    url: str
    sfin_url: str = Field(..., alias="sfin-url", description="SimpleFin URL for the organization")
    domain: str

    model_config = ConfigDict(populate_by_name=True)


class OrgCreate(OrgBase):
    id: str

    model_config = ConfigDict(populate_by_name=True)


class OrgUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    sfin_url: str | None = Field(None, alias="sfin-url")
    domain: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class OrgOut(OrgBase):
    id: str

    class Config:
        from_attributes = True


# ===== Payee =====
class PayeeBase(BaseModel):
    name: str
    category_id: int | None = None


class PayeeCreate(PayeeBase):
    pass


class PayeeUpdate(BaseModel):
    payee: str | None = None
    category_id: int | None = None


class PayeeOut(PayeeBase):
    id: int
    category: CategoryOut | None = None
    model_config = ConfigDict(from_attributes=True)


# ===== Account =====
class AccountBase(BaseModel):
    name: str
    alt_name: str | None = None
    currency: str
    org_id: str
    account_type: AccountType | None = None
    is_hidden: bool | None = Field(False, description="Whether this account is hidden from views")


class AccountCreate(AccountBase):
    id: str


class AccountUpdate(BaseModel):
    name: str | None = None
    alt_name: str | None = None
    currency: str | None = None
    org_id: str | None = None
    account_type: AccountType | None = None
    is_hidden: bool | None = None


class AccountOut(AccountBase):
    id: str
    display_name: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AccountDetailsOut(BaseModel):
    account_id: str
    name: str
    alt_name: str | None = None
    display_name: str
    currency: str
    account_type: AccountType | None = None
    org_name: str
    org_domain: str
    balance: Decimal | None = None
    balance_date: datetime | None = None
    created_at: datetime | None = None
    is_hidden: bool | None = Field(False, description="Whether this account is hidden from views")


class AccountMergeRequest(BaseModel):
    source_account_id: str = Field(..., description="Account to merge FROM (will be deleted)")
    target_account_id: str = Field(..., description="Account to merge TO (will be kept)")
    preserve_categorization: bool = Field(
        True, description="Whether to preserve splits/categories from source"
    )


class AccountMergeResponse(BaseModel):
    success: bool
    transactions_reassigned: int
    transactions_removed: int
    transactions_matched: int = Field(
        0, description="Transactions where categorization was preserved"
    )
    holdings_reassigned: int
    source_account_deleted: bool
    message: str


class DuplicateAccountGroup(BaseModel):
    org_id: str
    name: str
    accounts: list[AccountDetailsOut]


# ===== Account Balance =====
class AccountBalanceBase(BaseModel):
    account_id: str
    balance: Decimal
    available_balance: Decimal | None = None
    balance_date: datetime


class AccountBalanceCreate(AccountBalanceBase):
    pass


class AccountBalanceUpdate(BaseModel):
    balance: Decimal | None = None
    available_balance: Decimal | None = None
    balance_date: datetime | None = None


class AccountBalanceOut(AccountBalanceBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ===== Transaction Split =====
class TransactionSplitBase(BaseModel):
    category_id: int
    amount: Decimal


class TransactionSplitCreate(TransactionSplitBase):
    pass  # same fields, used for input on create


class TransactionSplitUpdate(BaseModel):
    category_id: int | None = None
    amount: Decimal | None = None


class TransactionSplitOut(TransactionSplitBase):
    id: int
    category: CategoryOut | None = None

    model_config = ConfigDict(from_attributes=True)


# ===== Transaction ========
class TransactionBase(BaseModel):
    account_id: str
    amount: Decimal
    posted: datetime
    transacted_at: datetime
    payee_id: int | None = None
    is_pending: bool | None = False
    description: str | None = None
    memo: str | None = None


class TransactionCreate(TransactionBase):
    id: str
    splits: list[TransactionSplitBase] | None = None  # if omitted, one default split


class TransactionUpdate(BaseModel):
    amount: Decimal | None = None
    posted: datetime | None = None
    transacted_at: datetime | None = None
    payee_id: int | None = None
    is_pending: bool | None = None
    description: str | None = None
    memo: str | None = None
    splits: list[TransactionSplitBase] | None = None


class TransactionOut(TransactionBase):
    id: str
    payee: PayeeOut | None = None
    account: AccountOut | None = None
    splits: list[TransactionSplitOut] = []  # expose splits instead of flat category

    model_config = ConfigDict(from_attributes=True)


# ===== Holding =====


class HoldingBase(BaseModel):
    account_id: str
    created: datetime
    currency: str
    cost_basis: Decimal
    description: str | None
    market_value: Decimal
    purchase_price: Decimal
    shares: Decimal
    symbol: str


class HoldingCreate(HoldingBase):
    id: str


class HoldingUpdate(BaseModel):
    created: datetime | None
    currency: str | None
    cost_basis: Decimal | None
    description: str | None
    market_value: Decimal | None
    purchase_price: Decimal | None
    shares: Decimal | None
    symbol: str | None


class HoldingOut(HoldingBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


## ===== Report =====
## not backed by DB directly, but used for API responses


class CashFlow(BaseModel):
    income: float
    expenses: float


class CategoryExpense(BaseModel):
    category: str
    amount: float


class ExpenseItem(BaseModel):
    id: int
    payee: str
    amount: float
    category: str
    date: datetime


class ReportResponse(BaseModel):
    cash_flow: CashFlow | None = None
    highest_expense_categories: list[CategoryExpense] | None = None
    top_expense_categories: list[CategoryExpense] | None = None
    largest_expenses: list[ExpenseItem] | None = None
    income_vs_expenses: list[dict] | None = None  # {month, income, expenses}
    net_worth: list[dict] | None = None  # {month, value}
    expenses_over_time: list[dict] | None = None  # {month, category, amount}
    utility_trends: list[dict] | None = None  # {month, utility, amount}


T = TypeVar("T")


class ReportOut(BaseModel, Generic[T]):
    report_type: str | None = None
    period: dict[str, str]  # { "start": "2025-01-01", "end": "2025-08-21" }
    data: list[T] = []  # list of MonthSeries or other report-specific data


class MonthSeries(BaseModel):
    month: str  # "YYYY-MM"
    category_id: int | None
    category: str | None
    group_name: str | None = None
    total: float


class BudgetUsageRow(BaseModel):
    category_id: int
    category: str
    budget: float
    actual: float
    utilization: float
    over_budget: bool = Field(False, description="True if actual > budget")


class UtilityDataPoint(BaseModel):
    """Data point for utility reports - flexible for different modes"""

    category: str
    month: str | None = None  # For monthly mode: "YYYY-MM"
    amount: float | None = None  # For monthly mode
    this_year: float | None = None  # For year_comparison mode
    last_year: float | None = None  # For year_comparison mode


class IncomeExpenseDataPoint(BaseModel):
    """Data point for income vs expense report by month"""

    month: str  # "YYYY-MM"
    income: float
    expenses: float
    net: float  # income - expenses
    paycheck_income: float  # income from Paycheck category only


class NetWorthDataPoint(BaseModel):
    """Data point for net worth history by month"""

    month: str  # "YYYY-MM"
    net_worth: float  # Total net worth at end of month


class UpcomingBillDataPoint(BaseModel):
    """Data point for upcoming bills prediction"""

    payee: str
    category: str
    average_amount: float
    expected_date: str  # ISO date format
    recurrence_type: str  # "monthly", "quarterly", "annual", etc.
    days_until_due: int
    last_transaction_date: str | None = None  # ISO date format


class TopTransactionDataPoint(BaseModel):
    """Data point for top transactions report"""

    id: str
    date: str  # ISO date format
    payee: str | None
    category: str
    account: str | None
    amount: float
    description: str | None = None
