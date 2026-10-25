const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

console.log('🔍 Environment variables check (names present):');
['DATABASE_URL', 'DIRECT_URL', 'SEED_ADMIN_PASSWORD', 'NODE_ENV'].forEach(key => {
  console.log(`   - ${key}: ${process.env[key] ? 'PRESENT (hidden)' : 'MISSING'}`);
});

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL or DIRECT_URL required for seeding');
  process.exit(1);
}

const isCloud = connectionString.includes('neon.tech') || connectionString.includes('supabase.co') || connectionString.includes('pooler.supabase.com');
const pool = new Pool({
  connectionString,
  ssl: isCloud ? { rejectUnauthorized: false } : false,
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Starting database seed (ONE transaction)...');

    // 1. Seed Tenant
    let tenantRes = await client.query('SELECT id FROM tenants WHERE subdomain = $1', ['demo']);
    let tenantId;
    if (tenantRes.rowCount === 0) {
      const insTenant = await client.query(
        'INSERT INTO tenants (name, subdomain, status) VALUES ($1, $2, $3) RETURNING id',
        ['Demo Store', 'demo', 'ACTIVE']
      );
      tenantId = insTenant.rows[0].id;
      console.log(`✅ Created tenant: Demo Store (ID: ${tenantId})`);
    } else {
      tenantId = tenantRes.rows[0].id;
      console.log(`ℹ️ Tenant already exists (ID: ${tenantId})`);
    }

    // 2. Seed Store Settings
    let settingsRes = await client.query('SELECT id FROM store_settings WHERE tenant_id = $1 OR slug = $2', [tenantId, 'demo-store']);
    if (settingsRes.rowCount === 0) {
      await client.query(
        `INSERT INTO store_settings (tenant_id, slug, store_name, phone, address, currency, exchange_rate, is_open, accepts_online_orders, delivery_enabled, pickup_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [tenantId, 'demo-store', 'Demo Store Cambodia', '+855 12 345 678', 'Monivong Blvd, Phnom Penh', 'USD', 4000.00, true, true, true, true]
      );
      console.log('✅ Created store_settings for demo-store');
    } else {
      console.log('ℹ️ store_settings already exists');
    }

    // 3. Seed Admin User
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const userRes = await client.query('SELECT userid FROM tbl_users WHERE username = $1 AND tenant_id = $2', ['admin', tenantId]);
    let adminUserId;
    if (userRes.rowCount === 0) {
      const insUser = await client.query(
        `INSERT INTO tbl_users (username, email, password, fullname, role, role_name, status, is_super_admin, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING userid`,
        ['admin', 'admin@demostore.com', passwordHash, 'System Admin', 'Admin', 'Administrator', 'ACTIVE', false, tenantId]
      );
      adminUserId = insUser.rows[0].userid;
      console.log('✅ Created admin user (username: admin)');
    } else {
      adminUserId = userRes.rows[0].userid;
      console.log('ℹ️ Admin user already exists');
    }

    // 4. Seed Categories
    const categories = [
      { name: 'Coffee & Drinks' },
      { name: 'Bakery & Pastry' },
      { name: 'Fast Food' }
    ];

    const categoryIds = [];
    for (const cat of categories) {
      let catRes = await client.query('SELECT id FROM tbl_categories WHERE tenant_id = $1 AND name = $2', [tenantId, cat.name]);
      let catId;
      if (catRes.rowCount === 0) {
        const ins = await client.query(
          'INSERT INTO tbl_categories (tenant_id, name) VALUES ($1, $2) RETURNING id',
          [tenantId, cat.name]
        );
        catId = ins.rows[0].id;
        console.log(`✅ Created category: ${cat.name}`);
      } else {
        catId = catRes.rows[0].id;
      }
      categoryIds.push(catId);
    }

    // 5. Seed 20 Bilingual Products with Stock
    const productsData = [
      { name: 'Iced Latte', name_kh: 'កាហ្វេឡាតទឹកកក', price: 3.50, cost: 1.50, cat: categoryIds[0], barcode: 'COF001' },
      { name: 'Cappuccino', name_kh: 'កាហ្វេខាប់ប៊ូឈីណូ', price: 3.00, cost: 1.20, cat: categoryIds[0], barcode: 'COF002' },
      { name: 'Mocha', name_kh: 'កាហ្វេម៉ូខា', price: 3.75, cost: 1.60, cat: categoryIds[0], barcode: 'COF003' },
      { name: 'Americano', name_kh: 'កាហ្វេអាមេរិកាណូ', price: 2.50, cost: 1.00, cat: categoryIds[0], barcode: 'COF004' },
      { name: 'Matcha Green Tea', name_kh: 'តែខៀវម៉ាត់ឆា', price: 4.00, cost: 1.80, cat: categoryIds[0], barcode: 'BEV001' },
      { name: 'Peach Tea', name_kh: 'តែផ្លែប៉ែស', price: 3.25, cost: 1.30, cat: categoryIds[0], barcode: 'BEV002' },
      { name: 'Chocolate Croissant', name_kh: 'នំប៉័ងគ្រ័ស្សងសូកូឡា', price: 2.75, cost: 1.10, cat: categoryIds[1], barcode: 'BAK001' },
      { name: 'Butter Croissant', name_kh: 'នំប៉័ងគ្រ័ស្សងប៊ឺរ', price: 2.25, cost: 0.90, cat: categoryIds[1], barcode: 'BAK002' },
      { name: 'Blueberry Muffin', name_kh: 'នំម៉ัហ្វិនប្លូបឺរី', price: 2.50, cost: 1.00, cat: categoryIds[1], barcode: 'BAK003' },
      { name: 'Cinnamon Roll', name_kh: 'នំវិលអប់ជីនណាម៉ុន', price: 3.00, cost: 1.20, cat: categoryIds[1], barcode: 'BAK004' },
      { name: 'Almond Danish', name_kh: 'នំដាណុបអាល់ម៉ុន', price: 3.25, cost: 1.30, cat: categoryIds[1], barcode: 'BAK005' },
      { name: 'Garlic Bread', name_kh: 'នំប៉័ងទឹម', price: 2.00, cost: 0.80, cat: categoryIds[1], barcode: 'BAK006' },
      { name: 'Classic Beef Burger', name_kh: 'បឺហ្គឺសាច់គោ', price: 5.50, cost: 2.50, cat: categoryIds[2], barcode: 'FBS001' },
      { name: 'Crispy Chicken Burger', name_kh: 'បឺហ្គឺសាច់មាន់', price: 5.00, cost: 2.20, cat: categoryIds[2], barcode: 'FBS002' },
      { name: 'French Fries', name_kh: 'ដំឡូងបារាំងបំពង', price: 2.50, cost: 0.90, cat: categoryIds[2], barcode: 'FBS003' },
      { name: 'Chicken Nuggets (6pcs)', name_kh: 'មាន់ដុំបំពង (៦ដុំ)', price: 3.50, cost: 1.40, cat: categoryIds[2], barcode: 'FBS004' },
      { name: 'Cheese Pizza Slice', name_kh: 'ភីហ្សាចុះជីស', price: 3.75, cost: 1.50, cat: categoryIds[2], barcode: 'FBS005' },
      { name: 'Hot Dog', name_kh: 'ហត់ដុក', price: 3.00, cost: 1.10, cat: categoryIds[2], barcode: 'FBS006' },
      { name: 'Lemonade', name_kh: 'ទឹកក្រូចឆ្មា', price: 2.75, cost: 1.00, cat: categoryIds[0], barcode: 'BEV003' },
      { name: 'Strawberry Smoothie', name_kh: 'ស្មូឌីស្ត្របឺរី', price: 4.25, cost: 1.80, cat: categoryIds[0], barcode: 'BEV004' }
    ];

    const seededProductIds = [];
    for (const p of productsData) {
      let prodRes = await client.query('SELECT id FROM tbl_products WHERE tenant_id = $1 AND barcode = $2', [tenantId, p.barcode]);
      let prodId;
      if (prodRes.rowCount === 0) {
        const ins = await client.query(
          `INSERT INTO tbl_products (tenant_id, name, name_kh, category_id, barcode, price, cost, stock, status, is_published)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [tenantId, p.name, p.name_kh, p.cat, p.barcode, p.price, p.cost, 100, 'Active', true]
        );
        prodId = ins.rows[0].id;

        // Insert stock record
        await client.query(
          `INSERT INTO tbl_stock (tenant_id, productid, qtyinstock, qtyavailable)
           VALUES ($1, $2, $3, $4)`,
          [tenantId, prodId, 100, 100]
        );
        console.log(`✅ Created product & stock: ${p.name}`);
      } else {
        prodId = prodRes.rows[0].id;
      }
      seededProductIds.push(prodId);
    }

    // 6. Seed Customers
    let custRes = await client.query('SELECT id FROM tbl_customers WHERE tenant_id = $1 AND phone = $2', [tenantId, '+855 11 222 333']);
    let customerId;
    if (custRes.rowCount === 0) {
      const insCust = await client.query(
        `INSERT INTO tbl_customers (tenant_id, cus_id, name, phone, email, address)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [tenantId, 'CUS-0001', 'Sok Dara', '+855 11 222 333', 'dara@example.com', 'Phnom Penh']
      );
      customerId = insCust.rows[0].id;
      console.log('✅ Created demo customer: Sok Dara');
    } else {
      customerId = custRes.rows[0].id;
    }

    // 7. Seed Historic Completed Order
    let orderRes = await client.query('SELECT or_id FROM tbl_orders WHERE tenant_id = $1 AND order_no = $2', [tenantId, 'ORD-HIST-01']);
    if (orderRes.rowCount === 0) {
      const insOrd = await client.query(
        `INSERT INTO tbl_orders (tenant_id, order_no, customer_id, user_id, total, discount, payment_method, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING or_id`,
        [tenantId, 'ORD-HIST-01', customerId, adminUserId, 7.00, 0.00, 'Cash', 'Completed']
      );
      const orderId = insOrd.rows[0].or_id;

      // Insert order items
      await client.query(
        `INSERT INTO tbl_order_items (tenant_id, order_id, product_id, qty, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, orderId, seededProductIds[0], 2, 3.50, 7.00]
      );
      console.log('✅ Created historic completed order ORD-HIST-01');
    } else {
      console.log('ℹ️ Historic order already exists');
    }

    await client.query('COMMIT');
    console.log('🎉 Database seeding completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Seeding failed with error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('❌ Fatal error in seed script:', err.message);
    process.exit(1);
  });
}
