// One place for turning the API's different list envelopes into an array.
// Some routes return a bare array, others { products, pagination }, others
// { data: [...] }. Every list consumer uses this so a new envelope shape is
// fixed once instead of in each component.
const LIST_KEYS = [
  'data',
  'items',
  'results',
  'rows',
  'records',
  'list',
  'products',
  'orders',
  'customers',
  'suppliers',
  'stock',
  'users',
  'logs',
  'warranties',
  'services',
  'tenants',
  'sessions',
  'categories',
];

export function unwrapList(payload, extraKeys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const keys = [...LIST_KEYS, ...extraKeys];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  const nested = payload.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    for (const key of keys) {
      if (Array.isArray(nested[key])) return nested[key];
    }
    const firstArray = Object.values(nested).find(Array.isArray);
    if (firstArray) return firstArray;
  }

  return Object.values(payload).find(Array.isArray) || [];
}

/**
 * Load every page of a paginated list, up to a sane cap. Used by pickers that
 * must not silently stop at page 1. Routes without pagination return on the
 * first response.
 */
export async function fetchAllList(
  api,
  url,
  { params = {}, maxPages = 5, pageSize = 200, extraKeys = [] } = {},
) {
  const all = [];
  for (let page = 1; page <= maxPages; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await api.get(url, { params: { ...params, page, limit: pageSize } });
    const rows = unwrapList(res.data, extraKeys);
    all.push(...rows);

    const paging = res.data?.pagination || res.data?.data?.pagination;
    if (!paging) break;
    const totalPages = Number(paging.totalPages || 0);
    const total = Number(paging.total || 0);
    if (totalPages > 0) {
      if (page >= totalPages) break;
    } else if (rows.length < pageSize || (total > 0 && all.length >= total)) {
      break;
    }
  }
  return all;
}

/**
 * Fetch one server page and return rows plus the envelope's pagination.
 * Endpoints without pagination get a synthetic one-page envelope.
 */
export async function fetchPage(api, url, { params = {} } = {}) {
  const res = await api.get(url, { params });
  const rows = unwrapList(res.data);
  const paging = res.data?.pagination || res.data?.data?.pagination;
  const pagination = paging
    ? paging
    : { page: 1, limit: rows.length, total: rows.length, totalPages: 1 };
  return { rows, pagination };
}

export default unwrapList;
