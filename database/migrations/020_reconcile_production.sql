-- Migration 020: Reconcile production schema drift non-destructively
-- Contains ONLY store_settings opening_hours addition.
-- NOTE: Migrations 019 and 020 never touch any remote database (local test DB reconciliation only via scripts).

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{}'::jsonb;
