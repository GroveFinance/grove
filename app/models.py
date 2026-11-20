import enum
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
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
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

# Typed SQLAlchemy 2.x declarative models. Nullability is stated explicitly on
# every column so the schema stays identical to the migrations (verify with
# `alembic check` after any change here).


class Org(Base):
    __tablename__ = "orgs"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # comes from provider
    name: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str | None] = mapped_column(String, nullable=True)
    sfin_url: Mapped[str | None] = mapped_column(String, nullable=True)
    domain: Mapped[str | None] = mapped_column(String, nullable=True)


class AccountType(str, enum.Enum):
    bank = "bank"
    credit_card = "credit_card"
    investment = "investment"
    loan = "loan"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # provider or manual string id
    name: Mapped[str] = mapped_column(String, nullable=False)
    alt_name: Mapped[str | None] = mapped_column(String, nullable=True)
    currency: Mapped[str] = mapped_column(String, nullable=False, default="USD")
    org_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("orgs.id", ondelete="CASCADE"), nullable=True
    )
    org: Mapped["Org | None"] = relationship("Org")
    is_hidden: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    account_type: Mapped[AccountType | None] = mapped_column(
        SAEnum(AccountType, name="accounttype_enum", create_type=False),
        nullable=True,
    )
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, server_default=None
    )

    @property
    def display_name(self) -> str:
        return str(self.alt_name if self.alt_name else self.name)


class AccountBalance(Base):
    __tablename__ = "account_balance"
    __table_args__ = (Index("ix_balance_account_date", "account_id", "balance_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True
    )
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    available_balance: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    balance_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (Index("ix_transaction_hash", "account_id", "content_hash"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)  # provider string id
    account_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True
    )
    account: Mapped["Account | None"] = relationship("Account")

    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    posted: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    transacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    payee_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("payees.id"), nullable=True)
    payee: Mapped["Payee | None"] = relationship("Payee", back_populates="transactions")

    is_pending: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Merchant Category Code (4-digit code)
    mcc: Mapped[str | None] = mapped_column(String(4), nullable=True)

    # Content hash for deduplication (SHA256 of account_id:posted:amount:description)
    # Index in __table_args__
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=False)

    splits: Mapped[list["TransactionSplit"]] = relationship(
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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=True
    )
    transaction: Mapped["Transaction | None"] = relationship("Transaction", back_populates="splits")

    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id"), nullable=False)
    category: Mapped["Category"] = relationship("Category")

    # portion of the transaction
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)


class Holding(Base):
    __tablename__ = "holdings"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    account_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True
    )
    account: Mapped["Account | None"] = relationship("Account")
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    currency: Mapped[str] = mapped_column(String, nullable=False, default="USD")
    cost_basis: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    market_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    purchase_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    shares: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    symbol: Mapped[str | None] = mapped_column(String, index=True, nullable=True)


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    categories: Mapped[list["Category"]] = relationship(
        "Category", back_populates="group", order_by="Category.name"
    )


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    group_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )
    group: Mapped["Group | None"] = relationship("Group", back_populates="categories")
    # whole numbers only
    budget: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Payee(Base):
    __tablename__ = "payees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id"), nullable=False)
    category: Mapped["Category"] = relationship("Category")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="payee")


class SyncConfig(Base):
    __tablename__ = "sync_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # e.g., 'simplefin', 'plaid'
    provider_name: Mapped[str] = mapped_column(String, nullable=False)
    config: Mapped[Any] = mapped_column(JSON, nullable=False)
    active: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=True)
    schedule: Mapped[str | None] = mapped_column(String, nullable=True)  # cron syntax
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    errors: Mapped[str | None] = mapped_column(Text, nullable=True)


class SyncRun(Base):
    __tablename__ = "sync_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sync_config_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sync_configs.id", ondelete="CASCADE"), nullable=True
    )
    sync_config: Mapped["SyncConfig | None"] = relationship("SyncConfig")

    # running, completed, failed
    status: Mapped[str] = mapped_column(String, nullable=False, default="running")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Statistics
    accounts_processed: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    transactions_found: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    holdings_found: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Store account-level breakdown
    details: Mapped[Any | None] = mapped_column(JSON, nullable=True)


class Meta(Base):
    __tablename__ = "meta"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str | None] = mapped_column(String, nullable=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class UserSetting(Base):
    """One row per (user, setting key). Allowed keys live in app/settings_registry.py."""

    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[Any] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
