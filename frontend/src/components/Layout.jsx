// frontend/src/components/Layout.jsx
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
  Send
} from 'lucide-react';
// REMOVED: Facebook, Github (not available in lucide-react)

// ... rest of your Layout.jsx code remains the same
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useTheme();
  const { user, logout } = useAuth();
  
  // ===== STATE =====
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'New order #1234 placed', time: '2 min ago', read: false, type: 'order' },
    { id: 2, title: 'Low stock alert: Product X', time: '1 hour ago', read: false, type: 'alert' },
    { id: 3, title: 'Payment received $450', time: '3 hours ago', read: true, type: 'payment' },
    { id: 4, title: 'New customer registered', time: '5 hours ago', read: true, type: 'customer' },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [greeting, setGreeting] = useState('Good morning');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastActivity, setLastActivity] = useState(new Date());
  const [isTyping, setIsTyping] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  
  const headerRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const notificationTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // ===== MENU ITEMS WITH ICONS AND COLORS =====
  const menu = useMemo(() => [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: 'text-indigo-400', bg: 'bg-indigo-500/10', keywords: ['home', 'main', 'overview'] },
    { path: '/orders', icon: ShoppingCart, label: 'Orders', color: 'text-purple-400', bg: 'bg-purple-500/10', keywords: ['sales', 'purchase', 'cart'] },
    { path: '/products', icon: Package, label: 'Products', color: 'text-emerald-400', bg: 'bg-emerald-500/10', keywords: ['items', 'inventory', 'stock'] },
    { path: '/customers', icon: Users, label: 'Customers', color: 'text-blue-400', bg: 'bg-blue-500/10', keywords: ['clients', 'users', 'people'] },
    { path: '/stock', icon: Warehouse, label: 'Stock', color: 'text-amber-400', bg: 'bg-amber-500/10', keywords: ['inventory', 'supply', 'storage'] },
    { path: '/suppliers', icon: Truck, label: 'Suppliers', color: 'text-cyan-400', bg: 'bg-cyan-500/10', keywords: ['vendors', 'providers'] },
    { path: '/reports', icon: ClipboardList, label: 'Reports', color: 'text-rose-400', bg: 'bg-rose-500/10', keywords: ['analytics', 'data', 'stats'] },
    { path: '/users', icon: Shield, label: 'Users', color: 'text-red-400', bg: 'bg-red-500/10', keywords: ['accounts', 'permissions'] },
    { path: '/activity', icon: Clock, label: 'Activity', color: 'text-orange-400', bg: 'bg-orange-500/10', keywords: ['logs', 'history'] },
    { path: '/warranty', icon: Award, label: 'Warranty', color: 'text-teal-400', bg: 'bg-teal-500/10', keywords: ['guarantee', 'claims'] },
    { path: '/analytics', icon: TrendingUp, label: 'Analytics', color: 'text-pink-400', bg: 'bg-pink-500/10', keywords: ['insights', 'metrics'] },
    { path: '/profile', icon: UserCircle, label: 'Profile', color: 'text-indigo-400', bg: 'bg-indigo-500/10', keywords: ['account', 'settings'] },
    { path: '/settings', icon: Settings, label: 'Settings', color: 'text-gray-400', bg: 'bg-gray-500/10', keywords: ['preferences', 'config'] },
  ], []);
    
  // frontend/src/components/Layout.jsx (Add Super Admin Menu)
// Add this to the menu array when isSuperAdmin is true:

const getMenuItems = useCallback((isSuperAdmin) => {
  const baseMenu = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { path: '/orders', icon: ShoppingCart, label: 'Orders', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { path: '/products', icon: Package, label: 'Products', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { path: '/customers', icon: Users, label: 'Customers', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { path: '/stock', icon: Warehouse, label: 'Stock', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { path: '/suppliers', icon: Truck, label: 'Suppliers', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { path: '/reports', icon: ClipboardList, label: 'Reports', color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ];

  if (isSuperAdmin) {
    return [
      ...baseMenu,
      // Super Admin Only Menu
      { path: '/admin', icon: Shield, label: 'System Admin', color: 'text-red-400', bg: 'bg-red-500/10' },
      { path: '/admin/tenants', icon: Building2, label: 'Businesses', color: 'text-orange-400', bg: 'bg-orange-500/10' },
      { path: '/admin/users', icon: UserCircle, label: 'System Users', color: 'text-pink-400', bg: 'bg-pink-500/10' },
      { path: '/profile', icon: User, label: 'Profile', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
      { path: '/settings', icon: Settings, label: 'Settings', color: 'text-gray-400', bg: 'bg-gray-500/10' },
    ];
  }

  return [
    ...baseMenu,
    { path: '/profile', icon: User, label: 'Profile', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { path: '/settings', icon: Settings, label: 'Settings', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  ];
}, []);
  // ===== GREETING BASED ON TIME =====
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning ☀️');
    else if (hour < 17) setGreeting('Good afternoon 🌤️');
    else setGreeting('Good evening 🌙');
  }, []);

  // ===== HANDLE LOGOUT =====
  const handleLogout = useCallback(() => {
    logout();
    toast.success('👋 Logged out successfully');
    navigate('/login');
  }, [logout, navigate]);

  // ===== LOAD AVATAR FROM LOCAL STORAGE =====
  useEffect(() => {
    const loadAvatar = () => {
      try {
        const saved = localStorage.getItem('userAvatar');
        if (saved) {
          setAvatarPreview(saved);
        }
      } catch (error) {
        console.error('Error loading avatar:', error);
      }
    };
    loadAvatar();

    const handleStorageChange = (e) => {
      if (e.key === 'userAvatar') {
        loadAvatar();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // ===== TIME UPDATE =====
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ===== ONLINE/OFFLINE STATUS =====
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('🟢 Back online!');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('🔴 You are offline');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ===== USER ACTIVITY TRACKING =====
  useEffect(() => {
    const updateActivity = () => {
      setLastActivity(new Date());
    };
    
    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('scroll', updateActivity);
    
    return () => {
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, []);

  // ===== MOUSE TRACKING =====
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ===== CLOSE MENUS ON ESCAPE =====
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowUserMenu(false);
        setIsMobileMenuOpen(false);
        setIsSidebarOpen(false);
        setIsSearchOpen(false);
        setShowSearchResults(false);
        setShowSearchHistory(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // ===== HANDLE RESPONSIVE =====
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ===== CLICK OUTSIDE HANDLERS =====
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Close notifications
      if (showNotifications && !e.target.closest('.notifications-container')) {
        setShowNotifications(false);
      }
      // Close user menu
      if (showUserMenu && !e.target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
      // Close search results
      if (showSearchResults && !e.target.closest('.search-container')) {
        setShowSearchResults(false);
        setShowSearchHistory(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showNotifications, showUserMenu, showSearchResults]);

  // ===== SEARCH FUNCTIONALITY =====
  const performSearch = useCallback((query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const results = menu.filter(item => {
      const searchLower = query.toLowerCase();
      return item.label.toLowerCase().includes(searchLower) ||
             item.keywords.some(keyword => keyword.toLowerCase().includes(searchLower));
    });

    setSearchResults(results);
    setShowSearchResults(results.length > 0);
  }, [menu]);

  // ===== DEBOUNCED SEARCH =====
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  // ===== SEARCH HISTORY =====
  const addToSearchHistory = useCallback((query) => {
    if (!query.trim()) return;
    setSearchHistory(prev => {
      const newHistory = [query, ...prev.filter(item => item !== query)];
      return newHistory.slice(0, 10);
    });
  }, []);

  const handleSearchSubmit = useCallback((e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      addToSearchHistory(searchQuery);
      // Navigate to search results or first result
      if (searchResults.length > 0) {
        navigate(searchResults[0].path);
        setSearchQuery('');
        setShowSearchResults(false);
        setShowSearchHistory(false);
        toast.success(`🔍 Navigating to ${searchResults[0].label}`);
      } else {
        toast.info(`No results found for "${searchQuery}"`);
      }
    }
  }, [searchQuery, searchResults, navigate, addToSearchHistory]);

  // ===== NOTIFICATION HANDLERS =====
  const handleNotificationClick = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    // Navigate to relevant page based on notification type
    const notification = notifications.find(n => n.id === id);
    if (notification) {
      const paths = {
        order: '/orders',
        alert: '/stock',
        payment: '/reports',
        customer: '/customers'
      };
      navigate(paths[notification.type] || '/dashboard');
    }
    setShowNotifications(false);
  }, [notifications, navigate]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setShowNotifications(false);
    toast.success('All notifications cleared');
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // ===== USER INFO =====
  const userName = user?.username || user?.name || 'Guest';
  const userRole = user?.role || user?.role_name || 'User';
  const userInitial = userName.charAt(0).toUpperCase();
  const userEmail = user?.email || 'user@example.com';
  const userAvatar = user?.avatar || avatarPreview;

  // ===== CURRENT PAGE =====
  const currentPage = menu.find(item => item.path === location.pathname)?.label || 'Dashboard';
  const currentIcon = menu.find(item => item.path === location.pathname)?.icon || LayoutDashboard;
  const CurrentIcon = currentIcon;

  // ===== HELPER FUNCTIONS =====
  const getStatusColor = useCallback((type) => {
    const colors = {
      order: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      alert: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      payment: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
      customer: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    };
    return colors[type] || colors.order;
  }, []);

  const getNotificationIcon = useCallback((type) => {
    const icons = {
      order: <ShoppingCart className="w-4 h-4" />,
      alert: <AlertTriangle className="w-4 h-4" />,
      payment: <DollarSign className="w-4 h-4" />,
      customer: <User className="w-4 h-4" />,
    };
    return icons[type] || icons.order;
  }, []);

  // ===== GET AVATAR DISPLAY =====
  const getAvatarDisplay = useCallback(() => {
    if (userAvatar) {
      return (
        <img 
          src={userAvatar} 
          alt="Profile" 
          className="w-full h-full object-cover"
        />
      );
    }
    return <span className="text-sm font-bold">{userInitial}</span>;
  }, [userAvatar, userInitial]);

  // ===== RENDER NOTIFICATIONS DROPDOWN =====
  const renderNotifications = useCallback(() => (
    <div className="notifications-container absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-slideDown">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          <h3 className="font-semibold text-gray-800 dark:text-white">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-rose-500 text-white text-xs rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <>
              <button
                onClick={markAllRead}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                Mark all read
              </button>
              <button
                onClick={clearAllNotifications}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-400 dark:text-gray-500">No notifications</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification.id)}
              className={`flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-700/50 ${
                !notification.read ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
              }`}
            >
              <div className={`p-2 rounded-xl flex-shrink-0 ${getStatusColor(notification.type)}`}>
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-800 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                  {notification.title}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {notification.time}
                </p>
              </div>
              {!notification.read && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-2" />
              )}
            </div>
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-100 dark:border-gray-700">
          <Link
            to="/notifications"
            className="block text-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            onClick={() => setShowNotifications(false)}
          >
            View all notifications →
          </Link>
        </div>
      )}
    </div>
  ), [notifications, unreadCount, markAllRead, clearAllNotifications, handleNotificationClick, getStatusColor, getNotificationIcon]);

  // ===== RENDER USER MENU =====
  const renderUserMenu = useCallback(() => (
    <div className="user-menu-container absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-slideDown">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 overflow-hidden">
            {getAvatarDisplay()}
          </div>
          <div>
            <p className="font-semibold text-gray-800 dark:text-white text-sm">{userName}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{userRole}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 truncate">{userEmail}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${isOnline ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
      </div>

      <div className="p-1">
        <Link
          to="/profile"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
          onClick={() => setShowUserMenu(false)}
        >
          <UserCircle className="w-4 h-4" />
          My Profile
        </Link>
        <Link
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
          onClick={() => setShowUserMenu(false)}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
        <Link
          to="/help"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
          onClick={() => setShowUserMenu(false)}
        >
          <HelpCircle className="w-4 h-4" />
          Help & Support
        </Link>
        <div className="border-t border-gray-100 dark:border-gray-700 my-1">
          <button
            onClick={() => {
              setShowUserMenu(false);
              toggleDarkMode();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={() => {
              setShowUserMenu(false);
              handleLogout();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </div>
  ), [userName, userRole, userEmail, isOnline, getAvatarDisplay, toggleDarkMode, darkMode, handleLogout]);

  // ===== RENDER SEARCH RESULTS =====
  const renderSearchResults = useCallback(() => (
    <div className="search-container absolute left-0 right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-slideDown">
      {showSearchHistory && searchHistory.length > 0 && !searchQuery.trim() && (
        <div className="p-2">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">Recent Searches</span>
            <button
              onClick={() => {
                setSearchHistory([]);
                toast.success('Search history cleared');
              }}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Clear all
            </button>
          </div>
          {searchHistory.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                setSearchQuery(item);
                setShowSearchHistory(false);
                performSearch(item);
              }}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-sm text-gray-600 dark:text-gray-300"
            >
              <Clock className="w-4 h-4 text-gray-400" />
              {item}
            </button>
          ))}
        </div>
      )}

      {searchQuery.trim() && (
        <div className="p-2">
          <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </div>
          {searchResults.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                  setShowSearchHistory(false);
                  addToSearchHistory(item.label);
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className={`p-2 rounded-xl ${item.bg}`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{item.label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Navigate to {item.label}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  ), [searchQuery, searchResults, searchHistory, showSearchHistory, performSearch, addToSearchHistory]);

  // ===== SIDEBAR NAVIGATION ITEMS =====
  const renderNavItems = useCallback(() => (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {menu.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsSidebarOpen(false)}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
              ${isActive 
                ? 'bg-white/10 text-white shadow-lg shadow-indigo-500/10' 
                : 'text-indigo-200 hover:bg-white/5 hover:text-white'
              }
            `}
          >
            <Icon className={`w-5 h-5 ${isActive ? item.color : ''}`} />
            <span className="text-sm font-medium">{item.label}</span>
            {isActive && (
              <span className="ml-auto w-1 h-6 bg-indigo-400 rounded-full shadow-lg shadow-indigo-400/50" />
            )}
            {!isActive && (
              <span className="absolute left-0 w-0.5 h-0 bg-indigo-400 rounded-full transition-all duration-300 group-hover:h-6" />
            )}
          </Link>
        );
      })}
    </nav>
  ), [location.pathname, menu]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      
      {/* ===== SIDEBAR OVERLAY ===== */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-fadeIn"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ===== SIDEBAR ===== */}
      <aside 
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          w-64 
          bg-gradient-to-b from-indigo-900 via-indigo-800 to-indigo-900 
          text-white flex flex-col shadow-2xl transition-all duration-300 ease-in-out
          shrink-0
        `}
      >
        {/* Mobile Close Button */}
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 right-4 text-white/70 hover:text-white lg:hidden transition-colors p-1 rounded-lg hover:bg-white/10"
          aria-label="Close sidebar"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Logo */}
        <div className="p-4 border-b border-indigo-800/50">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
              <span className="text-xl">🏪</span>
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
                SPMS
              </h1>
              <p className="text-[10px] text-indigo-300/70 leading-tight">Sale & Product</p>
            </div>
          </Link>
        </div>

        {/* ===== USER PROFILE ===== */}
        <Link 
          to="/profile"
          className="block p-4 border-b border-indigo-800/50 hover:bg-indigo-800/30 transition-all duration-200 group"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                {getAvatarDisplay()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-indigo-900 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-indigo-200 transition-colors">
                {userName}
              </p>
              <p className="text-[10px] text-indigo-300/70 truncate">
                {userRole}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-indigo-400/50 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1" />
          </div>
        </Link>

        {/* ===== NAVIGATION ===== */}
        {renderNavItems()}

        {/* ===== BOTTOM ACTIONS ===== */}
        <div className="p-3 border-t border-indigo-800/50 space-y-1">
          <button
            onClick={toggleDarkMode}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-indigo-200 hover:bg-white/5 hover:text-white transition-all duration-200 group"
          >
            {darkMode ? (
              <>
                <Sun className="w-5 h-5 text-amber-400" />
                <span className="text-sm">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-5 h-5 text-indigo-300" />
                <span className="text-sm">Dark Mode</span>
              </>
            )}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all duration-200 group"
          >
            <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* ===== HEADER ===== */}
        <header 
          ref={headerRef}
          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 px-3 sm:px-4 py-2 sm:py-3 sticky top-0 z-30 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            {/* Left Section */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 lg:hidden"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>

              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex-shrink-0">
                  <CurrentIcon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 dark:text-white truncate">
                    {currentPage}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 hidden xs:block truncate">
                    {greeting} • {new Date().toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Search */}
              <div className="relative search-container hidden sm:block">
                <form onSubmit={handleSearchSubmit}>
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchHistory.length > 0 && !searchQuery.trim()) {
                        setShowSearchHistory(true);
                      }
                    }}
                    className="pl-8 pr-8 py-1.5 w-32 md:w-40 lg:w-48 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  )}
                </form>
                {(showSearchResults || showSearchHistory) && renderSearchResults()}
              </div>

              {/* Mobile Search Toggle */}
              <button
                onClick={() => {
                  setIsSearchOpen(!isSearchOpen);
                  if (!isSearchOpen) {
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  }
                }}
                className="sm:hidden p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                aria-label="Search"
              >
                <Search className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>

              {/* Online Status Indicator */}
              <div className="hidden lg:flex items-center">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'} mr-1`} />
              </div>

              {/* Notifications */}
              <div className="relative notifications-container">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold shadow-lg shadow-rose-500/30 animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && renderNotifications()}
              </div>

              {/* User Menu */}
              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-1 sm:gap-2 p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                  aria-label="User menu"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 overflow-hidden flex-shrink-0">
                    {getAvatarDisplay()}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 leading-tight truncate max-w-[60px] md:max-w-[100px]">
                      {userName}
                    </p>
                    <p className="text-[8px] sm:text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                      {userRole}
                    </p>
                  </div>
                  <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 text-gray-400 hidden sm:block transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && renderUserMenu()}
              </div>

              {/* Time & Status */}
              <div className="hidden lg:flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono">{currentTime.toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => {
                  window.location.reload();
                  toast.success('Page refreshed');
                }}
                className="hidden lg:flex p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                aria-label="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              </button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          {isSearchOpen && (
            <div className="mt-2 sm:hidden animate-slideDown">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </form>
              {(showSearchResults || showSearchHistory) && renderSearchResults()}
            </div>
          )}
        </header>

        {/* ===== MAIN CONTENT ===== */}
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
          <div className="max-w-7xl mx-auto animate-fadeInUp">
            {children}
          </div>
        </main>
      </div>

      {/* ===== CSS ANIMATIONS ===== */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .animate-fadeInUp { animation: fadeInUp 0.4s ease-out forwards; }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        .animate-slideDown { animation: slideDown 0.3s ease-out forwards; }

        @media (max-width: 640px) {
          button, a, input, select {
            min-height: 44px;
          }
        }

        * {
          -webkit-tap-highlight-color: transparent;
        }

        /* Scrollbar styles */
        ::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .dark ::-webkit-scrollbar-thumb {
          background: #475569;
        }
        .dark ::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }

        /* Selection style */
        ::selection {
          background: rgba(99, 102, 241, 0.3);
          color: inherit;
        }
      `}</style>
    </div>
  );
};

export default Layout;