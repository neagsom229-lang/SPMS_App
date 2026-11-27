# SPMS Database Schema (Summary)

> Canonical source: `database/baseline.sql` (generated, schema-only) + `database/migrations/001-030`. Do not hand-edit baseline. This summary is for orientation; verify exact columns/constraints/indexes in SQL files before changes.

## Core tables
| Table | Purpose | Key columns / notes |
|---|---|---|
| `tenants` | Tenant/business | `id`, `name`, `subdomain`, `status`, `plan`, `plan_expires_at`, admin/contact/settings columns added by 028 |
| `tbl_users` | Users/auth | `userid`, `username`, `email`, `password`, `role`, `is_super_admin`, `tenant_id`, `token_version`, `must_change_password` |
| `tbl_categories` | Product categories | `id`, `name`, `tenant_id` |
| `tbl_products` | Products/catalog | `id`, `name`, `name_kh`, `category_id`, `price`, `cost`, `stock`, `barcode`, publish/status fields, `tenant_id` |
| `tbl_stock` | Current stock | `productid`, `qtyinstock`, `qtyavailable`, `tenant_id`; unique/check constraints in 017 |
| `tbl_stock_log` | Stock movements | `product_id`, `change_qty`, `type`, refs/notes, `tenant_id` |
| `tbl_customers` | Customers | `cus_id`, `name`, contact fields, `tenant_id` |
| `tbl_suppliers` | Suppliers | `sup_name`, contact fields, `tenant_id` |
| `tbl_orders` | Orders/sales | `or_id`, `order_no`, `customer_id`, `user_id`, `total`, `status`, source/tracking/idempotency, void/refund fields, `tenant_id` |
| `tbl_order_items` | Order lines | `order_id`, `product_id`, `qty`, `unit_price`, `subtotal`, refunded fields, `tenant_id` |
| `tbl_payment` | Payments | `order_id`, `amount`, `payment_method`, `status`, `tenant_id`; status check in 015 |
| `tbl_payment_method` | Tenant payment methods | tenant-scoped; RLS enabled in baseline |
| `tbl_held_sales` | Held POS sales | tenant/user scoped; RLS enabled in baseline |
| `tbl_warranty` | Warranties | tenant/product/customer scoped; RLS enabled in baseline |
| `tbl_service_requests` | Service requests | tenant/product/customer scoped; RLS enabled in baseline |
| `store_settings` | Public store settings | `slug`, store info, hours/config, `tenant_id` |
| `tbl_activity_logs` | Audit log | `user_id`, `action`, `target_table/id`, `details`, `tenant_id`; user FK SET NULL in 030 |
| `khqr_sessions` | KHQR/subscription sessions | order/tenant/user/plan/amount/md5/hash/status/expiry/raw_response; reconciled by 018/023/026 |
| `khqr_webhook_events` | Webhook idempotency | `event_id`, `processed_at`; created in 023 replay path |
| `tenant_order_counters` | Order numbering | added in 017 |
| `schema_migrations` | Migration ledger | `filename`, `executed_at` |

## Integrity / indexing
- Foreign keys across tenant, users, products, orders, items, stock, activity logs, KHQR sessions (see baseline+migrations).
- Important indexes added across 001-030 for tenant/date/status/order lookups and perf (027/029).
- Unique/check constraints include order idempotency/order_no (017), stock non-negative/unique (017), payment status (015), KHQR status/unique md5/hash (023).

## RLS
- RLS enabled on 4 tables in baseline; migration 022 enables RLS on all public tables. No tenant policies defined. 022/025 revoke anon/authenticated privileges/defaults. See `docs/SECURITY_AND_RLS.md`.