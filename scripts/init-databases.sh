#!/bin/bash
set -e

# This script runs on PostgreSQL first startup to create the prod database
# It's idempotent - safe to run multiple times
# The 'budget' database is created automatically by POSTGRES_DB env var

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    -- Create budget-prod database if it doesn't exist
    SELECT 'CREATE DATABASE "budget-prod"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'budget-prod')\gexec
EOSQL

echo "Database initialization complete: budget-prod created (budget already exists from POSTGRES_DB)"
