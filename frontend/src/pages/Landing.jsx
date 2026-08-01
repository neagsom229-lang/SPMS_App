// frontend/src/pages/Landing.jsx - Fixed Version
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import '../styles/landing.css';

// ✅ ONLY IMPORT CONFIRMED WORKING ICONS
import {
  ArrowRight,
  Star,
  Users,
  Shield,
  ChevronRight,
  Play,
  BarChart3,
  Truck,
  Boxes,
  Receipt,
  Landmark,
  Quote,
  Menu,
  X,
  LogIn,
  UserPlus,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ShoppingCart,
  Package,
  Warehouse,
  Award,
  Heart,
  Zap,
  Coffee,
  BookOpen,
  Target,
  Compass,
  Sparkles,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Globe,
  Send,
  MessageCircle,
  Headphones,
  LifeBuoy,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Link as LinkIcon,
  ExternalLink,
  Bot
} from 'lucide-react';

// ============================================================
// CUSTOM ICON COMPONENTS
// ============================================================

const TwitterIcon = ({ className, ...props }) => (
  <svg className={className} {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
    <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
  </svg>
);

const YoutubeIcon = ({ className, ...props }) => (
  <svg className={className} {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

const LinkedInIcon = ({ className, ...props }) => (
  <svg className={className} {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

// ============================================================
// HOOKS & HELPERS
// ============================================================

const getDisplayName = (user) => {
  if (!user) return '';
  return user.name || user.fullName || user.shopName || user.email || 'Account';
};

const getInitials = (user) => {
  const name = getDisplayName(user);
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatNumber = (value) =>
  Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '0';

// ============================================================
// LANDING COMPONENT
// ============================================================

const Landing = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ─── STATE ───
  const [isVisible, setIsVisible] = useState({});
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [testimonialPaused, setTestimonialPaused] = useState(false);
  const [heroIn, setHeroIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState('home');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobileMenuHeight, setMobileMenuHeight] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);
  const [isNewsletterLoading, setIsNewsletterLoading] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [openFaqs, setOpenFaqs] = useState({});

  // ===== AI ASSISTANT STATE =====
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    { 
      id: 1, 
      type: 'assistant', 
      message: '👋 Hello! I\'m your AI Assistant. How can I help you today?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [aiSuggestions] = useState([
    'How do I get started?',
    'What features do you offer?',
    'Tell me about pricing',
    'Do you offer support?',
    'Is there a free trial?'
  ]);

  // ===== AI RESPONSES =====
  const aiResponses = {
    'started': "🚀 Getting started with KhmerFlow is easy!\n\n1. Click 'Register' to create your account\n2. Set up your shop profile\n3. Add your products and prices\n4. Start selling at the counter\n5. Track your sales and inventory\n\n💡 Pro tip: Start with the free Market Stall plan to explore all features!",
    
    'features': "✨ KhmerFlow offers powerful features for your shop:\n\n• 📦 Smart Inventory Management\n• 💳 Fast Point of Sale\n• 📊 Insightful Reports\n• 🚚 Supplier Management\n• 👥 Customer Loyalty\n• 🔒 Secure & Reliable\n\nAll features are designed specifically for Cambodian small businesses!",
    
    'pricing': "💰 Simple pricing for every shop:\n\n🆓 Market Stall - $0/month\n• 1 staff account\n• 150 sales/month\n• Basic reports\n\n📈 Shophouse - $19/month\n• 5 staff accounts\n• Unlimited sales\n• Full features\n\n🏢 Chain - $49/month\n• Unlimited staff\n• Multi-branch\n• API access\n\nAll plans include free support!",
    
    'support': "🆘 We're here to help!\n\n📧 Email: support@khmerflow.com\n📞 Phone: +855 12 345 678\n💬 Live Chat: Available 24/7\n📚 Knowledge Base: Comprehensive guides\n\nWe typically respond within 24 hours!",
    
    'trial': "✅ Yes! You can start with the Market Stall plan for FREE forever.\n\n• No credit card required\n• Full features included\n• 1 staff account\n• 150 sales/month\n\nUpgrade anytime when you need more!",
    
    'default': "🤖 I'd be happy to help! I can answer questions about:\n\n• Getting started 🚀\n• Features ✨\n• Pricing 💰\n• Support 🆘\n• Free trial ✅\n\nJust ask me anything about KhmerFlow!"
  };

  // ─── AI HANDLERS ───
  const getAiResponse = (message) => {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('start') || lowerMsg.includes('get started') || lowerMsg.includes('begin')) {
      return aiResponses.started;
    } else if (lowerMsg.includes('feature') || lowerMsg.includes('offer') || lowerMsg.includes('capability')) {
      return aiResponses.features;
    } else if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('plan')) {
      return aiResponses.pricing;
    } else if (lowerMsg.includes('support') || lowerMsg.includes('help') || lowerMsg.includes('contact')) {
      return aiResponses.support;
    } else if (lowerMsg.includes('free') || lowerMsg.includes('trial') || lowerMsg.includes('demo')) {
      return aiResponses.trial;
    } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
      return "👋 Hello! Welcome to KhmerFlow! I'm your AI Assistant. How can I help you today?";
    } else {
      return aiResponses.default;
    }
  };

  const handleAiSend = async () => {
    if (!aiInput.trim()) return;

    const userMessage = {
      id: aiMessages.length + 1,
      type: 'user',
      message: aiInput,
      timestamp: new Date().toISOString()
    };
    setAiMessages(prev => [...prev, userMessage]);
    setAiInput('');
    setIsAiTyping(true);

    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 600));

    const response = getAiResponse(aiInput);
    const aiMessage = {
      id: aiMessages.length + 2,
      type: 'assistant',
      message: response,
      timestamp: new Date().toISOString()
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

  // ─── REFS ───
  const mobileMenuInnerRef = useRef(null);
  const navRef = useRef(null);
  const profileRefDesktop = useRef(null);
  const profileRefMobile = useRef(null);
  const sceneRef = useRef(null);
  const scrollTopRef = useRef(null);
  const chatEndRef = useRef(null);

  // ─── CONSTANTS ───
  const NAV_LINKS = [
    { id: 'home', label: 'Home' },
    { id: 'features', label: 'Features' },
    { id: 'how-it-works', label: 'How it works' },
    { id: 'testimonials', label: 'Testimonials' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'faq', label: 'FAQ' },
  ];

  const FEATURES = [
    { icon: Boxes, title: 'Smart Inventory Management', desc: 'Live stock counts across every branch, with low-stock alerts before you run out at the counter.', tag: 'Real-time sync', color: 'from-emerald-500 to-teal-500' },
    { icon: Receipt, title: 'Fast Point of Sale', desc: 'Fast checkout, printed or Telegram receipts, and offline mode for when the connection drops.', tag: '< 2s per sale', color: 'from-purple-500 to-pink-500' },
    { icon: BarChart3, title: 'Insightful Reports', desc: 'Daily revenue, best-sellers, and margin by product — in Khmer or English, on your phone.', tag: 'Daily digest', color: 'from-blue-500 to-indigo-500' },
    { icon: Truck, title: 'Supplier Management', desc: 'Reorder stock in two taps and track what is owed to each supplier without a paper ledger.', tag: 'No more notebooks', color: 'from-orange-500 to-amber-500' },
    { icon: Users, title: 'Customer Loyalty', desc: 'Remember regulars, run simple loyalty stamps, and see who your best customers really are.', tag: 'Repeat business', color: 'from-rose-500 to-red-500' },
    { icon: Shield, title: 'Secure & Reliable', desc: 'Role-based staff access and nightly backups, so a lost phone never means a lost shop.', tag: 'Bank-grade encryption', color: 'from-cyan-500 to-blue-500' },
  ];

  const STEPS = [
    { n: '01', title: 'Set up your shop', desc: 'Add your products, prices, and staff in under ten minutes — templates included for cafés, mini marts, and restaurants.' },
    { n: '02', title: 'Sell at the counter', desc: 'Ring up sales, take cash or ABA/Wing payments, and watch stock levels update automatically.' },
    { n: '03', title: 'Grow with the numbers', desc: 'Check the dashboard each evening to see what sold, what to reorder, and where you are making money.' },
  ];

  const TESTIMONIALS = [
    { name: 'Sopheak Chan', role: 'Owner, Boeng Keng Kang Coffee', content: 'Closing the shop used to take an hour of counting. Now I check KhmerFlow on my phone and I am done in five minutes.', initials: 'SC', rating: 5, avatar: 'https://ui-avatars.com/api/?name=Sopheak+Chan&background=6366f1&color=fff&size=60' },
    { name: 'Ratanak Vong', role: 'Manager, Mekong Mini Mart', content: 'We stopped running out of best-sellers because the low-stock alerts actually reach us before the shelf is empty.', initials: 'RV', rating: 5, avatar: 'https://ui-avatars.com/api/?name=Ratanak+Vong&background=6366f1&color=fff&size=60' },
    { name: 'Sreymom Kong', role: 'Founder, Kong Family Restaurant', content: 'My staff learned the till in a day. The reports are the first thing my accountant asks for now.', initials: 'SK', rating: 5, avatar: 'https://ui-avatars.com/api/?name=Sreymom+Kong&background=6366f1&color=fff&size=60' },
  ];

  const PLANS = [
    { name: 'Market Stall', price: '$0', period: '/month', description: 'One counter, kept honest', features: ['1 staff account', '150 sales/month', 'Basic daily report', 'Community support'], highlight: false },
    { name: 'Shophouse', price: '$19', period: '/month', description: 'Most Cambodian SMEs start here', features: ['5 staff accounts', 'Unlimited sales', 'Inventory + supplier tracking', 'Khmer & English reports', 'ABA / Wing payment tracking', 'Priority Telegram support'], highlight: true },
    { name: 'Chain', price: '$49', period: '/month', description: 'For multi-branch operators', features: ['Unlimited staff', 'Multi-branch dashboard', 'Custom reports & exports', 'API access', 'Dedicated onboarding'], highlight: false },
  ];

  const FAQS = [
    { q: 'Is there a free trial?', a: 'Yes! You can start with the Market Stall plan for free forever. No credit card required.' },
    { q: 'Can I change plans later?', a: 'Absolutely. You can upgrade or downgrade your plan at any time from your account settings.' },
    { q: 'Do you support offline mode?', a: 'Yes! KhmerFlow works offline and syncs automatically when you reconnect.' },
    { q: 'What payment methods do you accept?', a: 'We accept all major credit cards, ABA, Wing, and bank transfers.' },
  ];

  const dashboardStats = {
    totalRevenue: 45678.5,
    totalOrders: 342,
    totalCustomers: 1250,
    totalProducts: 48,
    todaySales: 1250.0,
    todayOrders: 8,
    conversionRate: 4.2,
    activeUsers: 24,
    totalRevenueGrowth: 18.6,
    avgOrderValue: 133.56,
  };

  // ─── SCROLL TO BOTTOM OF CHAT ───
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages]);

  // ─── TIME ───
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── REDUCED MOTION ───
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ─── HERO ENTRY ───
  useEffect(() => {
    const t = setTimeout(() => setHeroIn(true), 80);
    return () => clearTimeout(t);
  }, []);

  // ─── SCROLL ───
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        setScrolled(scrollY > 24);
        setShowScrollTop(scrollY > 600);
        const h = document.documentElement.scrollHeight - window.innerHeight;
        setScrollProgress(h > 0 ? (scrollY / h) * 100 : 0);
        ticking = false;
      });
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── SECTION OBSERVER ───
  useEffect(() => {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { threshold: 0.4, rootMargin: '-96px 0px -50% 0px' }
    );
    NAV_LINKS.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) sectionObserver.observe(el);
    });
    return () => sectionObserver.disconnect();
  }, []);

  // ─── REVEAL OBSERVER ───
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('.kf-reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // ─── TESTIMONIAL ROTATOR ───
  useEffect(() => {
    if (testimonialPaused || reducedMotion) return;
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [testimonialPaused, reducedMotion, TESTIMONIALS.length]);

  // ─── MOBILE MENU ───
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    const handleOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('pointerdown', handleOutside);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('pointerdown', handleOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!mobileMenuInnerRef.current) return;
    const el = mobileMenuInnerRef.current;
    const measure = () => setMobileMenuHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [user]);

  // ─── PROFILE MENU ───
  useEffect(() => {
    if (!profileOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') setProfileOpen(false); };
    const handleOutside = (e) => {
      const inDesktop = profileRefDesktop.current && profileRefDesktop.current.contains(e.target);
      const inMobile = profileRefMobile.current && profileRefMobile.current.contains(e.target);
      if (!inDesktop && !inMobile) setProfileOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('pointerdown', handleOutside);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('pointerdown', handleOutside);
    };
  }, [profileOpen]);

  // ─── SCENE PARALLAX ───
  const handleSceneMove = (e) => {
    if (reducedMotion || !sceneRef.current) return;
    const el = sceneRef.current;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--tiltX', `${py * -4}deg`);
    el.style.setProperty('--tiltY', `${px * 6}deg`);
  };

  const handleSceneLeave = () => {
    if (!sceneRef.current) return;
    sceneRef.current.style.setProperty('--tiltX', '0deg');
    sceneRef.current.style.setProperty('--tiltY', '0deg');
  };

  const handleCardMove = (e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  // ─── HANDLERS ───
  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  const goToDashboard = useCallback(() => {
    setProfileOpen(false);
    setMenuOpen(false);
    navigate('/dashboard');
  }, [navigate]);

  const scrollToSection = useCallback((id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      const offset = 80;
      const targetPosition = el.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: targetPosition, behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  }, [reducedMotion]);

  const handleLogoutFromMenu = useCallback(() => {
    setProfileOpen(false);
    setMenuOpen(false);
    handleLogout();
  }, [handleLogout]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [reducedMotion]);

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) {
      toast.error('Please enter your email');
      return;
    }
    setIsNewsletterLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setNewsletterSubmitted(true);
      setNewsletterEmail('');
      toast.success('✅ Subscribed successfully!');
      setTimeout(() => setNewsletterSubmitted(false), 3000);
    } catch (error) {
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setIsNewsletterLoading(false);
    }
  };

  const toggleFaq = (index) => {
    setOpenFaqs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // ─── RENDER STARS ───
  const renderStars = (count) => {
    return [...Array(5)].map((_, i) => (
      <Star key={i} className="w-4 h-4" style={{ fill: i < count ? 'var(--kf-gold)' : 'none', color: i < count ? 'var(--kf-gold)' : 'rgba(255,255,255,0.2)' }} />
    ));
  };

  // ===== RENDER AI CHAT WIDGET =====
  const renderAiChatWidget = () => (
    <div className="fixed bottom-24 right-4 z-50 w-80 sm:w-96">
      {showAiChat ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-slideUp">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between">
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
                      timestamp: new Date().toISOString()
                    }
                  ]);
                  toast.success('✅ Chat reset');
                }}
                className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAiChat(false)}
                className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="h-72 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/20">
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
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
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
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex gap-2">
              <input
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
              AI Assistant • Powered by SPMS AI
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAiChat(true)}
          className="w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center hover:scale-110 transition-all duration-300 animate-bounce relative group"
        >
          <Bot className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
          <span className="absolute -bottom-1 -left-1 text-[8px] bg-white text-indigo-600 rounded-full px-1.5 py-0.5 font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            AI
          </span>
        </button>
      )}
    </div>
  );

  return (
    <div className="kf-root min-h-screen overflow-x-hidden">

      {/* ================= GLOBAL COSMIC BACKGROUND ================= */}
      {/* Fixed to the viewport — sits behind the nav, hero, every       */}
      {/* section, and the footer. Mounted once here, not per-section,  */}
      {/* so it never scrolls away: content glides over it as the page  */}
      {/* scrolls, which reads as smooth continuous motion.             */}
      <div className="kf-cosmic-bg" aria-hidden="true">
        <div className="kf-stars">
          <div className="kf-star-layer kf-star-layer-1" />
          <div className="kf-star-layer kf-star-layer-2" />
          <div className="kf-star-layer kf-star-layer-3" />
          <span className="kf-shooting-star" />
          <span className="kf-shooting-star kf-shooting-star-2" />
        </div>
        <div className="kf-earth-wrap">
          <div className="kf-earth">
            <div className="kf-earth-ocean" />
            <div className="kf-earth-map" />
            <div className="kf-earth-clouds" />
            <div className="kf-earth-shade" />
            <div className="kf-earth-highlight" />
            <div className="kf-earth-grid" />
          </div>
          <div className="kf-earth-atmosphere" />
          <div className="kf-earth-orbit">
            <span className="kf-earth-sat" />
          </div>
        </div>
      </div>

      {/* SCROLL PROGRESS */}
      <div className="kf-progress" style={{ width: `${scrollProgress}%` }} role="progressbar" aria-label="Page scroll progress" aria-valuenow={Math.round(scrollProgress)} aria-valuemin={0} aria-valuemax={100} />

      {/* SCROLL TO TOP */}
      {showScrollTop && (
        <button ref={scrollTopRef} onClick={scrollToTop} className="kf-scroll-top" aria-label="Scroll to top">
          <ArrowRight className="w-5 h-5 rotate-[-90deg]" />
        </button>
      )}

      {/* AI CHAT WIDGET */}
      {renderAiChatWidget()}

      {/* ================= NAVBAR ================= */}
      <nav ref={navRef} className={`kf-nav ${scrolled ? 'kf-nav-scrolled' : ''}`} aria-label="Primary">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[58px] sm:h-[68px]">
            <button className="kf-nav-brand" onClick={() => scrollToSection('home')}>
              <span className="kf-nav-brand-mark" aria-hidden="true">SPMS</span>
              <span className="kf-display kf-nav-brand-text">KhmerFlow</span>
            </button>

            <div className="kf-nav-links hidden lg:flex">
              {NAV_LINKS.map((n) => (
                <button key={n.id} onClick={() => scrollToSection(n.id)} aria-current={activeSection === n.id ? 'true' : undefined} className={`kf-nav-link ${activeSection === n.id ? 'kf-nav-link-active' : ''}`}>
                  {n.label}
                </button>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <button onClick={handleRefresh} disabled={isRefreshing} className="kf-nav-btn-ghost" aria-label="Refresh data">
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>

              {user ? (
                <div className="kf-profile" ref={profileRefDesktop}>
                  <button className={`kf-profile-trigger ${profileOpen ? 'kf-profile-trigger-open' : ''}`} onClick={() => setProfileOpen((o) => !o)} aria-haspopup="menu" aria-expanded={profileOpen} aria-label="Account menu">
                    <span className="kf-avatar-badge kf-avatar-badge-nav" aria-hidden="true">{getInitials(user)}</span>
                    <ChevronDown className={`w-4 h-4 kf-profile-chevron ${profileOpen ? 'kf-profile-chevron-open' : ''}`} aria-hidden="true" />
                  </button>
                  {profileOpen && (
                    <div className="kf-profile-panel" role="menu">
                      <div className="kf-profile-panel-head">
                        <span className="kf-avatar-badge kf-avatar-badge-lg" aria-hidden="true">{getInitials(user)}</span>
                        <div className="kf-profile-panel-id">
                          <span className="kf-profile-name">{getDisplayName(user)}</span>
                          {user?.email && <span className="kf-profile-email">{user.email}</span>}
                        </div>
                      </div>
                      <div className="kf-profile-panel-divider" />
                      <button role="menuitem" className="kf-profile-item" onClick={goToDashboard}>
                        <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                        <span>Dashboard</span>
                      </button>
                      <button role="menuitem" className="kf-profile-item kf-profile-item-danger" onClick={handleLogoutFromMenu}>
                        <LogOut className="w-4 h-4" aria-hidden="true" />
                        <span>Log out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link to="/login" className="kf-nav-btn-ghost">
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    <span>Log in</span>
                  </Link>
                  <Link to="/register" className="kf-nav-btn-primary">
                    <UserPlus className="w-4 h-4" aria-hidden="true" />
                    <span>Register</span>
                  </Link>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              {user ? (
                <div className="kf-profile" ref={profileRefMobile}>
                  <button className={`kf-profile-trigger kf-profile-trigger-compact ${profileOpen ? 'kf-profile-trigger-open' : ''}`} onClick={() => setProfileOpen((o) => !o)} aria-haspopup="menu" aria-expanded={profileOpen} aria-label="Account menu">
                    <span className="kf-avatar-badge kf-avatar-badge-nav" aria-hidden="true">{getInitials(user)}</span>
                  </button>
                  {profileOpen && (
                    <div className="kf-profile-panel kf-profile-panel-mobile" role="menu">
                      <div className="kf-profile-panel-head">
                        <span className="kf-avatar-badge kf-avatar-badge-lg" aria-hidden="true">{getInitials(user)}</span>
                        <div className="kf-profile-panel-id">
                          <span className="kf-profile-name">{getDisplayName(user)}</span>
                          {user?.email && <span className="kf-profile-email">{user.email}</span>}
                        </div>
                      </div>
                      <div className="kf-profile-panel-divider" />
                      <button role="menuitem" className="kf-profile-item" onClick={goToDashboard}>
                        <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                        <span>Dashboard</span>
                      </button>
                      <button role="menuitem" className="kf-profile-item kf-profile-item-danger" onClick={handleLogoutFromMenu}>
                        <LogOut className="w-4 h-4" aria-hidden="true" />
                        <span>Log out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/register" className="kf-nav-btn-primary kf-nav-btn-compact">
                  <span>Register</span>
                </Link>
              )}
              <button className="kf-nav-toggle" onClick={() => setMenuOpen((o) => !o)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="kf-mobile-menu">
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        <div id="kf-mobile-menu" className={`kf-nav-mobile lg:hidden ${menuOpen ? 'kf-nav-mobile-open' : ''}`} style={{ maxHeight: menuOpen ? `${typeof window !== 'undefined' ? Math.min(mobileMenuHeight, window.innerHeight * 0.8) : mobileMenuHeight}px` : '0px' }}>
          <div ref={mobileMenuInnerRef} className="flex flex-col px-4 sm:px-6 py-3 gap-1">
            {NAV_LINKS.map((n) => (
              <button key={n.id} onClick={() => scrollToSection(n.id)} aria-current={activeSection === n.id ? 'true' : undefined} className={`kf-nav-mobile-link ${activeSection === n.id ? 'kf-nav-link-active' : ''}`}>
                {n.label}
              </button>
            ))}
            <div className="flex flex-col gap-1 mt-2 pt-3 pb-2 kf-nav-mobile-divider">
              {user ? (
                <>
                  <div className="kf-profile-panel-head kf-profile-panel-head-inline">
                    <span className="kf-avatar-badge kf-avatar-badge-lg" aria-hidden="true">{getInitials(user)}</span>
                    <div className="kf-profile-panel-id">
                      <span className="kf-profile-name">{getDisplayName(user)}</span>
                      {user?.email && <span className="kf-profile-email">{user.email}</span>}
                    </div>
                  </div>
                  <button onClick={goToDashboard} className="kf-profile-item kf-profile-item-block">
                    <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                    <span>Dashboard</span>
                  </button>
                  <button onClick={handleLogoutFromMenu} className="kf-profile-item kf-profile-item-block kf-profile-item-danger">
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    <span>Log out</span>
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="kf-nav-btn-ghost w-full justify-center" onClick={() => setMenuOpen(false)}>
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    <span>Log in</span>
                  </Link>
                  <Link to="/register" className="kf-nav-btn-primary w-full justify-center" onClick={() => setMenuOpen(false)}>
                    <UserPlus className="w-4 h-4" aria-hidden="true" />
                    <span>Register</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ================= HERO SECTION ================= */}
      <section id="home" className="kf-hero pt-24 sm:pt-32 pb-16 sm:pb-20 relative overflow-hidden">
        <div className="kf-aurora" aria-hidden="true" />
        <div className="kf-noise" aria-hidden="true" />

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-8">
              <div className={`kf-fade ${heroIn ? 'kf-fade-in' : ''}`}>
                <div className="kf-eyebrow">
                  <span className="kf-eyebrow-dot" aria-hidden="true" />
                  <span>New — real-time dashboard</span>
                  <span className="kf-eyebrow-stats"><span>Live</span></span>
                </div>
              </div>

              <div className={`kf-fade kf-fade-delay ${heroIn ? 'kf-fade-in' : ''}`}>
                <h1 className="kf-display kf-h1">
                  The dashboard your
                  <br />
                  <span className="kf-h1-accent">shop actually needs</span>
                </h1>
                <p className="kf-body kf-lede mt-6">See what's moving, what's low, and what you're making — all in one place. Built for Cambodian shop owners who want to focus on customers, not spreadsheets.</p>
              </div>

              <div className={`kf-fade kf-fade-delay-2 ${heroIn ? 'kf-fade-in' : ''}`}>
                <div className="flex flex-wrap gap-4">
                  {user ? (
                    <button onClick={goToDashboard} className="kf-btn-primary">
                      <span>Go to Dashboard</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <Link to="/register" className="kf-btn-primary">
                      <span>Start free today</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  )}
                  <button className="kf-btn-ghost" onClick={() => scrollToSection('features')}>
                    <span className="kf-play-dot"><Play className="w-3 h-3" aria-hidden="true" /></span>
                    <span>See how it works</span>
                  </button>
                </div>
              </div>

              <div className={`kf-fade kf-fade-delay-3 ${heroIn ? 'kf-fade-in' : ''}`}>
                <div className="kf-hero-stats">
                  <div className="kf-hero-stat">
                    <span className="kf-hero-stat-value">${formatNumber(Math.round(dashboardStats.totalRevenue))}</span>
                    <span className="kf-hero-stat-label">Revenue</span>
                  </div>
                  <div className="kf-hero-stat-divider" />
                  <div className="kf-hero-stat">
                    <span className="kf-hero-stat-value">{formatNumber(dashboardStats.totalOrders)}</span>
                    <span className="kf-hero-stat-label">Orders</span>
                  </div>
                  <div className="kf-hero-stat-divider" />
                  <div className="kf-hero-stat">
                    <span className="kf-hero-stat-value">{formatNumber(dashboardStats.totalCustomers)}</span>
                    <span className="kf-hero-stat-label">Customers</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`kf-fade kf-fade-delay ${heroIn ? 'kf-fade-in' : ''}`}>
              <div ref={sceneRef} className="kf-dash-scene" onMouseMove={handleSceneMove} onMouseLeave={handleSceneLeave} role="img" aria-label="KhmerFlow live dashboard preview">
                <div className="kf-dash-orbit kf-dash-orbit-1" aria-hidden="true" />
                <div className="kf-dash-orbit kf-dash-orbit-2" aria-hidden="true" />
                <div className="kf-dash-floor" aria-hidden="true" />
                <div className="kf-dash-orb kf-dash-orb-green" aria-hidden="true" />
                <div className="kf-dash-orb kf-dash-orb-gold" aria-hidden="true" />

                <div className="kf-dash-card kf-dash-card-settlement" aria-hidden="true">
                  <div className="kf-dash-card-label">REVENUE GROWTH</div>
                  <div className="kf-dash-card-value">+{dashboardStats.totalRevenueGrowth}%</div>
                </div>

                <div className="kf-dash-card kf-dash-card-incoming">
                  <span className="kf-dash-dot kf-dash-dot-green" aria-hidden="true" />
                  <div className="kf-dash-card-label">TODAY'S SALES</div>
                  <div className="kf-dash-card-value">${dashboardStats.todaySales.toFixed(2)} <span className="kf-dash-card-sub">· {dashboardStats.todayOrders} orders</span></div>
                </div>

                <div className="kf-dash-main">
                  <div className="kf-dash-main-row">
                    <div className="kf-dash-main-stat">
                      <div className="kf-dash-main-value">{formatNumber(dashboardStats.totalOrders)}</div>
                      <div className="kf-dash-main-label">TOTAL ORDERS</div>
                    </div>
                    <div className="kf-dash-main-divider" aria-hidden="true" />
                    <div className="kf-dash-main-stat">
                      <div className="kf-dash-main-value">{formatNumber(dashboardStats.totalCustomers)}</div>
                      <div className="kf-dash-main-label">TOTAL CUSTOMERS</div>
                    </div>
                  </div>

                  <div className="kf-dash-chart" aria-hidden="true">
                    <svg viewBox="0 0 300 70" preserveAspectRatio="none" className="kf-dash-chart-svg">
                      <path className="kf-dash-chart-path" d="M0,52 C 30,50 45,40 70,38 C 100,36 115,44 140,36 C 165,28 180,20 210,18 C 235,16 255,10 300,6" fill="none" />
                    </svg>
                  </div>

                  <div className="kf-dash-progress">
                    <div className="kf-dash-progress-track">
                      <div className="kf-dash-progress-fill kf-dash-progress-fill-lg" />
                    </div>
                    <div className="kf-dash-progress-track kf-dash-progress-track-sm">
                      <div className="kf-dash-progress-fill kf-dash-progress-fill-sm" />
                    </div>
                  </div>
                </div>

                <div className="kf-dash-card kf-dash-card-webhook">
                  <span className="kf-dash-dot kf-dash-dot-green" aria-hidden="true" />
                  <div className="kf-dash-card-label">CONVERSION</div>
                  <div className="kf-dash-card-value">{dashboardStats.conversionRate}% rate</div>
                </div>

                <div className="kf-dash-card kf-dash-card-api">
                  <span className="kf-dash-dot kf-dash-dot-green" aria-hidden="true" />
                  <div className="kf-dash-card-label">ACTIVE NOW</div>
                  <div className="kf-dash-card-value">{formatNumber(dashboardStats.activeUsers)} staff</div>
                </div>

                <div className="kf-dash-time">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>{currentTime.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="kf-section kf-anchor">
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-2xl mb-16">
            <span className="kf-eyebrow kf-eyebrow-light">Everything on the till</span>
            <h2 className="kf-display kf-h2 mt-4">Made for how shops actually run</h2>
            <p className="kf-body kf-lede-sm mt-4">Every feature answers a real question an owner asks at closing time — not a checkbox on a features page.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} id={`feature-${i}`} className={`kf-card kf-reveal ${isVisible[`feature-${i}`] ? 'kf-reveal-in' : ''}`} style={{ transitionDelay: `${i * 80}ms` }} onMouseMove={handleCardMove} onMouseEnter={() => setHoveredCard(i)} onMouseLeave={() => setHoveredCard(null)}>
                  <div className={`kf-card-icon bg-gradient-to-br ${f.color}`}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <h3 className="kf-display kf-card-title">{f.title}</h3>
                  <p className="kf-body kf-card-desc">{f.desc}</p>
                  <span className="kf-pill">{f.tag}</span>
                  {hoveredCard === i && <div className="kf-card-glow" />}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how-it-works" className="kf-section-alt kf-anchor">
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-2xl mb-16">
            <span className="kf-eyebrow kf-eyebrow-light">From setup to closing</span>
            <h2 className="kf-display kf-h2 mt-4">Three steps, one evening</h2>
          </div>

          <div className="kf-steps">
            {STEPS.map((s, i) => (
              <div key={i} id={`step-${i}`} className={`kf-step kf-reveal ${isVisible[`step-${i}`] ? 'kf-reveal-in' : ''}`} style={{ transitionDelay: `${i * 120}ms` }}>
                <span className="kf-mono kf-step-n" aria-hidden="true">{s.n}</span>
                <h3 className="kf-display kf-step-title">{s.title}</h3>
                <p className="kf-body kf-card-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TESTIMONIALS ================= */}
      <section id="testimonials" className="kf-section kf-anchor">
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-2xl mb-16 mx-auto text-center">
            <span className="kf-eyebrow kf-eyebrow-light">From owners, not actors</span>
            <h2 className="kf-display kf-h2 mt-4">What running the shop feels like now</h2>
          </div>

          <div className="max-w-3xl mx-auto" onMouseEnter={() => setTestimonialPaused(true)} onMouseLeave={() => setTestimonialPaused(false)} onFocus={() => setTestimonialPaused(true)} onBlur={() => setTestimonialPaused(false)}>
            <div className="kf-quote-card">
              <Quote className="kf-quote-mark" aria-hidden="true" />
              <div key={activeTestimonial} className="kf-quote-crossfade">
                <p className="kf-display kf-quote-text">{TESTIMONIALS[activeTestimonial].content}</p>
                <div className="flex items-center gap-4 mt-8">
                  <img src={TESTIMONIALS[activeTestimonial].avatar} alt={TESTIMONIALS[activeTestimonial].name} className="kf-avatar-img" />
                  <div>
                    <div className="kf-body font-semibold" style={{ color: 'var(--kf-cream)' }}>{TESTIMONIALS[activeTestimonial].name}</div>
                    <div className="kf-caption">{TESTIMONIALS[activeTestimonial].role}</div>
                  </div>
                  <div className="flex ml-auto gap-1" aria-hidden="true">
                    {renderStars(TESTIMONIALS[activeTestimonial].rating)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-2 mt-8" role="tablist" aria-label="Choose testimonial">
              {TESTIMONIALS.map((t, index) => (
                <button key={index} role="tab" aria-selected={index === activeTestimonial} aria-label={`Show testimonial from ${t.name}`} onClick={() => setActiveTestimonial(index)} className={`kf-tdot ${index === activeTestimonial ? 'kf-tdot-active' : ''}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= PRICING ================= */}
      <section id="pricing" className="kf-section-alt kf-anchor">
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-2xl mb-16 mx-auto text-center">
            <span className="kf-eyebrow kf-eyebrow-light">Simple pricing, in dollars</span>
            <h2 className="kf-display kf-h2 mt-4">Priced for a first shop, ready for ten</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            {PLANS.map((plan, i) => (
              <div key={i} id={`plan-${i}`} className={`kf-plan kf-reveal ${plan.highlight ? 'kf-plan-highlight' : ''} ${isVisible[`plan-${i}`] ? 'kf-reveal-in' : ''}`} style={{ transitionDelay: `${i * 100}ms` }} onMouseMove={handleCardMove}>
                {plan.highlight && <span className="kf-plan-badge">Most popular</span>}
                <h3 className="kf-display kf-plan-name">{plan.name}</h3>
                <p className="kf-caption mb-6">{plan.description}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="kf-mono kf-plan-price">{plan.price}</span>
                  <span className="kf-caption">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 kf-body text-sm">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--kf-gold)' }} aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {user ? (
                  <button onClick={goToDashboard} className={plan.highlight ? 'kf-btn-primary w-full justify-center' : 'kf-btn-outline w-full justify-center'}>
                    Go to Dashboard
                  </button>
                ) : (
                  <Link to="/register" className={plan.highlight ? 'kf-btn-primary w-full justify-center' : 'kf-btn-outline w-full justify-center'}>
                    Choose {plan.name}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FAQ SECTION ================= */}
      <section id="faq" className="kf-section kf-anchor">
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="kf-eyebrow kf-eyebrow-light">Got questions?</span>
              <h2 className="kf-display kf-h2 mt-4">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-4">
              {FAQS.map((faq, index) => {
                const isOpen = openFaqs[index] || false;
                return (
                  <div key={index} className="kf-faq-item">
                    <button
                      className="kf-faq-question"
                      onClick={() => toggleFaq(index)}
                      aria-expanded={isOpen}
                    >
                      <span className="kf-faq-q">{faq.q}</span>
                      <ChevronDown className={`kf-faq-icon ${isOpen ? 'kf-faq-icon-open' : ''}`} />
                    </button>
                    <div className={`kf-faq-answer ${isOpen ? 'kf-faq-answer-open' : ''}`}>
                      <p>{faq.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="kf-cta">
        <div className="kf-motif kf-motif-cta" aria-hidden="true" />
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24 relative z-10 text-center">
          <Landmark className="w-8 h-8 mx-auto mb-6" style={{ color: 'var(--kf-gold)' }} aria-hidden="true" />
          <h2 className="kf-display kf-h2" style={{ color: 'var(--kf-cream)' }}>Your shop deserves a ledger this clear.</h2>
          <p className="kf-body kf-lede-sm mt-4 max-w-xl mx-auto" style={{ color: 'rgba(241,238,255,0.72)' }}>Set up in one evening. Free for your first counter, forever.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            {user ? (
              <button onClick={goToDashboard} className="kf-btn-primary">
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <Link to="/register" className="kf-btn-primary">
                <span>Start free today</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            )}
            <button className="kf-btn-ghost-inverse" onClick={() => scrollToSection('pricing')}>See full pricing</button>
          </div>
          
          <div className="max-w-md mx-auto mt-12">
            <p className="text-sm text-white/60 mb-3">Subscribe to our newsletter for tips and updates</p>
            <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
              <input type="email" value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)} placeholder="Enter your email" className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400" required />
              <button type="submit" disabled={isNewsletterLoading} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {isNewsletterLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : newsletterSubmitted ? <CheckCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="kf-footer">
        <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="kf-footer-grid grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10">
            <div>
              <div className="kf-display kf-footer-brand">KhmerFlow</div>
              <p className="kf-caption mt-3 max-w-[20ch]">Point of sale &amp; inventory for Cambodian small business.</p>
              <div className="flex gap-3 mt-4">
                <a href="#" className="kf-social-link" aria-label="Twitter"><TwitterIcon className="w-4 h-4" /></a>
                {/* <a href="#" className="kf-social-link" aria-label="YouTube"><YoutubeIcon className="w-4 h-4" /></a> */}
                <a href="https://www.linkedin.com/in/chheang-samnang-b95825406?utm_source=share_via&utm_content=profile&utm_medium=member_ios" className="kf-social-link" aria-label="LinkedIn"><LinkedInIcon className="w-4 h-4" /></a>
                <a href="https://t.me/+855979325903" className="kf-social-link" aria-label="Telegram"><Send className="w-4 h-4" /></a>
              </div>
            </div>
            <div>
              <h4 className="kf-footer-head">Product</h4>
              <ul className="space-y-2">
                <li><button className="kf-footer-link" onClick={() => scrollToSection('features')}>Features</button></li>
                <li><button className="kf-footer-link" onClick={() => scrollToSection('pricing')}>Pricing</button></li>
                <li><button className="kf-footer-link" onClick={() => scrollToSection('faq')}>FAQ</button></li>
                <li><a href="#" className="kf-footer-link">What's new</a></li>
              </ul>
            </div>
            <div>
              <h4 className="kf-footer-head">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="kf-footer-link">About</a></li>
                <li><a href="#" className="kf-footer-link">Blog</a></li>
                <li><a href="#" className="kf-footer-link">Careers</a></li>
                <li><a href="#" className="kf-footer-link">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="kf-footer-head">Support</h4>
              <ul className="space-y-2">
               <li> <Link to="/help" className="kf-footer-link">  Help Center</Link> </li>
                <li><a href="https://t.me/+855979325903" className="kf-footer-link">Telegram</a></li>
                <li><a href="#" className="kf-footer-link">Privacy policy</a></li>
                <li><a href="#" className="kf-footer-link">Terms of service</a></li>
              </ul>
            </div>
          </div>
          <div className="kf-footer-rule mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="kf-caption">© 2026 KhmerFlow.SPMS. 🇰🇭</span>
            <div className="flex gap-6">
              
              <a href="#" className="kf-footer-link">Twitter</a>
              <a href="#" className="kf-footer-link">YouTube</a>
              <a href="https://www.linkedin.com/in/chheang-samnang-b95825406?utm_source=share_via&utm_content=profile&utm_medium=member_ios" className="kf-footer-link">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;