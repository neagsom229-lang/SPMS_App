import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  ClipboardList, Download, Printer, RefreshCw, 
  AlertCircle, CheckCircle, Loader2, Database,
  TrendingUp, Package, Users, ShoppingBag,
  Calendar, Filter, ChevronDown, X, Eye,
  Clock, Award, Star, Zap, Activity, 
  BarChart3, PieChart, LineChart as LineChartIcon,
  ArrowUp, ArrowDown, Grid3x3, List,
  Plus, Edit2, Trash2, Truck, Phone, Mail,
  MapPin, User, Building2, Globe, Shield,
  Search, Save, ChevronRight
} from 'lucide-react';
import '../styles/reports.css';
import apiClient from '../api/client';

// ============================================
// SHARED DATA HELPERS
// ============================================
const extractArrayData = (responseData, extraKeys = []) => {
  if (
    typeof responseData === "string" &&
    responseData.includes("<!DOCTYPE html>")
  ) {
    return null;
  }
  if (Array.isArray(responseData)) return responseData;
  if (responseData && typeof responseData === "object") {
    if (Array.isArray(responseData.data)) return responseData.data;
    for (const key of extraKeys) {
      if (Array.isArray(responseData[key])) return responseData[key];
    }
    if (responseData.data && typeof responseData.data === "object") {
      for (const key of extraKeys) {
        if (Array.isArray(responseData.data[key]))
          return responseData.data[key];
      }
      const values = Object.values(responseData.data);
      if (values.length > 0 && Array.isArray(values[0])) return values[0];
    }
  }
  return [];
};

// ============================================
// MAIN REPORTS COMPONENT
// ============================================
const Reports = () => {
  // ===== STATE =====
  const [reportType, setReportType] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [totalRecords, setTotalRecords] = useState(0);
  const [generatedAt, setGeneratedAt] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('table');
  const [selectedRows, setSelectedRows] = useState([]); // now stores row.ID values, not array indices
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportStats, setReportStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    completed: 0,
    totalValue: 0
  });

  // ===== REFS =====
  const isMounted = useRef(true);
  const messageTimeout = useRef(null);

  // ===== REPORT OPTIONS =====
  const reportOptions = [
    { 
      value: 'customers', 
      label: '👥 Customer List',
      description: 'View all customers with contact details',
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      endpoint: '/customers'
    },
    { 
      value: 'products', 
      label: '📦 Product List',
      description: 'View all products with pricing and stock',
      icon: Package,
      color: 'from-emerald-500 to-green-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      endpoint: '/products'
    },
    { 
      value: 'orders', 
      label: '🛒 Order Summary',
      description: 'View all orders with status and amounts',
      icon: ShoppingBag,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      endpoint: '/orders'
    },
    { 
      value: 'stock', 
      label: '📊 Stock Report',
      description: 'View current stock levels and alerts',
      icon: TrendingUp,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      endpoint: '/stock'
    },
    { 
      value: 'suppliers', 
      label: '🚚 Supplier List',
      description: 'View all suppliers with contact information',
      icon: Truck,
      color: 'from-indigo-500 to-purple-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      endpoint: '/suppliers'
    }
  ];

  // ===== SHOW MESSAGE =====
  const showMessage = useCallback((text, type = 'success') => {
    setError(type === 'error' ? text : '');
    setSuccess(type === 'success' ? text : '');
    if (messageTimeout.current) clearTimeout(messageTimeout.current);
    messageTimeout.current = setTimeout(() => {
      setError('');
      setSuccess('');
    }, 4000);
  }, []);

  // ===== GET REPORT ENDPOINT =====
  const getReportEndpoint = useCallback((type) => {
    const option = reportOptions.find(r => r.value === type);
    return option?.endpoint || `/${type}`;
  }, [reportOptions]);

  // ===== NORMALIZE DATA BASED ON REPORT TYPE =====
  const normalizeReportData = useCallback((type, rawData) => {
    if (!rawData || !Array.isArray(rawData)) return [];

    switch(type) {
      case 'customers':
        return rawData.map(c => ({
          ID: c.CUS_ID || c.cus_id || c.ID,
          NAME: `${c.FIRST_NAME || c.first_name || ''} ${c.LAST_NAME || c.last_name || ''}`.trim() || 'Unknown',
          PHONE: c.PHONE || c.phone || '',
          EMAIL: c.E_MAIL || c.e_mail || c.email || '',
          ADDRESS: c.ADDRESS || c.address || '',
          STATUS: c.STATUS || c.status || 'Active',
          BALANCE: Number(c.BALANCE || c.balance || 0),
          JOIN_DATE: c.JOIN_DATE || c.join_date || c.CREATED_AT || c.created_at || ''
        }));
      
      case 'products':
        return rawData.map(p => ({
          ID: p.PRODUCT_ID || p.product_id || p.ID,
          NAME_EN: p.NAME_EN || p.name_en || 'Unknown',
          NAME_KH: p.NAME_KH || p.name_kh || '',
          BARCODE: p.BARCODE || p.barcode || '',
          BRAND: p.BRAND || p.brand || '',
          BUY_PRICE: Number(p.BUYIN_PRICE || p.buyin_price || p.buy_price || 0),
          SALE_PRICE: Number(p.SALEOUT_PRICE || p.saleout_price || p.sale_price || 0),
          STOCK: Number(p.QtyInStock || p.qty_instock || p.stock || 0),
          ALERT: Number(p.QTY_ALERT || p.qty_alert || p.alert || 10),
          STATUS: p.STATUS || p.status || 'Active',
          CATEGORY: p.CATEGORY || p.category || ''
        }));

      case 'orders':
        return rawData.map(o => ({
          ID: o.OR_ID || o.or_id || o.id || o.ID,
          ORDER_NO: o.ORDER_NO || o.order_no || `ORD-${o.id || o.ID || ''}`,
          DATE: o.ORDER_DATE || o.order_date || o.date || '',
          CUSTOMER: o.customer_name || o.CUSTOMER_NAME || o.customer || 'Unknown',
          TOTAL: Number(o.AMOUNT_US || o.amount_us || o.total || 0),
          STATUS: o.STATUS || o.status || 'Pending',
          PAYMENT: o.PAYMENT_METHOD || o.payment_method || o.PaymentMethod || 'N/A',
          ITEMS: o.items?.length || o.item_count || 0
        }));

      case 'stock':
        return rawData.map(s => ({
          ID: s.STOCKID || s.stockid || s.PRODUCT_ID || s.product_id || s.ID,
          PRODUCT: s.NAME_EN || s.name_en || s.PRODUCT_NAME || s.product_name || 'Unknown',
          IN_STOCK: Number(s.QtyInStock || s.qty_instock || s.in_stock || 0),
          RESERVED: Number(s.QtyReserved || s.qty_reserved || s.reserved || 0),
          AVAILABLE: Number(s.QtyAvailable || s.qty_available || s.available || 0),
          ALERT: Number(s.QTY_ALERT || s.qty_alert || s.alert || 10),
          STATUS: s.STATUS || s.status || 'OK',
          PRICE: Number(s.SALEOUT_PRICE || s.saleout_price || s.price || 0)
        }));

      case 'suppliers':
        return rawData.map(s => ({
          ID: s.SUP_ID || s.sup_id || s.ID,
          NAME: s.SUP_NAME || s.sup_name || s.name || 'Unknown',
          CONTACT: s.CONTACT_PERSON || s.contact_person || s.contact || '',
          PHONE: s.PHONE || s.phone || '',
          EMAIL: s.EMAIL || s.email || '',
          ADDRESS: s.ADDRESS || s.address || '',
          STATUS: s.STATUS || s.status || 'Active',
          WEBSITE: s.WEBSITE || s.website || '',
          TAX_ID: s.TAX_ID || s.tax_id || ''
        }));

      default:
        return rawData;
    }
  }, []);

  // ===== CALCULATE STATS =====
  const calculateStats = useCallback((type, data) => {
    if (!data || data.length === 0) {
      setReportStats({ total: 0, active: 0, pending: 0, completed: 0, totalValue: 0 });
      return;
    }

    const stats = {
      total: data.length,
      active: 0,
      pending: 0,
      completed: 0,
      totalValue: 0
    };

    data.forEach(item => {
      const status = String(item.STATUS || item.status || '').toLowerCase();
      
      // Determine status categories
      if (status.includes('active') || status === 'ok' || status === 'instock') {
        stats.active++;
      }
      if (status.includes('pending') || status.includes('low') || status.includes('processing') || status === 'low stock') {
        stats.pending++;
      }
      if (status.includes('completed') || status.includes('done') || status === 'completed') {
        stats.completed++;
      }
      
      // Sum up values based on report type
      let amount = 0;
      if (type === 'customers' && item.BALANCE) amount = Number(item.BALANCE) || 0;
      else if (type === 'products' && item.SALE_PRICE) amount = Number(item.SALE_PRICE) * (Number(item.STOCK) || 0);
      else if (type === 'orders' && item.TOTAL) amount = Number(item.TOTAL) || 0;
      else if (type === 'stock' && item.PRICE) amount = Number(item.PRICE) * (Number(item.AVAILABLE) || 0);
      else if (type === 'suppliers') amount = 0;
      
      stats.totalValue += amount;
    });

    setReportStats(stats);
  }, []);

  // ===== GENERATE REPORT =====
  const generateReport = useCallback(async () => {
    if (isGenerating) {
      console.log('⚠️ Already generating, skipping...');
      return;
    }
    
    if (!reportType) {
      showMessage('Please select a report type', 'error');
      return;
    }
    
    console.log(`📊 Generating ${reportType} report...`);
    
    setIsGenerating(true);
    setLoading(true);
    setError('');
    setSuccess('');
    setData(null);
    setSelectedRows([]);
    setIsRefreshing(true);
    
    try {
      const endpoint = getReportEndpoint(reportType);
      console.log(`📡 Fetching from: ${endpoint}`);
      
      const res = await apiClient.get(endpoint);
      console.log(`📥 Response received:`, res.status);
      
      // Extract raw data
      let rawData = extractArrayData(res.data, ['data', 'items', 'results']);
      if (rawData === null || !Array.isArray(rawData)) {
        rawData = [];
      }
      
      console.log(`📊 Raw data count: ${rawData.length}`);
      
      // Normalize data
      const normalizedData = normalizeReportData(reportType, rawData);
      console.log(`📊 Normalized data count: ${normalizedData.length}`);
      
      if (isMounted.current) {
        setData(normalizedData);
        setTotalRecords(normalizedData.length);
        setGeneratedAt(new Date().toLocaleString());
        calculateStats(reportType, normalizedData);
        showMessage(`✅ ${reportOptions.find(r => r.value === reportType)?.label} report generated successfully! (${normalizedData.length} records)`, 'success');
      }
      
    } catch (error) {
      console.error(`❌ Error generating ${reportType} report:`, error.message);
      console.error('Error details:', error.response?.data || error);
      
      if (isMounted.current) {
        showMessage(`❌ Failed to generate report: ${error.response?.data?.error || error.message}`, 'error');
        setData([]);
        setTotalRecords(0);
        calculateStats(reportType, []);
      }
      
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsRefreshing(false);
        setIsGenerating(false);
      }
    }
  }, [reportType, getReportEndpoint, normalizeReportData, calculateStats, isGenerating, showMessage, reportOptions]);

  // ===== INITIAL MOUNT / CLEANUP =====
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (messageTimeout.current) {
        clearTimeout(messageTimeout.current);
      }
    };
  }, []);

  // ===== AUTO-GENERATE ON REPORT TYPE CHANGE =====
  // NOTE: this effect intentionally depends only on reportType.
  // It must NOT depend on `data` or `generateReport` output, or every
  // successful fetch (which creates a new `data` array reference) would
  // re-trigger this effect and cause an infinite fetch loop.
  useEffect(() => {
    if (reportType) {
      console.log(`📊 Report type changed to: ${reportType}, generating...`);
      generateReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  // ===== FILTERED DATA (search, status filter, sort — all client-side) =====
  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    let result = [...data];

    // Search filter — checks every field on the row
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      result = result.filter(row =>
        Object.values(row).some(value =>
          String(value ?? '').toLowerCase().includes(query)
        )
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(row => {
        const status = String(row.STATUS || row.status || '').toLowerCase();
        if (filterStatus === 'active') {
          return status.includes('active') || status === 'ok' || status === 'instock';
        }
        if (filterStatus === 'pending') {
          return status.includes('pending') || status.includes('low') || status.includes('processing');
        }
        if (filterStatus === 'completed') {
          return status.includes('completed') || status.includes('done');
        }
        return true;
      });
    }

    // Sorting
    if (sortBy) {
      result.sort((a, b) => {
        let aVal = a[sortBy] ?? '';
        let bVal = b[sortBy] ?? '';
        
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, filterStatus, sortBy, sortOrder]);

  // ===== EXPORT CSV =====
  const exportCSV = useCallback(() => {
    if (!data || data.length === 0) {
      showMessage('❌ No data to export', 'error');
      return;
    }
    
    try {
      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => {
          const value = row[h] ?? '';
          return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showMessage(`✅ CSV exported successfully!`, 'success');
      
    } catch (error) {
      console.error('❌ Export error:', error);
      showMessage('❌ Failed to export CSV', 'error');
    }
  }, [data, reportType, showMessage]);

  // ===== PRINT REPORT =====
  const printReport = useCallback(() => {
    if (!data || data.length === 0) {
      showMessage('❌ No data to print', 'error');
      return;
    }
    window.print();
  }, [data, showMessage]);

  // ===== CLEAR REPORT =====
  const clearReport = useCallback(() => {
    setData(null);
    setTotalRecords(0);
    setGeneratedAt('');
    setReportType('');
    setError('');
    setSuccess('');
    setSearchTerm('');
    setFilterStatus('all');
    setSortBy('');
    setSortOrder('asc');
    setSelectedRows([]);
    setReportStats({ total: 0, active: 0, pending: 0, completed: 0, totalValue: 0 });
  }, []);

  // ===== GET STATUS COLOR =====
  const getStatusColor = useCallback((status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('active') || s.includes('completed') || s === 'ok' || s === 'instock') 
      return 'status-active';
    if (s.includes('pending') || s.includes('low') || s.includes('processing') || s === 'low stock') 
      return 'status-pending';
    if (s.includes('expired') || s.includes('inactive') || s.includes('cancelled')) 
      return 'status-expired';
    return 'status-default';
  }, []);

  // ===== GET STATUS BADGE =====
  const renderStatusBadge = useCallback((status) => {
    const color = getStatusColor(status);
    return (
      <span className={`status-badge ${color}`}>
        {status || 'N/A'}
      </span>
    );
  }, [getStatusColor]);

  // ===== FORMAT DATE =====
  const formatDate = useCallback((dateValue) => {
    if (!dateValue) return 'N/A';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return dateValue;
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateValue;
    }
  }, []);

  // ===== FORMAT CURRENCY =====
  const formatCurrency = useCallback((value) => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    const num = Number(value);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(num);
  }, []);

  // ===== GET REPORT LABEL =====
  const getReportLabel = useCallback(() => {
    return reportOptions.find(r => r.value === reportType)?.label || 'Report';
  }, [reportType, reportOptions]);

  // ===== GET REPORT COLOR =====
  const getReportColor = useCallback(() => {
    return reportOptions.find(r => r.value === reportType)?.color || 'from-indigo-500 to-purple-500';
  }, [reportType, reportOptions]);

  // ===== GET REPORT ICON =====
  const getReportIcon = useCallback(() => {
    return reportOptions.find(r => r.value === reportType)?.icon || ClipboardList;
  }, [reportType, reportOptions]);

  // ===== GET STAT ICON =====
  const getStatIcon = useCallback((type) => {
    const icons = {
      total: <Database className="w-5 h-5 text-indigo-500" />,
      active: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      pending: <Clock className="w-5 h-5 text-yellow-500" />,
      completed: <Award className="w-5 h-5 text-purple-500" />,
      totalValue: <DollarSign className="w-5 h-5 text-blue-500" />
    };
    return icons[type] || icons.total;
  }, []);

  // ===== ROW KEY HELPER (falls back to index if ID missing/duplicate-unsafe) =====
  const getRowKey = useCallback((row, index) => {
    return row?.ID !== undefined && row?.ID !== null && row?.ID !== ''
      ? `id-${row.ID}`
      : `idx-${index}`;
  }, []);

  // ===== TOGGLE SELECT =====
  const toggleSelect = useCallback((rowKey) => {
    setSelectedRows(prev => {
      if (prev.includes(rowKey)) {
        return prev.filter(k => k !== rowKey);
      } else {
        return [...prev, rowKey];
      }
    });
  }, []);

  // ===== TOGGLE SELECT ALL =====
  const toggleSelectAll = useCallback(() => {
    const allKeys = filteredData.map((row, index) => getRowKey(row, index));
    const allSelected = allKeys.length > 0 && allKeys.every(k => selectedRows.includes(k));
    if (allSelected) {
      setSelectedRows([]);
    } else {
      setSelectedRows(allKeys);
    }
  }, [selectedRows, filteredData, getRowKey]);

  // ===== VIEW DETAIL =====
  const viewDetail = useCallback((row) => {
    setSelectedDetail(row);
    setShowDetailModal(true);
  }, []);

  // ===== GET STATS CARDS =====
  const statsCards = [
    { label: 'Total Records', value: reportStats.total, icon: 'total' },
    { label: 'Active/OK', value: reportStats.active, icon: 'active' },
    { label: 'Pending/Low', value: reportStats.pending, icon: 'pending' },
    { label: 'Completed', value: reportStats.completed, icon: 'completed' },
    { label: 'Total Value', value: formatCurrency(reportStats.totalValue), icon: 'totalValue' }
  ];

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="reports-loading">
        <div className="reports-loading-spinner">
          <div className="reports-loading-ring">
            <div className="reports-loading-ring-inner" />
            <div className="reports-loading-ring-pulse" />
          </div>
        </div>
        <p className="reports-loading-text">Generating {getReportLabel()}...</p>
        <div className="reports-loading-dots">
          <span className="reports-loading-dot" style={{ animationDelay: '0s' }} />
          <span className="reports-loading-dot" style={{ animationDelay: '0.2s' }} />
          <span className="reports-loading-dot" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  // ===== RENDER =====
  return (
    <div className="reports-container">
      
      {/* ===== MESSAGE TOAST ===== */}
      {(error || success) && (
        <div className={`toast-message ${success ? 'toast-success' : 'toast-error'}`}>
          <div className="toast-content">
            <div className="toast-icon">
              {success ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
            </div>
            <div className="toast-text">{success || error}</div>
            <button onClick={() => { setError(''); setSuccess(''); }} className="toast-close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===== HEADER WITH STATS ===== */}
      <div className={`reports-header bg-gradient-to-r ${getReportColor()}`}>
        <div className="reports-header-content">
          <div className="reports-header-left">
            <h1 className="reports-header-title">
              {reportType ? (
                <>
                  {React.createElement(getReportIcon(), { className: "reports-header-icon" })}
                  {getReportLabel()}
                </>
              ) : (
                <>
                  <ClipboardList className="reports-header-icon" />
                  Reports Dashboard
                </>
              )}
            </h1>
            <p className="reports-header-subtitle">
              <Calendar className="w-4 h-4" />
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {generatedAt && (
                <span className="reports-header-generated">
                  • Generated: {generatedAt}
                </span>
              )}
            </p>
          </div>
          <div className="reports-header-actions">
            {data && data.length > 0 && (
              <button
                onClick={clearReport}
                className="reports-header-btn-clear"
              >
                <X className="w-4 h-4" />
                Clear Report
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {data && data.length > 0 && (
          <div className="reports-stats">
            {statsCards.map((stat, index) => (
              <div key={index} className="reports-stat-card" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="reports-stat-header">
                  {getStatIcon(stat.icon)}
                  <p className="reports-stat-label">{stat.label}</p>
                </div>
                <p className="reports-stat-value">{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== CONTROLS ===== */}
      <div className="reports-controls">
        <div className="reports-controls-content">
          <div className="reports-controls-left">
            {/* Report Type */}
            <div className="reports-control-group">
              <select 
                value={reportType} 
                onChange={(e) => {
                  const newType = e.target.value;
                  setReportType(newType);
                }}
                className="reports-select"
              >
                <option value="">📊 Select Report</option>
                {reportOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              
              <button 
                onClick={() => generateReport()}
                disabled={!reportType || isRefreshing || isGenerating}
                className="reports-generate-btn"
              >
                {isRefreshing || isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ClipboardList className="w-4 h-4" />
                )}
                {isRefreshing || isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>

            {/* Search - Only show when data exists */}
            {data && data.length > 0 && (
              <div className="reports-search">
                <Search className="reports-search-icon" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="🔍 Search in report..."
                  className="reports-search-input"
                />
              </div>
            )}
          </div>

          <div className="reports-controls-right">
            {/* Filter */}
            {data && data.length > 0 && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="reports-filter"
              >
                <option value="all">All Status</option>
                <option value="active">Active/OK</option>
                <option value="pending">Pending/Low</option>
                <option value="completed">Completed</option>
              </select>
            )}

            {/* Sort */}
            {data && data.length > 0 && (
              <div className="reports-sort">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="reports-sort-select"
                >
                  <option value="">Sort By</option>
                  {data.length > 0 && Object.keys(data[0]).map(key => (
                    <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                {sortBy && (
                  <button 
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="reports-sort-btn"
                  >
                    {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  </button>
                )}
              </div>
            )}

            {/* View Toggle */}
            {data && data.length > 0 && (
              <div className="reports-view-toggle">
                <button 
                  onClick={() => setViewMode('table')} 
                  className={`reports-view-btn ${viewMode === 'table' ? 'reports-view-active' : ''}`}
                  title="Table view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Export Buttons */}
            {data && data.length > 0 && (
              <>
                <button 
                  onClick={exportCSV}
                  className="reports-export-btn"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button 
                  onClick={printReport}
                  className="reports-print-btn"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===== REPORT CONTENT ===== */}
      {data && data.length > 0 ? (
        <div className="reports-content">
          {/* Report Info */}
          <div className="reports-info">
            <div className="reports-info-left">
              <span className="reports-info-item">
                <Database className="w-4 h-4" />
                <span className="reports-info-highlight">{totalRecords}</span> records
              </span>
              <span className="reports-info-divider"></span>
              <span className="reports-info-item">
                <Calendar className="w-4 h-4" />
                Generated: {generatedAt}
              </span>
              <span className="reports-info-divider"></span>
              <span className="reports-info-item">
                <ClipboardList className="w-4 h-4" />
                <span className="reports-info-highlight">{getReportLabel()}</span>
              </span>
            </div>
            <div className="reports-info-right">
              <span className="reports-info-count">
                {filteredData.length} of {data.length} shown
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="reports-table-wrapper">
            <table className="reports-table" id="report-table">
              <thead className="reports-thead">
                <tr>
                  <th className="reports-th w-10">
                    <input
                      type="checkbox"
                      checked={filteredData.length > 0 && filteredData.every((row, index) => selectedRows.includes(getRowKey(row, index)))}
                      onChange={toggleSelectAll}
                      className="reports-checkbox"
                    />
                  </th>
                  {data.length > 0 && Object.keys(data[0]).map(key => (
                    <th 
                      key={key} 
                      className="reports-th"
                      onClick={() => {
                        if (sortBy === key) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy(key);
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="reports-th-content">
                        {key.replace(/_/g, ' ')}
                        {sortBy === key && (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="reports-th text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="reports-tbody">
                {filteredData.map((row, index) => {
                  const rowKey = getRowKey(row, index);
                  return (
                    <tr key={rowKey} className="reports-tr" style={{ animationDelay: `${index * 0.03}s` }}>
                      <td className="reports-td w-10">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(rowKey)}
                          onChange={() => toggleSelect(rowKey)}
                          className="reports-checkbox"
                        />
                      </td>
                      {Object.entries(row).map(([key, value], i) => {
                        let displayValue = value !== null && value !== undefined ? String(value) : '-';
                        
                        // Special formatting for specific fields
                        if (key.toLowerCase().includes('date') && value) {
                          displayValue = formatDate(value);
                        }
                        else if ((key.toLowerCase().includes('price') || 
                                  key.toLowerCase().includes('balance') || 
                                  key.toLowerCase().includes('total') || 
                                  key.toLowerCase().includes('value')) && 
                                  value !== null && value !== undefined) {
                          displayValue = formatCurrency(value);
                        }
                        else if (key.toLowerCase().includes('status') || key.toLowerCase().includes('type')) {
                          return (
                            <td key={i} className="reports-td">
                              {renderStatusBadge(value)}
                            </td>
                          );
                        }
                        
                        // Truncate long text
                        if (typeof displayValue === 'string' && displayValue.length > 50) {
                          displayValue = displayValue.slice(0, 50) + '...';
                        }
                        
                        return (
                          <td key={i} className="reports-td" title={displayValue}>
                            {displayValue}
                          </td>
                        );
                      })}
                      <td className="reports-td text-center">
                        <button
                          onClick={() => viewDetail(row)}
                          className="reports-view-btn"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="reports-footer">
            <span>Showing {filteredData.length} of {data.length} records</span>
            <span className="reports-footer-right">
              <span>Generated: {generatedAt}</span>
              <span className="reports-footer-total">• Total: {totalRecords} records</span>
            </span>
          </div>
        </div>
      ) : data && data.length === 0 ? (
        <div className="reports-empty">
          <Database className="reports-empty-icon" />
          <h3 className="reports-empty-title">No data found</h3>
          <p className="reports-empty-text">Try generating a different report or adjusting your filters</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterStatus('all');
              generateReport();
            }}
            className="reports-empty-btn"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Refresh Report
          </button>
        </div>
      ) : (
        <div className="reports-select-view">
          <div className="reports-select-content">
            <div className="reports-select-icon-wrapper">
              <ClipboardList className="reports-select-icon" />
            </div>
            <h3 className="reports-select-title">Select a Report Type</h3>
            <p className="reports-select-text">Choose a report from the options below and click Generate</p>
            
            <div className="reports-options-grid">
              {reportOptions.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setReportType(opt.value);
                    }}
                    className={`reports-option-btn ${opt.bgColor}`}
                  >
                    <div className="reports-option-icon">
                      <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <p className="reports-option-label">{opt.label}</p>
                    <p className="reports-option-description">{opt.description}</p>
                    <div className="reports-option-cta">
                      Select <ChevronRight className="w-3 h-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== DETAIL MODAL ===== */}
      {showDetailModal && selectedDetail && (
        <div className="reports-modal-overlay">
          <div className="reports-modal-content">
            <div className="reports-modal-header">
              <h2 className="reports-modal-title">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                Record Details
                <span className="reports-modal-subtitle">
                  {reportType && `• ${getReportLabel()}`}
                </span>
              </h2>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="reports-modal-close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="reports-modal-body">
              <div className="reports-modal-grid">
                {Object.entries(selectedDetail).map(([key, value]) => {
                  let displayValue = value !== null && value !== undefined ? String(value) : 'N/A';
                  
                  if (key.toLowerCase().includes('date') && value) {
                    displayValue = formatDate(value);
                  } else if ((key.toLowerCase().includes('price') || 
                              key.toLowerCase().includes('balance') || 
                              key.toLowerCase().includes('total') || 
                              key.toLowerCase().includes('value')) && 
                              value !== null && value !== undefined) {
                    displayValue = formatCurrency(value);
                  } else if (key.toLowerCase().includes('status') || key.toLowerCase().includes('type')) {
                    return (
                      <div key={key} className="reports-modal-item col-span-2 sm:col-span-1">
                        <p className="reports-modal-item-label">{key.replace(/_/g, ' ')}</p>
                        <div className="reports-modal-item-value">{renderStatusBadge(value)}</div>
                      </div>
                    );
                  }
                  
                  // Truncate long text in modal
                  if (typeof displayValue === 'string' && displayValue.length > 200) {
                    displayValue = displayValue.slice(0, 200) + '...';
                  }
                  
                  return (
                    <div key={key} className="reports-modal-item col-span-2 sm:col-span-1">
                      <p className="reports-modal-item-label">{key.replace(/_/g, ' ')}</p>
                      <p className="reports-modal-item-value">{displayValue}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="reports-modal-footer">
              <button 
                onClick={() => setShowDetailModal(false)}
                className="reports-modal-footer-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div className="reports-app-footer">
        <p className="reports-footer-text">
          <span>📊 Reports Dashboard</span>
          <span>•</span>
          <span>📈 {totalRecords} records available</span>
          <span>•</span>
          <span>🔄 Data on demand</span>
          <span>•</span>
          <span>© {new Date().getFullYear()} SPMS</span>
        </p>
      </div>
    </div>
  );
};

// ===== ADD MISSING DOLLAR SIGN ICON =====
const DollarSign = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

export default Reports;