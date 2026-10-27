# SPMS Schema Contract (Step 1B.c)

Based on the **Live Supabase Schema** as the single source of truth, this contract flags columns used by backend/frontend code that do NOT exist in the live schema, and outlines the frontend field expectations vs database column mismatches.

---

## 1. Column Usage & Live Schema Discrepancies

| Table | Column Used in Code | Exists in Live Schema? | Action / Resolution |
| :--- | :--- | :--- | :--- |
| **tbl_products** | `name` | **YES** | Canonical product name column |
| **tbl_products** | `name_en` | **NO** (Legacy) | Map via serializer (`name_en` -> `name`) |
| **tbl_products** | `saleout_price` | **NO** (Legacy) | Map via serializer (`saleout_price` -> `price`) |
| **tbl_products** | `qty_alert` | **NO** (Legacy) | Add via migration 006 or handle gracefully |
| **tbl_products** | `status` | **NO** (Legacy) | Add via migration 006 |
| **tbl_orders** | `or_id` | **YES** (PK) | Canonical order primary key |
| **tbl_orders** | `created_by` | **NO** (Legacy) | Use live schema `user_id` |
| **tbl_orders** | `order_date` | **NO** (Legacy) | Use live schema `created_at` |
| **tbl_orders** | `totalamount` | **NO** (Legacy) | Map via serializer (`totalamount` -> `total`) |
| **tbl_order_items** | `tbl_orders_details` | **NO** (Legacy table) | Use live schema `tbl_order_items` |
| **tbl_order_items** | `qty_order` | **NO** (Legacy) | Map via serializer (`qty_order` -> `qty`) |
| **tbl_stock** | `qtyinstock` | **YES** | Live schema stock column |
| **tbl_stock** | `qtyavailable` | **NO** in base live schema | Add via migration 006 |

---

## 2. Frontend API Response Field Mismatches

| Entity | DB Column / Raw Response | Frontend Expected Field | Mismatch Type & Resolution |
| :--- | :--- | :--- | :--- |
| **Product** | `name` | `name_en` / `name` | Frontend expects `name_en`. **Serializer** maps `name` -> `name_en`. |
| **Product** | `price` | `saleout_price` / `price` | Frontend expects `saleout_price`. **Serializer** maps `price` -> `saleout_price`. |
| **Stock** | `qtyinstock` | `qtyavailable` / `stock` | Frontend expects `qtyavailable`. **Serializer** maps `qtyinstock` -> `qtyavailable`. |
| **Order** | `or_id` | `or_id` / `id` | Frontend expects `or_id` / `id`. **Serializer** ensures both present. |
| **Order** | `total` | `totalamount` / `total` | Frontend expects `totalamount`. **Serializer** maps `total` -> `totalamount`. |
| **Customer** | `name` | `name` / `customer_name` | Frontend expects `name`. Aligned. |
