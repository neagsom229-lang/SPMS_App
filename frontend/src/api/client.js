// frontend/src/api/client.js
import axios from 'axios';

// Use environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    console.log('🔑 Interceptor - Token exists:', token ? '✅ YES' : '❌ NO');
    console.log('🔑 Interceptor - Request URL:', config.url);
    console.log('🔑 Interceptor - Full URL:', `${config.baseURL}${config.url}`);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 Authorization header set');
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
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