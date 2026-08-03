// frontend/src/pages/Register.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  Building2, Mail, Lock, Eye, EyeOff, ArrowRight, Shield,
  Phone, MapPin, Globe, RefreshCw, CheckCircle,
  AlertCircle, Store, Users, Package, ShoppingCart
} from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const { register, user } = useAuth();
  
  const [formData, setFormData] = useState({
    businessName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    subdomain: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [errors, setErrors] = useState({});

  // ===== REDIRECT IF ALREADY LOGGED IN =====
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // ===== GENERATE SUBDOMAIN =====
  const generateSubdomain = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
  };

  // ===== HANDLE INPUT CHANGE =====
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
    
    if (name === 'businessName') {
      const subdomain = generateSubdomain(value);
      setFormData(prev => ({ ...prev, subdomain }));
    }
    
    if (name === 'password') {
      calculatePasswordStrength(value);
    }
  };

  // ===== PASSWORD STRENGTH =====
  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    setPasswordStrength(strength);
  };

  const getStrengthColor = () => {
    if (passwordStrength <= 1) return 'bg-red-500';
    if (passwordStrength <= 2) return 'bg-orange-500';
    if (passwordStrength <= 3) return 'bg-yellow-500';
    if (passwordStrength <= 4) return 'bg-green-400';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (passwordStrength <= 1) return 'Weak';
    if (passwordStrength <= 2) return 'Fair';
    if (passwordStrength <= 3) return 'Good';
    if (passwordStrength <= 4) return 'Strong';
    return 'Very Strong';
  };

  // ===== VALIDATE FORM =====
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.subdomain.trim()) {
      newErrors.subdomain = 'Subdomain is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.subdomain)) {
      newErrors.subdomain = 'Only lowercase letters, numbers, and hyphens allowed';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!agreedTerms) {
      newErrors.terms = 'You must agree to the terms';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ===== HANDLE SUBMIT =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix all errors');
      return;
    }
    
    setLoading(true);

    try {
      const result = await register({
        businessName: formData.businessName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        address: formData.address,
        subdomain: formData.subdomain
      });

      if (result.success) {
        toast.success('🎉 Business registered successfully!');
        // Wait a moment then redirect
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } else {
        toast.error(result.error || 'Registration failed');
      }
      
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Store, title: 'Your Own Store', desc: 'Manage your products and inventory' },
    { icon: Users, title: 'Customer Management', desc: 'Track and manage your customers' },
    { icon: Package, title: 'Product Management', desc: 'Add, edit, and organize products' },
    { icon: ShoppingCart, title: 'Order Management', desc: 'Process and track orders' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/10 mb-4">
              <Shield className="w-8 h-8 text-indigo-400" />
              <span className="text-2xl font-bold text-white">SPMS</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Start Your Business Today
            </h1>
            <p className="text-indigo-200 text-lg mt-2">
              Create your account and start managing your products, orders, and customers
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="hidden md:block space-y-6">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h3 className="text-white text-xl font-semibold mb-4">Why Join SPMS?</h3>
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                      <feature.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{feature.title}</p>
                      <p className="text-indigo-200 text-sm">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h3 className="text-white text-xl font-semibold mb-2">What You Get</h3>
                <ul className="space-y-2 text-indigo-200">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Your own business subdomain
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Full product management
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Order processing system
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Customer database
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Stock management with alerts
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Sales reports and analytics
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl max-h-[80vh] overflow-y-auto">
              <h2 className="text-white text-xl font-semibold mb-4">Create Your Account</h2>
              <p className="text-indigo-200 text-sm mb-6">
                Join thousands of businesses using SPMS
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                    Business Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-300" />
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      required
                      placeholder="Your Business Name"
                      disabled={loading}
                      className={`w-full pl-10 pr-4 py-2.5 bg-white/5 border ${errors.businessName ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 disabled:opacity-50`}
                    />
                  </div>
                  {errors.businessName && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.businessName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-300" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="admin@yourbusiness.com"
                      disabled={loading}
                      className={`w-full pl-10 pr-4 py-2.5 bg-white/5 border ${errors.email ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 disabled:opacity-50`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                    Subdomain <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center">
                    <div className="relative flex-1">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-300" />
                      <input
                        type="text"
                        name="subdomain"
                        value={formData.subdomain}
                        onChange={handleChange}
                        required
                        placeholder="mybusiness"
                        disabled={loading}
                        className={`w-full pl-10 pr-4 py-2.5 bg-white/5 border ${errors.subdomain ? 'border-red-500' : 'border-white/10'} rounded-l-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 disabled:opacity-50`}
                      />
                    </div>
                    <span className="px-3 py-2.5 bg-white/10 border border-l-0 border-white/10 rounded-r-xl text-indigo-300 text-sm whitespace-nowrap">
                      .yourdomain.com
                    </span>
                  </div>
                  {errors.subdomain && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.subdomain}
                    </p>
                  )}
                  <p className="text-xs text-indigo-300/50 mt-1">
                    This will be your unique URL: mybusiness.yourdomain.com
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-300" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                      placeholder="Min 8 characters"
                      disabled={loading}
                      className={`w-full pl-10 pr-12 py-2.5 bg-white/5 border ${errors.password ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 disabled:opacity-50`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-indigo-300 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {formData.password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                              i < passwordStrength ? getStrengthColor() : 'bg-white/10'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs ${passwordStrength <= 1 ? 'text-red-400' : passwordStrength <= 3 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {getStrengthText()} ({passwordStrength}/5)
                      </p>
                    </div>
                  )}
                  {errors.password && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.password}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-300" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      placeholder="Confirm your password"
                      disabled={loading}
                      className={`w-full pl-10 pr-12 py-2.5 bg-white/5 border ${errors.confirmPassword ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 disabled:opacity-50`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-indigo-300 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                    Phone Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-300" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+1 234 567 890"
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-1.5">
                    Business Address (Optional)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-300" />
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="123 Business St, City, Country"
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-1 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-400"
                  />
                  <label className="text-sm text-indigo-200">
                    I agree to the{' '}
                    <a href="/terms" className="text-white hover:underline">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" className="text-white hover:underline">Privacy Policy</a>
                  </label>
                </div>
                {errors.terms && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.terms}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Start Your Business
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <p className="text-center text-sm text-indigo-200">
                  Already have an account?{' '}
                  <Link to="/login" className="text-white font-medium hover:underline">
                    Sign In
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;