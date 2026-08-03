// frontend/src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from 'react-hot-toast';

// Components
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Orders from "./components/Orders";
import Products from "./components/Products";
import Customers from "./components/Customers";
import Stock from "./components/Stock";
import Suppliers from "./components/Suppliers";
import Reports from "./components/Reports";
import Users from "./components/Users";
import ActivityLog from "./components/ActivityLog";
import Warranty from "./components/Warranty";
import Layout from "./components/Layout";
import Analytics from "./components/Analytics";
import Payment from "./components/Payment";
import Profile from "./components/Profile";
import ErrorBoundary from './components/ErrorBoundary';
import RegisterBusiness from './pages/RegisterBusiness';

// Super Admin Pages
import SuperAdminDashboard from "./pages/SuperAdmin/Dashboard";
import Businesses from "./pages/SuperAdmin/Businesses";
import SystemUsers from "./pages/SuperAdmin/SystemUsers";

// Pages
import Pricing from "./pages/Pricing";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Help from './pages/Help';

// Context
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Create Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// ============================================
// ✅ LOADING SPINNER
// ============================================
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
      <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading...</p>
    </div>
  </div>
);

// ============================================
// ✅ PROTECTED ROUTE COMPONENT
// ============================================
const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

// ============================================
// ✅ SUPER ADMIN ROUTE
// ============================================
const SuperAdminRoute = () => {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

// ============================================
// ✅ MAIN APP COMPONENT
// ============================================
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <ThemeProvider>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#22c55e',
                      secondary: '#fff',
                    },
                    style: {
                      background: '#065f46',
                      color: '#fff',
                    },
                  },
                  error: {
                    duration: 4000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                    style: {
                      background: '#7f1d1d',
                      color: '#fff',
                    },
                  },
                }}
              />

              <Routes>
                {/* ===== PUBLIC ROUTES ===== */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/register-business" element={<RegisterBusiness />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/help" element={<Help />} />

                {/* ===== SUPER ADMIN ROUTES ===== */}
                <Route element={<SuperAdminRoute />}>
                  <Route path="/admin" element={<Layout><SuperAdminDashboard /></Layout>} />
                  <Route path="/admin/tenants" element={<Layout><Businesses /></Layout>} />
                  <Route path="/admin/tenants/new" element={<Layout><Businesses /></Layout>} />
                  <Route path="/admin/users" element={<Layout><SystemUsers /></Layout>} />
                </Route>

                {/* ===== PROTECTED ROUTES ===== */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
                  <Route path="/orders" element={<Layout><Orders /></Layout>} />
                  <Route path="/orders/:id" element={<Layout><Orders /></Layout>} />
                  <Route path="/orders/:id/process" element={<Layout><Orders /></Layout>} />
                  <Route path="/products" element={<Layout><Products /></Layout>} />
                  <Route path="/customers" element={<Layout><Customers /></Layout>} />
                  <Route path="/stock" element={<Layout><Stock /></Layout>} />
                  <Route path="/suppliers" element={<Layout><Suppliers /></Layout>} />
                  <Route path="/reports" element={<Layout><Reports /></Layout>} />
                  <Route path="/users" element={<Layout><Users /></Layout>} />
                  <Route path="/activity" element={<Layout><ActivityLog /></Layout>} />
                  <Route path="/warranty" element={<Layout><Warranty /></Layout>} />
                  <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
                  <Route path="/payment/:orderId" element={<Layout><Payment /></Layout>} />
                  <Route path="/profile" element={<Layout><Profile /></Layout>} />
                </Route>

                {/* ===== CATCH ALL ===== */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;