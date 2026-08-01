# SPMS Documentation

## Getting Started
1. Clone repository
2. Install dependencies
3. Configure .env
4. Run migrations
5. Start server

## API Documentation
### Authentication
POST /api/auth/login
- Username: admin
- Password: admin123

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

### Analytics
GET /api/analytics/monthly-revenue - Monthly revenue
GET /api/analytics/summary - Summary stats
GET /api/analytics/top-products - Top products

## Deployment
1. Deploy backend to Render
2. Deploy frontend to Vercel
3. Configure environment variables

## Support
Email: support@spms.com
Phone: +855 12 345 678