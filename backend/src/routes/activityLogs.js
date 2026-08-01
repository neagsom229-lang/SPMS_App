// backend/src/routes/activityLogs.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// GET /api/activity-logs - Get all activity logs
router.get('/', verifyToken, async (req, res) => {
  try {
    const { limit = 200, offset = 0 } = req.query;
    
    const result = await pool.query(
      `SELECT 
        al.log_id,
        al.user_id,
        u.username,
        u.fullname,
        al.action,
        al.table_name,
        al.record_id,
        al.action_date,
        al.details
      FROM tbl_activity_logs al
      LEFT JOIN tbl_users u ON al.user_id = u.user_id
      ORDER BY al.action_date DESC
      LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rowCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('❌ Error fetching activity logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/activity-logs - Create a new log entry
router.post('/', verifyToken, async (req, res) => {
  try {
    const { user_id, action, table_name, record_id, details } = req.body;
    
    if (!user_id || !action) {
      return res.status(400).json({ error: 'user_id and action are required' });
    }
    
    const result = await pool.query(
      `INSERT INTO tbl_activity_logs (user_id, action, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user_id, action, table_name || null, record_id || null, details || null]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error creating activity log:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/activity-logs/:id - Get single log
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        al.log_id,
        al.user_id,
        u.username,
        u.fullname,
        al.action,
        al.table_name,
        al.record_id,
        al.action_date,
        al.details
      FROM tbl_activity_logs al
      LEFT JOIN tbl_users u ON al.user_id = u.user_id
      WHERE al.log_id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error fetching log:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;