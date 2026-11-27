// backend/tests/env.js
// Runs via jest `setupFiles`, before the test framework and before any test
// module is loaded, so these defaults are in place when modules read them.
process.env.NODE_ENV = 'test';
// Tests log only errors by default; set LOG_LEVEL explicitly to see more.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
