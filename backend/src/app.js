// ============================================
// ✅ app.js - CLEAN MODULAR POSTGRES VERSION
// WITH SUPER ADMIN & MULTI-TENANT SUPPORT
// ============================================

require("dotenv").config();
require("express-async-errors");

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

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
const paymentRoutes = require('./routes/paymentRoutes');
const warrantyRoutes = require('./routes/warranties');
const serviceRoutes = require('./routes/services');
const analyticsRoutes = require('./routes/analytics');
const publicRoutes = require('./routes/public');
const reportRoutes = require('./routes/reports');

// ============================================
// GLOBAL CRASH GUARDS
// ============================================
process.on("unhandledRejection", (reason) => {
  console.error("🧯 Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("🧯 Uncaught Exception:", err);
  process.exit(1);
});

// ============================================
// DATABASE & SERVICES
// ============================================
const db = require("./config/postgres");
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
const { authenticate, getScope, requireSuperAdmin } = require("./middleware/auth");
const { logActivity, activityLoggerMiddleware } = require("./middleware/activityLogger");

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
app.use(helmet());

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
    'x-admin-secret',
  ],
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
// HEALTH CHECK
// ============================================
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.status(200).json({ status: "healthy", db: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: "unhealthy", db: "disconnected", error: err.message, timestamp: new Date().toISOString() });
  }
});

app.get("/api/db-test", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ACTIVITY LOGS (POSTGRES-BACKED)
// ============================================
app.get("/api/activity-logs", authenticate, async (req, res) => {
  const scope = getScope(req, res);
  if (!scope) return;
  const { limit = 50 } = req.query;

  try {
    let query = `SELECT l.*, u.username FROM tbl_activity_logs l LEFT JOIN tbl_users u ON l.user_id = u.userid`;
    const params = [];

    if (!scope.isSuperAdmin) {
      query += ` WHERE l.tenant_id = $1`;
      params.push(scope.tenantId);
    }

    query += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10) || 50);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Activity logs error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/activity-logs", authenticate, requireSuperAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM tbl_activity_logs");
    res.json({ message: "Activity logs cleared successfully" });
  } catch (err) {
    console.error("❌ Clear activity logs error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTES - MOUNT ALL ROUTES
// ============================================
const rolePolicy = require('./middleware/rolePolicy');
app.use('/api', rolePolicy);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/warranties', warrantyRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/reports', reportRoutes);

// System stats route
app.get('/api/system/stats', authenticate, requireSuperAdmin, tenantRoutes.systemStatsHandler);

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
      console.log(`💚 Health: http://localhost:${PORT}/health`);
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

if (require.main === module && process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
