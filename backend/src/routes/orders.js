// backend/routes/orders.js
const express = require("express");
const db = require("../config/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/orders - list all orders with customer name
router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*,
              TRIM(COALESCE(c.FIRST_NAME,'') || ' ' || COALESCE(c.LAST_NAME,'')) AS customerName
       FROM TBL_ORDERS o
       LEFT JOIN TBL_CUSTOMERS c ON c.ID = o.CUSTOMER_ID
       ORDER BY o.OR_ID DESC`
    )
    .all();
  res.json(rows);
});

// GET /api/orders/:id - order + line items
router.get("/:id", (req, res) => {
  const order = db.prepare(`SELECT * FROM TBL_ORDERS WHERE OR_ID = ?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const items = db
    .prepare(
      `SELECT d.*, p.NAME_EN
       FROM TBL_ORDERS_DETAILS d
       LEFT JOIN TBL_PRODUCTS p ON p.ID = d.PRODUCT_ID
       WHERE d.OR_ID = ?`
    )
    .all(req.params.id);

  res.json({ ...order, items });
});

// POST /api/orders - create a new order with line items
// body: { CUSTOMER_ID, items: [{ PRODUCT_ID, QTY_ORDER, PRICE }] }
router.post("/", (req, res) => {
  const { CUSTOMER_ID, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "At least one order item is required" });
  }

  const insertOrder = db.prepare(
    `INSERT INTO TBL_ORDERS (ORDER_NO, CUSTOMER_ID, ORDER_DATE, AMOUNT_US, STATUS)
     VALUES (?, ?, datetime('now'), ?, 'PENDING')`
  );
  const insertDetail = db.prepare(
    `INSERT INTO TBL_ORDERS_DETAILS (OR_ID, PRODUCT_ID, QTY_ORDER, PRICE, SUBTOTAL)
     VALUES (?, ?, ?, ?, ?)`
  );
  const updateStock = db.prepare(
    `UPDATE TBL_PRODUCTS SET QTY_INSTOCK = QTY_INSTOCK - ? WHERE ID = ?`
  );

  const total = items.reduce((s, it) => s + Number(it.PRICE) * Number(it.QTY_ORDER), 0);
  const orderNo = `ORD-${Date.now()}`;

  const tx = db.transaction(() => {
    const info = insertOrder.run(orderNo, CUSTOMER_ID || null, total);
    const orderId = info.lastInsertRowid;
    for (const it of items) {
      const subtotal = Number(it.PRICE) * Number(it.QTY_ORDER);
      insertDetail.run(orderId, it.PRODUCT_ID, it.QTY_ORDER, it.PRICE, subtotal);
      updateStock.run(it.QTY_ORDER, it.PRODUCT_ID);
    }
    return orderId;
  });

  const orderId = tx();
  const created = db.prepare(`SELECT * FROM TBL_ORDERS WHERE OR_ID = ?`).get(orderId);
  res.status(201).json(created);
});

// PATCH /api/orders/:id/status
router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  const valid = ["PENDING", "COMPLETED", "CANCELLED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `Status must be one of ${valid.join(", ")}` });
  }
  const existing = db.prepare(`SELECT * FROM TBL_ORDERS WHERE OR_ID = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Order not found" });

  db.prepare(`UPDATE TBL_ORDERS SET STATUS = ? WHERE OR_ID = ?`).run(status, req.params.id);
  const updated = db.prepare(`SELECT * FROM TBL_ORDERS WHERE OR_ID = ?`).get(req.params.id);
  res.json(updated);
});

module.exports = router;
