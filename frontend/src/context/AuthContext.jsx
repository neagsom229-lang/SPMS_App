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
  const [loading, setLoading] = useState(true);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(null);
  const [lockRemaining, setLockRemaining] = useState(0);

  // ===== LOAD USER FROM LOCAL STORAGE =====
  useEffect(() => {
    const loadUser = () => {
      try {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        console.log('🔍 Loading user...');
        console.log('📦 Token found:', token ? '✅ Yes' : '❌ No');
        console.log('📦 User found:', userData ? '✅ Yes' : '❌ No');
        
        if (token && userData) {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          setUser(JSON.parse(userData));
        }
      } catch (error) {
        console.error('Error loading user:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
    
    // Check for lock status
    const lockUntil = localStorage.getItem('loginLockUntil');
    if (lockUntil) {
      const remaining = parseInt(lockUntil) - Date.now();
      if (remaining > 0) {
        setIsLocked(true);
        setLockRemaining(remaining);
        setLockTimer(setTimeout(() => {
          setIsLocked(false);
          localStorage.removeItem('loginLockUntil');
          localStorage.removeItem('loginAttempts');
          setLoginAttempts(0);
          setLockRemaining(0);
          toast.info('🔓 Account unlocked. You can try logging in now.');
        }, remaining));
      } else {
        localStorage.removeItem('loginLockUntil');
        localStorage.removeItem('loginAttempts');
        setLoginAttempts(0);
        setIsLocked(false);
        setLockRemaining(0);
      }
    }
    
    return () => {
      if (lockTimer) clearTimeout(lockTimer);
    };
  }, []);

  // ===== UPDATE LOCK REMAINING TIME =====
  useEffect(() => {
    if (isLocked) {
      const interval = setInterval(() => {
        const lockUntil = localStorage.getItem('loginLockUntil');
        if (lockUntil) {
          const remaining = parseInt(lockUntil) - Date.now();
          if (remaining > 0) {
            setLockRemaining(remaining);
          } else {
            setIsLocked(false);
            localStorage.removeItem('loginLockUntil');
            localStorage.removeItem('loginAttempts');
            setLoginAttempts(0);
            setLockRemaining(0);
            toast.info('🔓 Account unlocked. You can try logging in now.');
            clearInterval(interval);
          }
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isLocked]);

  // ===== RESET RATE LIMIT (Manual override for testing) =====
  const resetRateLimit = useCallback(async () => {
    try {
      // Clear local storage
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('loginLockUntil');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Reset state
      setLoginAttempts(0);
      setIsLocked(false);
      setLockRemaining(0);
      
      if (lockTimer) {
        clearTimeout(lockTimer);
        setLockTimer(null);
      }
      
      // Remove auth header
      delete apiClient.defaults.headers.common['Authorization'];
      setUser(null);
      
      toast.success('✅ Rate limit reset successfully');
      
      // Try to reset on server (if endpoint exists)
      try {
        await apiClient.post('/auth/reset-rate-limit');
      } catch (e) {
        // Server might not have this endpoint, that's fine
        console.log('Server rate limit reset not available');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error resetting rate limit:', error);
      toast.error('Failed to reset rate limit');
      return { success: false };
    }
  }, [lockTimer]);

  // ===== LOGIN =====
  const login = useCallback(async (username, password) => {
    // Check if locked
    if (isLocked) {
      toast.error(`⛔ Account locked. Please wait ${Math.ceil(lockRemaining / 60000)} minutes.`);
      return { success: false, error: 'Account locked' };
    }

    try {
      console.log('📤 Logging in...', username);
      
      const response = await apiClient.post('/auth/login', {
        username,
        password
      });

      console.log('✅ Login successful:', response.data);

      const { token, user: userData } = response.data;

      // Store token and user
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Set authorization header
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Reset login attempts on success
      setLoginAttempts(0);
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('loginLockUntil');
      setIsLocked(false);
      setLockRemaining(0);
      
      setUser(userData);
      toast.success(`👋 Welcome back, ${userData.username || userData.fullname || 'User'}!`);
      
      return { success: true, user: userData };
      
    } catch (error) {
      console.error('❌ Login error:', error.response?.data || error.message);
      
      // Handle rate limiting
      if (error.response?.status === 429) {
        const retryAfter = error.response?.data?.retryAfter || '15 minutes';
        const lockDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
        
        setIsLocked(true);
        setLockRemaining(lockDuration);
        localStorage.setItem('loginLockUntil', String(Date.now() + lockDuration));
        localStorage.setItem('loginAttempts', String(loginAttempts + 1));
        
        toast.error(`⛔ Too many login attempts. Please try again in ${retryAfter}`);
        
        setLockTimer(setTimeout(() => {
          setIsLocked(false);
          localStorage.removeItem('loginLockUntil');
          localStorage.removeItem('loginAttempts');
          setLoginAttempts(0);
          setLockRemaining(0);
          toast.info('🔓 Account unlocked. You can try logging in now.');
        }, lockDuration));
        
        return { 
          success: false, 
          error: 'Too many login attempts',
          retryAfter: retryAfter,
          locked: true
        };
      }
      
      // Handle other errors
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Login failed';
      toast.error(`❌ ${errorMessage}`);
      
      // Increment login attempts
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      localStorage.setItem('loginAttempts', String(newAttempts));
      
      // Lock after 5 attempts
      if (newAttempts >= 5) {
        setIsLocked(true);
        const lockDuration = 15 * 60 * 1000;
        setLockRemaining(lockDuration);
        localStorage.setItem('loginLockUntil', String(Date.now() + lockDuration));
        toast.error('⛔ Too many failed attempts. Account locked for 15 minutes.');
        
        setLockTimer(setTimeout(() => {
          setIsLocked(false);
          localStorage.removeItem('loginLockUntil');
          localStorage.removeItem('loginAttempts');
          setLoginAttempts(0);
          setLockRemaining(0);
          toast.info('🔓 Account unlocked. You can try logging in now.');
        }, lockDuration));
      }
      
      return { success: false, error: errorMessage };
    }
  }, [isLocked, loginAttempts, lockRemaining]);

  // ===== REGISTER =====
  const register = useCallback(async (userData) => {
    try {
      console.log('📤 Registering...', userData.username);
      
      const response = await apiClient.post('/auth/register', userData);
      
      console.log('✅ Registration successful:', response.data);
      
      const { token, user: newUser } = response.data;
      
      // Store token and user
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      // Set authorization header
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(newUser);
      toast.success(`🎉 Welcome, ${newUser.username || newUser.fullname || 'User'}!`);
      
      return { success: true, user: newUser };
      
    } catch (error) {
      console.error('❌ Registration error:', error.response?.data || error.message);
      
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Registration failed';
      toast.error(`❌ ${errorMessage}`);
      
      return { success: false, error: errorMessage };
    }
  }, []);

  // ===== LOGOUT =====
  const logout = useCallback(() => {
    console.log('📤 Logging out...');
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginAttempts');
    localStorage.removeItem('loginLockUntil');
    
    delete apiClient.defaults.headers.common['Authorization'];
    
    setUser(null);
    setLoginAttempts(0);
    setIsLocked(false);
    setLockRemaining(0);
    
    if (lockTimer) {
      clearTimeout(lockTimer);
      setLockTimer(null);
    }
    
    toast.success('👋 Logged out successfully');
  }, [lockTimer]);

  // ===== UPDATE USER =====
  const updateUser = useCallback((updatedData) => {
    const updatedUser = { ...user, ...updatedData };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    toast.success('✅ Profile updated successfully');
  }, [user]);

  // ===== CHECK AUTH =====
  const isAuthenticated = useCallback(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    return !!(token && userData);
  }, []);

  // ===== FORMAT LOCK TIME =====
  const formatLockTime = useCallback((ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }, []);

  const value = {
    user,
    setUser,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated,
    loginAttempts,
    isLocked,
    lockRemaining,
    resetRateLimit,
    formatLockTime
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