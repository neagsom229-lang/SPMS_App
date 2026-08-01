// backend/routes/customers.js
const express = require("express");
const db = require("../config/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/customers
router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, t.CUSTOMER_TYPE_EN
       FROM TBL_CUSTOMERS c
       LEFT JOIN TBL_CUSTOMER_TYPE t ON t.CUSTOMER_TYPE_CODE = c.CUSTOMER_TYPE_CODE
       ORDER BY c.ID`
    )
    .all();
  res.json(rows);
});

// GET /api/customers/:id - includes their order history
router.get("/:id", (req, res) => {
  const customer = db.prepare(`SELECT * FROM TBL_CUSTOMERS WHERE ID = ?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const orders = db
    .prepare(`SELECT * FROM TBL_ORDERS WHERE CUSTOMER_ID = ? ORDER BY OR_ID DESC`)
    .all(req.params.id);

  res.json({ ...customer, orders });
});

// POST /api/customers
router.post("/", (req, res) => {
  const { FIRST_NAME, LAST_NAME, PHONE, E_MAIL, CUSTOMER_TYPE_CODE } = req.body;
  if (!FIRST_NAME) return res.status(400).json({ error: "FIRST_NAME is required" });

  const info = db
    .prepare(
      `INSERT INTO TBL_CUSTOMERS (FIRST_NAME, LAST_NAME, PHONE, E_MAIL, CUSTOMER_TYPE_CODE, STATUS, BALANCE, CREATED_AT)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, datetime('now'))`
    )
    .run(FIRST_NAME, LAST_NAME || null, PHONE || null, E_MAIL || null, CUSTOMER_TYPE_CODE || "RETAIL");

  const created = db.prepare(`SELECT * FROM TBL_CUSTOMERS WHERE ID = ?`).get(info.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/customers/:id
router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM TBL_CUSTOMERS WHERE ID = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Customer not found" });

  const fields = ["FIRST_NAME", "LAST_NAME", "PHONE", "E_MAIL", "CUSTOMER_TYPE_CODE", "STATUS", "BALANCE"];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: "No valid fields to update" });

  updates.push(`UPDATED_AT = datetime('now')`);
  values.push(req.params.id);

  db.prepare(`UPDATE TBL_CUSTOMERS SET ${updates.join(", ")} WHERE ID = ?`).run(...values);
  const updated = db.prepare(`SELECT * FROM TBL_CUSTOMERS WHERE ID = ?`).get(req.params.id);
  res.json(updated);
});

module.exports = router;
