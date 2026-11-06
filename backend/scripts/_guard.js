// Database connection security guard
const { URL } = require('url');

function isLocal(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname;
    return ['localhost', '127.0.0.1', '::1'].includes(host);
  } catch (e) {
    return false;
  }
}

const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (dbUrl && !isLocal(dbUrl)) {
  const confirmLive = process.env.CONFIRM_LIVE;
  if (!confirmLive) {
    console.error('❌ REFUSING TO TOUCH LIVE DATABASE: DATABASE_URL points to a non-local host. You must provide CONFIRM_LIVE=<project-ref> to proceed.');
    process.exit(1);
  }
}
