# SPMS_App rules (read first, every session)
- Database: Postgres in Docker only (docker-compose.test.yml, port 5434). Never connect to or write to the live Supabase DB. Never run supabase commands with --linked, --db-url or --remote.
- Never read, print or edit .env. Never regenerate or edit database/baseline.sql (the owner maintains it).
- Never type test counts or PASS/FAIL by hand. Only `npm run verify` and jest --json output count.
- Never edit a test to make it pass unless the test itself is wrong; show the diff and why.
- Never write a handler that returns success without a real DB change.
- The owner writes all Test-Mutation calls. Do not author mutants.
- Commit a checkpoint before any deletion or large edit. Max 3 retries, then stop and show the raw error.