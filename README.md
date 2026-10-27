# SPMS (Sale & Product Management System)

A multi-tenant POS and Inventory SaaS application built with Node.js, Express, PostgreSQL (Neon), React 18, Vite, and TailwindCSS.

## Architecture

- **Backend (`/backend`):** Node.js, Express 4, `node-pg` connecting to PostgreSQL, JWT authentication, bcrypt password hashing, tenant isolation middleware.
- **Frontend (`/frontend`):** React 18, Vite, TailwindCSS, React Query, React Router v6, Axios client.
- **Deployment:** Render (API backend) + Vercel (Frontend SPA).

---

## Environment Variables

Create a `.env` file in root or backend based on `.env.example`:

- `DATABASE_URL`: PostgreSQL connection string (Neon DB)
- `JWT_SECRET`: Secret key for JWT signing (required)
- `ADMIN_SECRET`: Super admin seed password
- `FRONTEND_URL`: Allowed frontend CORS origin
- `STRIPE_SECRET_KEY`: Stripe API secret key
- `STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
- `SMTP_*`: Email configuration for notifications
- `VITE_API_URL`: Backend API base URL for frontend

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
