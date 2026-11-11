// backend/scripts/seed-demo.js
//
// Seeds one demo shop so `npm run dev` (dev DB) and the Playwright golden path
// (test DB) both have a usable tenant. Idempotent: if the demo tenant exists
// nothing is written and the credentials are NOT printed again ("printed once").
const MODE = process.env.SPMS_DB_MODE || 'dev';
process.env.SPMS_DB_MODE = MODE;
if (!process.env.DATABASE_URL) {
  const { databaseUrl } = require('./_guard');
  process.env.DATABASE_URL = databaseUrl(MODE);
}

const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const { assertDatabaseUrl } = require('./_guard');

const DEMO_SUBDOMAIN = 'demo';
const ADMIN = { username: 'demo_admin', password: 'Demo1234!', role: 'Admin' };
const STAFF = { username: 'demo_staff', password: 'Demo1234!', role: 'Staff' };

async function seed() {
  const identity = assertDatabaseUrl(process.env.DATABASE_URL, MODE);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const existing = await client.query('SELECT id FROM tenants WHERE subdomain = $1', [DEMO_SUBDOMAIN]);
    if (existing.rows.length > 0) {
      console.log(`demo shop already seeded in ${identity.database} (tenant ${existing.rows[0].id}); credentials not reprinted`);
      return false;
    }

    await client.query('BEGIN');

    const tenant = await client.query(
      `INSERT INTO tenants (name, subdomain, status, plan) VALUES ($1, $2, 'ACTIVE', $3) RETURNING id`,
      ['Demo Shop', DEMO_SUBDOMAIN, 'shophouse']
    );
    const tenantId = tenant.rows[0].id;

    const category = await client.query(
      'INSERT INTO tbl_categories (name, tenant_id) VALUES ($1, $2) RETURNING id',
      ['Demo Category', tenantId]
    );

    const supplier = await client.query(
      'INSERT INTO tbl_suppliers (sup_name, contact_person, phone, email, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      ['Demo Supplier', 'Supplier One', '011222333', 'supplier@demo.test', tenantId]
    );

    const users = [];
    for (const user of [ADMIN, STAFF]) {
      const res = await client.query(
        `INSERT INTO tbl_users (username, email, password, fullname, role, status, tenant_id)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6) RETURNING userid`,
        [user.username, `${user.username}@demo.test`, bcrypt.hashSync(user.password, 10), user.username, user.role, tenantId]
      );
      users.push({ ...user, id: res.rows[0].userid });
    }

    const customers = [];
    for (let i = 1; i <= 5; i += 1) {
      const res = await client.query(
        'INSERT INTO tbl_customers (cus_id, name, phone, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [`CUS-DEMO-${String(i).padStart(3, '0')}`, `Demo Customer ${i}`, `01000000${i}`, tenantId]
      );
      customers.push(res.rows[0].id);
    }

    const products = [];
    for (let i = 1; i <= 20; i += 1) {
      const price = 5 + i;
      const res = await client.query(
        `INSERT INTO tbl_products (name, barcode, category_id, supplier_id, price, cost, stock, tenant_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, 100, $7, 'Active') RETURNING id`,
        [`Demo Product ${String(i).padStart(2, '0')}`, `DEMO-${String(i).padStart(3, '0')}`, category.rows[0].id, supplier.rows[0].id, price, price - 3, tenantId]
      );
      await client.query(
        'INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id) VALUES ($1, 100, 100, $2)',
        [res.rows[0].id, tenantId]
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
        [`DEMO-${String(i + 1).padStart(5, '0')}`, customers[i % customers.length], adminUser.id, total, tenantId, `demo-sale-${i + 1}`]
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
        [tenantId, product.id, -qty, orderId, `Demo sale ${i + 1}`]
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
    console.log(`  products: 20, stock: 100 each, sales: 10, customers: 5, suppliers: 1`);
    console.log('  credentials (printed once):');
    console.log(`    admin: ${ADMIN.username} / ${ADMIN.password}`);
    console.log(`    staff: ${STAFF.username} / ${STAFF.password}`);
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

module.exports = { seed, DEMO_SUBDOMAIN, ADMIN, STAFF };
