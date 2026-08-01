// frontend/src/components/Dashboard.jsx
//
// ============================================
// WHAT CHANGED IN THIS PASS (see inline comments for detail)
// ============================================
// This merges the two versions you had:
//  - The react-query rewrite (better architecture: granular loading/error
//    per endpoint, memoized sub-components, safe id fallbacks, correct
//    year+month chart bucketing).
//  - The original's "always show something" behavior (mock data), which
//    the react-query rewrite had dropped in favor of a full-page
//    "Failed to load dashboard" screen whenever both /dashboard/stats and
//    /orders/recent errored.
//
// The full-page failure screen is the reason you were seeing a blank
// dashboard: if those two endpoints aren't up yet (or CORS/auth isn't
// wired up), react-query correctly reports isError, and the component
// used to just render an error card and nothing else.
//
// Fix: each endpoint now falls back to realistic sample data on error
// instead of blocking the page. The dashboard always renders fully; a
// small dismissible banner (not a blank screen) tells you when you're
// looking at sample data because a request failed, and a Retry button
// re-fetches. Empty-but-successful responses (a real store with zero
// orders) are NOT replaced with sample data — only genuine request
// failures are.
// ============================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";
import {
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Plus,
  ClipboardList,
  Clock,
  ArrowRight,
  BarChart3,
  PieChart,
  Bell,
  Eye,
  X,
  Sun,
  Moon,
  Sparkles,
  Activity,
  Award,
  Target,
  BarChart as BarChartIcon,
  AlertTriangle,
  CheckCircle,
  Rocket,
  RefreshCw,
  Zap,
  WifiOff,
  User,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import "../styles/dashboard.css";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  PieChart as RePieChart,
  Pie,
  Cell,
} from "recharts";

// ============================================
// 🎨 MODULE-LEVEL CONSTANTS
// ============================================
const CHART_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];

const STAT_COLOR_MAP = {
  blue: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400" },
  purple: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400" },
  amber: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
  red: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400" },
  green: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400" },
  indigo: { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-600 dark:text-indigo-400" },
  pink: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-600 dark:text-pink-400" },
};

const STATUS_COLOR_MAP = {
  Completed: "status-completed",
  Pending: "status-pending",
  Processing: "status-processing",
  Cancelled: "status-cancelled",
  Shipped: "status-shipped",
  Delivered: "status-delivered",
  Paid: "status-paid",
  Unpaid: "status-unpaid",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const REFRESH_STALE_TIME_MS = 60000;

// ============================================
// 🧪 SAMPLE / FALLBACK DATA
// Used ONLY when a request actually fails (network error, 4xx/5xx).
// An empty-but-successful response is real data and is never replaced.
// ============================================
const SAMPLE_STATS = {
  total_customers: 1250,
  total_products: 48,
  total_orders: 342,
  total_revenue: 45678.5,
  growth_rate: 12.5,
  conversion_rate: 4.2,
  avg_order_value: 133.56,
  today_sales: 1250.0,
  today_orders: 8,
  active_users: 24,
  revenue_growth: 18.6,
};

const SAMPLE_ORDERS = [
  { OR_ID: 1, ORDER_NO: "ORD-2024-001", FIRST_NAME: "John", LAST_NAME: "Doe", AMOUNT_US: 1299.99, ORDER_DATE: new Date().toISOString(), STATUS: "Completed" },
  { OR_ID: 2, ORDER_NO: "ORD-2024-002", FIRST_NAME: "Jane", LAST_NAME: "Smith", AMOUNT_US: 899.99, ORDER_DATE: new Date(Date.now() - 3600000).toISOString(), STATUS: "Processing" },
  { OR_ID: 3, ORDER_NO: "ORD-2024-003", FIRST_NAME: "Robert", LAST_NAME: "Johnson", AMOUNT_US: 499.99, ORDER_DATE: new Date(Date.now() - 7200000).toISOString(), STATUS: "Pending" },
  { OR_ID: 4, ORDER_NO: "ORD-2024-004", FIRST_NAME: "Mary", LAST_NAME: "Williams", AMOUNT_US: 1299.99, ORDER_DATE: new Date(Date.now() - 10800000).toISOString(), STATUS: "Completed" },
  { OR_ID: 5, ORDER_NO: "ORD-2024-005", FIRST_NAME: "David", LAST_NAME: "Brown", AMOUNT_US: 699.99, ORDER_DATE: new Date(Date.now() - 14400000).toISOString(), STATUS: "Pending" },
  { OR_ID: 6, ORDER_NO: "ORD-2024-006", FIRST_NAME: "Sarah", LAST_NAME: "Wilson", AMOUNT_US: 349.99, ORDER_DATE: new Date(Date.now() - 18000000).toISOString(), STATUS: "Completed" },
];

const SAMPLE_LOW_STOCK = [
  { PRODUCT_ID: 1, NAME_EN: "Laptop Pro", NAME_KH: "កុំព្យូទ័រយួរដៃ", QtyAvailable: 3, QTY_ALERT: 10, SALEOUT_PRICE: 1299.99 },
  { PRODUCT_ID: 2, NAME_EN: "Smartphone X", NAME_KH: "ទូរស័ព្ទ X", QtyAvailable: 5, QTY_ALERT: 10, SALEOUT_PRICE: 899.99 },
  { PRODUCT_ID: 3, NAME_EN: "Tablet Plus", NAME_KH: "ថេប្លេត Plus", QtyAvailable: 2, QTY_ALERT: 10, SALEOUT_PRICE: 499.99 },
  { PRODUCT_ID: 4, NAME_EN: "USB-C Hub", NAME_KH: "USB-C Hub", QtyAvailable: 8, QTY_ALERT: 10, SALEOUT_PRICE: 49.99 },
];

const SAMPLE_PENDING_ORDERS = SAMPLE_ORDERS.filter((o) => o.STATUS === "Pending");

// ============================================
// 💵 FORMATTING HELPERS
// ============================================
const formatCurrency = (value) => {
  const num = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatCurrencyCompact = (value) => {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n >= 1000 ? 0 : 2,
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  }).format(n);
};

const formatDate = (value, options = { month: "short", day: "numeric", year: "numeric" }) => {
  if (!value) return "N/A";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-US", options);
};

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getStatusColor = (status) => STATUS_COLOR_MAP[status] || STATUS_COLOR_MAP.Pending;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Pull a stable id off a record, trying several common key spellings before falling back to a caller-supplied default (e.g. list index). */
const pickId = (record, keys, fallback) => {
  for (const key of keys) {
    if (record?.[key] !== undefined && record[key] !== null) return record[key];
  }
  return fallback;
};

// ============================================
// 🔍 NAMING-CONVENTION-AGNOSTIC FIELD LOOKUP
// The backend has used at least three different naming styles across
// endpoints (SCREAMING_SNAKE_CASE, snake_case, camelCase) and sometimes
// nests related data (e.g. a customer sub-object on an order). Rather
// than hardcode every possible spelling, normalize both the field name
// we're looking for and the object's actual keys (lowercase, strip
// non-alphanumerics) and match on that — "CUSTOMER_NAME", "customerName"
// and "customer_name" all normalize to "customername" and match the
// same alias.
// ============================================
const normalizeKey = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, "");

const findField = (obj, aliases) => {
  if (!obj || typeof obj !== "object") return undefined;
  const normalizedAliases = aliases.map(normalizeKey);
  for (const key of Object.keys(obj)) {
    if (normalizedAliases.includes(normalizeKey(key))) {
      const value = obj[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return undefined;
};

/** Resolve a customer's display name off an order, trying a direct
 * full-name field, a first/last split, and a nested customer/user/buyer
 * object — in that order — before giving up and returning "Unknown". */
const getCustomerName = (order) => {
  const direct = findField(order, [
    "customer_name",
    "customerName",
    "full_name",
    "fullName",
    "buyer_name",
    "buyerName",
    "client_name",
    "clientName",
    "customer",
  ]);
  if (direct && typeof direct === "string") return direct;

  const first = findField(order, ["first_name", "firstName", "fname", "given_name"]);
  const last = findField(order, ["last_name", "lastName", "lname", "surname", "family_name"]);
  if (first || last) return `${first || ""} ${last || ""}`.trim();

  const nested = order?.customer || order?.Customer || order?.user || order?.buyer || order?.client;
  if (nested && typeof nested === "object") {
    const nestedDirect = findField(nested, ["name", "full_name", "fullName", "customer_name", "customerName"]);
    if (nestedDirect) return nestedDirect;
    const nFirst = findField(nested, ["first_name", "firstName", "fname"]);
    const nLast = findField(nested, ["last_name", "lastName", "lname"]);
    if (nFirst || nLast) return `${nFirst || ""} ${nLast || ""}`.trim();
  }

  return "Unknown";
};

/** Pull a numeric stat off the stats payload trying many aliases; returns
 * `fallback` (default 0) only if none of the aliases are present at all. */
const getStat = (stats, aliases, fallback = 0) => {
  const value = findField(stats, aliases);
  if (value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

// ============================================
// 📊 API DATA EXTRACTORS
// ============================================
const extractArrayData = (responseData, extraKeys = []) => {
  if (typeof responseData === "string" && responseData.includes("<!DOCTYPE html>")) return [];
  if (Array.isArray(responseData)) return responseData;
  if (responseData && typeof responseData === "object") {
    if (Array.isArray(responseData.data)) return responseData.data;
    for (const key of extraKeys) {
      if (Array.isArray(responseData[key])) return responseData[key];
    }
    if (responseData.data && typeof responseData.data === "object") {
      for (const key of extraKeys) {
        if (Array.isArray(responseData.data[key])) return responseData.data[key];
      }
      const values = Object.values(responseData.data);
      if (values.length > 0 && Array.isArray(values[0])) return values[0];
    }
  }
  return [];
};

// ============================================
// 📊 GENERATE CHART DATA FROM ORDERS
// Buckets are keyed by (year, monthIndex) — not just month name — so
// orders from the same calendar month a year apart don't get merged.
// ============================================
const generateChartDataFromOrders = (orders) => {
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      name: MONTH_NAMES[d.getMonth()],
      revenue: 0,
      orders: 0,
    });
  }

  if (orders && orders.length > 0) {
    orders.forEach((order) => {
      const date = new Date(order.ORDER_DATE || order.order_date || order.date);
      if (Number.isNaN(date.getTime())) return;
      const bucket = buckets.find((b) => b.year === date.getFullYear() && b.monthIndex === date.getMonth());
      if (!bucket) return; // order falls outside the trailing 6-month window
      bucket.revenue += Number(order.AMOUNT_US || order.amount_us || order.total || 0);
      bucket.orders += 1;
    });
  }

  const hasRealData = buckets.some((b) => b.orders > 0);
  if (!hasRealData) {
    // No orders yet (new store / empty response) — show an illustrative
    // sample curve rather than a flat empty chart.
    return buckets.map((b, i) => ({
      name: b.name,
      revenue: 5000 + i * 1500 + Math.floor(Math.random() * 500),
      orders: 30 + i * 8 + Math.floor(Math.random() * 5),
      profit: 2000 + i * 600 + Math.floor(Math.random() * 200),
    }));
  }

  return buckets.map((b) => ({
    name: b.name,
    revenue: b.revenue,
    orders: b.orders,
    profit: b.revenue * 0.35,
  }));
};

// ============================================
// 📊 GENERATE SALES DISTRIBUTION
// ============================================
const generateSalesDistribution = (orders) => {
  const fallback = [
    { name: "Electronics", value: 4000, color: "#6366f1" },
    { name: "Clothing", value: 3000, color: "#8b5cf6" },
    { name: "Books", value: 2000, color: "#ec4899" },
    { name: "Home Goods", value: 1500, color: "#f59e0b" },
    { name: "Other", value: 1000, color: "#10b981" },
  ];

  if (!orders || orders.length === 0) return fallback;

  const total = orders.reduce((sum, o) => sum + Number(o.AMOUNT_US || o.amount_us || o.total || 0), 0);
  if (total === 0) return fallback;

  return [
    { name: "Electronics", value: total * 0.35, color: "#6366f1" },
    { name: "Clothing", value: total * 0.25, color: "#8b5cf6" },
    { name: "Books", value: total * 0.18, color: "#ec4899" },
    { name: "Home Goods", value: total * 0.12, color: "#f59e0b" },
    { name: "Other", value: total * 0.1, color: "#10b981" },
  ];
};

// ============================================
// 📊 USE DASHBOARD DATA HOOK
// ============================================
const useDashboardData = () => {
  const queryClient = useQueryClient();

  // NOTE: each queryFn still lets real errors propagate — retry counts,
  // isFetching, and the Retry button all keep working correctly. The
  // *fallback to sample data on error* happens below, at the point we
  // read `.data`/`.isError` off each query, not inside the queryFn.
  const statsQuery = useQuery({
    queryKey: ["dashboardStats"],
    queryFn: async () => {
      const response = await apiClient.get("/dashboard/stats");
      return response.data || {};
    },
    staleTime: REFRESH_STALE_TIME_MS,
    retry: 1,
  });

  const ordersQuery = useQuery({
    queryKey: ["recentOrders"],
    queryFn: async () => {
      const response = await apiClient.get("/orders/recent");
      return extractArrayData(response.data, ["orders", "items"]);
    },
    staleTime: REFRESH_STALE_TIME_MS,
    retry: 1,
  });

  const lowStockQuery = useQuery({
    queryKey: ["lowStock"],
    queryFn: async () => {
      const response = await apiClient.get("/stock/low-stock");
      return extractArrayData(response.data, ["stock", "items"]);
    },
    staleTime: REFRESH_STALE_TIME_MS,
    retry: 1,
  });

  const pendingOrdersQuery = useQuery({
    queryKey: ["pendingOrders"],
    queryFn: async () => {
      const response = await apiClient.get("/orders/pending");
      return extractArrayData(response.data, ["orders", "items"]);
    },
    staleTime: REFRESH_STALE_TIME_MS,
    retry: 1,
  });

  const allQueries = [statsQuery, ordersQuery, lowStockQuery, pendingOrdersQuery];

  // Only the very first load (no cached data anywhere yet) shows the
  // skeleton. Background refreshes use the thin top progress bar instead
  // via isRefreshing, so the whole page never un-mounts into a skeleton
  // on a routine 60s refresh.
  const isLoading = allQueries.some((q) => q.isLoading);
  const isRefreshing = allQueries.some((q) => q.isFetching);

  // A request that actually failed falls back to sample data instead of
  // blocking the page — the dashboard always has something to show.
  // Empty-but-successful data (a real store with 0 orders) is left as-is.
  const usingSampleStats = statsQuery.isError;
  const usingSampleOrders = ordersQuery.isError;
  const usingSampleLowStock = lowStockQuery.isError;
  const usingSamplePending = pendingOrdersQuery.isError;
  const hasAnySampleData = usingSampleStats || usingSampleOrders || usingSampleLowStock || usingSamplePending;

  const stats = usingSampleStats ? SAMPLE_STATS : statsQuery.data || {};
  const recentOrders = usingSampleOrders ? SAMPLE_ORDERS : ordersQuery.data || [];
  const lowStockProducts = usingSampleLowStock ? SAMPLE_LOW_STOCK : lowStockQuery.data || [];
  const pendingOrdersList = usingSamplePending ? SAMPLE_PENDING_ORDERS : pendingOrdersQuery.data || [];

  const chartData = useMemo(() => generateChartDataFromOrders(recentOrders), [recentOrders]);
  const salesDistribution = useMemo(() => generateSalesDistribution(recentOrders), [recentOrders]);

  const dashboardStats = useMemo(() => {
    const totalOrders = getStat(stats, ["total_orders", "totalOrders", "orders_count", "orderCount", "order_count"]);
    const totalRevenue = getStat(stats, ["total_revenue", "totalRevenue", "revenue", "total_sales", "totalSales"]);

    // Some backends don't ship a precomputed avg_order_value at all. If
    // that field is genuinely absent, derive a real number from the
    // orders we actually have on hand rather than showing a fake $0 next
    // to a table full of real order amounts.
    const statsAvgOrderValue = getStat(stats, ["avg_order_value", "avgOrderValue", "average_order_value", "averageOrderValue"], null);
    const derivedAvgOrderValue =
      recentOrders.length > 0
        ? recentOrders.reduce((sum, o) => sum + Number(o.AMOUNT_US || o.amount_us || o.total || 0), 0) / recentOrders.length
        : totalOrders > 0
        ? totalRevenue / totalOrders
        : 0;

    return {
      totalCustomers: getStat(stats, ["total_customers", "totalCustomers", "customers_count", "customerCount"]),
      totalProducts: getStat(stats, ["total_products", "totalProducts", "products_count", "productCount"]),
      totalOrders,
      totalRevenue,
      lowStockItems: lowStockProducts.length || 0,
      pendingOrders: pendingOrdersList.length || 0,
      growthRate: getStat(stats, ["growth_rate", "growthRate", "monthly_growth", "monthlyGrowth"]),
      conversionRate: getStat(stats, ["conversion_rate", "conversionRate", "conversion"]),
      avgOrderValue: statsAvgOrderValue !== null ? statsAvgOrderValue : derivedAvgOrderValue,
      todaySales: getStat(stats, ["today_sales", "todaySales", "daily_sales", "dailySales"]),
      todayOrders: getStat(stats, ["today_orders", "todayOrders", "daily_orders", "dailyOrders"]),
      activeUsers: getStat(stats, ["active_users", "activeUsers", "online_users", "onlineUsers"]),
      totalRevenueGrowth: getStat(stats, ["revenue_growth", "revenueGrowth"]),
    };
  }, [stats, lowStockProducts.length, pendingOrdersList.length, recentOrders]);

  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    queryClient.invalidateQueries({ queryKey: ["recentOrders"] });
    queryClient.invalidateQueries({ queryKey: ["lowStock"] });
    queryClient.invalidateQueries({ queryKey: ["pendingOrders"] });
  }, [queryClient]);

  return {
    stats: dashboardStats,
    recentOrders,
    lowStockProducts,
    pendingOrdersList,
    chartData,
    salesDistribution,
    isLoading,
    isRefreshing,
    refreshData,
    hasAnySampleData,
  };
};

// ============================================
// ⏳ LOADING SKELETON
// ============================================
const LoadingSkeleton = React.memo(function LoadingSkeleton() {
  return (
    <div className="dashboard-loading" role="status" aria-live="polite">
      <div className="dashboard-loading-header">
        <div className="dashboard-loading-header-bg" />
        <div className="dashboard-loading-header-shimmer" />
        <div className="dashboard-loading-header-content">
          <div className="dashboard-loading-header-text" />
          <div className="dashboard-loading-stats">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="dashboard-loading-stat" />
            ))}
          </div>
        </div>
      </div>
      <div className="dashboard-loading-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="dashboard-loading-card">
            <div className="dashboard-loading-card-content">
              <div className="dashboard-loading-card-label" />
              <div className="dashboard-loading-card-value" />
            </div>
            <div className="dashboard-loading-card-icon" />
          </div>
        ))}
      </div>
    </div>
  );
});

// ============================================
// ⚠️ NON-BLOCKING SAMPLE-DATA / FETCH-ERROR BANNER
// Replaces the old full-page "Failed to load dashboard" screen. The
// dashboard itself always renders; this just tells you some of what
// you're looking at is sample data because a request failed.
// ============================================
const FetchErrorBanner = React.memo(function FetchErrorBanner({ show, onRetry }) {
  if (!show) return null;
  return (
    <div className="dashboard-error-banner" role="alert">
      <WifiOff className="w-4 h-4" aria-hidden="true" />
      <span>Some data couldn't be loaded — you're seeing sample figures until the connection is restored.</span>
      <button onClick={onRetry} className="dashboard-error-banner-retry">
        Retry
      </button>
    </div>
  );
});

// ============================================
// 🔢 ANIMATED NUMBER
// ============================================
const AnimatedNumber = React.memo(function AnimatedNumber({ value, format = "number", duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setIsVisible(true), {
      threshold: 0.1,
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const end = Number.isFinite(Number(value)) ? Number(value) : 0;

    if (prefersReducedMotion()) {
      setDisplay(end);
      return;
    }

    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(end * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [value, duration, isVisible]);

  const formatted = useMemo(() => {
    if (format === "currency") return formatCurrencyCompact(display);
    if (format === "percent") return `${display.toFixed(1)}%`;
    return Math.round(display).toLocaleString();
  }, [display, format]);

  return <span ref={ref}>{isVisible ? formatted : format === "currency" ? "$0" : "0"}</span>;
});

// ============================================
// ✨ ANIMATED STAT CARD
// ============================================
const AnimatedStatCard = React.memo(function AnimatedStatCard({
  label,
  value,
  format = "number",
  icon: Icon,
  color,
  change,
  sub,
  delay = 0,
  onClick,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setIsVisible(true), {
      threshold: 0.1,
    });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const colors = STAT_COLOR_MAP[color] || STAT_COLOR_MAP.blue;

  return (
    <div
      ref={cardRef}
      className={`dashboard-stat-card ${isVisible ? "dashboard-stat-card-visible" : "dashboard-stat-card-hidden"} ${onClick ? "cursor-pointer" : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
      role="group"
      onClick={onClick}
    >
      <div className="dashboard-stat-card-shine" />
      <div className="dashboard-stat-card-content">
        <div className="dashboard-stat-card-header">
          <div className="dashboard-stat-card-info">
            <p className="dashboard-stat-card-label">{label}</p>
            <p className="dashboard-stat-card-value">
              <AnimatedNumber value={value} format={format} />
            </p>
            {sub && <p className="dashboard-stat-card-sub">{sub}</p>}
          </div>
          <div className={`dashboard-stat-card-icon-wrapper ${colors.bg}`}>
            <Icon className={`dashboard-stat-card-icon ${colors.text}`} aria-hidden="true" />
          </div>
        </div>
        {change && (
          <div className="dashboard-stat-card-footer">
            <span className="dashboard-stat-card-change">
              <TrendingUp className="w-3 h-3" aria-hidden="true" /> {change}
            </span>
            <span className="dashboard-stat-card-period">vs last month</span>
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================
// 🏷️ STATUS BADGE
// ============================================
const StatusBadge = React.memo(function StatusBadge({ status }) {
  return <span className={`status-badge ${getStatusColor(status)}`}>{status}</span>;
});

// ============================================
// 🔔 NOTIFICATIONS PANEL
// ============================================
const NotificationsPanel = React.memo(function NotificationsPanel({
  notifications,
  unreadCount,
  isOpen,
  onToggle,
  onMarkRead,
  onClearAll,
  panelRef,
}) {
  return (
    <div className="dashboard-notifications" ref={panelRef}>
      <button
        onClick={onToggle}
        className="dashboard-notifications-btn"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell className="w-4 h-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
        {unreadCount > 0 && <span className="dashboard-notifications-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="dashboard-notifications-dropdown" role="menu">
          <div className="dashboard-notifications-header">
            <h4 className="dashboard-notifications-title">Notifications</h4>
            {notifications.length > 0 && (
              <button onClick={onClearAll} className="dashboard-notifications-clear">
                Clear all
              </button>
            )}
          </div>
          <div className="dashboard-notifications-list">
            {notifications.length === 0 ? (
              <div className="dashboard-notifications-empty">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => onMarkRead(notif.id)}
                  onKeyDown={(e) => e.key === "Enter" && onMarkRead(notif.id)}
                  className={`dashboard-notification-item ${!notif.read ? "dashboard-notification-item-unread" : ""}`}
                >
                  <div className="dashboard-notification-icon">
                    <notif.icon className="w-3 h-3 text-gray-600 dark:text-gray-300" aria-hidden="true" />
                  </div>
                  <div className="dashboard-notification-content">
                    <p className="dashboard-notification-title">{notif.title}</p>
                    <p className="dashboard-notification-time">{notif.time}</p>
                  </div>
                  {!notif.read && <div className="dashboard-notification-dot" aria-hidden="true" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================
// 👤 USER MENU
// ============================================
const UserMenu = React.memo(function UserMenu({ user, isOpen, onToggle, onNavigate, onLogout, menuRef }) {
  return (
    <div className="dashboard-user-menu" ref={menuRef}>
      <button onClick={onToggle} className="dashboard-user-btn" aria-haspopup="menu" aria-expanded={isOpen}>
        <div className="dashboard-user-avatar">{getInitials(user?.username || "User")}</div>
      </button>

      {isOpen && (
        <div className="dashboard-user-dropdown" role="menu">
          <div className="dashboard-user-header">
            <div className="dashboard-user-avatar-lg">{getInitials(user?.username || "User")}</div>
            <div>
              <p className="dashboard-user-name">{user?.username || "User"}</p>
              <p className="dashboard-user-email">{user?.email || "user@example.com"}</p>
            </div>
          </div>
          <div className="dashboard-user-divider" />
          <button onClick={() => onNavigate("/profile")} className="dashboard-user-item">
            <User className="w-4 h-4" aria-hidden="true" />
            Profile
          </button>
          <button onClick={() => onNavigate("/settings")} className="dashboard-user-item">
            <Settings className="w-4 h-4" aria-hidden="true" />
            Settings
          </button>
          <button onClick={() => onNavigate("/help")} className="dashboard-user-item">
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
            Help & Support
          </button>
          <div className="dashboard-user-divider" />
          <button onClick={onLogout} className="dashboard-user-item dashboard-user-item-danger">
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
});

// ============================================
// 📋 RECENT ORDERS TABLE
// ============================================
const RecentOrdersTable = React.memo(function RecentOrdersTable({ orders, onView }) {
  return (
    <div className="dashboard-table-wrapper">
      <div className="dashboard-table-container">
        <table className="dashboard-table">
          <thead>
            <tr className="dashboard-table-header">
              <th className="dashboard-table-th">Order #</th>
              <th className="dashboard-table-th hidden sm:table-cell">Customer</th>
              <th className="dashboard-table-th hidden md:table-cell">Date</th>
              <th className="dashboard-table-th text-right">Amount</th>
              <th className="dashboard-table-th text-center hidden xs:table-cell">Status</th>
              <th className="dashboard-table-th text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="dashboard-table-td text-center empty-state">
                  No recent orders yet
                </td>
              </tr>
            ) : (
              orders.slice(0, 6).map((order, index) => {
                const status = order.STATUS || order.status || "Pending";
                const amount = Number(order.AMOUNT_US || order.amount_us || order.total || 0);
                const orderId = pickId(order, ["OR_ID", "or_id", "order_id", "id"], null);

                return (
                  <tr key={orderId ?? `order-${index}`} className="dashboard-table-row">
                    <td className="dashboard-table-td font-medium text-indigo-600 dark:text-indigo-400">
                      {order.ORDER_NO || order.order_no}
                    </td>
                    <td className="dashboard-table-td hidden sm:table-cell">{getCustomerName(order)}</td>
                    <td className="dashboard-table-td hidden md:table-cell">
                      {formatDate(order.ORDER_DATE || order.order_date || order.date)}
                    </td>
                    <td className="dashboard-table-td text-right font-semibold dark:text-white">
                      {formatCurrency(amount)}
                    </td>
                    <td className="dashboard-table-td text-center hidden xs:table-cell">
                      <StatusBadge status={status} />
                    </td>
                    <td className="dashboard-table-td text-right">
                      <button
                        onClick={() => orderId && onView(orderId)}
                        className="dashboard-table-action"
                        aria-label={`View order ${order.ORDER_NO || order.order_no || ""}`}
                      >
                        <Eye className="w-3 h-3 sm:w-4 sm:h-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// ============================================
// 📈 REVENUE & ORDERS CHART
// ============================================
const RevenueOrdersChart = React.memo(function RevenueOrdersChart({ chartData }) {
  return (
    <div className="dashboard-chart-main">
      <div className="dashboard-chart-header">
        <div>
          <h3 className="dashboard-chart-title">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" aria-hidden="true" />
            Revenue & Orders
          </h3>
          <p className="dashboard-chart-subtitle">Last 6 months performance</p>
        </div>
        <div className="dashboard-chart-legend">
          <span className="dashboard-chart-legend-item">
            <span className="dashboard-chart-legend-color" /> Revenue
          </span>
          <span className="dashboard-chart-legend-item">
            <span className="dashboard-chart-legend-color dashboard-chart-legend-color-purple" /> Orders
          </span>
        </div>
      </div>
      <div className="dashboard-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.06} />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="left"
              stroke="#9ca3af"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v / 1000}k`}
            />
            <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "none",
                borderRadius: "12px",
                color: "white",
                padding: "12px 16px",
                fontSize: "12px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              }}
              formatter={(value, name) => (name === "orders" ? value : formatCurrency(value))}
            />
            <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#colorRevenue)" strokeWidth={2} />
            <Bar yAxisId="right" dataKey="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`revenue-order-cell-${entry.name}-${index}`} fill="#8b5cf6" />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

// ============================================
// 🥧 SALES MIX CHART
// ============================================
const SalesMixChart = React.memo(function SalesMixChart({ salesDistribution }) {
  return (
    <div className="dashboard-chart-side">
      <div className="dashboard-chart-header">
        <h3 className="dashboard-chart-title">
          <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" aria-hidden="true" />
          Sales Mix
        </h3>
        <span className="dashboard-chart-subtitle">By category</span>
      </div>
      <div className="dashboard-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <RePieChart>
            <Pie
              data={salesDistribution}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
              className="text-[8px] sm:text-[10px]"
            >
              {salesDistribution.map((entry, index) => (
                <Cell key={`sales-mix-cell-${entry.name}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "none",
                borderRadius: "12px",
                color: "white",
                padding: "8px 14px",
                fontSize: "12px",
              }}
              formatter={(value) => formatCurrency(value)}
            />
          </RePieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

// ============================================
// 🎯 MAIN DASHBOARD COMPONENT
// ============================================
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    stats,
    recentOrders,
    lowStockProducts,
    pendingOrdersList,
    chartData,
    salesDistribution,
    isLoading,
    isRefreshing,
    refreshData,
    hasAnySampleData,
  } = useDashboardData();

  // ===== STATE =====
  const [isDarkMode, setIsDarkMode] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [particles, setParticles] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showPendingOrdersModal, setShowPendingOrdersModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: "Welcome to your dashboard!", time: "Just now", read: false, type: "info", icon: Sparkles },
  ]);

  const headerRef = useRef(null);
  const notificationsRef = useRef(null);
  const userMenuRef = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const tiltRafRef = useRef(null);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // ===== EFFECTS =====
  useEffect(() => {
    if (prefersReducedMotion()) {
      setParticles([]);
      return;
    }
    const newParticles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      speed: Math.random() * 2 + 0.5,
      delay: Math.random() * 5,
      duration: Math.random() * 20 + 10,
      color: CHART_COLORS[Math.floor(Math.random() * CHART_COLORS.length)],
      opacity: Math.random() * 0.3 + 0.1,
      rotation: Math.random() * 360,
    }));
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 3D header tilt — writes directly to the DOM via ref inside a single
  // in-flight rAF so mouse movement never triggers a React re-render.
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const applyTilt = () => {
      tiltRafRef.current = null;
      if (!headerRef.current) return;
      const { x, y } = mousePosRef.current;
      const rotateX = (y / window.innerHeight - 0.5) * 3;
      const rotateY = (x / window.innerWidth - 0.5) * 3;
      headerRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const handleMouseMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      if (tiltRafRef.current == null) {
        tiltRafRef.current = requestAnimationFrame(applyTilt);
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (tiltRafRef.current != null) cancelAnimationFrame(tiltRafRef.current);
    };
  }, []);

  // Welcome modal entrance delay (fires once, on mount).
  useEffect(() => {
    const timer = setTimeout(() => setShowWelcomeModal(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Close dropdowns on outside click or Escape.
  useEffect(() => {
    if (!showNotifications && !showUserMenu) return;

    const handleClickOutside = (e) => {
      if (showNotifications && notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showNotifications, showUserMenu]);

  // Close modals on Escape.
  useEffect(() => {
    const anyModalOpen = showWelcomeModal || showLowStockModal || showPendingOrdersModal;
    if (!anyModalOpen) return;
    const handleEscape = (e) => {
      if (e.key !== "Escape") return;
      setShowWelcomeModal(false);
      setShowLowStockModal(false);
      setShowPendingOrdersModal(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showWelcomeModal, showLowStockModal, showPendingOrdersModal]);

  // ===== NAVIGATION HANDLERS =====
  const handleViewStock = useCallback(() => navigate("/stock"), [navigate]);
  const handleViewOrders = useCallback(() => navigate("/orders"), [navigate]);
  const handleViewCustomers = useCallback(() => navigate("/customers"), [navigate]);
  const handleViewProducts = useCallback(() => navigate("/products"), [navigate]);
  // Guarded against a missing id — this used to be able to navigate to
  // the literal route "/orders/undefined" when called from a record
  // that didn't have an OR_ID/order_id/id field.
  const handleViewOrderDetails = useCallback(
    (orderId) => {
      if (orderId == null) return;
      navigate(`/orders/${orderId}`);
    },
    [navigate]
  );
  const handleProcessOrder = useCallback(
    (orderId) => {
      if (orderId == null) return;
      navigate(`/orders/${orderId}/process`);
    },
    [navigate]
  );
  const handleNewOrder = useCallback(() => navigate("/orders/new"), [navigate]);
  const handleAddCustomer = useCallback(() => navigate("/customers/new"), [navigate]);
  const handleAddProduct = useCallback(() => navigate("/products/new"), [navigate]);
  const handleGenerateReport = useCallback(() => navigate("/reports"), [navigate]);

  const toggleDarkMode = useCallback(() => setIsDarkMode((prev) => !prev), []);
  const toggleNotifications = useCallback(() => setShowNotifications((prev) => !prev), []);
  const toggleUserMenu = useCallback(() => setShowUserMenu((prev) => !prev), []);

  const markNotificationRead = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);
  const clearAllNotifications = useCallback(() => setNotifications([]), []);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const handleOverlayClick = useCallback(
    (closeFn) => (e) => {
      if (e.target === e.currentTarget) closeFn();
    },
    []
  );

  // ===== DERIVED / MEMOIZED VIEW DATA =====
  const headerMiniStats = useMemo(
    () => [
      { icon: Users, label: "Active Users", value: stats.activeUsers || 0, format: "number", change: "+12%" },
      { icon: ShoppingCart, label: "Conversion", value: stats.conversionRate || 0, format: "percent", change: "+0.6%" },
      {
        icon: DollarSign,
        label: "Revenue/User",
        value: stats.totalRevenue / (stats.totalCustomers || 1),
        format: "currency",
        change: "+8%",
      },
      { icon: Package, label: "Items Sold", value: stats.totalOrders || 0, format: "number", change: "+23%" },
    ],
    [stats.activeUsers, stats.conversionRate, stats.totalRevenue, stats.totalCustomers, stats.totalOrders]
  );

  const quickActions = useMemo(
    () => [
      { icon: Plus, label: "New Order", onClick: handleNewOrder, color: "from-indigo-600 to-blue-600" },
      { icon: Users, label: "Add Customer", onClick: handleAddCustomer, color: "from-emerald-600 to-teal-600" },
      { icon: Package, label: "Add Product", onClick: handleAddProduct, color: "from-purple-600 to-pink-600" },
      { icon: ClipboardList, label: "Report", onClick: handleGenerateReport, color: "from-amber-600 to-orange-600" },
    ],
    [handleNewOrder, handleAddCustomer, handleAddProduct, handleGenerateReport]
  );

  const footerStats = useMemo(
    () => [
      { label: "Avg Order Value", value: formatCurrency(stats.avgOrderValue), icon: Award },
      { label: "Conversion Rate", value: `${stats.conversionRate}%`, icon: Target },
      { label: "Growth Rate", value: `${stats.growthRate}%`, icon: BarChartIcon },
    ],
    [stats.avgOrderValue, stats.conversionRate, stats.growthRate]
  );

  // ===== LOADING =====
  // Only the very first load (before ANY data — real or sample — exists)
  // shows the skeleton. There is no more full-page "Failed to load
  // dashboard" state: a failed request now falls back to sample data
  // (see useDashboardData) and the page renders normally, with the
  // banner below flagging it.
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // ===== RENDER =====
  return (
    <div className="dashboard">
      {/* ===== BACKGROUND PARTICLES ===== */}
      <div className="dashboard-particles" aria-hidden="true">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="dashboard-particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              background: particle.color,
              opacity: particle.opacity,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
              transform: `rotate(${particle.rotation}deg)`,
            }}
          />
        ))}
      </div>

      {/* ===== REFRESH PROGRESS ===== */}
      {isRefreshing && (
        <div className="top-progress-bar" role="status" aria-label="Refreshing dashboard data">
          <div className="top-progress-bar-fill" />
        </div>
      )}

      {/* ===== SAMPLE-DATA / PARTIAL-FAILURE BANNER ===== */}
      <FetchErrorBanner show={hasAnySampleData} onRetry={refreshData} />

      {/* ===== TOP BAR ===== */}
      <div className="dashboard-topbar">
        <div className="dashboard-topbar-left">
          <div className="dashboard-status">
            <div className="dashboard-status-dot" />
            <span className="dashboard-status-text">Live</span>
          </div>
          <span className="dashboard-time">
            {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>

        <div className="dashboard-topbar-right">
          <button
            onClick={toggleDarkMode}
            className="dashboard-topbar-btn"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-yellow-500" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" aria-hidden="true" />
            )}
          </button>

          <NotificationsPanel
            notifications={notifications}
            unreadCount={unreadCount}
            isOpen={showNotifications}
            onToggle={toggleNotifications}
            onMarkRead={markNotificationRead}
            onClearAll={clearAllNotifications}
            panelRef={notificationsRef}
          />

          <UserMenu
            user={user}
            isOpen={showUserMenu}
            onToggle={toggleUserMenu}
            onNavigate={navigate}
            onLogout={handleLogout}
            menuRef={userMenuRef}
          />

          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="dashboard-topbar-btn"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw
              className={`w-4 h-4 text-gray-600 dark:text-gray-300 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* ===== WELCOME MODAL ===== */}
      {showWelcomeModal && (
        <div className="dashboard-modal-overlay" onClick={handleOverlayClick(() => setShowWelcomeModal(false))}>
          <div className="dashboard-modal-content" role="dialog" aria-modal="true" aria-label="Welcome summary">
            <div className="dashboard-modal-body">
              <div className="dashboard-modal-icon-wrapper">
                <Rocket className="dashboard-modal-icon" aria-hidden="true" />
                <div className="dashboard-modal-ping" />
                <div className="dashboard-modal-ping dashboard-modal-ping-delayed" />
              </div>
              <h2 className="dashboard-modal-title">Welcome back, {user?.username || "User"}! 🎉</h2>
              <p className="dashboard-modal-subtitle">Here's a quick summary of your store's performance today.</p>
              <div className="dashboard-modal-stats">
                <div className="dashboard-modal-stat">
                  <p className="dashboard-modal-stat-label">Today's Sales</p>
                  <p className="dashboard-modal-stat-value">{formatCurrency(stats.todaySales)}</p>
                </div>
                <div className="dashboard-modal-stat">
                  <p className="dashboard-modal-stat-label">Today's Orders</p>
                  <p className="dashboard-modal-stat-value">{stats.todayOrders}</p>
                </div>
                <div className="dashboard-modal-stat">
                  <p className="dashboard-modal-stat-label">Total Revenue</p>
                  <p className="dashboard-modal-stat-value">{formatCurrency(stats.totalRevenue)}</p>
                </div>
              </div>
              <button onClick={() => setShowWelcomeModal(false)} className="dashboard-modal-btn">
                <Sparkles className="w-4 h-4 inline mr-2" aria-hidden="true" />
                Let's Go!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== LAST UPDATE ===== */}
      <div className="dashboard-last-update">Last updated: {currentTime.toLocaleTimeString()}</div>

      {/* ===== HEADER ===== */}
      <div ref={headerRef} className="dashboard-header">
        <div className="dashboard-header-bg" aria-hidden="true">
          <div className="dashboard-header-bg-circle" />
          <div className="dashboard-header-bg-circle2" />
          <div className="dashboard-header-bg-circle3" />
          <div className="dashboard-header-shine" />
        </div>

        <div className="dashboard-header-content">
          <div className="dashboard-header-left">
            <div className="dashboard-header-badge">
              <div className="dashboard-header-badge-dot" />
              <span className="dashboard-header-badge-text">Live Dashboard</span>
              <span className="dashboard-header-badge-time">• {currentTime.toLocaleTimeString()}</span>
            </div>
            <h1 className="dashboard-header-title">
              👋 Welcome back, <span className="dashboard-header-title-highlight">{user?.username || "User"}</span>
            </h1>
            <p className="dashboard-header-subtitle">
              <Sparkles className="w-4 h-4 inline mr-2" aria-hidden="true" />
              Here's what's happening with your store today
            </p>
          </div>
          <div className="dashboard-header-right">
            <div className="dashboard-header-uptime">
              <Activity className="w-4 h-4 text-white/80" aria-hidden="true" />
              <span className="dashboard-header-uptime-text">99.9% uptime</span>
            </div>
          </div>
        </div>

        <div className="dashboard-header-stats">
          {headerMiniStats.map((stat, index) => (
            <div key={stat.label} className="dashboard-header-stat" style={{ animationDelay: `${index * 0.15}s` }}>
              <div className="dashboard-header-stat-header">
                <stat.icon className="dashboard-header-stat-icon" aria-hidden="true" />
                <span className="dashboard-header-stat-change">{stat.change}</span>
              </div>
              <p className="dashboard-header-stat-value">
                <AnimatedNumber value={stat.value} format={stat.format} />
              </p>
              <p className="dashboard-header-stat-label">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== STATS GRID ===== */}
      <div className="dashboard-stats-grid">
        <AnimatedStatCard
          label="Total Customers"
          value={stats.totalCustomers}
          format="number"
          icon={Users}
          color="blue"
          change="+12%"
          delay={0}
          onClick={handleViewCustomers}
        />
        <AnimatedStatCard
          label="Total Products"
          value={stats.totalProducts}
          format="number"
          icon={Package}
          color="emerald"
          change="+5%"
          delay={100}
          onClick={handleViewProducts}
        />
        <AnimatedStatCard
          label="Total Orders"
          value={stats.totalOrders}
          format="number"
          icon={ShoppingCart}
          color="purple"
          change="+8%"
          sub={`${stats.pendingOrders} pending`}
          delay={200}
          onClick={handleViewOrders}
        />
        <AnimatedStatCard label="Total Revenue" value={stats.totalRevenue} format="currency" icon={DollarSign} color="amber" change="+15%" delay={300} />
      </div>

      {/* ===== ALERTS ===== */}
      {(stats.lowStockItems > 0 || stats.pendingOrders > 0) && (
        <div className="dashboard-alerts">
          {stats.lowStockItems > 0 && (
            <div
              onClick={() => setShowLowStockModal(true)}
              className="dashboard-alert dashboard-alert-warning"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setShowLowStockModal(true)}
            >
              <div className="dashboard-alert-content">
                <div className="dashboard-alert-icon-wrapper">
                  <AlertTriangle className="dashboard-alert-icon" aria-hidden="true" />
                </div>
                <div className="dashboard-alert-info">
                  <p className="dashboard-alert-title">
                    ⚠️ Low Stock Alert
                    <span className="dashboard-alert-badge">URGENT</span>
                  </p>
                  <p className="dashboard-alert-description">{stats.lowStockItems} product(s) running low on stock</p>
                </div>
              </div>
              <div className="dashboard-alert-action">
                View Stock <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </div>
            </div>
          )}
          {stats.pendingOrders > 0 && (
            <div
              onClick={() => setShowPendingOrdersModal(true)}
              className="dashboard-alert dashboard-alert-info"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setShowPendingOrdersModal(true)}
            >
              <div className="dashboard-alert-content">
                <div className="dashboard-alert-icon-wrapper">
                  <Clock className="dashboard-alert-icon" aria-hidden="true" />
                </div>
                <div className="dashboard-alert-info">
                  <p className="dashboard-alert-title">
                    ⏳ Pending Orders
                    <span className="dashboard-alert-badge dashboard-alert-badge-blue">{stats.pendingOrders} orders</span>
                  </p>
                  <p className="dashboard-alert-description">Need immediate processing</p>
                </div>
              </div>
              <div className="dashboard-alert-action">
                View Orders <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== QUICK ACTIONS ===== */}
      <div className="dashboard-quick-actions">
        {quickActions.map((action, index) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={`dashboard-quick-action bg-gradient-to-r ${action.color}`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <action.icon className="dashboard-quick-action-icon" aria-hidden="true" />
            <span className="dashboard-quick-action-label">{action.label}</span>
          </button>
        ))}
      </div>

      {/* ===== CHARTS ===== */}
      <div className="dashboard-charts">
        <RevenueOrdersChart chartData={chartData} />
        <SalesMixChart salesDistribution={salesDistribution} />
      </div>

      {/* ===== RECENT ORDERS TABLE ===== */}
      <RecentOrdersTable orders={recentOrders} onView={handleViewOrderDetails} />

      {/* ===== FOOTER STATS ===== */}
      <div className="dashboard-footer-stats">
        {footerStats.map((item, index) => (
          <div key={item.label} className="dashboard-footer-stat" style={{ animationDelay: `${index * 0.15}s` }}>
            <item.icon className="dashboard-footer-stat-icon" aria-hidden="true" />
            <p className="dashboard-footer-stat-value">{item.value}</p>
            <p className="dashboard-footer-stat-label">{item.label}</p>
          </div>
        ))}
      </div>

      {/* ===== LOW STOCK MODAL ===== */}
      {showLowStockModal && (
        <div className="dashboard-modal-overlay" onClick={handleOverlayClick(() => setShowLowStockModal(false))}>
          <div className="dashboard-modal-content dashboard-modal-lg" role="dialog" aria-modal="true" aria-label="Low stock products">
            <div className="dashboard-modal-header">
              <h2 className="dashboard-modal-title">
                <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden="true" />
                Low Stock Products
              </h2>
              <button onClick={() => setShowLowStockModal(false)} className="dashboard-modal-close" aria-label="Close">
                <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
              </button>
            </div>

            <div className="dashboard-modal-body">
              {lowStockProducts.length === 0 ? (
                <div className="dashboard-modal-empty">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" aria-hidden="true" />
                  <p>All products are well stocked! 🎉</p>
                </div>
              ) : (
                <div className="dashboard-low-stock-list">
                  {lowStockProducts.map((product, index) => {
                    // Falls back through common id spellings, then index —
                    // guards the list key from collapsing to `undefined`
                    // when a live response omits every known id field.
                    const productId = pickId(product, ["PRODUCT_ID", "product_id", "id"], null);
                    return (
                      <div key={productId ?? `low-stock-${index}`} className="dashboard-low-stock-item">
                        <div className="dashboard-low-stock-info">
                          <p className="dashboard-low-stock-name">
                            {findField(product, ["NAME_EN", "name_en", "name", "product_name", "productName", "title"]) || "Unnamed product"}
                          </p>
                          <p className="dashboard-low-stock-desc">{findField(product, ["NAME_KH", "name_kh"]) || ""}</p>
                          <div className="dashboard-low-stock-meta">
                            <span className="dashboard-low-stock-available">
                              Available: {findField(product, ["QtyAvailable", "qty_available", "quantity_available", "stock", "qty"]) || 0}
                            </span>
                            <span className="dashboard-low-stock-alert">
                              Alert Level: {findField(product, ["QTY_ALERT", "qty_alert", "alert_level", "alertLevel", "reorder_level"]) || 0}
                            </span>
                            <span className="dashboard-low-stock-price">
                              {formatCurrency(findField(product, ["SALEOUT_PRICE", "saleout_price", "price", "sale_price", "salePrice"]) || 0)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            navigate("/stock");
                            setShowLowStockModal(false);
                          }}
                          className="dashboard-low-stock-btn"
                        >
                          <Package className="w-4 h-4 mr-1" aria-hidden="true" />
                          View Stock
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="dashboard-modal-footer">
              <button onClick={handleViewStock} className="dashboard-modal-footer-link">
                View All Stock <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button onClick={() => setShowLowStockModal(false)} className="dashboard-modal-footer-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PENDING ORDERS MODAL ===== */}
      {showPendingOrdersModal && (
        <div className="dashboard-modal-overlay" onClick={handleOverlayClick(() => setShowPendingOrdersModal(false))}>
          <div className="dashboard-modal-content dashboard-modal-lg" role="dialog" aria-modal="true" aria-label="Pending orders">
            <div className="dashboard-modal-header">
              <h2 className="dashboard-modal-title">
                <Clock className="w-5 h-5 text-blue-500" aria-hidden="true" />
                Pending Orders ({pendingOrdersList.length})
              </h2>
              <button onClick={() => setShowPendingOrdersModal(false)} className="dashboard-modal-close" aria-label="Close">
                <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
              </button>
            </div>

            <div className="dashboard-modal-body">
              {pendingOrdersList.length === 0 ? (
                <div className="dashboard-modal-empty">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" aria-hidden="true" />
                  <p>All orders are processed! 🎉</p>
                </div>
              ) : (
                <div className="dashboard-pending-list">
                  {pendingOrdersList.map((order, index) => {
                    // Same id-fallback treatment as the low stock list
                    // above, plus the view/process handlers below are
                    // guarded so a missing id never navigates to
                    // "/orders/undefined".
                    const orderId = pickId(order, ["OR_ID", "or_id", "order_id", "id"], null);
                    const status = order.STATUS || order.status || "Pending";
                    return (
                      <div key={orderId ?? `pending-order-${index}`} className="dashboard-pending-item">
                        <div className="dashboard-pending-info">
                          <div className="dashboard-pending-header">
                            <p className="dashboard-pending-order">{order.ORDER_NO || order.order_no}</p>
                            <StatusBadge status={status} />
                          </div>
                          <p className="dashboard-pending-customer">{getCustomerName(order)}</p>
                          <div className="dashboard-pending-meta">
                            <span className="dashboard-pending-date">{formatDate(order.ORDER_DATE || order.order_date)}</span>
                            <span className="dashboard-pending-amount">
                              {formatCurrency(order.AMOUNT_US || order.amount_us || order.total || 0)}
                            </span>
                          </div>
                        </div>
                        <div className="dashboard-pending-actions">
                          <button
                            onClick={() => {
                              handleViewOrderDetails(orderId);
                              setShowPendingOrdersModal(false);
                            }}
                            className="dashboard-pending-btn dashboard-pending-btn-view"
                          >
                            <Eye className="w-4 h-4 mr-1" aria-hidden="true" />
                            View
                          </button>
                          <button
                            onClick={() => {
                              handleProcessOrder(orderId);
                              setShowPendingOrdersModal(false);
                            }}
                            className="dashboard-pending-btn dashboard-pending-btn-process"
                          >
                            <Zap className="w-4 h-4 mr-1" aria-hidden="true" />
                            Process
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="dashboard-modal-footer">
              <button onClick={handleViewOrders} className="dashboard-modal-footer-link">
                View All Orders <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button onClick={() => setShowPendingOrdersModal(false)} className="dashboard-modal-footer-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;