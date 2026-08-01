// backend/routes/products.js
const express = require("express");
const db = require("../config/database");
const { requireAuth } = require("../middleware/auth");
const { validate, productValidations } = require('../middleware/validate');
// backend/src/routes/products.js
const { page = 1, limit = 10 } = req.query;
const offset = (page - 1) * limit;

router.post(
  '/', 
  authenticate, 
  validate(productValidations.create), 
  productController.create
);

router.put(
  '/:id', 
  authenticate, 
  validate(productValidations.update), 
  productController.update
);

const router = express.Router();
router.use(requireAuth);

// GET /api/products - list all products (with category name)
router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, c.CATEGORY_EN, c.CATEGORY_KH
       FROM TBL_PRODUCTS p
       LEFT JOIN TBL_CATEGORY c ON c.ID = p.CATEGORY_ID
       ORDER BY p.ID`
    )
    .all();
  res.json(rows);
});

// GET /api/products/:id
router.get("/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT p.*, c.CATEGORY_EN, c.CATEGORY_KH
       FROM TBL_PRODUCTS p
       LEFT JOIN TBL_CATEGORY c ON c.ID = p.CATEGORY_ID
       WHERE p.ID = ?`
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "Product not found" });
  res.json(row);
});

// POST /api/products - create a new product
router.post("/", (req, res) => {
  const {
    PRODUCT_ID, SUPPLIER_ID, BARCODE, NAME_EN, NAME_KH, BRAND, MODEL,
    CATEGORY_ID, BUYIN_PRICE, SALEOUT_PRICE, QTY_INSTOCK, QTY_ALERT, STATUS,
  } = req.body;

  if (!NAME_EN || SALEOUT_PRICE === undefined) {
    return res.status(400).json({ error: "NAME_EN and SALEOUT_PRICE are required" });
  }

  const info = db
    .prepare(
      `INSERT INTO TBL_PRODUCTS
        (PRODUCT_ID, SUPPLIER_ID, BARCODE, NAME_EN, NAME_KH, BRAND, MODEL,
         CATEGORY_ID, BUYIN_PRICE, SALEOUT_PRICE, QTY_INSTOCK, QTY_ALERT, STATUS, CREATED_DATE)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      PRODUCT_ID || null, SUPPLIER_ID || null, BARCODE || null, NAME_EN, NAME_KH || null,
      BRAND || null, MODEL || null, CATEGORY_ID || null, BUYIN_PRICE || 0,
      SALEOUT_PRICE, QTY_INSTOCK || 0, QTY_ALERT || 0, STATUS || "ACTIVE"
    );

  const created = db.prepare(`SELECT * FROM TBL_PRODUCTS WHERE ID = ?`).get(info.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/products/:id - update a product
router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM TBL_PRODUCTS WHERE ID = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found" });

  const fields = [
    "NAME_EN", "NAME_KH", "BRAND", "MODEL", "CATEGORY_ID", "BUYIN_PRICE",
    "SALEOUT_PRICE", "QTY_INSTOCK", "QTY_ALERT", "STATUS",
  ];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: "No valid fields to update" });

  updates.push(`UPDATED_DATE = datetime('now')`);
  values.push(req.params.id);

  db.prepare(`UPDATE TBL_PRODUCTS SET ${updates.join(", ")} WHERE ID = ?`).run(...values);
  const updated = db.prepare(`SELECT * FROM TBL_PRODUCTS WHERE ID = ?`).get(req.params.id);
  res.json(updated);
});

// DELETE /api/products/:id
router.delete("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM TBL_PRODUCTS WHERE ID = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found" });
  db.prepare(`DELETE FROM TBL_PRODUCTS WHERE ID = ?`).run(req.params.id);
  res.status(204).end();
});

// backend/src/routes/products.js

// Bulk delete
router.delete('/bulk', authenticate, async (req, res) => {
  const { ids } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No product IDs provided' });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await db.query(
      `UPDATE tbl_products SET status = 'Inactive' WHERE id IN (${placeholders})`,
      ids
    );
    
    res.json({ 
      message: `${result.rowCount} products deleted successfully`,
      deleted: result.rowCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update stock
router.patch('/bulk-stock', authenticate, async (req, res) => {
  const { ids, quantity } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No product IDs provided' });
  }

  if (isNaN(quantity)) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await db.query(
      `UPDATE tbl_stock s 
       SET qtyinstock = qtyinstock + $${ids.length + 1}, 
           qtyavailable = qtyavailable + $${ids.length + 1}
       FROM tbl_products p 
       WHERE s.productid = p.id AND p.id IN (${placeholders})`,
      [...ids, quantity]
    );
    
    res.json({ 
      message: `Stock updated for ${result.rowCount} products`,
      updated: result.rowCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk export
router.get('/export', authenticate, async (req, res) => {
  const { ids } = req.query;
  
  let query = 'SELECT * FROM tbl_products WHERE status = \'Active\'';
  const params = [];
  
  if (ids) {
    const idArray = ids.split(',');
    const placeholders = idArray.map((_, i) => `$${i + 1}`).join(',');
    query += ` AND id IN (${placeholders})`;
    params.push(...idArray);
  }
  
  try {
    const result = await db.query(query, params);
    // Export to Excel logic here
    res.json({ 
      products: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
