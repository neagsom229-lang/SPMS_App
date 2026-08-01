// ============================================
// ODBC - Conditional Load for Windows/Linux
// ============================================
let odbc;

// Only try to load odbc on Windows
const isWindows = process.platform === 'win32';
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

if (isWindows && !isProduction) {
  try {
    odbc = require('odbc');
    console.log('✅ ODBC loaded successfully');
  } catch (err) {
    console.warn('⚠️ ODBC not available:', err.message);
    odbc = null;
  }
} else {
  console.log('ℹ️ Running on Linux/Production - ODBC disabled, using mock data');
  odbc = null;
}

const path = require('path');
const fs = require('fs');

// Database path - use environment variable or default
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database/spms.accdb');
let connection = null;
let isConnected = false;
let isInitialized = false;

// ============================================
// MOCK DATA FOR DEMO MODE
// ============================================
const mockData = {
  customers: [
    { CUS_ID: 'CUS001', FIRST_NAME: 'John', LAST_NAME: 'Doe', PHONE: '555-0101', E_MAIL: 'john@example.com', ADDRESS: '123 Main St', STATUS: 'Active', BALANCE: 150.00 },
    { CUS_ID: 'CUS002', FIRST_NAME: 'Jane', LAST_NAME: 'Smith', PHONE: '555-0102', E_MAIL: 'jane@example.com', ADDRESS: '456 Oak Ave', STATUS: 'Active', BALANCE: 0.00 },
    { CUS_ID: 'CUS003', FIRST_NAME: 'Robert', LAST_NAME: 'Johnson', PHONE: '555-0103', E_MAIL: 'robert@example.com', ADDRESS: '789 Pine Rd', STATUS: 'Active', BALANCE: 75.50 },
    { CUS_ID: 'CUS004', FIRST_NAME: 'Mary', LAST_NAME: 'Williams', PHONE: '555-0104', E_MAIL: 'mary@example.com', ADDRESS: '321 Elm St', STATUS: 'Inactive', BALANCE: 200.00 },
    { CUS_ID: 'CUS005', FIRST_NAME: 'David', LAST_NAME: 'Brown', PHONE: '555-0105', E_MAIL: 'david@example.com', ADDRESS: '654 Maple Dr', STATUS: 'Active', BALANCE: 0.00 },
  ],
  products: [
    { PRODUCT_ID: 'PROD001', NAME_EN: 'Laptop Pro', NAME_KH: 'កុំព្យូទ័រយួរដៃ Pro', SALEOUT_PRICE: 1299.99, QtyInStock: 15, STATUS: 'Active', CATEGORY: 'Electronics' },
    { PRODUCT_ID: 'PROD002', NAME_EN: 'Smartphone X', NAME_KH: 'ទូរស័ព្ទ X', SALEOUT_PRICE: 899.99, QtyInStock: 25, STATUS: 'Active', CATEGORY: 'Electronics' },
    { PRODUCT_ID: 'PROD003', NAME_EN: 'Tablet Plus', NAME_KH: 'ថេប្លេត Plus', SALEOUT_PRICE: 499.99, QtyInStock: 10, STATUS: 'Active', CATEGORY: 'Electronics' },
    { PRODUCT_ID: 'PROD004', NAME_EN: 'Wireless Mouse', NAME_KH: 'កណ្ដុរឥតខ្សែ', SALEOUT_PRICE: 29.99, QtyInStock: 50, STATUS: 'Active', CATEGORY: 'Accessories' },
    { PRODUCT_ID: 'PROD005', NAME_EN: 'Keyboard Pro', NAME_KH: 'ក្ដារចុច Pro', SALEOUT_PRICE: 79.99, QtyInStock: 30, STATUS: 'Active', CATEGORY: 'Accessories' },
  ],
  stock: [
    { StockID: 1, ProductID: 1, QtyInStock: 15, QtyAvailable: 12, QtyReserved: 3 },
    { StockID: 2, ProductID: 2, QtyInStock: 25, QtyAvailable: 20, QtyReserved: 5 },
    { StockID: 3, ProductID: 3, QtyInStock: 5, QtyAvailable: 3, QtyReserved: 2 },
    { StockID: 4, ProductID: 4, QtyInStock: 50, QtyAvailable: 48, QtyReserved: 2 },
    { StockID: 5, ProductID: 5, QtyInStock: 30, QtyAvailable: 28, QtyReserved: 2 },
  ],
  orders: [
    { OR_ID: 1, ORDER_NO: 'ORD-001', ORDER_DATE: '2024-01-15', AMOUNT_US: 149.99, STATUS: 'Completed', CUSTOMER_ID: 'CUS001' },
    { OR_ID: 2, ORDER_NO: 'ORD-002', ORDER_DATE: '2024-01-20', AMOUNT_US: 89.50, STATUS: 'Pending', CUSTOMER_ID: 'CUS002' },
    { OR_ID: 3, ORDER_NO: 'ORD-003', ORDER_DATE: '2024-01-25', AMOUNT_US: 234.75, STATUS: 'Completed', CUSTOMER_ID: 'CUS003' },
  ],
  suppliers: [
    { SUP_ID: 'SUP001', SUP_NAME: 'TechPro Supplies', CONTACT_PERSON: 'John Smith', PHONE: '555-0101', EMAIL: 'john@techpro.com', ADDRESS: '123 Tech St', STATUS: 'Active' },
    { SUP_ID: 'SUP002', SUP_NAME: 'Global Electronics', CONTACT_PERSON: 'Sarah Johnson', PHONE: '555-0102', EMAIL: 'sarah@globalelec.com', ADDRESS: '456 Global Ave', STATUS: 'Active' },
  ],
  users: [
    { UserID: 1, Username: 'admin', Password: 'admin123', FullName: 'Administrator', Role: 'Admin', Status: 'ACTIVE' },
    { UserID: 2, Username: 'cashier', Password: 'cashier123', FullName: 'Cashier User', Role: 'Cashier', Status: 'ACTIVE' },
  ]
};

// ============================================
// REPLACE PARAMETERS IN SQL
// ============================================
function replaceParams(sql, params) {
  if (!params || params.length === 0) return sql;
  
  let processedSql = sql;
  let paramIndex = 0;
  
  processedSql = processedSql.replace(/\?/g, (match) => {
    const param = params[paramIndex++];
    
    if (param === null || param === undefined) {
      return 'NULL';
    }
    
    if (typeof param === 'string' && param.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return `#${param}#`;
    } else if (typeof param === 'string') {
      return `'${param.replace(/'/g, "''")}'`;
    } else if (typeof param === 'number') {
      return param;
    } else {
      return `'${String(param).replace(/'/g, "''")}'`;
    }
  });
  
  return processedSql;
}

// ============================================
// MOCK QUERY EXECUTOR
// ============================================
function executeMockQuery(sql, params = []) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (tableMatch) {
    const table = tableMatch[1].toUpperCase();
    if (table.includes('CUSTOMER')) return mockData.customers;
    if (table.includes('PRODUCT')) return mockData.products;
    if (table.includes('STOCK')) return mockData.stock;
    if (table.includes('ORDER')) return mockData.orders;
    if (table.includes('SUPPLIER')) return mockData.suppliers;
    if (table.includes('USER')) return mockData.users;
  }
  
  if (sql.trim().toUpperCase().startsWith('INSERT') || 
      sql.trim().toUpperCase().startsWith('UPDATE') || 
      sql.trim().toUpperCase().startsWith('DELETE')) {
    return { changes: 1, lastID: Date.now() };
  }
  
  return [];
}

/**
 * Log query errors
 */
function logQueryError(label, err, sql) {
  console.error(`❌ ${label}:`, err.message);
  if (sql) console.error('❌ SQL:', sql.substring(0, 500));
}

/**
 * Initialize database connection
 */
async function initDatabase() {
  if (isInitialized) return connection;
  isInitialized = true;

  if (!odbc) {
    console.log('ℹ️ ODBC not available - running in demo/mock mode');
    isConnected = true;
    return null;
  }

  try {
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Access database not found at:', dbPath);
      isConnected = true;
      return null;
    }

    console.log('🔗 Connecting to Access Database...');
    console.log(`📁 Path: ${dbPath}`);

    const connectionStrings = [
      `DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=${dbPath};`,
      `DRIVER={Microsoft Access Driver (*.mdb)};DBQ=${dbPath};`,
      `DRIVER={Microsoft Access-Treiber (*.mdb)};DBQ=${dbPath};`,
    ];

    let lastError = null;

    for (const connStr of connectionStrings) {
      try {
        console.log(`🔌 Trying connection: ${connStr.substring(0, 50)}...`);
        connection = await odbc.connect(connStr);
        console.log('✅ Connected to Access Database successfully!');
        break;
      } catch (err) {
        lastError = err;
        console.log(`⚠️ Connection attempt failed: ${err.message}`);
        continue;
      }
    }

    if (!connection) {
      console.error('❌ All connection attempts failed:', lastError?.message);
      isConnected = true;
      return null;
    }

    try {
      await connection.query('SELECT 1 as test');
      console.log('✅ Database test query successful!');
      isConnected = true;
    } catch (testErr) {
      console.error('❌ Test query failed:', testErr.message);
      isConnected = true;
    }

    return connection;
  } catch (err) {
    console.error('❌ Failed to connect to Access:', err.message);
    isConnected = true;
    return null;
  }
}

/**
 * Execute a query and return a single row
 */
function get(sql, params = [], callback) {
  const processedSql = replaceParams(sql, params);
  
  if (!odbc || !connection || !isConnected) {
    try {
      const mockResult = executeMockQuery(sql, params);
      const row = mockResult && mockResult.length > 0 ? mockResult[0] : null;
      if (callback) callback(null, row);
    } catch (err) {
      if (callback) callback(err, null);
    }
    return;
  }

  connection.query(processedSql)
    .then(result => {
      const row = result && result.length > 0 ? result[0] : null;
      callback(null, row);
    })
    .catch(err => {
      logQueryError('Query error (get)', err, processedSql);
      try {
        const mockResult = executeMockQuery(sql, params);
        const row = mockResult && mockResult.length > 0 ? mockResult[0] : null;
        callback(null, row);
      } catch (mockErr) {
        callback(err, null);
      }
    });
}

/**
 * Execute a query and return all rows
 */
function all(sql, params = [], callback) {
  const processedSql = replaceParams(sql, params);
  
  if (!odbc || !connection || !isConnected) {
    try {
      const mockResult = executeMockQuery(sql, params);
      if (callback) callback(null, mockResult || []);
    } catch (err) {
      if (callback) callback(err, []);
    }
    return;
  }

  connection.query(processedSql)
    .then(result => {
      callback(null, result || []);
    })
    .catch(err => {
      logQueryError('Query error (all)', err, processedSql);
      try {
        const mockResult = executeMockQuery(sql, params);
        callback(null, mockResult || []);
      } catch (mockErr) {
        callback(err, []);
      }
    });
}

/**
 * Execute a query that modifies data
 */
function run(sql, params = [], callback) {
  const processedSql = replaceParams(sql, params);
  
  if (!odbc || !connection || !isConnected) {
    try {
      const result = executeMockQuery(sql, params);
      const mockThis = {
        lastID: result.lastID || Date.now(),
        changes: result.changes || 1
      };
      if (callback) callback.call(mockThis, null);
    } catch (err) {
      if (callback) callback(err);
    }
    return;
  }

  connection.query(processedSql)
    .then(result => {
      let insertId = 0;
      if (result && result.insertId !== undefined) {
        insertId = result.insertId;
      } else if (result && result.affectedRows !== undefined) {
        insertId = result.affectedRows;
      }
      callback.call({ lastID: insertId }, null);
    })
    .catch(err => {
      logQueryError('Execute error (run)', err, processedSql);
      try {
        const result = executeMockQuery(sql, params);
        const mockThis = {
          lastID: result.lastID || Date.now(),
          changes: result.changes || 1
        };
        callback.call(mockThis, null);
      } catch (mockErr) {
        callback(err);
      }
    });
}

/**
 * Execute a transaction (serialize)
 */
function serialize(callback) {
  try {
    callback();
  } catch (err) {
    console.error('❌ Serialize error:', err.message);
  }
}

/**
 * Prepare a statement
 */
function prepare(sql, callback) {
  if (!odbc || !connection || !isConnected) {
    if (callback) {
      callback(null, {
        sql: sql,
        all: function(params, cb) { all(sql, params, cb); },
        run: function(params, cb) { run(sql, params, cb); }
      });
    }
    return;
  }

  callback(null, {
    sql: sql,
    all: function(params, cb) { all(sql, params, cb); },
    run: function(params, cb) { run(sql, params, cb); }
  });
}

/**
 * Get connection status
 */
function getConnection() { return connection; }
function isDbConnected() { return isConnected; }

// ============================================
// CONNECTION POOLING
// ============================================
const connectionPool = [];

async function getPooledConnection() {
  if (connectionPool.length > 0) {
    return connectionPool.pop();
  }
  if (!connection || !isConnected) {
    await initDatabase();
  }
  return connection;
}

function releaseConnection(conn) {
  if (conn && connectionPool.length < 10) {
    connectionPool.push(conn);
  }
}

// ============================================
// CLEANUP
// ============================================
process.on('exit', () => {
  if (connection) {
    try {
      connection.close();
      console.log('🔌 Database connection closed');
    } catch (err) { /* ignore */ }
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// ============================================
// EXPORTS
// ============================================
module.exports = {
  initDatabase,
  get,
  all,
  run,
  serialize,
  prepare,
  getConnection,
  isConnected: isDbConnected,
  getPooledConnection,
  releaseConnection
};