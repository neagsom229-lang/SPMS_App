# SPMS

Multi-tenant POS and inventory: Express + PostgreSQL API, React + Vite frontend.

- `npm run dev` — dev DB (Docker, 55433), migrations, demo seed, backend, frontend.
- `npm run verify` — test DB, jest, names gate, frontend build, audit, secret scan.
- `npm run verify:full` — verify, mutation run, Playwright golden path, suite x3.
- `npm run rehearse -- <dump.sql>` — owner-run migration rehearsal on a scratch test DB.
- Restore deleted code or history: `docs/RESTORE.md`. Operations: `docs/OPERATIONS.md`.
Tests use Docker Postgres only (`docker-compose.test.yml`); never commit `.env`.
