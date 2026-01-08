import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship

from app.db import Base


class Org(Base):
    __tablename__ = "orgs"

    id = Column(String, primary_key=True)  # comes from provider
    name = Column(String, nullable=False)
    url = Column(String, nullable=True)
    sfin_url = Column(String, nullable=True)
    domain = Column(String, nullable=True)


class AccountType(str, enum.Enum):
    bank = "bank"
    credit_card = "credit_card"
    investment = "investment"
    loan = "loan"


class Account(Base):
    __tablename__ = "accounts"

    id = Column(String, primary_key=True)  # provider or manual string id
    name = Column(String, nullable=False)
    alt_name = Column(String, nullable=True)
    currency = Column(String, nullable=False, default="USD")
    org_id = Column(String, ForeignKey("orgs.id", ondelete="CASCADE"))
    org = relationship("Org")
    is_hidden = Column(Boolean, default=False)
    account_type: Column[AccountType | None] = Column(
        SAEnum(AccountType, name="accounttype_enum", create_type=False),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=None)

    @property
    def display_name(self) -> str:
        return str(self.alt_name if self.alt_name else self.name)


class AccountBalance(Base):
    __tablename__ = "account_balance"
    __table_args__ = (Index("ix_balance_account_date", "account_id", "balance_date"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(String, ForeignKey("accounts.id", ondelete="CASCADE"))
    balance = Column(Numeric(12, 2), nullable=False)
    available_balance = Column(Numeric(12, 2), nullable=True)
    balance_date = Column(DateTime(timezone=True), nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (Index("ix_transaction_hash", "account_id", "content_hash"),)

    id = Column(String, primary_key=True)  # provider string id
    account_id = Column(String, ForeignKey("accounts.id", ondelete="CASCADE"))
    account = relationship("Account")

    amount = Column(Numeric(12, 2), nullable=False)
    posted = Column(DateTime(timezone=True), index=True, nullable=False)
    transacted_at = Column(DateTime(timezone=True), nullable=True)

    payee_id = Column(Integer, ForeignKey("payees.id"), nullable=True)
    payee = relationship("Payee", back_populates="transactions")

    is_pending = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    memo = Column(Text, nullable=True)

    # Content hash for deduplication (SHA256 of account_id:posted:amount:description)
    content_hash = Column(String(64), nullable=True, index=False)  # Index in __table_args__

    splits = relationship(
        "TransactionSplit",
        back_populates="transaction",
        cascade="all, delete-orphan",
    )


class TransactionSplit(Base):
    __tablename__ = "transaction_splits"
    __table_args__ = (
        Index("ix_split_category", "category_id"),
        Index("ix_split_transaction", "transaction_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String, ForeignKey("transactions.id", ondelete="CASCADE"))
    transaction = relationship("Transaction", back_populates="splits")

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    category = relationship("Category")

    amount = Column(Numeric(12, 2), nullable=False)  # portion of the transaction


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(String, primary_key=True)
    account_id = Column(String, ForeignKey("accounts.id", ondelete="CASCADE"))
    created = Column(DateTime(timezone=True), nullable=False)
    currency = Column(String, nullable=False, default="USD")
    cost_basis = Column(Numeric(18, 6), nullable=True)
    description = Column(Text, nullable=True)
    market_value = Column(Numeric(18, 6), nullable=True)
    purchase_price = Column(Numeric(18, 6), nullable=True)
    shares = Column(Numeric(18, 6), nullable=True)
    symbol = Column(String, index=True, nullable=True)


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    categories = relationship("Category", back_populates="group", order_by="Category.name")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="SET NULL"))
    group = relationship("Group", back_populates="categories")
    budget = Column(Integer, default=0, nullable=False)  # whole numbers only


class Payee(Base):
    __tablename__ = "payees"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    category = relationship("Category")
    transactions = relationship("Transaction", back_populates="payee")


class SyncConfig(Base):
    __tablename__ = "sync_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    provider_name = Column(String, nullable=False)  # e.g., 'simplefin', 'plaid'
    config = Column(JSON, nullable=False)
    active = Column(Boolean, default=True)
    schedule = Column(String, nullable=True)  # cron syntax
    last_sync = Column(DateTime(timezone=True), nullable=True)
    errors = Column(Text, nullable=True)


class SyncRun(Base):
    __tablename__ = "sync_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sync_config_id = Column(Integer, ForeignKey("sync_configs.id", ondelete="CASCADE"))
    sync_config = relationship("SyncConfig")

    status = Column(String, nullable=False, default="running")  # running, completed, failed
    started_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Statistics
    accounts_processed = Column(Integer, default=0)
    transactions_found = Column(Integer, default=0)
    holdings_found = Column(Integer, default=0)

    error_message = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)  # Store account-level breakdown


class Meta(Base):
    __tablename__ = "meta"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)
