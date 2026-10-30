-- Migration 021: Add token_version to tbl_users for token invalidation on password/role/status change
ALTER TABLE tbl_users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1;
UPDATE tbl_users SET token_version = 1 WHERE token_version IS NULL;
