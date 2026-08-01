// backend/routes/dashboard.js
const express = require("express");
const db = require("../config/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/dashboard/summary
router.get("/summary", (req, res) => {
  const totalRevenue = db
    .prepare(`SELECT COALESCE(SUM(SUBTOTAL), 0) AS total FROM TBL_ORDERS_DETAILS`)
    .get().total;

  const orderCount = db.prepare(`SELECT COUNT(*) AS n FROM TBL_ORDERS`).get().n;
  const productCount = db.prepare(`SELECT COUNT(*) AS n FROM TBL_PRODUCTS`).get().n;
  const customerCount = db.prepare(`SELECT COUNT(*) AS n FROM TBL_CUSTOMERS`).get().n;

  const lowStock = db
    .prepare(
      `SELECT COUNT(*) AS n FROM TBL_PRODUCTS
       WHERE QTY_ALERT IS NOT NULL AND QTY_ALERT > 0 AND QTY_INSTOCK <= QTY_ALERT`
    )
    .get().n;

  const openService = db
    .prepare(`SELECT COUNT(*) AS n FROM Tbl_Service_Requests WHERE Status != 'COMPLETED'`)
    .get().n;

  res.json({
    totalRevenue,
    orderCount,
    productCount,
    customerCount,
    lowStock,
    openService,
    avgOrderValue: orderCount ? totalRevenue / orderCount : 0,
  });
});

// GET /api/dashboard/revenue-by-category
router.get("/revenue-by-category", (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.CATEGORY_EN AS category, COALESCE(SUM(d.SUBTOTAL), 0) AS revenue
       FROM TBL_ORDERS_DETAILS d
       JOIN TBL_PRODUCTS p ON p.ID = d.PRODUCT_ID
       LEFT JOIN TBL_CATEGORY c ON c.ID = p.CATEGORY_ID
       GROUP BY c.CATEGORY_EN
       ORDER BY revenue DESC`
    )
    .all();
  res.json(rows);
});

// GET /api/dashboard/order-status
router.get("/order-status", (req, res) => {
  const rows = db
    .prepare(
      `SELECT STATUS AS status, COUNT(*) AS count FROM TBL_ORDERS GROUP BY STATUS`
    )
    .all();
  res.json(rows);
});

// GET /api/dashboard/top-products
router.get("/top-products", (req, res) => {
  const limit = Number(req.query.limit) || 8;
  const rows = db
    .prepare(
      `SELECT p.NAME_EN AS name, SUM(d.QTY_ORDER) AS qty, SUM(d.SUBTOTAL) AS revenue
       FROM TBL_ORDERS_DETAILS d
       JOIN TBL_PRODUCTS p ON p.ID = d.PRODUCT_ID
       GROUP BY d.PRODUCT_ID
       ORDER BY revenue DESC
       LIMIT ?`
    )
    .all(limit);
  res.json(rows);
});

// GET /api/dashboard/low-stock
router.get("/low-stock", (req, res) => {
  const rows = db
    .prepare(
      `SELECT ID, NAME_EN, QTY_INSTOCK, QTY_ALERT
       FROM TBL_PRODUCTS
       WHERE QTY_ALERT IS NOT NULL AND QTY_ALERT > 0 AND QTY_INSTOCK <= QTY_ALERT
       ORDER BY QTY_INSTOCK ASC`
    )
    .all();
  res.json(rows);
});

module.exports = router;
