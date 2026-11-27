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

// Normalize a raw API row into one canonical shape so components never read
// raw envelope / DB field names again. The API mixes conventions: PascalCase
// legacy keys, snake_case live columns and backend SQL aliases. Every list
// consumer goes through these helpers after unwrapList/fetchPage, so a new
// envelope or column shape is fixed once here.
const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toId = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const normalizeProduct = (raw) => {
  if (!raw) return null;
  const out = { ...raw };
  const id = toId(out.id ?? out.product_id ?? out.PRODUCT_ID);
  const name = out.name || out.name_en || out.NAME_EN || '';
  out.id = id;
  out.product_id = id;
  out.name = name;
  out.name_en = name;
  out.name_kh = out.name_kh || out.NAME_KH || '';
  out.saleout_price = toNumber(out.saleout_price ?? out.price ?? out.SALEOUT_PRICE);
  out.buyin_price = toNumber(out.buyin_price ?? out.cost ?? out.BUYIN_PRICE);
  out.stock = toNumber(out.stock ?? out.qtyavailable ?? out.QtyInStock ?? out.qty_instock ?? out.STOCK);
  out.qtyavailable = out.stock;
  out.qty_alert = toNumber(out.qty_alert ?? out.QTY_ALERT ?? out.qtyAlert, 5);
  out.status = out.status || out.STATUS || 'Active';
  out.barcode = out.barcode || out.BARCODE || '';
  out.brand = out.brand || out.BRAND || '';
  out.image_url = out.image_url || out.IMAGE_URL || '';
  return out;
};

export const normalizeCustomer = (raw) => {
  if (!raw) return null;
  const out = { ...raw };
  const id = toId(out.id ?? out.customer_id);
  const fullName = out.name || out.customer_name || [out.first_name, out.last_name].filter(Boolean).join(' ') || '';
  out.id = id;
  out.cus_id = out.cus_id ?? out.CUS_ID ?? null;
  out.name = fullName;
  out.first_name = out.first_name || out.FIRST_NAME || (fullName ? fullName.split(' ')[0] : '');
  out.last_name = out.last_name || out.LAST_NAME || (fullName ? fullName.split(' ').slice(1).join(' ') : '');
  out.phone = out.phone ?? out.PHONE ?? null;
  out.email = out.email ?? out.E_MAIL ?? out.email_address ?? null;
  out.address = out.address ?? out.ADDRESS ?? null;
  out.balance = toNumber(out.balance ?? out.BALANCE);
  out.status = out.status || out.STATUS || 'Active';
  out.image_url = out.image_url || out.IMAGE_URL || '';
  return out;
};

export const normalizeOrder = (raw) => {
  if (!raw) return null;
  const out = { ...raw };
  out.id = toId(out.or_id ?? out.id ?? out.OR_ID);
  out.customer_id = toId(out.customer_id ?? out.customerId ?? out.CUSTOMER_ID) ?? out.customer_id ?? null;
  out.total = toNumber(out.total ?? out.amount ?? out.AMOUNT_US ?? out.totalamount);
  out.discount = toNumber(out.discount ?? out.DISCOUNT);
  out.items = Array.isArray(out.items) ? out.items.map((item) => ({ ...item, product_id: toId(item.product_id ?? item.productId ?? item.PRODUCT_ID) })) : [];
  return out;
};

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
