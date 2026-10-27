// src/api/axiosClient.js
import axios from 'axios';
import { API_BASE_URL } from './baseUrl';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
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