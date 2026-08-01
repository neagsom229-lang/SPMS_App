// ============================================
// SHARED HELPERS – Used by both Products and Stock
// ============================================

import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

// Format price
export const formatPrice = (price) => `$${Number(price || 0).toFixed(2)}`;

// Get stock status (In Stock / Low Stock / Out of Stock)
export const getStockStatus = (qty, alert) => {
  const available = Number(qty) || 0;
  const alertLevel = Number(alert) || 10;
  if (available <= 0) {
    return {
      label: 'Out of Stock',
      color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
      icon: AlertCircle,
      priority: 3,
    };
  }
  if (available <= alertLevel) {
    return {
      label: 'Low Stock',
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      icon: AlertTriangle,
      priority: 2,
    };
  }
  return {
    label: 'In Stock',
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle,
    priority: 1,
  };
};

// Get a deterministic emoji based on product name
export const getProductEmoji = (name) => {
  const emojis = ['📱', '💻', '⌨️', '🖥️', '📷', '🎧', '⌚', '📡', '🔋', '💾', '🖱️', '📀', '💿', '📹', '🎮', '📺', '🔊'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return emojis[Math.abs(hash) % emojis.length];
};

// Normalize a product object (from API) to a consistent structure
export const normalizeProduct = (p) => ({
  PRODUCT_ID: p.PRODUCT_ID || p.product_id || p.id || p.ID,
  NAME_EN: p.NAME_EN || p.name_en || p.name || p.NAME || 'Unknown',
  NAME_KH: p.NAME_KH || p.name_kh || p.khmer_name || '',
  BARCODE: p.BARCODE || p.barcode || '',
  BRAND: p.BRAND || p.brand || '',
  CATEGORY_ID: p.CATEGORY_ID || p.category_id || '',
  BUYIN_PRICE: Number(p.BUYIN_PRICE || p.buyin_price || p.buy_price || p.buyPrice || 0),
  SALEOUT_PRICE: Number(p.SALEOUT_PRICE || p.saleout_price || p.sale_price || p.salePrice || 0),
  QtyInStock: Number(p.QtyInStock || p.qty_instock || p.qtyinstock || p.stock || p.STOCK || 0),
  QTY_ALERT: Number(p.QTY_ALERT || p.qty_alert || p.alert_level || p.ALERT_LEVEL || 10),
  STATUS: p.STATUS || p.status || 'Active',
  image_url: p.image_url || p.IMAGE_URL || '',
  IMAGE_URL: p.IMAGE_URL || p.image_url || '',
});

// Normalize a stock item (from API) to a consistent structure
export const normalizeStockItem = (item) => ({
  stockid: item.stockid || item.STOCKID || item.id || item.ID,
  productid: item.productid || item.PRODUCTID || item.product_id || item.PRODUCT_ID,
  product_code: item.product_code || item.PRODUCT_CODE || '',
  name_en: item.name_en || item.NAME_EN || item.name || 'Unknown',
  name_kh: item.name_kh || item.NAME_KH || '',
  qtyinstock: Number(item.qtyinstock || item.QTYINSTOCK || item.qty_in_stock || item.QTY_IN_STOCK || item.stock || 0),
  qtyavailable: Number(item.qtyavailable || item.QTYAVAILABLE || item.qty_available || item.QTY_AVAILABLE || item.available || 0),
  qtyreserved: Number(item.qtyreserved || item.QTYRESERVED || item.qty_reserved || item.QTY_RESERVED || item.reserved || 0),
  qty_alert: Number(item.qty_alert || item.QTY_ALERT || item.alert_level || 10),
  saleout_price: Number(item.saleout_price || item.SALEOUT_PRICE || item.sale_price || 0),
  STATUS: item.STATUS || item.status || 'Active',
  image_url: item.image_url || item.IMAGE_URL || '',
  IMAGE_URL: item.IMAGE_URL || item.image_url || '',
  // Keep any extra fields
  ...item,
});

// Extract array from various API response shapes
export const extractArrayData = (responseData, extraKeys = []) => {
  if (typeof responseData === 'string' && responseData.includes('<!DOCTYPE html>')) return null;
  if (Array.isArray(responseData)) return responseData;
  if (responseData && typeof responseData === 'object') {
    if (Array.isArray(responseData.data)) return responseData.data;
    for (const key of extraKeys) {
      if (Array.isArray(responseData[key])) return responseData[key];
    }
    if (responseData.data && typeof responseData.data === 'object') {
      for (const key of extraKeys) {
        if (Array.isArray(responseData.data[key])) return responseData.data[key];
      }
      const values = Object.values(responseData.data);
      if (values.length > 0 && Array.isArray(values[0])) return values[0];
    }
  }
  return [];
};