// ============================================
// ✅ app.js - COMPLETE WORKING VERSION
// WITH SUPER ADMIN & MULTI-TENANT SUPPORT
// INCLUDES HEALTH CHECK FOR RENDER
// ============================================

require("dotenv").config();

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const compression = require("compression");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const crypto = require("crypto");
const ExcelJS = require("exceljs");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// ============================================
// IMPORT ROUTES
// ============================================
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const customerRoutes = require('./routes/customers');
const supplierRoutes = require('./routes/suppliers');
const userRoutes = require('./routes/users');
const stockRoutes = require('./routes/stock');
const tenantRoutes = require('./routes/tenants');
const categoryRoutes = require('./routes/categories');
// ============================================
// GLOBAL CRASH GUARDS
// ============================================
process.on("unhandledRejection", (reason) => {
  console.error("🧯 Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("🧯 Uncaught Exception:", err);
});

// ============================================
// DATABASE & SERVICES
// ============================================
const db = require("./config/postgres");
const { sendOrderConfirmation } = require("./services/emailService");
const { generateInvoice } = require("./services/invoiceService");
const logger = require("./utils/logger");
const { checkEnv } = require("./config/env");

// ============================================
// MIDDLEWARE
// ============================================
const {
  generalLimiter,
  authLimiter,
  apiLimiter,
} = require("./middleware/rateLimit");
const { authenticate, authorize } = require("./middleware/auth");
const {
  validate,
  productValidations,
  customerValidations,
  orderValidations,
  userValidations,
  supplierValidations,
} = require("./middleware/validate");
const { cacheMiddleware } = require("./middleware/cache");

// ============================================
// CHECK ENVIRONMENT
// ============================================
checkEnv();

// ============================================
// CREATE EXPRESS APP
// ============================================
const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

// ============================================
// DEBUG LOGGING (DEV ONLY)
// ============================================
if (!isProd) {
  app.use((req, res, next) => {
    console.log("📤 Incoming request:");
    console.log("  Method:", req.method);
    console.log("  URL:", req.url);
    console.log(
      "  Authorization:",
      req.headers.authorization ? "present" : "none",
    );
    next();
  });
}

// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = [
  "https://spms-chh-sn-pro.vercel.app",
  "https://spms-chh-sn-new.vercel.app",
  "https://spms-chh-sn.vercel.app",
  "https://chheangsamnangs-projects.vercel.app",
  "https://spms-chh-sn-git-main-chheangsamnangs-projects.vercel.app",
  "https://spms-chh-sn.onrender.com",
  /\.vercel\.app$/,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5000",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some((allowed) => {
      if (typeof allowed === "string") return allowed === origin;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return false;
    });
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log("❌ CORS blocked origin:", origin);
      callback(null, false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "X-Requested-With",
    'x-tenant-id',
    'x-tenant-subdomain',
    'X-Tenant-Id',
    'X-Tenant-Subdomain',
  ],
};

app.use(cors(corsOptions));
app.use(compression());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// ============================================
// LOGGING
// ============================================
app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }),
);

console.log("📊 Using PostgreSQL Database");
console.log("✅ CORS allowed origins:", allowedOrigins);

// ============================================
// RATE LIMITING
// ============================================
app.use("/api", generalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/reports", apiLimiter);
app.use("/api/analytics", apiLimiter);
app.use("/api/export", apiLimiter);

// ============================================
// PROTECT ALL API ROUTES (except auth)
// ============================================
app.use("/api/customers", authenticate);
app.use("/api/products", authenticate);
app.use("/api/orders", authenticate);
app.use("/api/users", authenticate);
app.use("/api/suppliers", authenticate);
app.use("/api/stock", authenticate);
app.use("/api/reports", authenticate);
app.use("/api/analytics", authenticate);
app.use("/api/warranties", authenticate);
app.use("/api/services", authenticate);
app.use("/api/activity-logs", authenticate);

// ============================================
// ACTIVITY LOG - MEMORY STORAGE & FUNCTIONS
// ============================================
let activityLogs = [];
const MAX_LOGS = 1000;

const logUserActivity = (
  userId,
  action,
  tableName,
  recordId = null,
  details = null,
) => {
  try {
    const logEntry = {
      log_id: Date.now() + Math.random() * 1000,
      user_id: userId || 1,
      username: "Unknown",
      action: action,
      table_name: tableName || "unknown",
      record_id: recordId,
      details: details,
      action_date: new Date().toISOString(),
    };
    activityLogs.unshift(logEntry);
    if (activityLogs.length > MAX_LOGS) {
      activityLogs = activityLogs.slice(0, MAX_LOGS);
    }
    console.log(`📝 [LOG] User ${userId}: ${action} on ${tableName}`);
    return logEntry;
  } catch (err) {
    console.warn("⚠️ Activity log error:", err.message);
    return null;
  }
};
// ============================================
// SIMPLE TEST ROUTE - NO AUTH REQUIRED
// ============================================
app.get('/test', (req, res) => {
  res.json({ 
    message: '✅ Test route is working!',
    timestamp: new Date().toISOString()
  });
});

app.post('/test', (req, res) => {
  res.json({ 
    message: '✅ POST test is working!',
    data: req.body,
    timestamp: new Date().toISOString()
  });
});
// ============================================
// ACTIVITY LOGS ROUTES
// ============================================
app.get("/api/activity-logs", async (req, res) => {
  const { limit = 200 } = req.query;
  console.log(`📋 Fetching activity logs (limit: ${limit})`);

  try {
    let logs = activityLogs.slice(0, Number(limit));

    try {
      const result = await db.query("SELECT userid, username FROM tbl_users");
      const users = result.rows || [];
      const userMap = {};
      users.forEach((u) => {
        userMap[u.userid] = u.username;
      });
      logs.forEach((log) => {
        log.username = userMap[log.user_id] || "Unknown";
      });
    } catch (err) {
      console.warn("⚠️ Could not fetch users for activity logs:", err.message);
    }

    console.log(`📋 Returning ${logs.length} logs`);
    res.json(logs);
  } catch (err) {
    console.error("❌ Activity logs error:", err.message);
    const logs = activityLogs.slice(0, Number(limit));
    res.json(logs);
  }
});

app.post("/api/activity-logs", (req, res) => {
  const { user_id, action, table_name, record_id, details } = req.body;

  if (!user_id || !action) {
    return res.status(400).json({
      error: "user_id and action are required",
    });
  }

  const log = logUserActivity(user_id, action, table_name, record_id, details);
  res.status(201).json({
    success: true,
    data: log,
  });
});

app.delete("/api/activity-logs", (req, res) => {
  activityLogs = [];
  res.json({
    success: true,
    message: "Activity logs cleared",
  });
});

// ============================================
// HEALTH CHECK - RENDER REQUIRED
// ============================================
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.status(200).json({
      status: "OK",
      message: "Server is healthy",
      database: "Connected",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: "1.0.1"
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Database connection failed",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// ROOT ENDPOINT
// ============================================
app.get("/", (req, res) => {
  res.json({
    message: "SPMS Backend API",
    version: "1.0.1",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "GET /health",
      test: "GET /api/test",
      auth: {
        login: "POST /api/auth/login",
        register: "POST /api/auth/register",
        me: "GET /api/auth/me",
      },
      subscription: "POST /api/create-checkout-session",
      customers: "GET/POST/PUT/DELETE /api/customers",
      products: "GET/POST/PUT/DELETE /api/products",
      orders: "GET/POST/DELETE /api/orders",
      suppliers: "GET/POST/PUT/DELETE /api/suppliers",
      users: "GET/POST/PUT/DELETE /api/users",
      analytics: "GET /api/analytics/*",
      reports: "GET /api/reports/*",
      stock: "GET/POST/PUT/DELETE /api/stock",
      warranties: "GET/POST/PUT/DELETE /api/warranties",
      services: "GET/POST/PUT/DELETE /api/services",
      tenants: "GET/POST/PUT/DELETE /api/tenants",
      systemStats: "GET /api/tenants/system/stats", // <-- Updated this to show correct path
      payment: {
        khqr: "GET /api/payment/khqr",
        status: "GET /api/payment/status/:sessionId",
        confirm: "POST /api/payment/confirm",
      },
    },
  });
});

// ============================================
// TEST ENDPOINTS
// ============================================
app.get("/api/test", (req, res) => {
  res.json({
    message: "✅ API is working!",
    time: new Date().toISOString(),
    status: "ok",
    version: "1.0.1"
  });
});

app.get("/api/db-test", async (req, res) => {
  try {
    console.log("🔍 Testing database connection...");
    const result = await db.query(
      "SELECT NOW() as time, current_database() as db",
    );
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
      tables: tables.rows.map((r) => r.table_name),
      message: "Database connection successful!",
    });
  } catch (err) {
    console.error("❌ Database test error:", err.message);
    res.status(500).json({
      success: false,
      connected: false,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

// ============================================
// AUTHENTICATION - LOGIN (WITH SUPER ADMIN)
// ============================================
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  console.log("🔑 Login attempt:", username);

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    const result = await db.query(
      `SELECT u.userid, u.username, u.password, u.fullname, u.role, u.status, u.email,
              u.is_super_admin, u.tenant_id,
              t.id as tenant_id, t.name as tenant_name, t.subdomain
       FROM tbl_users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE LOWER(u.username) = LOWER($1) AND u.status = 'ACTIVE'`,
      [username],
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
    logUserActivity(user.userid, "Login", "tbl_users", user.userid);

    const token = jwt.sign(
      {
        userId: user.userid,
        username: user.username,
        role: user.role || "Admin",
        tenantId: user.is_super_admin ? null : user.tenant_id,
        isSuperAdmin: user.is_super_admin || false,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    // Build user response
    const userResponse = {
      user_id: user.userid,
      username: user.username,
      email: user.email || `${username}@example.com`,
      role: user.role || "Admin",
      role_name: user.role || "Admin",
      status: user.status,
      fullname: user.fullname || user.username,
      isSuperAdmin: user.is_super_admin || false,
    };

    if (user.is_super_admin) {
      userResponse.tenant = null;
      userResponse.accessLevel = "all";
    } else if (user.tenant_id) {
      userResponse.tenant = {
        id: user.tenant_id,
        name: user.tenant_name,
        subdomain: user.subdomain,
      };
      userResponse.accessLevel = "tenant";
    }

    res.json({
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ============================================
// AUTHENTICATION - REGISTER
// ============================================
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password, firstName, lastName, companyName } =
    req.body;

  if (
    !username ||
    !email ||
    !password ||
    !firstName ||
    !lastName ||
    !companyName
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }

  try {
    const existingUser = await db.query(
      `SELECT userid FROM tbl_users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)`,
      [username, email],
    );
    if (existingUser.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Username or email already exists" });
    }

    const fullName = `${firstName} ${lastName}`;
    const result = await db.query(
      `INSERT INTO tbl_users (username, password, fullname, role, status, email) 
       VALUES ($1, $2, $3, 'Admin', 'ACTIVE', $4) 
       RETURNING userid, username, role`,
      [username, password, fullName, email],
    );

    const user = result.rows[0];
    logUserActivity(user.userid, "Registered", "tbl_users", user.userid);

    res.status(201).json({
      message: "Account created successfully",
      user: {
        user_id: user.userid,
        username: user.username,
        role: user.role,
        fullname: fullName,
        email: email,
      },
    });
  } catch (err) {
    console.error("❌ Registration error:", err.message);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// ============================================
// AUTHENTICATION - GET CURRENT USER
// ============================================
app.get("/api/auth/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    );
    const result = await db.query(
      `SELECT u.userid, u.username, u.fullname, u.role, u.status, u.email,
              u.is_super_admin, u.tenant_id,
              t.name as tenant_name, t.subdomain
       FROM tbl_users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.userid = $1`,
      [decoded.userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Auth me error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// STRIPE CHECKOUT SESSION
// ============================================
app.post("/api/create-checkout-session", async (req, res) => {
  console.log("📝 Creating checkout session...");

  try {
    const { plan, customerEmail, customerName } = req.body;

    if (!plan) {
      console.log("❌ Missing plan");
      return res.status(400).json({ error: "Plan is required" });
    }

    const plans = {
      "market-stall": {
        price: 0,
        name: "Market Stall",
        description: "One counter, kept honest",
      },
      shophouse: {
        price: 1900,
        name: "Shophouse",
        description: "Most Cambodian SMEs start here",
      },
      chain: {
        price: 4900,
        name: "Chain",
        description: "For multi-branch operators",
      },
    };

    const selectedPlan = plans[plan];
    if (!selectedPlan) {
      console.log("❌ Invalid plan:", plan);
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    if (selectedPlan.price === 0) {
      console.log("✅ Free plan selected");
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      return res.json({
        url: `${frontendUrl}/register`,
        free: true,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      managed_payments: { enabled: true },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `SPMS ${selectedPlan.name} Plan`,
              description: selectedPlan.description,
              tax_code: "txcd_99999999",
            },
            unit_amount: selectedPlan.price,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/pricing`,
      customer_email: customerEmail || undefined,
      metadata: {
        plan: plan,
        customer_name: customerName || "",
      },
    });

    console.log("✅ Stripe session created:", session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe error:", error.message);
    res.status(500).json({
      error: "Failed to create checkout session",
      message: error.message,
    });
  }
});

// ============================================
// ✅ CUSTOMERS CRUD (WITH TENANT FILTERING)
// ============================================
app.get("/api/customers", authenticate, async (req, res) => {
  const { search } = req.query;
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  let sql = "SELECT * FROM tbl_customers WHERE status = 'Active'";
  const params = [];

  if (!isSuperAdmin && tenantId) {
    sql += " AND tenant_id = $1";
    params.push(tenantId);
    let paramIndex = 2;
    if (search) {
      sql += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR e_mail ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }
  } else if (search) {
    sql += ` AND (first_name ILIKE $1 OR last_name ILIKE $1 OR phone ILIKE $1 OR e_mail ILIKE $1)`;
    params.push(`%${search}%`);
  }

  sql += " ORDER BY first_name ASC";

  try {
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Customers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/customers/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM tbl_customers WHERE cus_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/customers",
  authenticate,
  validate(customerValidations.create),
  async (req, res) => {
    const {
      FIRST_NAME,
      LAST_NAME,
      PHONE,
      E_MAIL,
      ADDRESS,
      BALANCE,
      IMAGE_URL,
    } = req.body;

    if (!FIRST_NAME || !LAST_NAME) {
      return res
        .status(400)
        .json({ error: "First name and last name are required" });
    }

    try {
      const maxIdResult = await db.query(
        "SELECT MAX(cus_id) as maxId FROM tbl_customers",
      );
      let nextNumber = 1;
      if (maxIdResult.rows[0]?.maxid) {
        const numPart = parseInt(
          maxIdResult.rows[0].maxid.replace(/[^0-9]/g, ""),
        );
        if (!isNaN(numPart)) nextNumber = numPart + 1;
      }
      const newCusId = `CUS${String(nextNumber).padStart(3, "0")}`;

      const result = await db.query(
        `INSERT INTO tbl_customers (cus_id, first_name, last_name, phone, e_mail, address, balance, status, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8) RETURNING cus_id`,
        [
          newCusId,
          FIRST_NAME,
          LAST_NAME,
          PHONE || null,
          E_MAIL || null,
          ADDRESS || null,
          BALANCE || 0,
          IMAGE_URL || null,
        ],
      );

      logUserActivity(
        req.body.user_id || 1,
        "Created customer",
        "tbl_customers",
        newCusId,
      );
      res.json({
        cus_id: newCusId,
        message: "Customer created successfully",
      });
    } catch (err) {
      console.error("❌ Create customer error:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

app.put(
  "/api/customers/:id",
  authenticate,
  validate(customerValidations.update),
  async (req, res) => {
    const { id } = req.params;
    const {
      FIRST_NAME,
      LAST_NAME,
      PHONE,
      E_MAIL,
      ADDRESS,
      BALANCE,
      STATUS,
      IMAGE_URL,
    } = req.body;

    try {
      const result = await db.query(
        `UPDATE tbl_customers 
       SET first_name = $1, last_name = $2, phone = $3, e_mail = $4, 
           address = $5, balance = $6, status = $7, image_url = $8
       WHERE cus_id = $9`,
        [
          FIRST_NAME,
          LAST_NAME,
          PHONE,
          E_MAIL,
          ADDRESS,
          BALANCE || 0,
          STATUS || "Active",
          IMAGE_URL || null,
          id,
        ],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Customer not found" });
      }

      logUserActivity(
        req.body.user_id || 1,
        "Updated customer",
        "tbl_customers",
        id,
      );
      res.json({ message: "Customer updated successfully" });
    } catch (err) {
      console.error("❌ Update customer error:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

app.delete("/api/customers/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `UPDATE tbl_customers SET status = 'Inactive' WHERE cus_id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    logUserActivity(
      req.body.user_id || 1,
      "Deleted customer",
      "tbl_customers",
      id,
    );
    res.json({ message: "Customer deleted successfully" });
  } catch (err) {
    console.error("❌ Delete customer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ PRODUCTS CRUD (WITH TENANT FILTERING)
// ============================================
app.get(
  "/api/products",
  authenticate,
  cacheMiddleware(300),
  async (req, res) => {
    const { search } = req.query;
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    
    const isSuperAdmin = decoded.isSuperAdmin || false;
    const tenantId = decoded.tenantId;

    let sql = "SELECT * FROM tbl_products WHERE status = 'Active'";
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += " AND tenant_id = $1";
      params.push(tenantId);
      let paramIndex = 2;
      if (search) {
        sql += ` AND (name_en ILIKE $${paramIndex} OR name_kh ILIKE $${paramIndex} OR barcode ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
      }
    } else if (search) {
      sql += ` AND (name_en ILIKE $1 OR name_kh ILIKE $1 OR barcode ILIKE $1)`;
      params.push(`%${search}%`);
    }

    try {
      const result = await db.query(sql, params);
      res.json(result.rows);
    } catch (err) {
      console.error("❌ Products error:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

app.get("/api/products/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT * FROM tbl_products WHERE product_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Product error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/products",
  authenticate,
  validate(productValidations.create),
  async (req, res) => {
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
      IMAGE_URL,
    } = req.body;

    if (!NAME_EN || NAME_EN.trim() === "") {
      return res
        .status(400)
        .json({ error: "Product English name is required" });
    }

    if (!NAME_KH || NAME_KH.trim() === "") {
      return res.status(400).json({ error: "Product Khmer name is required" });
    }

    try {
      const maxIdResult = await db.query(
        "SELECT MAX(product_id) as maxId FROM tbl_products",
      );
      let nextNumber = 1;
      if (
        maxIdResult.rows &&
        maxIdResult.rows.length > 0 &&
        maxIdResult.rows[0]?.maxid
      ) {
        const currentId = maxIdResult.rows[0].maxid;
        const numPart = parseInt(String(currentId).replace(/[^0-9]/g, ""));
        if (!isNaN(numPart)) nextNumber = numPart + 1;
      }
      const newProductId = `PROD${String(nextNumber).padStart(3, "0")}`;

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
          IMAGE_URL || null,
        ],
      );

      const productId = result.rows[0].id;
      const qtyInStock = parseInt(QTY_INSTOCK) || 0;
      if (qtyInStock > 0) {
        await db.query(
          `INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, qtyreserved) 
           VALUES ($1, $2, $3, $4)`,
          [productId, qtyInStock, qtyInStock, 0],
        );
      }

      res.json({
        product_id: newProductId,
        id: productId,
        message: "Product created successfully",
        image_saved: !!IMAGE_URL,
      });
    } catch (err) {
      console.error("❌ Create product error:", err.message);
      res.status(500).json({
        error: err.message || "Failed to create product",
        success: false,
      });
    }
  },
);

app.put(
  "/api/products/:id",
  authenticate,
  validate(productValidations.update),
  async (req, res) => {
    const { id } = req.params;

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

    if (!NAME_EN || NAME_EN.trim() === "") {
      return res
        .status(400)
        .json({ error: "Product English name is required" });
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
          STATUS || "Active",
          IMAGE_URL || null,
          id,
        ],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Product not found" });
      }

      logUserActivity(
        req.body.user_id || 1,
        "Updated product",
        "tbl_products",
        id,
      );
      res.json({
        message: "Product updated successfully",
        product_id: id,
        image_updated: !!IMAGE_URL,
      });
    } catch (err) {
      console.error("❌ Update product error:", err.message);
      res.status(500).json({
        error: err.message || "Failed to update product",
      });
    }
  },
);

app.delete("/api/products/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `UPDATE tbl_products SET status = 'Inactive' WHERE product_id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    logUserActivity(
      req.body.user_id || 1,
      "Deleted product",
      "tbl_products",
      id,
    );
    res.json({
      message: "Product deleted successfully",
      product_id: id,
    });
  } catch (err) {
    console.error("❌ Delete product error:", err.message);
    res.status(500).json({
      error: err.message || "Failed to delete product",
    });
  }
});

// ============================================
// ✅ ORDERS CRUD (WITH TENANT FILTERING)
// ============================================
app.get("/api/orders", authenticate, async (req, res) => {
  const { limit = 50, status } = req.query;
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

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
  let whereClause = [];

  if (!isSuperAdmin && tenantId) {
    whereClause.push(`o.tenant_id = $${params.length + 1}`);
    params.push(tenantId);
  }

  if (status) {
    whereClause.push(`o.status = $${params.length + 1}`);
    params.push(status);
  }

  if (whereClause.length > 0) {
    sql += ` WHERE ${whereClause.join(' AND ')}`;
  }

  sql += " ORDER BY o.order_date DESC";

  try {
    const result = await db.query(sql, params);
    const rows = result.rows.slice(0, Number(limit)).map((r) => ({
      id: r.or_id,
      order_no: r.order_no,
      date: r.order_date,
      total: Number(r.amount_us) || 0,
      status: r.status,
      payment_method: r.paymentmethod,
      customer_id: r.customer_id,
      customer_name: r.customer_name || "Unknown",
      item_count: Number(r.item_count) || 0,
    }));
    res.json(rows);
  } catch (err) {
    console.error("❌ Orders error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders/recent", authenticate, async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  try {
    let sql = `
      SELECT o.or_id, o.order_no, o.order_date, o.amount_us, o.status, o.paymentmethod, o.customer_id,
             TRIM(CONCAT(c.first_name, ' ', c.last_name)) AS customer_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.cus_id = CONCAT('CUS', LPAD(o.customer_id::text, 3, '0'))
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += ` WHERE o.tenant_id = $1`;
      params.push(tenantId);
    }

    sql += ` ORDER BY o.order_date DESC LIMIT 10`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Recent orders error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders/pending", authenticate, async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  try {
    let sql = `
      SELECT o.or_id, o.order_no, o.order_date, o.amount_us, o.status, o.paymentmethod, o.customer_id,
             TRIM(CONCAT(c.first_name, ' ', c.last_name)) AS customer_name
      FROM tbl_orders o
      LEFT JOIN tbl_customers c ON c.cus_id = CONCAT('CUS', LPAD(o.customer_id::text, 3, '0'))
      WHERE o.status IN ('Pending', 'Processing')
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += ` AND o.tenant_id = $1`;
      params.push(tenantId);
    }

    sql += ` ORDER BY o.order_date DESC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Pending orders error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) {
    return res.status(400).json({ error: "Invalid order ID format" });
  }

  try {
    const orderResult = await db.query(
      `SELECT or_id, order_no, order_date, amount_us, status, paymentmethod, notes, emp_prepare, customer_id
       FROM tbl_orders WHERE or_id = $1`,
      [numericId],
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
        [`CUS${String(order.customer_id).padStart(3, "0")}`, order.customer_id],
      );
      if (customerResult.rows.length > 0) {
        customer = customerResult.rows[0];
      }
    } catch (err) {
      console.warn("⚠️ Customer error:", err.message);
    }

    const itemsResult = await db.query(
      `SELECT d.id, d.or_id, d.product_id, d.qty_order as qty, d.qty_bonus,
              d.price as unit_price, d.discount, d.subtotal,
              p.name_en as product_name, p.image_url
       FROM tbl_orders_details d
       LEFT JOIN tbl_products p ON p.id = d.product_id
       WHERE d.or_id = $1`,
      [numericId],
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
      items: itemsResult.rows || [],
    });
  } catch (err) {
    console.error("❌ Order error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/orders",
  authenticate,
  validate(orderValidations.create),
  async (req, res) => {
    console.log("📝 Creating new order...");

    const { CUSTOMER_ID, order_no, items, DISCOUNT, PAYMENT_METHOD, STATUS } =
      req.body;

    const orderItems = Array.isArray(items) ? items : [];
    const orderDiscount = Number(DISCOUNT ?? 0);
    const orderPaymentMethod = PAYMENT_METHOD || "Cash";
    const orderStatus = STATUS || "Pending";

    if (!CUSTOMER_ID) {
      return res.status(400).json({ error: "CUSTOMER_ID is required" });
    }
    if (orderItems.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one order item is required" });
    }

    const numericCustomerId = parseInt(
      String(CUSTOMER_ID).replace(/[^0-9]/g, ""),
      10,
    );
    if (isNaN(numericCustomerId)) {
      return res.status(400).json({ error: "Invalid CUSTOMER_ID" });
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const subtotal = orderItems.reduce(
        (sum, it) =>
          sum +
          (Number(it.qty) * Number(it.unit_price) - Number(it.discount || 0)),
        0,
      );
      const total = Math.max(0, subtotal - orderDiscount);
      const generatedOrderNo = order_no || `ORD-${Date.now()}`;

      const orderResult = await client.query(
        `INSERT INTO tbl_orders (order_no, order_date, amount_us, status, paymentmethod, customer_id)
       VALUES ($1, NOW(), $2, $3, $4, $5)
       RETURNING or_id, order_no, order_date, amount_us, status, paymentmethod, customer_id`,
        [
          generatedOrderNo,
          total,
          orderStatus,
          orderPaymentMethod,
          numericCustomerId,
        ],
      );
      const order = orderResult.rows[0];

      for (const item of orderItems) {
        const qty = Number(item.qty) || 0;
        const unitPrice = Number(item.unit_price) || 0;
        const itemDiscount = Number(item.discount) || 0;
        const itemSubtotal = qty * unitPrice - itemDiscount;
        const productIdText = String(item.product_id || "").trim();

        if (
          !productIdText ||
          productIdText === "null" ||
          productIdText === "undefined" ||
          productIdText === ""
        ) {
          console.warn("⚠️ Skipping item with invalid product ID");
          continue;
        }

        let numericProductId;

        if (productIdText.startsWith("PROD")) {
          const productResult = await client.query(
            `SELECT id FROM tbl_products WHERE product_id = $1 AND status = 'Active'`,
            [productIdText],
          );
          if (productResult.rows.length > 0) {
            numericProductId = productResult.rows[0].id;
          }
        } else {
          numericProductId = parseInt(productIdText, 10);
          if (!isNaN(numericProductId)) {
            const productResult = await client.query(
              `SELECT id FROM tbl_products WHERE id = $1 AND status = 'Active'`,
              [numericProductId],
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

        await client.query(
          `INSERT INTO tbl_orders_details (or_id, product_id, qty_order, qty_bonus, price, discount, subtotal)
         VALUES ($1, $2, $3, 0, $4, $5, $6)`,
          [
            order.or_id,
            numericProductId,
            qty,
            unitPrice,
            itemDiscount,
            itemSubtotal,
          ],
        );

        await client.query(
          `UPDATE tbl_stock s
         SET qtyinstock = qtyinstock - $1,
             qtyavailable = qtyavailable - $1
         WHERE s.productid = $2`,
          [qty, numericProductId],
        );
      }

      const customerResult = await client.query(
        `SELECT first_name, last_name, e_mail FROM tbl_customers WHERE id = $1`,
        [numericCustomerId],
      );
      const customerRow = customerResult.rows[0] || null;
      const customerName = customerRow
        ? `${customerRow.first_name || ""} ${customerRow.last_name || ""}`.trim()
        : "Unknown";

      await client.query("COMMIT");
      logUserActivity(
        req.body.user_id || 1,
        "Created order",
        "tbl_orders",
        order.or_id,
      );

      const responseItems = orderItems.map((item) => ({
        product_id: item.product_id,
        qty: Number(item.qty),
        unit_price: Number(item.unit_price),
        discount: Number(item.discount || 0),
        subtotal:
          Number(item.qty) * Number(item.unit_price) -
          Number(item.discount || 0),
      }));

      if (customerRow?.e_mail) {
        try {
          await sendOrderConfirmation(order, customerRow, responseItems);
        } catch (emailErr) {
          console.warn("⚠️ Email not sent:", emailErr.message);
        }
      }

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
          items: responseItems,
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
  },
);

app.delete("/api/orders/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) {
    return res.status(400).json({ error: "Invalid order ID format" });
  }

  try {
    const result = await db.query(`DELETE FROM tbl_orders WHERE or_id = $1`, [
      numericId,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    logUserActivity(req.body.user_id || 1, "Deleted order", "tbl_orders", id);
    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ Delete order error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ SUPPLIERS CRUD (WITH TENANT FILTERING)
// ============================================
app.get("/api/suppliers", authenticate, async (req, res) => {
  const { search } = req.query;
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  let sql = "SELECT * FROM tbl_suppliers WHERE status = 'Active'";
  const params = [];

  if (!isSuperAdmin && tenantId) {
    sql += " AND tenant_id = $1";
    params.push(tenantId);
    let paramIndex = 2;
    if (search) {
      sql += ` AND (company ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR e_mail ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }
  } else if (search) {
    sql += ` AND (company ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR phone ILIKE $1 OR e_mail ILIKE $1)`;
    params.push(`%${search}%`);
  }

  sql += " ORDER BY company";

  try {
    const result = await db.query(sql, params);
    const suppliers = result.rows.map((row) => ({
      SUP_ID: row.sup_id,
      SUP_NAME: row.company,
      CONTACT_PERSON: [row.first_name, row.last_name].filter(Boolean).join(" "),
      PHONE: row.phone,
      EMAIL: row.e_mail,
      ADDRESS: row.address,
      STATUS: row.status,
      WEBSITE: row.website,
      TAX_ID: row.tax_id,
      NOTES: row.notes,
    }));
    res.json(suppliers);
  } catch (err) {
    console.error("❌ Suppliers error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/suppliers",
  authenticate,
  validate(supplierValidations.create),
  async (req, res) => {
    const {
      SUP_NAME,
      CONTACT_PERSON,
      PHONE,
      EMAIL,
      ADDRESS,
      WEBSITE,
      STATUS,
      TAX_ID,
      NOTES,
    } = req.body;

    if (!SUP_NAME || SUP_NAME.trim() === "") {
      return res.status(400).json({ error: "Supplier name is required" });
    }

    let firstName = "";
    let lastName = "";
    if (CONTACT_PERSON) {
      const parts = CONTACT_PERSON.trim().split(" ");
      if (parts.length > 1) {
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
      } else {
        firstName = parts[0];
        lastName = "";
      }
    }

    try {
      const maxIdResult = await db.query(
        "SELECT MAX(sup_id) as maxId FROM tbl_suppliers",
      );
      let nextNumber = 1;
      if (maxIdResult.rows[0]?.maxid) {
        const numPart = parseInt(
          maxIdResult.rows[0].maxid.replace(/[^0-9]/g, ""),
        );
        if (!isNaN(numPart)) nextNumber = numPart + 1;
      }
      const newSupId = `SUP${String(nextNumber).padStart(3, "0")}`;

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
          STATUS || "Active",
          WEBSITE || null,
          TAX_ID || null,
          NOTES || null,
        ],
      );

      logUserActivity(
        req.body.user_id || 1,
        "Created supplier",
        "tbl_suppliers",
        newSupId,
      );
      res.json({
        SUP_ID: newSupId,
        message: "Supplier created successfully",
      });
    } catch (err) {
      console.error("❌ Create supplier error:", err.message);
      res.status(500).json({
        error: err.message,
        details: "Failed to create supplier in database",
      });
    }
  },
);

app.put(
  "/api/suppliers/:id",
  authenticate,
  validate(supplierValidations.update),
  async (req, res) => {
    const { id } = req.params;
    const {
      SUP_NAME,
      CONTACT_PERSON,
      PHONE,
      EMAIL,
      ADDRESS,
      WEBSITE,
      STATUS,
      TAX_ID,
      NOTES,
    } = req.body;

    if (!SUP_NAME || SUP_NAME.trim() === "") {
      return res.status(400).json({ error: "Supplier name is required" });
    }

    let firstName = "";
    let lastName = "";
    if (CONTACT_PERSON) {
      const parts = CONTACT_PERSON.trim().split(" ");
      if (parts.length > 1) {
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
      } else {
        firstName = parts[0];
        lastName = "";
      }
    }

    try {
      const result = await db.query(
        `UPDATE tbl_suppliers 
       SET company = $1, first_name = $2, last_name = $3, phone = $4, 
           e_mail = $5, address = $6, status = $7, website = $8, 
           tax_id = $9, notes = $10
       WHERE sup_id = $11`,
        [
          SUP_NAME.trim(),
          firstName || null,
          lastName || null,
          PHONE || null,
          EMAIL || null,
          ADDRESS || null,
          STATUS || "Active",
          WEBSITE || null,
          TAX_ID || null,
          NOTES || null,
          id,
        ],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Supplier not found" });
      }

      logUserActivity(
        req.body.user_id || 1,
        "Updated supplier",
        "tbl_suppliers",
        id,
      );
      res.json({ message: "Supplier updated successfully" });
    } catch (err) {
      console.error("❌ Update supplier error:", err.message);
      res.status(500).json({
        error: err.message,
        details: "Failed to update supplier in database",
      });
    }
  },
);

app.delete("/api/suppliers/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `UPDATE tbl_suppliers SET status = 'Inactive' WHERE sup_id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    logUserActivity(
      req.body.user_id || 1,
      "Deleted supplier",
      "tbl_suppliers",
      id,
    );
    res.json({ message: "Supplier deleted successfully" });
  } catch (err) {
    console.error("❌ Delete supplier error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ STOCK MANAGEMENT (WITH TENANT FILTERING)
// ============================================
async function resolveProductId(rawId) {
  if (rawId === undefined || rawId === null) return null;
  const asString = String(rawId).trim();

  if (/^\d+$/.test(asString)) {
    return parseInt(asString, 10);
  }

  const lookup = await db.query(
    `SELECT id FROM tbl_products WHERE product_id = $1`,
    [asString],
  );
  return lookup.rows.length > 0 ? lookup.rows[0].id : null;
}

app.get("/api/stock", authenticate, async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  try {
    let sql = `
      SELECT s.*, p.product_id as product_code, p.name_en, p.name_kh, p.qty_alert, p.saleout_price
      FROM tbl_stock s
      LEFT JOIN tbl_products p ON s.productid = p.id
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += ` WHERE p.tenant_id = $1`;
      params.push(tenantId);
    }

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Stock error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stock/low-stock", authenticate, async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  try {
    let sql = `
      SELECT p.product_id, p.name_en, p.name_kh, s.qtyavailable, p.qty_alert, p.saleout_price
      FROM tbl_stock s
      LEFT JOIN tbl_products p ON s.productid = p.id
      WHERE s.qtyavailable <= p.qty_alert AND p.status = 'Active'
    `;
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += ` AND p.tenant_id = $1`;
      params.push(tenantId);
    }

    sql += ` ORDER BY s.qtyavailable ASC`;

    const result = await db.query(sql, params);
    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Low stock error:", err.message);
    res.status(500).json([]);
  }
});

app.post("/api/stock", authenticate, async (req, res) => {
  const { productid, qtyinstock, qtyavailable, qtyreserved, qty_alert } =
    req.body;

  try {
    const productId = await resolveProductId(productid);
    if (!productId) {
      return res.status(404).json({ error: "Product not found" });
    }

    const result = await db.query(
      `INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, qtyreserved, qty_alert, lastupdated)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (productid)
       DO UPDATE SET
         qtyinstock = EXCLUDED.qtyinstock,
         qtyavailable = EXCLUDED.qtyavailable,
         qtyreserved = EXCLUDED.qtyreserved,
         qty_alert = EXCLUDED.qty_alert,
         lastupdated = NOW()
       RETURNING *`,
      [
        productId,
        qtyinstock || 0,
        qtyavailable || 0,
        qtyreserved || 0,
        qty_alert || 10,
      ],
    );
    res.json({ message: "Stock created/updated", stock: result.rows[0] });
  } catch (err) {
    console.error("❌ POST stock error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/stock/:productid", authenticate, async (req, res) => {
  try {
    const { productid } = req.params;
    const body = req.body || {};

    const qtyInStock = body.QtyInStock ?? body.qtyinstock ?? 0;
    const qtyAvailable = body.QtyAvailable ?? body.qtyavailable ?? 0;
    const qtyReserved = body.QtyReserved ?? body.qtyreserved ?? 0;

    const productId = await resolveProductId(productid);
    if (!productId) {
      return res.status(404).json({ error: "Product not found" });
    }

    const check = await db.query(
      "SELECT stockid FROM tbl_stock WHERE productid = $1",
      [productId],
    );

    let result;
    if (check.rows.length > 0) {
      result = await db.query(
        `UPDATE tbl_stock 
         SET qtyinstock = $1, 
             qtyavailable = $2, 
             qtyreserved = $3, 
             lastupdated = NOW()
         WHERE productid = $4
         RETURNING *`,
        [qtyInStock, qtyAvailable, qtyReserved, productId],
      );
    } else {
      result = await db.query(
        `INSERT INTO tbl_stock (productid, qtyinstock, qtyavailable, qtyreserved, lastupdated)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [productId, qtyInStock, qtyAvailable, qtyReserved],
      );
    }

    logUserActivity(
      req.body.user_id || 1,
      "Updated stock",
      "tbl_stock",
      productId,
    );

    res.json({
      success: true,
      message: "Stock updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Update stock error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/stock/:productid", authenticate, async (req, res) => {
  const { productid } = req.params;

  try {
    const productId = await resolveProductId(productid);
    if (!productId) {
      return res.status(404).json({ error: "Product not found" });
    }

    const result = await db.query(
      `DELETE FROM tbl_stock WHERE productid = $1 RETURNING *`,
      [productId],
    );
    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Stock not found for this product" });
    }
    res.json({ message: "Stock deleted", deleted: result.rows[0] });
  } catch (err) {
    console.error("❌ DELETE stock error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ✅ WARRANTY & SERVICES
// ============================================
app.get("/api/warranties", authenticate, async (req, res) => {
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

app.get("/api/services", authenticate, async (req, res) => {
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

// ============================================
// ✅ INVOICE GENERATION
// ============================================
app.get("/api/orders/:id/invoice", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const orderResult = await db.query(
      "SELECT * FROM tbl_orders WHERE or_id = $1",
      [id],
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.rows[0];
    const customerResult = await db.query(
      "SELECT * FROM tbl_customers WHERE id = $1",
      [order.customer_id],
    );
    const customer = customerResult.rows[0];

    const itemsResult = await db.query(
      `
      SELECT od.*, p.name_en as product_name 
      FROM tbl_orders_details od
      LEFT JOIN tbl_products p ON p.id = od.product_id
      WHERE od.or_id = $1
    `,
      [id],
    );

    const filename = generateInvoice(order, customer, itemsResult.rows);
    res.json({
      message: "Invoice generated",
      filename: filename,
      download: `/invoices/${filename}`,
    });
  } catch (error) {
    console.error("❌ Invoice error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ✅ EXCEL EXPORTS (WITH TENANT FILTERING)
// ============================================
app.get("/api/reports/export/products", authenticate, async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  try {
    let sql = "SELECT product_id, name_en, name_kh, saleout_price, status FROM tbl_products WHERE status = 'Active'";
    const params = [];

    if (!isSuperAdmin && tenantId) {
      sql += ` AND tenant_id = $1`;
      params.push(tenantId);
    }

    const result = await db.query(sql, params);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products");
    worksheet.addRow(["ID", "Name (EN)", "Name (KH)", "Price", "Status"]);
    result.rows.forEach((row) => {
      worksheet.addRow([
        row.product_id,
        row.name_en,
        row.name_kh,
        row.saleout_price,
        row.status,
      ]);
    });
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", "attachment; filename=products.xlsx");
    res.send(buffer);
  } catch (error) {
    console.error("❌ Export products error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ✅ KHQR PAYMENT WITH EXPIRY
// ============================================
const paymentSessions = new Map();

app.get("/api/payment/khqr", async (req, res) => {
  const { amount, orderId } = req.query;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Valid amount is required" });
  }
  if (!orderId) {
    return res.status(400).json({ error: "Order ID is required" });
  }

  const sessionId = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + 5 * 60 * 1000;

  const merchantInfo = {
    name: "SAMNANG CHHEANG",
    account: "017530691",
    usdAccount: "017530690",
  };
  const khqrString = `KHQR|${merchantInfo.account}|${amount}|USD|${expiresAt}|${sessionId}`;
  const qrImage = await QRCode.toDataURL(khqrString);

  paymentSessions.set(sessionId, {
    orderId: orderId,
    amount: amount,
    expiresAt: expiresAt,
    createdAt: Date.now(),
    status: "pending",
  });

  setTimeout(
    () => {
      paymentSessions.delete(sessionId);
      console.log(`🗑️ Payment session ${sessionId} expired and cleaned up`);
    },
    5 * 60 * 1000,
  );

  res.json({
    sessionId: sessionId,
    merchantName: merchantInfo.name,
    khqrAccount: merchantInfo.account,
    usdAccount: merchantInfo.usdAccount,
    khqr: qrImage,
    amount: amount,
    orderId: orderId,
    expiresAt: expiresAt,
    expiresIn: 5 * 60,
    instructions:
      "Scan with ABA Mobile, Bakong, or any banking app. QR expires in 5 minutes.",
  });
});

app.get("/api/payment/status/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = paymentSessions.get(sessionId);

  if (!session) {
    return res.json({
      success: false,
      status: "expired",
      message: "Payment session expired or not found",
    });
  }

  if (Date.now() > session.expiresAt) {
    paymentSessions.delete(sessionId);
    return res.json({
      success: false,
      status: "expired",
      message: "QR code has expired. Please generate a new one.",
    });
  }

  res.json({
    success: true,
    status: session.status || "pending",
    orderId: session.orderId,
    amount: session.amount,
    expiresAt: session.expiresAt,
    timeRemaining: Math.max(
      0,
      Math.floor((session.expiresAt - Date.now()) / 1000),
    ),
  });
});

app.post("/api/payment/confirm", (req, res) => {
  const { sessionId } = req.body;
  const session = paymentSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "Session not found",
    });
  }

  if (Date.now() > session.expiresAt) {
    paymentSessions.delete(sessionId);
    return res.status(400).json({
      success: false,
      message: "QR code expired",
    });
  }

  session.status = "paid";
  session.paidAt = Date.now();
  paymentSessions.set(sessionId, session);

  setTimeout(() => {
    paymentSessions.delete(sessionId);
  }, 60 * 1000);

  res.json({
    success: true,
    message: "Payment confirmed successfully!",
    orderId: session.orderId,
  });
});

// ============================================
// REPORTS (WITH TENANT FILTERING)
// ============================================
app.get("/api/reports/:type", authenticate, async (req, res) => {
  const { type } = req.params;
  const { search } = req.query;
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
  
  const isSuperAdmin = decoded.isSuperAdmin || false;
  const tenantId = decoded.tenantId;

  try {
    let data = [];

    if (type === "stock") {
      let sql = `
        SELECT s.*, p.product_id as product_code, p.name_en, p.name_kh
        FROM tbl_stock s
        LEFT JOIN tbl_products p ON s.productid = p.id
      `;
      const params = [];

      if (!isSuperAdmin && tenantId) {
        sql += ` WHERE p.tenant_id = $1`;
        params.push(tenantId);
      }

      const result = await db.query(sql, params);
      data = result.rows;
    } else if (type === "customers") {
      let sql = "SELECT * FROM tbl_customers WHERE status = 'Active'";
      const params = [];

      if (!isSuperAdmin && tenantId) {
        sql += ` AND tenant_id = $1`;
        params.push(tenantId);
      }

      const result = await db.query(sql, params);
      data = result.rows;
    } else {
      return res.status(404).json({ error: `Unknown report type: ${type}` });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: "Database error", message: error.message });
  }
});
// ============================================
// ROUTES - MOUNT ALL ROUTES
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/tenants', tenantRoutes); // <-- REMOVED DUPLICATE LINE HERE (app.use('/api/system', tenantRoutes);)
app.use('/api/categories', categoryRoutes);
// ============================================
// DEBUG ROUTE - Log all requests
// ============================================
app.use((req, res, next) => {
  console.log('📤 Request:', req.method, req.url);
  console.log('📤 Headers:', req.headers);
  next();
});
// ============================================
// 404 HANDLER - MUST BE LAST
// ============================================
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.url} not found`,
    path: req.url,
    method: req.method,
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  logger.error(
    `${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`,
  );
  console.error("❌ Server Error:", err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    status: err.status || 500,
    path: req.url,
  });
});

// ============================================
// START SERVER
// ============================================
async function startServer() {
  console.log("🔄 Initializing database connection...");

  try {
    const testResult = await db.query("SELECT NOW() as current_time");
    console.log("✅ Database connection established!");
    console.log(
      `📊 Connected to PostgreSQL at: ${testResult.rows[0].current_time}`,
    );

    const server = app.listen(PORT, () => {
      console.log(`🚀 SPMS Backend running on http://localhost:${PORT}`);
      console.log(`📊 Test API: http://localhost:${PORT}/api/test`);
      console.log(`💚 Health: http://localhost:${PORT}/health`);
      console.log("📁 Connected to PostgreSQL database successfully!");
      console.log("");
      console.log("📋 Available Endpoints:");
      console.log("  🔐 Auth:          POST /api/auth/login");
      console.log("  🔐 Register:      POST /api/auth/register");
      console.log("  💳 Subscription:  POST /api/create-checkout-session");
      console.log("  👥 Customers:     GET/POST/PUT/DELETE /api/customers");
      console.log("  📦 Products:      GET/POST/PUT/DELETE /api/products");
      console.log("  🛒 Orders:        GET/POST/DELETE /api/orders");
      console.log("  📋 Suppliers:     GET/POST/PUT/DELETE /api/suppliers");
      console.log("  👤 Users:         GET/POST/PUT/DELETE /api/users");
      console.log("  📊 Reports:       GET /api/reports/*");
      console.log("  📊 Analytics:     GET /api/analytics/*");
      console.log("  📊 Stock:         GET/POST/PUT/DELETE /api/stock, /api/stock/low-stock");
      console.log("  📋 Warranties:    GET/POST/PUT/DELETE /api/warranties");
      console.log("  🔧 Services:      GET/POST/PUT/DELETE /api/services");
      console.log("  📱 KHQR:          GET /api/payment/khqr");
      console.log("  📄 Invoice:       GET /api/orders/:id/invoice");
      console.log("  🏢 Tenants:       GET/POST/PUT/DELETE /api/tenants");
      console.log("  📊 System Stats:  GET /api/tenants/system/stats"); // <-- Updated path
      console.log("  💚 Health:        GET /health");
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      process.exit(1);
    });

  } catch (err) {
    console.error("❌ Server startup error:", err.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;