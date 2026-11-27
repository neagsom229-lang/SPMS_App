# RELEASE.md - production release plan (owner-run)

Everything on this page is run by the **owner** against the **production**
database and the Render service. The agent prints these commands; it never runs
them.

## 1. Data backup (owner runs, before anything else)

```bash
docker run --rm -e PGPASSWORD -v D:\Backups:/backups postgres:17-alpine pg_dump -h <host> -p 5432 -U <user> -d postgres --format=custom -f /backups/prod-full-<stamp>.custom
```

## 2. Deploy DB (owner runs; `npm run db:deploy` -> `powershell -ExecutionPolicy Bypass -File backend\scripts\deploy-db.ps1 -Target live -User postgres -Db <project-ref>`)

Applies pending live migrations **026 then 028** (each with `psql -v ON_ERROR_STOP=1 -1`
plus the ledger INSERT in the same transaction; pre-checks and post-checks in the script).

- The live ledger stops at `014`; `015 -> 021` are already applied on live.
- **Deferred (not applied on live): `027`, `022`, `023`, `024`, `025`.**

## 3. Deploy code

Pre-flight: the 026 and 028 rows of the combined SELECT must hold before this.
Tag first, deploy that tag; health check `GET /health` -> `"db": "connected"`.

## 4. Rollback

- **Code:** redeploy the previous git tag (the backend is stateless).
- **Database:** no down-migrations are needed - `026` and `028` are additive and
  idempotent.

## 5. Ops notes

- Pooler session mode: port **5432**.
- Plan limits are **not enforced** in the backend.

---

Gates: the 3x verify, e2e and mutants gates are not part of this page; they run in CI.
