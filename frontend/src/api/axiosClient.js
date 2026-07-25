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
    console.log(`📤 API Request: ${config.method?.toUpperCase()} ${finalBaseURL}${config.url}`);
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
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

export default apiClient;