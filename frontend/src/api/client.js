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
  timeout: 60000, // ✅ Increased from 30000 to 60000 (60 seconds)
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

// ===== RESPONSE INTERCEPTOR (FIXED) =====
apiClient.interceptors.response.use(
  (response) => {
    console.log('📥 Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    // ✅ FIX: Check if error.response exists before accessing
    const status = error.response?.status || 'No Response';
    const data = error.response?.data || null;
    const message = error.message || 'Network Error';
    
    console.error('❌ Response error:', status, data);
    console.error('❌ Error Message:', message);
    
    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
      window.location.href = '/login';
    }
    
    // ✅ Return a structured error
    return Promise.reject({
      status: status,
      data: data,
      message: message,
      isTimeout: error.code === 'ECONNABORTED' || message.includes('timeout')
    });
  }
);

export default apiClient;