// backend/tests/flowVerification.test.js
//
// End-to-end flow verification against real database rows: supplier stock
// receive (stock up), the Orders-page purchase (stock down), idempotent
// replay, refund (stock restored), the public checkout -> owner confirmation
// -> completion chain, and tenant isolation. Every claim is checked against
// the rows the API wrote, not against response bodies alone.
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/postgres');
const { expectDenied } = require('./utils/expectDenied');

const runId = crypto.randomBytes(4).toString('hex');
const prefix = `tsfv-${runId}-`;

describe('Flow verification against real database rows', () => {
  let tokenA;
  let tokenB;
  const tenantASub = prefix + 'a';
  const tenantBSub = prefix + 'b';
  let tenantAId;
  let tenantBId;
  let catId;
  let prodId;
  let onlineProdId;
  let custId;
  let qtyBeforePurchase;
  let purchaseOrderId;
  let purchaseKey;
  let qtyBeforeOnline;
  let onlineOrderId;

  const RECEIVE_QTY = 5;
  const PURCHASE_QTY = 2;
  const ONLINE_QTY = 3;
  const UNIT_PRICE = 20;

  const stockQty = async (productId) => {
    const r = await db.query(
      'SELECT qtyavailable FROM tbl_stock WHERE productid = $1 AND tenant_id = $2',
      [productId, tenantAId]
    );
    return Number(r.rows[0].qtyavailable);
  };

  const orderRow = async (orderId) => {
    const r = await db.query('SELECT * FROM tbl_orders WHERE or_id = $1', [orderId]);
    return r.rows[0];
  };

  beforeAll(async () => {
    await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);

    const regA = await request(app)
      .post('/api/auth/register-client')
      .send({ businessName: tenantASub, email: tenantASub + '@test.com', password: 'Qa!123456', subdomain: tenantASub });
    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ username: tenantASub + '_admin', password: 'Qa!123456' });
    tokenA = loginA.body.token || regA.body.token;

    const regB = await request(app)
      .post('/api/auth/register-client')
      .send({ businessName: tenantBSub, email: tenantBSub + '@test.com', password: 'Qa!123456', subdomain: tenantBSub });
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ username: tenantBSub + '_admin', password: 'Qa!123456' });
    tokenB = loginB.body.token || regB.body.token;

    tenantAId = Number((await db.query('SELECT id FROM tenants WHERE subdomain = $1', [tenantASub])).rows[0].id);
    tenantBId = Number((await db.query('SELECT id FROM tenants WHERE subdomain = $1', [tenantBSub])).rows[0].id);

    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ name: 'Cat Flow ' + runId });
    catId = catRes.body.id;

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ name: 'Flow Prod ' + runId, barcode: 'FLW-' + runId, cost: 10, price: UNIT_PRICE, stock: 50, category_id: catId });
    prodId = prodRes.body.id;

    const onlineProdRes = await request(app)
      .post('/api/products')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ name: 'Flow Online ' + runId, barcode: 'FLW-ONL-' + runId, cost: 5, price: UNIT_PRICE, stock: 40, category_id: catId });
    onlineProdId = onlineProdRes.body.id;

    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ name: 'Flow Cust ' + runId, phone: '012345678' });
    custId = custRes.body.id;
  });

  afterAll(async () => {
    try {
      await db.query(`DELETE FROM tenants WHERE subdomain LIKE $1`, [prefix + '%']);
    } catch (e) {}
    await db.end();
  });

  test('Supplier stock receive increases the product quantity in the database', async () => {
    const before = await stockQty(prodId);

    const res = await request(app)
      .post('/api/stock/receive')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ product_id: Number(prodId), qty: RECEIVE_QTY, reason: 'Purchase', note: 'Supplier restock ' + runId });

    expect(res.status).toBe(200);
    expect(res.body.qtyavailable).toBe(before + RECEIVE_QTY);
    expect(await stockQty(prodId)).toBe(before + RECEIVE_QTY);
  });

  test('Supplier stock receive writes a RESTOCK row into the stock log', async () => {
    const rows = (
      await db.query(
        `SELECT change_qty, type, notes FROM tbl_stock_log
          WHERE tenant_id = $1 AND product_id = $2 AND type = 'RESTOCK' AND change_qty = $3
          ORDER BY created_at DESC`,
        [tenantAId, Number(prodId), RECEIVE_QTY]
      )
    ).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].notes).toContain('Purchase');
  });

  test('Orders page purchase persists the order and its line items in the database', async () => {
    qtyBeforePurchase = await stockQty(prodId);
    purchaseKey = crypto.randomUUID();

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        customer_id: Number(custId),
        items: [{ product_id: Number(prodId), qty: PURCHASE_QTY, unit_price: UNIT_PRICE, discount: 0 }],
        discount: 0,
        payment_method: 'Cash',
        idempotency_key: purchaseKey,
      });

    expect(res.status).toBe(201);
    purchaseOrderId = Number(res.body.or_id);
    expect(purchaseOrderId).toBeGreaterThan(0);

    const row = await orderRow(purchaseOrderId);
    expect(row).toBeDefined();
    expect(Number(row.tenant_id)).toBe(tenantAId);
    expect(Number(row.customer_id)).toBe(Number(custId));
    expect(row.status).toBe('Completed');
    expect(Number(row.total)).toBe(PURCHASE_QTY * UNIT_PRICE);

    const items = (await db.query('SELECT * FROM tbl_order_items WHERE order_id = $1', [purchaseOrderId])).rows;
    expect(items.length).toBe(1);
    expect(Number(items[0].product_id)).toBe(Number(prodId));
    expect(Number(items[0].qty)).toBe(PURCHASE_QTY);
    expect(Number(items[0].unit_price)).toBe(UNIT_PRICE);
    expect(Number(items[0].subtotal)).toBe(PURCHASE_QTY * UNIT_PRICE);
  });

  test('Orders page purchase decrements available stock and records the sale in the stock log', async () => {
    expect(await stockQty(prodId)).toBe(qtyBeforePurchase - PURCHASE_QTY);

    const rows = (
      await db.query(
        `SELECT change_qty, reference_id FROM tbl_stock_log
          WHERE tenant_id = $1 AND product_id = $2 AND type = 'SALE' AND reference_id = $3`,
        [tenantAId, Number(prodId), purchaseOrderId]
      )
    ).rows;
    expect(rows.length).toBe(1);
    expect(Number(rows[0].change_qty)).toBe(-PURCHASE_QTY);
  });

  test('Orders page purchase records a completed payment row for the order', async () => {
    const rows = (
      await db.query('SELECT amount, payment_method, status FROM tbl_payment WHERE order_id = $1', [purchaseOrderId])
    ).rows;
    expect(rows.length).toBe(1);
    expect(Number(rows[0].amount)).toBe(PURCHASE_QTY * UNIT_PRICE);
    expect(rows[0].payment_method).toBe('Cash');
    expect(rows[0].status).toBe('COMPLETED');
  });

  test('Replaying an idempotency key returns the original order without a second stock decrement', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        customer_id: Number(custId),
        items: [{ product_id: Number(prodId), qty: PURCHASE_QTY, unit_price: UNIT_PRICE, discount: 0 }],
        discount: 0,
        payment_method: 'Cash',
        idempotency_key: purchaseKey,
      });

    expect(res.status).toBe(200);
    expect(Number(res.body.or_id)).toBe(purchaseOrderId);
    expect(await stockQty(prodId)).toBe(qtyBeforePurchase - PURCHASE_QTY);
  });

  test('Refunding an order restores the stock the sale decremented', async () => {
    const res = await request(app)
      .post('/api/orders/' + purchaseOrderId + '/refund')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ reason: 'Flow verification refund' });

    expect(res.status).toBe(200);
    expect(await stockQty(prodId)).toBe(qtyBeforePurchase);
    const row = await orderRow(purchaseOrderId);
    expect(row.status).toBe('Refunded');
  });

  test('Refunding an order marks its payment row as refunded', async () => {
    const rows = (await db.query('SELECT status FROM tbl_payment WHERE order_id = $1', [purchaseOrderId])).rows;
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('REFUNDED');
  });

  test('Public checkout stores a pending online order and decrements stock once', async () => {
    qtyBeforeOnline = await stockQty(onlineProdId);

    const res = await request(app)
      .post('/api/public/store/' + tenantASub + '/orders')
      .send({
        customer_name: 'Online Flow ' + runId,
        customer_phone: '011222333',
        delivery_type: 'pickup',
        items: [{ product_id: Number(onlineProdId), qty: ONLINE_QTY }],
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID(),
      });

    expect(res.status).toBe(201);
    onlineOrderId = Number(res.body.order_id);
    expect(onlineOrderId).toBeGreaterThan(0);

    const row = await orderRow(onlineOrderId);
    expect(row).toBeDefined();
    expect(row.status).toBe('Pending');
    expect(row.source).toBe('ONLINE');
    expect(row.customer_name).toBe('Online Flow ' + runId);

    const store = (await db.query('SELECT tax_rate FROM store_settings WHERE slug = $1', [tenantASub])).rows[0];
    const expectedTotal = ONLINE_QTY * UNIT_PRICE + (ONLINE_QTY * UNIT_PRICE * Number(store.tax_rate || 0)) / 100;
    expect(Number(row.total)).toBeCloseTo(expectedTotal, 2);
    expect(await stockQty(onlineProdId)).toBe(qtyBeforeOnline - ONLINE_QTY);
  });

  test('Public checkout records an ONLINE_ORDER row in the stock log', async () => {
    const rows = (
      await db.query(
        `SELECT change_qty, reference_id FROM tbl_stock_log
          WHERE tenant_id = $1 AND product_id = $2 AND type = 'ONLINE_ORDER' AND reference_id = $3`,
        [tenantAId, Number(onlineProdId), onlineOrderId]
      )
    ).rows;
    expect(rows.length).toBe(1);
    expect(Number(rows[0].change_qty)).toBe(-ONLINE_QTY);
  });

  test('Confirming a pending online order advances its status without touching stock again', async () => {
    const res = await request(app)
      .patch('/api/orders/' + onlineOrderId + '/status')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ status: 'Confirmed' });

    expect(res.status).toBe(200);
    const row = await orderRow(onlineOrderId);
    expect(row.status).toBe('Confirmed');
    expect(await stockQty(onlineProdId)).toBe(qtyBeforeOnline - ONLINE_QTY);
  });

  test('Advancing a confirmed online order to Completed records its payment row', async () => {
    const steps = ['Preparing', 'Ready', 'Completed'];
    for (const status of steps) {
      const res = await request(app)
        .patch('/api/orders/' + onlineOrderId + '/status')
        .set('Authorization', 'Bearer ' + tokenA)
        .send({ status });
      expect(res.status).toBe(200);
    }

    const row = await orderRow(onlineOrderId);
    expect(row.status).toBe('Completed');

    const payments = (await db.query('SELECT amount, status FROM tbl_payment WHERE order_id = $1', [onlineOrderId])).rows;
    expect(payments.length).toBe(1);
    expect(payments[0].status).toBe('COMPLETED');
    expect(Number(payments[0].amount)).toBeCloseTo(Number(row.total), 2);
    expect(await stockQty(onlineProdId)).toBe(qtyBeforeOnline - ONLINE_QTY);
  });

  test('An order created in another tenant is not readable by this tenant', async () => {
    await expectDenied(app, {
      method: 'get',
      path: '/api/orders/' + purchaseOrderId,
      deniedToken: tokenB,
      allowedToken: tokenA,
      status: 404,
    });
  });

  test('An order cannot be created with a customer that belongs to another tenant', async () => {
    await expectDenied(app, {
      method: 'post',
      path: '/api/orders',
      deniedToken: tokenB,
      allowedToken: tokenA,
      status: 400,
      body: {
        customer_id: Number(custId),
        items: [{ product_id: Number(prodId), qty: 1 }],
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID(),
      },
      allowedBody: {
        customer_id: Number(custId),
        items: [{ product_id: Number(prodId), qty: 1 }],
        payment_method: 'Cash',
        idempotency_key: crypto.randomUUID(),
      },
      readRow: async () => {
        const r = await db.query('SELECT COUNT(*)::int AS n FROM tbl_orders WHERE tenant_id = $1', [tenantBId]);
        return r.rows[0];
      },
    });
  });
});
