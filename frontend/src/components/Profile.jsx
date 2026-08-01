// frontend/src/components/Profile.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  User, Mail, Phone, MapPin, Calendar, Edit2, Save,
  X, Camera, UserCircle, Shield, Clock, CheckCircle,
  AlertCircle, Loader2, Key, Lock, Unlock,
  Building2, Globe, Award, Star, TrendingUp,
  ShoppingCart, DollarSign, Users, Activity,
  Sparkles, Zap, Heart, Briefcase, Upload,
  Image as ImageIcon, Trash2, Settings, LogOut,
  HelpCircle, Bell, Moon, Sun, Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/profile.css';
import apiClient from '../api/client';

// ============================================
// PROFILE COMPONENT
// ============================================
const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  
  // ===== STATE =====
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [avatarColor, setAvatarColor] = useState('bg-indigo-500');
  const [showSuccess, setShowSuccess] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem('theme') === 'dark' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // ===== PROFILE STATE =====
  const [profile, setProfile] = useState({
    username: '',
    email: '',
    fullname: '',
    phone: '',
    address: '',
    role: '',
    status: '',
    joinedDate: '',
    lastLogin: '',
    bio: '',
    website: '',
    department: '',
    avatar: null,
    user_id: null,
    preferences: {
      theme: 'light',
      notifications: true,
      language: 'en'
    }
  });

  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    website: '',
    department: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // ===== STATS =====
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    completionRate: 0,
    pendingOrders: 0,
    lowStockItems: 0,
    activeUsers: 0
  });

  // ===== ACTIVITY LOG =====
  const [activities, setActivities] = useState([]);
  const [showActivityLog, setShowActivityLog] = useState(false);

  // ===== REFS =====
  const fileInputRef = useRef(null);
  const messageTimeout = useRef(null);
  const isMounted = useRef(true);

  // ===== AVATAR COLORS =====
  const avatarColors = [
    'bg-gradient-to-br from-red-500 to-rose-500',
    'bg-gradient-to-br from-orange-500 to-amber-500',
    'bg-gradient-to-br from-yellow-500 to-amber-500',
    'bg-gradient-to-br from-green-500 to-emerald-500',
    'bg-gradient-to-br from-teal-500 to-cyan-500',
    'bg-gradient-to-br from-blue-500 to-indigo-500',
    'bg-gradient-to-br from-indigo-500 to-purple-500',
    'bg-gradient-to-br from-purple-500 to-pink-500',
    'bg-gradient-to-br from-pink-500 to-rose-500',
    'bg-gradient-to-br from-rose-500 to-red-500'
  ];

  // ===== SHOW MESSAGE =====
  const showMessage = useCallback((text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setShowSuccess(type === 'success');
    if (messageTimeout.current) clearTimeout(messageTimeout.current);
    messageTimeout.current = setTimeout(() => {
      setMessage('');
      setShowSuccess(false);
    }, 5000);
  }, []);

  // ===== GENERATE AVATAR COLOR =====
  const getAvatarColor = useCallback((name) => {
    if (!name) return avatarColors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  }, []);

  // ===== SAVE AVATAR TO STORAGE =====
  const saveAvatarToStorage = useCallback((imageData) => {
    try {
      localStorage.setItem('userAvatar', imageData);
      setAvatarPreview(imageData);
      // Update user context
      if (updateUser) {
        updateUser({ avatar: imageData });
      }
      showMessage('✅ Avatar updated successfully!', 'success');
    } catch (error) {
      console.error('Error saving avatar:', error);
      showMessage('❌ Failed to save avatar', 'error');
    }
  }, [updateUser, showMessage]);

  // ===== LOAD AVATAR FROM STORAGE =====
  const loadAvatarFromStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem('userAvatar');
      if (saved) {
        setAvatarPreview(saved);
      }
    } catch (error) {
      console.error('Error loading avatar:', error);
    }
  }, []);

  // ===== HANDLE AVATAR UPLOAD =====
  const handleAvatarUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showMessage('❌ Please select an image file', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showMessage('❌ Image size should be less than 2MB', 'error');
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target.result;
      saveAvatarToStorage(imageData);
      setIsUploading(false);
    };
    reader.onerror = () => {
      showMessage('❌ Failed to read image file', 'error');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [saveAvatarToStorage, showMessage]);

  // ===== REMOVE AVATAR =====
  const removeAvatar = useCallback(() => {
    if (window.confirm('Are you sure you want to remove your avatar?')) {
      localStorage.removeItem('userAvatar');
      setAvatarPreview(null);
      if (updateUser) {
        updateUser({ avatar: null });
      }
      showMessage('🗑️ Avatar removed', 'info');
    }
  }, [updateUser, showMessage]);

  // ===== EXTRACT DATA HELPER =====
  const extractData = useCallback((responseData) => {
    if (typeof responseData === 'string' && responseData.includes('<!DOCTYPE html>')) {
      console.warn('⚠️ Received HTML - API not available');
      return [];
    }
    
    if (Array.isArray(responseData)) return responseData;
    
    if (responseData && typeof responseData === 'object') {
      if (Array.isArray(responseData.data)) return responseData.data;
      if (Array.isArray(responseData.items)) return responseData.items;
      if (Array.isArray(responseData.orders)) return responseData.orders;
      if (Array.isArray(responseData.customers)) return responseData.customers;
      if (responseData.data && typeof responseData.data === 'object') {
        if (Array.isArray(responseData.data.items)) return responseData.data.items;
        if (Array.isArray(responseData.data.orders)) return responseData.data.orders;
        if (Array.isArray(responseData.data.customers)) return responseData.data.customers;
        const values = Object.values(responseData.data);
        if (values.length > 0 && Array.isArray(values[0])) return values[0];
      }
    }
    return [];
  }, []);

  // ===== FETCH USER STATS =====
  const fetchUserStats = useCallback(async () => {
    try {
      const [ordersRes, customersRes, statsRes, lowStockRes] = await Promise.all([
        apiClient.get('/orders').catch(() => ({ data: [] })),
        apiClient.get('/customers').catch(() => ({ data: [] })),
        apiClient.get('/dashboard/stats').catch(() => ({ data: {} })),
        apiClient.get('/stock/low-stock').catch(() => ({ data: [] }))
      ]);

      const orders = extractData(ordersRes.data);
      const customers = extractData(customersRes.data);
      const lowStock = extractData(lowStockRes.data);
      
      const totalOrders = Array.isArray(orders) ? orders.length : 0;
      const totalCustomers = Array.isArray(customers) ? customers.length : 0;
      const lowStockItems = Array.isArray(lowStock) ? lowStock.length : 0;
      
      let totalRevenue = 0;
      let statsData = statsRes.data;
      if (statsData && typeof statsData === 'object') {
        totalRevenue = statsData.totalRevenue || statsData.total_revenue || statsData.revenue || 0;
      }
      
      let completedOrders = 0;
      let pendingOrders = 0;
      if (Array.isArray(orders)) {
        orders.forEach(o => {
          const status = o.STATUS || o.status || '';
          if (status === 'Completed' || status === 'COMPLETED' || status === 'Complete') {
            completedOrders++;
          } else if (status === 'Pending' || status === 'PENDING' || status === 'pending') {
            pendingOrders++;
          }
        });
      }
      
      const completionRate = totalOrders > 0 
        ? Math.round((completedOrders / totalOrders) * 100) 
        : 0;

      // Activity log
      const newActivities = [];
      if (totalOrders > 0) {
        newActivities.push({
          id: Date.now(),
          type: 'order',
          message: `You have ${totalOrders} total orders`,
          time: new Date().toISOString(),
          icon: ShoppingCart
        });
      }
      if (lowStockItems > 0) {
        newActivities.push({
          id: Date.now() + 1,
          type: 'alert',
          message: `${lowStockItems} products are low on stock`,
          time: new Date().toISOString(),
          icon: AlertCircle
        });
      }
      if (pendingOrders > 0) {
        newActivities.push({
          id: Date.now() + 2,
          type: 'pending',
          message: `${pendingOrders} orders are pending processing`,
          time: new Date().toISOString(),
          icon: Clock
        });
      }

      if (isMounted.current) {
        setStats({
          totalOrders,
          totalCustomers,
          totalRevenue,
          completionRate,
          pendingOrders,
          lowStockItems,
          activeUsers: Math.floor(totalCustomers * 0.15) || 5
        });
        if (newActivities.length > 0) {
          setActivities(prev => [...newActivities, ...prev.slice(0, 5)]);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching user stats:', error);
      if (isMounted.current) {
        setStats({
          totalOrders: 0,
          totalCustomers: 0,
          totalRevenue: 0,
          completionRate: 0,
          pendingOrders: 0,
          lowStockItems: 0,
          activeUsers: 0
        });
      }
    }
  }, [extractData]);

  // ===== FETCH PROFILE =====
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      // First try to get from Auth context
      if (user) {
        const userData = {
          username: user.username || user.USERNAME || 'Unknown',
          email: user.email || user.E_MAIL || 'user@example.com',
          fullname: user.fullname || user.FULLNAME || user.username || 'User',
          phone: user.phone || user.PHONE || '',
          address: user.address || user.ADDRESS || '',
          role: user.role || user.ROLE || user.role_name || 'User',
          status: user.status || user.STATUS || 'Active',
          joinedDate: user.joinedDate || user.JOINED_DATE || new Date().toISOString(),
          lastLogin: user.lastLogin || user.LAST_LOGIN || new Date().toISOString(),
          bio: user.bio || user.BIO || '',
          website: user.website || user.WEBSITE || '',
          department: user.department || user.DEPARTMENT || '',
          avatar: user.avatar || null,
          user_id: user.id || user.USER_ID || user.ID || null,
          preferences: user.preferences || { theme: 'light', notifications: true, language: 'en' }
        };
        
        setProfile(userData);
        
        const color = getAvatarColor(userData.fullname || userData.username);
        setAvatarColor(color);
        
        setFormData({
          fullname: userData.fullname,
          email: userData.email,
          phone: userData.phone,
          address: userData.address,
          bio: userData.bio,
          website: userData.website,
          department: userData.department
        });

        // Check theme preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
          setIsDarkMode(savedTheme === 'dark');
        } else if (userData.preferences?.theme) {
          setIsDarkMode(userData.preferences.theme === 'dark');
        }
      }

      loadAvatarFromStorage();
      await fetchUserStats();
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (isMounted.current) {
        setProfile(prev => ({
          ...prev,
          username: user?.username || 'Unknown',
          fullname: user?.fullname || user?.username || 'User',
          role: user?.role || user?.role_name || 'User',
          status: user?.status || 'Active'
        }));
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [user, getAvatarColor, loadAvatarFromStorage, fetchUserStats]);

  // ===== HANDLE UPDATE PROFILE =====
  const handleUpdateProfile = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updateData = {
        FULLNAME: formData.fullname,
        E_MAIL: formData.email,
        PHONE: formData.phone,
        ADDRESS: formData.address,
        BIO: formData.bio,
        WEBSITE: formData.website,
        DEPARTMENT: formData.department
      };

      const userId = profile.user_id;
      if (userId) {
        await apiClient.put(`/users/${userId}`, updateData);
      }

      // Update Auth context
      if (updateUser) {
        updateUser({
          fullname: formData.fullname,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          bio: formData.bio,
          website: formData.website,
          department: formData.department
        });
      }

      // Save to localStorage
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({
        ...storedUser,
        ...updateData
      }));

      setProfile(prev => ({
        ...prev,
        fullname: formData.fullname,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        bio: formData.bio,
        website: formData.website,
        department: formData.department
      }));
      
      setAvatarColor(getAvatarColor(formData.fullname || profile.username));
      setIsEditing(false);
      showMessage('✅ Profile updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showMessage(`❌ ${error.response?.data?.error || 'Failed to update profile'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, profile.user_id, profile.username, updateUser, getAvatarColor, showMessage]);

  // ===== HANDLE CHANGE PASSWORD =====
  const handleChangePassword = useCallback(async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showMessage('❌ Passwords do not match', 'error');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      showMessage('❌ Password must be at least 6 characters', 'error');
      return;
    }

    setLoading(true);
    try {
      const userId = profile.user_id;
      if (userId) {
        await apiClient.put(`/users/${userId}/password`, {
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        });
      }
      
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
      showMessage('✅ Password changed successfully!', 'success');
    } catch (error) {
      console.error('Error changing password:', error);
      showMessage(`❌ ${error.response?.data?.error || 'Failed to change password'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [passwordData, profile.user_id, showMessage]);

  // ===== TOGGLE THEME =====
  const toggleTheme = useCallback(() => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newTheme);
    
    if (updateUser) {
      updateUser({ preferences: { ...profile.preferences, theme: newTheme ? 'dark' : 'light' } });
    }
    
    showMessage(`🌓 ${newTheme ? 'Dark' : 'Light'} mode enabled`, 'info');
  }, [isDarkMode, updateUser, profile.preferences, showMessage]);

  // ===== HANDLE LOGOUT =====
  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  // ===== FORMAT DATE =====
  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date)) return 'N/A';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }, []);

  // ===== GET INITIALS =====
  const getInitials = useCallback((name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }, []);

  // ===== INIT =====
  useEffect(() => {
    isMounted.current = true;
    fetchProfile();

    // Apply theme
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    return () => {
      isMounted.current = false;
      if (messageTimeout.current) clearTimeout(messageTimeout.current);
    };
  }, [fetchProfile, isDarkMode]);

  // ===== STAT CARD =====
  const StatCard = ({ icon: Icon, label, value, color, bgColor, delay = 0 }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="stat-card"
      onClick={() => {
        if (label === 'Total Orders') navigate('/orders');
        if (label === 'Customers Served') navigate('/customers');
        if (label === 'Revenue Generated') navigate('/reports');
        if (label === 'Pending Orders') navigate('/orders?status=pending');
        if (label === 'Low Stock Items') navigate('/stock');
      }}
    >
      <div className="stat-card-content">
        <motion.div 
          whileHover={{ rotate: 12, scale: 1.1 }}
          className={`stat-card-icon ${bgColor}`}
        >
          <Icon className={`stat-card-icon-svg ${color}`} />
        </motion.div>
        <div>
          <p className="stat-card-label">{label}</p>
          <p className="stat-card-value">{value}</p>
        </div>
      </div>
    </motion.div>
  );

  // ===== ACTIVITY ITEM =====
  const ActivityItem = ({ activity }) => {
    const Icon = activity.icon;
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="activity-item"
      >
        <div className="activity-icon-wrapper">
          <Icon className="activity-icon" />
        </div>
        <div className="activity-content">
          <p className="activity-message">{activity.message}</p>
          <p className="activity-time">{formatDate(activity.time)}</p>
        </div>
      </motion.div>
    );
  };

  // ===== LOADING =====
  if (loading && !profile.username) {
    return (
      <div className="profile-loading">
        <div className="profile-loading-spinner">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="profile-loading-ring"
          >
            <div className="profile-loading-ring-inner" />
            <div className="profile-loading-ring-pulse" />
          </motion.div>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="profile-loading-text"
        >
          Loading your profile...
        </motion.p>
        <div className="profile-loading-dots">
          <span className="profile-loading-dot" style={{ animationDelay: '0s' }} />
          <span className="profile-loading-dot" style={{ animationDelay: '0.2s' }} />
          <span className="profile-loading-dot" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  // ===== RENDER =====
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="profile-container"
    >
      
      {/* ===== MESSAGE TOAST ===== */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, x: 100, y: -20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className={`toast-message toast-${messageType}`}
          >
            <div className="toast-content">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="toast-icon"
              >
                {messageType === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {messageType === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                {messageType === 'info' && <CheckCircle className="w-5 h-5 text-blue-500" />}
              </motion.div>
              <div className="toast-text">{message}</div>
              <button 
                onClick={() => setMessage('')} 
                className="toast-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== HEADER ===== */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="profile-header"
      >
        <div className="profile-header-bg">
          <div className="profile-header-bg-circle" />
          <div className="profile-header-bg-circle2" />
          <div className="profile-header-bg-circle3" />
          <div className="profile-header-bg-icon1">✦</div>
          <div className="profile-header-bg-icon2">◈</div>
        </div>
        
        <div className="profile-header-content">
          <div>
            <motion.h1 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="profile-header-title"
            >
              <UserCircle className="profile-header-icon" />
              My Profile
            </motion.h1>
            <motion.p 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="profile-header-subtitle"
            >
              Manage your personal information and account settings
            </motion.p>
          </div>
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="profile-header-actions"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="profile-header-btn-theme"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </motion.button>
            {!isEditing ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditing(true)}
                className="profile-header-btn"
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    fullname: profile.fullname,
                    email: profile.email,
                    phone: profile.phone,
                    address: profile.address,
                    bio: profile.bio,
                    website: profile.website,
                    department: profile.department
                  });
                }}
                className="profile-header-btn-cancel"
              >
                <X className="w-4 h-4" />
                Cancel
              </motion.button>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* ===== PROFILE STATS ===== */}
      <div className="profile-stats">
        <StatCard 
          icon={ShoppingCart} 
          label="Total Orders" 
          value={stats.totalOrders}
          color="text-purple-500"
          bgColor="bg-purple-50 dark:bg-purple-900/20"
          delay={0.1}
        />
        <StatCard 
          icon={Users} 
          label="Customers Served" 
          value={stats.totalCustomers}
          color="text-blue-500"
          bgColor="bg-blue-50 dark:bg-blue-900/20"
          delay={0.2}
        />
        <StatCard 
          icon={DollarSign} 
          label="Revenue Generated" 
          value={`$${stats.totalRevenue.toFixed(2)}`}
          color="text-emerald-500"
          bgColor="bg-emerald-50 dark:bg-emerald-900/20"
          delay={0.3}
        />
        <StatCard 
          icon={Award} 
          label="Completion Rate" 
          value={`${stats.completionRate}%`}
          color="text-amber-500"
          bgColor="bg-amber-50 dark:bg-amber-900/20"
          delay={0.4}
        />
        <StatCard 
          icon={Clock} 
          label="Pending Orders" 
          value={stats.pendingOrders}
          color="text-orange-500"
          bgColor="bg-orange-50 dark:bg-orange-900/20"
          delay={0.5}
        />
        <StatCard 
          icon={AlertCircle} 
          label="Low Stock Items" 
          value={stats.lowStockItems}
          color="text-red-500"
          bgColor="bg-red-50 dark:bg-red-900/20"
          delay={0.6}
        />
      </div>

      {/* ===== PROFILE CARD ===== */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="profile-card"
      >
        <div className="profile-card-body">
          <div className="profile-card-avatar-section">
            {/* Avatar with Upload */}
            <div className="profile-avatar-wrapper">
              <motion.div 
                className={`profile-avatar ${avatarPreview ? '' : (avatarColor || 'bg-indigo-500')}`}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {avatarPreview ? (
                  <img 
                    src={avatarPreview} 
                    alt="Profile" 
                    className="profile-avatar-img"
                  />
                ) : (
                  getInitials(profile.fullname || profile.username)
                )}
              </motion.div>
              
              {/* Upload Button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => fileInputRef.current?.click()}
                className="profile-avatar-upload-btn"
                title="Change avatar"
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </motion.button>

              {/* Remove Avatar Button */}
              {avatarPreview && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={removeAvatar}
                  className="profile-avatar-remove-btn"
                  title="Remove avatar"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="profile-avatar-input"
                onChange={handleAvatarUpload}
                disabled={isUploading}
              />
            </div>

            {/* User Info */}
            <div className="profile-user-info">
              <div className="profile-user-header">
                <motion.h2 
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="profile-user-name"
                >
                  {profile.fullname || profile.username}
                </motion.h2>
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
                  className={`profile-user-status ${profile.status === 'Active' ? 'profile-user-status-active' : 'profile-user-status-inactive'}`}
                >
                  {profile.status || 'Active'}
                </motion.span>
              </div>
              <div className="profile-user-meta">
                <span className="profile-user-username">@{profile.username}</span>
                <span className="profile-user-divider" />
                <span className="profile-user-role">
                  <Shield className="profile-user-role-icon" />
                  {profile.role}
                </span>
              </div>
              <div className="profile-user-dates">
                <span className="profile-user-date">
                  <Calendar className="profile-user-date-icon" />
                  Joined: {formatDate(profile.joinedDate)}
                </span>
                <span className="profile-user-date">
                  <Clock className="profile-user-date-icon" />
                  Last login: {formatDate(profile.lastLogin)}
                </span>
              </div>

              {isUploading && (
                <div className="profile-uploading-status">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== DETAILS ===== */}
        <motion.div 
          className="profile-details"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {isEditing ? (
            // ===== EDIT FORM =====
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleUpdateProfile}
              className="profile-form"
            >
              <div className="profile-form-grid">
                <div className="profile-form-field">
                  <label className="profile-form-label">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.fullname}
                    onChange={(e) => setFormData({...formData, fullname: e.target.value})}
                    className="profile-form-input"
                    placeholder="Full name"
                    disabled={loading}
                  />
                </div>
                <div className="profile-form-field">
                  <label className="profile-form-label">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="profile-form-input"
                    placeholder="Email address"
                    disabled={loading}
                  />
                </div>
                <div className="profile-form-field">
                  <label className="profile-form-label">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="profile-form-input"
                    placeholder="Phone number"
                    disabled={loading}
                  />
                </div>
                <div className="profile-form-field">
                  <label className="profile-form-label">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="profile-form-input"
                    placeholder="Department"
                    disabled={loading}
                  />
                </div>
                <div className="profile-form-field-full">
                  <label className="profile-form-label">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="profile-form-input"
                    placeholder="Address"
                    disabled={loading}
                  />
                </div>
                <div className="profile-form-field-full">
                  <label className="profile-form-label">
                    Bio
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    rows="3"
                    className="profile-form-textarea"
                    placeholder="Tell us about yourself..."
                    disabled={loading}
                  />
                </div>
                <div className="profile-form-field">
                  <label className="profile-form-label">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    className="profile-form-input"
                    placeholder="Website URL"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="profile-form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      fullname: profile.fullname,
                      email: profile.email,
                      phone: profile.phone,
                      address: profile.address,
                      bio: profile.bio,
                      website: profile.website,
                      department: profile.department
                    });
                  }}
                  className="profile-form-btn-cancel"
                  disabled={loading}
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="profile-form-btn-submit"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {loading ? 'Saving...' : 'Save Changes'}
                </motion.button>
              </div>
            </motion.form>
          ) : (
            // ===== VIEW MODE =====
            <motion.div 
              className="profile-view-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="profile-view-item">
                <p className="profile-view-label">Full Name</p>
                <p className="profile-view-value">{profile.fullname || '-'}</p>
              </div>
              <div className="profile-view-item">
                <p className="profile-view-label">Username</p>
                <p className="profile-view-value">@{profile.username}</p>
              </div>
              <div className="profile-view-item">
                <p className="profile-view-label">Email</p>
                <p className="profile-view-value">{profile.email || '-'}</p>
              </div>
              <div className="profile-view-item">
                <p className="profile-view-label">Phone</p>
                <p className="profile-view-value">{profile.phone || '-'}</p>
              </div>
              <div className="profile-view-item">
                <p className="profile-view-label">Department</p>
                <p className="profile-view-value">{profile.department || '-'}</p>
              </div>
              <div className="profile-view-item">
                <p className="profile-view-label">Role</p>
                <p className="profile-view-value">{profile.role}</p>
              </div>
              <div className="profile-view-item-full">
                <p className="profile-view-label">Address</p>
                <p className="profile-view-value">{profile.address || '-'}</p>
              </div>
              <div className="profile-view-item-full">
                <p className="profile-view-label">Bio</p>
                <p className="profile-view-value">{profile.bio || 'No bio yet'}</p>
              </div>
              {profile.website && (
                <div className="profile-view-item-full">
                  <p className="profile-view-label">Website</p>
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="profile-view-link">
                    {profile.website}
                  </a>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* ===== CHANGE PASSWORD ===== */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="profile-password-card"
      >
        <div className="profile-password-content">
          <div className="profile-password-header">
            <div>
              <h3 className="profile-password-title">
                <Lock className="profile-password-title-icon" />
                Password & Security
              </h3>
              <p className="profile-password-subtitle">Update your password to keep your account secure</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="profile-password-toggle-btn"
            >
              {showPasswordForm ? 'Cancel' : 'Change Password'}
            </motion.button>
          </div>

          <AnimatePresence>
            {showPasswordForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleChangePassword}
                className="profile-password-form"
              >
                <div className="profile-password-form-grid">
                  <div className="profile-password-form-field">
                    <label className="profile-form-label">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                      className="profile-form-input"
                      placeholder="Enter current password"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="profile-password-form-field">
                    <label className="profile-form-label">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      className="profile-form-input"
                      placeholder="Enter new password (min 6 chars)"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="profile-password-form-field-full">
                    <label className="profile-form-label">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      className="profile-form-input"
                      placeholder="Confirm new password"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="profile-password-form-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    }}
                    className="profile-form-btn-cancel"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="profile-form-btn-submit"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {loading ? 'Updating...' : 'Update Password'}
                  </motion.button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ===== ACTIVITY LOG ===== */}
      {activities.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="profile-activity-card"
        >
          <div className="profile-activity-header">
            <div>
              <h3 className="profile-activity-title">
                <Activity className="profile-activity-title-icon" />
                Recent Activity
              </h3>
              <p className="profile-activity-subtitle">Your latest actions and notifications</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowActivityLog(!showActivityLog)}
              className="profile-activity-toggle"
            >
              {showActivityLog ? 'Hide' : 'View All'}
            </motion.button>
          </div>

          <div className="profile-activity-list">
            {activities.slice(0, showActivityLog ? activities.length : 3).map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </motion.div>
      )}

      {/* ===== QUICK ACTIONS ===== */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="profile-quick-actions"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/settings')}
          className="profile-quick-action"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/help')}
          className="profile-quick-action"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Help</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
          className="profile-quick-action profile-quick-action-danger"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default Profile;