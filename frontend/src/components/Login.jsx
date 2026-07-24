import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  User, Lock, Eye, EyeOff, LogIn, Shield, Sparkles,
  Zap, CheckCircle, AlertCircle, Loader2, ArrowRight,
  Building2, Users, Package, ShoppingCart
} from 'lucide-react';

// ============================================
// API CONFIGURATION - FIXED ✅
// ============================================
const getApiBase = () => {
  const envUrl = import.meta.env?.VITE_API_URL;
  
  if (!envUrl) return '/api';
  
  // Remove trailing slash
  const cleanUrl = envUrl.replace(/\/+$/, '');
  
  // Add /api if not present
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

const API_BASE = getApiBase();

console.log('🔧 API_BASE:', API_BASE);

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor
api.interceptors.request.use(
  config => {
    console.log('📤 Login Request:', config.method?.toUpperCase(), config.url);
    console.log('📤 Full URL:', config.baseURL + config.url);
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  response => {
    console.log('📥 Login Response:', response.status);
    return response;
  },
  error => {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ No response from server. Please check your connection.');
    } else {
      console.error('❌ Request error:', error.message);
    }
    return Promise.reject(error);
  }
);

// ============================================
// LOGIN COMPONENT
// ============================================
const Login = ({ setUser }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState([]);
  const [floatingIcons, setFloatingIcons] = useState([]);
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  // ===== FLOATING ICONS =====
  const iconComponents = [
    { Icon: Users, color: 'text-blue-400/20', size: 24 },
    { Icon: Package, color: 'text-emerald-400/20', size: 28 },
    { Icon: ShoppingCart, color: 'text-purple-400/20', size: 22 },
    { Icon: Building2, color: 'text-amber-400/20', size: 26 },
    { Icon: Shield, color: 'text-indigo-400/20', size: 20 },
  ];

  // ===== PARTICLES =====
  useEffect(() => {
    const newParticles = [];
    for (let i = 0; i < 50; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        speed: Math.random() * 2 + 0.5,
        delay: Math.random() * 5,
        duration: Math.random() * 15 + 10,
        opacity: Math.random() * 0.3 + 0.1,
      });
    }
    setParticles(newParticles);

    const newFloatingIcons = iconComponents.map((item, index) => ({
      ...item,
      x: 5 + Math.random() * 90,
      y: 5 + Math.random() * 90,
      delay: index * 2,
      duration: 20 + Math.random() * 10,
      rotation: Math.random() * 360,
    }));
    setFloatingIcons(newFloatingIcons);
  }, []);

  // ===== MOUSE TRACKING =====
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ===== AUTO FOCUS =====
  useEffect(() => {
    if (usernameRef.current) {
      usernameRef.current.focus();
    }
  }, []);

  // ===== HANDLE SUBMIT - FIXED ✅ =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ✅ Now POST /auth/login will go to /api/auth/login
      const response = await api.post('/auth/login', { username, password });
      console.log('✅ Login response:', response.data);
      
      if (rememberMe) {
        localStorage.setItem('rememberedUser', username);
      } else {
        localStorage.removeItem('rememberedUser');
      }
      
      // Store user data
      localStorage.setItem('spms_user', JSON.stringify(response.data));
      setUser(response.data);
      navigate('/dashboard');
    } catch (err) {
      console.error('❌ Login error:', err);
      
      if (err.response) {
        setError(err.response?.data?.error || 'Invalid username or password');
      } else if (err.request) {
        setError('Cannot connect to server. Please check your internet connection.');
      } else {
        setError('An error occurred. Please try again.');
      }
      
      // Shake animation on error
      if (containerRef.current) {
        containerRef.current.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.style.animation = '';
          }
        }, 500);
      }
    } finally {
      setLoading(false);
    }
  };

  // ===== LOAD REMEMBERED USER =====
  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUser');
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }
  }, []);

  // ===== TOGGLE PASSWORD =====
  const togglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // ===== HANDLE KEYBOARD SHORTCUTS =====
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleSubmit(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [username, password]);

  // ===== RENDER =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4 overflow-hidden relative">
      
      {/* ===== BACKGROUND PARTICLES ===== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity,
              animation: `floatParticle ${particle.duration}s ease-in-out infinite`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ===== FLOATING ICONS ===== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden hidden lg:block">
        {floatingIcons.map((item, index) => {
          const Icon = item.Icon;
          return (
            <div
              key={index}
              className="absolute"
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                animation: `floatIcon ${item.duration}s ease-in-out infinite`,
                animationDelay: `${item.delay}s`,
                transform: `rotate(${item.rotation}deg)`,
              }}
            >
              <Icon className={`${item.color} w-${item.size} h-${item.size}`} />
            </div>
          );
        })}
      </div>

      {/* ===== GLOW ORB ===== */}
      <div 
        className="absolute w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse-slow"
        style={{
          left: `${mousePosition.x / window.innerWidth * 20}%`,
          top: `${mousePosition.y / window.innerHeight * 20}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'all 0.5s ease-out',
        }}
      />

      {/* ===== LOGIN CARD ===== */}
      <div 
        ref={containerRef}
        className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/20 relative overflow-hidden transform transition-all duration-300"
        style={{
          transform: `perspective(800px) rotateX(${(mousePosition.y / window.innerHeight - 0.5) * 2}deg) rotateY(${(mousePosition.x / window.innerWidth - 0.5) * 2}deg)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        {/* Glass Effect Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        
        {/* Decorative Corner Glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl" />

        <div className="relative z-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl shadow-lg shadow-indigo-500/30 mb-4 animate-float">
              <span className="text-4xl">🏪</span>
            </div>
            <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
              SPMS
            </h1>
            <p className="text-indigo-200/70 mt-1 text-sm flex items-center justify-center gap-2 font-semibold">
              <Sparkles className="w-3 h-3" />
              Sale & Product Management System
              <Sparkles className="w-3 h-3" />
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-indigo-200/60">Please enter your credentials</span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 backdrop-blur-sm text-red-200 p-3 rounded-xl mb-4 text-sm border border-red-500/30 flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading Message */}
          {loading && (
            <div className="bg-emerald-500/20 backdrop-blur-sm text-emerald-200 p-3 rounded-xl mb-4 text-sm border border-emerald-500/30 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Authenticating...</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="text-sm font-medium text-indigo-200 mb-1.5 flex items-center gap-2">
                <User className="w-4 h-4" />
                Username
              </label>
              <div className="relative group">
                <input
                  ref={usernameRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 group-hover:border-white/40"
                  placeholder="Enter your username"
                  required
                  disabled={loading}
                />
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-indigo-300/50 group-hover:text-indigo-300 transition-colors" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-indigo-200 mb-1.5 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <div className="relative group">
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 group-hover:border-white/40"
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-indigo-300/50 group-hover:text-indigo-300 transition-colors" />
                <button
                  type="button"
                  onClick={togglePassword}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-indigo-300/50 hover:text-indigo-300 transition-colors p-1"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-indigo-200/70 hover:text-indigo-200 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                  disabled={loading}
                />
                <span>Remember me</span>
              </label>
              <a href="#" className="text-indigo-300/70 hover:text-indigo-200 transition-colors">
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-3 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                    Sign in
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-indigo-300/50">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
              </div>
            </div>
            <p className="text-[10px] text-indigo-300/30">
              Default credentials: <span className="font-medium text-indigo-300/50">admin / admin123</span>
            </p>
            <p className="text-[10px] text-indigo-300/20">
              © 2026 SPMS | Produced by <span className="font-medium text-indigo-300/50">Mr. Chheang Samnang</span>
            </p>
          </div>
        </div>
      </div>

      {/* ===== CSS ANIMATIONS ===== */}
      <style>{`
        @keyframes floatParticle {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: 0.1;
          }
          25% {
            transform: translate(30px, -40px) scale(1.5);
            opacity: 0.3;
          }
          50% {
            transform: translate(-20px, -70px) scale(0.8);
            opacity: 0.2;
          }
          75% {
            transform: translate(10px, -30px) scale(1.2);
            opacity: 0.4;
          }
        }

        @keyframes floatIcon {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(20px, -30px) rotate(90deg);
          }
          50% {
            transform: translate(-10px, -50px) rotate(180deg);
          }
          75% {
            transform: translate(15px, -25px) rotate(270deg);
          }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.1); }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .backdrop-blur-xl {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        ::-webkit-scrollbar {
          width: 4px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: white;
          -webkit-box-shadow: 0 0 0px 1000px rgba(255, 255, 255, 0.05) inset;
          transition: background-color 5000s ease-in-out 0s;
        }

        input:focus-visible {
          outline: 2px solid rgba(99, 102, 241, 0.5);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
};

export default memo(Login);