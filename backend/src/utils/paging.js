// backend/src/utils/paging.js
// Shared page/limit parsing. Invalid, negative or NaN values fall back to the
// defaults instead of producing a NaN OFFSET (which would be a 500), and the
// limit is always clamped to maxLimit.

function toPositiveInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parsePaging(req, { defaultLimit = 50, maxLimit = 200, defaultPage = 1 } = {}) {
  const query = (req && req.query) || {};
  const page = toPositiveInt(query.page, defaultPage);
  const limit = Math.min(maxLimit, toPositiveInt(query.limit, defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = { parsePaging };
