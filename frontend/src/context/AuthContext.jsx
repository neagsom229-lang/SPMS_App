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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);

  // ===== LOAD USER =====
  useEffect(() => {
    const loadUser = () => {
      try {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        console.log('🔍 Loading user...');
        console.log('📦 Token found:', token ? '✅ Yes' : '❌ No');
        console.log('📦 User found:', userData ? '✅ Yes' : '❌ No');
        
        if (token && userData) {
          const parsedUser = JSON.parse(userData);
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          setUser(parsedUser);
          setIsSuperAdmin(parsedUser.isSuperAdmin || false);
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
  }, []);

  // ===== LOGIN =====
 // frontend/src/context/AuthContext.jsx
const login = useCallback(async (username, password) => {
  if (isLocked) {
    toast.error(`⛔ Account locked. Please wait ${Math.ceil(lockRemaining / 60000)} minutes.`);
    return { success: false, error: 'Account locked' };
  }

  try {
    console.log('📤 Logging in...', username);
    console.log('📤 API URL:', apiClient.defaults.baseURL);
    
    // ✅ Fix: Add /api prefix
    const response = await apiClient.post('/api/auth/login', {
      username,
      password
    });

    console.log('✅ Login response:', response.data);

    const { token, user: userData } = response.data;

    if (!token || !userData) {
      throw new Error('Invalid response from server');
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    setLoginAttempts(0);
    localStorage.removeItem('loginAttempts');
    localStorage.removeItem('loginLockUntil');
    setIsLocked(false);
    setLockRemaining(0);
    
    setUser(userData);
    setIsSuperAdmin(userData.isSuperAdmin || false);
    toast.success(`👋 Welcome back, ${userData.fullname || userData.username}!`);
    
    return { success: true, user: userData };
    
  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('❌ Error response:', error.response?.data);
    console.error('❌ Error status:', error.response?.status);
    
    const errorMessage = error.response?.data?.error || error.message || 'Login failed';
    toast.error(`❌ ${errorMessage}`);
    
    return { 
      success: false, 
      error: errorMessage,
      status: error.response?.status
    };
  }
}, [isLocked, loginAttempts, lockRemaining]);

  // ===== LOGOUT =====
  const logout = useCallback(() => {
    console.log('📤 Logging out...');
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginAttempts');
    localStorage.removeItem('loginLockUntil');
    
    delete apiClient.defaults.headers.common['Authorization'];
    
    setUser(null);
    setIsSuperAdmin(false);
    setLoginAttempts(0);
    setIsLocked(false);
    setLockRemaining(0);
    
    toast.success('👋 Logged out successfully');
  }, []);

  const value = {
    user,
    setUser,
    loading,
    login,
    logout,
    isSuperAdmin,
    loginAttempts,
    isLocked,
    lockRemaining,
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