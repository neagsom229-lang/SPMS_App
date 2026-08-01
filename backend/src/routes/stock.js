// backend/src/routes/stock.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// GET /api/stock - Get all stock
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.*,
        p.product_code,
        p.name_en,
        p.name_kh,
        p.saleout_price,
        p.qty_alert
      FROM tbl_stock s
      LEFT JOIN tbl_products p ON s.productid = p.id
      ORDER BY p.name_en ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching stock:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stock/low-stock - Get low stock items
router.get('/low-stock', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.*,
        p.product_code,
        p.name_en,
        p.name_kh,
        p.saleout_price,
        p.qty_alert
      FROM tbl_stock s
      LEFT JOIN tbl_products p ON s.productid = p.id
      WHERE s.qtyavailable <= p.qty_alert
      ORDER BY s.qtyavailable ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching low stock:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/stock/:productid - Update stock
router.put('/:productid', verifyToken, async (req, res) => {
  try {
    const { productid } = req.params;
    const { QtyInStock, QtyAvailable, QtyReserved, action } = req.body;
    
    console.log('📤 Update stock request:', { productid, QtyInStock, QtyAvailable, QtyReserved, action });
    
    const qtyInStock = parseInt(QtyInStock) || 0;
    const qtyAvailable = parseInt(QtyAvailable) || 0;
    const qtyReserved = parseInt(QtyReserved) || 0;
    
    // Check if product exists
    const check = await pool.query(
      'SELECT stockid, qtyinstock, qtyavailable, qtyreserved FROM tbl_stock WHERE productid = $1',
      [productid]
    );
    
    let result;
    
    if (check.rows.length > 0) {
      const current = check.rows[0];
      let newQtyInStock = qtyInStock;
      let newQtyAvailable = qtyAvailable;
      let newQtyReserved = qtyReserved;
      
      if (action === 'add') {
        newQtyInStock = current.qtyinstock + qtyInStock;
        newQtyAvailable = current.qtyavailable + qtyAvailable;
        newQtyReserved = current.qtyreserved + qtyReserved;
      } else if (action === 'reduce') {
        newQtyInStock = Math.max(0, current.qtyinstock - qtyInStock);
        newQtyAvailable = Math.max(0, current.qtyavailable - qtyAvailable);
        newQtyReserved = Math.max(0, current.qtyreserved - qtyReserved);
      }
      
      result = await pool.query(
        `UPDATE tbl_stock 
         SET qtyinstock = $1, 
             qtyavailable = $2, 
             qtyreserved = $3, 
             lastupdated = NOW()
         WHERE productid = $4
         RETURNING *`,
        [newQtyInStock, newQtyAvailable, newQtyReserved, productid]
      );
    } else {
      result = await pool.query(
        `INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, qtyreserved)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [productid, qtyInStock, qtyAvailable, qtyReserved]
      );
    }
    
    console.log('✅ Stock updated:', result.rows[0]);
    
    res.json({ 
      success: true, 
      message: 'Stock updated successfully',
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Update stock error:', error);
    res.status(500).json({ 
      error: error.message,
      hint: 'Check database connection'
    });
  }
});

module.exports = router;