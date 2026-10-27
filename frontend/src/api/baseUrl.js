const rawUrl = import.meta.env.VITE_API_URL;

if (!rawUrl && import.meta.env.PROD) {
  throw new Error('VITE_API_URL is required in production');
}

const cleanUrl = (rawUrl || 'http://localhost:5000/api').replace(/\/+$/, '');
export const API_BASE_URL = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
