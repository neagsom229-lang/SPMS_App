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
const { isStaffOrAdminRole } = require("./middleware/rolePolicy");

// ============================================
// MIDDLEWARE
// ============================================
const {
  generalLimiter,
  authLimiter,
  apiLimiter,
} = require("./middleware/rateLimit");
const { authenticate, getScope, requireSuperAdmin } = require("./middleware/auth");
const { parsePaging } = require("./utils/paging");

// ============================================
// CHECK ENVIRONMENT
// ============================================
checkEnv();

// ============================================
// CREATE EXPRESS APP
// ============================================
const app = express();
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);
app.use(helmet());

// Request lines are logged once by morgan below. The old dev-only middleware
// printed each request a second time (and in a different format).

// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const devFallbackOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173'];
const effectiveOrigins = allowedOrigins.length > 0
  ? allowedOrigins
  : (process.env.NODE_ENV === 'production' ? [] : devFallbackOrigins);

if (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production') {
  console.warn('[CORS] CORS_ORIGINS not set; using dev fallback origins:', effectiveOrigins.join(', '));
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (effectiveOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn('[CORS] blocked origin:', origin);
    const err = new Error('CORS blocked');
    err.status = 403;
    return callback(err);
  },
  credentials: true,
  // Cache preflight responses so each origin stops sending OPTIONS before
  // every API call.
  maxAge: 86400,
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
const { registerLimiter } = require("./middleware/rateLimit");
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register-client", registerLimiter);
app.use("/api/reports", apiLimiter);
app.use("/api/export", apiLimiter);

// ============================================
// HEALTH CHECKS
// ============================================
// Liveness: process is running; no DB dependency.
app.get("/health/live", (req, res) => {
  res.status(200).json({ status: "live", timestamp: new Date().toISOString() });
});

// Readiness: confirms the backend can reach PostgreSQL with a lightweight check.
app.get("/health/ready", async (req, res) => {
  let timeoutId;
  try {
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("database readiness check timed out")), 3000);
    });
    await Promise.race([db.query("SELECT 1 AS ok"), timeout]);
    res.status(200).json({ status: "ready", db: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error("Readiness check failed", { error: err.message });
    res.status(503).json({ status: "not_ready", db: "disconnected", timestamp: new Date().toISOString() });
  } finally {
    clearTimeout(timeoutId);
  }
});

// Backward-compatible health endpoint (used by existing monitors/render.yaml).
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.status(200).json({ status: "healthy", db: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error("Health check failed", { error: err.message });
    res.status(503).json({ status: "unhealthy", db: "disconnected", timestamp: new Date().toISOString() });
  }
});

// ============================================
// ACTIVITY LOGS (POSTGRES-BACKED)
// ============================================
app.get("/api/activity-logs", authenticate, async (req, res) => {
  if (!isStaffOrAdminRole(req.user)) {
    return res.status(403).json({ error: "Access denied. Admin or Staff privileges required." });
  }
  const scope = getScope(req, res);
  if (!scope) return;
  const { limit } = parsePaging(req, { defaultLimit: 50, maxLimit: 200 });

  try {
    let query = `SELECT l.*, u.username FROM tbl_activity_logs l LEFT JOIN tbl_users u ON l.user_id = u.userid`;
    const params = [];

    if (!scope.isSuperAdmin) {
      query += ` WHERE l.tenant_id = $1`;
      params.push(scope.tenantId);
    }

    query += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Activity logs error:", err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// ROUTES - MOUNT ALL ROUTES
// ============================================
const rolePolicy = require('./middleware/rolePolicy');
app.use('/api', rolePolicy);

const appMountedRoutes = [];
const mountRoute = (prefix, router) => {
  app.use(prefix, router);
  if (router && router.stack) {
    router.stack.forEach(layer => {
      if (layer.route) {
        Object.keys(layer.route.methods).forEach(method => {
          if (layer.route.methods[method]) {
            let fullPath = prefix + (layer.route.path === '/' ? '' : layer.route.path);
            fullPath = fullPath.replace(/\/+/g, '/');
            appMountedRoutes.push({ method: method.toUpperCase(), path: fullPath });
          }
        });
      }
    });
  }
};

mountRoute('/api/auth', authRoutes);
mountRoute('/api/dashboard', dashboardRoutes);
mountRoute('/api/products', productRoutes);
mountRoute('/api/orders', orderRoutes);
mountRoute('/api/customers', customerRoutes);
mountRoute('/api/suppliers', supplierRoutes);
mountRoute('/api/users', userRoutes);
mountRoute('/api/stock', stockRoutes);
mountRoute('/api/tenants', tenantRoutes);
mountRoute('/api/categories', categoryRoutes);
mountRoute('/api/payment', paymentRoutes);
mountRoute('/api/warranties', warrantyRoutes);
mountRoute('/api/services', serviceRoutes);
mountRoute('/api/public', publicRoutes);
mountRoute('/api/reports', reportRoutes);

app.mountedRoutes = appMountedRoutes;
app.mountedRoutes.push({ method: 'GET', path: '/api/activity-logs' });
app.mountedRoutes.push({ method: 'GET', path: '/api/system/stats' });

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
  const status = err.status || 500;
  const isServerError = status >= 500;
  const message = isServerError ? 'Internal Server Error' : (err.message || 'Request failed');

  logger.error(
    `${status} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`,
  );
  if (isServerError) {
    console.error('❌ Server Error:', err.stack);
  }

  res.status(status).json({
    error: message,
    status,
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

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info(`Received ${signal}; starting graceful shutdown`);
      server.close(async () => {
        try {
          await db.end();
          logger.info('Database pool closed');
        } catch (e) {
          logger.error('Error closing database pool during shutdown', { error: e.message });
        } finally {
          process.exit(0);
        }
      });
      setTimeout(() => {
        logger.error('Graceful shutdown timed out; forcing exit');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error("❌ Server startup error:", err.message);
    if (err.code === "ECONNREFUSED") {
      console.error("   Start the PostgreSQL service: services.msc -> postgresql-x64-18");
    } else if (err.code === "28P01" || err.code === "28000") {
      console.error("   PostgreSQL rejected the credentials. Fix DATABASE_URL (the value is never printed).");
    } else if (err.code === "3D000") {
      console.error("   The database does not exist. Run database/local/001_app_role.sql once as postgres.");
    }
    process.exit(1);
  }
}

if (require.main === module && (process.env.NODE_ENV !== 'test' || process.env.START_SERVER === 'true')) {
  startServer();
}

module.exports = app;
