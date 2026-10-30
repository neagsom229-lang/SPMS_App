// frontend/src/components/Layout.jsx - TechFlow Dark UI Edition
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Warehouse, 
  ClipboardList, 
  Truck, 
  LogOut,
  Moon,
  Sun,
  Shield,
  Clock,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  User,
  Settings,
  HelpCircle,
  Menu,
  X,
  ChevronDown,
  AlertTriangle,
  DollarSign,
  UserCircle,
  CreditCard,
  Gift,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Star,
  Heart,
  Zap,
  Coffee,
  BookOpen,
  Target,
  Compass,
  Sparkles,
  Filter,
  Grid,
  List,
  Plus,
  Edit,
  Trash,
  Check,
  AlertCircle,
  Info,
  RefreshCw,
  Download,
  Upload,
  Printer,
  Share2,
  Link2,
  Globe,
  Send,
  Building2
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useTheme();
  const { user, logout, tenant, isSuperAdmin } = useAuth();
  const { data: onlineCounts } = useQuery({
    queryKey: ['online-orders-count'],
    queryFn: async () => { const res = await apiClient.get('/orders/online/count'); return res.data || {}; },
    enabled: !!user && !isSuperAdmin,
    staleTime: 30000,
    refetchInterval: 60000,
  });
  const pendingOnlineCount = Number(onlineCounts?.Pending || 0);
  
  // ===== STATE =====
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Welcome to TechFlow!', time: 'Just now', read: false, type: 'info' },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [greeting, setGreeting] = useState('Good morning');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  
  const headerRef = useRef(null);
  const searchInputRef = useRef(null);

  // ===== GET MENU ITEMS BASED ON ROLE =====
  const getMenuItems = useCallback(() => {
    const baseMenu = [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: 'text-cyan-400', bg: 'bg-cyan-500/15', keywords: ['home', 'main', 'overview'] },
      { path: '/sell', icon: Zap, label: 'POS Terminal', color: 'text-indigo-400', bg: 'bg-indigo-500/15', keywords: ['pos', 'sales', 'terminal', 'checkout'] },
      { path: '/orders', icon: ShoppingCart, label: 'Orders', color: 'text-purple-400', bg: 'bg-purple-500/15', keywords: ['sales', 'purchase', 'cart'] },
      { path: '/online-orders', icon: Globe, label: 'Online Orders', color: 'text-teal-400', bg: 'bg-teal-500/15', keywords: ['online', 'storefront', 'delivery', 'pickup'] },
      { path: '/products', icon: Package, label: 'Products', color: 'text-emerald-400', bg: 'bg-emerald-500/15', keywords: ['items', 'inventory', 'stock'] },
      { path: '/customers', icon: Users, label: 'Customers', color: 'text-blue-400', bg: 'bg-blue-500/15', keywords: ['clients', 'users', 'people'] },
      { path: '/stock', icon: Warehouse, label: 'Stock', color: 'text-amber-400', bg: 'bg-amber-500/15', keywords: ['inventory', 'supply', 'storage'] },
      { path: '/suppliers', icon: Truck, label: 'Suppliers', color: 'text-cyan-400', bg: 'bg-cyan-500/15', keywords: ['vendors', 'providers'] },
      { path: '/reports', icon: ClipboardList, label: 'Reports', color: 'text-rose-400', bg: 'bg-rose-500/15', keywords: ['analytics', 'data', 'stats'] },
    ];

    if (isSuperAdmin) {
      return [
        ...baseMenu,
        { path: '/admin', icon: Shield, label: 'System Admin', color: 'text-red-400', bg: 'bg-red-500/15', keywords: ['super', 'admin', 'system'] },
        { path: '/admin/tenants', icon: Building2, label: 'Businesses', color: 'text-orange-400', bg: 'bg-orange-500/15', keywords: ['tenants', 'businesses', 'clients'] },
        { path: '/admin/users', icon: UserCircle, label: 'System Users', color: 'text-pink-400', bg: 'bg-pink-500/15', keywords: ['system', 'users', 'accounts'] },
        { path: '/profile', icon: User, label: 'Profile', color: 'text-indigo-400', bg: 'bg-indigo-500/15', keywords: ['account', 'settings'] },
        { path: '/settings', icon: Settings, label: 'Settings', color: 'text-slate-400', bg: 'bg-slate-500/15', keywords: ['preferences', 'config'] },
      ];
    }

    return [
      ...baseMenu,
      { path: '/users', icon: Shield, label: 'Users', color: 'text-red-400', bg: 'bg-red-500/15', keywords: ['accounts', 'permissions'] },
      { path: '/activity', icon: Clock, label: 'Activity', color: 'text-orange-400', bg: 'bg-orange-500/15', keywords: ['logs', 'history'] },
      { path: '/warranty', icon: Award, label: 'Warranty', color: 'text-teal-400', bg: 'bg-teal-500/15', keywords: ['guarantee', 'claims'] },
      { path: '/analytics', icon: TrendingUp, label: 'Analytics', color: 'text-pink-400', bg: 'bg-pink-500/15', keywords: ['insights', 'metrics'] },
      { path: '/profile', icon: UserCircle, label: 'Profile', color: 'text-indigo-400', bg: 'bg-indigo-500/15', keywords: ['account', 'settings'] },
      { path: '/settings', icon: Settings, label: 'Settings', color: 'text-slate-400', bg: 'bg-slate-500/15', keywords: ['preferences', 'config'] },
    ];
  }, [isSuperAdmin]);

  const menu = useMemo(() => getMenuItems(), [getMenuItems]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning ☀️');
    else if (hour < 17) setGreeting('Good afternoon 🌤️');
    else setGreeting('Good evening 🌙');
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    toast.success('👋 Logged out successfully');
    navigate('/login');
  }, [logout, navigate]);

  useEffect(() => {
    const loadAvatar = () => {
      try {
        const saved = localStorage.getItem('userAvatar');
        if (saved) setAvatarPreview(saved);
      } catch (error) {
        console.error('Error loading avatar:', error);
      }
    };
    loadAvatar();
    const handleStorageChange = (e) => {
      if (e.key === 'userAvatar') loadAvatar();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); toast.success('🟢 Back online!'); };
    const handleOffline = () => { setIsOnline(false); toast.error('🔴 You are offline'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const performSearch = useCallback((query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    const results = menu.filter(item => {
      const searchLower = query.toLowerCase();
      return item.label.toLowerCase().includes(searchLower) ||
             (item.keywords && item.keywords.some(kw => kw.toLowerCase().includes(searchLower)));
    });
    setSearchResults(results);
    setShowSearchResults(results.length > 0);
  }, [menu]);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const addToSearchHistory = useCallback((query) => {
    if (!query.trim()) return;
    setSearchHistory(prev => [query, ...prev.filter(i => i !== query)].slice(0, 10));
  }, []);

  const handleSearchSubmit = useCallback((e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      addToSearchHistory(searchQuery);
      if (searchResults.length > 0) {
        navigate(searchResults[0].path);
        setSearchQuery('');
        setShowSearchResults(false);
        setShowSearchHistory(false);
        toast.success(`🔍 Navigating to ${searchResults[0].label}`);
      } else {
        toast(`No results found for "${searchQuery}"`, { icon: 'ℹ️' });
      }
    }
  }, [searchQuery, searchResults, navigate, addToSearchHistory]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const userName = user?.fullname || user?.username || user?.name || 'Admin';
  const userRole = user?.role || user?.role_name || 'Admin';
  const userInitial = userName.charAt(0).toUpperCase();
  const userEmail = user?.email || 'admin@techflow.com';
  const userAvatar = user?.avatar || avatarPreview;
  const tenantName = tenant?.name || user?.tenant?.name || 'TechFlow Electronics';
  const subdomain = tenant?.subdomain || user?.tenant?.subdomain || 'demo-store';

  const currentPage = menu.find(item => item.path === location.pathname)?.label || 'Dashboard';
  const currentIcon = menu.find(item => item.path === location.pathname)?.icon || LayoutDashboard;
  const CurrentIcon = currentIcon;

  const getAvatarDisplay = useCallback(() => {
    if (userAvatar) {
      return <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />;
    }
    return <span className="text-sm font-black text-cyan-400">{userInitial}</span>;
  }, [userAvatar, userInitial]);

  const renderNavItems = useCallback(() => (
    <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
      {menu.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsSidebarOpen(false)}
            className={`
              flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 group relative text-xs font-bold uppercase tracking-wider
              ${isActive 
                ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }
            `}
          >
            <div className={`p-2 rounded-lg ${item.bg} ${item.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span>{item.label}</span>
            {item.path === '/online-orders' && pendingOnlineCount > 0 && (
              <span className="ml-auto px-2 py-0.5 text-xs font-bold rounded-full bg-cyan-500 text-slate-950 shadow-sm">{pendingOnlineCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  ), [location.pathname, menu, pendingOnlineCount]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* ===== SIDEBAR OVERLAY ===== */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ===== TECHFLOW DARK SIDEBAR ===== */}
      <aside 
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          w-64 
          bg-slate-950
          border-r border-slate-800
          text-slate-100 flex flex-col shadow-2xl transition-all duration-300 ease-in-out
          shrink-0
        `}
      >
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white lg:hidden transition-colors p-1 rounded-lg hover:bg-slate-900"
          aria-label="Close sidebar"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Logo */}
        <div className="p-5 border-b border-slate-800/80">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-cyan-400">
                TechFlow
              </h1>
              <p className="text-[10px] text-cyan-400 font-mono">{tenantName}</p>
            </div>
          </Link>
        </div>

        {/* ===== USER PROFILE WIDGET ===== */}
        <Link 
          to="/profile"
          className="block p-4 border-b border-slate-800/80 hover:bg-slate-900/60 transition-all duration-200 group"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shadow-md group-hover:border-cyan-500 transition-colors overflow-hidden">
                {getAvatarDisplay()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-slate-200 group-hover:text-cyan-400 transition-colors">
                {userName}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {userRole}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
          </div>
        </Link>

        {/* ===== NAVIGATION ===== */}
        {renderNavItems()}

        {/* ===== BOTTOM ACTIONS ===== */}
        <div className="p-3 border-t border-slate-800/80 space-y-1">
          <Link
            to={`/shop/${subdomain}`}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all duration-200 text-xs font-bold"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>3D Storefront</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 text-xs font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT WRAPPER ===== */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        
        {/* ===== HEADER ===== */}
        <header 
          ref={headerRef}
          className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 py-3.5 sticky top-0 z-30 shadow-md"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 lg:hidden transition"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex-shrink-0">
                  <CurrentIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black text-white truncate tracking-tight">
                    {currentPage}
                  </h2>
                  <p className="text-xs text-slate-400 hidden xs:block truncate font-medium">
                    {greeting} • {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>{currentTime.toLocaleTimeString()}</span>
              </div>

              <button
                onClick={() => {
                  window.location.reload();
                  toast.success('Page reloaded');
                }}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
                aria-label="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-cyan-400" />
              </button>
            </div>
          </div>
        </header>

        {/* ===== PAGE CONTENT ===== */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
