import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext'
import axios from 'axios'  // ✅ Add this import
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// ✅ GLOBAL FIX - Auto-adds /api to ALL axios calls
axios.interceptors.request.use(
  config => {
    // Only modify relative URLs that don't already have /api or http
    if (config.url && !config.url.startsWith('/api') && !config.url.startsWith('http')) {
      config.url = `/api${config.url}`
      console.log(`🔄 Global interceptor added /api to: ${config.url}`)
    }
    return config
  },
  error => Promise.reject(error)
)
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [new BrowserTracing()],
  tracesSampleRate: 1.0,
  environment: import.meta.env.MODE,
});

// Wrap App with Sentry
Sentry.withProfiler(App)

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
)