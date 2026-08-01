// frontend/src/api/products.js
import api from './client';

export const productApi = {
  getAll: (page = 1, limit = 10, filters = {}) => {
    const params = { page, limit, ...filters };
    return api.get('/products', { params });
  },
  // ... other methods
};