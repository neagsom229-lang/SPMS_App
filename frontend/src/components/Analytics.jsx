// Analytics.jsx - Real data, computed from actual orders/customers/products
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import apiClient from '../api/client';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, AreaChart, Area, ComposedChart,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Calendar, DollarSign, ShoppingBag, Users,
  Download, RefreshCw, Clock, Award, Package,
  User, ChevronDown, Search, AlertCircle, CheckCircle, XCircle,
  Database, Printer, ClipboardList, FileSpreadsheet,
  Zap, Activity, BarChart3, PieChart as PieChartIcon,
  Loader2, Shield, File, Target,
  Sparkles, Rocket, Crown,
  AreaChart as AreaChartIcon, Gem, Gift, Heart,
  Flower2, Feather, Percent
} from 'lucide-react';

import '../styles/analytics.css';

// ============================================
// DEBUG LOGGING (dev-only, no longer registered on the shared apiClient)
// ============================================
// FIX: previously these were axios interceptors attached directly to the
// shared `apiClient` singleton at module scope. That meant EVERY component
// using apiClient (Users.jsx, etc.) triggered Analytics' console logs too,
// which is why the console showed triplicate log lines for the same
// request. Interceptors also never got ejected, so remounts/HMR could
// stack duplicate interceptors. We now just log locally, only in dev,
// scoped to this component's own requests.
const DEBUG = import.meta.env?.DEV ?? false;
const debugLog = (...args) => { if (DEBUG) console.log(...args); };
const debugError = (...args) => { if (DEBUG) console.error(...args); };

// ============================================
// CONSTANTS
// ============================================
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f472b6', '#8b5cf6'];

// How many most-recent orders we fetch line-item detail for, to compute
// product-level revenue/profit. Order LIST data (date/total/customer) is
// always complete; only per-PRODUCT breakdowns are limited by this cap.
const DETAIL_FETCH_CAP = 200;

const STAT_CARDS = [
  { id: 'revenue', icon: DollarSign, title: 'Total Revenue', format: 'currency', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', gradient: 'from-green-500 to-emerald-600' },
  { id: 'orders', icon: ShoppingBag, title: 'Total Orders', format: 'number', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', gradient: 'from-blue-500 to-indigo-600' },
  { id: 'products', icon: Package, title: 'Products Sold', format: 'number', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', gradient: 'from-purple-500 to-pink-600' },
  { id: 'avgOrder', icon: Users, title: 'Average Order Value', format: 'currency', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', gradient: 'from-orange-500 to-amber-600' }
];

const TABS = [
  { id: 'overview', label: 'Overview', icon: TrendingUp, color: 'indigo' },
  { id: 'products', label: 'Products', icon: Package, color: 'green' },
  { id: 'customers', label: 'Customers', icon: Users, color: 'purple' },
  { id: 'reports', label: 'Reports', icon: File, color: 'pink' }
];

const DATE_RANGES = {
  last30days: { label: 'Last 30 Days', days: 30 },
  last90days: { label: 'Last 90 Days', days: 90 },
  last6months: { label: 'Last 6 Months', days: 182 },
  last12months: { label: 'Last 12 Months', days: 365 }
};

// ============================================
// NUMERIC / FORMAT HELPERS
// ============================================
const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(num(value));

const formatCurrencyCompact = (value) => {
  const n = num(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: n >= 1000 ? 0 : 2,
    maximumFractionDigits: n >= 1000 ? 0 : 2
  }).format(n);
};

const parseDateSafe = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

// ============================================
// DATE RANGE HELPERS
// ============================================
const getRangeBounds = (rangeKey) => {
  const days = DATE_RANGES[rangeKey]?.days ?? 182;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start, end };
};

const getPreviousRangeBounds = (rangeKey) => {
  const days = DATE_RANGES[rangeKey]?.days ?? 182;
  const { start } = getRangeBounds(rangeKey);
  const prevEnd = new Date(start);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  return { start: prevStart, end: prevEnd };
};

const buildMonthBuckets = (start, end) => {
  const buckets = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
  let guard = 0;
  while (cursor <= endCursor && guard < 60) {
    buckets.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      year: cursor.getFullYear(),
      monthIndex: cursor.getMonth()
    });
    cursor.setMonth(cursor.getMonth() + 1);
    guard += 1;
  }
  return buckets;
};

const monthKeyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// ============================================
// PERCENT-CHANGE HELPER
// ============================================
const percentChange = (current, previous) => {
  if (!previous) return null; // no baseline to compare against
  return ((current - previous) / previous) * 100;
};

// ============================================
// ANIMATED BACKGROUND EFFECTS
// ============================================
const AnimatedBackground = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.15 + 0.05
    }));
  }, []);

  return (
    <div className="analytics-bg">
      {particles.map((p) => (
        <div
          key={p.id}
          className="bg-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            opacity: p.opacity
          }}
        />
      ))}
      <div className="bg-gradient-overlay" />
    </div>
  );
};

// ============================================
// FLOATING ICONS
// ============================================
const FloatingIcons = () => {
  const icons = [
    { Icon: Sparkles, delay: 0, x: 5, y: 8 },
    { Icon: Gem, delay: 2, x: 92, y: 12 },
    { Icon: Rocket, delay: 4, x: 10, y: 85 },
    { Icon: Crown, delay: 1.5, x: 88, y: 88 },
    { Icon: Flower2, delay: 3.5, x: 50, y: 5 },
    { Icon: Feather, delay: 5, x: 45, y: 95 },
    { Icon: Heart, delay: 2.5, x: 75, y: 40 },
    { Icon: Gift, delay: 4.5, x: 25, y: 55 },
  ];

  return (
    <div className="analytics-floating-icons">
      {icons.map(({ Icon, delay, x, y }, i) => (
        <div
          key={i}
          className="floating-icon"
          style={{
            animationDelay: `${delay}s`,
            left: `${x}%`,
            top: `${y}%`
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
      ))}
    </div>
  );
};

// ============================================
// ANIMATED SUB-COMPONENTS
// ============================================
const AnimatedCounter = ({ value, duration = 1200, format = 'number', prefix = '', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef(null);
  const animationRef = useRef(null);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (elementRef.current) observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const endValue = num(value);

    if (prefersReducedMotion.current) {
      setDisplayValue(endValue);
      return;
    }

    const startValue = 0;
    const startTime = performance.now();

    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (endValue - startValue) * eased);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(updateCounter);
      }
    };

    animationRef.current = requestAnimationFrame(updateCounter);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [value, duration, isVisible]);

  const formatValue = (val) => {
    if (format === 'currency') return formatCurrencyCompact(val);
    if (val >= 1000) return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return Math.round(val).toString();
  };

  return (
    <span ref={elementRef}>
      {isVisible ? `${prefix}${formatValue(displayValue)}${suffix}` : (format === 'currency' ? '$0' : '0')}
    </span>
  );
};

const AnimatedCard = ({ children, delay = 0, className = '' }) => (
  <div className={`animate-float-card ${className}`} style={{ animationDelay: `${delay}ms` }}>
    {children}
  </div>
);

const PulseDot = ({ active = true }) => (
  <span className={`inline-flex items-center gap-2 ${active ? 'text-green-500' : 'text-gray-400'}`}>
    <span className="relative flex h-2.5 w-2.5">
      {active && (
        <>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </>
      )}
      {!active && <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-400" />}
    </span>
  </span>
);

// ============================================
// STAT CARD
// ============================================
const StatCard = ({ icon: Icon, title, value, subtitle, color, bgColor, gradient, trend, format, index }) => {
  const [isHovered, setIsHovered] = useState(false);

  const trendColor = trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-400';
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : null;

  return (
    <AnimatedCard delay={index * 100}>
      <div
        className="stat-card-enhanced"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          transform: isHovered ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        role="group"
        aria-label={`${title}: ${format === 'currency' ? formatCurrencyCompact(value) : num(value).toLocaleString()}`}
      >
        <div className={`stat-card-gradient ${gradient}`} />
        <div className="stat-card-shimmer" />

        <div className="stat-card-content">
          <div className="stat-card-header">
            <div className="stat-card-icon-wrapper">
              <div className={`stat-card-icon ${bgColor}`}>
                <Icon className={`w-5 h-5 ${color}`} aria-hidden="true" />
              </div>
              <div>
                <p className="stat-card-title">{title}</p>
                <p className="stat-card-value">
                  <AnimatedCounter value={value} format={format} />
                </p>
                {subtitle && (
                  <p className="stat-card-subtitle">
                    <Activity className="w-3 h-3" aria-hidden="true" />
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {trend !== undefined && trend !== null && (
              <div className={`stat-card-trend ${trendColor}`}>
                {TrendIcon && <TrendIcon className="w-4 h-4" aria-hidden="true" />}
                {trend !== 0 && `${Math.abs(trend).toFixed(1)}%`}
              </div>
            )}
          </div>
        </div>

        <div className="stat-card-progress">
          <div className="stat-card-progress-bar" />
        </div>
      </div>
    </AnimatedCard>
  );
};

// ============================================
// LOADING SKELETON
// ============================================
const LoadingSkeleton = () => (
  <div className="loading-skeleton" role="status" aria-live="polite">
    <div className="loading-skeleton-content">
      <div className="loading-spinner">
        <div className="spinner-ring" />
        <div className="spinner-ring" />
        <div className="spinner-ring" />
        <TrendingUp className="spinner-icon" />
      </div>
      <div className="loading-text">
        <p className="loading-title">Loading Analytics Dashboard</p>
        <p className="loading-subtitle">Pulling real order &amp; customer data...</p>
      </div>
      <div className="loading-progress">
        <div className="progress-track">
          <div className="progress-fill" />
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// TOAST NOTIFICATION
// ============================================
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: CheckCircle,
    warning: AlertCircle,
    error: XCircle
  };
  const Icon = icons[type] || CheckCircle;

  return (
    <div className={`toast-notification toast-${type}`} role="status" aria-live="polite">
      <div className="toast-content">
        <Icon className="toast-icon" aria-hidden="true" />
        <span className="toast-message-text">{message}</span>
        <button onClick={onClose} className="toast-close-btn" aria-label="Close notification">
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const Analytics = () => {
  // ===== RAW DATA STATE (all real, fetched from the API) =====
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItemsById, setOrderItemsById] = useState({}); // orderId -> items[] (bounded by DETAIL_FETCH_CAP)
  const [detailCoverage, setDetailCoverage] = useState({ fetched: 0, total: 0 });

  // ===== UI STATE =====
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeView, setActiveView] = useState('overview');
  const [reportType, setReportType] = useState('monthlySales');
  const [dateRange, setDateRange] = useState('last6months');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [toast, setToast] = useState(null);

  // ===== REFS =====
  const statsRef = useRef(null);
  const isMounted = useRef(true);
  const exportMenuRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  // ============================================
  // FETCH ALL REAL DATA
  // ============================================
  const fetchAllData = useCallback(async () => {
    try {
      const [customersRes, productsRes, ordersRes] = await Promise.all([
        apiClient.get('/customers'),
        apiClient.get('/products'),
        apiClient.get('/orders', { params: { limit: 1000 } })
      ]);

      if (!isMounted.current) return;

      const customersData = Array.isArray(customersRes.data)
        ? customersRes.data
        : (Array.isArray(customersRes.data?.data) ? customersRes.data.data : []);
      const productsData = Array.isArray(productsRes.data)
        ? productsRes.data
        : (Array.isArray(productsRes.data?.data) ? productsRes.data.data : []);
      const ordersData = Array.isArray(ordersRes.data)
        ? ordersRes.data
        : (Array.isArray(ordersRes.data?.data) ? ordersRes.data.data : []);

      setCustomers(customersData);
      setProducts(productsData);
      setOrders(ordersData);

      debugLog(`👥 Customers loaded: ${customersData.length}`);
      debugLog(`📦 Products loaded: ${productsData.length}`);
      debugLog(`🛒 Orders loaded: ${ordersData.length}`);

      // Fetch line-item detail for the most recent orders only (bounded),
      // used for product-level revenue/profit breakdowns.
      const ordersForDetail = [...ordersData]
        .filter(o => parseDateSafe(o.date))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, DETAIL_FETCH_CAP);

      const detailResults = await Promise.allSettled(
        ordersForDetail.map(o => apiClient.get(`/orders/${o.id}`))
      );

      if (!isMounted.current) return;

      const detailMap = {};
      let fetchedCount = 0;
      detailResults.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          detailMap[ordersForDetail[idx].id] = Array.isArray(res.value.data?.items) ? res.value.data.items : [];
          fetchedCount += 1;
        }
      });

      setOrderItemsById(detailMap);
      setDetailCoverage({ fetched: fetchedCount, total: ordersData.length });
    } catch (error) {
      debugError('❌ Error loading analytics data:', error);
      if (isMounted.current) {
        showToast('Failed to load analytics data from the server', 'error');
      }
    }
  }, [showToast]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await fetchAllData();
    if (isMounted.current) setLoading(false);
  }, [fetchAllData]);

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    isMounted.current = true;
    loadAllData();
    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearchQuery(searchQuery), 200);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showExportMenu]);

  // ===== HANDLERS =====
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAllData();
    setIsRefreshing(false);
    showToast('Data refreshed successfully', 'success');
  }, [fetchAllData, showToast]);

  const handleCustomerSelect = useCallback((e) => {
    setSelectedCustomer(e.target.value);
  }, []);

  // ============================================
  // LOOKUP MAPS (products / customers keyed by numeric id)
  // ============================================
  const productsById = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p.id] = p; });
    return map;
  }, [products]);

  const customersById = useMemo(() => {
    const map = {};
    customers.forEach(c => { map[c.id] = c; });
    return map;
  }, [customers]);

  // ============================================
  // DATE-RANGE-FILTERED ORDERS
  // ============================================
  const { ordersInRange, ordersInPrevRange } = useMemo(() => {
    const { start, end } = getRangeBounds(dateRange);
    const { start: prevStart, end: prevEnd } = getPreviousRangeBounds(dateRange);

    const inRange = [];
    const inPrevRange = [];

    orders.forEach(o => {
      const d = parseDateSafe(o.date);
      if (!d) return;
      if (d >= start && d <= end) inRange.push(o);
      else if (d >= prevStart && d < prevEnd) inPrevRange.push(o);
    });

    return { ordersInRange: inRange, ordersInPrevRange: inPrevRange };
  }, [orders, dateRange]);

  // ============================================
  // PRODUCT-LEVEL ITEMS WITHIN RANGE (from the bounded detail fetch)
  // ============================================
  const itemsInRange = useMemo(() => {
    const items = [];
    ordersInRange.forEach(o => {
      const orderItems = orderItemsById[o.id];
      if (!orderItems) return; // detail not fetched for this order (outside cap)
      orderItems.forEach(it => items.push({ ...it, __orderId: o.id }));
    });
    return items;
  }, [ordersInRange, orderItemsById]);

  // ============================================
  // SUMMARY METRICS (all real, with real period-over-period growth)
  // ============================================
  const summary = useMemo(() => {
    const totalRevenue = ordersInRange.reduce((sum, o) => sum + num(o.total), 0);
    const totalOrders = ordersInRange.length;
    const prevRevenue = ordersInPrevRange.reduce((sum, o) => sum + num(o.total), 0);
    const prevOrders = ordersInPrevRange.length;

    const distinctProductIds = new Set(itemsInRange.map(it => it.product_id));
    const totalProductsSold = distinctProductIds.size;

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    let totalCost = 0;
    itemsInRange.forEach(it => {
      const cost = num(productsById[it.product_id]?.buyin_price);
      totalCost += num(it.qty) * cost;
    });
    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    const distinctCustomersInRange = new Set(ordersInRange.map(o => o.customer_id));
    const distinctCustomersInPrevRange = new Set(ordersInPrevRange.map(o => o.customer_id));

    const customerOrderCounts = {};
    ordersInRange.forEach(o => {
      customerOrderCounts[o.customer_id] = (customerOrderCounts[o.customer_id] || 0) + 1;
    });
    const repeatCustomers = Object.values(customerOrderCounts).filter(c => c > 1).length;
    const repeatCustomerRate = distinctCustomersInRange.size > 0
      ? (repeatCustomers / distinctCustomersInRange.size) * 100
      : 0;

    // FIX: previous formula returned 0% coverage whenever itemsInRange was
    // empty even if every in-range order legitimately HAD its detail
    // fetched (e.g. orders with zero line items, or simply no orders in
    // range). Now we directly measure how many in-range orders have an
    // entry in orderItemsById, regardless of whether that entry is empty.
    const itemDetailCoverage = ordersInRange.length === 0
      ? 100
      : Math.round(
          (ordersInRange.filter(o => orderItemsById[o.id] !== undefined).length / ordersInRange.length) * 100
        );

    return {
      totalRevenue,
      totalOrders,
      totalProductsSold,
      averageOrderValue,
      profit,
      profitMargin,
      revenueGrowth: percentChange(totalRevenue, prevRevenue),
      orderGrowth: percentChange(totalOrders, prevOrders),
      customerGrowth: percentChange(distinctCustomersInRange.size, distinctCustomersInPrevRange.size),
      repeatCustomerRate,
      totalCustomersInRange: distinctCustomersInRange.size,
      itemDetailCoverage
    };
  }, [ordersInRange, ordersInPrevRange, itemsInRange, productsById, orderItemsById]);

  // ============================================
  // MONTHLY CHART DATA (revenue / orders / profit / customers per month, in-range)
  // ============================================
  const monthlyChartData = useMemo(() => {
    const { start, end } = getRangeBounds(dateRange);
    const buckets = buildMonthBuckets(start, end);
    const bucketMap = {};
    buckets.forEach(b => {
      bucketMap[b.key] = { month: b.label, revenue: 0, orders: 0, profit: 0, customerSet: new Set() };
    });

    ordersInRange.forEach(o => {
      const d = parseDateSafe(o.date);
      if (!d) return;
      const key = monthKeyOf(d);
      if (!bucketMap[key]) return;
      bucketMap[key].revenue += num(o.total);
      bucketMap[key].orders += 1;
      bucketMap[key].customerSet.add(o.customer_id);

      const items = orderItemsById[o.id];
      if (items) {
        items.forEach(it => {
          const cost = num(productsById[it.product_id]?.buyin_price);
          bucketMap[key].profit += num(it.subtotal) - (num(it.qty) * cost);
        });
      }
    });

    return buckets.map(b => ({
      month: bucketMap[b.key].month,
      revenue: Math.round(bucketMap[b.key].revenue * 100) / 100,
      orders: bucketMap[b.key].orders,
      profit: Math.round(bucketMap[b.key].profit * 100) / 100,
      customers: bucketMap[b.key].customerSet.size
    }));
  }, [ordersInRange, orderItemsById, productsById, dateRange]);

  // ============================================
  // YEARLY CHART DATA (all orders, grouped by year — not range-limited)
  // ============================================
  const yearlyChartData = useMemo(() => {
    const byYear = {};
    orders.forEach(o => {
      const d = parseDateSafe(o.date);
      if (!d) return;
      const year = d.getFullYear();
      if (!byYear[year]) byYear[year] = { year: String(year), revenue: 0, orders: 0 };
      byYear[year].revenue += num(o.total);
      byYear[year].orders += 1;
    });
    return Object.values(byYear)
      .sort((a, b) => Number(a.year) - Number(b.year))
      .map(y => ({ ...y, revenue: Math.round(y.revenue * 100) / 100 }));
  }, [orders]);

  // ============================================
  // PRODUCT PERFORMANCE (from item-level detail, in-range)
  // ============================================
  const productPerformance = useMemo(() => {
    const byProduct = {};
    itemsInRange.forEach(it => {
      const pid = it.product_id;
      const name = it.product_name || productsById[pid]?.name_en || 'Unknown Product';
      if (!byProduct[pid]) {
        byProduct[pid] = { product_id: pid, product_name: name, total_sold: 0, revenue: 0, profit: 0 };
      }
      const cost = num(productsById[pid]?.buyin_price);
      byProduct[pid].total_sold += num(it.qty);
      byProduct[pid].revenue += num(it.subtotal);
      byProduct[pid].profit += num(it.subtotal) - (num(it.qty) * cost);
    });

    return Object.values(byProduct)
      .map(p => ({
        ...p,
        revenue: Math.round(p.revenue * 100) / 100,
        profit: Math.round(p.profit * 100) / 100,
        marginPct: p.revenue > 0 ? Math.round((p.profit / p.revenue) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [itemsInRange, productsById]);

  const filteredProducts = useMemo(() => {
    if (!debouncedSearchQuery) return productPerformance;
    const query = debouncedSearchQuery.toLowerCase();
    return productPerformance.filter(p => p.product_name?.toLowerCase().includes(query));
  }, [productPerformance, debouncedSearchQuery]);

  // ============================================
  // CUSTOMER ANALYTICS (from real orders, in-range)
  // ============================================
  const customerAnalytics = useMemo(() => {
    const byCustomer = {};
    ordersInRange.forEach(o => {
      const cid = o.customer_id;
      if (!byCustomer[cid]) {
        const customer = customersById[cid];
        const name = o.customer_name
          || (customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : null)
          || 'Unknown Customer';
        byCustomer[cid] = { customer_id: cid, name, orders: 0, totalSpent: 0, lastOrder: null };
      }
      byCustomer[cid].orders += 1;
      byCustomer[cid].totalSpent += num(o.total);
      const d = parseDateSafe(o.date);
      if (d && (!byCustomer[cid].lastOrder || d > byCustomer[cid].lastOrder)) {
        byCustomer[cid].lastOrder = d;
      }
    });

    const list = Object.values(byCustomer);
    const avgSpent = list.length > 0
      ? list.reduce((s, c) => s + c.totalSpent, 0) / list.length
      : 0;

    return list
      .map(c => ({
        ...c,
        avgOrder: c.orders > 0 ? c.totalSpent / c.orders : 0,
        lastOrder: c.lastOrder ? c.lastOrder.toISOString().split('T')[0] : null,
        segment: c.totalSpent >= avgSpent * 1.5 ? 'VIP' : (c.orders > 1 ? 'Regular' : 'New')
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [ordersInRange, customersById]);

  // ============================================
  // SELECTED CUSTOMER PURCHASE HISTORY (real, unfiltered by date range)
  // ============================================
  const selectedCustomerRecord = useMemo(
    () => customers.find(c => String(c.id ?? c.cus_id) === String(selectedCustomer)),
    [customers, selectedCustomer]
  );

  const customerHistory = useMemo(() => {
    if (!selectedCustomer) return [];
    return orders
      .filter(o => String(o.customer_id) === String(selectedCustomer))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, selectedCustomer]);

  // ===== EXPORT HELPERS =====
  const escapeCsvField = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const downloadCsv = (csv, filename) => {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleExport = useCallback(async () => {
    const data = activeView === 'products' ? filteredProducts : monthlyChartData;
    if (!data || data.length === 0) {
      showToast('No data to export', 'warning');
      return;
    }

    setExportLoading(true);
    setShowExportMenu(false);

    try {
      const isProductData = activeView === 'products';
      const headers = isProductData
        ? ['Product Name', 'Units Sold', 'Revenue', 'Profit', 'Margin %']
        : ['Month', 'Revenue', 'Orders', 'Profit', 'Customers'];

      let csv = headers.join(',') + '\n';
      data.forEach(item => {
        const row = isProductData
          ? [escapeCsvField(item.product_name), num(item.total_sold), num(item.revenue), num(item.profit), num(item.marginPct)]
          : [escapeCsvField(item.month), num(item.revenue), num(item.orders), num(item.profit), num(item.customers)];
        csv += row.join(',') + '\n';
      });

      downloadCsv(csv, `${activeView}_data_${new Date().toISOString().slice(0, 10)}.csv`);
      showToast('Export successful', 'success');
    } catch (error) {
      debugError('❌ Export error:', error);
      showToast('Export failed', 'error');
    } finally {
      setExportLoading(false);
    }
  }, [activeView, filteredProducts, monthlyChartData, showToast]);

  const exportReport = useCallback(() => {
    setExportLoading(true);
    try {
      let csv = '';
      let filename = reportType;

      if (reportType === 'monthlySales') {
        csv = ['Month', 'Revenue', 'Orders', 'Profit', 'Customers'].join(',') + '\n';
        monthlyChartData.forEach(item => {
          csv += [escapeCsvField(item.month), num(item.revenue), num(item.orders), num(item.profit), num(item.customers)].join(',') + '\n';
        });
        filename = 'monthly_sales_report';
      } else if (reportType === 'productPerformance') {
        csv = ['Product', 'Units Sold', 'Revenue', 'Profit', 'Margin %'].join(',') + '\n';
        productPerformance.forEach(item => {
          csv += [escapeCsvField(item.product_name), num(item.total_sold), num(item.revenue), num(item.profit), num(item.marginPct)].join(',') + '\n';
        });
        filename = 'product_performance_report';
      } else if (reportType === 'customerAnalytics') {
        csv = ['Customer', 'Orders', 'Total Spent', 'Avg Order', 'Segment'].join(',') + '\n';
        customerAnalytics.forEach(item => {
          csv += [escapeCsvField(item.name), num(item.orders), num(item.totalSpent), num(item.avgOrder), item.segment].join(',') + '\n';
        });
        filename = 'customer_analytics_report';
      } else if (reportType === 'revenueSummary') {
        csv = ['Total Revenue', 'Total Orders', 'Total Customers', 'Avg Order Value', 'Profit Margin %', 'Repeat Customer %'].join(',') + '\n';
        csv += [
          num(summary.totalRevenue), num(summary.totalOrders), num(summary.totalCustomersInRange),
          num(summary.averageOrderValue), num(summary.profitMargin).toFixed(1), num(summary.repeatCustomerRate).toFixed(1)
        ].join(',') + '\n';
        filename = 'revenue_summary';
      }

      downloadCsv(csv, `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
      showToast('Report exported successfully', 'success');
    } catch (error) {
      debugError('❌ Export error:', error);
      showToast('Export failed', 'error');
    } finally {
      setExportLoading(false);
    }
  }, [reportType, monthlyChartData, productPerformance, customerAnalytics, summary, showToast]);

  const chartTooltipStyle = {
    backgroundColor: '#1f2937',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.35)'
  };

  // ===== REPORT RENDERERS (pure, synchronous — driven by useMemo above) =====
  const renderMonthlySales = () => {
    if (!monthlyChartData.length) return <div className="empty-state">No orders in this date range</div>;

    return (
      <div className="report-content-area">
        <div className="metric-grid">
          <div className="metric-tile metric-tile-green">
            <p className="metric-tile-label">Total Revenue</p>
            <p className="metric-tile-value">{formatCurrency(summary.totalRevenue)}</p>
          </div>
          <div className="metric-tile metric-tile-blue">
            <p className="metric-tile-label">Total Orders</p>
            <p className="metric-tile-value">{summary.totalOrders}</p>
          </div>
          <div className="metric-tile metric-tile-purple">
            <p className="metric-tile-label">Profit</p>
            <p className="metric-tile-value">{formatCurrency(summary.profit)}</p>
          </div>
          <div className="metric-tile metric-tile-indigo">
            <p className="metric-tile-label">Months Shown</p>
            <p className="metric-tile-value">{monthlyChartData.length}</p>
          </div>
        </div>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} />
              <YAxis yAxisId="left" stroke="#9ca3af" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={11} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => name === 'Orders' ? value : formatCurrency(value)} />
              <Legend />
              <Bar yAxisId="left" dataKey="revenue" fill="#6366f1" name="Revenue" radius={[4, 4, 0, 0]}>
                {monthlyChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
              <Bar yAxisId="left" dataKey="profit" fill="#10b981" name="Profit" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#8b5cf6" name="Orders" strokeWidth={2} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderProductPerformance = () => {
    if (!productPerformance.length) {
      return (
        <div className="empty-state">
          {summary.itemDetailCoverage < 100
            ? `No product data available for orders in this range (item detail limited to the most recent orders — ${summary.itemDetailCoverage}% coverage)`
            : 'No product sales in this date range'}
        </div>
      );
    }

    const top10 = productPerformance.slice(0, 10);

    return (
      <div className="report-content-area">
        <div className="metric-grid">
          <div className="metric-tile metric-tile-indigo">
            <p className="metric-tile-label">Top Product</p>
            <p className="metric-tile-value text-sm flex items-center gap-1">
              <Crown className="w-4 h-4 text-yellow-500" />
              {productPerformance[0]?.product_name || 'N/A'}
            </p>
          </div>
          <div className="metric-tile metric-tile-green">
            <p className="metric-tile-label">Highest Revenue</p>
            <p className="metric-tile-value">
              {formatCurrency(Math.max(...productPerformance.map(d => num(d.revenue))))}
            </p>
          </div>
          <div className="metric-tile metric-tile-yellow">
            <p className="metric-tile-label">Products Sold</p>
            <p className="metric-tile-value">{productPerformance.length}</p>
          </div>
        </div>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top10} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis type="number" stroke="#9ca3af" fontSize={11} />
              <YAxis type="category" dataKey="product_name" stroke="#9ca3af" fontSize={11} width={100} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend />
              <Bar dataKey="total_sold" fill="#6366f1" name="Units Sold" radius={[0, 4, 4, 0]}>
                {top10.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderCustomerAnalytics = () => {
    if (!customerAnalytics.length) return <div className="empty-state">No customer orders in this date range</div>;

    const totalSpentSum = customerAnalytics.reduce((sum, d) => sum + num(d.totalSpent), 0);

    const getInitials = (name) => {
      if (!name) return '?';
      const parts = name.split(' ').filter(Boolean);
      if (parts.length === 0) return '?';
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };
    const getSegmentColor = (seg) => {
      if (seg === 'VIP') return 'bg-gradient-to-r from-yellow-500 to-amber-500';
      if (seg === 'Regular') return 'bg-gradient-to-r from-blue-500 to-indigo-500';
      return 'bg-gradient-to-r from-green-500 to-emerald-500';
    };
    const getSegmentBadge = (seg) => {
      if (seg === 'VIP') return 'segment-badge-vip';
      if (seg === 'Regular') return 'segment-badge-regular';
      return 'segment-badge-default';
    };

    return (
      <div className="report-content-area">
        <div className="metric-grid">
          <div className="metric-tile metric-tile-blue">
            <p className="metric-tile-label">Total Customers</p>
            <p className="metric-tile-value">{customerAnalytics.length}</p>
          </div>
          <div className="metric-tile metric-tile-green">
            <p className="metric-tile-label">Total Spent</p>
            <p className="metric-tile-value">{formatCurrency(totalSpentSum)}</p>
          </div>
          <div className="metric-tile metric-tile-purple">
            <p className="metric-tile-label">Avg Spent</p>
            <p className="metric-tile-value">{formatCurrency(totalSpentSum / customerAnalytics.length)}</p>
          </div>
        </div>
        <div className="table-scroll-container">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Total Spent</th>
                <th className="text-right">Avg Order</th>
                <th className="text-center">Segment</th>
              </tr>
            </thead>
            <tbody>
              {customerAnalytics.map((item, i) => (
                <tr key={item.customer_id ?? i} className="table-row">
                  <td className="customer-cell">
                    <div className={`avatar-icon ${getSegmentColor(item.segment)}`}>
                      {getInitials(item.name)}
                    </div>
                    {item.name}
                  </td>
                  <td className="text-right">{num(item.orders)}</td>
                  <td className="text-right font-medium">{formatCurrency(item.totalSpent)}</td>
                  <td className="text-right">{formatCurrency(item.avgOrder)}</td>
                  <td className="text-center">
                    <span className={`segment-badge ${getSegmentBadge(item.segment)}`}>
                      {item.segment}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRevenueSummary = () => {
    if (summary.totalOrders === 0) return <div className="empty-state">No orders in this date range</div>;

    const metrics = [
      { label: 'Total Revenue', value: formatCurrency(summary.totalRevenue), color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: DollarSign },
      { label: 'Total Orders', value: summary.totalOrders, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: ShoppingBag },
      { label: 'Total Customers', value: summary.totalCustomersInRange, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: Users },
      { label: 'Avg Order Value', value: formatCurrency(summary.averageOrderValue), color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: TrendingUp },
      { label: 'Profit Margin', value: `${summary.profitMargin.toFixed(1)}%`, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: Target },
      { label: 'Repeat Customers', value: `${summary.repeatCustomerRate.toFixed(1)}%`, color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30', icon: Percent }
    ];

    const growthMetrics = [
      { label: 'Revenue Growth', value: summary.revenueGrowth, trend: (summary.revenueGrowth ?? 0) >= 0 ? 'up' : 'down' },
      { label: 'Order Growth', value: summary.orderGrowth, trend: (summary.orderGrowth ?? 0) >= 0 ? 'up' : 'down' },
      { label: 'Customer Growth', value: summary.customerGrowth, trend: (summary.customerGrowth ?? 0) >= 0 ? 'up' : 'down' }
    ];

    return (
      <div className="report-content-area">
        <div className="metric-grid-3">
          {metrics.map((m, i) => (
            <div key={i} className={`metric-tile ${m.bgColor}`}>
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <p className="metric-tile-label">{m.label}</p>
              </div>
              <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
        <div className="metric-grid-3 mt-4">
          {growthMetrics.map((m, i) => (
            <div key={i} className="metric-tile bg-gray-50 dark:bg-gray-700/50">
              <p className="metric-tile-label">{m.label}</p>
              {m.value === null ? (
                <p className="text-sm text-gray-400">No prior-period data</p>
              ) : (
                <div className="flex items-center gap-2">
                  <p className={`text-lg font-bold ${m.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {m.value >= 0 ? '+' : ''}{m.value.toFixed(1)}%
                  </p>
                  <div className={`${m.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                    {m.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="metric-grid-2 mt-4">
          <div className="metric-tile bg-yellow-50 dark:bg-yellow-900/20">
            <p className="metric-tile-label">🏆 Top Product</p>
            <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
              {productPerformance[0]?.product_name || 'N/A'}
            </p>
          </div>
          <div className="metric-tile bg-pink-50 dark:bg-pink-900/20">
            <p className="metric-tile-label">⭐ Top Customer</p>
            <p className="text-lg font-bold text-pink-700 dark:text-pink-300">
              {customerAnalytics[0]?.name || 'N/A'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderReportContent = () => {
    switch (reportType) {
      case 'monthlySales': return renderMonthlySales();
      case 'productPerformance': return renderProductPerformance();
      case 'customerAnalytics': return renderCustomerAnalytics();
      case 'revenueSummary': return renderRevenueSummary();
      default: return <div className="empty-state">Select a report type</div>;
    }
  };

  // ===== RENDER =====
  if (loading) return <LoadingSkeleton />;

  return (
    <div className="analytics-container">
      <AnimatedBackground />
      <FloatingIcons />

      {isRefreshing && (
        <div className="top-progress-bar" role="status" aria-label="Syncing dashboard data">
          <div className="top-progress-bar-fill" />
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ===== HEADER ===== */}
      <div className="analytics-header">
        <div className="header-bg-animations" aria-hidden="true">
          <div className="float-bubble" style={{ top: '-20%', right: '-10%', width: '300px', height: '300px' }} />
          <div className="float-bubble" style={{ bottom: '-20%', left: '-10%', width: '400px', height: '400px', animationDelay: '2s' }} />
          <div className="float-bubble" style={{ top: '50%', left: '50%', width: '450px', height: '450px', animationDelay: '4s', transform: 'translate(-50%, -50%)' }} />
        </div>

        <div className="header-content">
          <div>
            <div className="header-badge">
              <Sparkles className="w-4 h-4" />
              <span>Analytics</span>
              <span className="badge-dot">•</span>
              <span className="badge-live">
                <span className="live-dot" />
                Live
              </span>
            </div>
            <h1 className="header-title">
              <div className="title-icon-wrapper">
                <TrendingUp className="title-icon" aria-hidden="true" />
                <div className="title-icon-pulse" />
              </div>
              <span className="title-text">Analytics</span>
              <span className="title-highlight">Dashboard</span>
            </h1>
            <p className="header-subtitle">
              <Calendar className="w-4 h-4" aria-hidden="true" />
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              <span className="live-indicator">
                <PulseDot active={true} />
                Live
              </span>
            </p>
          </div>
          <div className="header-actions">
            <label className="sr-only" htmlFor="date-range-select">Date range</label>
            <select
              id="date-range-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="header-select"
            >
              {Object.entries(DATE_RANGES).map(([key, r]) => (
                <option key={key} value={key}>{r.label}</option>
              ))}
            </select>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="header-btn"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exportLoading}
                className="header-btn"
                aria-haspopup="menu"
                aria-expanded={showExportMenu}
              >
                {exportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="w-4 h-4" aria-hidden="true" />
                )}
                Export
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showExportMenu ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {showExportMenu && (
                <div className="export-menu" role="menu">
                  <button onClick={handleExport} className="export-menu-item" role="menuitem">
                    <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                    Export as CSV
                  </button>
                  <button onClick={() => window.print()} className="export-menu-item" role="menuitem">
                    <Printer className="w-4 h-4" aria-hidden="true" />
                    Print Report
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="header-footer">
          <div className="flex items-center gap-2">
            <Database className="w-3 h-3" aria-hidden="true" />
            <span>Database: <span className="text-white font-medium">{customers.length} Customers</span></span>
          </div>
          <span className="w-px h-4 bg-white/20" aria-hidden="true"></span>
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 animate-pulse" aria-hidden="true" />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
          {summary.itemDetailCoverage < 100 && (
            <>
              <span className="w-px h-4 bg-white/20" aria-hidden="true"></span>
              <span className="flex items-center gap-1 text-amber-200" title="Product-level revenue/profit is based on the most recent orders only">
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                Product data: {summary.itemDetailCoverage}% coverage for this range
              </span>
            </>
          )}
          <span className="ml-auto flex items-center gap-1 text-indigo-200">
            <Shield className="w-3 h-3" aria-hidden="true" />
            Data encrypted
          </span>
        </div>
      </div>

      {/* ===== STATS GRID ===== */}
      <div ref={statsRef} className="stats-grid">
        {STAT_CARDS.map((card, index) => {
          let value, subtitle, trend;
          switch (card.id) {
            case 'revenue':
              value = summary.totalRevenue;
              subtitle = `${summary.totalOrders} orders`;
              trend = summary.revenueGrowth;
              break;
            case 'orders':
              value = summary.totalOrders;
              subtitle = DATE_RANGES[dateRange].label;
              trend = summary.orderGrowth;
              break;
            case 'products':
              value = summary.totalProductsSold;
              subtitle = 'Distinct products sold';
              trend = null;
              break;
            case 'avgOrder':
              value = summary.averageOrderValue;
              subtitle = 'Per order';
              trend = null;
              break;
            default:
              value = 0;
              subtitle = '';
              trend = null;
          }
          return (
            <StatCard
              key={card.id}
              icon={card.icon}
              title={card.title}
              value={value}
              format={card.format}
              subtitle={subtitle}
              color={card.color}
              bgColor={card.bgColor}
              gradient={card.gradient}
              trend={trend}
              index={index}
            />
          );
        })}
      </div>

      {/* ===== TABS ===== */}
      <div className="tabs-container">
        <nav className="tabs-nav" aria-label="Analytics sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveView(tab.id);
                if (tab.id === 'overview') setSearchQuery('');
              }}
              className={`tab-btn ${activeView === tab.id ? `tab-active tab-${tab.color}` : ''}`}
              aria-current={activeView === tab.id ? 'page' : undefined}
            >
              {activeView === tab.id && <div className="tab-active-shimmer" aria-hidden="true" />}
              <tab.icon className="w-4 h-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ===== OVERVIEW VIEW ===== */}
      {activeView === 'overview' && (
        <div className="view-container">
          <div className="chart-grid">
            <div className="chart-card lg:col-span-2">
              <div className="chart-card-header">
                <h2 className="chart-title">
                  <BarChart3 className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                  Revenue &amp; Orders — {DATE_RANGES[dateRange].label}
                </h2>
                <span className="chart-badge">
                  <Zap className="w-3 h-3 animate-pulse" aria-hidden="true" />
                  {summary.totalCustomersInRange} Customers
                </span>
              </div>
              {monthlyChartData.length === 0 || summary.totalOrders === 0 ? (
                <div className="empty-state h-64">No orders in this date range</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                    <YAxis yAxisId="left" stroke="#9ca3af" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={12} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => name === 'Orders' ? value : formatCurrency(value)} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" fill="#6366f1" name="Revenue ($)" radius={[4, 4, 0, 0]}>
                      {monthlyChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#8b5cf6" name="Orders" strokeWidth={3} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="chart-card">
              <h2 className="chart-title">
                <PieChartIcon className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                Revenue Distribution
              </h2>
              {monthlyChartData.length === 0 || summary.totalOrders === 0 ? (
                <div className="empty-state h-64">No orders in this date range</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={monthlyChartData.filter(d => d.revenue > 0)}
                      dataKey="revenue"
                      nameKey="month"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {monthlyChartData.filter(d => d.revenue > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="chart-card mt-6">
            <div className="chart-card-header">
              <h2 className="chart-title">
                <AreaChartIcon className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                Yearly Revenue Overview
              </h2>
              <span className="chart-badge">
                {yearlyChartData.length} years tracked
              </span>
            </div>
            {yearlyChartData.length === 0 ? (
              <div className="empty-state h-64">No order history available yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={yearlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="year" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="#818cf8" fillOpacity={0.3}>
                    {yearlyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ===== PRODUCTS VIEW ===== */}
      {activeView === 'products' && (
        <div className="view-container products-grid">
          <div className="chart-card lg:col-span-1">
            <div className="chart-card-header">
              <h2 className="chart-title">
                <Award className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                Top Selling Products
                <span className="chart-count">
                  ({filteredProducts.length} of {productPerformance.length})
                </span>
              </h2>
              <div className="search-wrapper">
                <Search className="search-icon" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="search-clear"
                    aria-label="Clear search"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {filteredProducts.length === 0 ? (
              <div className="empty-state">
                <Package className="empty-icon" aria-hidden="true" />
                <p>No products found</p>
                {searchQuery && <p className="empty-subtext">Try adjusting your search</p>}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={filteredProducts.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                  <YAxis type="category" dataKey="product_name" stroke="#9ca3af" fontSize={12} width={100} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="total_sold" fill="#6366f1" radius={[0, 4, 4, 0]}>
                    {filteredProducts.slice(0, 15).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="chart-card lg:col-span-1">
            <h2 className="chart-title">
              <Package className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              Product Performance
            </h2>
            {productPerformance.length === 0 ? (
              <div className="empty-state">
                <Package className="empty-icon" aria-hidden="true" />
                <p>No product data available</p>
              </div>
            ) : (
              <div className="product-list">
                {productPerformance.slice(0, 5).map((product, index) => (
                  <div key={product.product_id ?? index} className="product-item">
                    <div className="product-item-left">
                      <div className={`product-rank ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-default'}`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="product-name">{product.product_name}</p>
                        <p className="product-meta">
                          <span>Sold: {num(product.total_sold)} units</span>
                        </p>
                      </div>
                    </div>
                    <div className="product-item-right">
                      <p className="product-revenue">{formatCurrency(product.revenue || 0)}</p>
                      <p className="product-rating">
                        {product.marginPct}% margin
                      </p>
                    </div>
                  </div>
                ))}
                {productPerformance.length > 5 && (
                  <div className="product-more">
                    +{productPerformance.length - 5} more products
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== CUSTOMERS VIEW ===== */}
      {activeView === 'customers' && (
        <div className="view-container customers-grid">
          <div className="chart-card lg:col-span-1">
            <h2 className="chart-title">
              <Users className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              Customer Selector
              <span className="chart-count">
                ({customers.length} customers)
              </span>
            </h2>

            <label className="sr-only" htmlFor="customer-select">Select a customer</label>
            <select id="customer-select" value={selectedCustomer} onChange={handleCustomerSelect} className="customer-select">
              <option value="">Select a customer</option>
              {customers.map((c) => {
                const id = c.id ?? c.cus_id;
                const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
                const phone = c.phone || '';
                return (
                  <option key={id} value={id}>
                    {fullName} {phone ? `- ${phone}` : ''}
                  </option>
                );
              })}
            </select>

            {selectedCustomer && (
              <div className="customer-info">
                <div className="customer-info-content">
                  <div className="customer-avatar">
                    {(() => {
                      const firstName = selectedCustomerRecord?.first_name || '';
                      const lastName = selectedCustomerRecord?.last_name || '';
                      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
                    })()}
                  </div>
                  <div>
                    <p className="customer-name">
                      {(() => {
                        const firstName = selectedCustomerRecord?.first_name || '';
                        const lastName = selectedCustomerRecord?.last_name || '';
                        return `${firstName} ${lastName}`.trim() || 'Unknown';
                      })()}
                    </p>
                    <p className="customer-id">ID: {selectedCustomer}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="chart-card lg:col-span-2">
            <h2 className="chart-title">
              <Clock className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              Purchase History
              {customerHistory.length > 0 && (
                <span className="history-count">
                  ({customerHistory.length} orders)
                </span>
              )}
            </h2>

            {!selectedCustomer ? (
              <div className="empty-history">
                <User className="empty-history-icon" aria-hidden="true" />
                <p className="empty-history-title">No customer selected</p>
                <p className="empty-history-subtext">Select a customer to view their purchase history</p>
              </div>
            ) : customerHistory.length === 0 ? (
              <div className="empty-history">
                <User className="empty-history-icon" aria-hidden="true" />
                <p className="empty-history-title">No purchase history found</p>
                <p className="empty-history-subtext">This customer has no orders yet</p>
              </div>
            ) : (
              <div className="history-table-container">
                <table className="history-table">
                  <thead className="history-thead">
                    <tr>
                      <th className="history-th">Order</th>
                      <th className="history-th">Date</th>
                      <th className="history-th text-right">Amount</th>
                      <th className="history-th text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="history-tbody">
                    {customerHistory.map((order, index) => {
                      const status = order.status || 'Pending';
                      return (
                        <tr key={order.id ?? order.order_no ?? `order-${index}`} className="history-tr" style={{ animationDelay: `${index * 50}ms` }}>
                          <td className="history-td order-id">{order.order_no || 'N/A'}</td>
                          <td className="history-td order-date">
                            {order.date
                              ? new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                              : 'N/A'}
                          </td>
                          <td className="history-td text-right order-amount">{formatCurrency(order.total)}</td>
                          <td className="history-td text-center">
                            <span className={`status-badge ${
                              status === 'Completed' ? 'status-completed'
                                : status === 'Pending' ? 'status-pending'
                                : status === 'Cancelled' ? 'status-cancelled'
                                : 'status-default'
                            }`}>
                              {status === 'Completed' && <CheckCircle className="w-3 h-3" aria-hidden="true" />}
                              {status === 'Pending' && <Clock className="w-3 h-3" aria-hidden="true" />}
                              {status === 'Cancelled' && <XCircle className="w-3 h-3" aria-hidden="true" />}
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== REPORTS VIEW ===== */}
      {activeView === 'reports' && (
        <div className="view-container">
          <div className="report-tabs-grid">
            {[
              { id: 'monthlySales', label: 'Monthly Sales', icon: TrendingUp, color: 'indigo' },
              { id: 'productPerformance', label: 'Product Performance', icon: Package, color: 'green' },
              { id: 'customerAnalytics', label: 'Customer Analytics', icon: Users, color: 'purple' },
              { id: 'revenueSummary', label: 'Revenue Summary', icon: DollarSign, color: 'orange' }
            ].map((report) => (
              <button
                key={report.id}
                onClick={() => setReportType(report.id)}
                className={`report-tab ${reportType === report.id ? `report-tab-active report-tab-${report.color}` : ''}`}
                aria-pressed={reportType === report.id}
              >
                {reportType === report.id && <div className="report-tab-shimmer" aria-hidden="true" />}
                <div className="report-tab-content">
                  <div className={`report-tab-icon ${reportType === report.id ? `active ${report.color}` : ''}`}>
                    <report.icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className={`report-tab-label ${reportType === report.id ? `active ${report.color}` : ''}`}>
                      {report.label}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="chart-card">
            <div className="chart-card-header">
              <h2 className="chart-title">
                <ClipboardList className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                {reportType === 'monthlySales' && 'Monthly Sales Report'}
                {reportType === 'productPerformance' && 'Product Performance Report'}
                {reportType === 'customerAnalytics' && 'Customer Analytics Report'}
                {reportType === 'revenueSummary' && 'Revenue Summary Report'}
              </h2>
              <div className="report-actions">
                <button onClick={exportReport} className="export-report-btn">
                  <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                  CSV
                </button>
                <button onClick={() => window.print()} className="print-report-btn">
                  <Printer className="w-4 h-4" aria-hidden="true" />
                  Print
                </button>
              </div>
            </div>
            <div className="report-content">
              {renderReportContent()}
            </div>
          </div>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div className="analytics-footer">
        <div className="footer-content">
          <div className="footer-left">
            <Sparkles className="w-4 h-4 text-indigo-500" aria-hidden="true" />
            <span>Analytics Dashboard</span>
          </div>
          <div className="footer-center">
            <Users className="w-3 h-3 text-green-500" aria-hidden="true" />
            <span>{customers.length} Customers Active</span>
          </div>
          <div className="footer-right">
            <Rocket className="w-3 h-3 text-purple-500" aria-hidden="true" />
            <span>© {new Date().getFullYear()} SPMS</span>
            <span className="footer-version">v2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;