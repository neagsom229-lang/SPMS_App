// ============================================
// ✅ COMPLETE FIXED: SUPPLIERS COMPONENT
// ============================================
// Fixes applied:
// 1. Backend already returns/expects frontend-shaped keys (SUP_NAME, CONTACT_PERSON,
//    PHONE, EMAIL, ADDRESS, STATUS, WEBSITE, TAX_ID, NOTES) and maps them to DB
//    columns internally. The old code ran data through mapFrontendToDb() before
//    POST/PUT (sending { company, phone, e_mail... } which the backend never reads,
//    causing "Supplier name is required" on every submit) and through
//    mapDbToFrontend() after GET (expecting { company, sup_id, first_name... } which
//    the backend never sends, causing every row to show as "Unknown" / "No contact").
// 2. Both mapping functions removed. Data is now sent/received as-is, with a light
//    normalize() step on read to guarantee safe defaults for missing fields.
// ============================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import apiClient from '../api/client';import { 
  Search, Plus, Edit2, Trash2, Truck, X, Save, 
  Phone, Mail, MapPin, User, Building2, RefreshCw,
  Filter, ArrowUp, ArrowDown, Grid3x3, List,
  Clock, CheckCircle, AlertCircle,
  Eye, Globe, Shield,
  Download, AlertTriangle,
  ClipboardList, Loader2, Star, Award
} from 'lucide-react';

// ============================================
// API CONFIGURATION
// ============================================
// ============================================
// ✅ NORMALIZE — backend already returns frontend-shaped keys.
// This just guarantees every field exists with a safe default and every
// row has a unique SUP_ID, without translating field names.
// ============================================
const normalizeSupplier = (item, index) => {
  if (!item) return null;
  return {
    SUP_ID: item.SUP_ID || `TEMP-${Date.now()}-${index}`,
    SUP_NAME: item.SUP_NAME || 'Unknown',
    CONTACT_PERSON: item.CONTACT_PERSON || '',
    PHONE: item.PHONE || '',
    EMAIL: item.EMAIL || '',
    ADDRESS: item.ADDRESS || '',
    STATUS: item.STATUS || 'Active',
    WEBSITE: item.WEBSITE || '',
    TAX_ID: item.TAX_ID || '',
    NOTES: item.NOTES || '',
  };
};

// ============================================
// ✅ MOCK DATA (Fallback, already in frontend shape)
// ============================================
const generateMockSuppliers = () => {
  return [
    { 
      SUP_ID: 'SUP001', 
      SUP_NAME: 'TechPro Supplies', 
      CONTACT_PERSON: 'John Smith', 
      PHONE: '555-0101', 
      EMAIL: 'john@techpro.com', 
      ADDRESS: '123 Tech St, Silicon Valley, CA 94025',
      STATUS: 'Active',
      WEBSITE: 'https://techpro.com',
      TAX_ID: 'TAX-12345',
      NOTES: 'Premium electronics supplier'
    },
    { 
      SUP_ID: 'SUP002', 
      SUP_NAME: 'Global Electronics', 
      CONTACT_PERSON: 'Sarah Johnson', 
      PHONE: '555-0102', 
      EMAIL: 'sarah@globalelec.com', 
      ADDRESS: '456 Global Ave, New York, NY 10001',
      STATUS: 'Active',
      WEBSITE: 'https://globalelectronics.com',
      TAX_ID: 'TAX-67890',
      NOTES: 'International electronics distributor'
    },
  ];
};

// ============================================
// ✅ MAIN SUPPLIERS COMPONENT
// ============================================
const Suppliers = () => {
  // ===== STATE =====
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('SUP_NAME');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState(null);
  const [supplierStats, setSupplierStats] = useState({
    total: 0,
    active: 0,
    withPhone: 0,
    withEmail: 0
  });

  // ===== FORM DATA =====
  const [formData, setFormData] = useState({
    SUP_NAME: '',
    CONTACT_PERSON: '',
    PHONE: '',
    ADDRESS: '',
    EMAIL: '',
    STATUS: 'Active',
    WEBSITE: '',
    TAX_ID: '',
    NOTES: ''
  });

  // ===== REFS =====
  const isMounted = useRef(true);
  const messageTimeoutRef = useRef(null);
  const fetchInProgress = useRef(false);

  // ===== SHOW MESSAGE =====
  const showMessage = useCallback((text, type = 'success') => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    setMessage(text);
    setMessageType(type);
    messageTimeoutRef.current = setTimeout(() => {
      setMessage('');
    }, 5000);
  }, []);

  // ===== CALCULATE STATS =====
  const calculateStats = useCallback((data) => {
    const stats = {
      total: data.length,
      active: data.filter(s => (s.STATUS || 'Active') === 'Active').length,
      withPhone: data.filter(s => s.PHONE && s.PHONE.trim() !== '').length,
      withEmail: data.filter(s => s.EMAIL && s.EMAIL.trim() !== '').length
    };
    setSupplierStats(stats);
  }, []);

  // ===== RESET FORM =====
  const resetForm = useCallback(() => {
    setFormData({ 
      SUP_NAME: '', 
      CONTACT_PERSON: '', 
      PHONE: '', 
      ADDRESS: '', 
      EMAIL: '',
      STATUS: 'Active',
      WEBSITE: '',
      TAX_ID: '',
      NOTES: ''
    });
  }, []);

  // ===== ✅ FIXED: FETCH SUPPLIERS (no field-name translation, just normalize) =====
  const fetchSuppliers = useCallback(async () => {
    if (fetchInProgress.current) return;
    if (!isMounted.current) return;
    
    fetchInProgress.current = true;
    setLoading(true);
    
    try {
      const url = search ? `/suppliers?search=${encodeURIComponent(search)}` : '/suppliers';
      const res = await apiClient.get(url);
      
      if (isMounted.current) {
        let data = [];
        if (Array.isArray(res.data)) {
          data = res.data;
        } else if (res.data?.data && Array.isArray(res.data.data)) {
          data = res.data.data;
        }
        
        if (data.length > 0) {
          const normalized = data.map((item, index) => normalizeSupplier(item, index)).filter(Boolean);
          setSuppliers(normalized);
          calculateStats(normalized);
        } else {
          const mockData = generateMockSuppliers().map((item, index) => normalizeSupplier(item, index)).filter(Boolean);
          setSuppliers(mockData);
          calculateStats(mockData);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching suppliers:', error);
      if (isMounted.current) {
        const mockData = generateMockSuppliers().map((item, index) => normalizeSupplier(item, index)).filter(Boolean);
        setSuppliers(mockData);
        calculateStats(mockData);
        showMessage('⚠️ Using sample data (API unavailable)', 'warning');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
      fetchInProgress.current = false;
    }
  }, [search, showMessage, calculateStats]);

  // ===== GENERATE NEW ID (fallback only — backend normally assigns this) =====
  const generateId = useCallback(() => {
    if (suppliers.length === 0) return 'SUP001';
    const maxId = suppliers.reduce((max, s) => {
      const num = parseInt(s.SUP_ID?.replace('SUP', '') || '0');
      return num > max ? num : max;
    }, 0);
    return `SUP${String(maxId + 1).padStart(3, '0')}`;
  }, [suppliers]);

  // ===== OPEN ADD MODAL =====
  const openAddModal = useCallback(() => {
    setEditingSupplier(null);
    resetForm();
    setShowModal(true);
  }, [resetForm]);

  // ===== ✅ FIXED: HANDLE SUBMIT — send formData directly, backend maps it =====
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    if (!formData.SUP_NAME || formData.SUP_NAME.trim() === '') {
      showMessage('❌ Supplier name is required', 'error');
      setSubmitting(false);
      return;
    }

    try {
      if (editingSupplier) {
        await apiClient.put(`/suppliers/${editingSupplier.SUP_ID}`, formData);
        
        const updatedSuppliers = suppliers.map(s => 
          s.SUP_ID === editingSupplier.SUP_ID ? { ...formData, SUP_ID: editingSupplier.SUP_ID } : s
        );
        setSuppliers(updatedSuppliers);
        calculateStats(updatedSuppliers);
        showMessage('✅ Supplier updated successfully!');
      } else {
        const response = await apiClient.post('/suppliers', formData);
        const newId = response.data?.SUP_ID || generateId();
        const newSupplier = { ...formData, SUP_ID: newId };
        const updatedSuppliers = [...suppliers, newSupplier];
        setSuppliers(updatedSuppliers);
        calculateStats(updatedSuppliers);
        showMessage('✅ Supplier created successfully!');
      }
      
      setShowModal(false);
      setEditingSupplier(null);
      resetForm();
    } catch (error) {
      console.error('Submit error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to save supplier';
      showMessage(`❌ ${errorMsg}`, 'error');
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingSupplier, suppliers, showMessage, calculateStats, generateId, resetForm]);

  // ===== HANDLE DELETE =====
  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    
    try {
      await apiClient.delete(`/suppliers/${id}`);
      
      const updatedSuppliers = suppliers.filter(s => s.SUP_ID !== id);
      setSuppliers(updatedSuppliers);
      calculateStats(updatedSuppliers);
      showMessage('✅ Supplier deleted successfully!');
      setSelectedSuppliers(prev => prev.filter(s => s !== id));
    } catch (error) {
      console.error('Delete error:', error);
      showMessage('❌ Failed to delete supplier', 'error');
    }
  }, [suppliers, showMessage, calculateStats]);

  // ===== BULK DELETE =====
  const handleBulkDelete = useCallback(() => {
    if (selectedSuppliers.length === 0) return;
    if (!window.confirm(`Delete ${selectedSuppliers.length} selected suppliers?`)) return;

    apiClient.delete('/suppliers/bulk', { data: { ids: selectedSuppliers } })
      .then(() => {
        const updatedSuppliers = suppliers.filter(s => !selectedSuppliers.includes(s.SUP_ID));
        setSuppliers(updatedSuppliers);
        calculateStats(updatedSuppliers);
        showMessage(`✅ ${selectedSuppliers.length} suppliers deleted!`);
        setSelectedSuppliers([]);
      })
      .catch(error => {
        console.error('Bulk delete error:', error);
        showMessage('❌ Failed to delete some suppliers', 'error');
      });
  }, [selectedSuppliers, suppliers, showMessage, calculateStats]);

  // ===== OPEN EDIT MODAL =====
  const openEditModal = useCallback((supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      SUP_NAME: supplier.SUP_NAME || '',
      CONTACT_PERSON: supplier.CONTACT_PERSON || '',
      PHONE: supplier.PHONE || '',
      ADDRESS: supplier.ADDRESS || '',
      EMAIL: supplier.EMAIL || '',
      STATUS: supplier.STATUS || 'Active',
      WEBSITE: supplier.WEBSITE || '',
      TAX_ID: supplier.TAX_ID || '',
      NOTES: supplier.NOTES || ''
    });
    setShowModal(true);
  }, []);

  // ===== VIEW SUPPLIER DETAIL =====
  const viewSupplierDetail = useCallback((supplier) => {
    setSelectedSupplierDetail(supplier);
    setShowDetailModal(true);
  }, []);

  // ===== TOGGLE SELECT =====
  const toggleSelect = useCallback((id) => {
    setSelectedSuppliers(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  // ===== TOGGLE SELECT ALL =====
  const toggleSelectAll = useCallback(() => {
    if (selectedSuppliers.length === suppliers.length) {
      setSelectedSuppliers([]);
    } else {
      setSelectedSuppliers(suppliers.map(s => s.SUP_ID));
    }
  }, [selectedSuppliers, suppliers]);

  // ===== EXPORT CSV =====
  const exportCSV = useCallback(() => {
    if (!suppliers.length) {
      showMessage('⚠️ No data to export', 'warning');
      return;
    }

    try {
      const headers = ['ID', 'Supplier Name', 'Contact Person', 'Phone', 'Email', 'Address', 'Status'];
      let csv = headers.join(',') + '\n';
      
      suppliers.forEach(s => {
        const row = [
          s.SUP_ID || '',
          `"${(s.SUP_NAME || '').replace(/"/g, '""')}"`,
          `"${(s.CONTACT_PERSON || '').replace(/"/g, '""')}"`,
          s.PHONE || '',
          s.EMAIL || '',
          `"${(s.ADDRESS || '').replace(/"/g, '""')}"`,
          s.STATUS || 'Active'
        ];
        csv += row.join(',') + '\n';
      });
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `suppliers_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showMessage('✅ Suppliers exported successfully!', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showMessage('❌ Failed to export suppliers', 'error');
    }
  }, [suppliers, showMessage]);

  // ===== REFRESH =====
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchSuppliers();
  }, [fetchSuppliers]);

  // ===== FILTERED & SORTED SUPPLIERS =====
  const filteredSuppliers = useMemo(() => {
    let result = [...suppliers];

    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(s => 
        (s.SUP_NAME || '').toLowerCase().includes(lowerSearch) ||
        (s.CONTACT_PERSON || '').toLowerCase().includes(lowerSearch) ||
        (s.PHONE || '').toLowerCase().includes(lowerSearch) ||
        (s.EMAIL || '').toLowerCase().includes(lowerSearch) ||
        (s.ADDRESS || '').toLowerCase().includes(lowerSearch)
      );
    }

    if (filterStatus === 'active') {
      result = result.filter(s => (s.STATUS || 'Active') === 'Active');
    } else if (filterStatus === 'inactive') {
      result = result.filter(s => (s.STATUS || 'Active') !== 'Active');
    } else if (filterStatus === 'withPhone') {
      result = result.filter(s => s.PHONE && s.PHONE.trim() !== '');
    } else if (filterStatus === 'withEmail') {
      result = result.filter(s => s.EMAIL && s.EMAIL.trim() !== '');
    }

    result.sort((a, b) => {
      let comparison = 0;
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      
      if (typeof aVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [suppliers, search, filterStatus, sortBy, sortOrder]);

  // ===== GET STATUS BADGE =====
  const getStatusBadge = useCallback((status) => {
    const isActive = (status || 'Active') === 'Active';
    return isActive 
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800';
  }, []);

  // ===== GET STAT ICON =====
  const getStatIcon = useCallback((type) => {
    const icons = {
      total: <Building2 className="w-5 h-5 text-indigo-500" />,
      active: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      withPhone: <Phone className="w-5 h-5 text-yellow-500" />,
      withEmail: <Mail className="w-5 h-5 text-purple-500" />
    };
    return icons[type] || icons.total;
  }, []);

  // ===== GET AVATAR COLOR =====
  const getAvatarColor = useCallback((name) => {
    const colors = [
      'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-red-500', 'bg-orange-500', 'bg-teal-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, []);

  // ===== GET INITIALS =====
  const getInitials = useCallback((name) => {
    if (!name || name === 'Unknown') return '?';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }, []);

  // ===== INITIAL LOAD =====
  useEffect(() => {
    isMounted.current = true;
    fetchSuppliers();
    
    return () => {
      isMounted.current = false;
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
      fetchInProgress.current = false;
    };
  }, [fetchSuppliers]);

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
        <p className="text-gray-400 font-medium">Loading suppliers...</p>
        <div className="flex gap-1">
          <span key="dot1" className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0s' }} />
          <span key="dot2" className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
          <span key="dot3" className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen">
      
      {/* ===== MESSAGE TOAST ===== */}
      {message && (
        <div 
          key="message-toast"
          className={`fixed top-4 right-4 z-50 max-w-md w-full p-4 rounded-xl shadow-2xl border transform transition-all duration-500 animate-slideInRight ${
            messageType === 'success' 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' 
              : messageType === 'error'
              ? 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              : messageType === 'warning'
              ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {messageType === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
              {messageType === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
              {messageType === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
            </div>
            <div className="flex-1 text-sm font-medium">{message}</div>
            <button onClick={() => setMessage('')} className="flex-shrink-0 opacity-50 hover:opacity-100 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-wrap justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Truck className="w-8 h-8" />
              Supplier Management
            </h1>
            <p className="text-indigo-100 mt-1 text-sm">Manage your supplier relationships and contacts</p>
          </div>
          <div className="flex items-center gap-3 mt-3 sm:mt-0">
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {new Date().toLocaleTimeString()}
            </div>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-white/20 backdrop-blur-sm p-2 rounded-xl hover:bg-white/30 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={exportCSV}
              className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl hover:bg-white/30 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={openAddModal}
              className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl hover:bg-white/30 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { label: 'Total Suppliers', value: supplierStats.total, icon: 'total' },
            { label: 'Active', value: supplierStats.active, icon: 'active' },
            { label: 'With Phone', value: supplierStats.withPhone, icon: 'withPhone' },
            { label: 'With Email', value: supplierStats.withEmail, icon: 'withEmail' }
          ].map((stat) => (
            <div 
              key={stat.label}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-3 hover:bg-white/20 transition animate-slideUp"
            >
              <div className="flex items-center gap-2">
                {getStatIcon(stat.icon)}
                <p className="text-xs text-indigo-200">{stat.label}</p>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== CONTROLS ===== */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search suppliers..."
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            >
              <option value="all">All Suppliers</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="withPhone">With Phone</option>
              <option value="withEmail">With Email</option>
            </select>

            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none px-2"
              >
                <option value="SUP_NAME">Name</option>
                <option value="CONTACT_PERSON">Contact</option>
                <option value="PHONE">Phone</option>
                <option value="STATUS">Status</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-600 transition"
              >
                {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-gray-500" /> : <ArrowDown className="w-4 h-4 text-gray-500" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                title="Grid view"
              >
                <Grid3x3 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                title="List view"
              >
                <List className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            {selectedSuppliers.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-3 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition flex items-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedSuppliers.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== SUPPLIERS GRID ===== */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
          <Truck className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4 animate-float" />
          <h3 className="text-xl font-medium text-gray-600 dark:text-gray-400">No suppliers found</h3>
          <p className="text-gray-400 dark:text-gray-500 mt-2">
            {search || filterStatus !== 'all' ? 'Try adjusting your search or filters' : 'Add your first supplier to get started'}
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition font-medium"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add Supplier
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSuppliers.map((supplier, index) => {
            const id = supplier.SUP_ID || `supplier-${index}`;
            const name = supplier.SUP_NAME || 'Unknown';
            const contact = supplier.CONTACT_PERSON || '';
            const phone = supplier.PHONE || '';
            const email = supplier.EMAIL || '';
            const address = supplier.ADDRESS || '';
            const status = supplier.STATUS || 'Active';
            const initials = getInitials(name);
            const avatarColor = getAvatarColor(name);
            const isSelected = selectedSuppliers.includes(id);

            return (
              <div
                key={id}
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group animate-fadeIn cursor-pointer ${
                  isSelected ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30' : 'border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
                onClick={() => toggleSelect(id)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg ${avatarColor} shadow-lg`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-800 dark:text-white truncate max-w-[120px]">
                          {name}
                        </h3>
                        {contact ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[120px] flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {contact}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[120px] flex items-center gap-1">
                            <User className="w-3 h-3" />
                            No contact
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          viewSupplierDetail(supplier);
                        }}
                        className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition opacity-0 group-hover:opacity-100"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(supplier);
                        }}
                        className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition opacity-0 group-hover:opacity-100"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(id);
                        }}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {phone && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                        {phone}
                      </p>
                    )}
                    {email && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className="truncate">{email}</span>
                      </p>
                    )}
                    {address && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 truncate">
                        <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        <span className="truncate">{address}</span>
                      </p>
                    )}
                    {!phone && !email && !address && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                        No contact information available
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(status)}`}>
                      {status}
                    </span>
                    {supplier.WEBSITE && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {supplier.WEBSITE.replace(/^https?:\/\//, '').slice(0, 15)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.length === suppliers.length && suppliers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Supplier</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">Contact</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">Phone</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">Email</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden xl:table-cell">Address</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredSuppliers.map((supplier, index) => {
                  const id = supplier.SUP_ID || `supplier-${index}`;
                  const name = supplier.SUP_NAME || 'Unknown';
                  const contact = supplier.CONTACT_PERSON || '';
                  const phone = supplier.PHONE || '';
                  const email = supplier.EMAIL || '';
                  const address = supplier.ADDRESS || '';
                  const status = supplier.STATUS || 'Active';
                  const isSelected = selectedSuppliers.includes(id);

                  return (
                    <tr 
                      key={id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition group ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs ${getAvatarColor(name)}`}>
                            {getInitials(name)}
                          </div>
                          <span className="font-medium text-sm dark:text-white">{name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
                        {contact || '-'}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {phone || '-'}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                        {email || '-'}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-400 dark:text-gray-500 hidden xl:table-cell">
                        {address || '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => viewSupplierDetail(supplier)}
                            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition group-hover:scale-110"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(supplier)}
                            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition group-hover:scale-110"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition group-hover:scale-110"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <span key="footer-displayed">🚚 {filteredSuppliers.length} suppliers displayed</span>
          <span key="footer-bullet1">•</span>
          <span key="footer-total">💾 {supplierStats.total} total suppliers</span>
          <span key="footer-bullet2">•</span>
          <span key="footer-phone">📱 {supplierStats.withPhone} with phone</span>
          <span key="footer-bullet3">•</span>
          <span key="footer-email">✉️ {supplierStats.withEmail} with email</span>
          <span key="footer-bullet4">•</span>
          <span key="footer-time">{new Date().toLocaleString()}</span>
        </div>
      </div>

      {/* ===== DETAIL MODAL ===== */}
      {showDetailModal && selectedSupplierDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                Supplier Details
              </h2>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-300 hover:rotate-90"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl ${getAvatarColor(selectedSupplierDetail.SUP_NAME || 'Unknown')}`}>
                  {getInitials(selectedSupplierDetail.SUP_NAME || 'Unknown')}
                </div>
                <div>
                  <h3 className="text-lg font-bold dark:text-white">{selectedSupplierDetail.SUP_NAME || 'Unknown'}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedSupplierDetail.STATUS || 'Active')}`}>
                    {selectedSupplierDetail.STATUS || 'Active'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {selectedSupplierDetail.CONTACT_PERSON && (
                  <div className="flex items-center gap-3 text-sm">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">{selectedSupplierDetail.CONTACT_PERSON}</span>
                  </div>
                )}
                {selectedSupplierDetail.PHONE && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">{selectedSupplierDetail.PHONE}</span>
                  </div>
                )}
                {selectedSupplierDetail.EMAIL && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">{selectedSupplierDetail.EMAIL}</span>
                  </div>
                )}
                {selectedSupplierDetail.ADDRESS && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">{selectedSupplierDetail.ADDRESS}</span>
                  </div>
                )}
                {selectedSupplierDetail.WEBSITE && (
                  <div className="flex items-center gap-3 text-sm">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">{selectedSupplierDetail.WEBSITE}</span>
                  </div>
                )}
                {selectedSupplierDetail.TAX_ID && (
                  <div className="flex items-center gap-3 text-sm">
                    <ClipboardList className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">Tax ID: {selectedSupplierDetail.TAX_ID}</span>
                  </div>
                )}
                {selectedSupplierDetail.NOTES && (
                  <div className="flex items-start gap-3 text-sm">
                    <ClipboardList className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600 dark:text-gray-300">{selectedSupplierDetail.NOTES}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openEditModal(selectedSupplierDetail);
                  }}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium"
                >
                  <Edit2 className="w-4 h-4 inline mr-2" />
                  Edit Supplier
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleDelete(selectedSupplierDetail.SUP_ID);
                  }}
                  className="px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD/EDIT MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-300 hover:rotate-90"
                disabled={submitting}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                    Supplier Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.SUP_NAME}
                    onChange={(e) => setFormData({...formData, SUP_NAME: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="Enter supplier name"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Person</label>
                  <input
                    type="text"
                    value={formData.CONTACT_PERSON}
                    onChange={(e) => setFormData({...formData, CONTACT_PERSON: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="Enter contact person name"
                    disabled={submitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
                    <input
                      type="text"
                      value={formData.PHONE}
                      onChange={(e) => setFormData({...formData, PHONE: e.target.value})}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      placeholder="Enter phone number"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={formData.EMAIL}
                      onChange={(e) => setFormData({...formData, EMAIL: e.target.value})}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      placeholder="Enter email address"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Address</label>
                  <input
                    type="text"
                    value={formData.ADDRESS}
                    onChange={(e) => setFormData({...formData, ADDRESS: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="Enter address"
                    disabled={submitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Website</label>
                    <input
                      type="text"
                      value={formData.WEBSITE}
                      onChange={(e) => setFormData({...formData, WEBSITE: e.target.value})}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      placeholder="Enter website"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tax ID</label>
                    <input
                      type="text"
                      value={formData.TAX_ID}
                      onChange={(e) => setFormData({...formData, TAX_ID: e.target.value})}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      placeholder="Enter tax ID"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
                  <textarea
                    value={formData.NOTES}
                    onChange={(e) => setFormData({...formData, NOTES: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="Enter notes"
                    rows="3"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                  <select
                    value={formData.STATUS}
                    onChange={(e) => setFormData({...formData, STATUS: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    disabled={submitting}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-6 py-2.5 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 dark:text-white font-medium disabled:opacity-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
