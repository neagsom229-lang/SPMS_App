# SPMS Database Migrations

## Authoritative migration system
The authoritative migration system is the **existing custom runner**:

- SQL files: `database/migrations/001_...sql` through `030_...sql`
- Baseline: `database/baseline.sql` (generated from `schema.sql` + migrations 001-014; schema-only; no data)
- Runner: `backend/scripts/run_migration.js`
- Ledger: `public.schema_migrations(filename VARCHAR(255) PRIMARY KEY, executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`

Do **not** create a competing Supabase CLI migration history. Do **not** copy these into `supabase/migrations` or use `supabase db push` as a replacement unless an explicitly reviewed mapping is approved.

## How `run_migration.js` works
1. Resolves `DATABASE_URL` (defaults to test DB URL in test mode).
2. Applies `_guard.js` checks (`assertDatabaseUrl`) to prevent unsafe targets.
3. Ensures `schema_migrations` table exists.
4. Reads `database/migrations/*.sql`, sorts lexically, skips already-recorded filenames.
5. For each pending file: `BEGIN`; execute SQL; `INSERT INTO schema_migrations(filename)`; `COMMIT`.
6. On error: `ROLLBACK`, log, exit 1.
7. Runs a second pass for idempotency check.

## Canonical build paths
### Fresh test DB
`backend/scripts/test-db.js`:
1. Load `database/baseline.sql`.
2. Insert ledger rows for 001-014.
3. Run `run_migration.js` for 015+.

### Rehearsal (owner-run)
`backend/scripts/rehearse.js <schema-only-dump.sql>`:
- Loads dump into scratch test DB (pre-creates `extensions`, skips Supabase-managed vault/publication lines in memory).
- Marks 001-014 ledger.
- Runs 015+.
- Prints schema signature diff and drift vs fresh baseline build.

## Fresh empty production initialization plan (draft)
For an empty Supabase target, after read-only verification and explicit approval:
1. Apply `baseline.sql`.
2. Insert 001-014 into `schema_migrations` (`ON CONFLICT DO NOTHING`).
3. Run custom runner to apply 015-030.
4. Run idempotency pass.
5. Verify ledger has 30 rows and schema objects/constraints/RLS/privileges match expectations.

## Migration safety notes
- Migrations 015-026 are treated as possibly applied to production; never edit them. Future fixes go in a new additive, idempotent migration.
- `deploy-db.ps1` is hardcoded for 026/028 only and is not a general deploy mechanism.
- Runner hardening (local code): session-level PostgreSQL advisory lock (`pg_advisory_lock`/`unlock` on fixed key) prevents concurrent runs; `schema_migrations.checksum` column stores SHA-256 for newly applied migrations; checksum mismatches fail fast; legacy rows without checksum are warned but not faked; ledger consistency checks for unknown/missing files. Historical checksums are **not** reconstructed.
- Remaining gap: remote-target guard/wrapper still needs explicit approved design because `_guard.js` blocks unsafe targets by default.
- **Never run migrations against remote Supabase without explicit owner approval and reviewed deployment plan.**