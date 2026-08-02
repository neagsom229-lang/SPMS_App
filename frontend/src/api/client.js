// frontend/src/api/client.js
import axios from 'axios';

const API_URL = 'https://spms-backend-pro.onrender.com';

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
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    console.log('🔑 Full URL:', config.baseURL + config.url);
    console.log('🔑 Token exists:', token ? '✅ YES' : '❌ NO');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
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