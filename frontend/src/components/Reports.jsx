import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { 
  ClipboardList, Download, Printer, RefreshCw, 
  AlertCircle, CheckCircle, Loader2, Database,
  TrendingUp, Package, Users, ShoppingBag,
  Calendar, Filter, ChevronDown, X, Eye,  // ← X is here ✅
  Clock, Award, Star, Zap, Activity, 
  BarChart3, PieChart, LineChart as LineChartIcon,
  ArrowUp, ArrowDown, Grid3x3, List,
  Plus, Edit2, Trash2, Truck, Phone, Mail,
  MapPin, User, Building2, Globe, Shield,
  Search, Save, ChevronRight
} from 'lucide-react';

// ============================================
// API CONFIGURATION
// ============================================
const API_URL = import.meta.env?.VITE_API_URL || '';
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  const [selectedRows, setSelectedRows] = useState([]);
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
  
  // ===== ADDED: Track if initial load has happened =====
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // ===== REFS =====
  const isMounted = useRef(true);
  const searchTimeout = useRef(null);
  const generationCount = useRef(0);

  // ===== REPORT OPTIONS =====
  const reportOptions = [
    { 
      value: 'customers', 
      label: '👥 Customer List',
      description: 'View all active customers with contact details',
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    { 
      value: 'products', 
      label: '📦 Product List',
      description: 'View all products with pricing and stock',
      icon: Package,
      color: 'from-emerald-500 to-green-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
    },
    { 
      value: 'orders', 
      label: '🛒 Order Summary',
      description: 'View all orders with status and amounts',
      icon: ShoppingBag,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    },
    { 
      value: 'stock', 
      label: '📊 Stock Report',
      description: 'View current stock levels and alerts',
      icon: TrendingUp,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20'
    },
    { 
      value: 'sales', 
      label: '💰 Sales Report',
      description: 'View sales performance and revenue',
      icon: BarChart3,
      color: 'from-red-500 to-rose-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    },
    { 
      value: 'inventory', 
      label: '📦 Inventory Report',
      description: 'View inventory movements and adjustments',
      icon: Activity,
      color: 'from-indigo-500 to-purple-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20'
    }
  ];

  // ===== GENERATE MOCK DATA =====
  const generateMockData = useCallback((type) => {
    const now = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];
    
    switch(type) {
      case 'customers':
        return [
          { CUS_ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', PHONE: '555-0101', E_MAIL: 'john@example.com', ADDRESS: '123 Main St', STATUS: 'Active', JOIN_DATE: formatDate(new Date(now.getFullYear(), 0, 15)), BALANCE: 150.00 },
          { CUS_ID: 2, FIRST_NAME: 'Jane', LAST_NAME: 'Smith', PHONE: '555-0102', E_MAIL: 'jane@example.com', ADDRESS: '456 Oak Ave', STATUS: 'Active', JOIN_DATE: formatDate(new Date(now.getFullYear(), 1, 20)), BALANCE: 0.00 },
          { CUS_ID: 3, FIRST_NAME: 'Robert', LAST_NAME: 'Johnson', PHONE: '555-0103', E_MAIL: 'robert@example.com', ADDRESS: '789 Pine Rd', STATUS: 'Active', JOIN_DATE: formatDate(new Date(now.getFullYear(), 2, 10)), BALANCE: 75.50 },
          { CUS_ID: 4, FIRST_NAME: 'Mary', LAST_NAME: 'Williams', PHONE: '555-0104', E_MAIL: 'mary@example.com', ADDRESS: '321 Elm St', STATUS: 'Inactive', JOIN_DATE: formatDate(new Date(now.getFullYear(), 3, 5)), BALANCE: 200.00 },
          { CUS_ID: 5, FIRST_NAME: 'David', LAST_NAME: 'Brown', PHONE: '555-0105', E_MAIL: 'david@example.com', ADDRESS: '654 Maple Dr', STATUS: 'Active', JOIN_DATE: formatDate(new Date(now.getFullYear(), 4, 12)), BALANCE: 0.00 },
        ];
      case 'products':
        return [
          { PRODUCT_ID: 1, NAME_EN: 'Laptop Pro', NAME_KH: 'កុំព្យូទ័រយួរដៃ Pro', SALEOUT_PRICE: 1299.99, QtyInStock: 15, STATUS: 'Active', CATEGORY: 'Electronics', SKU: 'LP-001' },
          { PRODUCT_ID: 2, NAME_EN: 'Smartphone X', NAME_KH: 'ទូរស័ព្ទ X', SALEOUT_PRICE: 899.99, QtyInStock: 25, STATUS: 'Active', CATEGORY: 'Electronics', SKU: 'SP-002' },
          { PRODUCT_ID: 3, NAME_EN: 'Tablet Plus', NAME_KH: 'ថេប្លេត Plus', SALEOUT_PRICE: 499.99, QtyInStock: 10, STATUS: 'Active', CATEGORY: 'Electronics', SKU: 'TB-003' },
          { PRODUCT_ID: 4, NAME_EN: 'Wireless Mouse', NAME_KH: 'កណ្ដុរឥតខ្សែ', SALEOUT_PRICE: 29.99, QtyInStock: 50, STATUS: 'Active', CATEGORY: 'Accessories', SKU: 'WM-004' },
          { PRODUCT_ID: 5, NAME_EN: 'Keyboard Pro', NAME_KH: 'ក្ដារចុច Pro', SALEOUT_PRICE: 79.99, QtyInStock: 30, STATUS: 'Active', CATEGORY: 'Accessories', SKU: 'KB-005' },
        ];
      case 'orders':
        return [
          { ORDER_NO: 'ORD-001', ORDER_DATE: formatDate(new Date(now.getFullYear(), 6, 1)), AMOUNT_US: 149.99, STATUS: 'Completed', PAYMENT_METHOD: 'Card', CUSTOMER: 'John Doe' },
          { ORDER_NO: 'ORD-002', ORDER_DATE: formatDate(new Date(now.getFullYear(), 6, 5)), AMOUNT_US: 89.50, STATUS: 'Pending', PAYMENT_METHOD: 'Cash', CUSTOMER: 'Jane Smith' },
          { ORDER_NO: 'ORD-003', ORDER_DATE: formatDate(new Date(now.getFullYear(), 6, 10)), AMOUNT_US: 234.75, STATUS: 'Completed', PAYMENT_METHOD: 'Card', CUSTOMER: 'Robert Johnson' },
          { ORDER_NO: 'ORD-004', ORDER_DATE: formatDate(new Date(now.getFullYear(), 6, 12)), AMOUNT_US: 567.00, STATUS: 'Processing', PAYMENT_METHOD: 'Bank Transfer', CUSTOMER: 'Mary Williams' },
          { ORDER_NO: 'ORD-005', ORDER_DATE: formatDate(new Date(now.getFullYear(), 6, 15)), AMOUNT_US: 45.99, STATUS: 'Pending', PAYMENT_METHOD: 'Cash', CUSTOMER: 'David Brown' },
        ];
      case 'stock':
        return [
          { PRODUCT_ID: 1, NAME_EN: 'Laptop Pro', QtyInStock: 15, QtyAvailable: 12, QTY_ALERT: 10, STATUS: 'OK', LAST_UPDATED: formatDate(new Date(now.getFullYear(), 6, 20)) },
          { PRODUCT_ID: 2, NAME_EN: 'Smartphone X', QtyInStock: 25, QtyAvailable: 20, QTY_ALERT: 10, STATUS: 'OK', LAST_UPDATED: formatDate(new Date(now.getFullYear(), 6, 19)) },
          { PRODUCT_ID: 3, NAME_EN: 'Tablet Plus', QtyInStock: 5, QtyAvailable: 3, QTY_ALERT: 10, STATUS: 'LOW STOCK', LAST_UPDATED: formatDate(new Date(now.getFullYear(), 6, 18)) },
          { PRODUCT_ID: 4, NAME_EN: 'Wireless Mouse', QtyInStock: 50, QtyAvailable: 48, QTY_ALERT: 10, STATUS: 'OK', LAST_UPDATED: formatDate(new Date(now.getFullYear(), 6, 17)) },
          { PRODUCT_ID: 5, NAME_EN: 'Keyboard Pro', QtyInStock: 30, QtyAvailable: 28, QTY_ALERT: 10, STATUS: 'OK', LAST_UPDATED: formatDate(new Date(now.getFullYear(), 6, 16)) },
        ];
      case 'sales':
        return [
          { DATE: formatDate(new Date(now.getFullYear(), 6, 1)), REVENUE: 2450.00, ORDERS: 12, CUSTOMERS: 10, AVG_ORDER: 204.17 },
          { DATE: formatDate(new Date(now.getFullYear(), 6, 2)), REVENUE: 1890.50, ORDERS: 8, CUSTOMERS: 7, AVG_ORDER: 236.31 },
          { DATE: formatDate(new Date(now.getFullYear(), 6, 3)), REVENUE: 3120.75, ORDERS: 15, CUSTOMERS: 13, AVG_ORDER: 208.05 },
          { DATE: formatDate(new Date(now.getFullYear(), 6, 4)), REVENUE: 2345.25, ORDERS: 11, CUSTOMERS: 9, AVG_ORDER: 213.20 },
          { DATE: formatDate(new Date(now.getFullYear(), 6, 5)), REVENUE: 4567.80, ORDERS: 22, CUSTOMERS: 18, AVG_ORDER: 207.63 },
        ];
      case 'inventory':
        return [
          { PRODUCT_ID: 1, NAME: 'Laptop Pro', TYPE: 'In', QUANTITY: 5, DATE: formatDate(new Date(now.getFullYear(), 6, 1)), REFERENCE: 'PO-001', USER: 'Admin' },
          { PRODUCT_ID: 2, NAME: 'Smartphone X', TYPE: 'Out', QUANTITY: 3, DATE: formatDate(new Date(now.getFullYear(), 6, 2)), REFERENCE: 'SO-001', USER: 'Admin' },
          { PRODUCT_ID: 3, NAME: 'Tablet Plus', TYPE: 'In', QUANTITY: 10, DATE: formatDate(new Date(now.getFullYear(), 6, 3)), REFERENCE: 'PO-002', USER: 'Manager' },
          { PRODUCT_ID: 4, NAME: 'Wireless Mouse', TYPE: 'Out', QUANTITY: 2, DATE: formatDate(new Date(now.getFullYear(), 6, 4)), REFERENCE: 'SO-002', USER: 'Admin' },
          { PRODUCT_ID: 5, NAME: 'Keyboard Pro', TYPE: 'In', QUANTITY: 15, DATE: formatDate(new Date(now.getFullYear(), 6, 5)), REFERENCE: 'PO-003', USER: 'Manager' },
        ];
      default:
        return [];
    }
  }, []);

  // ===== CALCULATE STATS =====
  const calculateStats = useCallback((data) => {
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
      if (status.includes('active') || status === 'ok') stats.active++;
      if (status.includes('pending') || status.includes('low') || status.includes('processing')) stats.pending++;
      if (status.includes('completed') || status.includes('done')) stats.completed++;
      
      const amountFields = ['AMOUNT_US', 'amount_us', 'PRICE', 'price', 'REVENUE', 'revenue', 'SALEOUT_PRICE', 'saleout_price', 'BALANCE', 'balance'];
      let amount = 0;
      for (const field of amountFields) {
        if (item[field] !== undefined && item[field] !== null) {
          amount = Number(item[field]) || 0;
          break;
        }
      }
      stats.totalValue += amount;
    });

    setReportStats(stats);
  }, []);

  // ===== GENERATE REPORT - FIXED =====
  const generateReport = useCallback(async (skipLoading = false) => {
    // Prevent multiple simultaneous generations
    if (isGenerating) {
      console.log('⚠️ Already generating, skipping...');
      return;
    }
    
    if (!reportType) {
      setError('Please select a report type');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    // Increment generation counter for debugging
    generationCount.current += 1;
    console.log(`📊 Generating ${reportType} report (attempt ${generationCount.current})...`);
    
    setIsGenerating(true);
    if (!skipLoading) {
      setLoading(true);
    }
    setError('');
    setSuccess('');
    setData(null);
    setSelectedRows([]);
    setIsRefreshing(true);
    
    try {
      // Try to fetch from API with timeout
      const res = await api.get(`/reports/${reportType}`, {
        timeout: 8000,
        params: { search: searchTerm || undefined }
      });
      
      const reportData = res.data || [];
      if (isMounted.current) {
        setData(reportData);
        setTotalRecords(reportData.length);
        setGeneratedAt(new Date().toLocaleString());
        calculateStats(reportData);
        setSuccess(`✅ ${reportOptions.find(r => r.value === reportType)?.label} report generated successfully!`);
        setTimeout(() => setSuccess(''), 4000);
        console.log(`📊 ${reportType} report: ${reportData.length} records`);
        setInitialLoadDone(true);
      }
      
    } catch (error) {
      console.error(`❌ Error generating ${reportType} report:`, error.message);
      
      if (isMounted.current) {
        // Use mock data as fallback
        const mockData = generateMockData(reportType);
        setData(mockData);
        setTotalRecords(mockData.length);
        setGeneratedAt(new Date().toLocaleString());
        calculateStats(mockData);
        setSuccess(`✅ ${reportOptions.find(r => r.value === reportType)?.label} generated with sample data!`);
        setTimeout(() => setSuccess(''), 4000);
        console.log(`📊 ${reportType} report (mock): ${mockData.length} records`);
        setInitialLoadDone(true);
      }
      
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsRefreshing(false);
        setIsGenerating(false);
      }
    }
  }, [reportType, searchTerm, generateMockData, calculateStats, isGenerating]);

  // ===== INITIAL LOAD =====
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  // ===== SEARCH DEBOUNCE - FIXED =====
  useEffect(() => {
    // Clear any existing timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    // Only trigger search if we have data and reportType is set AND not loading
    if (reportType && data && !loading && !isGenerating) {
      searchTimeout.current = setTimeout(() => {
        console.log('🔍 Search debounce triggered');
        generateReport(true);
      }, 600);
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchTerm]); // ONLY depend on searchTerm

  // ===== FILTERED DATA =====
  const filteredData = useMemo(() => {
    if (!data) return [];

    let result = [...data];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(row => {
        return Object.values(row).some(value => {
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(search);
        });
      });
    }

    if (filterStatus !== 'all') {
      result = result.filter(row => {
        const status = String(row.STATUS || row.status || '').toLowerCase();
        if (filterStatus === 'active') return status.includes('active') || status === 'ok';
        if (filterStatus === 'pending') return status.includes('pending') || status.includes('low') || status.includes('processing');
        if (filterStatus === 'completed') return status.includes('completed') || status.includes('done');
        return true;
      });
    }

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
      setError('❌ No data to export');
      setTimeout(() => setError(''), 3000);
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
      
      setSuccess(`✅ CSV exported successfully!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('❌ Export error:', error);
      setError('❌ Failed to export CSV');
      setTimeout(() => setError(''), 3000);
    }
  }, [data, reportType]);

  // ===== PRINT REPORT =====
  const printReport = useCallback(() => {
    if (!data || data.length === 0) {
      setError('❌ No data to print');
      setTimeout(() => setError(''), 3000);
      return;
    }
    window.print();
  }, [data]);

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
    setInitialLoadDone(false);
    generationCount.current = 0;
  }, []);

  // ===== GET STATUS COLOR =====
  const getStatusColor = useCallback((status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('active') || s.includes('completed') || s === 'ok') 
      return 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800';
    if (s.includes('pending') || s.includes('low') || s.includes('processing')) 
      return 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800';
    if (s.includes('expired') || s.includes('inactive') || s.includes('cancelled')) 
      return 'text-red-700 bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800';
    return 'text-gray-700 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600';
  }, []);

  // ===== GET STATUS BADGE =====
  const renderStatusBadge = useCallback((status) => {
    const color = getStatusColor(status);
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}>
        {status || 'N/A'}
      </span>
    );
  }, [getStatusColor]);

  // ===== FORMAT DATE =====
  const formatDate = useCallback((dateValue) => {
    if (!dateValue) return 'N/A';
    try {
      const date = new Date(dateValue);
      if (isNaN(date)) return dateValue;
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
    if (value === undefined || value === null) return 'N/A';
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
  }, [reportType]);

  // ===== GET REPORT COLOR =====
  const getReportColor = useCallback(() => {
    return reportOptions.find(r => r.value === reportType)?.color || 'from-indigo-500 to-purple-500';
  }, [reportType]);

  // ===== GET REPORT ICON =====
  const getReportIcon = useCallback(() => {
    return reportOptions.find(r => r.value === reportType)?.icon || ClipboardList;
  }, [reportType]);

  // ===== GET STAT ICON =====
  const getStatIcon = useCallback((type) => {
    const icons = {
      total: <Database className="w-5 h-5 text-indigo-500" />,
      active: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      pending: <Clock className="w-5 h-5 text-yellow-500" />,
      completed: <Award className="w-5 h-5 text-purple-500" />
    };
    return icons[type] || icons.total;
  }, []);

  // ===== TOGGLE SELECT =====
  const toggleSelect = useCallback((id) => {
    setSelectedRows(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  // ===== TOGGLE SELECT ALL =====
  const toggleSelectAll = useCallback(() => {
    if (selectedRows.length === filteredData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredData.map((_, index) => index));
    }
  }, [selectedRows, filteredData]);

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
  ];

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 animate-ping" />
          </div>
        </div>
        <p className="text-gray-400 font-medium">Generating {getReportLabel()}...</p>
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0s' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  // ===== RENDER =====
  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen">
      
      {/* ===== MESSAGE TOAST ===== */}
      {(error || success) && (
        <div className={`fixed top-4 right-4 z-50 max-w-md w-full p-4 rounded-xl shadow-2xl border transform transition-all duration-500 animate-slideInRight ${
          success 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' 
            : 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {success ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
            </div>
            <div className="flex-1 text-sm font-medium">{success || error}</div>
            <button onClick={() => { setError(''); setSuccess(''); }} className="flex-shrink-0 opacity-50 hover:opacity-100 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===== HEADER WITH STATS ===== */}
      <div className={`bg-gradient-to-r ${getReportColor()} rounded-2xl p-6 text-white shadow-xl`}>
        <div className="flex flex-wrap justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {reportType ? (
                <>
                  {React.createElement(getReportIcon(), { className: "w-8 h-8" })}
                  {getReportLabel()}
                </>
              ) : (
                <>
                  <ClipboardList className="w-8 h-8" />
                  Reports Dashboard
                </>
              )}
            </h1>
            <p className="text-white/80 mt-1 text-sm flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4" />
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {generatedAt && (
                <span className="text-white/60 text-xs">
                  • Generated: {generatedAt}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-3 sm:mt-0">
            {data && (
              <button
                onClick={clearReport}
                className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl hover:bg-white/30 transition flex items-center gap-2 text-sm"
              >
                <X className="w-4 h-4" />
                Clear Report
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {data && data.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {statsCards.map((stat, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 hover:bg-white/20 transition animate-slideUp" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="flex items-center gap-2">
                  {getStatIcon(stat.icon)}
                  <p className="text-xs text-white/70">{stat.label}</p>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== CONTROLS ===== */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Report Type */}
            <div className="flex items-center gap-2">
              <select 
                value={reportType} 
                onChange={(e) => {
                  const newType = e.target.value;
                  setReportType(newType);
                  // Don't auto-generate, wait for user to click Generate
                }}
                className="px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition min-w-[180px]"
              >
                <option value="">📊 Select Report</option>
                {reportOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              
              <button 
                onClick={() => generateReport(false)}
                disabled={!reportType || isRefreshing || isGenerating}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
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
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="🔍 Search in report..."
                  className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter */}
            {data && data.length > 0 && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              >
                <option value="all">All Status</option>
                <option value="active">Active/OK</option>
                <option value="pending">Pending/Low</option>
                <option value="completed">Completed</option>
              </select>
            )}

            {/* Export Buttons */}
            {data && data.length > 0 && (
              <>
                <button 
                  onClick={exportCSV}
                  className="px-3 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button 
                  onClick={printReport}
                  className="px-3 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition flex items-center gap-2 text-sm"
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Report Info */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/30 dark:to-gray-800/30 flex flex-wrap justify-between items-center gap-2">
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Database className="w-4 h-4" />
                <span className="font-medium text-gray-700 dark:text-gray-300">{totalRecords}</span> records
              </span>
              <span className="w-px h-4 bg-gray-300 dark:bg-gray-600"></span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Generated: {generatedAt}
              </span>
              <span className="w-px h-4 bg-gray-300 dark:bg-gray-600"></span>
              <span className="flex items-center gap-1">
                <ClipboardList className="w-4 h-4" />
                <span className="font-medium text-gray-700 dark:text-gray-300">{getReportLabel()}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {filteredData.length} of {data.length} shown
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full" id="report-table">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.length === filteredData.length && filteredData.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  {data.length > 0 && Object.keys(data[0]).map(key => (
                    <th 
                      key={key} 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition whitespace-nowrap"
                      onClick={() => {
                        if (sortBy === key) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy(key);
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-1">
                        {key.replace(/_/g, ' ')}
                        {sortBy === key && (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredData.map((row, index) => {
                  const rowId = row.ID || row.id || index;
                  return (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group animate-slideIn" style={{ animationDelay: `${index * 0.03}s` }}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(index)}
                          onChange={() => toggleSelect(index)}
                          className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      {Object.entries(row).map(([key, value], i) => {
                        let displayValue = value !== null && value !== undefined ? String(value) : '-';
                        
                        if (key.toLowerCase().includes('date') && value) {
                          displayValue = formatDate(value);
                        }
                        else if ((key.toLowerCase().includes('amount') || key.toLowerCase().includes('price') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('balance')) && value !== null && value !== undefined) {
                          displayValue = formatCurrency(value);
                        }
                        else if (key.toLowerCase().includes('status') || key.toLowerCase().includes('type')) {
                          return (
                            <td key={i} className="px-4 py-2 text-sm">
                              {renderStatusBadge(value)}
                            </td>
                          );
                        }
                        
                        return (
                          <td key={i} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={displayValue}>
                            {displayValue}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => viewDetail(row)}
                          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition group-hover:scale-110"
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
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 flex flex-wrap justify-between items-center gap-2">
            <span>Showing {filteredData.length} of {data.length} records</span>
            <span className="flex items-center gap-4">
              <span>Generated: {generatedAt}</span>
              <span className="hidden sm:inline">• Total: {totalRecords} records</span>
            </span>
          </div>
        </div>
      ) : data && data.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
          <Database className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4 animate-float" />
          <h3 className="text-xl font-medium text-gray-600 dark:text-gray-400">No data found</h3>
          <p className="text-gray-400 dark:text-gray-500 mt-2">Try generating a different report or adjusting your filters</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterStatus('all');
              generateReport(false);
            }}
            className="mt-4 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition font-medium"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Refresh Report
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-6 animate-float">
              <ClipboardList className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Select a Report Type</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Choose a report from the options below and click Generate</p>
            
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportOptions.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setReportType(opt.value);
                      // Don't auto-generate, wait for user to click Generate
                    }}
                    className={`p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all hover:shadow-lg hover:-translate-y-1 ${opt.bgColor} group`}
                  >
                    <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center group-hover:scale-110 transition">
                      <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <p className="mt-2 font-medium text-gray-800 dark:text-white text-sm">{opt.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</p>
                    <div className="mt-3 text-indigo-600 dark:text-indigo-400 text-xs font-medium opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                      Click Generate <ChevronRight className="w-3 h-3" />
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                Record Details
                <span className="text-sm font-normal text-gray-400 ml-2">
                  {reportType && `• ${getReportLabel()}`}
                </span>
              </h2>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(selectedDetail).map(([key, value]) => {
                  let displayValue = value !== null && value !== undefined ? String(value) : 'N/A';
                  
                  if (key.toLowerCase().includes('date') && value) {
                    displayValue = formatDate(value);
                  } else if ((key.toLowerCase().includes('amount') || key.toLowerCase().includes('price') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('balance')) && value !== null && value !== undefined) {
                    displayValue = formatCurrency(value);
                  } else if (key.toLowerCase().includes('status') || key.toLowerCase().includes('type')) {
                    return (
                      <div key={key} className="col-span-2 sm:col-span-1 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{key.replace(/_/g, ' ')}</p>
                        <div className="mt-1">{renderStatusBadge(value)}</div>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={key} className="col-span-2 sm:col-span-1 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{key.replace(/_/g, ' ')}</p>
                      <p className="font-medium dark:text-white break-words">{displayValue}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-4 border-t border-gray-200 dark:border-gray-700">
        <p className="flex items-center justify-center gap-4 flex-wrap">
          <span>📊 Reports Dashboard</span>
          <span>•</span>
          <span>📈 {totalRecords} records available</span>
          <span>•</span>
          <span>🔄 Data on demand</span>
          <span>•</span>
          <span>© {new Date().getFullYear()} SPMS</span>
        </p>
      </div>

      {/* ===== CSS ANIMATIONS ===== */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; opacity: 0; }
        .animate-slideIn { animation: slideIn 0.4s ease-out forwards; opacity: 0; }
        .animate-slideInRight { animation: slideInRight 0.5s ease-out forwards; }
        .animate-slideUp { animation: slideUp 0.4s ease-out forwards; opacity: 0; }
        .animate-float { animation: float 3s ease-in-out infinite; }

        @media print {
          .fixed { display: none !important; }
          .bg-gradient-to-r { background: #fff !important; color: #000 !important; }
          button { display: none !important; }
          .dark\\:bg-gray-800 { background: #fff !important; }
          .dark\\:text-white { color: #000 !important; }
          .border { border-color: #ddd !important; }
          #report-table { border-collapse: collapse; width: 100%; }
          #report-table th, #report-table td { padding: 8px; border: 1px solid #ddd; }
          #report-table th { background: #f5f5f5; }
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #c4c4c4;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #a0a0a0;
        }
        .dark ::-webkit-scrollbar-thumb {
          background: #4b5563;
        }
        .dark ::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
    </div>
  );
};

export default Reports;

