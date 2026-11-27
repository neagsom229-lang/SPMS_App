// Pure helper: the digest of a migration's logical content, not of its
// line-ending bytes (git/editor settings may produce LF or CRLF per OS).
// Requiring this module has no side effects.
const crypto = require('crypto');

function sha256(content) {
  return crypto.createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');
}

module.exports = { sha256 };
