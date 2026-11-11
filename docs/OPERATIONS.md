# Operations

What to do when SPMS is running somewhere real. Everything here assumes a
single Postgres instance (Supabase in production) and one backend process per
tenant-facing environment.

- Backups and restore
- Uptime check on `/health`
- Rollback
- Secret rotation
- What to run before deploying

## Backups

Postgres is the only state. The app holds no files worth backing up.

Nightly logical backup (run from a host with the production `DATABASE_URL` in
its environment, never committed):

```bash
pg_dump --no-owner --no-privileges --format=custom \
  --file="spms-$(date -u +%Y%m%dT%H%M%SZ).dump" "$DATABASE_URL"
```

- Keep 7 nightly dumps and 4 weekly dumps. Copy them off the database host.
- Supabase also takes daily platform backups; treat those as the second copy,
  not the only one.
- Verify a dump is readable at least monthly:
  `pg_restore --list <dump> | head` must list tables, not error.

Restore into a scratch database first (never straight over production):

```bash
createdb spms_restore_check
pg_restore --no-owner --no-privileges --dbname spms_restore_check <dump>
```

Then run the app's read-only checks against the scratch DB before promoting.

## Uptime check on `/health`

`GET /health` runs `SELECT 1` and returns:

```json
{ "status": "healthy", "db": "connected", "timestamp": "2026-01-01T00:00:00.000Z" }
```

- HTTP 200 + `"db": "connected"` = app and database both up.
- HTTP 500 + `"db": "disconnected"` = the app is running but the database is
  not reachable. Page on this; it is never a normal state.

External monitor (every 1-2 minutes, alert after 3 consecutive failures):

```bash
curl -fsS -m 10 https://<backend-host>/health | grep -q '"db":"connected"'
```

Do not point the monitor at `/api/...`; those need auth and rate limits.
`/health` is unauthenticated on purpose and returns no tenant data.

## Rollback

Code:

- Deploys are tagged. To roll back, redeploy the previous tag rather than
  hand-editing production files: `git checkout <previous-tag>` and redeploy.
  Tags currently in this repo are listed in `docs/RESTORE.md`.
- The backend is stateless, so the previous build is safe as soon as it starts.

Database:

- Migrations are additive and idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`).
  A code rollback does not require a database rollback: the older code keeps
  working against the newer schema.
- Never drop columns or tables as a "rollback". If a migration must be undone,
  write a new forward migration that reverses it and rehearse it first:

  ```bash
  npm run rehearse -- path/to/schema-only-dump.sql
  ```

  The printed schema signature diff is the deploy plan. `rehearse` loads only
  into a scratch `*_test` database on 127.0.0.1 and refuses any remote host.

## Secret rotation

Rotate on a schedule, and immediately on suspected leak. Each rotation ends
with `npm run verify` and a redeploy.

| Secret | Where it lives | Rotation |
| --- | --- | --- |
| `JWT_SECRET` | backend env | Generate a new random value. All sessions are invalidated (users sign in again); `token_version` also lets you revoke per user without rotating. |
| Database password | `DATABASE_URL` | Rotate in the database provider, update the env var, redeploy within the same window. |
| Bakong API token | backend env | Re-issue in the Bakong console, update env, redeploy, confirm payment creation still works. |
| SMTP credentials | backend env | Re-issue at the mail provider, update env, redeploy. |

Rules:

- Secrets live only in the host's environment / secret store. Never in
  `.env.example`, workflows, code, or commit messages.
- After any change, run `npm run verify` locally; its secret scan must stay
  green, and CI runs gitleaks on every push.
- If a secret was committed, rotate it first, then remove it from history.
  Rotation is the fix; history rewriting is cleanup.

## Before deploying

```bash
npm run verify       # test DB, jest, names gate, build, audit, secret scan
npm run verify:full  # verify + mutation + Playwright golden path + suite x3
```

`verify` exits 1 on any failed check. `verify:full` also exits 1 on a survived
mutant or a failing golden path.

The production deploy plan for schema changes is the signature diff printed by
`npm run rehearse -- <schema-only-dump.sql>` (owner-run only). Apply new
migrations in order; they are written to be re-runnable.
