import apiClient from './client';
import { normalizeProduct, normalizeStockItem, extractArrayData } from '../utils/productHelpers';

// ============================================
// PRODUCTS API
// ============================================
export const productApi = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/products', { params });
    const raw = extractArrayData(response.data, ['products', 'items']);
    return raw.map(normalizeProduct);
  },
  getById: async (id) => {
    const response = await apiClient.get(`/products/${id}`);
    return normalizeProduct(response.data);
  },
  create: async (data) => {
    const response = await apiClient.post('/products', data);
    return response.data;
  },
  update: async ({ id, data }) => {
    const response = await apiClient.put(`/products/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await apiClient.delete(`/products/${id}`);
    return response.data;
  },
  bulkDelete: async (ids) => {
    const response = await apiClient.post('/products/bulk-delete', { ids });
    return response.data;
  },
};

// ============================================
// STOCK API
// ============================================
export const stockApi = {
  getAll: async () => {
    const response = await apiClient.get('/stock');
    const raw = extractArrayData(response.data, ['stock', 'items']);
    return raw.map(normalizeStockItem);
  },
  update: async (id, data) => {
    const response = await apiClient.put(`/stock/${id}`, data);
    return response.data;
  },
  syncWithProduct: async (productId, stockData) => {
    const response = await apiClient.put(`/stock/product/${productId}`, stockData);
    return response.data;
  },
};