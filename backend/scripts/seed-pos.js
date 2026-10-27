// backend/scripts/seed-pos.js
const pool = require('../src/config/postgres');
require('dotenv').config();

async function seedPOS() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Seeding demo tenant, categories, and 20 sample products with stock...');

    // 1. Ensure demo tenant
    const tenantRes = await client.query(
      `INSERT INTO tenants (name, subdomain, status) 
       VALUES ('Demo Store', 'demo', 'ACTIVE')
       ON CONFLICT (subdomain) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const tenantId = tenantRes.rows[0].id;
    console.log(`✅ Demo Tenant ID: ${tenantId}`);

    // 2. Ensure categories
    const categories = [
      { name_en: 'Electronics', name_kh: 'គ្រឿងអេឡិចត្រូនិច' },
      { name_en: 'Groceries', name_kh: 'ទំនិញបរិភោគ' },
      { name_en: 'Beverages', name_kh: 'ភេសជ្ជៈ' },
      { name_en: 'Clothing', name_kh: 'ខោអាវ' }
    ];

    const categoryMap = {};
    for (const cat of categories) {
      const catRes = await client.query(
        `INSERT INTO tbl_categories (name, tenant_id) 
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [cat.name_en, tenantId]
      );
      
      let catId;
      if (catRes.rows.length > 0) {
        catId = catRes.rows[0].id;
      } else {
        const existing = await client.query(
          `SELECT id FROM tbl_categories WHERE name = $1 AND tenant_id = $2`,
          [cat.name_en, tenantId]
        );
        catId = existing.rows[0].id;
      }
      categoryMap[cat.name_en] = catId;
    }

    // 3. 20 realistic sample products
    const sampleProducts = [
      { code: 'P1001', name_en: 'iPhone 15 Pro', name_kh: 'ទូរស័ព្ទ iPhone 15 Pro', cat: 'Electronics', buy: 900, sale: 1199, stock: 25, alert: 5 },
      { code: 'P1002', name_en: 'MacBook Air M2', name_kh: 'កុំព្យូទ័រ MacBook Air M2', cat: 'Electronics', buy: 1050, sale: 1349, stock: 15, alert: 3 },
      { code: 'P1003', name_en: 'Wireless Mouse', name_kh: 'កណ្តูរឥតខ្សែ', cat: 'Electronics', buy: 15, sale: 29.99, stock: 80, alert: 10 },
      { code: 'P1004', name_en: 'USB-C Hub 6-in-1', name_kh: 'ខ្សែកាប USB-C Hub', cat: 'Electronics', buy: 20, sale: 45, stock: 50, alert: 8 },
      { code: 'P1005', name_en: 'Bluetooth Speaker', name_kh: 'បំពងសម្លេងប៊្លូធូស', cat: 'Electronics', buy: 35, sale: 69.99, stock: 35, alert: 5 },
      { code: 'P1006', name_en: 'LED Desk Lamp', name_kh: 'ចង្កៀងតុ LED', cat: 'Electronics', buy: 12, sale: 25, stock: 40, alert: 6 },
      { code: 'P1007', name_en: 'Organic Jasmine Rice (5kg)', name_kh: 'អង្ករម្លិះ (៥គីឡូ)', cat: 'Groceries', buy: 6, sale: 9.50, stock: 120, alert: 20 },
      { code: 'P1008', name_en: 'Premium Olive Oil (1L)', name_kh: 'ប្រេងអូលីវ (១លីត្រ)', cat: 'Groceries', buy: 8, sale: 14.99, stock: 60, alert: 10 },
      { code: 'P1009', name_en: 'Instant Coffee Pack', name_kh: 'កាហ្វេកញ្ចប់', cat: 'Groceries', buy: 3, sale: 5.99, stock: 150, alert: 25 },
      { code: 'P1010', name_en: 'Almond Milk (1L)', name_kh: 'ទឹកដោះគោគ្រាប់ almond', cat: 'Groceries', buy: 2.5, sale: 4.50, stock: 70, alert: 15 },
      { code: 'P1011', name_en: 'Coca Cola Can (24pk)', name_kh: 'កូកាកូឡាកំប៉ុង (២៤)', cat: 'Beverages', buy: 7, sale: 11.50, stock: 90, alert: 15 },
      { code: 'P1012', name_en: 'Sprite Can (24pk)', name_kh: 'ស្ព្រាយកំប៉ុង (២៤)', cat: 'Beverages', buy: 7, sale: 11.50, stock: 85, alert: 15 },
      { code: 'P1013', name_en: 'Mineral Water (12pk)', name_kh: 'ទឹកសុទ្ធ (១២)', cat: 'Beverages', buy: 2, sale: 4, stock: 200, alert: 30 },
      { code: 'P1014', name_en: 'Green Tea Bottles (6pk)', name_kh: 'តែបៃតង (៦)', cat: 'Beverages', buy: 4, sale: 7.99, stock: 110, alert: 20 },
      { code: 'P1015', name_en: 'Energy Drink (Red Bull)', name_kh: 'ភេសជ្ជៈកម្លាំង Red Bull', cat: 'Beverages', buy: 0.8, sale: 1.50, stock: 300, alert: 50 },
      { code: 'P1016', name_en: 'Cotton T-Shirt (White)', name_kh: 'អាវយឺតកប្បាស (ស)', cat: 'Clothing', buy: 5, sale: 15, stock: 65, alert: 10 },
      { code: 'P1017', name_en: 'Denim Jeans (Blue)', name_kh: 'ខោខូវប៊យ (ខៀវ)', cat: 'Clothing', buy: 18, sale: 39.99, stock: 45, alert: 8 },
      { code: 'P1018', name_en: 'Canvas Sneakers', name_kh: 'ស្បែកជើងប៉ាតា Canvas', cat: 'Clothing', buy: 22, sale: 49.99, stock: 30, alert: 5 },
      { code: 'P1019', name_en: 'Baseball Cap', name_kh: 'មួកបេស្បល', cat: 'Clothing', buy: 4, sale: 12.99, stock: 55, alert: 10 },
      { code: 'P1020', name_en: 'Running Socks (3pk)', name_kh: 'ស្រោមជើងរត់ប្រណាំង', cat: 'Clothing', buy: 2, sale: 6.99, stock: 100, alert: 20 }
    ];

    for (const p of sampleProducts) {
      const catId = categoryMap[p.cat] || null;

      // Check if product already exists by product_id/barcode
      const existing = await client.query(
        `SELECT id FROM tbl_products WHERE product_id = $1 AND tenant_id = $2`,
        [p.code, tenantId]
      );

      let productId;
      if (existing.rows.length > 0) {
        productId = existing.rows[0].id;
        await client.query(
          `UPDATE tbl_products 
           SET name_en = $1, name_kh = $2, category_id = $3, buyin_price = $4, saleout_price = $5, qty_instock = $6, qty_alert = $7, updated_at = NOW()
           WHERE id = $8`,
          [p.name_en, p.name_kh, catId, p.buy, p.sale, p.stock, p.alert, productId]
        );

        // Update stock table
        await client.query(
          `INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id)
           VALUES ($1, $2, $2, $3)
           ON CONFLICT (id) DO UPDATE SET qtyinstock = EXCLUDED.qtyinstock, qtyavailable = EXCLUDED.qtyavailable`,
          [productId, p.stock, tenantId]
        );
      } else {
        const prodRes = await client.query(
          `INSERT INTO tbl_products 
           (tenant_id, product_id, barcode, name_en, name_kh, category_id, buyin_price, saleout_price, qty_instock, qty_alert, status, created_at)
           VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', NOW())
           RETURNING id`,
          [tenantId, p.code, p.name_en, p.name_kh, catId, p.buy, p.sale, p.stock, p.alert]
        );
        productId = prodRes.rows[0].id;

        await client.query(
          `INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, tenant_id)
           VALUES ($1, $2, $2, $3)`,
          [productId, p.stock, tenantId]
        );
      }
    }

    // 4. Ensure demo customer
    await client.query(
      `INSERT INTO tbl_customers (cus_id, name, phone, email, address, tenant_id, created_at)
       VALUES ('CUS-WALKIN', 'Walk-in Customer', '012345678', 'walkin@store.com', 'Phnom Penh', $1, NOW())
       ON CONFLICT DO NOTHING`,
      [tenantId]
    );

    await client.query('COMMIT');
    console.log('✅ Successfully seeded 20 products and demo tenant!');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

seedPOS();
