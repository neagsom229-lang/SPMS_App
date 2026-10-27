// frontend/src/api/client.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  console.error('❌ VITE_API_URL environment variable is missing');
}

if (import.meta.env.DEV) {
  console.log('🔧 API URL:', API_URL);
}

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 60000,
  withCredentials: true
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (tenant.id && !tenant.isSuperAdmin) {
      config.headers['x-tenant-id'] = tenant.id;
      config.headers['x-tenant-subdomain'] = tenant.subdomain;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const currentPath = window.location.pathname;

    if (status === 401) {
      const isLoginRequest = requestUrl.includes('/auth/login');
      const isPublicRoute = ['/', '/login', '/register', '/pricing', '/landing'].includes(currentPath);
      
      if (!isLoginRequest && !isPublicRoute) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('tenant');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export const getErrorMessage = (err) => {
  return err.response?.data?.error || err.response?.data?.message || err.message || 'An unexpected error occurred';
};

export default apiClient;
