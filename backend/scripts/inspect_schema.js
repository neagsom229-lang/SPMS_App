require('dotenv').config();
const db = require('../src/config/postgres');
async function run() {
  const tables = [
    'tbl_products', 'tbl_stock', 'tbl_stock_log', 
    'tbl_orders', 'tbl_orders_details', 'tbl_order_items',
    'tbl_customers', 'tbl_payment', 'tbl_payment_method'
  ];
  for (const t of tables) {
    try {
      const res = await db.query(
        'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position', 
        [t]
      );
      console.log('=== TABLE: ' + t + ' ===');
      if (res.rows.length === 0) {
        console.log('  (Table does not exist or has no columns)');
      } else {
        res.rows.forEach(r => {
          console.log(`  - ${r.column_name} (${r.data_type})`);
        });
      }
    } catch(e) {
      console.log('=== TABLE: ' + t + ' (Error) ===', e.message);
    }
  }
  process.exit(0);
}
run();
