// frontend/src/App.jsx
import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from 'react-hot-toast';

// Layout and the error boundary are part of the shell; every other route is a
// separate chunk so a page like Analytics only downloads its own code.
import Layout from "./components/Layout";
import ErrorBoundary from './components/ErrorBoundary';

const Login = lazy(() => import("./components/Login"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const Orders = lazy(() => import("./components/Orders"));
const Products = lazy(() => import("./components/Products"));
const Customers = lazy(() => import("./components/Customers"));
const Stock = lazy(() => import("./components/Stock"));
const Suppliers = lazy(() => import("./components/Suppliers"));
const Reports = lazy(() => import("./components/Reports"));
const Users = lazy(() => import("./components/Users"));
const ActivityLog = lazy(() => import("./components/ActivityLog"));
const Warranty = lazy(() => import("./components/Warranty"));
const Analytics = lazy(() => import("./components/Analytics"));
const Profile = lazy(() => import("./components/Profile"));
const ChangePassword = lazy(() => import("./components/ChangePassword"));
const SellPage = lazy(() => import("./components/sell/SellPage"));
const OnlineOrders = lazy(() => import("./components/orders/OnlineOrders"));
const RegisterBusiness = lazy(() => import('./pages/RegisterBusiness'));

// Super Admin Pages
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdmin/Dashboard"));
const Businesses = lazy(() => import("./pages/SuperAdmin/Businesses"));
const SystemUsers = lazy(() => import("./pages/SuperAdmin/SystemUsers"));

// Pages
const Pricing = lazy(() => import("./pages/Pricing"));
const Landing = lazy(() => import("./pages/Landing"));
const Storefront = lazy(() => import("./pages/Storefront"));
const Register = lazy(() => import("./pages/Register"));
const Help = lazy(() => import('./pages/Help'));
const Settings = lazy(() => import('./pages/Settings'));

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

              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  {/* ===== PUBLIC ROUTES ===== */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/shop/:slug" element={<Storefront />} />
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
                    <Route path="/orders/new" element={<Layout><SellPage /></Layout>} />
                    <Route path="/sell" element={<Layout><SellPage /></Layout>} />
                    <Route path="/online-orders" element={<Layout><OnlineOrders /></Layout>} />
                    <Route path="/orders/:id" element={<Layout><Orders /></Layout>} />
                    <Route path="/orders/:id/process" element={<Layout><Orders /></Layout>} />
                    <Route path="/products" element={<Layout><Products /></Layout>} />
                    <Route path="/products/new" element={<Layout><Products /></Layout>} />
                    <Route path="/customers" element={<Layout><Customers /></Layout>} />
                    <Route path="/stock" element={<Layout><Stock /></Layout>} />
                    <Route path="/suppliers" element={<Layout><Suppliers /></Layout>} />
                    <Route path="/reports" element={<Layout><Reports /></Layout>} />
                    <Route path="/users" element={<Layout><Users /></Layout>} />
                    <Route path="/activity" element={<Layout><ActivityLog /></Layout>} />
                    <Route path="/warranty" element={<Layout><Warranty /></Layout>} />
                    <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
                    <Route path="/profile" element={<Layout><Profile /></Layout>} />
                    <Route path="/settings" element={<Layout><Settings /></Layout>} />
                    {/* No Layout: the sidebar fires API calls that the auth
                        middleware rejects with PASSWORD_CHANGE_REQUIRED until
                        the new password is set. */}
                    <Route path="/change-password" element={<ChangePassword />} />
                  </Route>

                  {/* ===== CATCH ALL ===== */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;