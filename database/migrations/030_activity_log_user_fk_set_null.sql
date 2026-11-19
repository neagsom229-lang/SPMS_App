-- Migration 030: allow deleting a user without orphaning the audit trail.
-- Order status audit rows keep the user id (and the details text keeps the
-- actor id/name) but a user deleted by admin tooling must not block cleanup.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tbl_activity_logs_user_id_fkey'
      AND conrelid = 'tbl_activity_logs'::regclass
  ) THEN
    ALTER TABLE tbl_activity_logs DROP CONSTRAINT tbl_activity_logs_user_id_fkey;
    ALTER TABLE tbl_activity_logs
      ADD CONSTRAINT tbl_activity_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES tbl_users(userid) ON DELETE SET NULL;
  END IF;
END $$;
