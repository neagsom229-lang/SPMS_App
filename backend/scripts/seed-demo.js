// backend/scripts/seed-demo.js
//
// Seeds one demo shop so `npm run dev` (dev DB) and the Playwright golden path
// (test DB) both have a usable tenant. Idempotent: if the demo tenant exists
// its catalog is re-synced from frontend/src/data/products.js (old placeholder
// rows are recycled in place, so primary keys and order history stay valid)
// and the credentials are NOT printed again ("printed once").
const MODE = process.env.SPMS_DB_MODE || 'dev';
process.env.SPMS_DB_MODE = MODE;
if (!process.env.DATABASE_URL) {
  const { databaseUrl } = require('./_guard');
  process.env.DATABASE_URL = databaseUrl(MODE);
}

const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const path = require('path');
const { pathToFileURL } = require('url');
const { assertDatabaseUrl } = require('./_guard');

// The store catalog has one source of truth shared with the storefront.
const CATALOG_URL = pathToFileURL(path.resolve(__dirname, '../../frontend/src/data/products.js')).href;

const DEMO_SUBDOMAIN = 'demo';
const ADMIN = { username: 'demo_admin', password: 'Demo1234!', role: 'Admin' };
const STAFF = { username: 'demo_staff', password: 'Demo1234!', role: 'Staff' };
// must_change_password = TRUE: the Playwright forced-password step logs in as
// this user and must be bounced to /change-password.
const FORCED = { username: 'demo_forced', password: 'Demo1234!', role: 'Staff', mustChangePassword: true };
// Platform owner: the only account that can open /admin/tenants (the
// super-admin routes) and the pending payment sessions panel.
const ROOT = { username: 'demo_root', password: 'Demo1234!', role: 'Super Admin' };

// One supplier for the catalog, shared by the fresh seed and the refresh path.
const SUPPLIER = {
  name: 'Dream Setup Distribution',
  contact: 'Account Manager',
  phone: '011222333',
  email: 'supplier@dreamsetup.test',
};

// The public storefront resolves its slug from store_settings, so the demo
// tenant must have a row for /shop/demo to return 200. Idempotent: re-seeding
// refreshes the row instead of creating a second one with another slug.
async function ensureStoreSettings(client, tenantId) {
  await client.query(
    `INSERT INTO store_settings (tenant_id, slug, store_name, currency, is_open, accepts_online_orders, delivery_enabled, pickup_enabled)
     VALUES ($1, $2, $3, 'USD', TRUE, TRUE, TRUE, TRUE)
     ON CONFLICT (slug) DO UPDATE SET tenant_id = EXCLUDED.tenant_id`,
    [tenantId, DEMO_SUBDOMAIN, 'Demo Shop']
  );
}

// Re-sync an already-seeded tenant to the catalog in
// frontend/src/data/products.js. Rows are matched by SKU barcode; leftover
// placeholder rows (the old DEMO-### products) are recycled in id order so
// primary keys stay stable and existing order history keeps its foreign keys.
// Idempotent: running it twice produces the same 20 catalog rows.
async function refreshCatalog(client, tenantId, PRODUCTS, ALL_CATEGORIES, barcodeFor) {
  await client.query('BEGIN');
  try {
    const categoryIds = {};
    for (const name of ALL_CATEGORIES) {
      const found = await client.query(
        'SELECT id FROM tbl_categories WHERE tenant_id = $1 AND name = $2',
        [tenantId, name]
      );
      if (found.rows.length > 0) {
        categoryIds[name] = found.rows[0].id;
      } else {
        const ins = await client.query(
          'INSERT INTO tbl_categories (name, tenant_id) VALUES ($1, $2) RETURNING id',
          [name, tenantId]
        );
        categoryIds[name] = ins.rows[0].id;
      }
    }

    let supplier = await client.query(
      'SELECT id FROM tbl_suppliers WHERE tenant_id = $1 AND sup_name = $2',
      [tenantId, SUPPLIER.name]
    );
    if (supplier.rows.length === 0) {
      supplier = await client.query(
        'INSERT INTO tbl_suppliers (sup_name, contact_person, phone, email, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [SUPPLIER.name, SUPPLIER.contact, SUPPLIER.phone, SUPPLIER.email, tenantId]
      );
    }
    const supplierId = supplier.rows[0].id;

    // Placeholder rows written by the old seed, recycled before inserting.
    const placeholders = await client.query(
      `SELECT id FROM tbl_products WHERE tenant_id = $1 AND barcode LIKE 'DEMO-%' ORDER BY id`,
      [tenantId]
    );
    const recycle = placeholders.rows.map((r) => r.id);

    let synced = 0;
    for (const item of PRODUCTS) {
      const barcode = barcodeFor(item);
      const stockQty = item.stockStatus === 'out' ? 0 : item.stockStatus === 'low' ? 4 : 100;
      const cost = Number((item.price * 0.75).toFixed(2));
      let productId;

      const found = await client.query(
        'SELECT id FROM tbl_products WHERE tenant_id = $1 AND barcode = $2',
        [tenantId, barcode]
      );
      if (found.rows.length > 0) {
        productId = found.rows[0].id;
        await client.query(
          `UPDATE tbl_products
             SET name = $1, category_id = $2, supplier_id = $3, price = $4, cost = $5,
                 stock = $6, status = 'Active', is_published = true,
                 description_en = $7, image_url = $8
           WHERE id = $9`,
          [item.name, categoryIds[item.category], supplierId, item.price, cost,
            stockQty, item.shortDescription, item.image, productId]
        );
      } else if (recycle.length > 0) {
        productId = recycle.shift();
        await client.query(
          `UPDATE tbl_products
             SET barcode = $1, name = $2, category_id = $3, supplier_id = $4, price = $5, cost = $6,
                 stock = $7, status = 'Active', is_published = true,
                 description_en = $8, image_url = $9
           WHERE id = $10`,
          [barcode, item.name, categoryIds[item.category], supplierId, item.price, cost,
            stockQty, item.shortDescription, item.image, productId]
        );
      } else {
        const ins = await client.query(
          `INSERT INTO tbl_products (name, barcode, category_id, supplier_id, price, cost, stock, tenant_id, status, description_en, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active', $9, $10) RETURNING id`,
          [item.name, barcode, categoryIds[item.category], supplierId, item.price, cost,
            stockQty, tenantId, item.shortDescription, item.image]
        );
        productId = ins.rows[0].id;
      }

      const stockRow = await client.query(
        'SELECT id FROM tbl_stock WHERE productid = $1 AND tenant_id = $2',
        [productId, tenantId]
      );
      if (stockRow.rows.length > 0) {
        await client.query(
          'UPDATE tbl_stock SET qtyinstock = $1, qtyavailable = $1 WHERE id = $2',
          [stockQty, stockRow.rows[0].id]
        );
      } else {
        await client.query(
          'INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $2, $3)',
          [productId, stockQty, tenantId]
        );
      }
      synced += 1;
    }

    // Placeholders left over (more old rows than catalog items) are retired
    // so no leftover placeholder row stays active in the product list.
    if (recycle.length > 0) {
      await client.query(
        `UPDATE tbl_products SET status = 'Inactive', is_published = false, category_id = NULL, supplier_id = NULL
         WHERE id = ANY($1::int[])`,
        [recycle]
      );
    }

    // Drop placeholder-only categories/suppliers nothing references any more.
    const nameParams = ALL_CATEGORIES.map((_, i) => `$${i + 2}`).join(', ');
    await client.query(
      `DELETE FROM tbl_categories c
        WHERE c.tenant_id = $1 AND c.name NOT IN (${nameParams})
          AND NOT EXISTS (SELECT 1 FROM tbl_products p WHERE p.category_id = c.id)`,
      [tenantId, ...ALL_CATEGORIES]
    );
    await client.query(
      `DELETE FROM tbl_suppliers s
        WHERE s.tenant_id = $1 AND s.sup_name = 'Demo Supplier'
          AND NOT EXISTS (SELECT 1 FROM tbl_products p WHERE p.supplier_id = s.id)`,
      [tenantId]
    );

    await client.query('COMMIT');
    return synced;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

async function seed() {
  const { PRODUCTS, ALL_CATEGORIES, barcodeFor } = await import(CATALOG_URL);
  const identity = assertDatabaseUrl(process.env.DATABASE_URL, MODE);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.on('error', () => {});
  await client.connect();

  try {
    const existing = await client.query('SELECT id FROM tenants WHERE subdomain = $1', [DEMO_SUBDOMAIN]);
    if (existing.rows.length > 0) {
      const tenantId = existing.rows[0].id;
      await ensureStoreSettings(client, tenantId);
      const synced = await refreshCatalog(client, tenantId, PRODUCTS, ALL_CATEGORIES, barcodeFor);
      console.log(`demo shop catalog refreshed in ${identity.database} (tenant ${tenantId}); ${synced}/${PRODUCTS.length} products synced; credentials not reprinted`);
      return false;
    }

    await client.query('BEGIN');

    const tenant = await client.query(
      `INSERT INTO tenants (name, subdomain, status, plan) VALUES ($1, $2, 'ACTIVE', $3) RETURNING id`,
      ['Demo Shop', DEMO_SUBDOMAIN, 'shophouse']
    );
    const tenantId = tenant.rows[0].id;
    await ensureStoreSettings(client, tenantId);

    const categoryIds = {};
    for (const name of ALL_CATEGORIES) {
      const res = await client.query(
        'INSERT INTO tbl_categories (name, tenant_id) VALUES ($1, $2) RETURNING id',
        [name, tenantId]
      );
      categoryIds[name] = res.rows[0].id;
    }

    const supplier = await client.query(
      'INSERT INTO tbl_suppliers (sup_name, contact_person, phone, email, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [SUPPLIER.name, SUPPLIER.contact, SUPPLIER.phone, SUPPLIER.email, tenantId]
    );

    const users = [];
    for (const user of [ADMIN, STAFF, FORCED]) {
      const res = await client.query(
        `INSERT INTO tbl_users (username, email, password, fullname, role, status, tenant_id, must_change_password)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7) RETURNING userid`,
        [
          user.username,
          `${user.username}@demo.test`,
          bcrypt.hashSync(user.password, 10),
          user.username,
          user.role,
          tenantId,
          user.mustChangePassword === true,
        ]
      );
      users.push({ ...user, id: res.rows[0].userid });
    }

    // Super admin: no tenant (CHECK allows is_super_admin = TRUE with a NULL
    // tenant_id). Nothing else in this seed can create one, and without it the
    // super-admin routes have no account to test with.
    await client.query(
      `INSERT INTO tbl_users (username, email, password, fullname, role, status, is_super_admin, tenant_id)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', TRUE, NULL)`,
      [ROOT.username, `${ROOT.username}@demo.test`, bcrypt.hashSync(ROOT.password, 10), ROOT.username, ROOT.role]
    );

    const customers = [];
    for (let i = 1; i <= 5; i += 1) {
      const res = await client.query(
        'INSERT INTO tbl_customers (cus_id, name, phone, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [`CUS-WALK-${String(i).padStart(3, '0')}`, `Walk-in Customer ${i}`, `01000000${i}`, tenantId]
      );
      customers.push(res.rows[0].id);
    }

    const products = [];
    for (const item of PRODUCTS) {
      const price = item.price;
      const stockQty = item.stockStatus === 'out' ? 0 : (item.stockStatus === 'low' ? 4 : 100);
      const res = await client.query(
        `INSERT INTO tbl_products (name, barcode, category_id, supplier_id, price, cost, stock, tenant_id, status, description_en, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active', $9, $10) RETURNING id`,
        [
          item.name,
          barcodeFor(item),
          categoryIds[item.category],
          supplier.rows[0].id,
          price,
          Number((price * 0.75).toFixed(2)),
          stockQty,
          tenantId,
          item.shortDescription,
          item.image,
        ]
      );
      await client.query(
        'INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, $2, $2, $3)',
        [res.rows[0].id, stockQty, tenantId]
      );
      products.push({ id: res.rows[0].id, price });
    }

    const adminUser = users.find(u => u.role === 'Admin');
    for (let i = 0; i < 10; i += 1) {
      const product = products[i];
      const qty = 1 + (i % 3);
      const total = Number((product.price * qty).toFixed(2));

      const order = await client.query(
        `INSERT INTO tbl_orders (order_no, customer_id, user_id, total, payment_method, status, tenant_id, idempotency_key, source)
         VALUES ($1, $2, $3, $4, 'Cash', 'Completed', $5, $6, 'POS') RETURNING or_id`,
        [`DS-${String(i + 1).padStart(5, '0')}`, customers[i % customers.length], adminUser.id, total, tenantId, `seed-sale-${i + 1}`]
      );
      const orderId = order.rows[0].or_id;

      await client.query(
        `INSERT INTO tbl_order_items (order_id, product_id, qty, unit_price, subtotal, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, product.id, qty, product.price, total, tenantId]
      );
      await client.query(
        'UPDATE tbl_stock SET qtyinstock = qtyinstock - $1, qtyavailable = qtyavailable - $1 WHERE productid = $2 AND tenant_id = $3',
        [qty, product.id, tenantId]
      );
      await client.query('UPDATE tbl_products SET stock = stock - $1 WHERE id = $2', [qty, product.id]);
      await client.query(
        `INSERT INTO tbl_stock_log (tenant_id, product_id, change_qty, type, reference_id, notes)
         VALUES ($1, $2, $3, 'SALE', $4, $5)`,
        [tenantId, product.id, -qty, orderId, `Seeded sale ${i + 1}`]
      );
      await client.query(
        `INSERT INTO tbl_payment (order_id, tenant_id, amount, payment_method, status)
         VALUES ($1, $2, $3, 'Cash', 'COMPLETED')`,
        [orderId, tenantId, total]
      );
    }

    await client.query(
      `INSERT INTO tenant_order_counters (tenant_id, last_seq) VALUES ($1, 10)
       ON CONFLICT (tenant_id) DO UPDATE SET last_seq = GREATEST(tenant_order_counters.last_seq, 10)`,
      [tenantId]
    );

    await client.query('COMMIT');

    console.log('demo shop seeded');
    console.log(`  tenant: ${DEMO_SUBDOMAIN} (id ${tenantId})`);
    console.log(`  products: ${PRODUCTS.length}, categories: ${ALL_CATEGORIES.length}, sales: 10, customers: 5, suppliers: 1`);
    console.log('  credentials (printed once):');
    console.log(`    admin: ${ADMIN.username} / ${ADMIN.password}`);
    console.log(`    staff: ${STAFF.username} / ${STAFF.password}`);
    console.log(`    forced password change: ${FORCED.username} / ${FORCED.password}`);
    console.log(`    super admin: ${ROOT.username} / ${ROOT.password}`);
    return true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('demo seed failed:', err.message);
      process.exit(1);
    });
}

module.exports = { seed, DEMO_SUBDOMAIN, ADMIN, STAFF, FORCED, ROOT };
