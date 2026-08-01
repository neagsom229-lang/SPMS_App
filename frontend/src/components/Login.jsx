// frontend/src/components/Login.jsx
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast'; 
import { 
  User, Lock, Eye, EyeOff, LogIn, Shield, Sparkles,
  AlertCircle, Loader2, ArrowRight, UserPlus
} from 'lucide-react';

const Login = () => {
  // ✅ Use useAuth hook instead of props
  const { login, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState([]);
  
  const containerRef = useRef(null);
  const usernameRef = useRef(null);

  // ===== PARTICLES =====
  useEffect(() => {
    const newParticles = [];
    for (let i = 0; i < 50; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 15 + 10,
        delay: Math.random() * 5,
        opacity: Math.random() * 0.3 + 0.1,
      });
    }
    setParticles(newParticles);
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

  // ===== LOAD REMEMBERED USER =====
  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUser');
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }
  }, []);

  // ===== HANDLE SUBMIT =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ✅ Use login from context
      const result = await login(username, password);
      
      if (result.success) {
         toast.success(`🎉 Welcome back, ${username}!`);
        if (rememberMe) {
          localStorage.setItem('rememberedUser', username);
        } else {
          localStorage.removeItem('rememberedUser');
        }
        navigate('/dashboard');
      } else {
         toast.error(result.error || 'Invalid username or password');
        setError(result.error || 'Invalid username or password');
        if (containerRef.current) {
          containerRef.current.style.animation = 'shake 0.5s ease-in-out';
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.style.animation = '';
            }
          }, 500);
        }
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Particles */}
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

      {/* Glow Orb */}
      <div 
        className="absolute w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse-slow"
        style={{
          left: `${mousePosition.x / window.innerWidth * 20}%`,
          top: `${mousePosition.y / window.innerHeight * 20}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'all 0.5s ease-out',
        }}
      />

      {/* Login Card */}
      <div 
        ref={containerRef}
        className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/20 relative overflow-hidden"
        style={{
          transform: `perspective(800px) rotateX(${(mousePosition.y / window.innerHeight - 0.5) * 2}deg) rotateY(${(mousePosition.x / window.innerWidth - 0.5) * 2}deg)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl" />

        <div className="relative z-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-block p-4 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl shadow-lg shadow-indigo-500/30 mb-4 transition-transform hover:scale-105">
              <span className="text-4xl">🏪</span>
            </Link>
            <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
              Welcome Back
            </h1>
            <p className="text-indigo-200/70 text-sm flex items-center justify-center gap-2 mt-1">
              <Sparkles className="w-3 h-3" />
              Sign in to your account
              <Sparkles className="w-3 h-3" />
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/20 backdrop-blur-sm text-red-200 p-3 rounded-xl mb-4 text-sm border border-red-500/30 flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="bg-emerald-500/20 backdrop-blur-sm text-emerald-200 p-3 rounded-xl mb-4 text-sm border border-emerald-500/30 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Authenticating...</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-indigo-200 mb-1.5 flex items-center gap-2">
                <User className="w-4 h-4" />
                Username or Email
              </label>
              <div className="relative group">
                <input
                  ref={usernameRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="Enter your username"
                  required
                  disabled={loading}
                />
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-indigo-300/50 group-hover:text-indigo-300 transition-colors" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-indigo-200 mb-1.5 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <div className="relative group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-indigo-300/50 group-hover:text-indigo-300 transition-colors" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-indigo-300/50 hover:text-indigo-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-indigo-200/70 hover:text-indigo-200 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-indigo-500"
                  disabled={loading}
                />
                <span>Remember me</span>
              </label>
              <a href="#" className="text-indigo-300/70 hover:text-indigo-200 transition-colors">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-3 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 font-medium flex items-center justify-center gap-2 disabled:opacity-50 group relative overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    Sign in
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Register Link */}
          <p className="mt-6 text-center text-sm text-indigo-200/60">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-300 hover:text-white font-medium transition flex items-center justify-center gap-1 group">
              <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Create Account
            </Link>
          </p>

          <p className="mt-4 text-center text-[10px] text-indigo-300/20">
            © 2026 SPMS | Produced by <span className="font-medium text-indigo-300/50">Mr. Chheang Samnang</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.1; }
          25% { transform: translate(30px, -40px) scale(1.5); opacity: 0.3; }
          50% { transform: translate(-20px, -70px) scale(0.8); opacity: 0.2; }
          75% { transform: translate(10px, -30px) scale(1.2); opacity: 0.4; }
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

        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        .backdrop-blur-xl { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
      `}</style>
    </div>
  );
};

export default memo(Login);