"""Initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-01-07 00:00:00.000000

This is a consolidated migration that represents the complete current schema.
For existing databases, manually stamp this revision without running upgrade.
For new databases, this creates all tables from scratch.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create orgs table
    op.create_table(
        "orgs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column("sfin_url", sa.String(), nullable=True),
        sa.Column("domain", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create accounttype_enum type
    op.execute("CREATE TYPE accounttype_enum AS ENUM ('bank', 'credit_card', 'investment', 'loan')")

    # Create accounts table
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("alt_name", sa.String(), nullable=True),
        sa.Column("currency", sa.String(), nullable=False, server_default="USD"),
        sa.Column("org_id", sa.String(), nullable=True),
        sa.Column("is_hidden", sa.Boolean(), nullable=True, server_default="false"),
        sa.Column(
            "account_type",
            postgresql.ENUM(
                "bank",
                "credit_card",
                "investment",
                "loan",
                name="accounttype_enum",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create groups table
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # Create categories table
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.Column("budget", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # Create payees table
    op.create_table(
        "payees",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_payees_name", "payees", ["name"])

    # Create transactions table
    op.create_table(
        "transactions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("account_id", sa.String(), nullable=True),
        sa.Column("payee_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("posted", sa.DateTime(timezone=True), nullable=False),
        sa.Column("transacted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_pending", sa.Boolean(), nullable=True, server_default="false"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("content_hash", sa.String(64), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["payee_id"], ["payees.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_transactions_account_id", "transactions", ["account_id"])
    op.create_index("idx_transactions_posted", "transactions", ["posted"])
    op.create_index("ix_transaction_hash", "transactions", ["account_id", "content_hash"])

    # Create transaction_splits table
    op.create_table(
        "transaction_splits",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.String(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_split_transaction", "transaction_splits", ["transaction_id"])
    op.create_index("ix_split_category", "transaction_splits", ["category_id"])

    # Create holdings table
    op.create_table(
        "holdings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("account_id", sa.String(), nullable=True),
        sa.Column("created", sa.DateTime(timezone=True), nullable=False),
        sa.Column("currency", sa.String(), nullable=False, server_default="USD"),
        sa.Column("cost_basis", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("market_value", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("purchase_price", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("shares", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("symbol", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_holdings_symbol", "holdings", ["symbol"])

    # Create account_balance table
    op.create_table(
        "account_balance",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.String(), nullable=True),
        sa.Column("balance", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("available_balance", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("balance_date", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_balance_account_date",
        "account_balance",
        ["account_id", "balance_date"],
    )

    # Create sync_configs table
    op.create_table(
        "sync_configs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("provider_name", sa.String(), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=True, default=True),
        sa.Column("schedule", sa.String(), nullable=True),
        sa.Column("last_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("errors", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # Create sync_runs table
    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sync_config_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="running"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accounts_processed", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("transactions_found", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("holdings_found", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["sync_config_id"], ["sync_configs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_sync_runs_sync_config_id", "sync_runs", ["sync_config_id"])
    op.create_index("idx_sync_runs_started_at", "sync_runs", ["started_at"])

    # Create meta table (for tracking seed status, etc.)
    op.create_table(
        "meta",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    # Drop all tables in reverse order
    op.drop_table("meta")
    op.drop_index("idx_sync_runs_started_at", table_name="sync_runs")
    op.drop_index("idx_sync_runs_sync_config_id", table_name="sync_runs")
    op.drop_table("sync_runs")
    op.drop_table("sync_configs")
    op.drop_index("ix_balance_account_date", table_name="account_balance")
    op.drop_table("account_balance")
    op.drop_index("idx_holdings_symbol", table_name="holdings")
    op.drop_table("holdings")
    op.drop_index("ix_split_category", table_name="transaction_splits")
    op.drop_index("ix_split_transaction", table_name="transaction_splits")
    op.drop_table("transaction_splits")
    op.drop_index("ix_transaction_hash", table_name="transactions")
    op.drop_index("idx_transactions_posted", table_name="transactions")
    op.drop_index("idx_transactions_account_id", table_name="transactions")
    op.drop_table("transactions")
    op.drop_index("idx_payees_name", table_name="payees")
    op.drop_table("payees")
    op.drop_table("categories")
    op.drop_table("groups")
    op.drop_table("accounts")
    # Drop the enum type
    sa.Enum(name="accounttype_enum").drop(op.get_bind(), checkfirst=True)
    op.drop_table("orgs")
