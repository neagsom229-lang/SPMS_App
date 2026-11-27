// Warranty.jsx - coverage and service requests
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Shield, Plus, Edit2, Trash2, X, Save, RefreshCw, Wrench,
  Search, Download, Eye, CheckCircle, Clock,
  AlertCircle, Calendar, Info, Loader2,
  ArrowUp, ArrowDown, Grid3x3, List,
  User, Package, Award, Activity,
  AlertTriangle, ClipboardList, Briefcase,
} from 'lucide-react';
import '../styles/warranty.css';
import apiClient from '../api/client';
import { unwrapList, fetchAllList } from '../api/list';
import { useAuth } from '../context/AuthContext';
import { isViewerRole } from '../utils/roles';

// ============================================
// MAIN WARRANTY COMPONENT
// ============================================
const Warranty = () => {
  const { user } = useAuth();
  const readOnly = isViewerRole(user);
  // ===== STATE =====
  const [warranties, setWarranties] = useState([]);
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('warranty');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('list');
  const [productSearch, setProductSearch] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [warrantyStats, setWarrantyStats] = useState({
    total: 0,
    active: 0,
    expiring: 0,
    expired: 0
  });
  const [serviceStats, setServiceStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  });

  // ===== FORM DATA =====
  const [formData, setFormData] = useState({
    customer_id: '',
    product_id: '',
    serial_number: '',
    warranty_period: 12,
    start_date: '',
    end_date: '',
    status: 'Active',
    issue_description: '',
    service_type: 'Repair',
    received_date: '',
    notes: ''
  });

  // ===== REFS =====
  const isMounted = useRef(true);
  const searchTimeout = useRef(null);
  const cardRefs = useRef({});

  // ===== SHOW MESSAGE =====
  const showMessage = useCallback((text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, []);

  // ===== FETCH CUSTOMERS & PRODUCTS =====
  // Use the shared list helpers: /products answers { products, pagination },
  // /customers answers a bare array. Picker data loads every page (capped).
  const fetchCustomersAndProducts = useCallback(async () => {
    try {
      const [customersData, productsData] = await Promise.all([
        fetchAllList(apiClient, '/customers'),
        fetchAllList(apiClient, '/products'),
      ]);

      if (isMounted.current) {
        setCustomers(customersData);
        setProducts(productsData);
      }
    } catch (error) {
      console.error('Error fetching customers/products:', error);
      if (isMounted.current) {
        setCustomers([]);
        setProducts([]);
        showMessage('Failed to load customers/products from server', 'error');
      }
    }
  }, [showMessage]);

  // ===== CALCULATE STATS =====
  // Declared before the fetch callbacks: their dependency arrays are evaluated
  // during render, so these must already be initialized (TDZ otherwise).
  const calculateWarrantyStats = useCallback((data) => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const stats = {
      total: data.length,
      active: data.filter(w => w.status === 'Active').length,
      expiring: data.filter(w => {
        if (w.status !== 'Active') return false;
        const endDate = new Date(w.warrantyenddate);
        return endDate <= thirtyDaysFromNow && endDate > now;
      }).length,
      expired: data.filter(w => w.status === 'Expired').length
    };
    setWarrantyStats(stats);
  }, []);

  const calculateServiceStats = useCallback((data) => {
    const stats = {
      total: data.length,
      pending: data.filter(s => s.status === 'Pending').length,
      inProgress: data.filter(s => s.status === 'In Progress').length,
      completed: data.filter(s => s.status === 'Completed').length
    };
    setServiceStats(stats);
  }, []);

  // ===== FETCH WARRANTIES =====
  const fetchWarranties = useCallback(async () => {
    try {
      const res = await apiClient.get('/warranties');
      if (isMounted.current) {
        const warrantiesArray = unwrapList(res.data, ['warranties']);
        setWarranties(warrantiesArray);
        calculateWarrantyStats(warrantiesArray);
      }
    } catch (error) {
      console.error('Error fetching warranties:', error);
      if (isMounted.current) {
        setWarranties([]);
        calculateWarrantyStats([]);
        showMessage('Failed to load warranties from server', 'error');
      }
    }
  }, [showMessage, calculateWarrantyStats]);

  // ===== FETCH SERVICES =====
  const fetchServices = useCallback(async () => {
    try {
      const res = await apiClient.get('/services');
      if (isMounted.current) {
        const servicesArray = unwrapList(res.data, ['services']);
        setServices(servicesArray);
        calculateServiceStats(servicesArray);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      if (isMounted.current) {
        setServices([]);
        calculateServiceStats([]);
        showMessage('Failed to load services from server', 'error');
      }
    }
  }, [showMessage, calculateServiceStats]);

  // ===== LOAD ALL DATA =====
  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchCustomersAndProducts(),
      fetchWarranties(),
      fetchServices()
    ]);
    setLoading(false);
    setIsRefreshing(false);
  }, [fetchCustomersAndProducts, fetchWarranties, fetchServices]);

  // ===== INITIAL LOAD =====
  useEffect(() => {
    isMounted.current = true;
    loadData();

    return () => {
      isMounted.current = false;
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [loadData]);

  // ===== SEARCH DEBOUNCE =====
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      // Filter handled by useMemo
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchTerm]);

  // ===== GET HELPER FUNCTIONS =====
  const getCustomerName = useCallback((item) => {
    if (item.customer_name) return item.customer_name;
    const customer = customers.find(c => 
      c.id === item.customerid || 
      c.id === item.CustomerID ||
      parseInt(c.cus_id) === item.customerid ||
      parseInt(c.id) === item.CustomerID
    );
    return customer ? `${customer.first_name || customer.FIRST_NAME || ''} ${customer.last_name || customer.LAST_NAME || ''}`.trim() || 'No customer recorded' : 'No customer recorded';
  }, [customers]);

  const getProductName = useCallback((item) => {
    if (item.product_name) return item.product_name;
    const product = products.find(p => 
      p.id === item.productid || 
      p.id === item.ProductID ||
      parseInt(p.product_id) === item.productid ||
      parseInt(p.id) === item.ProductID
    );
    return product?.name_en || product?.NAME_EN || 'Unnamed product';
  }, [products]);

  const formatDate = useCallback((dateValue) => {
    if (!dateValue) return 'No date';
    try {
      const date = new Date(dateValue);
      if (isNaN(date)) return 'No date';
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return 'No date';
    }
  }, []);

  // ===== GET STATUS BADGE =====
  const getStatusBadge = useCallback((status) => {
    const statusMap = {
      'Active': 'status-badge status-active',
      'Expired': 'status-badge status-expired',
      'Pending': 'status-badge status-pending',
      'In Progress': 'status-badge status-in-progress',
      'Completed': 'status-badge status-completed'
    };
    return statusMap[status] || 'status-badge status-pending';
  }, []);

  // ===== GET STATUS ICON =====
  const getStatusIcon = useCallback((status) => {
    const icons = {
      'Active': CheckCircle,
      'Expired': X,
      'Pending': Clock,
      'In Progress': Activity,
      'Completed': Award
    };
    const Icon = icons[status] || Clock;
    return <Icon className="w-3.5 h-3.5" />;
  }, []);

  // ===== GET STAT ICON =====
  const getStatIcon = useCallback((type) => {
    const icons = {
      total: <Shield className="w-5 h-5 text-indigo-500" />,
      active: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      expiring: <AlertCircle className="w-5 h-5 text-amber-500" />,
      expired: <X className="w-5 h-5 text-rose-500" />,
      pending: <Clock className="w-5 h-5 text-amber-500" />,
      inProgress: <Activity className="w-5 h-5 text-blue-500" />,
      completed: <Award className="w-5 h-5 text-purple-500" />
    };
    return icons[type] || icons.total;
  }, []);

  // ===== GET AVATAR COLOR =====
  const getAvatarColor = useCallback((name) => {
    const colors = [
      'bg-gradient-to-br from-indigo-500 to-purple-600',
      'bg-gradient-to-br from-rose-500 to-pink-600',
      'bg-gradient-to-br from-emerald-500 to-teal-600',
      'bg-gradient-to-br from-blue-500 to-cyan-600',
      'bg-gradient-to-br from-amber-500 to-orange-600',
      'bg-gradient-to-br from-violet-500 to-purple-600',
      'bg-gradient-to-br from-fuchsia-500 to-pink-600',
      'bg-gradient-to-br from-sky-500 to-blue-600',
      'bg-gradient-to-br from-lime-500 to-emerald-600'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, []);

  // ===== GET INITIALS =====
  const getInitials = useCallback((name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }, []);

  // ===== FILTERED DATA =====
  const filteredWarranties = useMemo(() => {
    let result = [...warranties];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(w => {
        const customerName = w.customer_name || getCustomerName(w);
        const productName = w.product_name || getProductName(w);
        return customerName.toLowerCase().includes(term) ||
               productName.toLowerCase().includes(term) ||
               (w.serialnumber || '').toLowerCase().includes(term);
      });
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'active') {
        result = result.filter(w => w.status === 'Active');
      } else if (filterStatus === 'expired') {
        result = result.filter(w => w.status === 'Expired');
      }
    }

    result.sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'customer') {
        aVal = a.customer_name || getCustomerName(a);
        bVal = b.customer_name || getCustomerName(b);
      } else if (sortBy === 'product') {
        aVal = a.product_name || getProductName(a);
        bVal = b.product_name || getProductName(b);
      } else if (sortBy === 'end_date') {
        aVal = new Date(a.warrantyenddate);
        bVal = new Date(b.warrantyenddate);
      } else {
        aVal = a[sortBy] ?? '';
        bVal = b[sortBy] ?? '';
      }

      if (aVal instanceof Date && bVal instanceof Date) {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [warranties, searchTerm, filterStatus, sortBy, sortOrder, getCustomerName, getProductName]);

  const filteredServices = useMemo(() => {
    let result = [...services];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => {
        const customerName = s.customer_name || getCustomerName(s);
        const productName = s.product_name || getProductName(s);
        return customerName.toLowerCase().includes(term) ||
               productName.toLowerCase().includes(term) ||
               (s.issuedescription || '').toLowerCase().includes(term);
      });
    }

    if (filterStatus !== 'all') {
      const statusMap = {
        'pending': 'Pending',
        'in_progress': 'In Progress',
        'completed': 'Completed'
      };
      const targetStatus = statusMap[filterStatus] || filterStatus;
      result = result.filter(s => s.status === targetStatus);
    }

    if (filterType !== 'all') {
      result = result.filter(s => s.servicetype === filterType);
    }

    result.sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'customer') {
        aVal = a.customer_name || getCustomerName(a);
        bVal = b.customer_name || getCustomerName(b);
      } else if (sortBy === 'product') {
        aVal = a.product_name || getProductName(a);
        bVal = b.product_name || getProductName(b);
      } else if (sortBy === 'date') {
        aVal = new Date(a.receiveddate);
        bVal = new Date(b.receiveddate);
      } else {
        aVal = a[sortBy] ?? '';
        bVal = b[sortBy] ?? '';
      }

      if (aVal instanceof Date && bVal instanceof Date) {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [services, searchTerm, filterStatus, filterType, sortBy, sortOrder, getCustomerName, getProductName]);

  const currentData = useMemo(() => {
    return activeTab === 'warranty' ? filteredWarranties : filteredServices;
  }, [activeTab, filteredWarranties, filteredServices]);

  // The picker loads every page (up to the cap in api/list.js) and lets the
  // owner type to narrow the list instead of scrolling hundreds of products.
  const pickerProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      String(p.name_en || p.name || p.NAME_EN || '').toLowerCase().includes(term)
      || String(p.barcode || '').toLowerCase().includes(term)
    );
  }, [products, productSearch]);

  // ===== RESET FORM =====
  const resetForm = useCallback(() => {
    setProductSearch('');
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    setFormData({
      customer_id: '',
      product_id: '',
      serial_number: '',
      warranty_period: 12,
      start_date: today,
      end_date: endDate.toISOString().split('T')[0],
      status: 'Active',
      issue_description: '',
      service_type: 'Repair',
      received_date: today,
      notes: ''
    });
  }, []);

  // ===== OPEN MODAL =====
  const openEditModal = useCallback((item) => {
    setEditingItem(item);
    
    if (activeTab === 'warranty') {
      setFormData({
        customer_id: String(item.customerid || item.CustomerID || ''),
        product_id: String(item.productid || item.ProductID || ''),
        serial_number: item.serialnumber || item.SerialNumber || '',
        warranty_period: item.warrantyperiod || item.WarrantyPeriod || 12,
        start_date: item.warrantystartdate || item.WarrantyStartDate || '',
        end_date: item.warrantyenddate || item.WarrantyEndDate || '',
        status: item.status || item.Status || 'Active',
        issue_description: '',
        service_type: 'Repair',
        received_date: '',
        notes: item.notes || ''
      });
    } else {
      setFormData({
        customer_id: String(item.customerid || item.CustomerID || ''),
        product_id: String(item.productid || item.ProductID || ''),
        serial_number: item.serialnumber || item.SerialNumber || '',
        warranty_period: 12,
        start_date: '',
        end_date: '',
        status: item.status || item.Status || 'Pending',
        issue_description: item.issuedescription || item.IssueDescription || '',
        service_type: item.servicetype || item.ServiceType || 'Repair',
        received_date: item.receiveddate || item.ReceivedDate || '',
        notes: item.notes || ''
      });
    }
    setShowModal(true);
  }, [activeTab]);

  const openAddModal = useCallback(() => {
    setEditingItem(null);
    resetForm();
    setShowModal(true);
  }, [resetForm]);

  // ===== HANDLE SUBMIT =====
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const data = {
        CustomerID: parseInt(formData.customer_id),
        ProductID: parseInt(formData.product_id),
        SerialNumber: formData.serial_number || `SN-${String(Date.now()).slice(-4)}`,
        notes: formData.notes || ''
      };

      if (activeTab === 'warranty') {
        const startDate = new Date(formData.start_date);
        const endDate = new Date(formData.end_date);
        if (endDate <= startDate) {
          showMessage('❌ End date must be after start date', 'error');
          setSubmitting(false);
          return;
        }

        data.WarrantyPeriod = parseInt(formData.warranty_period) || 12;
        data.WarrantyStartDate = formData.start_date || new Date().toISOString().split('T')[0];
        data.WarrantyEndDate = formData.end_date;
        data.Status = formData.status || 'Active';

        if (editingItem) {
          const id = editingItem.warrantyid || editingItem.WarrantyID;
          try {
            await apiClient.put(`/warranties/${id}`, data);
            showMessage('✅ Warranty updated successfully!');
          } catch (putError) {
            if (putError.response?.status === 404) {
              showMessage('⚠️ Update endpoint not available on backend. Please check backend server.', 'warning');
            } else {
              throw putError;
            }
          }
        } else {
          await apiClient.post('/warranties', data);
          showMessage('✅ Warranty created successfully!');
        }
        await fetchWarranties();
      } else {
        data.IssueDescription = formData.issue_description || 'Service request';
        data.ServiceType = formData.service_type || 'Repair';
        data.Status = formData.status || 'Pending';
        data.ReceivedDate = formData.received_date || new Date().toISOString().split('T')[0];

        if (editingItem) {
          const id = editingItem.serviceid || editingItem.ServiceID;
          try {
            await apiClient.put(`/services/${id}`, data);
            showMessage('✅ Service updated successfully!');
          } catch (putError) {
            if (putError.response?.status === 404) {
              showMessage('⚠️ Update endpoint not available on backend. Please check backend server.', 'warning');
            } else {
              throw putError;
            }
          }
        } else {
          await apiClient.post('/services', data);
          showMessage('✅ Service created successfully!');
        }
        await fetchServices();
      }

      setShowModal(false);
      setEditingItem(null);
      resetForm();
    } catch (error) {
      console.error('Submit error:', error);
      showMessage(`❌ ${error.response?.data?.error || 'Failed to save'}`, 'error');
    } finally {
      setSubmitting(false);
    }
  }, [formData, activeTab, editingItem, fetchWarranties, fetchServices, resetForm, showMessage]);

  // ===== HANDLE DELETE =====
  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      if (activeTab === 'warranty') {
        await apiClient.delete(`/warranties/${id}`);
        await fetchWarranties();
        showMessage('✅ Warranty deleted successfully!');
      } else {
        await apiClient.delete(`/services/${id}`);
        await fetchServices();
        showMessage('✅ Service deleted successfully!');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showMessage(`❌ ${error.response?.data?.error || 'Failed to delete'}`, 'error');
    }
  }, [activeTab, fetchWarranties, fetchServices, showMessage]);

  // ===== BULK DELETE =====
  const handleBulkDelete = useCallback(async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Delete ${selectedItems.length} selected items?`)) return;

    try {
      if (activeTab === 'warranty') {
        for (const id of selectedItems) {
          await apiClient.delete(`/warranties/${id}`);
        }
        await fetchWarranties();
      } else {
        for (const id of selectedItems) {
          await apiClient.delete(`/services/${id}`);
        }
        await fetchServices();
      }
      showMessage(`✅ ${selectedItems.length} items deleted!`);
      setSelectedItems([]);
    } catch (error) {
      console.error('Bulk delete error:', error);
      showMessage(`❌ ${error.response?.data?.error || 'Failed to delete items'}`, 'error');
    }
  }, [selectedItems, activeTab, fetchWarranties, fetchServices, showMessage]);

  // ===== REFRESH =====
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    showMessage('✅ Data refreshed!');
  }, [loadData, showMessage]);

  // ===== VIEW DETAIL =====
  const viewDetail = useCallback((item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  }, []);

  // ===== TOGGLE SELECT =====
  const toggleSelect = useCallback((id) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  // ===== TOGGLE SELECT ALL =====
  const toggleSelectAll = useCallback(() => {
    if (selectedItems.length === currentData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(currentData.map(item => 
        activeTab === 'warranty' ? (item.warrantyid || item.WarrantyID) : (item.serviceid || item.ServiceID)
      ));
    }
  }, [selectedItems, currentData, activeTab]);

  // ===== EXPORT =====
  const handleExport = useCallback(() => {
    if (currentData.length === 0) {
      showMessage('⚠️ No data to export', 'warning');
      return;
    }

    try {
      const headers = activeTab === 'warranty' 
        ? ['ID', 'Customer', 'Product', 'Serial', 'Start Date', 'End Date', 'Status']
        : ['ID', 'Customer', 'Product', 'Issue', 'Type', 'Status', 'Date'];
      
      let csv = headers.join(',') + '\n';
      currentData.forEach(item => {
        const customerName = item.customer_name || getCustomerName(item);
        const productName = item.product_name || getProductName(item);

        const row = activeTab === 'warranty' 
          ? [item.warrantyid || item.WarrantyID, `"${customerName}"`, `"${productName}"`, item.serialnumber || item.SerialNumber, 
             formatDate(item.warrantystartdate || item.WarrantyStartDate), formatDate(item.warrantyenddate || item.WarrantyEndDate), item.status || item.Status]
          : [item.serviceid || item.ServiceID, `"${customerName}"`, `"${productName}"`, 
             `"${(item.issuedescription || item.IssueDescription || '').replace(/"/g, '""')}"`, item.servicetype || item.ServiceType, item.status || item.Status, formatDate(item.receiveddate || item.ReceivedDate)];
        csv += row.join(',') + '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showMessage(`✅ ${currentData.length} records exported successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      showMessage('❌ Failed to export data', 'error');
    }
  }, [currentData, activeTab, getCustomerName, getProductName, formatDate, showMessage]);

  // ===== STATS SHOWN IN THE COMPACT HEADER =====
  const visibleStats = activeTab === 'warranty'
    ? [
        { key: 'total', label: 'Total warranties', value: warrantyStats.total, icon: getStatIcon('total') },
        { key: 'active', label: 'Active', value: warrantyStats.active, icon: getStatIcon('active') },
        { key: 'expiring', label: 'Expiring soon', value: warrantyStats.expiring, icon: getStatIcon('expiring') },
        { key: 'expired', label: 'Expired', value: warrantyStats.expired, icon: getStatIcon('expired') },
      ]
    : [
        { key: 'total', label: 'Total requests', value: serviceStats.total, icon: getStatIcon('total') },
        { key: 'pending', label: 'Pending', value: serviceStats.pending, icon: getStatIcon('pending') },
        { key: 'inProgress', label: 'In progress', value: serviceStats.inProgress, icon: getStatIcon('inProgress') },
        { key: 'completed', label: 'Completed', value: serviceStats.completed, icon: getStatIcon('completed') },
      ];

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-wrapper">
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <Shield className="spinner-icon" />
          </div>
          <h2 className="loading-title">Loading Warranty Data</h2>
          <p className="loading-subtitle">Please wait while we fetch your information...</p>
          <div className="loading-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="warranty-container">
      {/* ===== MESSAGE TOAST ===== */}
      {message && (
        <div className={`toast-message toast-${messageType}`}>
          <div className="toast-content">
            <div className="toast-icon">
              {messageType === 'success' && <CheckCircle className="w-5 h-5" />}
              {messageType === 'error' && <AlertCircle className="w-5 h-5" />}
              {messageType === 'warning' && <AlertTriangle className="w-5 h-5" />}
            </div>
            <div className="toast-text">{message}</div>
            <button onClick={() => setMessage('')} className="toast-close" aria-label="Dismiss message">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===== COMPACT HEADER ===== */}
      <div className="header-section">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">Coverage &amp; repairs</h1>
            <p className="header-subtitle">Track warranties and service requests for your customers.</p>
          </div>
          <div className="header-actions">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="header-btn"
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleExport} className="header-btn">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button onClick={openAddModal} className="header-btn-primary" hidden={readOnly}>
              <Plus className="w-4 h-4" />
              Add {activeTab === 'warranty' ? 'Warranty' : 'Service'}
            </button>
          </div>
        </div>
      </div>

      {/* ===== STATS (real data only) ===== */}
      <div className="stats-grid" data-testid="warranty-stats">
        {visibleStats.map((stat) => (
          <div className="stat-card" key={stat.key} data-testid="warranty-stat" data-stat={stat.key}>
            <div className="stat-header">
              <div className="stat-icon-wrapper">{stat.icon}</div>
              <span className="stat-label">{stat.label}</span>
            </div>
            <p className="stat-value">
              <span className="stat-number">{stat.value}</span>
            </p>
          </div>
        ))}
      </div>

      {/* ===== TABS ===== */}
      <div className="tabs-container" data-testid="warranty-tabs">
        <div className="tabs-header">
          <button
            onClick={() => {
              setActiveTab('warranty');
              setSearchTerm('');
              setFilterStatus('all');
              setFilterType('all');
              setSelectedItems([]);
            }}
            className={`tab-btn ${activeTab === 'warranty' ? 'tab-active' : ''}`}
          >
            <Shield className="w-4 h-4" />
            Warranties
            <span className="tab-count">{warranties.length}</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('services');
              setSearchTerm('');
              setFilterStatus('all');
              setFilterType('all');
              setSelectedItems([]);
            }}
            className={`tab-btn ${activeTab === 'services' ? 'tab-active' : ''}`}
          >
            <Wrench className="w-4 h-4" />
            Services
            <span className="tab-count">{services.length}</span>
          </button>
        </div>

        {/* ===== CONTROLS ===== */}
        <div className="controls-section">
          <div className="controls-wrapper">
            <div className="controls-left">
              {/* Search */}
              <div className="search-wrapper">
                <Search className="search-icon" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Search ${activeTab}...`}
                  className="search-input"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="search-clear"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Status</option>
                {activeTab === 'warranty' ? (
                  <>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                  </>
                ) : (
                  <>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </>
                )}
              </select>

              {/* Type Filter (Services only) */}
              {activeTab === 'services' && (
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Types</option>
                  <option value="Repair">Repair</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              )}

              {/* Sort */}
              <div className="sort-wrapper">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="customer">Customer</option>
                  <option value="product">Product</option>
                  <option value={activeTab === 'warranty' ? 'end_date' : 'date'}>
                    {activeTab === 'warranty' ? 'End Date' : 'Date'}
                  </option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="sort-btn"
                >
                  {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="controls-right">
              {/* View Mode */}
              <div className="view-toggle">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`view-btn ${viewMode === 'grid' ? 'view-active' : ''}`}
                  title="Grid view"
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`view-btn ${viewMode === 'list' ? 'view-active' : ''}`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Bulk Actions */}
              {selectedItems.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="bulk-delete-btn"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({selectedItems.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ===== CONTENT ===== */}
        {currentData.length === 0 ? (
          <div className="empty-state" data-testid="warranty-empty">
            <div className="empty-icon-wrapper">
              {activeTab === 'warranty' ? (
                <Shield className="empty-icon" />
              ) : (
                <Wrench className="empty-icon" />
              )}
            </div>
            <h3 className="empty-title">
              No {activeTab} found
            </h3>
            <p className="empty-description">
              {searchTerm || filterStatus !== 'all' || filterType !== 'all' 
                ? 'Try adjusting your search or filters' 
                : `Add your first ${activeTab === 'warranty' ? 'warranty' : 'service'} to get started`}
            </p>
            <button
              onClick={openAddModal}
              hidden={readOnly}
              className="empty-btn"
            >
              <Plus className="w-4 h-4" />
              Add {activeTab === 'warranty' ? 'Warranty' : 'Service'}
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          // ===== GRID VIEW =====
          <div className="grid-view">
            {currentData.map((item, index) => {
              const id = activeTab === 'warranty' ? (item.warrantyid || item.WarrantyID) : (item.serviceid || item.ServiceID);
              const customerName = item.customer_name || getCustomerName(item);
              const productName = item.product_name || getProductName(item);
              const initials = getInitials(customerName);
              const avatarColor = getAvatarColor(customerName);
              const isSelected = selectedItems.includes(id);

              return (
                <div
                  key={id}
                  ref={el => cardRefs.current[id] = el}
                  className={`grid-card ${isSelected ? 'grid-card-selected' : ''}`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="grid-card-content">
                    {/* Header */}
                    <div className="grid-card-header">
                      <div className="grid-card-user">
                        <div className={`grid-card-avatar ${avatarColor}`}>
                          {initials}
                          <div className="avatar-ring"></div>
                        </div>
                        <div className="grid-card-info">
                          <h3 className="grid-card-name">{customerName}</h3>
                          <p className="grid-card-product">
                            <Package className="w-3 h-3" />
                            {productName}
                          </p>
                        </div>
                      </div>
                      <div className="grid-card-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            viewDetail(item);
                          }}
                          className="grid-card-action view"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(item);
                          }}
                          className="grid-card-action edit"
                          hidden={readOnly}
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(id);
                          }}
                          className="grid-card-action delete"
                          hidden={readOnly}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid-card-details">
                      <div className="grid-card-detail">
                        <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
                        <span>{item.serialnumber || item.SerialNumber || 'No serial'}</span>
                      </div>
                      {activeTab === 'warranty' ? (
                        <>
                          <div className="grid-card-detail">
                            <Calendar className="w-3.5 h-3.5 text-purple-500" />
                            <span>{formatDate(item.warrantystartdate || item.WarrantyStartDate)} → {formatDate(item.warrantyenddate || item.WarrantyEndDate)}</span>
                          </div>
                          <div className="grid-card-detail">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            <span>{item.warrantyperiod || item.WarrantyPeriod || 12} months</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid-card-detail truncate">
                            <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            <span className="truncate">{item.issuedescription || item.IssueDescription || 'No description'}</span>
                          </div>
                          <div className="grid-card-detail">
                            <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                            <span>{item.servicetype || item.ServiceType || 'Not specified'}</span>
                          </div>
                          <div className="grid-card-detail">
                            <Calendar className="w-3.5 h-3.5 text-purple-500" />
                            <span>Received: {formatDate(item.receiveddate || item.ReceivedDate)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Status */}
                    <div className="grid-card-footer">
                      <span className={getStatusBadge(item.status || item.Status)}>
                        {getStatusIcon(item.status || item.Status)}
                        {item.status || item.Status}
                      </span>
                      <span className="grid-card-id">
                        ID: #{id}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // ===== LIST VIEW =====
          <div className="list-view">
            <table className="list-table" data-testid="warranty-table">
              <thead className="list-thead">
                <tr>
                  <th className="list-th w-10">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === currentData.length && currentData.length > 0}
                      onChange={toggleSelectAll}
                      className="list-checkbox"
                    />
                  </th>
                  <th className="list-th">Customer</th>
                  <th className="list-th">Product</th>
                  <th className="list-th hidden md:table-cell">Serial</th>
                  {activeTab === 'warranty' ? (
                    <>
                      <th className="list-th hidden lg:table-cell">Start Date</th>
                      <th className="list-th hidden lg:table-cell">End Date</th>
                      <th className="list-th hidden sm:table-cell">Period</th>
                    </>
                  ) : (
                    <>
                      <th className="list-th hidden lg:table-cell">Issue</th>
                      <th className="list-th hidden sm:table-cell">Type</th>
                      <th className="list-th hidden md:table-cell">Received</th>
                    </>
                  )}
                  <th className="list-th text-center">Status</th>
                  <th className="list-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="list-tbody">
                {currentData.map((item, index) => {
                  const id = activeTab === 'warranty' ? (item.warrantyid || item.WarrantyID) : (item.serviceid || item.ServiceID);
                  const customerName = item.customer_name || getCustomerName(item);
                  const productName = item.product_name || getProductName(item);
                  const isSelected = selectedItems.includes(id);

                  return (
                    <tr 
                      key={id} 
                      className={`list-tr ${isSelected ? 'list-tr-selected' : ''}`}
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <td className="list-td w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(id)}
                          className="list-checkbox"
                        />
                      </td>
                      <td className="list-td">
                        <div className="list-customer">
                          <div className={`list-avatar ${getAvatarColor(customerName)}`}>
                            {getInitials(customerName)}
                          </div>
                          <span className="list-customer-name">{customerName}</span>
                        </div>
                      </td>
                      <td className="list-td">{productName}</td>
                      <td className="list-td hidden md:table-cell font-mono text-sm text-gray-500 dark:text-gray-400">
                        {item.serialnumber || item.SerialNumber || '-'}
                      </td>
                      {activeTab === 'warranty' ? (
                        <>
                          <td className="list-td hidden lg:table-cell text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(item.warrantystartdate || item.WarrantyStartDate)}
                          </td>
                          <td className="list-td hidden lg:table-cell text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(item.warrantyenddate || item.WarrantyEndDate)}
                          </td>
                          <td className="list-td hidden sm:table-cell text-sm text-gray-500 dark:text-gray-400">
                            {item.warrantyperiod || item.WarrantyPeriod || 12} mo
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="list-td hidden lg:table-cell text-sm text-gray-500 dark:text-gray-400 max-w-[150px] truncate">
                            {item.issuedescription || item.IssueDescription || '-'}
                          </td>
                          <td className="list-td hidden sm:table-cell text-sm text-gray-500 dark:text-gray-400">
                            {item.servicetype || item.ServiceType || '-'}
                          </td>
                          <td className="list-td hidden md:table-cell text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(item.receiveddate || item.ReceivedDate)}
                          </td>
                        </>
                      )}
                      <td className="list-td text-center">
                        <span className={getStatusBadge(item.status || item.Status)}>
                          {getStatusIcon(item.status || item.Status)}
                          {item.status || item.Status}
                        </span>
                      </td>
                      <td className="list-td text-right">
                        <div className="list-actions">
                          <button
                            onClick={() => viewDetail(item)}
                            className="list-action view"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="list-action edit"
                            hidden={readOnly}
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            className="list-action delete"
                            hidden={readOnly}
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
        )}

        {/* Footer */}
        <div className="table-footer">
          <span>Showing {currentData.length} of {activeTab === 'warranty' ? warranties.length : services.length} records</span>
        </div>
      </div>

      {/* ===== DETAIL MODAL ===== */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {activeTab === 'warranty' ? <Shield className="w-5 h-5 text-indigo-600" /> : <Wrench className="w-5 h-5 text-indigo-600" />}
                {activeTab === 'warranty' ? 'Warranty' : 'Service'} Details
              </h2>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="modal-body">
              {/* Header */}
              <div className="detail-header">
                <div className={`detail-avatar ${getAvatarColor(getCustomerName(selectedItem))}`}>
                  {getInitials(getCustomerName(selectedItem))}
                </div>
                <div className="detail-info">
                  <p className="detail-name">{getCustomerName(selectedItem)}</p>
                  <p className="detail-product">
                    <Package className="w-4 h-4" />
                    {getProductName(selectedItem)}
                  </p>
                  <div className="detail-status">
                    <span className={getStatusBadge(selectedItem.status || selectedItem.Status)}>
                      {getStatusIcon(selectedItem.status || selectedItem.Status)}
                      {selectedItem.status || selectedItem.Status}
                    </span>
                    <span className="detail-id">#{activeTab === 'warranty' ? (selectedItem.warrantyid || selectedItem.WarrantyID) : (selectedItem.serviceid || selectedItem.ServiceID)}</span>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="detail-grid">
                <div className="detail-item">
                  <p className="detail-label">Serial Number</p>
                  <p className="detail-value font-mono">{selectedItem.serialnumber || selectedItem.SerialNumber || 'No serial'}</p>
                </div>
                {activeTab === 'warranty' ? (
                  <>
                    <div className="detail-item">
                      <p className="detail-label">Period</p>
                      <p className="detail-value">{selectedItem.warrantyperiod || selectedItem.WarrantyPeriod ? `${selectedItem.warrantyperiod || selectedItem.WarrantyPeriod} months` : 'Not specified'}</p>
                    </div>
                    <div className="detail-item">
                      <p className="detail-label">Start Date</p>
                      <p className="detail-value">{formatDate(selectedItem.warrantystartdate || selectedItem.WarrantyStartDate)}</p>
                    </div>
                    <div className="detail-item">
                      <p className="detail-label">End Date</p>
                      <p className="detail-value">{formatDate(selectedItem.warrantyenddate || selectedItem.WarrantyEndDate)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="detail-item col-span-2">
                      <p className="detail-label">Issue Description</p>
                      <p className="detail-value">{selectedItem.issuedescription || selectedItem.IssueDescription || 'Not specified'}</p>
                    </div>
                    <div className="detail-item">
                      <p className="detail-label">Service Type</p>
                      <p className="detail-value">{selectedItem.servicetype || selectedItem.ServiceType || 'Not specified'}</p>
                    </div>
                    <div className="detail-item">
                      <p className="detail-label">Received Date</p>
                      <p className="detail-value">{formatDate(selectedItem.receiveddate || selectedItem.ReceivedDate)}</p>
                    </div>
                  </>
                )}
              </div>

              {selectedItem.notes && (
                <div className="detail-notes">
                  <p className="detail-label">Notes</p>
                  <p className="detail-value">{selectedItem.notes}</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                onClick={() => {
                  setShowDetailModal(false);
                  openEditModal(selectedItem);
                }}
                className="modal-footer-btn edit"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="modal-footer-btn close"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD/EDIT MODAL ===== */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {activeTab === 'warranty' ? <Shield className="w-5 h-5 text-indigo-600" /> : <Wrench className="w-5 h-5 text-indigo-600" />}
                {editingItem ? 'Edit' : 'Add New'} {activeTab === 'warranty' ? 'Warranty' : 'Service'}
              </h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="modal-close"
                disabled={submitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                {/* Customer */}
                <div className="form-field">
                  <label className="form-label">
                    <User className="w-4 h-4" />
                    Customer <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.customer_id}
                    onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                    className="form-select"
                    data-testid="customer-select"
                    disabled={submitting}
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id || c.CUS_ID} value={c.id || c.CUS_ID}>
                        {c.first_name || c.FIRST_NAME} {c.last_name || c.LAST_NAME}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Product */}
                <div className="form-field">
                  <label className="form-label">
                    <Package className="w-4 h-4" />
                    Product <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="search"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Find a product by name or barcode"
                    className="form-input"
                    data-testid="product-search"
                    disabled={submitting}
                  />
                  <select
                    required
                    value={formData.product_id}
                    onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                    className="form-select"
                    data-testid="product-select"
                    disabled={submitting}
                  >
                    <option value="">Select Product ({pickerProducts.length} available)</option>
                    {pickerProducts.map((p) => (
                      <option key={p.id || p.PRODUCT_ID} value={p.id || p.PRODUCT_ID} data-testid="product-option">
                        {p.name_en || p.name || p.NAME_EN}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Serial Number */}
                <div className="form-field">
                  <label className="form-label">
                    <ClipboardList className="w-4 h-4" />
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
                    className="form-input"
                    placeholder="Enter serial number"
                    disabled={submitting}
                  />
                </div>

                {activeTab === 'warranty' ? (
                  <>
                    {/* Warranty Period */}
                    <div className="form-field">
                      <label className="form-label">
                        <Clock className="w-4 h-4" />
                        Warranty Period (months)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={formData.warranty_period}
                        onChange={(e) => setFormData({...formData, warranty_period: e.target.value})}
                        className="form-input"
                        disabled={submitting}
                      />
                    </div>

                    {/* Start & End Date */}
                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">
                          <Calendar className="w-4 h-4" />
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                          className="form-input"
                          disabled={submitting}
                        />
                      </div>
                      <div className="form-field">
                        <label className="form-label">
                          <Calendar className="w-4 h-4" />
                          End Date
                        </label>
                        <input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                          className="form-input"
                          disabled={submitting}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Issue Description */}
                    <div className="form-field">
                      <label className="form-label">
                        <Info className="w-4 h-4" />
                        Issue Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows="3"
                        value={formData.issue_description}
                        onChange={(e) => setFormData({...formData, issue_description: e.target.value})}
                        className="form-textarea"
                        placeholder="Describe the issue"
                        disabled={submitting}
                      />
                    </div>

                    {/* Service Type & Received Date */}
                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">
                          <Briefcase className="w-4 h-4" />
                          Service Type
                        </label>
                        <select
                          value={formData.service_type}
                          onChange={(e) => setFormData({...formData, service_type: e.target.value})}
                          className="form-select"
                          disabled={submitting}
                        >
                          <option value="Repair">Repair</option>
                          <option value="Maintenance">Maintenance</option>
                        </select>
                      </div>
                      <div className="form-field">
                        <label className="form-label">
                          <Calendar className="w-4 h-4" />
                          Received Date
                        </label>
                        <input
                          type="date"
                          value={formData.received_date}
                          onChange={(e) => setFormData({...formData, received_date: e.target.value})}
                          className="form-input"
                          disabled={submitting}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Status */}
                <div className="form-field">
                  <label className="form-label">
                    <Activity className="w-4 h-4" />
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="form-select"
                    disabled={submitting}
                  >
                    {activeTab === 'warranty' ? (
                      <>
                        <option value="Active">Active</option>
                        <option value="Expired">Expired</option>
                      </>
                    ) : (
                      <>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Notes */}
                <div className="form-field">
                  <label className="form-label">
                    <Info className="w-4 h-4" />
                    Notes
                  </label>
                  <textarea
                    rows="2"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="form-textarea"
                    placeholder="Additional notes..."
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="form-btn-cancel"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="form-btn-submit"
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
                      {editingItem ? 'Update' : 'Create'}
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

export default Warranty;