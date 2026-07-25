// src/services/customerService.js
import apiClient from '../api/axiosClient';  // ← Import central client

export const getCustomers = () => {
  return apiClient.get('/customers');  // ✅ Auto-adds /api
};

export const getCustomer = (id) => {
  return apiClient.get(`/customers/${id}`);
};

export const createCustomer = (data) => {
  return apiClient.post('/customers', data);
};

export const updateCustomer = (id, data) => {
  return apiClient.put(`/customers/${id}`, data);
};

export const deleteCustomer = (id) => {
  return apiClient.delete(`/customers/${id}`);
};