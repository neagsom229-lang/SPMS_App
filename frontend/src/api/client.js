// frontend/src/api/client.js
import axios from 'axios';

// ✅ FIX: Add /api to the base URL
const API_URL = 'https://spms-backend-pro.onrender.com/api';

console.log('🔧 API URL:', API_URL);

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000,
  withCredentials: true
});

// ===== REQUEST INTERCEPTOR =====
// Add tenant header to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // ✅ Add tenant ID to headers
    if (tenant.id) {
      config.headers['X-Tenant-Id'] = tenant.id;
      config.headers['X-Tenant-Subdomain'] = tenant.subdomain;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// ===== RESPONSE INTERCEPTOR =====
apiClient.interceptors.response.use(
  (response) => {
    console.log('📥 Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ Response error:', error.response?.status, error.response?.data);
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;