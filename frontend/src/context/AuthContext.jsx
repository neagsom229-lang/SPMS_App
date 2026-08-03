// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { toast } from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);

  // ===== LOAD USER FROM LOCAL STORAGE =====
  useEffect(() => {
    const loadUser = () => {
      try {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        const tenantData = localStorage.getItem('tenant');
        
        console.log('🔍 Loading user...');
        console.log('📦 Token found:', token ? '✅ Yes' : '❌ No');
        console.log('📦 User found:', userData ? '✅ Yes' : '❌ No');
        console.log('📦 Tenant found:', tenantData ? '✅ Yes' : '❌ No');
        
        if (token && userData) {
          const parsedUser = JSON.parse(userData);
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          setUser(parsedUser);
          setIsSuperAdmin(parsedUser.isSuperAdmin || false);
          
          // ✅ Load tenant
          if (tenantData) {
            setTenant(JSON.parse(tenantData));
          } else if (parsedUser.tenant) {
            setTenant(parsedUser.tenant);
            localStorage.setItem('tenant', JSON.stringify(parsedUser.tenant));
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('tenant');
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, []);

  // ===== LOGIN =====
  const login = useCallback(async (username, password) => {
    if (isLocked) {
      toast.error(`⛔ Account locked. Please wait ${Math.ceil(lockRemaining / 60000)} minutes.`);
      return { success: false, error: 'Account locked' };
    }

    try {
      console.log('📤 Logging in...', username);
      console.log('📤 API URL:', apiClient.defaults.baseURL);
      
      const response = await apiClient.post('/auth/login', {
        username,
        password
      }, {
        timeout: 60000 // 60 seconds timeout
      });

      console.log('✅ Login response:', response.data);

      const { token, user: userData } = response.data;

      if (!token || !userData) {
        throw new Error('Invalid response from server');
      }

      // ✅ Store token
      localStorage.setItem('token', token);
      
      // ✅ Store user
      localStorage.setItem('user', JSON.stringify(userData));
      
      // ✅ Store tenant separately
      if (userData.tenant) {
        localStorage.setItem('tenant', JSON.stringify(userData.tenant));
        setTenant(userData.tenant);
      } else {
        // Super admin has no tenant
        localStorage.setItem('tenant', JSON.stringify({ id: null, isSuperAdmin: true }));
        setTenant(null);
      }
      
      // ✅ Set authorization header
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // ✅ Reset login attempts
      setLoginAttempts(0);
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('loginLockUntil');
      setIsLocked(false);
      setLockRemaining(0);
      
      // ✅ Set user state
      setUser(userData);
      setIsSuperAdmin(userData.isSuperAdmin || false);
      
      toast.success(`👋 Welcome back, ${userData.fullname || userData.username}!`);
      
      return { success: true, user: userData };
      
    } catch (error) {
      console.error('❌ Login error:', error);
      
      // ✅ Check if it's a timeout error
      if (error.isTimeout || error.message?.includes('timeout')) {
        toast.error('⏱️ Server is waking up. Please wait a moment and try again.');
        return { 
          success: false, 
          error: 'Server is starting up. Please try again in a few seconds.',
          isTimeout: true
        };
      }
      
      // ✅ Get error message
      const errorMessage = error.data?.error || error.response?.data?.error || error.message || 'Login failed';
      
      // ✅ Increment login attempts
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      localStorage.setItem('loginAttempts', String(newAttempts));
      
      // ✅ Lock after 5 attempts
      if (newAttempts >= 5) {
        setIsLocked(true);
        const lockDuration = 15 * 60 * 1000;
        setLockRemaining(lockDuration);
        localStorage.setItem('loginLockUntil', String(Date.now() + lockDuration));
        toast.error('⛔ Too many failed attempts. Account locked for 15 minutes.');
      } else {
        toast.error(`❌ ${errorMessage}`);
      }
      
      return { 
        success: false, 
        error: errorMessage,
        status: error.status || error.response?.status
      };
    }
  }, [isLocked, loginAttempts, lockRemaining]);

  // ===== LOGOUT =====
  const logout = useCallback(() => {
    console.log('📤 Logging out...');
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    localStorage.removeItem('loginAttempts');
    localStorage.removeItem('loginLockUntil');
    
    delete apiClient.defaults.headers.common['Authorization'];
    
    setUser(null);
    setTenant(null);
    setIsSuperAdmin(false);
    setLoginAttempts(0);
    setIsLocked(false);
    setLockRemaining(0);
    
    toast.success('👋 Logged out successfully');
  }, []);

  // ===== CHECK IF AUTHENTICATED =====
  const isAuthenticated = useCallback(() => {
    const token = localStorage.getItem('token');
    return !!token && !!user;
  }, [user]);

  // ===== GET USER ROLE =====
  const getUserRole = useCallback(() => {
    if (isSuperAdmin) return 'superadmin';
    if (user?.role) return user.role.toLowerCase();
    return 'user';
  }, [isSuperAdmin, user]);

  // ===== GET TENANT ID =====
  const getTenantId = useCallback(() => {
    return tenant?.id || user?.tenant?.id || null;
  }, [tenant, user]);

  // ===== GET TENANT NAME =====
  const getTenantName = useCallback(() => {
    return tenant?.name || user?.tenant?.name || 'My Business';
  }, [tenant, user]);

  // ===== GET SUBDOMAIN =====
  const getSubdomain = useCallback(() => {
    return tenant?.subdomain || user?.tenant?.subdomain || '';
  }, [tenant, user]);

  const value = {
    user,
    setUser,
    tenant,
    setTenant,
    loading,
    login,
    logout,
    isSuperAdmin,
    loginAttempts,
    isLocked,
    lockRemaining,
    isAuthenticated,
    getUserRole,
    getTenantId,
    getTenantName,
    getSubdomain,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;