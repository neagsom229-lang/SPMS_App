# SPMS (Sale & Product Management System)

A multi-tenant POS and Inventory SaaS application built with Node.js, Express, PostgreSQL, React 18, Vite, and TailwindCSS.

## Architecture

- **Backend (`/backend`):** Node.js, Express 4, `node-pg` connecting to PostgreSQL, JWT authentication, bcrypt password hashing, tenant isolation middleware.
- **Frontend (`/frontend`):** React 18, Vite, TailwindCSS, React Query, React Router v6, Axios client.
- **Deployment:** Render (API backend) + Vercel (Frontend SPA).

---

## Environment Variables

Create a `.env` file in root or backend based on `.env.example`:

- `DATABASE_URL`: PostgreSQL connection string
- `CORS_ORIGINS`: Allowed CORS origins
- `JWT_SECRET`: Secret key for JWT signing (required)
- `ADMIN_SECRET`: Super admin seed password
- `FRONTEND_URL`: Allowed frontend CORS origin
- `SMTP_*`: Email configuration for notifications
- `VITE_API_URL`: Backend API base URL for frontend
- `BAKONG_PROVIDER`: Provider mode (`nbc`, `relay`, `manual`, default `manual`)
- `BAKONG_API_BASE`: Bakong API base URL
- `BAKONG_TOKEN`: Bearer token for Bakong API
- `BAKONG_TOKEN_EXPIRES_AT`: Token expiration timestamp
- `BAKONG_ACCOUNT_ID`: Receiving merchant Bakong account ID
- `ENABLE_PAYMENT_SIMULATOR`: Enable test simulator (false in production)

---

## Manual Mode Operation

When `BAKONG_PROVIDER=manual`, automated upstream checking returns `NOT_FOUND`. Verification and activation are performed manually by super admins via the admin confirmation screen (`POST /api/payment/admin/sessions/:id/mark-paid`), which updates session status to `PAID`, sets `verified_by = manual:<userId>`, extends the tenant's subscription plan, and writes an audit log.

---

## Local Development

### Prerequisites
- Node.js >= 20
- PostgreSQL database

### 1. Backend Setup
```bash
cd backend
npm install
npm run seed
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## Testing & Build

- **Backend Tests:**
  ```bash
  cd backend
  npm test
  ```
- **Frontend Build:**
  ```bash
  cd frontend
  npm run build
  ```
