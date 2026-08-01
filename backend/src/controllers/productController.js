// backend/src/controllers/productController.js
const db = require('../config/postgres');

const productController = {
  getAll: async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM tbl_products WHERE status = $1 ORDER BY name_en',
        ['Active']
      );
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Get products error:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  getById: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await db.query(
        'SELECT * FROM tbl_products WHERE product_id = $1 AND status = $2',
        [id, 'Active']
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  create: async (req, res) => {
    const { NAME_EN, NAME_KH, PRICE, STOCK } = req.body;
    try {
      const result = await db.query(
        `INSERT INTO tbl_products (name_en, name_kh, saleout_price, qty_alert, status)
         VALUES ($1, $2, $3, $4, 'Active') RETURNING *`,
        [NAME_EN, NAME_KH, PRICE || 0, STOCK || 10]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  update: async (req, res) => {
    const { id } = req.params;
    const { NAME_EN, NAME_KH, PRICE, STOCK } = req.body;
    try {
      const result = await db.query(
        `UPDATE tbl_products 
         SET name_en = $1, name_kh = $2, saleout_price = $3, qty_alert = $4
         WHERE product_id = $5 RETURNING *`,
        [NAME_EN, NAME_KH, PRICE || 0, STOCK || 10, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  delete: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await db.query(
        'UPDATE tbl_products SET status = $1 WHERE product_id = $2 RETURNING *',
        ['Inactive', id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = productController;