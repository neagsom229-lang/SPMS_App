// src/api/axiosClient.js
import axios from 'axios';

// ✅ SINGLE SOURCE OF TRUTH - One place to configure API
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Ensure baseURL always ends with /api — this is the ONLY place /api gets added
const finalBaseURL = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

const apiClient = axios.create({
  baseURL: finalBaseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — logging only, no path rewriting here
apiClient.interceptors.request.use(
  config => {
    if (import.meta.env.DEV) {
      console.log(`📤 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  response => {
    if (import.meta.env.DEV) {
      console.log(`📥 API Response: ${response.status} ${response.config.url}`);
    }
    return response;
  },
  error => {
    if (import.meta.env.DEV) {
      if (error.response) {
        console.error(`❌ API Error ${error.response.status}`);
      } else if (error.request) {
        console.error('❌ No response from server');
      } else {
        console.error('❌ Request error');
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;