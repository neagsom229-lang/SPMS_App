// frontend/src/pages/Settings.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Settings as SettingsIcon,
  Shield,
  User,
  Bell,
  Lock,
  Palette,
  Globe,
  Database,
  Users,
  FileText,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Save,
  X,
  Edit2,
  Check,
  AlertCircle,
  RefreshCw,
  Moon,
  Sun,
  Monitor,
  Key,
  Eye,
  EyeOff,
  ChevronRight,
  UserCheck,
  Crown,
  Briefcase,
  Eye as EyeIcon,
  TrendingUp,
  ShoppingCart,
  Package,
  Warehouse,
  Truck,
  ClipboardList,
  Activity,
  Award,
  CreditCard,
  Gift,
  Heart,
  Zap,
  Coffee,
  BookOpen,
  Target,
  Compass,
  Sparkles,
  Upload,
  Download,
  Trash2,
  Plus,
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Copy,
  Link,
  ExternalLink,
  Home,
  UserCircle,
  Bot,
  MessageSquare,
  Send,
  Mic,
  Volume2,
  VolumeX,
  Video,
  Camera,
  Image,
  Paperclip,
  Smile,
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
  Copy as CopyIcon,
  Reply,
  Forward,
  Bookmark,
  Flag,
  Pin,
  Star,
  Share2,
  Link2,
  QrCode,
  Fingerprint,
  ShieldCheck,
  Wifi,
  WifiOff,
  Bluetooth,
  BluetoothOff,
  Battery,
  BatteryCharging,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Smartphone,
  Tablet,
  Laptop,
  Monitor as MonitorIcon,
  Tv,
  Watch,
  Headphones,
  Speaker,
  Volume1,
  Volume,
  VolumeX as VolumeOff,
  MicOff,
  CameraOff,
  EyeOff as EyeOffIcon,
  Lock as LockIcon,
  Unlock,
  Key as KeyIcon,
  Fingerprint as FingerprintIcon,
  Scan,
  QrCode as QrCodeIcon,
  Shield as ShieldIcon,
  ShieldCheck as ShieldCheckIcon,
  ShieldAlert,
  ShieldX,
  User as UserIcon,
  Users as UsersIcon,
  UserPlus,
  UserMinus,
  UserCheck as UserCheckIcon,
  UserX as UserXIcon,
  Mail as MailIcon,
  Phone as PhoneIcon,
  MapPin as MapPinIcon,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Award as AwardIcon,
  Star as StarIcon,
  Heart as HeartIcon,
  Zap as ZapIcon,
  Coffee as CoffeeIcon,
  BookOpen as BookOpenIcon,
  Target as TargetIcon,
  Compass as CompassIcon,
  Sparkles as SparklesIcon
} from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);

  // ===== AI ASSISTANT STATE =====
  const [aiMessages, setAiMessages] = useState([
    { 
      id: 1, 
      type: 'assistant', 
      message: '👋 Hello! I\'m your AI Assistant. How can I help you today?',
      timestamp: new Date().toISOString(),
      read: true
    }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([
    'How do I change my password?',
    'Help me with inventory management',
    'Generate a sales report',
    'Set up two-factor authentication',
    'Update my profile information'
  ]);
  const [aiContext, setAiContext] = useState([]);
  const chatEndRef = useRef(null);
  const aiInputRef = useRef(null);

  // ===== AI RESPONSES =====
  const aiResponses = {
    'password': "🔐 To change your password:\n1. Go to Security tab\n2. Enter your current password\n3. Enter your new password (min 6 characters)\n4. Confirm your new password\n5. Click 'Update Security'\n\n💡 Tip: Use a mix of letters, numbers, and special characters for a strong password.",
    
    'inventory': "📦 Here's how to manage inventory effectively:\n1. Go to Products > Stock\n2. Use the 'Low Stock' filter to see items that need reordering\n3. Set up automatic reorder points\n4. Use the bulk update feature for quick changes\n5. Generate inventory reports weekly\n\n📊 Pro tip: Track your best-selling items to optimize stock levels.",
    
    'sales report': "📊 To generate a sales report:\n1. Navigate to Reports > Sales\n2. Select your date range\n3. Choose report type (Daily/Weekly/Monthly)\n4. Click 'Generate'\n5. Export as PDF, Excel, or CSV\n\n📈 Pro tip: Compare month-over-month data to identify trends.",
    
    '2fa': "🔐 Setting up Two-Factor Authentication:\n1. Go to Security tab\n2. Click on 'Two-Factor Authentication'\n3. Scan the QR code with your authenticator app\n4. Enter the 6-digit code\n5. Click 'Verify & Enable'\n\n✅ Your account is now 2FA protected!",
    
    'profile update': "👤 To update your profile:\n1. Go to Profile tab\n2. Update your full name, email, or phone\n3. Click 'Save Changes'\n4. For avatar, click the camera icon on your profile picture\n\n📸 Tip: Use a clear photo for your profile picture.",
    
    'backup': "💾 To backup your data:\n1. Go to Backup tab\n2. Click 'Create Backup'\n3. Wait for the backup to complete\n4. Download the backup file\n5. Store it in a safe location\n\n🔄 Schedule automatic backups for peace of mind.",
    
    'default': "🤖 I understand you're asking about that. Here are some things I can help with:\n• Password management 🔐\n• Inventory optimization 📦\n• Sales reporting 📊\n• Security settings 🛡️\n• Profile updates 👤\n• Data backup 💾\n\nJust type your question and I'll do my best to help!"
  };

  // ===== AI ASSISTANT FUNCTIONS =====
  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages]);

  const getAiResponse = (message) => {
    const lowerMsg = message.toLowerCase();
    
    // Check for keywords and return appropriate response
    if (lowerMsg.includes('password') || lowerMsg.includes('change password')) {
      return aiResponses.password;
    } else if (lowerMsg.includes('inventory') || lowerMsg.includes('stock')) {
      return aiResponses.inventory;
    } else if (lowerMsg.includes('report') || lowerMsg.includes('sales')) {
      return aiResponses['sales report'];
    } else if (lowerMsg.includes('2fa') || lowerMsg.includes('two factor') || lowerMsg.includes('2 factor')) {
      return aiResponses['2fa'];
    } else if (lowerMsg.includes('profile') || lowerMsg.includes('update profile')) {
      return aiResponses['profile update'];
    } else if (lowerMsg.includes('backup') || lowerMsg.includes('data backup')) {
      return aiResponses.backup;
    } else if (lowerMsg.includes('help') || lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
      return "👋 Hello! I'm your AI Assistant. I can help you with:\n• Password management 🔐\n• Inventory optimization 📦\n• Sales reporting 📊\n• Security settings 🛡️\n• Profile updates 👤\n• Data backup 💾\n\nWhat would you like to know?";
    } else {
      return aiResponses.default;
    }
  };

  const handleAiSend = async () => {
    if (!aiInput.trim()) return;

    // Add user message
    const userMessage = {
      id: aiMessages.length + 1,
      type: 'user',
      message: aiInput,
      timestamp: new Date().toISOString(),
      read: true
    };
    setAiMessages(prev => [...prev, userMessage]);
    setAiInput('');
    setIsAiTyping(true);

    // Simulate AI thinking
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 600));

    // Generate AI response
    const response = getAiResponse(aiInput);
    const aiMessage = {
      id: aiMessages.length + 2,
      type: 'assistant',
      message: response,
      timestamp: new Date().toISOString(),
      read: true
    };
    setAiMessages(prev => [...prev, aiMessage]);
    setIsAiTyping(false);
  };

  const handleAiKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAiSend();
    }
  };

  const handleAiSuggestionClick = (suggestion) => {
    setAiInput(suggestion);
    setTimeout(() => handleAiSend(), 100);
  };

  const clearAiChat = () => {
    setAiMessages([
      { 
        id: 1, 
        type: 'assistant', 
        message: '👋 Hello! I\'m your AI Assistant. How can I help you today?',
        timestamp: new Date().toISOString(),
        read: true
      }
    ]);
    toast.success('Chat cleared');
  };

  // ===== USER ROLE CHECK =====
  const userRole = user?.role || user?.role_name || 'Viewer';
  const isAdmin = userRole === 'Admin' || userRole === 'admin' || user?.role_id === 1;
  const isManager = isAdmin || userRole === 'Manager' || userRole === 'manager';
  const isCashier = userRole === 'Cashier' || userRole === 'cashier' || user?.role_id === 2;
  const isViewer = userRole === 'Viewer' || userRole === 'viewer' || user?.role_id === 3;

  // ===== PROFILE FORM =====
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    fullname: user?.fullname || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    bio: user?.bio || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // ===== PREFERENCES =====
  const [preferences, setPreferences] = useState({
    theme: localStorage.getItem('theme') || 'light',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    notifications: {
      email: true,
      push: true,
      sms: false,
      orders: true,
      inventory: true,
      promotions: false
    }
  });

  // ===== SYSTEM SETTINGS =====
  const [systemSettings, setSystemSettings] = useState({
    storeName: 'SPMS Store',
    storeEmail: 'store@example.com',
    storePhone: '+1 234 567 890',
    storeAddress: '123 Main Street, City',
    storeTimezone: Intl.DateTimeFormat().resolveOptions().timeZone,
    currencySymbol: '$',
    taxRate: 10,
    enableGuestCheckout: true,
    requireApproval: false,
    maintenanceMode: false
  });

  // ===== PERMISSIONS =====
  const [permissions, setPermissions] = useState({
    users: {
      view: true,
      create: isAdmin,
      edit: isAdmin,
      delete: isAdmin
    },
    products: {
      view: true,
      create: isAdmin || isManager,
      edit: isAdmin || isManager,
      delete: isAdmin
    },
    orders: {
      view: true,
      create: true,
      edit: isAdmin || isManager,
      delete: isAdmin
    },
    reports: {
      view: isAdmin || isManager,
      generate: isAdmin || isManager,
      export: isAdmin || isManager
    },
    settings: {
      view: isAdmin,
      edit: isAdmin
    }
  });

  // ===== NOTIFICATIONS =====
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    orderUpdates: true,
    inventoryAlerts: true,
    promotionEmails: false,
    securityAlerts: true,
    systemUpdates: true
  });

  // ===== SECURITY =====
  const [security, setSecurity] = useState({
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordExpiry: 90,
    loginAlerts: true,
    deviceManagement: true,
    ipWhitelisting: false
  });

  // ===== BACKUP =====
  const [backups, setBackups] = useState([
    { id: 1, name: 'Backup_2026-07-30.zip', size: '245 MB', date: '2026-07-30 14:30', type: 'Full' },
    { id: 2, name: 'Backup_2026-07-29.zip', size: '238 MB', date: '2026-07-29 14:30', type: 'Full' },
    { id: 3, name: 'Backup_2026-07-28.zip', size: '120 MB', date: '2026-07-28 14:30', type: 'Partial' },
  ]);

  // ===== TABS CONFIGURATION WITH ROLE ACCESS =====
  const tabs = [
    { id: 'profile', label: 'Profile', icon: User, roles: ['Admin', 'Manager', 'Cashier', 'Viewer'] },
    { id: 'preferences', label: 'Preferences', icon: Palette, roles: ['Admin', 'Manager', 'Cashier', 'Viewer'] },
    { id: 'security', label: 'Security', icon: Lock, roles: ['Admin', 'Manager', 'Cashier', 'Viewer'] },
    { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['Admin', 'Manager', 'Cashier', 'Viewer'] },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Bot, roles: ['Admin', 'Manager', 'Cashier', 'Viewer'] },
    { id: 'system', label: 'System', icon: SettingsIcon, roles: ['Admin'] },
    { id: 'permissions', label: 'Permissions', icon: Shield, roles: ['Admin'] },
    { id: 'users', label: 'User Management', icon: Users, roles: ['Admin'] },
    { id: 'backup', label: 'Backup', icon: Database, roles: ['Admin'] },
  ];

  // ===== FILTER TABS BY ROLE =====
  const accessibleTabs = tabs.filter(tab => 
    tab.roles.includes(userRole) || tab.roles.includes('All')
  );

  // ===== LOAD AVATAR =====
  useEffect(() => {
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
  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target.result;
      setAvatarPreview(imageData);
      setAvatarFile(file);
      localStorage.setItem('userAvatar', imageData);
      toast.success('Avatar updated successfully!');
    };
    reader.readAsDataURL(file);
  };

  // ===== HANDLE PROFILE UPDATE =====
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (profileData.newPassword && profileData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (profileData.newPassword !== profileData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Profile updated successfully!');
      setProfileData({
        ...profileData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // ===== HANDLE PREFERENCES UPDATE =====
  const handlePreferenceUpdate = async () => {
    setSaving(true);
    try {
      localStorage.setItem('theme', preferences.theme);
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Preferences saved!');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  // ===== HANDLE SYSTEM UPDATE =====
  const handleSystemUpdate = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      toast.success('System settings updated!');
    } catch (error) {
      toast.error('Failed to update system settings');
    } finally {
      setSaving(false);
    }
  };

  // ===== HANDLE PERMISSION UPDATE =====
  const handlePermissionUpdate = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Permissions updated!');
    } catch (error) {
      toast.error('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  // ===== HANDLE NOTIFICATION UPDATE =====
  const handleNotificationUpdate = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('Notification settings updated!');
    } catch (error) {
      toast.error('Failed to update notification settings');
    } finally {
      setSaving(false);
    }
  };

  // ===== HANDLE BACKUP =====
  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newBackup = {
        id: backups.length + 1,
        name: `Backup_${new Date().toISOString().slice(0,10)}.zip`,
        size: `${Math.floor(Math.random() * 200) + 100} MB`,
        date: new Date().toLocaleString(),
        type: 'Full'
      };
      setBackups([newBackup, ...backups]);
      toast.success('Backup created successfully!');
    } catch (error) {
      toast.error('Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = (id) => {
    if (window.confirm('Are you sure you want to delete this backup?')) {
      setBackups(backups.filter(b => b.id !== id));
      toast.success('Backup deleted successfully');
    }
  };

  // ===== RENDER AI ASSISTANT TAB =====
  const renderAiAssistantTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">AI Assistant</h3>
          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full animate-pulse">
            Online
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearAiChat}
            className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            Clear Chat
          </button>
          <button
            onClick={() => setShowAiAssistant(!showAiAssistant)}
            className="px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            {showAiAssistant ? 'Hide' : 'Show'} Assistant
          </button>
        </div>
      </div>

      {/* AI Chat Interface */}
      <div className={`bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 ${showAiAssistant ? 'h-[500px]' : 'h-[60px]'}`}>
        {showAiAssistant ? (
          <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-white font-medium text-sm">AI Assistant</h4>
                  <p className="text-white/70 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block animate-pulse" />
                    Online • Powered by AI
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setAiMessages([
                      { 
                        id: 1, 
                        type: 'assistant', 
                        message: '👋 Hello! I\'m your AI Assistant. How can I help you today?',
                        timestamp: new Date().toISOString(),
                        read: true
                      }
                    ]);
                    toast.success('Chat reset');
                  }}
                  className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowAiAssistant(false)}
                  className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/20">
              {aiMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-xl ${
                      msg.type === 'user'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${msg.type === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isAiTyping && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestions */}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
              <div className="flex flex-wrap gap-2">
                {aiSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleAiSuggestionClick(suggestion)}
                    className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  ref={aiInputRef}
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyPress={handleAiKeyPress}
                  placeholder="Ask me anything..."
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleAiSend}
                  disabled={!aiInput.trim() || isAiTyping}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 text-center">
                AI Assistant • Responses are automated and for guidance only
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAiAssistant(true)}
            className="w-full h-full flex items-center justify-center gap-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <Bot className="w-5 h-5" />
            <span className="text-sm font-medium">Click to open AI Assistant</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* AI Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="font-medium text-gray-800 dark:text-white text-sm">Smart Responses</h4>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">AI generates intelligent responses based on your queries</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-medium text-gray-800 dark:text-white text-sm">Quick Suggestions</h4>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Get relevant suggestions based on your conversation context</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h4 className="font-medium text-gray-800 dark:text-white text-sm">Knowledge Base</h4>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Access to comprehensive help documentation and guides</p>
        </div>
      </div>
    </div>
  );

  // ===== RENDER PROFILE TAB =====
  const renderProfileTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Profile Information</h3>
      </div>

      {/* Avatar Upload */}
      <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg overflow-hidden">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-white">
                {profileData.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <label className="absolute bottom-0 right-0 p-1 bg-indigo-600 rounded-full cursor-pointer hover:bg-indigo-700 transition-colors">
            <Edit2 className="w-4 h-4 text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile Photo</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">JPG, PNG or GIF. Max 5MB</p>
          <button
            onClick={() => {
              setAvatarPreview(null);
              setAvatarFile(null);
              localStorage.removeItem('userAvatar');
              toast.success('Avatar removed');
            }}
            className="text-xs text-red-400 hover:text-red-600 mt-1 transition-colors"
          >
            Remove photo
          </button>
        </div>
      </div>

      <form onSubmit={handleProfileUpdate} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Username *
            </label>
            <input
              type="text"
              value={profileData.username}
              onChange={(e) => setProfileData({...profileData, username: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              disabled={!isAdmin}
            />
            {!isAdmin && (
              <p className="text-xs text-gray-400 mt-1">Username can only be changed by admin</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={profileData.fullname}
              onChange={(e) => setProfileData({...profileData, fullname: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email Address *
            </label>
            <input
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData({...profileData, email: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={profileData.phone}
              onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Address
            </label>
            <input
              type="text"
              value={profileData.address}
              onChange={(e) => setProfileData({...profileData, address: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Bio
            </label>
            <textarea
              value={profileData.bio}
              onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
              rows="3"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Tell us a little about yourself..."
            />
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Change Password
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={profileData.currentPassword}
                  onChange={(e) => setProfileData({...profileData, currentPassword: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={profileData.newPassword}
                onChange={(e) => setProfileData({...profileData, newPassword: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter new password (min 6 chars)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={profileData.confirmPassword}
                  onChange={(e) => setProfileData({...profileData, confirmPassword: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );

  // ===== RENDER PREFERENCES TAB =====
  const renderPreferencesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Palette className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Preferences</h3>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Theme
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['light', 'dark', 'system'].map((theme) => (
              <button
                key={theme}
                onClick={() => setPreferences({...preferences, theme})}
                className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                  preferences.theme === theme
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {theme === 'light' && <Sun className="w-5 h-5" />}
                  {theme === 'dark' && <Moon className="w-5 h-5" />}
                  {theme === 'system' && <Monitor className="w-5 h-5" />}
                  <span className="text-sm capitalize">{theme}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Language
            </label>
            <select
              value={preferences.language}
              onChange={(e) => setPreferences({...preferences, language: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Timezone
            </label>
            <select
              value={preferences.timezone}
              onChange={(e) => setPreferences({...preferences, timezone: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
              <option value="Asia/Singapore">Singapore (SGT)</option>
              <option value="Australia/Sydney">Sydney (AEDT)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Date Format
            </label>
            <select
              value={preferences.dateFormat}
              onChange={(e) => setPreferences({...preferences, dateFormat: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY/MM/DD">YYYY/MM/DD</option>
              <option value="MM-DD-YYYY">MM-DD-YYYY</option>
              <option value="DD-MM-YYYY">DD-MM-YYYY</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Currency
            </label>
            <select
              value={preferences.currency}
              onChange={(e) => setPreferences({...preferences, currency: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CHF">CHF (Fr)</option>
              <option value="CNY">CNY (¥)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handlePreferenceUpdate}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Preferences
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // ===== RENDER SECURITY TAB =====
  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Lock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Security Settings</h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
          <div>
            <h4 className="font-medium text-gray-800 dark:text-white">Two-Factor Authentication</h4>
            <p className="text-sm text-gray-400 dark:text-gray-500">Add an extra layer of security to your account</p>
          </div>
          <button
            onClick={() => setSecurity({...security, twoFactorAuth: !security.twoFactorAuth})}
            className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
              security.twoFactorAuth ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
              security.twoFactorAuth ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Session Timeout (minutes)
            </label>
            <input
              type="number"
              value={security.sessionTimeout}
              onChange={(e) => setSecurity({...security, sessionTimeout: parseInt(e.target.value)})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              min="5"
              max="120"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Password Expiry (days)
            </label>
            <input
              type="number"
              value={security.passwordExpiry}
              onChange={(e) => setSecurity({...security, passwordExpiry: parseInt(e.target.value)})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              min="30"
              max="365"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
          <div>
            <h4 className="font-medium text-gray-800 dark:text-white">Login Alerts</h4>
            <p className="text-sm text-gray-400 dark:text-gray-500">Get notified on new login attempts</p>
          </div>
          <button
            onClick={() => setSecurity({...security, loginAlerts: !security.loginAlerts})}
            className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
              security.loginAlerts ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
              security.loginAlerts ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={() => {
              toast.success('Security settings updated!');
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Update Security
          </button>
        </div>
      </div>
    </div>
  );

  // ===== RENDER NOTIFICATIONS TAB =====
  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Notification Settings</h3>
      </div>

      <div className="space-y-4">
        {Object.entries(notificationSettings).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <div>
              <h4 className="font-medium text-gray-800 dark:text-white capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </h4>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {value ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <button
              onClick={() => setNotificationSettings({...notificationSettings, [key]: !value})}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                value ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
                value ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleNotificationUpdate}
          disabled={saving}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Update Notifications
            </>
          )}
        </button>
      </div>
    </div>
  );

  // ===== RENDER SYSTEM TAB (ADMIN ONLY) =====
  const renderSystemTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">System Settings</h3>
        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
          Admin Only
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Store Name
          </label>
          <input
            type="text"
            value={systemSettings.storeName}
            onChange={(e) => setSystemSettings({...systemSettings, storeName: e.target.value})}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Store Email
          </label>
          <input
            type="email"
            value={systemSettings.storeEmail}
            onChange={(e) => setSystemSettings({...systemSettings, storeEmail: e.target.value})}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Store Phone
          </label>
          <input
            type="tel"
            value={systemSettings.storePhone}
            onChange={(e) => setSystemSettings({...systemSettings, storePhone: e.target.value})}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Currency Symbol
          </label>
          <input
            type="text"
            value={systemSettings.currencySymbol}
            onChange={(e) => setSystemSettings({...systemSettings, currencySymbol: e.target.value})}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Store Address
          </label>
          <input
            type="text"
            value={systemSettings.storeAddress}
            onChange={(e) => setSystemSettings({...systemSettings, storeAddress: e.target.value})}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Tax Rate (%)
          </label>
          <input
            type="number"
            value={systemSettings.taxRate}
            onChange={(e) => setSystemSettings({...systemSettings, taxRate: parseFloat(e.target.value)})}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            step="0.5"
            min="0"
            max="100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Timezone
          </label>
          <select
            value={systemSettings.storeTimezone}
            onChange={(e) => setSystemSettings({...systemSettings, storeTimezone: e.target.value})}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
          </select>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Store Features</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <span className="text-sm text-gray-700 dark:text-gray-300">Guest Checkout</span>
            <button
              onClick={() => setSystemSettings({...systemSettings, enableGuestCheckout: !systemSettings.enableGuestCheckout})}
              className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${
                systemSettings.enableGuestCheckout ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
                systemSettings.enableGuestCheckout ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <span className="text-sm text-gray-700 dark:text-gray-300">Require Approval for Orders</span>
            <button
              onClick={() => setSystemSettings({...systemSettings, requireApproval: !systemSettings.requireApproval})}
              className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${
                systemSettings.requireApproval ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
                systemSettings.requireApproval ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
            <span className="text-sm text-red-600 dark:text-red-400 font-medium">Maintenance Mode</span>
            <button
              onClick={() => setSystemSettings({...systemSettings, maintenanceMode: !systemSettings.maintenanceMode})}
              className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${
                systemSettings.maintenanceMode ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
                systemSettings.maintenanceMode ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSystemUpdate}
          disabled={saving}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save System Settings
            </>
          )}
        </button>
      </div>
    </div>
  );

  // ===== RENDER PERMISSIONS TAB (ADMIN ONLY) =====
  const renderPermissionsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Permissions</h3>
        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
          Admin Only
        </span>
      </div>

      <div className="space-y-6">
        {Object.entries(permissions).map(([module, modulePermissions]) => (
          <div key={module} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <h4 className="font-medium text-gray-800 dark:text-white capitalize mb-3 flex items-center gap-2">
              {module === 'users' && <Users className="w-4 h-4" />}
              {module === 'products' && <Package className="w-4 h-4" />}
              {module === 'orders' && <ShoppingCart className="w-4 h-4" />}
              {module === 'reports' && <FileText className="w-4 h-4" />}
              {module === 'settings' && <SettingsIcon className="w-4 h-4" />}
              {module} Management
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(modulePermissions).map(([permission, value]) => (
                <div key={permission} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() => {
                      setPermissions({
                        ...permissions,
                        [module]: {
                          ...permissions[module],
                          [permission]: !value
                        }
                      });
                    }}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{permission}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handlePermissionUpdate}
          disabled={saving}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Update Permissions
            </>
          )}
        </button>
      </div>
    </div>
  );

  // ===== RENDER USER MANAGEMENT TAB (ADMIN ONLY) =====
  const renderUserManagementTab = () => {
    const usersList = [
      { id: 1, username: 'admin', fullname: 'Admin User', email: 'admin@spms.com', role: 'Admin', status: 'Active', lastLogin: '2026-07-30 14:30' },
      { id: 2, username: 'manager1', fullname: 'John Manager', email: 'john@spms.com', role: 'Manager', status: 'Active', lastLogin: '2026-07-30 12:15' },
      { id: 3, username: 'cashier1', fullname: 'Jane Cashier', email: 'jane@spms.com', role: 'Cashier', status: 'Active', lastLogin: '2026-07-30 10:45' },
      { id: 4, username: 'viewer1', fullname: 'Bob Viewer', email: 'bob@spms.com', role: 'Viewer', status: 'Inactive', lastLogin: '2026-07-29 16:20' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">User Management</h3>
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
            Admin Only
          </span>
          <button
            className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-300 flex items-center gap-2 text-sm"
            onClick={() => toast.success('Add user modal would open here')}
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Login</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {usersList.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                        {user.fullname.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-white">{user.fullname}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.role === 'Admin' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                      user.role === 'Manager' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                      user.role === 'Cashier' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                      'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 text-xs ${
                      user.status === 'Active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{user.lastLogin}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="p-1 text-blue-500 hover:text-blue-700 transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-red-500 hover:text-red-700 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ===== RENDER BACKUP TAB (ADMIN ONLY) =====
  const renderBackupTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Backup & Restore</h3>
        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
          Admin Only
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-800 dark:text-white mb-2">Create Backup</h4>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Backup all system data and settings</p>
          <button
            onClick={handleCreateBackup}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Create Backup
              </>
            )}
          </button>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-800 dark:text-white mb-2">Restore Backup</h4>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Restore from a previous backup</p>
          <button
            onClick={() => toast.warning('Select a backup file to restore')}
            className="w-full px-4 py-2.5 border-2 border-amber-500 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Backup
          </button>
        </div>
      </div>

      <div className="p-6 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-800 dark:text-white">Recent Backups</h4>
          <span className="text-xs text-gray-400 dark:text-gray-500">{backups.length} backups</span>
        </div>
        <div className="space-y-2">
          {backups.map((backup) => (
            <div key={backup.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{backup.name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    <span>{backup.size}</span>
                    <span>•</span>
                    <span>{backup.date}</span>
                    <span className={`px-1.5 py-0.5 rounded ${
                      backup.type === 'Full' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {backup.type}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-1 text-blue-500 hover:text-blue-700 transition-colors" title="Download">
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteBackup(backup.id)}
                  className="p-1 text-red-500 hover:text-red-700 transition-colors" 
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ===== RENDER ROLE BADGE =====
  const renderRoleBadge = () => {
    const roleConfig = {
      'Admin': { color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400', icon: Crown },
      'Manager': { color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400', icon: Briefcase },
      'Cashier': { color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400', icon: UserCheck },
      'Viewer': { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400', icon: EyeIcon }
    };
    
    const config = roleConfig[userRole] || roleConfig['Viewer'];
    const Icon = config.icon;
    
    return (
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {userRole}
      </span>
    );
  };

  // ===== RENDER TAB CONTENT =====
  const renderTabContent = () => {
    switch(activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'preferences':
        return renderPreferencesTab();
      case 'security':
        return renderSecurityTab();
      case 'notifications':
        return renderNotificationsTab();
      case 'ai-assistant':
        return renderAiAssistantTab();
      case 'system':
        return renderSystemTab();
      case 'permissions':
        return renderPermissionsTab();
      case 'users':
        return renderUserManagementTab();
      case 'backup':
        return renderBackupTab();
      default:
        return renderProfileTab();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-gray-50 dark:bg-gray-900/50 p-4 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Settings
            </h2>
          </div>
          
          {/* User Role Badge */}
          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700/30 rounded-xl">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Role: {renderRoleBadge()}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {isAdmin && '🔴 Full access to all settings'}
              {isManager && '🟡 Access to most settings'}
              {isCashier && '🟢 Limited access to settings'}
              {isViewer && '🔵 View-only access'}
            </p>
          </div>
          
          <nav className="space-y-1">
            {accessibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isAdminOnly = tab.roles.includes('Admin') && tab.roles.length === 1;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                  <span className="text-sm font-medium">{tab.label}</span>
                  {isAdminOnly && (
                    <span className="ml-auto px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[8px] rounded">
                      ADMIN
                    </span>
                  )}
                  {tab.id === 'ai-assistant' && (
                    <span className="ml-auto px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[8px] rounded animate-pulse">
                      AI
                    </span>
                  )}
                  {isActive && (
                    <span className="ml-auto w-1 h-6 bg-indigo-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default Settings;