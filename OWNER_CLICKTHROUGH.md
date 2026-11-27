# OWNER_CLICKTHROUGH.md — SPMS / KhmerFlow (manual test script)

For the owner to run by hand. Expected results per step. Redact nothing here (no secrets).

## Desktop (Chrome, local dev or staging)

1. **Register a new business**
   - Action: open `/register`, create account (business name, email, password, subdomain).
   - Expected: account created, forced password change banner shown → change password → login.

2. **Shop setup**
   - Action: open shop settings; set store name, slug, currency rate (USD + KHR).
   - Expected: values persist; storefront at `/shop/<slug>` reflects them.

3. **Add product with image, set stock**
   - Action: admin → Products → add product (name, category, price, cost, barcode/SKU, stock, image).
   - Expected: product appears in storefront catalog for that tenant only.

4. **POS sale**
   - Action: cashier → POS → select product, qty, payment (Cash / KHQR / held).
   - Expected: stock decremented; order created; reports reflect sale.

5. **Online order → payment → confirm**
   - Action: customer places online order → KHQR / payment → admin confirms.
   - Expected: order status transitions; stock decremented once; refund restores stock.

6. **Reports**
   - Action: dashboard/reports; check USD totals and KHR conversion; check day boundary (Asia/Phnom_Penh UTC+7).
   - Expected: numbers consistent with POS + online orders.

7. **Demo shop (local only)**
   - Action: `npm run db:dev:seed`; open `/shop/demo`.
   - Expected: 20 real hardware products (gaming PCs, laptops, monitors, keyboards, mice, headsets, storage), prices USD, KHR = USD × rate, filters/sort/search/add-to-cart/checkout work, out-of-stock item disabled.

## Phone (390px)

1. Open storefront `/shop/demo` on a phone viewport (or POS on mobile).
2. Expected: no horizontal overflow; cards stack; add-to-cart reachable; checkout form usable.

## Expected results summary

- Storefront shows tenant's own DB products (not demo data) for a fresh tenant.
- KHR on every card = USD × tenant rate, rounded.
- Out-of-stock product cannot be added to cart.
- Checkout uses DB price; insufficient stock → clean failure.
- Admin can add/edit/deactivate products; stock updates.
- Refund restores stock.
