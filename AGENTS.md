# SPMS_App rules (read first, every session)
- Database: Postgres in Docker only (docker-compose.test.yml, the port in TEST_DB_PORT, defined once in backend/scripts/_guard.js (default 55432)). Never connect to or write to the live Supabase DB. Never run supabase commands with --linked, --db-url or --remote.
- Never edit a migration that may be applied to production. Treat 015-026 as possibly applied until the owner confirms; changes go in a NEW additive, idempotent migration.
- Never read, print or edit .env. Never regenerate or edit database/baseline.sql (the owner maintains it).
- Never type test counts or PASS/FAIL by hand. Only `npm run verify` and jest --json output count.
- Never edit a test to make it pass unless the test itself is wrong; show the diff and why.
- Never write a handler that returns success without a real DB change.
- The owner writes all Test-Mutation calls. Do not author mutants.
- Commit a checkpoint before any deletion or large edit. Max 3 retries, then stop and show the raw error.