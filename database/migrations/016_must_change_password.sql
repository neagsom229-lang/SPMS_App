-- Migration 016: Add must_change_password to tbl_users
ALTER TABLE tbl_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
