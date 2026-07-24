// ============================================
// ✅ server.js - COMPLETE FIXED VERSION
// ============================================

require('dotenv').config();

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./config/postgres");

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// CORS CONFIGURATION - MOVED TO TOP ✅
// ============================================
const allowedOrigins = [
  'https://spms-chh-sn-pro.vercel.app',
  'https://spms-chh-sn-new.vercel.app',
  'https://spms-chh-sn.vercel.app',
  'https://chheangsamnangs-projects.vercel.app',
  'https://spms-chh-sn-git-main-chheangsamnangs-projects.vercel.app',
  'https://spms-chh-sn.onrender.com',
  /\.vercel\.app$/,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') return allowed === origin;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return false;
    });
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(null, false); // ✅ ACTUALLY BLOCK - FIXED
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
};

// ✅ CORS MUST BE FIRST - FIXED
app.use(cors(corsOptions));
// ❌ REMOVED: app.options('*', cors(corsOptions)); - Redundant and can crash

// ✅ Body parser - SECOND
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

console.log('📊 Using PostgreSQL Database');
console.log('✅ CORS allowed origins:', allowedOrigins);

// ============================================
// TEST ENDPOINTS - NOW AFTER CORS ✅
// ============================================
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "API is working!", 
    time: new Date().toISOString(),
    status: "ok"
  });
});

app.get("/api", (req, res) => {
  res.json({
    message: "SPMS API is running",
    status: "ok",
    endpoints: {
      auth: "/api/auth/login",
      customers: "/api/customers",
      products: "/api/products",
      orders: "/api/orders",
      suppliers: "/api/suppliers",
      users: "/api/users",
      analytics: "/api/analytics",
      reports: "/api/reports",
      test: "/api/test",
      dbTest: "/api/db-test"
    }
  });
});

// ============================================
// DATABASE TEST ENDPOINT
// ============================================
app.get("/api/db-test", async (req, res) => {
  try {
    console.log("🔍 Testing database connection...");
    const result = await db.query("SELECT NOW() as time, current_database() as db");
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    res.json({
      success: true,
      connected: true,
      database: result.rows[0],
      tables: tables.rows.map(r => r.table_name),
      message: "Database connection successful!"
    });
  } catch (err) {
    console.error("❌ Database test error:", err.message);
    res.status(500).json({
      success: false,
      connected: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// ============================================
// ✅ ACTIVITY LOG - IN-MEMORY STORAGE
// ============================================
let activityLogs = [];
const MAX_LOGS = 100;

const logActivity = (userId, action, tableName, recordId = null) => {
  try {
    const logEntry = {
      log_id: Date.now() + Math.random() * 1000,
      user_id: userId || 1,
      username: "Unknown",
      action: action,
      table_name: tableName,
      record_id: recordId,
      action_date: new Date().toISOString(),
    };
    activityLogs.unshift(logEntry);
    if (activityLogs.length > MAX_LOGS) {
      activityLogs = activityLogs.slice(0, MAX_LOGS);
    }
    console.log(`📝 [LOG] User ${userId}: ${action} on ${tableName}`);
  } catch (err) {
    console.warn("⚠️ Activity log error:", err.message);
  }
};

// ============================================
// ✅ ACTIVITY LOGS ROUTES
// ============================================
app.get("/api/activity-logs", async (req, res) => {
  const { limit = 50 } = req.query;
  console.log(`📋 Fetching activity logs (limit: ${limit})`);
  
  try {
    let logs = activityLogs.slice(0, Number(limit));
    
    const result = await db.query("SELECT userid, username FROM tbl_users");
    const users = result.rows || [];
    const userMap = {};
    users.forEach((u) => {
      userMap[u.userid] = u.username;
    });
    
    logs.forEach((log) => {
      log.username = userMap[log.user_id] || "Unknown";
    });
    
    console.log(`📋 Returning ${logs.length} logs`);
    res.json(logs);
  } catch (err) {
    console.error("❌ Activity logs error:", err.message);
    const logs = activityLogs.slice(0, Number(limit));
    res.json(logs);
  }
});

app.delete("/api/activity-logs", (req, res) => {
  activityLogs = [];
  res.json({ message: "Activity logs cleared" });
});

// ============================================
// AUTHENTICATION
// ============================================
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  console.log("🔑 Login attempt:", username);

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const result = await db.query(
      `SELECT userid, username, password, fullname, role, status 
       FROM tbl_users 
       WHERE LOWER(username) = LOWER($1) AND status = 'ACTIVE'`,
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      console.log("❌ User not found:", username);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.password !== password) {
      console.log("❌ Password incorrect for:", username);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("✅ Login successful:", username);
    logActivity(user.userid, "Login", "tbl_users", user.userid);

    res.json({
      user_id: user.userid,
      username: user.username,
      role: user.role || "Cashier",
      role_name: user.role || "Cashier",
      status: user.status,
      fullname: user.fullname || user.username,
    });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ============================================
// DASHBOARD STATS
// ============================================
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const queries = [
      db.query("SELECT COUNT(*) as count FROM tbl_customers WHERE status = 'Active'"),
      db.query("SELECT COUNT(*) as count FROM tbl_products WHERE status = 'Active'"),
      db.query("SELECT COUNT(*) as count FROM tbl_orders"),
      db.query("SELECT COALESCE(SUM(amount_us), 0) as revenue FROM tbl_orders"),
      db.query("SELECT COUNT(*) as count FROM tbl_stock WHERE qtyavailable <= 5"),
      db.query("SELECT COUNT(*) as count FROM tbl_orders WHERE status = 'Pending'")
    ];

    const results = await Promise.all(queries);
    
    const stats = {
      totalCustomers: parseInt(results[0].rows[0]?.count || 0),
      totalProducts: parseInt(results[1].rows[0]?.count || 0),
      totalOrders: parseInt(results[2].rows[0]?.count || 0),
      totalRevenue: parseFloat(results[3].rows[0]?.revenue || 0),
      lowStockItems: parseInt(results[4].rows[0]?.count || 0),
      pendingOrders: parseInt(results[5].rows[0]?.count || 0),
    };

    res.json(stats);
  } catch (err) {
    console.error("❌ Dashboard stats error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ CUSTOMERS (CRUD) - SINGLE DEFINITION ✅
// ============================================
app.get("/api/customers", async (req, res) => {
  const { search } = req.query;
  let sql = "SELECT * FROM tbl_customers WHERE status = 'Active'";
  const params = [];

  if (search) {
    sql += ` AND (first_name ILIKE $1 OR last_name ILIKE $1 OR phone ILIKE $1 OR e_mail ILIKE $1)`;
    params.push(`%${search}%`);
  }

  sql += " ORDER BY first_name ASC";

  try {
    const result = await db.query(sql, params);
    console.log(`👥 Customers found: ${result.rows.length}`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Customers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/customers/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(`SELECT * FROM tbl_customers WHERE cus_id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/customers", async (req, res) => {
  const { FIRST_NAME, LAST_NAME, PHONE, E_MAIL, ADDRESS, BALANCE, IMAGE_URL } = req.body;

  if (!FIRST_NAME || !LAST_NAME) {
    return res.status(400).json({ error: "First name and last name are required" });
  }

  try {
    const maxIdResult = await db.query("SELECT MAX(cus_id) as maxId FROM tbl_customers");
    let nextNumber = 1;
    if (maxIdResult.rows[0]?.maxid) {
      const numPart = parseInt(maxIdResult.rows[0].maxid.replace(/[^0-9]/g, ""));
      if (!isNaN(numPart)) nextNumber = numPart + 1;
    }
    const newCusId = `CUS${String(nextNumber).padStart(3, "0")}`;

    const result = await db.query(
      `INSERT INTO tbl_customers (cus_id, first_name, last_name, phone, e_mail, address, balance, status, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8) RETURNING cus_id`,
      [newCusId, FIRST_NAME, LAST_NAME, PHONE || null, E_MAIL || null, ADDRESS || null, BALANCE || 0, IMAGE_URL || null]
    );

    logActivity(req.body.user_id || 1, "Created customer", "tbl_customers", newCusId);
    res.json({
      cus_id: newCusId,
      message: "Customer created successfully",
    });
  } catch (err) {
    console.error("❌ Create customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/customers/:id", async (req, res) => {
  const { id } = req.params;
  const { FIRST_NAME, LAST_NAME, PHONE, E_MAIL, ADDRESS, BALANCE, STATUS, IMAGE_URL } = req.body;

  try {
    const result = await db.query(
      `UPDATE tbl_customers 
       SET first_name = $1, last_name = $2, phone = $3, e_mail = $4, 
           address = $5, balance = $6, status = $7, image_url = $8
       WHERE cus_id = $9`,
      [FIRST_NAME, LAST_NAME, PHONE, E_MAIL, ADDRESS, BALANCE || 0, STATUS || 'Active', IMAGE_URL || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    logActivity(req.body.user_id || 1, "Updated customer", "tbl_customers", id);
    res.json({ message: "Customer updated successfully" });
  } catch (err) {
    console.error("❌ Update customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/customers/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `UPDATE tbl_customers SET status = 'Inactive' WHERE cus_id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    logActivity(req.body.user_id || 1, "Deleted customer", "tbl_customers", id);
    res.json({ message: "Customer deleted successfully" });
  } catch (err) {
    console.error("❌ Delete customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PRODUCTS - WITH IMAGE SUPPORT ✅
// ============================================
app.get("/api/products", async (req, res) => {
  const { search } = req.query;
  console.log("📦 Fetching products - search:", search || "all");

  let sql = "SELECT * FROM tbl_products WHERE status = 'Active'";
  const params = [];

  if (search) {
    sql += ` AND (name_en ILIKE $1 OR name_kh ILIKE $1 OR barcode ILIKE $1)`;
    params.push(`%${search}%`);
  }

  try {
    const result = await db.query(sql, params);
    console.log(`📦 Products found: ${result.rows.length}`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Products error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`🔍 Fetching product: ${id}`);

  try {
    const result = await db.query(`SELECT * FROM tbl_products WHERE product_id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Product error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/products", async (req, res) => {
  console.log("📝 CREATE PRODUCT - Request received");

  const { 
    NAME_EN, 
    NAME_KH, 
    BARCODE, 
    BRAND, 
    CATEGORY_ID, 
    BUYIN_PRICE, 
    SALEOUT_PRICE, 
    QTY_ALERT, 
    QTY_INSTOCK,
    IMAGE_URL
  } = req.body;

  console.log("📸 Image received:", IMAGE_URL ? `✅ (${IMAGE_URL.length} chars)` : '❌ NULL');

  if (!NAME_EN || NAME_EN.trim() === '') {
    return res.status(400).json({ error: "Product English name is required" });
  }

  if (!NAME_KH || NAME_KH.trim() === '') {
    return res.status(400).json({ error: "Product Khmer name is required" });
  }

  try {
    const maxIdResult = await db.query("SELECT MAX(product_id) as maxId FROM tbl_products");
    let nextNumber = 1;
    if (maxIdResult.rows && maxIdResult.rows.length > 0 && maxIdResult.rows[0]?.maxid) {
      const currentId = maxIdResult.rows[0].maxid;
      const numPart = parseInt(String(currentId).replace(/[^0-9]/g, ""));
      if (!isNaN(numPart)) nextNumber = numPart + 1;
    }
    const newProductId = `PROD${String(nextNumber).padStart(3, "0")}`;
    console.log(`📦 Generated PRODUCT_ID: ${newProductId}`);

    const result = await db.query(
      `INSERT INTO tbl_products 
       (product_id, name_en, name_kh, barcode, brand, category_id, buyin_price, saleout_price, qty_alert, status, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', $10) 
       RETURNING id`,
      [
        newProductId, 
        NAME_EN.trim(), 
        NAME_KH.trim(), 
        BARCODE?.trim() || null, 
        BRAND?.trim() || null, 
        CATEGORY_ID || null, 
        parseFloat(BUYIN_PRICE) || 0, 
        parseFloat(SALEOUT_PRICE) || 0, 
        parseInt(QTY_ALERT) || 10,
        IMAGE_URL || null
      ]
    );

    if (!result || !result.rows || result.rows.length === 0) {
      throw new Error("Failed to create product - no ID returned");
    }

    const productId = result.rows[0].id;
    console.log(`✅ Product created with ID: ${productId}`);

    if (IMAGE_URL) {
      console.log(`📸 Image saved for product ${newProductId} (${IMAGE_URL.length} chars)`);
    }

    const qtyInStock = parseInt(QTY_INSTOCK) || 0;
    if (qtyInStock > 0) {
      try {
        await db.query(
          `INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, qtyreserved) 
           VALUES ($1, $2, $3, $4)`,
          [productId, qtyInStock, qtyInStock, 0]
        );
        console.log(`✅ Stock created for product: ${productId}`);
      } catch (stockErr) {
        console.warn("⚠️ Stock creation warning:", stockErr.message);
      }
    }

    res.json({
      product_id: newProductId,
      id: productId,
      message: "Product created successfully",
      image_saved: !!IMAGE_URL
    });
  } catch (err) {
    console.error("❌ Create product error:", err.message);
    res.status(500).json({ 
      error: err.message || "Failed to create product",
      success: false
    });
  }
});

app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`📝 Updating product: ${id}`);

  const {
    NAME_EN,
    NAME_KH,
    BARCODE,
    BRAND,
    CATEGORY_ID,
    BUYIN_PRICE,
    SALEOUT_PRICE,
    QTY_ALERT,
    STATUS,
    IMAGE_URL,
  } = req.body;

  console.log("📸 Image received for update:", IMAGE_URL ? `✅ (${IMAGE_URL.length} chars)` : '❌ NULL');

  if (!NAME_EN || NAME_EN.trim() === '') {
    return res.status(400).json({ error: "Product English name is required" });
  }

  try {
    const result = await db.query(
      `UPDATE tbl_products 
       SET name_en = $1, name_kh = $2, barcode = $3, brand = $4, 
           category_id = $5, buyin_price = $6, saleout_price = $7, 
           qty_alert = $8, status = $9, image_url = $10
       WHERE product_id = $11`,
      [
        NAME_EN.trim(), 
        NAME_KH.trim(), 
        BARCODE?.trim() || null, 
        BRAND?.trim() || null, 
        CATEGORY_ID || null, 
        parseFloat(BUYIN_PRICE) || 0, 
        parseFloat(SALEOUT_PRICE) || 0, 
        parseInt(QTY_ALERT) || 10, 
        STATUS || 'Active',
        IMAGE_URL || null,
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (IMAGE_URL) {
      console.log(`📸 Image updated for product ${id} (${IMAGE_URL.length} chars)`);
    } else {
      console.log(`📸 Image removed for product ${id}`);
    }

    logActivity(req.body.user_id || 1, "Updated product", "tbl_products", id);
    res.json({ 
      message: "Product updated successfully",
      product_id: id,
      image_updated: !!IMAGE_URL
    });
  } catch (err) {
    console.error("❌ Update product error:", err.message);
    res.status(500).json({ 
      error: err.message || "Failed to update product"
    });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`🗑️ Deleting product: ${id}`);

  try {
    const result = await db.query(
      `UPDATE tbl_products SET status = 'Inactive' WHERE product_id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    logActivity(req.body.user_id || 1, "Deleted product", "tbl_products", id);
    res.json({ 
      message: "Product deleted successfully",
      product_id: id
    });
  } catch (err) {
    console.error("❌ Delete product error:", err.message);
    res.status(500).json({ 
      error: err.message || "Failed to delete product"
    });
  }
});

// ============================================
// ✅ COMPLETE ORDERS - ALL METHODS WORKING
// ============================================

app.get("/api/orders", async (req, res) => {
  const { limit = 50, status } = req.query;
  
  let sql = `
    SELECT o.or_id, o.order_no, o.order_date, o.amount_us, o.status, o.paymentmethod, o.customer_id,
           TRIM(CONCAT(c.first_name, ' ', c.last_name)) AS customer_name,
           COALESCE(d.item_count, 0) AS item_count
    FROM tbl_orders o
    LEFT JOIN tbl_customers c ON c.cus_id = CONCAT('CUS', LPAD(o.customer_id::text, 3, '0'))
    LEFT JOIN (
      SELECT or_id, COUNT(*) AS item_count 
      FROM tbl_orders_details 
      GROUP BY or_id
    ) d ON d.or_id = o.or_id
  `;
  const params = [];
  
  if (status) {
    sql += ` WHERE o.status = $1`;
    params.push(status);
  }
  
  sql += " ORDER BY o.order_date DESC";

  try {
    const result = await db.query(sql, params);
    const rows = result.rows.slice(0, Number(limit)).map(r => ({
      id: r.or_id,
      order_no: r.order_no,
      date: r.order_date,
      total: Number(r.amount_us) || 0,
      status: r.status,
      payment_method: r.paymentmethod,
      customer_id: r.customer_id,
      customer_name: r.customer_name || "Unknown",
      item_count: Number(r.item_count) || 0
    }));
    console.log(`📋 Orders found: ${rows.length}`);
    res.json(rows);
  } catch (err) {
    console.error("❌ Orders error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders/recent", async (req, res) => {
  console.log("📊 Fetching recent orders...");
  
  try {
    const result = await db.query(
      `SELECT o.or_id, o.order_no, o.order_date, o.amount_us, o.status, o.paymentmethod, o.customer_id,
              TRIM(CONCAT(c.first_name, ' ', c.last_name)) AS customer_name
       FROM tbl_orders o
       LEFT JOIN tbl_customers c ON c.cus_id = CONCAT('CUS', LPAD(o.customer_id::text, 3, '0'))
       ORDER BY o.order_date DESC LIMIT 10`
    );
    console.log(`📋 Recent orders found: ${result.rows.length}`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Recent orders error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders/pending", async (req, res) => {
  console.log("📊 Fetching pending orders...");
  
  try {
    const result = await db.query(
      `SELECT o.or_id, o.order_no, o.order_date, o.amount_us, o.status, o.paymentmethod, o.customer_id,
              TRIM(CONCAT(c.first_name, ' ', c.last_name)) AS customer_name
       FROM tbl_orders o
       LEFT JOIN tbl_customers c ON c.cus_id = CONCAT('CUS', LPAD(o.customer_id::text, 3, '0'))
       WHERE o.status IN ('Pending', 'Processing')
       ORDER BY o.order_date DESC`
    );
    console.log(`📋 Pending orders found: ${result.rows.length}`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Pending orders error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`📊 Fetching order details for ID: ${id}`);

  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) {
    console.warn(`⚠️ Invalid order ID (not numeric): ${id}`);
    return res.status(400).json({ error: "Invalid order ID format" });
  }

  try {
    const orderResult = await db.query(
      `SELECT or_id, order_no, order_date, amount_us, status, paymentmethod, notes, emp_prepare, customer_id
       FROM tbl_orders WHERE or_id = $1`,
      [numericId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.rows[0];

    let customer = null;
    try {
      const customerResult = await db.query(
        `SELECT cus_id, first_name, last_name, phone, e_mail
         FROM tbl_customers
         WHERE cus_id = $1 OR cus_id = $2`,
        [`CUS${String(order.customer_id).padStart(3, "0")}`, order.customer_id]
      );
      if (customerResult.rows.length > 0) {
        customer = customerResult.rows[0];
      }
    } catch (err) {
      console.warn("⚠️ Customer error:", err.message);
    }

    let payments = [];
    try {
      const paymentResult = await db.query(
        `SELECT * FROM tbl_payment WHERE or_id = $1`,
        [numericId]
      );
      payments = paymentResult.rows;
    } catch (err) {
      console.warn("⚠️ Payments error:", err.message);
    }

    const itemsResult = await db.query(
      `SELECT d.id, d.or_id, d.product_id, d.qty_order as qty, d.qty_bonus,
              d.price as unit_price, d.discount, d.subtotal,
              p.name_en as product_name, p.image_url
       FROM tbl_orders_details d
       LEFT JOIN tbl_products p ON p.id = d.product_id
       WHERE d.or_id = $1`,
      [numericId]
    );

    res.json({
      OR_ID: order.or_id,
      ORDER_NO: order.order_no,
      ORDER_DATE: order.order_date,
      AMOUNT_US: order.amount_us,
      STATUS: order.status,
      PaymentMethod: order.paymentmethod,
      NOTES: order.notes,
      EMP_PREPARE: order.emp_prepare,
      CUSTOMER_ID: order.customer_id,
      customer: customer || {
        CUS_ID: order.customer_id,
        FIRST_NAME: "Unknown",
        LAST_NAME: "Customer",
        PHONE: null,
        E_MAIL: null,
      },
      payments: payments || [],
      items: itemsResult.rows || [],
    });
  } catch (err) {
    console.error("❌ Order error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/orders", async (req, res) => {
  console.log("📝 Creating new order...");
  
  const {
    CUSTOMER_ID,
    order_no,
    items,
    DISCOUNT, discount,
    PAYMENT_METHOD, payment_method,
    STATUS, status,
  } = req.body;

  const orderItems = Array.isArray(items) ? items : [];
  const orderDiscount = Number(DISCOUNT ?? discount ?? 0);
  const orderPaymentMethod = PAYMENT_METHOD || payment_method || "Cash";
  const orderStatus = STATUS || status || "Pending";

  if (!CUSTOMER_ID) {
    return res.status(400).json({ error: "CUSTOMER_ID is required" });
  }
  if (orderItems.length === 0) {
    return res.status(400).json({ error: "At least one order item is required" });
  }

  const numericCustomerId = parseInt(String(CUSTOMER_ID).replace(/[^0-9]/g, ""), 10);
  if (isNaN(numericCustomerId)) {
    return res.status(400).json({ error: "Invalid CUSTOMER_ID" });
  }

  console.log(`👤 Customer ID: ${CUSTOMER_ID} (numeric: ${numericCustomerId})`);
  console.log(`📦 Items: ${orderItems.length}`);

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const subtotal = orderItems.reduce(
      (sum, it) => sum + (Number(it.qty) * Number(it.unit_price) - Number(it.discount || 0)),
      0
    );
    const total = Math.max(0, subtotal - orderDiscount);
    const generatedOrderNo = order_no || `ORD-${Date.now()}`;

    const orderResult = await client.query(
      `INSERT INTO tbl_orders (order_no, order_date, amount_us, status, paymentmethod, customer_id)
       VALUES ($1, NOW(), $2, $3, $4, $5)
       RETURNING or_id, order_no, order_date, amount_us, status, paymentmethod, customer_id`,
      [generatedOrderNo, total, orderStatus, orderPaymentMethod, numericCustomerId]
    );
    const order = orderResult.rows[0];
    console.log(`✅ Order created with ID: ${order.or_id}`);

    for (const item of orderItems) {
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const itemDiscount = Number(item.discount) || 0;
      const itemSubtotal = qty * unitPrice - itemDiscount;
      const productIdText = String(item.product_id || "").trim();

      if (!productIdText || productIdText === "null" || productIdText === "undefined" || productIdText === "") {
        console.warn("⚠️ Skipping item with invalid product ID");
        continue;
      }

      let numericProductId;
      
      if (productIdText.startsWith('PROD')) {
        const productResult = await client.query(
          `SELECT id FROM tbl_products WHERE product_id = $1 AND status = 'Active'`,
          [productIdText]
        );
        if (productResult.rows.length > 0) {
          numericProductId = productResult.rows[0].id;
        }
      } else {
        numericProductId = parseInt(productIdText, 10);
        if (!isNaN(numericProductId)) {
          const productResult = await client.query(
            `SELECT id FROM tbl_products WHERE id = $1 AND status = 'Active'`,
            [numericProductId]
          );
          if (productResult.rows.length === 0) {
            numericProductId = null;
          }
        }
      }

      if (!numericProductId) {
        console.warn(`⚠️ Product ${productIdText} not found, skipping item`);
        continue;
      }

      console.log(`📦 Product ${productIdText} -> numeric ID: ${numericProductId}`);

      await client.query(
        `INSERT INTO tbl_orders_details (or_id, product_id, qty_order, qty_bonus, price, discount, subtotal)
         VALUES ($1, $2, $3, 0, $4, $5, $6)`,
        [order.or_id, numericProductId, qty, unitPrice, itemDiscount, itemSubtotal]
      );

      await client.query(
        `UPDATE tbl_stock s
         SET qtyinstock = qtyinstock - $1,
             qtyavailable = qtyavailable - $1
         WHERE s.productid = $2`,
        [qty, numericProductId]
      );
    }

    const customerResult = await client.query(
      `SELECT first_name, last_name FROM tbl_customers WHERE id = $1`,
      [numericCustomerId]
    );
    const customerName = customerResult.rows[0] 
      ? `${customerResult.rows[0].first_name || ''} ${customerResult.rows[0].last_name || ''}`.trim() 
      : 'Unknown';

    await client.query("COMMIT");
    logActivity(req.body.user_id || 1, "Created order", "tbl_orders", order.or_id);

    console.log(`✅ Order ${generatedOrderNo} completed successfully`);

    res.status(201).json({
      order_id: order.or_id,
      order_no: order.order_no,
      order: {
        id: order.or_id,
        order_no: order.order_no,
        date: order.order_date,
        subtotal,
        discount: orderDiscount,
        total,
        status: order.status,
        payment_method: order.paymentmethod,
        customer_id: order.customer_id,
        customer_name: customerName,
        items: orderItems.map(item => ({
          product_id: item.product_id,
          qty: Number(item.qty),
          unit_price: Number(item.unit_price),
          discount: Number(item.discount || 0),
          subtotal: Number(item.qty) * Number(item.unit_price) - Number(item.discount || 0)
        })),
      },
      message: "Order created successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Create order error:", err.message);
    res.status(500).json({ error: err.message || "Failed to create order" });
  } finally {
    client.release();
  }
});

app.delete("/api/orders/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`🗑️ Deleting order: ${id}`);
  
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) {
    return res.status(400).json({ error: "Invalid order ID format" });
  }
  
  try {
    const result = await db.query(`DELETE FROM tbl_orders WHERE or_id = $1`, [numericId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    logActivity(req.body.user_id || 1, "Deleted order", "tbl_orders", id);
    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ Delete order error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ COMPLETE SUPPLIERS - WORKING VERSION
// ============================================

app.get("/api/suppliers", async (req, res) => {
  const { search } = req.query;
  console.log("🔍 GET /api/suppliers - search:", search);

  let sql = "SELECT * FROM tbl_suppliers WHERE status = 'Active'";
  const params = [];

  if (search) {
    sql += ` AND (company ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR phone ILIKE $1 OR e_mail ILIKE $1)`;
    params.push(`%${search}%`);
  }

  sql += " ORDER BY company";

  try {
    const result = await db.query(sql, params);
    
    const suppliers = result.rows.map(row => ({
      SUP_ID: row.sup_id,
      SUP_NAME: row.company,
      CONTACT_PERSON: [row.first_name, row.last_name].filter(Boolean).join(' '),
      PHONE: row.phone,
      EMAIL: row.e_mail,
      ADDRESS: row.address,
      STATUS: row.status,
      WEBSITE: row.website,
      TAX_ID: row.tax_id,
      NOTES: row.notes
    }));
    
    console.log(`📋 Suppliers found: ${suppliers.length}`);
    res.json(suppliers);
  } catch (err) {
    console.error("❌ Suppliers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/suppliers/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`🔍 GET /api/suppliers/${id}`);
  
  try {
    const result = await db.query(`SELECT * FROM tbl_suppliers WHERE sup_id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    
    const row = result.rows[0];
    res.json({
      SUP_ID: row.sup_id,
      SUP_NAME: row.company,
      CONTACT_PERSON: [row.first_name, row.last_name].filter(Boolean).join(' '),
      PHONE: row.phone,
      EMAIL: row.e_mail,
      ADDRESS: row.address,
      STATUS: row.status,
      WEBSITE: row.website,
      TAX_ID: row.tax_id,
      NOTES: row.notes
    });
  } catch (err) {
    console.error("❌ Supplier error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/suppliers", async (req, res) => {
  console.log("📝 POST /api/suppliers");
  console.log("📦 Received Body:", JSON.stringify(req.body, null, 2));
  
  const { 
    SUP_NAME, 
    CONTACT_PERSON, 
    PHONE, 
    EMAIL, 
    ADDRESS, 
    WEBSITE,
    STATUS,
    TAX_ID,
    NOTES
  } = req.body;

  console.log("📦 SUP_NAME:", SUP_NAME);
  console.log("📦 CONTACT_PERSON:", CONTACT_PERSON);

  if (!SUP_NAME || SUP_NAME.trim() === '') {
    console.log("❌ Validation failed: SUP_NAME is empty");
    return res.status(400).json({ 
      error: "Supplier name is required",
      received: req.body 
    });
  }

  let firstName = '';
  let lastName = '';
  if (CONTACT_PERSON) {
    const parts = CONTACT_PERSON.trim().split(' ');
    if (parts.length > 1) {
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    } else {
      firstName = parts[0];
      lastName = '';
    }
  }

  try {
    const maxIdResult = await db.query("SELECT MAX(sup_id) as maxId FROM tbl_suppliers");
    let nextNumber = 1;
    if (maxIdResult.rows[0]?.maxid) {
      const numPart = parseInt(maxIdResult.rows[0].maxid.replace(/[^0-9]/g, ""));
      if (!isNaN(numPart)) nextNumber = numPart + 1;
    }
    const newSupId = `SUP${String(nextNumber).padStart(3, "0")}`;
    console.log(`📦 Generated ID: ${newSupId}`);

    const result = await db.query(
      `INSERT INTO tbl_suppliers 
       (sup_id, company, first_name, last_name, phone, e_mail, address, status, website, tax_id, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING sup_id`,
      [
        newSupId, 
        SUP_NAME.trim(),
        firstName || null,
        lastName || null,
        PHONE || null,
        EMAIL || null,
        ADDRESS || null,
        STATUS || 'Active',
        WEBSITE || null,
        TAX_ID || null,
        NOTES || null
      ]
    );

    console.log(`✅ Supplier created with ID: ${newSupId}`);
    logActivity(req.body.user_id || 1, "Created supplier", "tbl_suppliers", newSupId);
    
    res.json({ 
      SUP_ID: newSupId, 
      message: "Supplier created successfully" 
    });
    
  } catch (err) {
    console.error("❌ Create supplier error:", err.message);
    res.status(500).json({ 
      error: err.message,
      details: "Failed to create supplier in database"
    });
  }
});

app.put("/api/suppliers/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`📝 PUT /api/suppliers/${id}`);
  console.log("📦 Body:", JSON.stringify(req.body, null, 2));
  
  const { 
    SUP_NAME, 
    CONTACT_PERSON, 
    PHONE, 
    EMAIL, 
    ADDRESS, 
    WEBSITE,
    STATUS,
    TAX_ID,
    NOTES
  } = req.body;

  if (!SUP_NAME || SUP_NAME.trim() === '') {
    return res.status(400).json({ error: "Supplier name is required" });
  }

  let firstName = '';
  let lastName = '';
  if (CONTACT_PERSON) {
    const parts = CONTACT_PERSON.trim().split(' ');
    if (parts.length > 1) {
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    } else {
      firstName = parts[0];
      lastName = '';
    }
  }

  try {
    const result = await db.query(
      `UPDATE tbl_suppliers 
       SET company = $1, 
           first_name = $2, 
           last_name = $3, 
           phone = $4, 
           e_mail = $5, 
           address = $6, 
           status = $7, 
           website = $8, 
           tax_id = $9, 
           notes = $10
       WHERE sup_id = $11`,
      [
        SUP_NAME.trim(),
        firstName || null,
        lastName || null,
        PHONE || null,
        EMAIL || null,
        ADDRESS || null,
        STATUS || 'Active',
        WEBSITE || null,
        TAX_ID || null,
        NOTES || null,
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    console.log(`✅ Supplier updated: ${id}`);
    logActivity(req.body.user_id || 1, "Updated supplier", "tbl_suppliers", id);
    res.json({ message: "Supplier updated successfully" });
    
  } catch (err) {
    console.error("❌ Update supplier error:", err.message);
    res.status(500).json({ 
      error: err.message,
      details: "Failed to update supplier in database"
    });
  }
});

app.delete("/api/suppliers/bulk", async (req, res) => {
  const { ids } = req.body;
  console.log(`🗑️ Bulk delete - IDs:`, ids);
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No supplier IDs provided" });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await db.query(
      `UPDATE tbl_suppliers SET status = 'Inactive' WHERE sup_id IN (${placeholders})`,
      ids
    );

    logActivity(req.body.user_id || 1, "Bulk deleted suppliers", "tbl_suppliers", ids.join(','));
    res.json({ 
      message: `${result.rowCount} suppliers deleted successfully`,
      deleted: result.rowCount
    });
  } catch (err) {
    console.error("❌ Bulk delete error:", err.message);
    res.status(500).json({ 
      error: err.message,
      details: "Failed to bulk delete suppliers"
    });
  }
});

app.delete("/api/suppliers/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`🗑️ DELETE /api/suppliers/${id}`);
  
  try {
    const result = await db.query(
      `UPDATE tbl_suppliers SET status = 'Inactive' WHERE sup_id = $1 RETURNING sup_id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    logActivity(req.body.user_id || 1, "Deleted supplier", "tbl_suppliers", id);
    res.json({ message: "Supplier deleted successfully" });
  } catch (err) {
    console.error("❌ Delete supplier error:", err.message);
    res.status(500).json({ 
      error: err.message,
      details: "Failed to delete supplier from database"
    });
  }
});

// ============================================
// STOCK MANAGEMENT
// ============================================
app.get("/api/stock", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, p.product_id as product_code, p.name_en, p.name_kh, p.qty_alert, p.saleout_price
      FROM tbl_stock s
      LEFT JOIN tbl_products p ON s.productid = p.id
    `);
    console.log(`📊 Stock records found: ${result.rows.length}`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Stock error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stock/product/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`📊 Checking stock for product ID: ${id}`);

  if (!id || id === "null" || id === "undefined") {
    return res.json({ ProductID: id, QtyInStock: 0, QtyReserved: 0, QtyAvailable: 0, PRODUCT_NAME: "Unknown" });
  }

  try {
    const productResult = await db.query(
      `SELECT id, product_id, name_en FROM tbl_products WHERE product_id = $1`,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.json({ ProductID: id, QtyInStock: 0, QtyReserved: 0, QtyAvailable: 0, PRODUCT_NAME: "Unknown" });
    }

    const product = productResult.rows[0];
    const numericProductId = product.id;

    const stockResult = await db.query(
      `SELECT * FROM tbl_stock WHERE productid = $1`,
      [numericProductId]
    );

    if (stockResult.rows.length === 0) {
      await db.query(
        `INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, qtyreserved) VALUES ($1, 0, 0, 0)`,
        [numericProductId]
      );
      return res.json({ ProductID: id, QtyInStock: 0, QtyReserved: 0, QtyAvailable: 0, PRODUCT_NAME: product.name_en || "Unknown" });
    }

    const stock = stockResult.rows[0];
    res.json({
      ProductID: id,
      StockID: stock.stockid,
      QtyInStock: stock.qtyinstock || 0,
      QtyReserved: stock.qtyreserved || 0,
      QtyAvailable: stock.qtyavailable || 0,
      LastUpdated: stock.lastupdated || null,
      PRODUCT_NAME: product.name_en || "Unknown",
    });
  } catch (err) {
    console.error("❌ Stock check error:", err.message);
    res.json({ ProductID: id, QtyInStock: 0, QtyReserved: 0, QtyAvailable: 0, PRODUCT_NAME: "Unknown" });
  }
});

app.get("/api/stock/low-stock", async (req, res) => {
  console.log("📊 Fetching low stock products...");

  try {
    const result = await db.query(
      `SELECT p.product_id, p.name_en, p.name_kh, s.qtyavailable, p.qty_alert, p.saleout_price
       FROM tbl_stock s
       LEFT JOIN tbl_products p ON s.productid = p.id
       WHERE s.qtyavailable <= p.qty_alert AND p.status = 'Active'
       ORDER BY s.qtyavailable ASC`
    );

    console.log(`📊 Low stock products found: ${result.rows.length}`);
    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Low stock error:", err.message);
    res.status(500).json([]);
  }
});

// ============================================
// PURCHASE
// ============================================
app.post("/api/purchase", async (req, res) => {
  const { CUSTOMER_ID, items, DISCOUNT = 0, STATUS = "Pending", EMP_PREPARE = 1, NOTES = "" } = req.body;

  console.log("📦 Processing purchase order...");

  if (!CUSTOMER_ID) {
    return res.status(400).json({ error: "Customer ID is required" });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: "At least one item is required" });
  }

  try {
    const customerResult = await db.query(
      "SELECT id, cus_id FROM tbl_customers WHERE cus_id = $1",
      [CUSTOMER_ID]
    );

    if (customerResult.rows.length === 0) {
      return res.status(400).json({ error: `Customer with ID ${CUSTOMER_ID} not found` });
    }

    const customer = customerResult.rows[0];
    const numericCustomerId = customer.id;

    let totalAmount = 0;
    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.unit_price) || 0;
      const discount = Number(item.discount) || 0;
      totalAmount += qty * price - discount;
    });

    const discountAmount = Number(DISCOUNT) || 0;
    totalAmount = Math.max(0, totalAmount - discountAmount);

    const orderNo = `PO-${Date.now()}`;

    const orderResult = await db.query(
      `INSERT INTO tbl_orders (order_no, customer_id, order_date, amount_us, status, emp_prepare, discount, notes)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7) RETURNING or_id`,
      [orderNo, numericCustomerId, totalAmount, STATUS || "Pending", EMP_PREPARE || 1, discountAmount, NOTES || ""]
    );

    const orderId = orderResult.rows[0].or_id;
    console.log(`✅ Order created: ${orderNo} (ID: ${orderId})`);

    for (const item of items) {
      const productIdText = String(item.product_id || "");
      const qty = Number(item.qty) || 0;
      const price = Number(item.unit_price) || 0;
      const discount = Number(item.discount) || 0;
      const subtotal = qty * price - discount;

      if (!productIdText || productIdText === "null" || productIdText === "undefined" || productIdText === "") {
        console.warn("⚠️ Skipping item with invalid product ID");
        continue;
      }

      const productResult = await db.query(
        "SELECT id FROM tbl_products WHERE product_id = $1",
        [productIdText]
      );

      if (productResult.rows.length === 0) {
        console.warn(`⚠️ Product ${productIdText} not found`);
        continue;
      }

      const numericProductId = productResult.rows[0].id;

      await db.query(
        `INSERT INTO tbl_orders_details (or_id, product_id, qty_order, price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, numericProductId, qty, price, subtotal]
      );

      await db.query(
        `UPDATE tbl_stock SET qtyavailable = qtyavailable - $1, qtyinstock = qtyinstock - $1
         WHERE productid = $2`,
        [qty, numericProductId]
      );
    }

    res.json({
      success: true,
      order_no: orderNo,
      order_id: orderId,
      message: "Order created successfully",
      order: {
        order_no: orderNo,
        order_id: orderId,
        customer_id: CUSTOMER_ID,
        amount: totalAmount,
        status: STATUS || "Pending",
      },
    });
  } catch (err) {
    console.error("❌ Purchase error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// REPORTS API
// ============================================
app.get("/api/reports/customers", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM tbl_customers WHERE status = 'Active' ORDER BY first_name, last_name"
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Customer report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/products", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, product_id, name_en, name_kh, saleout_price as price, status
       FROM tbl_products WHERE status = 'Active' ORDER BY name_en`
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Product report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/orders", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT order_no, order_date, amount_us as total_amount, status FROM tbl_orders ORDER BY order_date DESC`
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Order report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/stock", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.stockid, s.productid, p.product_id as product_code, p.name_en as product_name,
             s.qtyinstock as in_stock, s.qtyavailable as available, s.qtyreserved as reserved, s.lastupdated
      FROM tbl_stock s LEFT JOIN tbl_products p ON s.productid = p.id ORDER BY p.name_en
    `);
    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Stock report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/sales", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT order_no, order_date, amount_us as amount, status
       FROM tbl_orders ORDER BY order_date DESC`
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Sales report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/inventory", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.product_id, p.name_en as product_name, s.qtyinstock, s.qtyavailable, s.qtyreserved, p.saleout_price as price
      FROM tbl_stock s LEFT JOIN tbl_products p ON s.productid = p.id ORDER BY p.name_en
    `);
    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Inventory report error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/monthlySales", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT EXTRACT(YEAR FROM order_date) as year, EXTRACT(MONTH FROM order_date) as month,
             SUM(amount_us) as total, COUNT(*) as orders
      FROM tbl_orders
      GROUP BY EXTRACT(YEAR FROM order_date), EXTRACT(MONTH FROM order_date)
      ORDER BY EXTRACT(YEAR FROM order_date) ASC, EXTRACT(MONTH FROM order_date) ASC
    `);
    
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatted = result.rows.map(r => ({
      month: `${MONTH_NAMES[(parseInt(r.month) || 1) - 1]} ${parseInt(r.year)}`,
      revenue: parseFloat(r.total) || 0,
      orders: parseInt(r.orders) || 0
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Monthly sales error:", err.message);
    res.status(500).json([]);
  }
});

app.get("/api/reports/productPerformance", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  try {
    const result = await db.query(`
      SELECT p.name_en as name,
             SUM(od.qty_order) as sales,
             SUM(od.qty_order * od.price) as revenue
      FROM tbl_orders_details od
      INNER JOIN tbl_products p ON od.product_id = p.id
      GROUP BY p.name_en
      ORDER BY SUM(od.qty_order) DESC
      LIMIT $1
    `, [limit]);
    
    const formatted = result.rows.map(r => ({
      name: r.name || "Unknown",
      sales: parseFloat(r.sales) || 0,
      revenue: parseFloat(r.revenue) || 0
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Product performance error:", err.message);
    res.status(500).json([]);
  }
});

app.get("/api/reports/customerAnalytics", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  try {
    const result = await db.query(`
      SELECT c.cus_id as id,
             CONCAT(c.first_name, ' ', c.last_name) as name,
             COUNT(o.or_id) as orders,
             COALESCE(SUM(o.amount_us), 0) as totalSpent
      FROM tbl_customers c
      LEFT JOIN tbl_orders o ON c.id = o.customer_id
      GROUP BY c.cus_id, c.first_name, c.last_name
      ORDER BY COALESCE(SUM(o.amount_us), 0) DESC
      LIMIT $1
    `, [limit]);
    
    const formatted = result.rows.map(r => ({
      id: r.id || "Unknown",
      name: (r.name || "Unknown").trim(),
      orders: parseInt(r.orders) || 0,
      totalSpent: parseFloat(r.totalSpent) || 0,
      avgOrder: parseInt(r.orders) > 0 ? parseFloat(r.totalSpent) / parseInt(r.orders) : 0
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Customer analytics error:", err.message);
    res.status(500).json([]);
  }
});

app.get("/api/reports/revenueSummary", async (req, res) => {
  try {
    const currentResult = await db.query(
      `SELECT COALESCE(SUM(amount_us), 0) as revenue, COUNT(*) as orders 
       FROM tbl_orders WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'`
    );
    
    const previousResult = await db.query(
      `SELECT COALESCE(SUM(amount_us), 0) as revenue, COUNT(*) as orders 
       FROM tbl_orders WHERE order_date >= CURRENT_DATE - INTERVAL '60 days' 
       AND order_date < CURRENT_DATE - INTERVAL '30 days'`
    );
    
    const customersResult = await db.query("SELECT COUNT(*) as count FROM tbl_customers");
    const productsResult = await db.query("SELECT COUNT(*) as count FROM tbl_products WHERE status = 'Active'");

    const currentRevenue = parseFloat(currentResult.rows[0]?.revenue || 0);
    const currentOrders = parseInt(currentResult.rows[0]?.orders || 0);
    const previousRevenue = parseFloat(previousResult.rows[0]?.revenue || 0);
    const previousOrders = parseInt(previousResult.rows[0]?.orders || 0);
    const totalCustomers = parseInt(customersResult.rows[0]?.count || 0);
    const totalProducts = parseInt(productsResult.rows[0]?.count || 0);

    res.json({
      totalRevenue: currentRevenue,
      totalOrders: currentOrders,
      totalCustomers: totalCustomers,
      totalProducts: totalProducts,
      avgOrderValue: currentOrders > 0 ? currentRevenue / currentOrders : 0,
      revenueGrowth: previousRevenue ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) : 0,
      orderGrowth: previousOrders ? Math.round(((currentOrders - previousOrders) / previousOrders) * 100) : 0
    });
  } catch (err) {
    console.error("❌ Revenue summary error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ANALYTICS API
// ============================================
function getStartDateForRange(range) {
  const d = new Date();
  switch (range) {
    case "last30days": d.setDate(d.getDate() - 30); break;
    case "last90days": d.setDate(d.getDate() - 90); break;
    case "last12months": d.setMonth(d.getMonth() - 12); break;
    default: d.setMonth(d.getMonth() - 6); break;
  }
  return d.toISOString().slice(0, 10);
}

app.get("/api/analytics/monthly-revenue", async (req, res) => {
  const { range = "last6months" } = req.query;
  const startDate = getStartDateForRange(range);

  try {
    const result = await db.query(`
      SELECT EXTRACT(YEAR FROM order_date) as year, EXTRACT(MONTH FROM order_date) as month,
             SUM(amount_us) as revenue, COUNT(*) as orders
      FROM tbl_orders WHERE order_date >= $1
      GROUP BY EXTRACT(YEAR FROM order_date), EXTRACT(MONTH FROM order_date)
      ORDER BY EXTRACT(YEAR FROM order_date) ASC, EXTRACT(MONTH FROM order_date) ASC
    `, [startDate]);

    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatted = result.rows.map((row) => ({
      month: `${MONTH_NAMES[(parseInt(row.month) || 1) - 1]} ${parseInt(row.year)}`,
      revenue: parseFloat(row.revenue) || 0,
      orders: parseInt(row.orders) || 0,
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Monthly revenue error:", err.message);
    res.json([]);
  }
});

// ✅ ONLY ONE CUSTOMERS ROUTE - KEPT ABOVE ✅

app.get("/api/analytics/top-products", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  try {
    const result = await db.query(`
      SELECT p.name_en as product_name,
             SUM(od.qty_order) as total_sold,
             SUM(od.qty_order * od.price) as revenue
      FROM tbl_orders_details od
      LEFT JOIN tbl_products p ON od.product_id = p.id
      GROUP BY p.name_en
      ORDER BY SUM(od.qty_order) DESC
      LIMIT $1
    `, [limit]);

    const formatted = result.rows.map((r) => ({
      product_name: r.product_name || "Unknown",
      total_sold: parseFloat(r.total_sold) || 0,
      revenue: parseFloat(r.revenue) || 0,
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Top products error:", err.message);
    res.json([]);
  }
});

app.get("/api/analytics/customer-history/:id", async (req, res) => {
  const customerId = parseInt(req.params.id, 10);
  if (!Number.isFinite(customerId)) {
    return res.status(400).json({ message: "Invalid customer id" });
  }

  try {
    const result = await db.query(`
      SELECT order_no, order_date, amount_us as amount, status
      FROM tbl_orders WHERE customer_id = $1
      ORDER BY order_date DESC
    `, [customerId]);

    const formatted = result.rows.map((r) => ({
      ORDER_NO: r.order_no,
      ORDER_DATE: r.order_date,
      amount: parseFloat(r.amount) || 0,
      STATUS: r.status || "Pending",
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Customer history error:", err.message);
    res.status(500).json([]);
  }
});

app.get("/api/analytics/yearly-revenue", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT EXTRACT(YEAR FROM order_date) as year,
             SUM(amount_us) as revenue, COUNT(*) as orders
      FROM tbl_orders
      GROUP BY EXTRACT(YEAR FROM order_date)
      ORDER BY EXTRACT(YEAR FROM order_date) ASC
    `);

    const formatted = result.rows.map((r) => ({
      year: String(parseInt(r.year)),
      revenue: parseFloat(r.revenue) || 0,
      orders: parseInt(r.orders) || 0,
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Yearly revenue error:", err.message);
    res.json([]);
  }
});

app.get("/api/analytics/summary", async (req, res) => {
  try {
    const currentResult = await db.query(`
      SELECT COALESCE(SUM(amount_us), 0) as revenue, COUNT(*) as orders
      FROM tbl_orders
      WHERE EXTRACT(MONTH FROM order_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);

    const previousResult = await db.query(`
      SELECT COALESCE(SUM(amount_us), 0) as revenue, COUNT(*) as orders
      FROM tbl_orders
      WHERE EXTRACT(MONTH FROM order_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
      AND EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
    `);

    const productsResult = await db.query("SELECT COUNT(*) as count FROM tbl_products WHERE status = 'Active'");

    const currentRevenue = parseFloat(currentResult.rows[0]?.revenue || 0);
    const currentOrders = parseInt(currentResult.rows[0]?.orders || 0);
    const previousRevenue = parseFloat(previousResult.rows[0]?.revenue || 0);
    const previousOrders = parseInt(previousResult.rows[0]?.orders || 0);
    const totalProducts = parseInt(productsResult.rows[0]?.count || 0);

    res.json({
      totalRevenue: currentRevenue,
      totalOrders: currentOrders,
      totalProducts: totalProducts,
      averageOrderValue: currentOrders > 0 ? currentRevenue / currentOrders : 0,
      revenueGrowth: previousRevenue ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) : 0,
      orderGrowth: previousOrders ? Math.round(((currentOrders - previousOrders) / previousOrders) * 100) : 0,
    });
  } catch (err) {
    console.error("❌ Analytics summary error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ COMPLETE FIXED: USER MANAGEMENT
// ============================================

app.get("/api/users", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT userid, username, fullname, role, status, createdat, email, phone 
       FROM tbl_users 
       ORDER BY userid`
    );
    
    if (result.rows.length === 0) {
      return res.json([]);
    }
    
    const mappedUsers = result.rows.map((user) => ({
      user_id: user.userid,
      username: user.username || "",
      fullname: user.fullname || "",
      role: user.role || "Cashier",
      role_id: user.role === "Admin" ? 1 : user.role === "Cashier" ? 2 : 3,
      status: user.status || "ACTIVE",
      email: user.email || "",
      phone: user.phone || "",
      created_at: user.createdat || null,
      last_login: user.lastlogin || null,
    }));
    res.json(mappedUsers);
  } catch (err) {
    console.error("❌ Users error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT userid, username, fullname, role, status, createdat, email, phone 
       FROM tbl_users 
       WHERE userid = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const user = result.rows[0];
    res.json({
      user_id: user.userid,
      username: user.username || "",
      fullname: user.fullname || "",
      role: user.role || "Cashier",
      role_id: user.role === "Admin" ? 1 : user.role === "Cashier" ? 2 : 3,
      status: user.status || "ACTIVE",
      email: user.email || "",
      phone: user.phone || "",
      created_at: user.createdat || null,
    });
  } catch (err) {
    console.error("❌ User error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users", async (req, res) => {
  console.log("📝 POST /api/users - Body:", req.body);
  
  const { 
    username, 
    password, 
    fullname, 
    role_id,
    email,
    phone,
    status
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const roleMap = { 1: "Admin", 2: "Cashier", 3: "Viewer" };
  const role = roleMap[String(role_id)] || "Cashier";
  const userStatus = status || "ACTIVE";

  try {
    const existingResult = await db.query(
      "SELECT userid FROM tbl_users WHERE username = $1",
      [username]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const result = await db.query(
      `INSERT INTO tbl_users 
       (username, password, fullname, role, status, email, phone) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING userid`,
      [
        username, 
        password, 
        fullname || username, 
        role, 
        userStatus,
        email || null,
        phone || null
      ]
    );

    const userId = result.rows[0].userid;
    logActivity(req.body.user_id || 1, "Created user", "tbl_users", userId);
    res.json({ 
      user_id: userId, 
      message: "User created successfully" 
    });
  } catch (err) {
    console.error("❌ Create user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  console.log("📝 PUT /api/users/:id - Body:", req.body);
  
  const { 
    username, 
    password, 
    fullname, 
    role_id,
    email,
    phone,
    status
  } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  const roleMap = { 1: "Admin", 2: "Cashier", 3: "Viewer" };
  const role = roleMap[String(role_id)] || "Cashier";
  const userStatus = status || "ACTIVE";

  try {
    const existingResult = await db.query(
      "SELECT userid FROM tbl_users WHERE username = $1 AND userid != $2",
      [username, id]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    let query = `UPDATE tbl_users 
                 SET username = $1, 
                     fullname = $2, 
                     role = $3, 
                     status = $4, 
                     email = $5, 
                     phone = $6`;
    const params = [username, fullname || username, role, userStatus, email || null, phone || null];

    if (password && password.trim() !== "") {
      query += `, password = $7`;
      params.push(password);
      query += ` WHERE userid = $${params.length + 1}`;
    } else {
      query += ` WHERE userid = $${params.length + 1}`;
    }
    params.push(id);

    const result = await db.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    logActivity(req.body.user_id || 1, "Updated user", "tbl_users", id);
    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error("❌ Update user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  const { id } = req.params;

  if (id == 1) {
    return res.status(400).json({ error: "Cannot delete the main admin user" });
  }

  try {
    const result = await db.query(
      "DELETE FROM tbl_users WHERE userid = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    logActivity(req.body.user_id || 1, "Deleted user", "tbl_users", id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("❌ Delete user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/bulk", async (req, res) => {
  const { ids } = req.body;
  console.log("🗑️ Bulk delete - IDs:", ids);
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No user IDs provided" });
  }

  if (ids.includes(1)) {
    return res.status(400).json({ error: "Cannot delete the main admin user" });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await db.query(
      `DELETE FROM tbl_users WHERE userid IN (${placeholders})`,
      ids
    );

    logActivity(req.body.user_id || 1, "Bulk deleted users", "tbl_users", ids.join(','));
    res.json({ 
      message: `${result.rowCount} users deleted successfully`,
      deleted: result.rowCount
    });
  } catch (err) {
    console.error("❌ Bulk delete error:", err.message);
    res.status(500).json({ 
      error: err.message,
      details: "Failed to bulk delete users"
    });
  }
});

// ============================================
// ✅ WARRANTY & SERVICES API
// ============================================

app.get("/api/warranties", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT w.*, 
             CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             p.name_en as product_name
      FROM tbl_warranty w
      LEFT JOIN tbl_customers c ON c.id = w.customerid
      LEFT JOIN tbl_products p ON p.id = w.productid
      ORDER BY w.warrantyid DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Warranties error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/warranties/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(`
      SELECT w.*, 
             CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             p.name_en as product_name
      FROM tbl_warranty w
      LEFT JOIN tbl_customers c ON c.id = w.customerid
      LEFT JOIN tbl_products p ON p.id = w.productid
      WHERE w.warrantyid = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Warranty not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Warranty error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/warranties", async (req, res) => {
  console.log("📝 POST /api/warranties - Body:", req.body);
  
  const { 
    CustomerID, 
    ProductID, 
    SerialNumber, 
    WarrantyPeriod, 
    WarrantyStartDate,
    WarrantyEndDate,
    Status,
    notes
  } = req.body;

  if (!CustomerID || !ProductID) {
    return res.status(400).json({ error: "Customer ID and Product ID are required" });
  }

  try {
    const startDate = WarrantyStartDate || new Date().toISOString().split('T')[0];
    let endDate = WarrantyEndDate;
    if (!endDate && WarrantyPeriod) {
      const start = new Date(startDate);
      endDate = new Date(start);
      endDate.setMonth(endDate.getMonth() + Number(WarrantyPeriod));
      endDate = endDate.toISOString().split('T')[0];
    }

    const result = await db.query(
      `INSERT INTO tbl_warranty 
       (customerid, productid, serialnumber, warrantyperiod, warrantystartdate, warrantyenddate, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING warrantyid`,
      [
        CustomerID, 
        ProductID, 
        SerialNumber || null, 
        Number(WarrantyPeriod) || 12, 
        startDate, 
        endDate || null,
        Status || 'Active',
        notes || null
      ]
    );

    logActivity(req.body.user_id || 1, "Created warranty", "tbl_warranty", result.rows[0].warrantyid);
    res.json({ 
      WarrantyID: result.rows[0].warrantyid, 
      message: "Warranty created successfully" 
    });
  } catch (err) {
    console.error("❌ Create warranty error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/warranties/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`📝 PUT /api/warranties/${id} - Body:`, req.body);
  
  const { 
    CustomerID, 
    ProductID, 
    SerialNumber, 
    WarrantyPeriod, 
    WarrantyStartDate,
    WarrantyEndDate,
    Status,
    notes
  } = req.body;

  try {
    let endDate = WarrantyEndDate;
    if (!endDate && WarrantyPeriod && WarrantyStartDate) {
      const start = new Date(WarrantyStartDate);
      endDate = new Date(start);
      endDate.setMonth(endDate.getMonth() + Number(WarrantyPeriod));
      endDate = endDate.toISOString().split('T')[0];
    }

    const result = await db.query(
      `UPDATE tbl_warranty 
       SET customerid = $1, 
           productid = $2, 
           serialnumber = $3, 
           warrantyperiod = $4, 
           warrantystartdate = $5, 
           warrantyenddate = $6, 
           status = $7,
           notes = $8
       WHERE warrantyid = $9`,
      [
        CustomerID, 
        ProductID, 
        SerialNumber || null, 
        Number(WarrantyPeriod) || 12, 
        WarrantyStartDate || null,
        endDate || null,
        Status || 'Active',
        notes || null,
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Warranty not found" });
    }

    logActivity(req.body.user_id || 1, "Updated warranty", "tbl_warranty", id);
    res.json({ message: "Warranty updated successfully" });
  } catch (err) {
    console.error("❌ Update warranty error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/warranties/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`🗑️ DELETE /api/warranties/${id}`);
  
  try {
    const result = await db.query(
      `UPDATE tbl_warranty SET status = 'Inactive' WHERE warrantyid = $1 RETURNING warrantyid`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Warranty not found" });
    }

    logActivity(req.body.user_id || 1, "Deleted warranty", "tbl_warranty", id);
    res.json({ message: "Warranty deleted successfully" });
  } catch (err) {
    console.error("❌ Delete warranty error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/warranties/bulk", async (req, res) => {
  const { ids } = req.body;
  console.log(`🗑️ Bulk delete warranties - IDs:`, ids);
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No warranty IDs provided" });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await db.query(
      `UPDATE tbl_warranty SET status = 'Inactive' WHERE warrantyid IN (${placeholders})`,
      ids
    );

    logActivity(req.body.user_id || 1, "Bulk deleted warranties", "tbl_warranty", ids.join(','));
    res.json({ 
      message: `${result.rowCount} warranties deleted successfully`,
      deleted: result.rowCount
    });
  } catch (err) {
    console.error("❌ Bulk delete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SERVICE ROUTES
// ============================================

app.get("/api/services", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, 
             CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             p.name_en as product_name
      FROM tbl_service_requests s
      LEFT JOIN tbl_customers c ON c.id = s.customerid
      LEFT JOIN tbl_products p ON p.id = s.productid
      ORDER BY s.serviceid DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Services error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/services/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(`
      SELECT s.*, 
             CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             p.name_en as product_name
      FROM tbl_service_requests s
      LEFT JOIN tbl_customers c ON c.id = s.customerid
      LEFT JOIN tbl_products p ON p.id = s.productid
      WHERE s.serviceid = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Service error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/services", async (req, res) => {
  console.log("📝 POST /api/services - Body:", req.body);
  
  const { 
    CustomerID, 
    ProductID, 
    SerialNumber, 
    IssueDescription, 
    ServiceType, 
    Status,
    ReceivedDate,
    notes
  } = req.body;

  if (!CustomerID || !ProductID) {
    return res.status(400).json({ error: "Customer ID and Product ID are required" });
  }

  try {
    const serviceNo = `SRV-${Date.now()}`;
    const receivedDate = ReceivedDate || new Date().toISOString().split('T')[0];

    const result = await db.query(
      `INSERT INTO tbl_service_requests 
       (serviceno, customerid, productid, serialnumber, issuedescription, servicetype, status, receiveddate, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING serviceid`,
      [
        serviceNo,
        CustomerID, 
        ProductID, 
        SerialNumber || null, 
        IssueDescription || null, 
        ServiceType || 'Repair',
        Status || 'Pending',
        receivedDate,
        notes || null
      ]
    );

    logActivity(req.body.user_id || 1, "Created service", "tbl_service_requests", result.rows[0].serviceid);
    res.json({ 
      ServiceID: result.rows[0].serviceid, 
      message: "Service created successfully" 
    });
  } catch (err) {
    console.error("❌ Create service error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/services/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`📝 PUT /api/services/${id} - Body:`, req.body);
  
  const { 
    CustomerID, 
    ProductID, 
    SerialNumber, 
    IssueDescription, 
    ServiceType, 
    Status,
    ReceivedDate,
    notes
  } = req.body;

  try {
    const result = await db.query(
      `UPDATE tbl_service_requests 
       SET customerid = $1, 
           productid = $2, 
           serialnumber = $3, 
           issuedescription = $4, 
           servicetype = $5, 
           status = $6,
           receiveddate = $7,
           notes = $8
       WHERE serviceid = $9`,
      [
        CustomerID, 
        ProductID, 
        SerialNumber || null, 
        IssueDescription || null, 
        ServiceType || 'Repair',
        Status || 'Pending',
        ReceivedDate || null,
        notes || null,
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Service not found" });
    }

    logActivity(req.body.user_id || 1, "Updated service", "tbl_service_requests", id);
    res.json({ message: "Service updated successfully" });
  } catch (err) {
    console.error("❌ Update service error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/services/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`🗑️ DELETE /api/services/${id}`);
  
  try {
    const result = await db.query(
      `DELETE FROM tbl_service_requests WHERE serviceid = $1 RETURNING serviceid`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Service not found" });
    }

    logActivity(req.body.user_id || 1, "Deleted service", "tbl_service_requests", id);
    res.json({ message: "Service deleted successfully" });
  } catch (err) {
    console.error("❌ Delete service error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/services/bulk", async (req, res) => {
  const { ids } = req.body;
  console.log(`🗑️ Bulk delete services - IDs:`, ids);
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No service IDs provided" });
  }

  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await db.query(
      `DELETE FROM tbl_service_requests WHERE serviceid IN (${placeholders})`,
      ids
    );

    logActivity(req.body.user_id || 1, "Bulk deleted services", "tbl_service_requests", ids.join(','));
    res.json({ 
      message: `${result.rowCount} services deleted successfully`,
      deleted: result.rowCount
    });
  } catch (err) {
    console.error("❌ Bulk delete error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

console.log("✅ Warranty & Service routes loaded!");

// ============================================
// PAYMENT API
// ============================================
app.post("/api/payments/create-payment-intent", async (req, res) => {
  res.json({ clientSecret: "mock_secret_" + Date.now(), message: "Payment intent created (mock)" });
});

app.post("/api/payments/record", async (req, res) => {
  const { OR_ID, AMOUNT_US, AMOUNT_KH } = req.body;

  try {
    await db.query(
      `INSERT INTO tbl_payment (or_id, amount_us, amount_kh, pay_date, status)
       VALUES ($1, $2, $3, CURRENT_DATE, 'COMPLETED')`,
      [Number(OR_ID), AMOUNT_US || 0, AMOUNT_KH || 0]
    );
    res.json({ message: "Payment recorded" });
  } catch (err) {
    console.error("❌ Payment record error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// TEST
// ============================================
app.get("/api/test", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW() as test");
    res.json({ success: true, result: result.rows[0] });
  } catch (err) {
    console.error("❌ Test error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROOT ENDPOINT
// ============================================
app.get("/", (req, res) => {
  res.json({
    message: "SPMS Backend API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      auth: "/api/auth/login",
      customers: "/api/customers",
      products: "/api/products",
      orders: "/api/orders",
      suppliers: "/api/suppliers",
      users: "/api/users",
      analytics: "/api/analytics",
      reports: "/api/reports",
      test: "/api/test",
      dbTest: "/api/db-test"
    }
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.url} not found`,
    path: req.url,
    method: req.method
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    status: err.status || 500,
    path: req.url
  });
});

// ============================================
// START SERVER
// ============================================
async function startServer() {
  console.log("🔄 Initializing database connection...");

  try {
    const testResult = await db.query('SELECT NOW() as current_time');
    console.log('✅ Database connection established!');
    console.log(`📊 Connected to PostgreSQL at: ${testResult.rows[0].current_time}`);

    app.listen(PORT, () => {
      console.log("🚀 SPMS Backend running on http://localhost:" + PORT);
      console.log("📊 Test API: http://localhost:" + PORT + "/api/test");
      console.log("📁 Connected to PostgreSQL database successfully!");
      console.log("");
      console.log("📋 Available Endpoints:");
      console.log("  🔐 Auth:          POST /api/auth/login");
      console.log("  👥 Customers:     GET/POST/PUT/DELETE /api/customers");
      console.log("  📦 Products:      GET/POST/PUT/DELETE /api/products");
      console.log("  🛒 Orders:        GET/POST/DELETE /api/orders");
      console.log("  🛒 Pending:       GET /api/orders/pending");
      console.log("  📊 Low Stock:     GET /api/stock/low-stock");
      console.log("  📋 Suppliers:     GET/POST/PUT/DELETE /api/suppliers");
      console.log("  💳 Purchase:      POST /api/purchase");
      console.log("  📋 Reports:       GET /api/reports/*");
      console.log("  👤 Users:         GET/POST/PUT/DELETE /api/users");
      console.log("  📊 Analytics:     GET /api/analytics/*");
    });
  } catch (err) {
    console.error("❌ Server startup error:", err.message);
    
    app.listen(PORT, () => {
      console.log("🚀 SPMS Backend running on http://localhost:" + PORT);
      console.log("⚠️ Database connection failed, some features may not work");
    });
  }
}

startServer();

// ============================================
// EXPORT for Vercel (Serverless)
// ============================================
module.exports = app;