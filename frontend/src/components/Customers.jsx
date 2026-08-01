import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Search, Plus, Edit2, Trash2, Users as UsersIcon, 
  X, Save, DollarSign, Phone, Mail, MapPin, User,
  RefreshCw, AlertCircle, CheckCircle, Loader2,
  Filter, ArrowUp, ArrowDown, Grid3x3, List,
  TrendingUp, TrendingDown, Award, Star, Clock,
  Calendar, ChevronRight, Eye, Copy, Tag, Layers,
  Box, MessageCircle, Heart, Shield, Zap,
  Sparkles, Gift, Crown, AlertTriangle,
  Image as ImageIcon, Upload, Camera
} from 'lucide-react';
import '../styles/customer.css';
// ✅ Shared axios instance — attaches the Authorization header from
// localStorage on every request. Adjust the path below to match where
// client.js actually lives relative to this file (e.g. '../api/client').
import apiClient from '../api/client';

// ============================================
// MAIN CUSTOMERS COMPONENT
// ============================================
const Customers = () => {
  // ===== STATE =====
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('FIRST_NAME');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [customerStats, setCustomerStats] = useState({
    total: 0,
    active: 0,
    withPhone: 0,
    totalBalance: 0
  });

  // ===== IMAGE UPLOAD STATE =====
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false); // ✅ now a real lock, see handleImageSelect

  // ===== FORM DATA =====
  const [formData, setFormData] = useState({
    FIRST_NAME: '',
    LAST_NAME: '',
    PHONE: '',
    E_MAIL: '',
    ADDRESS: '',
    BALANCE: '',
    STATUS: 'Active',
    IMAGE_URL: ''
  });

  // ===== REFS =====
  const isMounted = useRef(true);
  const searchTimeout = useRef(null);
  const headerRef = useRef(null);
  const fileInputRef = useRef(null);
  // ✅ Mirrors formData.IMAGE_URL synchronously so handleSubmit never reads a stale
  // value, even if it fires in the same tick as a state update.
  const imageUrlRef = useRef('');

  // ===== MOUSE TRACKING =====
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ============================================
  // SHOW MESSAGE
  // ============================================
  const showMessage = useCallback((text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, []);

  // ============================================
  // GET FALLBACK CUSTOMERS
  // ============================================
  const getFallbackCustomers = useCallback(() => {
    return [
      { 
        CUS_ID: 'CUS001', 
        FIRST_NAME: 'John', 
        LAST_NAME: 'Doe', 
        PHONE: '555-0101', 
        E_MAIL: 'john@example.com', 
        ADDRESS: '123 Main St, NY', 
        BALANCE: 150.00, 
        STATUS: 'Active',
        image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop'
      },
      { 
        CUS_ID: 'CUS002', 
        FIRST_NAME: 'Jane', 
        LAST_NAME: 'Smith', 
        PHONE: '555-0102', 
        E_MAIL: 'jane@example.com', 
        ADDRESS: '456 Oak Ave, LA', 
        BALANCE: 0.00, 
        STATUS: 'Active',
        image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop'
      },
      { 
        CUS_ID: 'CUS003', 
        FIRST_NAME: 'Robert', 
        LAST_NAME: 'Johnson', 
        PHONE: '555-0103', 
        E_MAIL: 'robert@example.com', 
        ADDRESS: '789 Pine Rd, SF', 
        BALANCE: 75.50, 
        STATUS: 'Active',
        image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop'
      },
      { 
        CUS_ID: 'CUS004', 
        FIRST_NAME: 'Mary', 
        LAST_NAME: 'Williams', 
        PHONE: '555-0104', 
        E_MAIL: 'mary@example.com', 
        ADDRESS: '321 Elm St, CHI', 
        BALANCE: 200.00, 
        STATUS: 'Active',
        image_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop'
      }
    ];
  }, []);

  // ============================================
  // SAFE DATA EXTRACTION
  // ============================================
  const extractCustomersData = useCallback((responseData) => {
    if (typeof responseData === 'string' && responseData.includes('<!DOCTYPE html>')) {
      console.warn('⚠️ Received HTML - API not available');
      return [];
    }
    
    if (Array.isArray(responseData)) {
      return responseData;
    }
    
    if (responseData && typeof responseData === 'object') {
      if (Array.isArray(responseData.data)) {
        return responseData.data;
      }
      if (Array.isArray(responseData.customers)) {
        return responseData.customers;
      }
      if (Array.isArray(responseData.items)) {
        return responseData.items;
      }
      if (responseData.data && typeof responseData.data === 'object') {
        if (Array.isArray(responseData.data.items)) {
          return responseData.data.items;
        }
        if (Array.isArray(responseData.data.customers)) {
          return responseData.data.customers;
        }
        const values = Object.values(responseData.data);
        if (values.length > 0 && Array.isArray(values[0])) {
          return values[0];
        }
      }
    }
    
    return [];
  }, []);

  // ============================================
  // CALCULATE STATS
  // ============================================
  const calculateStats = useCallback((data) => {
    const customersArray = Array.isArray(data) ? data : [];
    const stats = {
      total: customersArray.length,
      active: customersArray.filter(c => {
        const status = c.STATUS || c.status || 'Active';
        return status === 'Active';
      }).length,
      withPhone: customersArray.filter(c => c.PHONE || c.phone).length,
      totalBalance: customersArray.reduce((sum, c) => {
        const balance = Number(c.BALANCE || c.balance || 0);
        return sum + balance;
      }, 0)
    };
    setCustomerStats(stats);
  }, []);

  // ============================================
  // FETCH CUSTOMERS
  // ============================================
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/customers', { 
        params: search ? { search: search } : {} 
      });
      
      if (isMounted.current) {
        if (typeof res.data === 'string' && res.data.includes('<!DOCTYPE html>')) {
          const fallbackData = getFallbackCustomers();
          setCustomers(fallbackData);
          calculateStats(fallbackData);
          showMessage('📋 Using offline data (API not available)', 'warning');
          setLoading(false);
          setIsRefreshing(false);
          return;
        }

        const customersData = extractCustomersData(res.data);
        const customersArray = Array.isArray(customersData) ? customersData : [];
        
        if (customersArray.length > 0) {
          console.log('✅ Customers loaded:', customersArray.length);
          setCustomers(customersArray);
          calculateStats(customersArray);
        } else {
          const fallbackData = getFallbackCustomers();
          setCustomers(fallbackData);
          calculateStats(fallbackData);
          showMessage('📋 Using fallback data (API returned empty)', 'info');
        }
      }
    } catch (error) {
      console.error('❌ Error fetching customers:', error.message);
      if (isMounted.current) {
        const fallbackData = getFallbackCustomers();
        setCustomers(fallbackData);
        calculateStats(fallbackData);
        showMessage('📋 Using offline data (API connection failed)', 'warning');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [search, showMessage, getFallbackCustomers, extractCustomersData, calculateStats]);

  // ============================================
  // ✅ FIXED: IMAGE HANDLING
  // Same bug as Products.jsx: FileReader.readAsDataURL() is async but nothing
  // blocked the Save button while it was still running, so a quick click right
  // after choosing a photo submitted with IMAGE_URL still empty. Fixed by:
  //   1. Actually setting isUploading true/false around the read.
  //   2. Wrapping FileReader in a Promise so we can await it.
  //   3. Writing to imageUrlRef synchronously the instant we have the base64
  //      string, so submit never reads a stale/empty value.
  //   4. Disabling Save (and blocking handleSubmit) while isUploading is true.
  // ============================================
  const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.log('❌ No file selected');
      return;
    }

    console.log('📸 File selected:', file.name, file.type, file.size);

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      showMessage('❌ Please select a valid image (JPEG, PNG, WEBP, GIF)', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessage('❌ Image size must be less than 5MB', 'error');
      return;
    }

    setSelectedImage(file);
    setIsUploading(true);
    setUploadProgress(30);

    try {
      const base64Image = await readFileAsDataURL(file);
      setUploadProgress(100);

      console.log('📸 Base64 image length:', base64Image.length);

      // ✅ Write to the ref immediately — this is synchronous and can't race with a click.
      imageUrlRef.current = base64Image;

      setImagePreview(base64Image);
      setFormData(prev => {
        console.log('📸 Updating formData with image');
        return { ...prev, IMAGE_URL: base64Image };
      });

      showMessage('✅ Image selected successfully!', 'success');
    } catch (err) {
      console.error('❌ Failed to read image:', err);
      showMessage('❌ Failed to read image file', 'error');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 400);
    }
  }, [showMessage]);

  const removeImage = useCallback(() => {
    console.log('🗑️ Removing image...');
    setSelectedImage(null);
    setImagePreview(null);
    setUploadProgress(0);
    imageUrlRef.current = '';
    setFormData(prev => {
      console.log('🗑️ Clearing image from formData');
      return { ...prev, IMAGE_URL: '' };
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ============================================
  // ✅ OPEN EDIT MODAL - Reads image_url from database
  // ============================================
  const openEditModal = useCallback((customer) => {
    const customerId = customer.CUS_ID || customer.cus_id || customer.ID;
    console.log('✏️ Editing customer:', customerId);
    
    // ✅ Read from database field (image_url) or fallback to IMAGE_URL
    const existingImage = customer.image_url || customer.IMAGE_URL || '';
    console.log('📸 Existing image:', existingImage ? 'YES (has image)' : 'NO (no image)');
    
    setEditingCustomer(customer);
    setFormData({
      FIRST_NAME: customer.FIRST_NAME || customer.first_name || '',
      LAST_NAME: customer.LAST_NAME || customer.last_name || '',
      PHONE: customer.PHONE || customer.phone || '',
      E_MAIL: customer.E_MAIL || customer.e_mail || '',
      ADDRESS: customer.ADDRESS || customer.address || '',
      BALANCE: customer.BALANCE || customer.balance || '',
      STATUS: customer.STATUS || customer.status || 'Active',
      IMAGE_URL: existingImage  // ✅ Use the existing image
    });
    imageUrlRef.current = existingImage;
    
    if (existingImage) {
      setImagePreview(existingImage);
      console.log('📸 Image preview loaded from existing');
    } else {
      setImagePreview(null);
    }
    
    setSelectedImage(null);
    setShowModal(true);
  }, []);

  const openAddModal = useCallback(() => {
    setEditingCustomer(null);
    resetForm();
    setImagePreview(null);
    setSelectedImage(null);
    setShowModal(true);
  }, []);

  // ============================================
  // ✅ FIXED: HANDLE SUBMIT
  // Now reads imageUrlRef.current (always current) instead of trusting formData
  // alone, and refuses to submit while an image is still being processed.
  // ============================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isUploading) {
      showMessage('⏳ Please wait, image is still processing...', 'warning');
      return;
    }

    setSubmitting(true);
    
    if (!formData.FIRST_NAME || formData.FIRST_NAME.trim() === '') {
      showMessage('❌ First name is required', 'error');
      setSubmitting(false);
      return;
    }
    
    if (!formData.LAST_NAME || formData.LAST_NAME.trim() === '') {
      showMessage('❌ Last name is required', 'error');
      setSubmitting(false);
      return;
    }

    // ✅ Prefer the ref — it's always in sync, formData can lag a render behind
    const imageUrl = imageUrlRef.current || formData.IMAGE_URL || '';
    console.log('📸 Image URL before submit:', imageUrl ? `✅ EXISTS (${imageUrl.length} chars)` : '❌ EMPTY');

    const submitData = {
      FIRST_NAME: formData.FIRST_NAME.trim(),
      LAST_NAME: formData.LAST_NAME.trim(),
      PHONE: formData.PHONE?.trim() || '',
      E_MAIL: formData.E_MAIL?.trim() || '',
      ADDRESS: formData.ADDRESS?.trim() || '',
      BALANCE: formData.BALANCE ? parseFloat(formData.BALANCE) : 0,
      STATUS: formData.STATUS || 'Active',
      IMAGE_URL: imageUrl
    };

    console.log('📤 Sending customer data:', {
      ...submitData,
      IMAGE_URL: submitData.IMAGE_URL ? `✅ (${submitData.IMAGE_URL.length} chars)` : '❌ MISSING'
    });

    try {
      let customerId;
      if (editingCustomer) {
        customerId = editingCustomer.CUS_ID || editingCustomer.cus_id || editingCustomer.ID;
        console.log('🆔 Updating customer ID:', customerId);
      }

      let response;
      if (editingCustomer && customerId) {
        response = await apiClient.put(`/customers/${customerId}`, submitData);
        showMessage('✅ Customer updated successfully!');
      } else {
        response = await apiClient.post('/customers', submitData);
        showMessage('✅ Customer created successfully!');
      }
      
      console.log('📥 Server response:', response.data);
      
      setShowModal(false);
      setEditingCustomer(null);
      
      await fetchCustomers();
      
      console.log('🔄 Resetting form and removing image...');
      resetForm();
      removeImage();
      
    } catch (error) {
      console.error('❌ Submit error:', error.response?.data || error.message);
      showMessage(`❌ ${error.response?.data?.error || 'Failed to save customer'}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================
  // RESET FORM
  // ============================================
  const resetForm = useCallback(() => {
    setFormData({ 
      FIRST_NAME: '', 
      LAST_NAME: '', 
      PHONE: '', 
      E_MAIL: '', 
      ADDRESS: '', 
      BALANCE: '',
      STATUS: 'Active',
      IMAGE_URL: ''
    });
    imageUrlRef.current = '';
  }, []);

  // ============================================
  // HANDLE DELETE
  // ============================================
  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    
    const customer = customers.find(c => (c.CUS_ID || c.cus_id || c.ID) === id);
    if (customer?._local) {
      setCustomers(prev => prev.filter(c => (c.CUS_ID || c.cus_id || c.ID) !== id));
      calculateStats(customers.filter(c => (c.CUS_ID || c.cus_id || c.ID) !== id));
      showMessage('✅ Local customer deleted!');
      return;
    }

    try {
      await apiClient.delete(`/customers/${id}`);
      showMessage('✅ Customer deleted successfully!');
      fetchCustomers();
    } catch (error) {
      console.error('Delete error:', error);
      showMessage('❌ Failed to delete customer', 'error');
    }
  }, [customers, fetchCustomers, showMessage, calculateStats]);

  // ============================================
  // BULK DELETE
  // ============================================
  const handleBulkDelete = useCallback(async () => {
    if (selectedCustomers.length === 0) return;
    if (!window.confirm(`Delete ${selectedCustomers.length} selected customers?`)) return;

    try {
      const localIds = [];
      const apiIds = [];
      
      for (const id of selectedCustomers) {
        const customer = customers.find(c => (c.CUS_ID || c.cus_id || c.ID) === id);
        if (customer?._local) {
          localIds.push(id);
        } else {
          apiIds.push(id);
        }
      }

      if (localIds.length > 0) {
        setCustomers(prev => prev.filter(c => !localIds.includes(c.CUS_ID || c.cus_id || c.ID)));
        calculateStats(customers.filter(c => !localIds.includes(c.CUS_ID || c.cus_id || c.ID)));
      }

      for (const id of apiIds) {
        await apiClient.delete(`/customers/${id}`);
      }

      showMessage(`✅ ${selectedCustomers.length} customers deleted!`);
      setSelectedCustomers([]);
      if (apiIds.length > 0) fetchCustomers();
    } catch (error) {
      console.error('Bulk delete error:', error);
      showMessage('❌ Failed to delete some customers', 'error');
    }
  }, [selectedCustomers, customers, fetchCustomers, showMessage, calculateStats]);

  // ============================================
  // TOGGLE SELECT
  // ============================================
  const toggleSelect = useCallback((id) => {
    setSelectedCustomers(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customers.map(c => c.CUS_ID || c.cus_id || c.ID));
    }
  }, [selectedCustomers, customers]);

  // ============================================
  // FILTERED & SORTED CUSTOMERS
  // ============================================
  const filteredCustomers = useMemo(() => {
    const customersArray = Array.isArray(customers) ? customers : [];
    let result = [...customersArray];

    if (filterStatus === 'active') {
      result = result.filter(c => {
        const status = c.STATUS || c.status || 'Active';
        return status === 'Active';
      });
    } else if (filterStatus === 'inactive') {
      result = result.filter(c => {
        const status = c.STATUS || c.status || 'Active';
        return status !== 'Active';
      });
    } else if (filterStatus === 'withBalance') {
      result = result.filter(c => Number(c.BALANCE || c.balance || 0) > 0);
    }

    result.sort((a, b) => {
      let comparison = 0;
      const aVal = a[sortBy] ?? '';
      const bVal = b[sortBy] ?? '';
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [customers, filterStatus, sortBy, sortOrder]);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const getFullName = (customer) => {
    const firstName = customer.FIRST_NAME || customer.first_name || '';
    const lastName = customer.LAST_NAME || customer.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'Unknown';
  };

  const getInitials = (customer) => {
    const firstName = customer.FIRST_NAME || customer.first_name || '';
    const lastName = customer.LAST_NAME || customer.last_name || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
  };

  const getAvatarColor = (name) => {
    const colors = [
      'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-red-500', 'bg-orange-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-rose-500', 'bg-amber-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getCustomerEmoji = (name) => {
    const emojis = ['👤', '👨', '👩', '🧑', '👨‍💼', '👩‍💼', '🧑‍💼', '👨‍💻', '👩‍💻', '🧑‍💻'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return emojis[Math.abs(hash) % emojis.length];
  };

  const formatPhone = (phone) => {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 9) {
      return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
    }
    return phone;
  };

  const getStatusBadge = (status) => {
    const isActive = (status || 'Active') === 'Active';
    return isActive 
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800';
  };

  const getStatIcon = (type) => {
    const icons = {
      total: <UsersIcon className="w-5 h-5 text-indigo-500" />,
      active: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      withPhone: <Phone className="w-5 h-5 text-yellow-500" />,
      totalBalance: <DollarSign className="w-5 h-5 text-purple-500" />
    };
    return icons[type] || icons.total;
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchCustomers();
  }, [fetchCustomers]);

  // ============================================
  // INITIAL LOAD
  // ============================================
  useEffect(() => {
    isMounted.current = true;
    fetchCustomers();

    return () => {
      isMounted.current = false;
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [fetchCustomers]);

  // ===== SEARCH DEBOUNCE =====
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      fetchCustomers();
    }, 500);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [search, fetchCustomers]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen">
      
      {/* ===== MESSAGE TOAST ===== */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 max-w-md w-full p-4 rounded-xl shadow-2xl border transform transition-all duration-500 animate-slideInRight ${
          messageType === 'success' 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' 
            : messageType === 'error'
            ? 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            : messageType === 'warning'
            ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
            : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
        }`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {messageType === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
              {messageType === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
              {messageType === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
              {messageType === 'info' && <RefreshCw className="w-5 h-5 text-blue-500" />}
            </div>
            <div className="flex-1 text-sm font-medium">{message}</div>
            <button onClick={() => setMessage('')} className="flex-shrink-0 opacity-50 hover:opacity-100 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===== HEADER WITH STATS ===== */}
      <div 
        ref={headerRef}
        className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden transition-all duration-300"
        style={{
          transform: `perspective(1000px) rotateX(${(mousePosition.y / window.innerHeight - 0.5) * 2}deg) rotateY(${(mousePosition.x / window.innerWidth - 0.5) * 2}deg)`,
          transition: 'transform 0.1s ease-out'
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-purple-300/20 rounded-full animate-pulse-slow animation-delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full animate-spin-slow" />
        </div>

        <div className="relative z-10 flex flex-wrap justify-between items-center">
          <div className="animate-fadeInUp">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-white/80 tracking-wider uppercase">Customer Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <UsersIcon className="w-8 h-8" />
              Customer Management
            </h1>
            <p className="text-indigo-100 mt-1 text-sm">Manage your customer relationships and accounts</p>
          </div>
          <div className="flex items-center gap-3 mt-3 sm:mt-0">
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl text-sm flex items-center gap-2 border border-white/10 animate-pulse-slow">
              <Clock className="w-4 h-4 text-white/80" />
              {new Date().toLocaleTimeString()}
            </div>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-white/20 backdrop-blur-sm p-2 rounded-xl hover:bg-white/30 transition hover:scale-110 duration-300"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openAddModal}
              className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl hover:bg-white/30 transition hover:scale-105 duration-300 flex items-center gap-2 border border-white/10"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 relative z-10">
          {[
            { label: 'Total Customers', value: customerStats.total, icon: 'total' },
            { label: 'Active Customers', value: customerStats.active, icon: 'active' },
            { label: 'With Phone', value: customerStats.withPhone, icon: 'withPhone' },
            { label: 'Total Balance', value: `$${customerStats.totalBalance.toFixed(2)}`, icon: 'totalBalance' }
          ].map((stat, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 hover:bg-white/20 transition-all duration-300 hover:scale-105 animate-slideUp border border-white/5" style={{ animationDelay: `${index * 0.1}s` }}>
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-all duration-300">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[200px] group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search by name, phone, email..."
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 group-hover:border-indigo-300"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 hover:border-indigo-300"
            >
              <option value="all">All Customers</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="withBalance">With Balance</option>
            </select>

            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none px-2"
              >
                <option value="FIRST_NAME">Name</option>
                <option value="BALANCE">Balance</option>
                <option value="PHONE">Phone</option>
                <option value="STATUS">Status</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-600 transition-all duration-300 hover:scale-110"
              >
                {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-gray-500" /> : <ArrowDown className="w-4 h-4 text-gray-500" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all duration-300 hover:scale-110 ${
                  viewMode === 'grid' 
                    ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600' 
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}
                title="Grid view"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all duration-300 hover:scale-110 ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600' 
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {selectedCustomers.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-3 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-300 hover:scale-105 flex items-center gap-2 text-sm shadow-lg shadow-red-600/20"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedCustomers.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== CUSTOMERS DISPLAY ===== */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 animate-ping" />
            </div>
          </div>
          <p className="text-gray-400 font-medium">Loading customers...</p>
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center hover:shadow-lg transition-all duration-300">
          <UsersIcon className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4 animate-float" />
          <h3 className="text-xl font-medium text-gray-600 dark:text-gray-400">No customers found</h3>
          <p className="text-gray-400 dark:text-gray-500 mt-2">
            {search ? 'Try adjusting your search or filters' : 'Add your first customer to get started'}
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add Customer
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        // ===== GRID VIEW =====
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCustomers.map((customer, index) => {
            const id = customer.CUS_ID || customer.cus_id || customer.ID || `cust-${index}`;
            const fullName = getFullName(customer);
            const phone = customer.PHONE || customer.phone || '';
            const email = customer.E_MAIL || customer.e_mail || '';
            const address = customer.ADDRESS || customer.address || '';
            const balance = Number(customer.BALANCE || customer.balance || 0);
            const status = customer.STATUS || customer.status || 'Active';
            const isSelected = selectedCustomers.includes(id);
            const emoji = getCustomerEmoji(fullName);
            const imageUrl = customer.image_url || customer.IMAGE_URL || '';

            return (
              <div
                key={id}
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 transition-all duration-500 hover:shadow-xl hover:-translate-y-2 group animate-fadeIn cursor-pointer ${
                  isSelected ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30' : 'border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                } ${balance > 0 ? 'hover:border-purple-300 dark:hover:border-purple-600' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => toggleSelect(id)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {imageUrl ? (
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 group-hover:scale-110 transition-transform duration-300 border-2 border-gray-200 dark:border-gray-600">
                          <img 
                            src={imageUrl} 
                            alt={fullName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.log('❌ Image failed to load, using fallback');
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="relative">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${getAvatarColor(fullName)} shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                            {emoji}
                          </div>
                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                            status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'
                          }`} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-800 dark:text-white truncate max-w-[120px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {fullName}
                        </h3>
                        {address && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[120px] flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(customer);
                        }}
                        className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(id);
                        }}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {phone && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                        {formatPhone(phone)}
                      </p>
                    )}
                    {email && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        <Mail className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className="truncate">{email}</span>
                      </p>
                    )}
                    {!phone && !email && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                        No contact information available
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-300 ${getStatusBadge(status)} group-hover:scale-105`}>
                        {status}
                      </span>
                      {balance > 0 && (
                        <span className="text-xs font-medium text-purple-600 dark:text-purple-400 animate-pulse">
                          ${balance.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {balance > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-4 bg-purple-400 rounded-full animate-bar1" />
                        <div className="w-1 h-6 bg-purple-500 rounded-full animate-bar2" />
                        <div className="w-1 h-8 bg-purple-600 rounded-full animate-bar3" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // ===== LIST VIEW =====
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.length === customers.length && customers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">Phone</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">Email</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">Address</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Balance</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredCustomers.map((customer, index) => {
                  const id = customer.CUS_ID || customer.cus_id || customer.ID || `cust-${index}`;
                  const fullName = getFullName(customer);
                  const phone = customer.PHONE || customer.phone || '';
                  const email = customer.E_MAIL || customer.e_mail || '';
                  const address = customer.ADDRESS || customer.address || '';
                  const balance = Number(customer.BALANCE || customer.balance || 0);
                  const status = customer.STATUS || customer.status || 'Active';
                  const isSelected = selectedCustomers.includes(id);
                  const emoji = getCustomerEmoji(fullName);
                  const imageUrl = customer.image_url || customer.IMAGE_URL || '';

                  return (
                    <tr 
                      key={id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all duration-300 group animate-slideIn ${
                        isSelected ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''
                      } ${balance > 0 ? 'hover:bg-purple-50/50 dark:hover:bg-purple-900/5' : ''}`}
                      style={{ animationDelay: `${index * 0.03}s` }}
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
                          {imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt={fullName}
                              className="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-700"
                              onError={(e) => {
                                console.log('❌ Image failed to load, using fallback');
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-xl">{emoji}</span>
                          )}
                          <span className="font-medium text-sm dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {phone ? <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-emerald-500" /> {formatPhone(phone)}</span> : '-'}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {email || '-'}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-400 dark:text-gray-500 hidden lg:table-cell">
                        {address || '-'}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-right dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        ${balance.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-300 ${getStatusBadge(status)} group-hover:scale-105`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(customer)}
                            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 group-hover:scale-110"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-300 group-hover:scale-110"
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
        <p className="flex items-center justify-center gap-4 flex-wrap">
          <span>👥 {filteredCustomers.length} customers displayed</span>
          <span>•</span>
          <span>💾 {customerStats.total} total customers</span>
          <span>•</span>
          <span>💰 ${customerStats.totalBalance.toFixed(2)} total balance</span>
          <span>•</span>
          <span>{new Date().toLocaleString()}</span>
        </p>
      </div>

      {/* ============================================ */}
      {/* ===== MODAL WITH IMAGE UPLOAD ===== */}
      {/* ============================================ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-indigo-600 animate-bounce" />
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
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
                
                {/* ===== IMAGE UPLOAD SECTION ===== */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-500" />
                    Customer Photo
                  </label>
                  
                  {imagePreview && (
                    <div className="relative mb-3">
                      <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600">
                        <img 
                          src={imagePreview} 
                          alt="Customer preview" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all duration-300 hover:scale-110 shadow-lg"
                        disabled={isUploading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {isUploading && (
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <span>Processing image, please wait...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 group flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={submitting || isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                      )}
                      <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {isUploading ? 'Processing...' : imagePreview ? 'Change Photo' : 'Upload Photo'}
                      </span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      disabled={submitting || isUploading}
                    />
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={removeImage}
                        className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-300 hover:scale-105 disabled:opacity-50"
                        disabled={isUploading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                    Supported: JPG, PNG, WEBP, GIF (Max 5MB)
                  </p>
                </div>

                {/* ===== Name Fields ===== */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="group">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.FIRST_NAME}
                      onChange={(e) => setFormData({...formData, FIRST_NAME: e.target.value})}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 group-hover:border-indigo-300"
                      placeholder="First name"
                      disabled={submitting}
                    />
                  </div>
                  <div className="group">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.LAST_NAME}
                      onChange={(e) => setFormData({...formData, LAST_NAME: e.target.value})}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 group-hover:border-indigo-300"
                      placeholder="Last name"
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* ===== Phone ===== */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.PHONE}
                    onChange={(e) => setFormData({...formData, PHONE: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 group-hover:border-indigo-300"
                    placeholder="Enter phone number"
                    disabled={submitting}
                  />
                </div>

                {/* ===== Email ===== */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.E_MAIL}
                    onChange={(e) => setFormData({...formData, E_MAIL: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 group-hover:border-indigo-300"
                    placeholder="Enter email address"
                    disabled={submitting}
                  />
                </div>

                {/* ===== Address ===== */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.ADDRESS}
                    onChange={(e) => setFormData({...formData, ADDRESS: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 group-hover:border-indigo-300"
                    placeholder="Enter address"
                    disabled={submitting}
                  />
                </div>

                {/* ===== Balance ===== */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    Balance (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.BALANCE}
                    onChange={(e) => setFormData({...formData, BALANCE: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 group-hover:border-indigo-300"
                    placeholder="0.00"
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Customer's current balance (default: 0.00)
                  </p>
                </div>

                {/* ===== Status ===== */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                  <select
                    value={formData.STATUS}
                    onChange={(e) => setFormData({...formData, STATUS: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 group-hover:border-indigo-300"
                    disabled={submitting}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* ===== Actions ===== */}
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
                  disabled={submitting || isUploading}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing image...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingCustomer ? 'Update Customer' : 'Create Customer'}
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

export default Customers;