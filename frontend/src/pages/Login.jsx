// frontend/src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, Shield,
  AlertCircle, Clock, RefreshCw
} from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login, isLocked, lockRemaining, user } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ===== REDIRECT IF ALREADY LOGGED IN =====
  useEffect(() => {
    if (user) {
      if (user.isSuperAdmin) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  // ===== HANDLE SUBMIT =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (isLocked) {
      toast.error('⛔ Account is locked. Please wait.');
      return;
    }
    
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Please enter both username and password');
      toast.error('Please enter both username and password');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('📤 Attempting login with:', formData.username);
      
      const result = await login(formData.username, formData.password);
      
      console.log('📤 Login result:', result);
      
      if (result.success) {
        toast.success('Welcome back! 🎉');
        // Redirect handled by useEffect
      } else {
        const errorMsg = result.error || 'Login failed';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMsg = error.message || 'Network error. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ===== HANDLE INPUT CHANGE =====
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/10">
            <Shield className="w-8 h-8 text-indigo-400" />
            <span className="text-2xl font-bold text-white">SPMS</span>
          </div>
          <h2 className="text-white text-xl font-semibold mt-4">Welcome Back</h2>
          <p className="text-indigo-200 text-sm">Sign in to your account to continue</p>
        </div>

        {isLocked && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Account Temporarily Locked</p>
              <p className="text-sm opacity-90">
                Please wait <strong>{Math.ceil(lockRemaining / 60000)} minutes</strong> before trying again.
              </p>
            </div>
          </div>
        )}

        {error && !isLocked && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 flex items-center gap-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                Username
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-300" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  disabled={loading || isLocked}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-300" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  disabled={loading || isLocked}
                  className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-indigo-300 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-indigo-200">
                <input type="checkbox" className="rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-400" />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm text-indigo-300 hover:text-indigo-200 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || isLocked}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : isLocked ? (
                <>
                  <Clock className="w-5 h-5" />
                  Locked
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-center text-sm text-indigo-200">
              Don't have an account?{' '}
              <Link to="/register" className="text-white font-medium hover:underline">
                Create one
              </Link>
            </p>
          </form>
        </div>

        <p className="text-center text-xs text-indigo-300/50 mt-6">
          Protected by bank-grade encryption 🔒
        </p>
      </div>
    </div>
  );
};

export default Login;