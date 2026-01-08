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

    # Create accounts table
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("alt_name", sa.String(), nullable=True),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), nullable=True),
        sa.Column("is_hidden", sa.Boolean(), nullable=True),
        sa.Column("account_type", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["orgs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create groups table
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # Create categories table
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.Column("budget", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # Create payees table
    op.create_table(
        "payees",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # Create transactions table
    op.create_table(
        "transactions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("account_id", sa.String(), nullable=True),
        sa.Column("payee_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("posted", sa.DateTime(), nullable=False),
        sa.Column("transacted_at", sa.DateTime(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("content_hash", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["payee_id"], ["payees.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_transactions_account_id", "transactions", ["account_id"])
    op.create_index("idx_transactions_posted", "transactions", ["posted"])
    op.create_index("idx_transactions_transacted_at", "transactions", ["transacted_at"])
    op.create_index("idx_transactions_content_hash", "transactions", ["content_hash"])

    # Create transaction_splits table
    op.create_table(
        "transaction_splits",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.String(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_splits_transaction_id", "transaction_splits", ["transaction_id"])
    op.create_index("idx_splits_category_id", "transaction_splits", ["category_id"])

    # Create holdings table
    op.create_table(
        "holdings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("account_id", sa.String(), nullable=True),
        sa.Column("security", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("ticker", sa.String(), nullable=True),
        sa.Column("quantity", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("value", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("value_date", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create account_balance table
    op.create_table(
        "account_balance",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.String(), nullable=False),
        sa.Column("balance", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("balance_date", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_account_balance_account_date",
        "account_balance",
        ["account_id", "balance_date"],
        unique=True,
    )

    # Create sync_config table
    op.create_table(
        "sync_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("provider_name", sa.String(), nullable=False),
        sa.Column("config", sa.JSON(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=True),
        sa.Column("schedule_cron", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # Create sync_runs table
    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sync_name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("accounts_synced", sa.Integer(), nullable=True),
        sa.Column("transactions_added", sa.Integer(), nullable=True),
        sa.Column("transactions_updated", sa.Integer(), nullable=True),
        sa.Column("raw_response", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["sync_name"], ["sync_config.name"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_sync_runs_sync_name", "sync_runs", ["sync_name"])
    op.create_index("idx_sync_runs_started_at", "sync_runs", ["started_at"])


def downgrade() -> None:
    # Drop all tables in reverse order
    op.drop_index("idx_sync_runs_started_at", table_name="sync_runs")
    op.drop_index("idx_sync_runs_sync_name", table_name="sync_runs")
    op.drop_table("sync_runs")
    op.drop_table("sync_config")
    op.drop_index("idx_account_balance_account_date", table_name="account_balance")
    op.drop_table("account_balance")
    op.drop_table("holdings")
    op.drop_index("idx_splits_category_id", table_name="transaction_splits")
    op.drop_index("idx_splits_transaction_id", table_name="transaction_splits")
    op.drop_table("transaction_splits")
    op.drop_index("idx_transactions_content_hash", table_name="transactions")
    op.drop_index("idx_transactions_transacted_at", table_name="transactions")
    op.drop_index("idx_transactions_posted", table_name="transactions")
    op.drop_index("idx_transactions_account_id", table_name="transactions")
    op.drop_table("transactions")
    op.drop_table("payees")
    op.drop_table("categories")
    op.drop_table("groups")
    op.drop_table("accounts")
    op.drop_table("orgs")
