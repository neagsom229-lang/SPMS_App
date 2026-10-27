// backend/src/controllers/productController.js
const db = require('../config/postgres');
const { serializeProduct } = require('../lib/serializers');

const productController = {
  getAll: async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM tbl_products WHERE LOWER(status) = $1 ORDER BY name',
        ['active']
      );
      res.json(result.rows.map(serializeProduct));
    } catch (error) {
      console.error('❌ Get products error:', error.message);
      res.status(500).json({ error: error.message });
    }
  },

  getById: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await db.query(
        'SELECT * FROM tbl_products WHERE id = $1 AND LOWER(status) = $2',
        [id, 'active']
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(serializeProduct(result.rows[0]));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  create: async (req, res) => {
    const { NAME_EN, name, NAME_KH, PRICE, price, STOCK, stock } = req.body;
    const productName = NAME_EN || name || 'Product';
    const productPrice = PRICE !== undefined ? PRICE : (price !== undefined ? price : 0);
    const productStock = STOCK !== undefined ? STOCK : (stock !== undefined ? stock : 10);
    try {
      const result = await db.query(
        `INSERT INTO tbl_products (name, name_kh, price, qty_alert, stock, status)
         VALUES ($1, $2, $3, $4, $5, 'Active') RETURNING *`,
        [productName, NAME_KH || '', productPrice, 5, productStock]
      );
      res.status(201).json(serializeProduct(result.rows[0]));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  update: async (req, res) => {
    const { id } = req.params;
    const { NAME_EN, name, NAME_KH, PRICE, price, STOCK, stock } = req.body;
    const productName = NAME_EN || name;
    const productPrice = PRICE !== undefined ? PRICE : price;
    const productStock = STOCK !== undefined ? STOCK : stock;
    try {
      const result = await db.query(
        `UPDATE tbl_products 
         SET name = COALESCE($1, name), name_kh = COALESCE($2, name_kh), price = COALESCE($3, price), stock = COALESCE($4, stock)
         WHERE id = $5 RETURNING *`,
        [productName, NAME_KH, productPrice, productStock, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(serializeProduct(result.rows[0]));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  delete: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await db.query(
        'UPDATE tbl_products SET status = $1 WHERE id = $2 RETURNING *',
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
