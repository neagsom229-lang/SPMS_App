// src/utils/api.js
import axios from 'axios';

// Get API base from environment or use default
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ AUTO-FIX: Add /api prefix if missing
api.interceptors.request.use(
  config => {
    // If URL doesn't start with /api, add it
    if (config.url && !config.url.startsWith('/api')) {
      config.url = `/api${config.url}`;
    }
    console.log(`📤 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  response => {
    console.log(`📥 API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  error => {
    if (error.response) {
      console.error(`❌ API Error ${error.response.status}:`, error.response.data);
    } else if (error.request) {
      console.error('❌ No response from server:', error.message);
    } else {
      console.error('❌ Request error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;