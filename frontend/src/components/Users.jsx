import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import apiClient from '../api/client';
import { 
  Shield, Plus, Edit2, Trash2, X, Save, RefreshCw,
  User, Users as UsersIcon, CheckCircle, AlertCircle,
  Clock, Award, Star, Zap, Activity, Search,
  Filter, ArrowUp, ArrowDown, Grid3x3, List,
  Eye, Lock, Key, Phone, Mail, Calendar,
  Crown, Briefcase, UserCheck, UserX,
  Loader2, AlertTriangle, ChevronRight,
  Sparkles, Gift, Heart
} from 'lucide-react';
import '../styles/users.css'

// ============================================
// API INTERCEPTORS — FIXED ✅
// ============================================
apiClient.interceptors.request.use(
  config => {
    console.log('📤 API Request:', config.method?.toUpperCase(), config.url);
    console.log('📤 Request Data:', config.data);
    return config;
  },
  error => Promise.reject(error)
);

apiClient.interceptors.response.use(
  response => {
    console.log('📥 API Response:', response.status, response.config.url);
    return response;
  },
  error => {
    console.error('❌ API Error:', error.response?.status);
    console.error('❌ Error Data:', error.response?.data);
    console.error('❌ Error Data Stringified:', JSON.stringify(error.response?.data, null, 2));
    console.error('❌ Error Message:', error.message);
    return Promise.reject(error);
  }
);

// ============================================
// MAIN USERS COMPONENT
// ============================================
const Users = () => {
  // ===== STATE =====
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmittingRef, setIsSubmittingRef] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('username');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [userStats, setUserStats] = useState({
    total: 0,
    active: 0,
    admins: 0,
    cashiers: 0
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // ===== FORM DATA =====
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullname: '',
    role_id: '2',
    email: '',
    phone: '',
    status: 'ACTIVE'
  });

  // ===== REFS =====
  const isMounted = useRef(true);
  const searchTimeout = useRef(null);
  const headerRef = useRef(null);
  const submitTimeoutRef = useRef(null);

  // ===== MOUSE TRACKING =====
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ===== FETCH USERS =====
  const fetchUsers = useCallback(async () => {
    if (!isMounted.current) return;
    
    setLoading(true);
    try {
      const res = await apiClient.get('/users', {
        params: { search: searchTerm || undefined }
      });
      if (isMounted.current) {
        const data = res.data?.data || res.data || [];
        setUsers(data);
        calculateStats(data);
        if (data.length > 0) {
          showMessage(`✅ Loaded ${data.length} users`, 'success');
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      if (isMounted.current) {
        showMessage('❌ Failed to load users', 'error');
        // Fallback mock data
        const fallbackData = [
          { user_id: 1, username: 'admin', fullname: 'Administrator', role_id: 1, role: 'Admin', status: 'ACTIVE', email: 'admin@example.com', phone: '555-0001', created_at: '2026-01-01' },
          { user_id: 2, username: 'cashier1', fullname: 'John Doe', role_id: 2, role: 'Cashier', status: 'ACTIVE', email: 'john@example.com', phone: '555-0002', created_at: '2026-01-15' },
          { user_id: 3, username: 'cashier2', fullname: 'Jane Smith', role_id: 2, role: 'Cashier', status: 'ACTIVE', email: 'jane@example.com', phone: '555-0003', created_at: '2026-02-01' },
          { user_id: 4, username: 'viewer1', fullname: 'Robert Johnson', role_id: 3, role: 'Viewer', status: 'ACTIVE', email: 'robert@example.com', phone: '555-0004', created_at: '2026-02-15' },
          { user_id: 5, username: 'cashier3', fullname: 'Mary Williams', role_id: 2, role: 'Cashier', status: 'INACTIVE', email: 'mary@example.com', phone: '555-0005', created_at: '2026-03-01' },
        ];
        setUsers(fallbackData);
        calculateStats(fallbackData);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [searchTerm]);

  // ===== CALCULATE STATS =====
  const calculateStats = useCallback((data) => {
    const stats = {
      total: data.length,
      active: data.filter(u => (u.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length,
      admins: data.filter(u => u.role_id === 1 || u.role === 'Admin').length,
      cashiers: data.filter(u => u.role_id === 2 || u.role === 'Cashier').length
    };
    setUserStats(stats);
  }, []);

  // ===== SHOW MESSAGE =====
  const showMessage = useCallback((text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }
    submitTimeoutRef.current = setTimeout(() => setMessage(''), 5000);
  }, []);

  // ===== INITIAL LOAD =====
  useEffect(() => {
    isMounted.current = true;
    fetchUsers();

    return () => {
      isMounted.current = false;
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, [fetchUsers]);

  // ===== SEARCH DEBOUNCE =====
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      fetchUsers();
    }, 500);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchTerm, fetchUsers]);

  // ===== FILTERED & SORTED USERS =====
  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (filterRole !== 'all') {
      const roleMap = {
        'admin': [1, 'Admin'],
        'cashier': [2, 'Cashier'],
        'viewer': [3, 'Viewer']
      };
      const roles = roleMap[filterRole] || [];
      result = result.filter(u => {
        const userRole = u.role_id || (u.role === 'Admin' ? 1 : u.role === 'Cashier' ? 2 : 3);
        return roles.includes(userRole) || roles.includes(u.role);
      });
    }

    if (filterStatus !== 'all') {
      result = result.filter(u => {
        const status = (u.status || 'ACTIVE').toUpperCase();
        return filterStatus === 'active' ? status === 'ACTIVE' : status === 'INACTIVE';
      });
    }

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

    return result;
  }, [users, filterRole, filterStatus, sortBy, sortOrder]);

  // ===== VALIDATE FORM =====
  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!formData.username?.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    }
    
    if (!editingUser && !formData.password) {
      errors.password = 'Password is required for new users';
    } else if (formData.password && formData.password.length < 4) {
      errors.password = 'Password must be at least 4 characters';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (formData.phone && !/^[\d\s\-()+]+$/.test(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, editingUser]);

  // ===== HANDLE SUBMIT =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (isSubmittingRef || submitting) {
      console.log('⏳ Submission already in progress');
      return;
    }
    
    // Validate form
    if (!validateForm()) {
      showMessage('❌ Please fix the errors in the form', 'error');
      return;
    }
    
    setIsSubmittingRef(true);
    setSubmitting(true);
    
    try {
      // Prepare submit data - only include fields that have values
      const submitData = {
        username: formData.username.trim(),
        fullname: formData.fullname?.trim() || formData.username.trim(),
        role_id: parseInt(formData.role_id, 10),
        status: formData.status || 'ACTIVE'
      };
      
      // Only add email if it's provided
      if (formData.email?.trim()) {
        submitData.email = formData.email.trim();
      }
      
      // Only add phone if it's provided
      if (formData.phone?.trim()) {
        submitData.phone = formData.phone.trim();
      }
      
      // Only include password if it's provided
      if (formData.password) {
        submitData.password = formData.password;
      }
      
      console.log('📤 Submitting data:', JSON.stringify(submitData, null, 2));
      
      let response;
      if (editingUser) {
        // For updates, only send fields that should be updated
        const updateData = { ...submitData };
        // If password is empty, don't send it
        if (!formData.password) {
          delete updateData.password;
        }
        
        console.log(`📤 Updating user ${editingUser.user_id} with:`, updateData);
        response = await apiClient.put(`/users/${editingUser.user_id}`, updateData);
        showMessage('✅ User updated successfully!');
      } else {
        // For new users, password is required
        if (!submitData.password) {
          showMessage('❌ Password is required for new users', 'error');
          setIsSubmittingRef(false);
          setSubmitting(false);
          return;
        }
        console.log('📤 Creating new user with:', submitData);
        response = await apiClient.post('/users', submitData);
        showMessage('✅ User created successfully!');
      }
      
      console.log('✅ Success response:', response.data);
      
      // Reset form and close modal
      setShowModal(false);
      setEditingUser(null);
      resetForm();
      setFieldErrors({});
      
      // Refresh user list
      await fetchUsers();
      
    } catch (error) {
      console.error('❌ Submit error:', error);
      
      // Log the full error for debugging
      if (error.response?.data) {
        console.log('📋 Full server error:', JSON.stringify(error.response.data, null, 2));
        
        // Try to parse the errors array
        if (error.response.data.errors) {
          const errors = error.response.data.errors;
          console.log('📋 Errors array:', errors);
          
          // If errors is an array of objects with msg property
          if (Array.isArray(errors) && errors.length > 0) {
            const firstError = errors[0];
            console.log('📋 First error object:', firstError);
            
            // Extract error message
            let errorMessage = '';
            if (typeof firstError === 'string') {
              errorMessage = firstError;
            } else if (firstError.msg) {
              errorMessage = firstError.msg;
            } else if (firstError.message) {
              errorMessage = firstError.message;
            } else if (firstError.error) {
              errorMessage = firstError.error;
            } else {
              errorMessage = JSON.stringify(firstError);
            }
            
            showMessage(`❌ ${errorMessage}`, 'error');
          } else {
            // Handle other error formats
            let errorMessage = '';
            if (typeof errors === 'string') {
              errorMessage = errors;
            } else if (errors.msg) {
              errorMessage = errors.msg;
            } else if (errors.message) {
              errorMessage = errors.message;
            } else {
              errorMessage = JSON.stringify(errors);
            }
            showMessage(`❌ ${errorMessage}`, 'error');
          }
        } else if (error.response.data.error) {
          showMessage(`❌ ${error.response.data.error}`, 'error');
        } else if (error.response.data.message) {
          showMessage(`❌ ${error.response.data.message}`, 'error');
        } else {
          showMessage(`❌ ${JSON.stringify(error.response.data)}`, 'error');
        }
      } else {
        showMessage('❌ Failed to save user. Please check the form and try again.', 'error');
      }
    } finally {
      setIsSubmittingRef(false);
      if (isMounted.current) {
        setSubmitting(false);
      }
    }
  };

  // ===== HANDLE DELETE =====
  const handleDelete = useCallback(async (id) => {
    if (id === 1) {
      showMessage('❌ Cannot delete the admin user', 'error');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await apiClient.delete(`/users/${id}`);
      showMessage('✅ User deleted successfully!');
      await fetchUsers();
    } catch (error) {
      console.error('Delete error:', error);
      showMessage('❌ Failed to delete user', 'error');
    }
  }, [fetchUsers, showMessage]);

  // ===== BULK DELETE =====
  const handleBulkDelete = useCallback(async () => {
    if (selectedUsers.length === 0) return;
    if (selectedUsers.includes(1)) {
      showMessage('❌ Cannot delete the admin user', 'error');
      return;
    }
    if (!window.confirm(`Delete ${selectedUsers.length} selected users?`)) return;

    try {
      await Promise.all(selectedUsers.map(id => apiClient.delete(`/users/${id}`)));
      showMessage(`✅ ${selectedUsers.length} users deleted!`);
      setSelectedUsers([]);
      await fetchUsers();
    } catch (error) {
      console.error('Bulk delete error:', error);
      showMessage('❌ Failed to delete some users', 'error');
    }
  }, [selectedUsers, fetchUsers, showMessage]);

  // ===== TOGGLE SELECT ALL =====
  const toggleSelectAll = useCallback(() => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.user_id));
    }
  }, [selectedUsers, filteredUsers]);

  // ===== RESET FORM =====
  const resetForm = useCallback(() => {
    setFormData({
      username: '',
      password: '',
      fullname: '',
      role_id: '2',
      email: '',
      phone: '',
      status: 'ACTIVE'
    });
    setFieldErrors({});
    setShowPassword(false);
  }, []);

  // ===== OPEN MODAL =====
  const openEditModal = useCallback((user) => {
    setEditingUser(user);
    setFormData({
      username: user.username || '',
      password: '',
      fullname: user.fullname || '',
      role_id: String(user.role_id || 2),
      email: user.email || '',
      phone: user.phone || '',
      status: user.status || 'ACTIVE'
    });
    setFieldErrors({});
    setShowModal(true);
  }, []);

  const openAddModal = useCallback(() => {
    setEditingUser(null);
    resetForm();
    setShowModal(true);
  }, [resetForm]);

  // ===== VIEW USER DETAIL =====
  const viewUserDetail = useCallback((user) => {
    setSelectedUserDetail(user);
    setShowDetailModal(true);
  }, []);

  // ===== TOGGLE SELECT =====
  const toggleSelect = useCallback((id) => {
    setSelectedUsers(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  // ===== REFRESH =====
  const handleRefresh = useCallback(async () => {
    await fetchUsers();
  }, [fetchUsers]);

  // ===== GET ROLE BADGE =====
  const getRoleBadge = useCallback((roleId, role) => {
    if (typeof role === 'string') {
      const roleMap = {
        'Admin': 1,
        'Cashier': 2,
        'Viewer': 3
      };
      roleId = roleMap[role] || 2;
    }
    
    const roles = {
      1: { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800', label: 'Admin', icon: Crown },
      2: { color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800', label: 'Cashier', icon: Briefcase },
      3: { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800', label: 'Viewer', icon: Eye }
    };
    const roleData = roles[roleId] || roles[2];
    const Icon = roleData.icon;
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5 ${roleData.color}`}>
        <Icon className="w-3 h-3" />
        {roleData.label}
      </span>
    );
  }, []);

  // ===== GET STATUS BADGE =====
  const getStatusBadge = useCallback((status) => {
    const isActive = (status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    return isActive 
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800';
  }, []);

  // ===== GET STAT ICON =====
  const getStatIcon = useCallback((type) => {
    const icons = {
      total: <UsersIcon className="w-5 h-5 text-indigo-500" />,
      active: <UserCheck className="w-5 h-5 text-emerald-500" />,
      admins: <Crown className="w-5 h-5 text-red-500" />,
      cashiers: <Briefcase className="w-5 h-5 text-yellow-500" />
    };
    return icons[type] || icons.total;
  }, []);

  // ===== GET AVATAR COLOR =====
  const getAvatarColor = useCallback((name) => {
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
  }, []);

  // ===== GET USER EMOJI =====
  const getUserEmoji = useCallback((role) => {
    const emojis = {
      'Admin': '👑',
      'Cashier': '💼',
      'Viewer': '👀'
    };
    return emojis[role] || '👤';
  }, []);

  // ===== GET INITIALS =====
  const getInitials = useCallback((name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }, []);

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
        <p className="text-gray-400 font-medium">Loading users...</p>
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
          <div className="absolute top-10 right-20 text-4xl animate-float-delayed opacity-20">✦</div>
        </div>

        <div className="relative z-10 flex flex-wrap justify-between items-center">
          <div className="animate-fadeInUp">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-white/80 tracking-wider uppercase">User Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Shield className="w-8 h-8" />
              User Management
            </h1>
            <p className="text-indigo-100 mt-1 text-sm">Manage system users and their permissions</p>
          </div>
          <div className="flex items-center gap-3 mt-3 sm:mt-0">
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl text-sm flex items-center gap-2 border border-white/10 animate-pulse-slow">
              <Clock className="w-4 h-4 text-white/80" />
              {new Date().toLocaleTimeString()}
            </div>
            <button 
              onClick={handleRefresh}
              className="bg-white/20 backdrop-blur-sm p-2 rounded-xl hover:bg-white/30 transition hover:scale-110 duration-300"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openAddModal}
              className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl hover:bg-white/30 transition hover:scale-105 duration-300 flex items-center gap-2 border border-white/10"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 relative z-10">
          {[
            { label: 'Total Users', value: userStats.total, icon: 'total' },
            { label: 'Active', value: userStats.active, icon: 'active' },
            { label: 'Admins', value: userStats.admins, icon: 'admins' },
            { label: 'Cashiers', value: userStats.cashiers, icon: 'cashiers' }
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 Search by username, name, email..."
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 group-hover:border-indigo-300"
              />
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 hover:border-indigo-300"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="cashier">Cashier</option>
              <option value="viewer">Viewer</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 hover:border-indigo-300"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none px-2"
              >
                <option value="username">Username</option>
                <option value="fullname">Full Name</option>
                <option value="role_id">Role</option>
                <option value="status">Status</option>
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

            {selectedUsers.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-3 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-300 hover:scale-105 flex items-center gap-2 text-sm shadow-lg shadow-red-600/20"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedUsers.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== USERS GRID ===== */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center hover:shadow-lg transition-all duration-300">
          <Shield className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4 animate-float" />
          <h3 className="text-xl font-medium text-gray-600 dark:text-gray-400">No users found</h3>
          <p className="text-gray-400 dark:text-gray-500 mt-2">
            {searchTerm || filterRole !== 'all' || filterStatus !== 'all' ? 'Try adjusting your search or filters' : 'Add your first user to get started'}
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add User
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map((user, index) => {
            const id = user.user_id;
            const username = user.username || 'Unknown';
            const fullname = user.fullname || '';
            const role = user.role || (user.role_id === 1 ? 'Admin' : user.role_id === 2 ? 'Cashier' : 'Viewer');
            const roleId = user.role_id || (role === 'Admin' ? 1 : role === 'Cashier' ? 2 : 3);
            const status = user.status || 'ACTIVE';
            const isSelected = selectedUsers.includes(id);
            const emoji = getUserEmoji(role);

            return (
              <div
                key={id}
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 transition-all duration-500 hover:shadow-xl hover:-translate-y-2 group animate-fadeIn cursor-pointer ${
                  isSelected ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30' : 'border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => toggleSelect(id)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${getAvatarColor(fullname || username)} shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                          {emoji}
                        </div>
                        <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 ${
                          status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-800 dark:text-white truncate max-w-[120px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {username}
                        </h3>
                        {fullname && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[120px] flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {fullname}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          viewUserDetail(user);
                        }}
                        className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(user);
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
                        className={`p-1.5 rounded-lg transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110 ${
                          id === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                        title={id === 1 ? 'Cannot delete admin' : 'Delete'}
                        disabled={id === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    {getRoleBadge(roleId, role)}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-300 ${getStatusBadge(status)} group-hover:scale-105`}>
                      {status}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {user.email && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        <Mail className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </p>
                    )}
                    {user.phone && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                        {user.phone}
                      </p>
                    )}
                    {user.created_at && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        Joined {formatDate(user.created_at)}
                      </p>
                    )}
                    {!user.email && !user.phone && !user.created_at && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                        No additional information
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Key className="w-3 h-3" />
                      ID: {id}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {role}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">Full Name</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">Role</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">Email</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredUsers.map((user, index) => {
                  const id = user.user_id;
                  const username = user.username || 'Unknown';
                  const fullname = user.fullname || '';
                  const role = user.role || (user.role_id === 1 ? 'Admin' : user.role_id === 2 ? 'Cashier' : 'Viewer');
                  const roleId = user.role_id || (role === 'Admin' ? 1 : role === 'Cashier' ? 2 : 3);
                  const status = user.status || 'ACTIVE';
                  const isSelected = selectedUsers.includes(id);
                  const emoji = getUserEmoji(role);

                  return (
                    <tr 
                      key={id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all duration-300 group animate-slideIn ${
                        isSelected ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''
                      }`}
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
                          <span className="text-xl">{emoji}</span>
                          <span className="font-medium text-sm dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {username}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
                        {fullname || '-'}
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        {getRoleBadge(roleId, role)}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                        {user.email || '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-300 ${getStatusBadge(status)} group-hover:scale-105`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => viewUserDetail(user)}
                            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 group-hover:scale-110"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 group-hover:scale-110"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            className={`p-1.5 rounded-lg transition-all duration-300 group-hover:scale-110 ${
                              id === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                            }`}
                            title={id === 1 ? 'Cannot delete admin' : 'Delete'}
                            disabled={id === 1}
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
          <span>👥 {filteredUsers.length} users displayed</span>
          <span>•</span>
          <span>🛡️ {userStats.total} total users</span>
          <span>•</span>
          <span>✅ {userStats.active} active</span>
          <span>•</span>
          <span>👑 {userStats.admins} admins</span>
          <span>•</span>
          <span>💼 {userStats.cashiers} cashiers</span>
          <span>•</span>
          <span>{new Date().toLocaleString()}</span>
        </p>
      </div>

      {/* ===== USER DETAIL MODAL ===== */}
      {showDetailModal && selectedUserDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                User Details
              </h2>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-300 hover:rotate-90"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl ${getAvatarColor(selectedUserDetail.fullname || selectedUserDetail.username)} shadow-lg`}>
                  {getInitials(selectedUserDetail.fullname || selectedUserDetail.username)}
                </div>
                <div>
                  <p className="text-lg font-bold dark:text-white">{selectedUserDetail.username}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedUserDetail.fullname || 'No full name'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getRoleBadge(
                      selectedUserDetail.role_id || (selectedUserDetail.role === 'Admin' ? 1 : selectedUserDetail.role === 'Cashier' ? 2 : 3),
                      selectedUserDetail.role
                    )}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedUserDetail.status)}`}>
                      {selectedUserDetail.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" />
                Contact Information
              </h3>
              <div className="space-y-2 mb-6">
                {selectedUserDetail.email && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <Mail className="w-4 h-4 text-blue-500" />
                    <span className="text-sm dark:text-white">{selectedUserDetail.email}</span>
                  </div>
                )}
                {selectedUserDetail.phone && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <Phone className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm dark:text-white">{selectedUserDetail.phone}</span>
                  </div>
                )}
                {selectedUserDetail.created_at && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    <span className="text-sm dark:text-white">Joined: {formatDate(selectedUserDetail.created_at)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <Key className="w-4 h-4 text-amber-500" />
                  <span className="text-sm dark:text-white">User ID: {selectedUserDetail.user_id}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowDetailModal(false);
                  openEditModal(selectedUserDetail);
                }}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 hover:scale-105 font-medium flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium"
              >
                Close
              </button>
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
                <Shield className="w-5 h-5 text-indigo-600 animate-bounce" />
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setEditingUser(null);
                  resetForm();
                }} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-300 hover:rotate-90"
                disabled={submitting}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div className="group">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => {
                      setFormData({...formData, username: e.target.value});
                      if (fieldErrors.username) {
                        setFieldErrors(prev => ({...prev, username: ''}));
                      }
                    }}
                    className={`w-full px-3 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 ${
                      fieldErrors.username 
                        ? 'border-red-500 dark:border-red-500' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    } dark:bg-gray-700 dark:text-white`}
                    placeholder="Enter username"
                    disabled={submitting}
                  />
                  {fieldErrors.username && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors.username}
                    </p>
                  )}
                </div>

                <div className="group">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                    <User className="w-4 h-4" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.fullname}
                    onChange={(e) => setFormData({...formData, fullname: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 hover:border-indigo-300"
                    placeholder="Enter full name"
                    disabled={submitting}
                  />
                </div>

                <div className="group">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                    <Lock className="w-4 h-4" />
                    {editingUser ? 'Password (leave blank to keep current)' : 'Password *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!editingUser}
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({...formData, password: e.target.value});
                        if (fieldErrors.password) {
                          setFieldErrors(prev => ({...prev, password: ''}));
                        }
                      }}
                      className={`w-full px-3 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 ${
                        fieldErrors.password 
                          ? 'border-red-500 dark:border-red-500' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                      } dark:bg-gray-700 dark:text-white pr-10`}
                      placeholder={editingUser ? 'Leave blank to keep current' : 'Enter password (min 4 chars)'}
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-300"
                    >
                      {showPassword ? <X className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="group">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({...formData, email: e.target.value});
                        if (fieldErrors.email) {
                          setFieldErrors(prev => ({...prev, email: ''}));
                        }
                      }}
                      className={`w-full px-3 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 ${
                        fieldErrors.email 
                          ? 'border-red-500 dark:border-red-500' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                      } dark:bg-gray-700 dark:text-white`}
                      placeholder="Enter email"
                      disabled={submitting}
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>
                  <div className="group">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({...formData, phone: e.target.value});
                        if (fieldErrors.phone) {
                          setFieldErrors(prev => ({...prev, phone: ''}));
                        }
                      }}
                      className={`w-full px-3 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 ${
                        fieldErrors.phone 
                          ? 'border-red-500 dark:border-red-500' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                      } dark:bg-gray-700 dark:text-white`}
                      placeholder="Enter phone"
                      disabled={submitting}
                    />
                    {fieldErrors.phone && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {fieldErrors.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="group">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      Role
                    </label>
                    <select
                      value={formData.role_id}
                      onChange={(e) => setFormData({...formData, role_id: e.target.value})}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 hover:border-indigo-300"
                      disabled={submitting}
                    >
                      <option value="1">Admin</option>
                      <option value="2">Cashier</option>
                      <option value="3">Viewer</option>
                    </select>
                  </div>
                  <div className="group">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                      <UserCheck className="w-4 h-4" />
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 hover:border-indigo-300"
                      disabled={submitting}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    resetForm();
                  }} 
                  className="px-6 py-2.5 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 dark:text-white font-medium disabled:opacity-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={submitting || isSubmittingRef}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingUser ? 'Update User' : 'Create User'}
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

export default Users;