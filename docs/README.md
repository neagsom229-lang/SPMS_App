# SPMS Documentation

## Getting Started
1. Clone repository
2. Run `npm run install:all`
3. Native local PostgreSQL 18: run `database/local/001_app_role.sql` once as
   `postgres`, copy `backend/.env.example` → `backend/.env` and
   `frontend/.env.example` → `frontend/.env`, then set the local password in
   `DATABASE_URL` (never commit `.env`). Without `backend/.env`, `npm run dev`
   falls back to the Docker dev container on `127.0.0.1:15433`.
4. Run `npm run dev` (preflight → migrate → demo seed → backend + frontend)
5. Optional: `npm run smoke:local` while the dev servers are running.

## Demo login (local seed only — not a production credential)
`backend/scripts/seed-demo.js` creates the local demo shop and prints its
credentials once on the first seed: `demo_admin`, `demo_staff`, `demo_forced`
(forced password change) and the super-admin `demo_root`, all with the local
demo password shown by the seed. These are demo-only values; never reuse them
in production. Older notes about `admin` / `admin123` or a `superadmin` seed are
stale and are not accepted by the API.

## API Documentation
### Authentication
POST /api/auth/login

### Products
GET /api/products - Get all products
POST /api/products - Create product
PUT /api/products/:id - Update product
DELETE /api/products/:id - Delete product

### Customers
GET /api/customers - Get all customers
POST /api/customers - Create customer
PUT /api/customers/:id - Update customer
DELETE /api/customers/:id - Delete customer

### Orders
GET /api/orders - Get all orders
POST /api/orders - Create order
DELETE /api/orders/:id - Delete order

### Reports
GET /api/reports/products - Product report
GET /api/reports/customers - Customer report
GET /api/reports/orders - Order report
GET /api/reports/sales - Sales report

## Deployment
1. Provision a hosted PostgreSQL database and put its connection string in the
   backend host's `DATABASE_URL`. `NODE_ENV=production` enables TLS with
   certificate verification; set `DB_SSL_CA` only for a private CA. Never set
   `DB_SSL=false` in production and never commit the connection string.
2. Deploy backend to Render
3. Deploy frontend to Vercel with `VITE_API_URL=https://<backend-host>/api`
4. Apply pending migrations with the owner-run `npm run db:deploy`; see
   `DEPLOY_CHECKLIST.md`.

## Support
Email: support@spms.com
Phone: +855 12 345 678