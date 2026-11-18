# SPMS Documentation

## Getting Started
1. Clone repository
2. Run `npm run install:all`
3. Configure the environment (see root `README.md`; never commit `.env`)
4. Run `npm run dev` (local Docker dev DB, migrations, demo seed, both servers)

## Demo login (local seed only — not a production credential)
The seed in `backend/scripts/seed-postgres.js` creates superadmin /
`SuperAdminPassword123!` (or the value of `ADMIN_SECRET`). Change it before any
real deployment. These values are illustrative placeholders; `admin` / `admin123`
in older notes was stale and is not accepted by the API.

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
1. Deploy backend to Render
2. Deploy frontend to Vercel
3. Configure environment variables

## Support
Email: support@spms.com
Phone: +855 12 345 678