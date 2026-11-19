// frontend/src/components/Dashboard.jsx - TechFlow Dark UI Edition
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";
import { queryKeys } from '../api/queryKeys';
import { unwrapList as extractArrayData } from '../api/list';
import { DEFAULT_STORE_SLUG } from '../config/store';
import { isAdminRole } from '../utils/roles';
import { 
  Users, Package, ShoppingCart, DollarSign, 
  Clock, ArrowRight, BarChart3, PieChart, CheckCircle, Rocket, RefreshCw, Activity, Cpu, Sparkles 
} from "lucide-react";
import { toast } from "react-hot-toast";

import { useQuery } from "@tanstack/react-query";

const CHART_COLORS = ["#06b6d4", "#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#3b82f6", "#f59e0b"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const REFRESH_STALE_TIME_MS = 60000;

// Dependency-free charts. recharts stays in the lazy Analytics/Reports chunk;
// pulling it into Dashboard would load the 434 kB charts chunk on login.
const TrendChart = ({ data }) => {
  const W = 640;
  const H = 260;
  const padBottom = 30;
  const padTop = 12;
  const plotH = H - padBottom - padTop;
  const slot = W / Math.max(data.length, 1);
  const maxOrders = Math.max(1, ...data.map((d) => Number(d.orders) || 0));
  const maxRevenue = Math.max(1, ...data.map((d) => Number(d.revenue) || 0));
  const barW = Math.min(28, slot * 0.4);
  const barPts = data.map((d, i) => ({
    x: slot * i + slot / 2,
    h: ((Number(d.revenue) || 0) / maxRevenue) * plotH,
    d,
  }));
  const linePts = data.map((d, i) => ({
    x: slot * i + slot / 2,
    y: padTop + plotH - ((Number(d.orders) || 0) / maxOrders) * plotH,
    d,
  }));
  const line = linePts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area =
    `M ${linePts[0].x.toFixed(1)} ${padTop + plotH} ` +
    linePts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
    ` L ${linePts[linePts.length - 1].x.toFixed(1)} ${padTop + plotH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" role="img" aria-label="Revenue and orders, trailing 6 months">
      <defs>
        <linearGradient id="dashboard-rev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#06b6d4" stopOpacity="0.4" />
          <stop offset="95%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = padTop + (plotH / 4) * i;
        return <line key={i} x1="0" y1={y} x2={W} y2={y} stroke="#334155" strokeOpacity="0.3" strokeDasharray="3 3" />;
      })}
      {barPts.map((p, i) => (
        <rect
          key={i}
          data-month={p.d.key}
          data-value={Number(p.d.revenue) || 0}
          x={p.x - barW / 2}
          y={padTop + plotH - p.h}
          width={barW}
          height={p.h}
          rx="4"
          fill="#6366f1"
        >
          <title>{`${p.d.name}: ${formatCurrency(p.d.revenue)} revenue`}</title>
        </rect>
      ))}
      <path d={area} fill="url(#dashboard-rev)" />
      <polyline points={line} fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinejoin="round" />
      {linePts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#06b6d4" data-value={Number(p.d.orders) || 0}>
            <title>{`${p.d.name}: ${p.d.orders} orders`}</title>
          </circle>
          <text x={p.x} y={H - 8} textAnchor="middle" fill="#94a3b8" fontSize="11">
            {p.d.name}
          </text>
        </g>
      ))}
    </svg>
  );
};

const DonutChart = ({ data }) => {
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0) || 1;
  const R = 70;
  let angleStart = -Math.PI / 2;

  // One <path> arc per category, so every segment is a real path element.
  const arc = (start, sweep) => {
    const point = (a) => [100 + R * Math.cos(a), 100 + R * Math.sin(a)];
    if (sweep >= Math.PI * 2 - 1e-6) {
      const [x0, y0] = point(-Math.PI / 2);
      const [xm, ym] = point(Math.PI / 2);
      return `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${R} ${R} 0 1 1 ${xm.toFixed(3)} ${ym.toFixed(3)} ` +
        `A ${R} ${R} 0 1 1 ${x0.toFixed(3)} ${y0.toFixed(3)}`;
    }
    const [x0, y0] = point(start);
    const [x1, y1] = point(start + sweep);
    const largeArc = sweep > Math.PI ? 1 : 0;
    return `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${R} ${R} 0 ${largeArc} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
  };

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" role="img" aria-label="Sales mix by category">
      {data.map((d, i) => {
        const sweep = ((Number(d.value) || 0) / total) * Math.PI * 2;
        const start = angleStart;
        angleStart += sweep;
        if (sweep <= 0) return null;
        return (
          <path
            key={i}
            data-name={d.name}
            data-value={Number(d.value) || 0}
            d={arc(start, sweep)}
            fill="none"
            stroke={d.color || CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth="26"
          >
            <title>{`${d.name}: ${formatCurrency(d.value)}`}</title>
          </path>
        );
      })}
    </svg>
  );
};

const formatCurrency = (value) => {
  const num = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const findField = (obj, aliases) => {
  if (!obj || typeof obj !== "object") return undefined;
  const normalizedAliases = aliases.map(k => String(k).toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const key of Object.keys(obj)) {
    if (normalizedAliases.includes(String(key).toLowerCase().replace(/[^a-z0-9]/g, ""))) {
      const value = obj[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return undefined;
};

const getCustomerName = (order) => {
  const direct = findField(order, ["customer_name", "customerName", "full_name", "fullName", "buyer_name", "buyerName"]);
  if (direct && typeof direct === "string") return direct;
  const first = findField(order, ["first_name", "firstName"]);
  const last = findField(order, ["last_name", "lastName"]);
  if (first || last) return `${first || ""} ${last || ""}`.trim();
  return "Tech Client";
};

const getStat = (stats, aliases, fallback = 0) => {
  const value = findField(stats, aliases);
  if (value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

// Shared list unwrapping lives in ../api/list.js
// Builds the trailing six calendar months (UTC keys, matching date_trunc in
// /dashboard/analytics-summary) and fills them from the SQL revenue_by_month
// aggregate. No value here is invented: a month with no sales is a real zero.
const buildMonthlySeries = (revenueByMonth = []) => {
  const byMonth = {};
  revenueByMonth.forEach((row) => { byMonth[row.month] = row; });

  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const row = byMonth[key];
    buckets.push({
      key,
      name: MONTH_NAMES[d.getUTCMonth()],
      revenue: Number(row?.revenue) || 0,
      orders: Number(row?.orders) || 0,
    });
  }
  return buckets;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canSeeSalesMix = isAdminRole(user);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Queries pulling from backend API
  const statsQuery = useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: async () => {
      const res = await apiClient.get("/dashboard/stats");
      return res.data || {};
    },
    staleTime: REFRESH_STALE_TIME_MS,
    retry: 1,
  });

  const ordersQuery = useQuery({
    queryKey: queryKeys.orders,
    queryFn: async () => {
      const res = await apiClient.get("/orders/recent");
      return extractArrayData(res.data, ["orders", "items"]);
    },
    staleTime: REFRESH_STALE_TIME_MS,
    retry: 1,
  });

  // Trailing six months, straight from the tenant-scoped SQL aggregates.
  const analyticsRange = useMemo(() => {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    return { from: from.toISOString(), to: now.toISOString() };
  }, []);

  const analyticsQuery = useQuery({
    queryKey: queryKeys.dashboardAnalytics(analyticsRange.from, analyticsRange.to),
    queryFn: async () => {
      const res = await apiClient.get("/dashboard/analytics-summary", {
        params: analyticsRange,
      });
      return res.data || {};
    },
    staleTime: REFRESH_STALE_TIME_MS,
    retry: 1,
  });

  const salesMixQuery = useQuery({
    queryKey: queryKeys.dashboardSalesMix(analyticsRange.from, analyticsRange.to),
    queryFn: async () => {
      const res = await apiClient.get("/dashboard/sales-summary", {
        params: { range: "custom", ...analyticsRange },
      });
      return res.data || {};
    },
    staleTime: REFRESH_STALE_TIME_MS,
    enabled: canSeeSalesMix,
    retry: (failureCount, error) => (error?.response?.status === 403 ? false : failureCount < 1),
  });

  // `x.data || {}` creates a fresh object on every render when data is absent,
  // which would invalidate the dependent useMemo callbacks each time.
  const statsRaw = useMemo(() => statsQuery.data || {}, [statsQuery.data]);
  const analytics = useMemo(() => analyticsQuery.data || {}, [analyticsQuery.data]);
  const recentOrders = ordersQuery.data || [];

  const chartData = useMemo(
    () => buildMonthlySeries(analytics.revenue_by_month || []),
    [analytics]
  );

  const salesDistribution = useMemo(() => {
    return (salesMixQuery.data?.by_category || [])
      .filter((row) => Number(row.revenue) > 0)
      .map((row, i) => ({
        name: row.name,
        value: Number(row.revenue) || 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [salesMixQuery.data]);

  const stats = useMemo(() => {
    const totalOrders = getStat(statsRaw, ["total_orders", "totalOrders", "orders_count"], 0);
    const totalRevenue = getStat(statsRaw, ["total_revenue", "totalRevenue", "revenue"], 0);
    const totalCustomers = getStat(statsRaw, ["total_customers", "totalCustomers"], 0);
    const totalProducts = getStat(statsRaw, ["total_products", "totalProducts"], 0);

    // Today's numbers come from the same SQL aggregate as the charts.
    const todayKey = new Date().toISOString().slice(0, 10);
    const today = (analytics.revenue_by_day || []).find((row) => row.date === todayKey);
    const todayOrders = Number(today?.orders) || 0;

    // Month-over-month growth from the real monthly series (null when there
    // is no previous month with revenue to compare against).
    const currentMonth = chartData[chartData.length - 1]?.revenue || 0;
    const previousMonth = chartData[chartData.length - 2]?.revenue || 0;
    const growthRate = previousMonth > 0
      ? ((currentMonth - previousMonth) / previousMonth) * 100
      : null;

    return {
      totalCustomers,
      totalProducts,
      totalOrders,
      totalRevenue,
      lowStockItems: getStat(statsRaw, ["low_stock", "lowStock", "low_stock_count"], 0),
      pendingOrders: getStat(statsRaw, ["pending_orders", "pendingOrders"], 0),
      recentOrders: getStat(statsRaw, ["recent_orders", "recentOrders"], 0),
      growthRate,
      todayOrders,
      repeatCustomers: getStat(analytics, ["repeat_customers", "repeatCustomers"], 0),
    };
  }, [statsRaw, analytics, chartData]);

  const hasSales = useMemo(
    () => chartData.some((month) => month.revenue > 0 || month.orders > 0),
    [chartData]
  );

  // Honest empty state: a brand-new tenant has no sales at all, while an
  // established tenant can simply have none inside the six-month window.
  const emptyChartText = !canSeeSalesMix
    ? 'Admin only'
    : stats.totalOrders > 0
      ? 'No sales in the last 6 months'
      : 'No sales yet';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcomeModal(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const refreshData = useCallback(() => {
    statsQuery.refetch();
    ordersQuery.refetch();
    analyticsQuery.refetch();
    if (canSeeSalesMix) salesMixQuery.refetch();
    toast.success('Dashboard refreshed successfully');
  }, [statsQuery, ordersQuery, analyticsQuery, salesMixQuery, canSeeSalesMix]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
      
      {/* BACKGROUND GLOWS */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[140px]" />
      </div>

      {/* TOP BAR */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono tracking-widest uppercase text-cyan-400 font-bold">TechFlow Control Center</span>
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">• {currentTime.toLocaleTimeString()}</span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={refreshData}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-300 transition shadow-inner flex items-center space-x-1.5 text-xs font-bold"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => navigate(`/shop/${DEFAULT_STORE_SLUG}`)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider hover:opacity-90 transition shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>View 3D Store</span>
          </button>
        </div>
      </div>

      {/* WELCOME BANNER / HEADER */}
      <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-3">
              <Cpu className="w-3.5 h-3.5" />
              <span>Admin Dashboard v2.0</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">{user?.username || user?.fullname || 'Admin'}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-2 max-w-xl leading-relaxed">
              {stats.totalProducts} products tracked, {stats.totalOrders} completed orders, {stats.lowStockItems} low-stock alerts.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/products')}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center space-x-2"
            >
              <Package className="w-4 h-4 text-cyan-400" />
              <span>Manage Products</span>
            </button>
            <button
              onClick={() => navigate('/orders')}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center space-x-2"
            >
              <ShoppingCart className="w-4 h-4 text-indigo-400" />
              <span>View Orders</span>
            </button>
          </div>
        </div>
      </div>

      {/* STATS KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), sub: stats.growthRate === null ? 'No prior month to compare' : `${stats.growthRate >= 0 ? '+' : ''}${stats.growthRate.toFixed(1)}% vs last month`, icon: DollarSign, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
          { label: 'Total Orders', value: stats.totalOrders.toLocaleString(), sub: `${stats.todayOrders} orders today`, icon: ShoppingCart, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
          { label: 'Active Products', value: stats.totalProducts.toLocaleString(), sub: `${stats.lowStockItems} low stock alerts`, icon: Package, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
          { label: 'Total Customers', value: stats.totalCustomers.toLocaleString(), sub: `${stats.repeatCustomers} repeat customers`, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="relative group bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl hover:border-cyan-500/40 transition-all duration-300">
              <div className="absolute -inset-px bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-2xl opacity-0 group-hover:opacity-20 blur-md transition-opacity -z-10" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{card.label}</span>
                <div className={`w-10 h-10 rounded-xl border ${card.bg} flex items-center justify-center ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-black text-white tracking-tight mb-1">{card.value}</div>
              <p className="text-xs text-slate-400 font-medium">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* REVENUE & ORDERS CHART */}
        <div className="lg:col-span-2 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-cyan-400" />
                Revenue & Orders Trend
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Trailing 6 months telemetry</p>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/30">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>Real-time Sync</span>
            </div>
          </div>
          <div className="h-80 w-full">
            {hasSales ? (
              <TrendChart data={chartData} />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm">{emptyChartText}</div>
            )}
          </div>
        </div>

        {/* SALES MIX PIE CHART */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center mb-1">
              <PieChart className="w-5 h-5 mr-2 text-purple-400" />
              Hardware Sales Mix
            </h3>
            <p className="text-xs text-slate-400">Revenue distribution by category</p>
          </div>

          <div className="h-64 w-full my-4">
            {salesDistribution.length > 0 ? (
              <DonutChart data={salesDistribution} />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm">{emptyChartText}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-800">
            {salesDistribution.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-2 text-xs">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-300 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RECENT ORDERS TABLE & LOW STOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* RECENT ORDERS */}
        <div className="lg:col-span-2 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2 text-indigo-400" />
              Recent Customer Orders
            </h3>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 font-bold">Order #</th>
                  <th className="pb-3 font-bold">Customer</th>
                  <th className="pb-3 font-bold">Date</th>
                  <th className="pb-3 font-bold text-right">Amount</th>
                  <th className="pb-3 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No sales yet
                    </td>
                  </tr>
                ) : (
                  recentOrders.slice(0, 5).map((order, i) => {
                    const orderNo = order.ORDER_NO || order.order_no || `ORD-00${i+1}`;
                    const amount = Number(order.AMOUNT_US || order.amount_us || order.total || 0);
                    const status = order.STATUS || order.status || 'Completed';
                    return (
                      <tr key={i} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 font-mono text-cyan-400">{orderNo}</td>
                        <td className="py-3.5 text-white font-semibold">{getCustomerName(order)}</td>
                        <td className="py-3.5 text-slate-400">{formatDate(order.ORDER_DATE || order.order_date)}</td>
                        <td className="py-3.5 text-right font-black text-white">{formatCurrency(amount)}</td>
                        <td className="py-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                            status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                            'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          }`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* QUICK HARDWARE STATS & SYSTEM STATUS */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center mb-4">
              <Cpu className="w-5 h-5 mr-2 text-cyan-400" />
              System & Inventory Health
            </h3>

            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between text-xs mb-1.5 font-bold">
                  <span className="text-slate-300">Completed Orders (7 days)</span>
                  <span className="text-emerald-400 flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> {stats.recentOrders}</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${stats.totalOrders > 0 ? Math.min(100, (stats.recentOrders / stats.totalOrders) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between text-xs mb-1.5 font-bold">
                  <span className="text-slate-300">Pending Orders</span>
                  <span className="text-cyan-400 flex items-center"><Clock className="w-3 h-3 mr-1" /> {stats.pendingOrders}</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full rounded-full"
                    style={{ width: `${stats.totalOrders > 0 ? Math.min(100, (stats.pendingOrders / stats.totalOrders) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between text-xs mb-1.5 font-bold">
                  <span className="text-slate-300">Low Stock Warning</span>
                  <span className="text-amber-400 font-mono">{stats.lowStockItems} items require restock</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${stats.totalProducts > 0 ? Math.min(100, (stats.lowStockItems / stats.totalProducts) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <button
              onClick={() => navigate('/stock')}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold rounded-xl text-xs uppercase tracking-wider border border-slate-700 transition"
            >
              Run Inventory Audit
            </button>
          </div>
        </div>

      </div>

      {/* WELCOME MODAL */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl relative">
            <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-cyan-400">
              <Rocket className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-xl font-black text-white mb-2">TechFlow Dashboard Ready!</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {stats.totalProducts} products tracked, {stats.totalOrders} completed orders, {stats.lowStockItems} low-stock alerts.
            </p>
            <button
              onClick={() => setShowWelcomeModal(false)}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black rounded-xl uppercase tracking-wider text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)]"
            >
              Enter Control Center
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
