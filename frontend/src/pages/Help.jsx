// frontend/src/pages/Help.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import emailjs from '@emailjs/browser';
import {
  HelpCircle,
  BookOpen,
  Video,
  Mail,
  Phone,
  MessageCircle,
  Send,
  Search,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Download,
  Printer,
  Share2,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Package,
  ShoppingCart,
  Users,
  Shield,
  Settings,
  TrendingUp,
  Award,
  Star,
  Heart,
  Zap,
  Coffee,
  Headphones,
  LifeBuoy,
  Sparkles,
  Lightbulb,
  Target,
  Compass,
  MapPin,
  Globe,
  X,
  Plus,
  Minus,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Link,
  Flag,
  MessageSquare,
  Bot,
  UserCircle,
  Calendar,
  Check,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Home
} from 'lucide-react';
import '../styles/help.css';

// ============================================
// EMAILJS CONFIGURATION
// ============================================
const EMAILJS_CONFIG = {
  PUBLIC_KEY: "AEsAC3UstlEZRZPAS",
  SERVICE_ID: "service_iwsm69t",
  TEMPLATE_ID: "template_m132nie",
  TO_EMAIL: "chheangsamnang.wu@gmail.com",
};

// Initialize EmailJS
emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);

// ============================================
// HELP COMPONENT
// ============================================
const Help = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ===== STATE =====
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [contactForm, setContactForm] = useState({
    name: user?.fullname || user?.username || '',
    email: user?.email || '',
    subject: '',
    message: '',
    priority: 'normal'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { id: 1, type: 'bot', message: '👋 Hello! How can I help you today?', time: 'Just now' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [feedback, setFeedback] = useState({});
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatTyping, setIsChatTyping] = useState(false);

  // ===== REFS =====
  const chatEndRef = useRef(null);
  const searchInputRef = useRef(null);
  const formRef = useRef(null);

  // ===== NAVIGATION FUNCTIONS =====
  const goBack = () => navigate(-1);
  const goToHome = () => navigate('/dashboard');
  const goToPage = (path) => navigate(path);

  // ===== FAQ DATA =====
  const faqs = [
    {
      id: 'getting-started',
      category: 'getting-started',
      icon: BookOpen,
      title: 'Getting Started',
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      questions: [
        {
          q: 'How do I create an account?',
          a: 'To create an account, click on the "Sign Up" button on the login page. Fill in your details including username, email, and password. You\'ll receive a verification email to activate your account.'
        },
        {
          q: 'How do I log in to my account?',
          a: 'Go to the login page, enter your username and password, then click "Login". If you forgot your password, click the "Forgot Password" link to reset it.'
        },
        {
          q: 'What are the system requirements?',
          a: 'Our system works on all modern browsers including Chrome, Firefox, Safari, and Edge. For the best experience, we recommend using the latest version of Chrome or Firefox.'
        }
      ]
    },
    {
      id: 'products',
      category: 'products',
      icon: Package,
      title: 'Managing Products',
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      questions: [
        {
          q: 'How do I add a new product?',
          a: 'Go to Products > Add Product. Fill in the product details including name, description, price, stock quantity, and category. Click "Save" to add the product to your inventory.'
        },
        {
          q: 'How do I update product information?',
          a: 'Navigate to Products, find the product you want to edit, and click the edit icon. Update the necessary fields and click "Save" to apply the changes.'
        },
        {
          q: 'How do I delete a product?',
          a: 'Go to Products, find the product you want to delete, and click the delete icon. Confirm the deletion to permanently remove the product from your inventory.'
        }
      ]
    },
    {
      id: 'orders',
      category: 'orders',
      icon: ShoppingCart,
      title: 'Orders & Checkout',
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      questions: [
        {
          q: 'How do I create a new order?',
          a: 'Go to Orders > New Order. Select the customer, add products to the order, apply any discounts, and click "Create Order". You can also create orders from the customer profile.'
        },
        {
          q: 'How do I process a payment?',
          a: 'After creating an order, go to the order details page and click "Process Payment". Select the payment method, enter the payment details, and confirm the transaction.'
        },
        {
          q: 'How do I refund an order?',
          a: 'Go to the order details page, click "Refund", select the items to refund, and confirm the refund amount. The refund will be processed through the original payment method.'
        }
      ]
    },
    {
      id: 'customers',
      category: 'customers',
      icon: Users,
      title: 'Customer Management',
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      questions: [
        {
          q: 'How do I add a new customer?',
          a: 'Go to Customers > Add Customer. Fill in the customer details including name, email, phone, and address. Click "Save" to add the customer to your database.'
        },
        {
          q: 'How do I view customer history?',
          a: 'Click on a customer\'s name in the customers list to view their profile. You\'ll see their order history, purchase patterns, and contact information.'
        },
        {
          q: 'How do I manage customer loyalty?',
          a: 'Go to Customer > Loyalty Program. You can set up rewards, track points, and manage customer tiers. Customers earn points for purchases and referrals.'
        }
      ]
    },
    {
      id: 'reports',
      category: 'reports',
      icon: TrendingUp,
      title: 'Reports & Analytics',
      color: 'text-rose-500',
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      questions: [
        {
          q: 'What types of reports are available?',
          a: 'We offer sales reports, inventory reports, customer analytics, revenue reports, and performance dashboards. Each report can be filtered by date range and exported in various formats.'
        },
        {
          q: 'How do I generate a sales report?',
          a: 'Go to Reports > Sales. Select the date range, choose the report type, and click "Generate". You can export the report as PDF, Excel, or CSV.'
        },
        {
          q: 'How do I track inventory performance?',
          a: 'Go to Reports > Inventory. You can view stock levels, turnover rates, and identify slow-moving items. The dashboard provides real-time inventory insights.'
        }
      ]
    },
    {
      id: 'security',
      category: 'security',
      icon: Shield,
      title: 'Security & Privacy',
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
      questions: [
        {
          q: 'How do I change my password?',
          a: 'Go to Settings > Security. Enter your current password, then your new password. Confirm the new password and click "Update" to save the changes.'
        },
        {
          q: 'How do I set up two-factor authentication?',
          a: 'Go to Settings > Security > Two-Factor Authentication. Enable 2FA and follow the setup instructions to link your authenticator app or receive SMS codes.'
        },
        {
          q: 'How do I manage user permissions?',
          a: 'Admins can go to Settings > Users. Click on a user to view their permissions. You can assign or revoke permissions based on their role and responsibilities.'
        }
      ]
    }
  ];

  // ===== VIDEO TUTORIALS =====
  const tutorials = [
    {
      id: 1,
      title: 'Getting Started with SPMS',
      description: 'Learn the basics of using SPMS',
      duration: '5:30',
      category: 'getting-started',
      thumbnail: '🎬',
      views: '1.2k',
      date: '2026-07-25'
    },
    {
      id: 2,
      title: 'Managing Products Effectively',
      description: 'Complete guide to product management',
      duration: '8:15',
      category: 'products',
      thumbnail: '🎬',
      views: '856',
      date: '2026-07-20'
    },
    {
      id: 3,
      title: 'Processing Orders',
      description: 'Step-by-step order processing guide',
      duration: '6:45',
      category: 'orders',
      thumbnail: '🎬',
      views: '1.5k',
      date: '2026-07-18'
    },
    {
      id: 4,
      title: 'Advanced Reporting',
      description: 'Master data analytics and reporting',
      duration: '10:20',
      category: 'reports',
      thumbnail: '🎬',
      views: '432',
      date: '2026-07-15'
    }
  ];

  // ===== CONTACT SUPPORT OPTIONS =====
  const supportOptions = [
    { 
      icon: Mail, 
      label: 'Email Support', 
      value: 'support@spms.com',
      action: 'mailto:support@spms.com',
      description: 'We\'ll respond within 24 hours',
      color: 'text-blue-500'
    },
    { 
      icon: Phone, 
      label: 'Phone Support', 
      value: '+855 12 345 678',
      action: 'tel:+85512345678',
      description: 'Mon-Fri, 8AM - 6PM',
      color: 'text-emerald-500'
    },
    { 
      icon: MessageCircle, 
      label: 'Live Chat', 
      value: 'Chat with us',
      description: 'Available 24/7',
      action: '#chat',
      color: 'text-purple-500'
    },
    { 
      icon: Globe, 
      label: 'Knowledge Base', 
      value: 'Documentation',
      description: 'Comprehensive guides',
      action: '#docs',
      color: 'text-indigo-500'
    }
  ];

  // ===== CATEGORIES =====
  const categories = [
    { id: 'all', label: 'All', icon: HelpCircle },
    { id: 'getting-started', label: 'Getting Started', icon: BookOpen },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'reports', label: 'Reports', icon: TrendingUp },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  // ===== FILTER FAQS =====
  const filteredFaqs = useMemo(() => {
    return faqs.filter(faq => {
      if (activeCategory === 'all') return true;
      return faq.category === activeCategory;
    });
  }, [activeCategory]);

  const searchedFaqs = useMemo(() => {
    return filteredFaqs.filter(faq => {
      if (!searchQuery) return true;
      const searchLower = searchQuery.toLowerCase();
      return faq.title.toLowerCase().includes(searchLower) ||
             faq.questions.some(q => 
               q.q.toLowerCase().includes(searchLower) ||
               q.a.toLowerCase().includes(searchLower)
             );
    });
  }, [filteredFaqs, searchQuery]);

  const totalFaqs = useMemo(() => {
    return searchedFaqs.reduce((acc, faq) => acc + faq.questions.length, 0);
  }, [searchedFaqs]);

  // ===== HANDLERS =====
  const toggleFaq = (id) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    
    if (!contactForm.message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (!contactForm.email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    if (!contactForm.name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setIsSubmitting(true);

    try {
      const templateParams = {
        from_name: contactForm.name,
        from_email: contactForm.email,
        subject: contactForm.subject || 'General Inquiry',
        message: contactForm.message,
        priority: contactForm.priority,
        to_email: EMAILJS_CONFIG.TO_EMAIL,
        reply_to: contactForm.email,
        user_role: user?.role || 'User',
        user_username: user?.username || 'Guest',
        timestamp: new Date().toLocaleString()
      };

      const result = await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        templateParams
      );

      console.log('✅ Email sent successfully:', result.text);
      toast.success('✅ Your message has been sent! We\'ll respond within 24 hours.');
      
      setContactForm({
        ...contactForm,
        subject: '',
        message: '',
        priority: 'normal'
      });
      
      if (formRef.current) {
        formRef.current.reset();
      }
      
    } catch (error) {
      console.error('❌ Email send error:', error);
      toast.error('❌ Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChatSend = useCallback(() => {
    if (!chatInput.trim()) return;
    
    const userMessage = {
      id: chatMessages.length + 1,
      type: 'user',
      message: chatInput,
      time: 'Just now'
    };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatTyping(true);

    setTimeout(() => {
      const botResponses = [
        'That\'s a great question! Let me help you with that. 🤖',
        'I understand. Here\'s what you need to know... 📝',
        'Sure! Let me explain that in detail. 📚',
        'Thanks for asking! Here\'s the answer. 💡',
        'I\'m here to help! Let me check that for you. 🔍',
        'Great question! Here\'s what I found... 📖',
        'Let me break that down for you step by step. 📋',
        'I\'ve got the answer you\'re looking for! 🎯'
      ];
      const botMessage = {
        id: chatMessages.length + 2,
        type: 'bot',
        message: botResponses[Math.floor(Math.random() * botResponses.length)],
        time: 'Just now'
      };
      setChatMessages(prev => [...prev, botMessage]);
      setIsChatTyping(false);
    }, 1200);
  }, [chatInput, chatMessages.length]);

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  const handleFeedback = (faqId, type) => {
    setFeedback(prev => ({
      ...prev,
      [faqId]: type
    }));
    toast.success(`Thank you for your feedback! ${type === 'helpful' ? '👍' : '👎'}`);
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handleShare = (platform) => {
    const url = window.location.href;
    const title = 'SPMS Help Center - Find answers to your questions';
    
    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`
    };
    
    window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    toast.success(`Shared on ${platform.charAt(0).toUpperCase() + platform.slice(1)}!`);
  };

  const clearChat = () => {
    setChatMessages([
      { id: 1, type: 'bot', message: '👋 Hello! How can I help you today?', time: 'Just now' }
    ]);
    toast.success('Chat history cleared');
  };

  // ===== EFFECTS =====
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setShowChat(false);
        setShowShare(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // ===== RENDER FUNCTIONS =====
  const renderFaqSection = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Frequently Asked Questions</h2>
          <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs rounded-full">
            {totalFaqs} answers
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600"
            title="Copy link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowShare(!showShare)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showShare && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl"
        >
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">Share: </span>
          <button onClick={() => handleShare('twitter')} className="p-1.5 bg-[#1DA1F2] text-white rounded-lg hover:scale-110 transition-transform text-xs flex items-center gap-1">
            <Twitter className="w-3 h-3" /> Twitter
          </button>
          <button onClick={() => handleShare('facebook')} className="p-1.5 bg-[#4267B2] text-white rounded-lg hover:scale-110 transition-transform text-xs flex items-center gap-1">
            <Facebook className="w-3 h-3" /> Facebook
          </button>
          <button onClick={() => handleShare('linkedin')} className="p-1.5 bg-[#0077B5] text-white rounded-lg hover:scale-110 transition-transform text-xs flex items-center gap-1">
            <Linkedin className="w-3 h-3" /> LinkedIn
          </button>
          <button onClick={() => handleShare('email')} className="p-1.5 bg-gray-600 text-white rounded-lg hover:scale-110 transition-transform text-xs flex items-center gap-1">
            <Mail className="w-3 h-3" /> Email
          </button>
        </motion.div>
      )}

      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          return (
            <motion.button
              key={category.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {category.label}
            </motion.button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for answers..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {searchedFaqs.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">No results found</h3>
          <p className="text-gray-400 dark:text-gray-500 mt-1">Try adjusting your search terms</p>
        </div>
      ) : (
        searchedFaqs.map((faq) => {
          const Icon = faq.icon;
          return (
            <motion.div 
              key={faq.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
            >
              <div className={`p-4 ${faq.bg} border-b border-gray-200 dark:border-gray-700`}>
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${faq.color}`} />
                  <h3 className="font-semibold text-gray-800 dark:text-white">{faq.title}</h3>
                </div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {faq.questions.map((item, index) => {
                  const faqId = `${faq.id}-${index}`;
                  const isExpanded = expandedFaq === faqId;
                  const feedbackType = feedback[faqId];
                  
                  return (
                    <div key={index} className="group">
                      <button
                        onClick={() => toggleFaq(faqId)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-gray-800 dark:text-white">
                          {item.q}
                        </span>
                        <div className="flex items-center gap-2">
                          {feedbackType === 'helpful' && (
                            <ThumbsUp className="w-4 h-4 text-emerald-500" />
                          )}
                          {feedbackType === 'not-helpful' && (
                            <ThumbsDown className="w-4 h-4 text-red-500" />
                          )}
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                      {isExpanded && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed"
                        >
                          {item.a}
                          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-xs text-gray-400">Was this helpful?</span>
                            <button
                              onClick={() => handleFeedback(faqId, 'helpful')}
                              className={`p-1 rounded-lg transition-colors ${feedbackType === 'helpful' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600'}`}
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleFeedback(faqId, 'not-helpful')}
                              className={`p-1 rounded-lg transition-colors ${feedbackType === 'not-helpful' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600'}`}
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })
      )}
    </motion.div>
  );

  const renderTutorials = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
          <Video className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Video Tutorials
        </h2>
        <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors">
          View all →
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tutorials.map((tutorial) => (
          <motion.div
            key={tutorial.id}
            whileHover={{ y: -4, scale: 1.02 }}
            className="group bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 hover:shadow-lg transition-all duration-300 cursor-pointer border border-transparent hover:border-indigo-300 dark:hover:border-indigo-700"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300 relative">
                {tutorial.thumbnail}
                <div className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center">
                    <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-indigo-600 border-b-8 border-b-transparent ml-1" />
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-800 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {tutorial.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {tutorial.description}
                </p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {tutorial.duration}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {tutorial.views}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                    {tutorial.category}
                  </span>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors flex-shrink-0 mt-1" />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderContactSupport = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="space-y-4"
    >
      <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
        <Headphones className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        Contact Support
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {supportOptions.map((option, index) => {
          const Icon = option.icon;
          return (
            <motion.a
              key={index}
              whileHover={{ y: -4, scale: 1.02 }}
              href={option.action}
              onClick={(e) => {
                if (option.label === 'Live Chat') {
                  e.preventDefault();
                  setShowChat(true);
                }
              }}
              className="group bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 hover:shadow-lg transition-all duration-300 border border-transparent hover:border-indigo-300 dark:hover:border-indigo-700"
            >
              <div className="flex flex-col items-center text-center">
                <div className={`w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 ${option.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h4 className="font-medium text-gray-800 dark:text-white text-sm">{option.label}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{option.value}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{option.description}</p>
              </div>
            </motion.a>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-600" />
          Send us a message
        </h3>
        <form ref={formRef} onSubmit={handleContactSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={contactForm.name}
                onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Subject
            </label>
            <select
              value={contactForm.subject}
              onChange={(e) => setContactForm({...contactForm, subject: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Select a subject</option>
              <option value="Account Issues">Account Issues</option>
              <option value="Billing & Payments">Billing & Payments</option>
              <option value="Technical Support">Technical Support</option>
              <option value="Product Questions">Product Questions</option>
              <option value="Feature Requests">Feature Requests</option>
              <option value="Bug Report">Bug Report</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Message
            </label>
            <textarea
              value={contactForm.message}
              onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
              rows="4"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Describe your issue in detail..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Priority
            </label>
            <select
              value={contactForm.priority}
              onChange={(e) => setContactForm({...contactForm, priority: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="low">Low - General inquiry</option>
              <option value="normal">Normal - Need assistance</option>
              <option value="high">High - Urgent issue</option>
              <option value="critical">Critical - System down</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <AlertCircle className="w-4 h-4" />
            We typically respond within 24 hours
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Message
              </>
            )}
          </motion.button>
        </form>
      </div>
    </motion.div>
  );

  const renderChatWidget = () => (
    <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96">
      {showChat ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-white font-medium text-sm">Support Assistant</h4>
                <p className="text-white/70 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block animate-pulse" />
                  Online • AI Powered
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={clearChat}
                className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowChat(false)}
                className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/20">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-xl ${
                    msg.type === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${msg.type === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            ))}
            {isChatTyping && (
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

          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleChatKeyPress}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim()}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 text-center">
              Powered by AI • Responses are automated
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowChat(true)}
          className="w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center hover:scale-110 transition-all duration-300 animate-bounce"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
        </motion.button>
      )}
    </div>
  );

  // ===== MAIN RENDER =====
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 sm:py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        
        {/* ===== BACK BUTTONS ===== */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3 mb-6"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={goBack}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all duration-300 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
            <span className="font-medium">Back</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={goToHome}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 group"
          >
            <Home className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
            <span className="font-medium">Dashboard</span>
          </motion.button>

          <div className="flex items-center gap-2 ml-auto text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span>Home</span>
            </span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">Help & Support</span>
          </div>
        </motion.div>

        {/* ===== HEADER ===== */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400 text-sm font-medium mb-4">
            <LifeBuoy className="w-4 h-4" />
            Help & Support Center
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-white mb-3">
            How can we help you?
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Find answers to common questions, watch tutorials, or get in touch with our support team
          </p>
        </motion.div>

        {/* ===== CONTENT SECTIONS ===== */}
        <div className="space-y-8">
          {renderFaqSection()}
          {renderTutorials()}
          {renderContactSupport()}
        </div>

        {/* ===== FOOTER ===== */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <button 
              onClick={() => goToPage('/dashboard')}
              className="hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              <Home className="w-3 h-3" /> Dashboard
            </button>
            <span>•</span>
            <button className="hover:text-indigo-600 transition-colors">📖 Documentation</button>
            <span>•</span>
            <button className="hover:text-indigo-600 transition-colors">🐛 Report a Bug</button>
            <span>•</span>
            <button className="hover:text-indigo-600 transition-colors">💡 Feature Request</button>
            <span>•</span>
            <button className="hover:text-indigo-600 transition-colors">🔒 Privacy Policy</button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            © 2026 SPMS • All rights reserved • Made with ❤️
          </p>
        </div>
      </div>

      {/* ===== CHAT WIDGET ===== */}
      <AnimatePresence>
        {renderChatWidget()}
      </AnimatePresence>

      {/* ===== STYLES ===== */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out forwards; }
        .animate-slideDown { animation: slideDown 0.3s ease-out forwards; }
        .animate-bounce { animation: bounce 2s infinite; }
      `}</style>
    </div>
  );
};

export default Help;