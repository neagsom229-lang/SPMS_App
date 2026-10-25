// frontend/src/components/dashboard/SalesSummary.jsx
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  BarChart3,
  PieChart as PieChartIcon,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileSpreadsheet,
  ExternalLink,
  Clock,
  ArrowRight,
  ShieldAlert,
  Layers,
  CreditCard,
  Globe
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];

const formatCurrency = (val) => {
  const num = Number.isFinite(Number(val)) ? Number(val) : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const ChangeIndicator = ({ value }) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-gray-400 text-xs font-semibold">—</span>;
  }
  const isPositive = value > 0;
  const isNegative = value < 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
      isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
      isNegative ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    }`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
      {isPositive ? `+${value}%` : `${value}%`}
    </span>
  );
};

export default function SalesSummary() {
  const [range, setRange] = useState('30d');
  const [exporting, setExporting] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'sales-summary', range],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/sales-summary', { params: { range } });
      return res.data;
    },
    staleTime: 60000,
  });

  const handleExportExcel = async (type) => {
    try {
      setExporting(type);
      const res = await apiClient.get(`/reports/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(`Excel export failed for ${type}`, e);
      alert(`Excel export failed for ${type}`);
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 mb-8 animate-pulse">
        <div className="flex justify-between items-center mb-6">
          <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
        <div className="h-80 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-sm border border-rose-100 dark:border-rose-900/30 mb-8 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Failed to load sales summary</h3>
        <p className="text-sm text-gray-500 mb-4">{error?.message || 'Please check your connection and try again.'}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const stats = data || {};
  const prev = stats.previous || {};
  const chg = stats.change_pct || {};
  const hasNoSales = stats.net_revenue === 0 && stats.total_orders === 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 mb-8 space-y-8">
      {/* Header & Range Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Sales & Performance Summary
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Real-time revenue, gross profit, inventory health, and reports.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            {[
              { key: 'today', label: 'Today' },
              { key: '7d', label: '7 Days' },
              { key: '30d', label: '30 Days' },
              { key: 'month', label: 'This Month' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setRange(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  range === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Link
            to="/sell"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow transition"
          >
            <ShoppingCart className="w-4 h-4" /> Open Sell Screen <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Excel Export Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700/60">
        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Quick Excel Exports:
        </span>
        <div className="flex flex-wrap gap-2">
          {['products', 'orders', 'customers', 'stock'].map(type => (
            <button
              key={type}
              onClick={() => handleExportExcel(type)}
              disabled={exporting === type}
              className="px-3 py-1.5 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-bold capitalize flex items-center gap-1.5 transition disabled:opacity-50 shadow-sm"
            >
              {exporting === type ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />}
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Banner */}
      {stats.alerts && stats.alerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> System & Inventory Alerts ({stats.alerts.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stats.alerts.map((alt, i) => (
              <div key={i} className="text-xs text-amber-700 dark:text-amber-200 bg-white/60 dark:bg-gray-800/60 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                <span>{alt.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Net Revenue */}
        <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Net Revenue</span>
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">{formatCurrency(stats.net_revenue)}</div>
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Prev: {formatCurrency(prev.net_revenue)}</span>
              <ChangeIndicator value={chg.net_revenue} />
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Orders</span>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">{(stats.total_orders || 0).toLocaleString()}</div>
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Prev: {(prev.total_orders || 0).toLocaleString()}</span>
              <ChangeIndicator value={chg.total_orders} />
            </div>
          </div>
        </div>

        {/* Units Sold */}
        <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Units Sold</span>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">{(stats.units_sold || 0).toLocaleString()}</div>
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Prev: {(prev.units_sold || 0).toLocaleString()}</span>
              <ChangeIndicator value={chg.units_sold} />
            </div>
          </div>
        </div>

        {/* Avg Order Value */}
        <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Order Value</span>
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">{formatCurrency(stats.avg_order_value)}</div>
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Prev: {formatCurrency(prev.avg_order_value)}</span>
              <ChangeIndicator value={chg.avg_order_value} />
            </div>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gross Profit ({stats.profit_margin || 0}%)</span>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">{formatCurrency(stats.gross_profit)}</div>
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Prev: {formatCurrency(prev.gross_profit)}</span>
              <ChangeIndicator value={chg.gross_profit} />
            </div>
          </div>
        </div>

        {/* Refunds */}
        <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Refunds</span>
            <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">{formatCurrency(stats.refunds?.amount || 0)}</div>
            <div className="text-[11px] text-gray-400">
              {stats.refunds?.count || 0} refunded orders
            </div>
          </div>
        </div>
      </div>

      {hasNoSales && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
          <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-bold text-gray-800 dark:text-white">No sales in this period</h3>
          <p className="text-xs text-gray-500 mt-1">Try selecting a different date range or open the Sell screen to make a sale.</p>
        </div>
      )}

      {/* Revenue & Orders Chart */}
      <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600" /> Revenue & Orders Timeline
        </h3>
        <div className="h-72 w-full">
          {stats.timeseries && stats.timeseries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.timeseries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis dataKey="bucket" stroke="#9ca3af" fontSize={11} />
                <YAxis yAxisId="left" stroke="#6366f1" fontSize={11} tickFormatter={v => `$${v}`} />
                <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                  formatter={(val, name) => [name === 'revenue' ? formatCurrency(val) : val, name]}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue ($)" fill="#6366f1" stroke="#6366f1" fillOpacity={0.2} />
                <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#8b5cf6" barSize={16} radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-xs">No timeline data available for this range</div>
          )}
        </div>
      </div>

      {/* Breakdowns & Inventory Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown */}
        <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-600" /> Revenue by Category
          </h3>
          <div className="flex-1 space-y-3">
            {stats.by_category && stats.by_category.length > 0 ? (
              stats.by_category.map((cat, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{cat.name}</p>
                    <p className="text-[10px] text-gray-400">{cat.units} units sold</p>
                  </div>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{formatCurrency(cat.revenue)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 text-center py-10">No category breakdown available</p>
            )}
          </div>
        </div>

        {/* Payment Methods & Source Breakdown */}
        <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" /> Payment Methods
            </h3>
            <div className="space-y-2">
              {stats.by_payment_method && stats.by_payment_method.length > 0 ? (
                stats.by_payment_method.map((pm, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700/60">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{pm.method}</span>
                    <div className="text-right">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 block">{formatCurrency(pm.revenue)}</span>
                      <span className="text-[10px] text-gray-400">{pm.orders} orders</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">No payment method data</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" /> Sales Source (POS vs Online)
            </h3>
            <div className="space-y-2">
              {stats.by_source && stats.by_source.length > 0 ? (
                stats.by_source.map((src, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700/60">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{src.source}</span>
                    <div className="text-right">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 block">{formatCurrency(src.revenue)}</span>
                      <span className="text-[10px] text-gray-400">{src.orders} orders</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">No sales source data</p>
              )}
            </div>
          </div>
        </div>

        {/* Inventory Health Card */}
        <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" /> Inventory Health & Valuation
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                <span className="text-gray-500">Total Active SKUs</span>
                <span className="font-bold text-gray-900 dark:text-white">{(stats.inventory?.total_skus || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                <span className="text-gray-500">Stock Value (Cost)</span>
                <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(stats.inventory?.stock_value_cost || 0)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                <span className="text-gray-500">Stock Value (Retail)</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(stats.inventory?.stock_value_retail || 0)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/40">
                <span className="text-amber-700 dark:text-amber-300 font-semibold">Low Stock Items</span>
                <span className="font-bold text-amber-800 dark:text-amber-300">{(stats.inventory?.low_stock_count || 0)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-100 dark:border-rose-800/40">
                <span className="text-rose-700 dark:text-rose-300 font-semibold">Out of Stock Items</span>
                <span className="font-bold text-rose-800 dark:text-rose-300">{(stats.inventory?.out_of_stock_count || 0)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
            <span>Open Online Orders:</span>
            <span className="font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
              {stats.open_online_orders || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Top Products Table */}
      <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-indigo-600" /> Top Selling Products
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-400 uppercase font-bold tracking-wider">
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">Quantity Sold</th>
                <th className="py-2.5 px-3 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.top_products && stats.top_products.length > 0 ? (
                stats.top_products.map((p, i) => (
                  <tr key={i} className="hover:bg-white/60 dark:hover:bg-gray-800/60 transition">
                    <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">
                      {p.name_en || p.name} {p.name_kh ? `(${p.name_kh})` : ''}
                    </td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-300">{(p.total_qty || 0).toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-extrabold text-indigo-600 dark:text-indigo-400">{formatCurrency(p.total_revenue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="text-center py-8 text-gray-400">No top products recorded for this period</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
