import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import {
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Package,
  TrendingUp,
  TrendingDown,
  Filter,
  X,
  Download,
  Printer,
  Eye,
  Loader2,
  Database,
  BarChart3,
  Clock,
  Zap,
  Shield,
  Award,
  ArrowUp,
  ArrowDown,
  Grid3x3,
  List,
  ChevronRight,
  ClipboardList,
  AlertTriangle,
  ShoppingBag,
  Layers,
  Box,
  DollarSign,
  Sparkles,
  Gift,
  Star,
  Plus,
  Edit2,
  Trash2,
  Save
} from "lucide-react";

// ============================================
// API CONFIGURATION - FIXED ✅
// ============================================
const API_BASE = import.meta.env?.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Request interceptor - ensures /api is always present
api.interceptors.request.use(
  config => {
    // Auto-add /api if missing and URL is relative
    if (config.url && !config.url.startsWith('/api') && !config.url.startsWith('http')) {
      config.url = `/api${config.url}`;
    }
    console.log('📤 API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  error => Promise.reject(error)
);

api.interceptors.response.use(
  response => {
    console.log('📥 API Response:', response.status, response.config.url);
    return response;
  },
  error => {
    console.error('❌ API Error:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ============================================
// MAIN STOCK COMPONENT
// ============================================
const Stock = () => {
  // ===== STATE =====
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStock, setEditingStock] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [submitting, setSubmitting] = useState(false);

  // ===== FORM DATA =====
  const [formData, setFormData] = useState({
    stockId: '',
    productId: '',
    productName: '',
    qtyInStock: 0,
    qtyAvailable: 0,
    qtyReserved: 0,
    action: 'set'
  });

  // ===== REFS =====
  const isMounted = useRef(true);
  const searchTimeout = useRef(null);
  const headerRef = useRef(null);

  // ===== MOUSE TRACKING =====
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ===== GENERATE MOCK STOCK DATA =====
  const generateMockStock = useCallback(() => {
    return [
      { stockid: 1, productid: 1, product_code: 'PROD001', name_en: 'Laptop Pro', name_kh: 'កុំព្យូទ័រយួរដៃ', qtyinstock: 15, qtyavailable: 12, qtyreserved: 3, qty_alert: 10, saleout_price: 1299.99 },
      { stockid: 2, productid: 2, product_code: 'PROD002', name_en: 'Smartphone X', name_kh: 'ទូរស័ព្ទ X', qtyinstock: 25, qtyavailable: 20, qtyreserved: 5, qty_alert: 10, saleout_price: 899.99 },
      { stockid: 3, productid: 3, product_code: 'PROD003', name_en: 'Tablet Plus', name_kh: 'ថេប្លេត Plus', qtyinstock: 5, qtyavailable: 3, qtyreserved: 2, qty_alert: 10, saleout_price: 499.99 },
      { stockid: 4, productid: 4, product_code: 'PROD004', name_en: 'Wireless Mouse', name_kh: 'កណ្ដុរឥតខ្សែ', qtyinstock: 50, qtyavailable: 48, qtyreserved: 2, qty_alert: 10, saleout_price: 29.99 },
      { stockid: 5, productid: 5, product_code: 'PROD005', name_en: 'Keyboard Pro', name_kh: 'ក្ដារចុច Pro', qtyinstock: 30, qtyavailable: 28, qtyreserved: 2, qty_alert: 10, saleout_price: 79.99 },
    ];
  }, []);

  // ===== FETCH STOCK - FIXED ✅ =====
  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/stock");
      if (isMounted.current) {
        // ✅ CRITICAL FIX: Ensure we always have an array
        const data = Array.isArray(res.data) ? res.data : [];
        if (data.length > 0) {
          setStock(data);
          showMessage(`✅ Loaded ${data.length} stock items`, "success");
        } else {
          const mockData = generateMockStock();
          setStock(mockData);
          showMessage("⚠️ No stock data found, using sample data", "warning");
        }
      }
    } catch (error) {
      console.error("❌ Error fetching stock:", error);
      if (isMounted.current) {
        const mockData = generateMockStock();
        setStock(mockData);
        showMessage("⚠️ Using sample stock data", "warning");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [generateMockStock]);

  // ===== SHOW MESSAGE =====
  const showMessage = useCallback((text, type = "success") => {
    setMessage(text);
    setMessageType(type);
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, []);

  // ===== INITIAL LOAD =====
  useEffect(() => {
    isMounted.current = true;
    fetchStock();

    return () => {
      isMounted.current = false;
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [fetchStock]);

  // ===== REFRESH =====
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStock();
  };

  // ===== GET STOCK STATUS =====
  const getStockStatus = useCallback((qty, alert) => {
    const available = Number(qty) || 0;
    const alertLevel = Number(alert) || 10;

    if (available <= 0) {
      return { label: "Out of Stock", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800", icon: AlertCircle, priority: 3 };
    }
    if (available <= alertLevel) {
      return { label: "Low Stock", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800", icon: AlertTriangle, priority: 2 };
    }
    return { label: "In Stock", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800", icon: CheckCircle, priority: 1 };
  }, []);

  // ===== GET STOCK VALUE - FIXED ✅ =====
  const getStockValue = useCallback((item, field) => {
    if (!item || typeof item !== 'object') return 0;
    return Number(item[field]) || 0;
  }, []);

  // ===== FORMAT PRICE =====
  const formatPrice = (price) => {
    return `$${Number(price || 0).toFixed(2)}`;
  };

  // ===== FILTER STOCK - FIXED ✅ =====
  const filteredStock = useMemo(() => {
    // ✅ CRITICAL FIX: Ensure stock is always an array
    const stockArray = Array.isArray(stock) ? stock : [];
    let result = [...stockArray];

    if (search) {
      const term = search.toLowerCase();
      result = result.filter((item) => {
        const name = (item.name_en || '').toLowerCase();
        const nameKh = (item.name_kh || '').toLowerCase();
        const id = String(item.product_code || '');
        return name.includes(term) || nameKh.includes(term) || id.includes(term);
      });
    }

    if (filterStatus !== "all") {
      result = result.filter((item) => {
        const available = getStockValue(item, "qtyavailable");
        const alert = getStockValue(item, "qty_alert");
        const status = getStockStatus(available, alert);
        const statusKey = status.label.replace(/\s/g, "").toLowerCase();
        return statusKey === filterStatus.toLowerCase();
      });
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = (a.name_en || '').localeCompare(b.name_en || '');
          break;
        case "stock":
          comparison = getStockValue(a, "qtyavailable") - getStockValue(b, "qtyavailable");
          break;
        case "alert":
          comparison = getStockValue(a, "qty_alert") - getStockValue(b, "qty_alert");
          break;
        case "price":
          comparison = getStockValue(a, "saleout_price") - getStockValue(b, "saleout_price");
          break;
        default:
          comparison = (a.name_en || '').localeCompare(b.name_en || '');
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [stock, search, filterStatus, sortBy, sortOrder, getStockValue, getStockStatus]);

  // ===== CALCULATE STATS - FIXED ✅ =====
  const stats = useMemo(() => {
    // ✅ CRITICAL FIX: Ensure stock is always an array
    const stockArray = Array.isArray(stock) ? stock : [];
    
    const total = stockArray.length;
    let lowStock = 0;
    let outOfStock = 0;
    let healthy = 0;
    let totalValue = 0;

    stockArray.forEach((item) => {
      const available = getStockValue(item, "qtyavailable");
      const alert = getStockValue(item, "qty_alert");
      const price = getStockValue(item, "saleout_price");
      const status = getStockStatus(available, alert);

      if (status.priority === 3) outOfStock++;
      else if (status.priority === 2) lowStock++;
      else healthy++;

      totalValue += available * price;
    });

    return { total, lowStock, outOfStock, healthy, totalValue };
  }, [stock, getStockValue, getStockStatus]);

  // ===== OPEN EDIT MODAL =====
  const openEditModal = useCallback((item) => {
    setEditingStock(item);
    setFormData({
      stockId: item.stockid || '',
      productId: item.product_code || '',
      productName: item.name_en || '',
      qtyInStock: item.qtyinstock || 0,
      qtyAvailable: item.qtyavailable || 0,
      qtyReserved: item.qtyreserved || 0,
      action: 'set'
    });
    setShowEditModal(true);
  }, []);

  // ===== CLOSE EDIT MODAL =====
  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingStock(null);
    setFormData({
      stockId: '',
      productId: '',
      productName: '',
      qtyInStock: 0,
      qtyAvailable: 0,
      qtyReserved: 0,
      action: 'set'
    });
  }, []);

  // ===== HANDLE UPDATE STOCK =====
  const handleUpdateStock = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        QtyInStock: parseInt(formData.qtyInStock) || 0,
        QtyAvailable: parseInt(formData.qtyAvailable) || 0,
        QtyReserved: parseInt(formData.qtyReserved) || 0,
        action: formData.action || 'set'
      };

      const res = await api.put(`/stock/${formData.stockId}`, payload);
      
      if (res.data) {
        showMessage('✅ Stock updated successfully!', 'success');
        closeEditModal();
        fetchStock();
      }
    } catch (error) {
      console.error('❌ Update stock error:', error);
      showMessage('❌ Failed to update stock', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== EXPORT CSV - FIXED ✅ =====
  const exportCSV = () => {
    // ✅ CRITICAL FIX: Ensure stock is always an array
    const stockArray = Array.isArray(stock) ? stock : [];
    if (!stockArray.length) {
      showMessage("⚠️ No data to export", "warning");
      return;
    }

    try {
      const headers = ["Product ID", "Product Name", "In Stock", "Reserved", "Available", "Alert Level", "Status", "Price"];
      let csv = headers.join(",") + "\n";

      stockArray.forEach((item) => {
        const available = getStockValue(item, "qtyavailable");
        const alert = getStockValue(item, "qty_alert");
        const status = getStockStatus(available, alert);
        const row = [
          item.product_code || "",
          `"${item.name_en || ''}"`,
          getStockValue(item, "qtyinstock"),
          getStockValue(item, "qtyreserved"),
          available,
          alert,
          status.label,
          getStockValue(item, "saleout_price").toFixed(2),
        ];
        csv += row.join(",") + "\n";
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showMessage("✅ Stock exported successfully!", "success");
    } catch (error) {
      console.error("❌ Export error:", error);
      showMessage("❌ Failed to export stock", "error");
    }
  };

  // ===== VIEW PRODUCT DETAIL =====
  const viewProductDetail = (item) => {
    setSelectedProduct(item);
    setShowDetailModal(true);
  };

  // ===== RENDER STATUS BADGE =====
  const renderStatusBadge = (status) => {
    const StatusIcon = status.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 hover:scale-105 ${status.color}`}>
        <StatusIcon className="w-3 h-3" />
        {status.label}
      </span>
    );
  };

  // ===== GET STAT ICON =====
  const getStatIcon = (type) => {
    const icons = {
      total: <Package className="w-5 h-5 text-indigo-500" />,
      healthy: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      lowStock: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
      outOfStock: <AlertCircle className="w-5 h-5 text-red-500" />,
      totalValue: <DollarSign className="w-5 h-5 text-purple-500" />,
    };
    return icons[type] || icons.total;
  };

  // ===== GET PRODUCT EMOJI =====
  const getProductEmoji = useCallback((name) => {
    const emojis = ['📱', '💻', '⌨️', '🖥️', '📷', '🎧', '⌚', '📡', '🔋', '💾', '🖱️', '📀', '💿', '📹', '🎮', '📺', '🔊', '📻', '⏰', '💡'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return emojis[Math.abs(hash) % emojis.length];
  }, []);

  // ===== GET STOCK HEALTH COLOR =====
  const getStockHealthColor = (available, alert) => {
    const qty = Number(available) || 0;
    const alertLevel = Number(alert) || 10;
    if (qty <= 0) return "bg-red-500";
    if (qty <= alertLevel) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  // ===== GET STOCK HEALTH PERCENTAGE =====
  const getStockHealthPercentage = (available, alert) => {
    const qty = Number(available) || 0;
    const alertLevel = Number(alert) || 10;
    if (qty <= 0) return 0;
    if (qty <= alertLevel) return (qty / alertLevel) * 50;
    return Math.min(100, 50 + ((qty - alertLevel) / (alertLevel * 2)) * 50);
  };

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 animate-ping" />
          </div>
        </div>
        <p className="text-gray-400 font-medium">Loading stock data...</p>
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0s" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0.2s" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen">
      
      {/* ===== MESSAGE TOAST ===== */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 max-w-md w-full p-4 rounded-xl shadow-2xl border transform transition-all duration-500 animate-slideInRight ${
          messageType === "success" 
            ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
            : messageType === "error"
            ? "bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
            : messageType === "warning"
            ? "bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300"
            : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
        }`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {messageType === "success" && <CheckCircle className="w-5 h-5 text-green-500" />}
              {messageType === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
              {messageType === "warning" && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
              {messageType === "info" && <Database className="w-5 h-5 text-blue-500" />}
            </div>
            <div className="flex-1 text-sm font-medium">{message}</div>
            <button onClick={() => setMessage("")} className="flex-shrink-0 opacity-50 hover:opacity-100 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===== HEADER WITH STATS ===== */}
      <div 
        ref={headerRef}
        className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden transition-all duration-300"
        style={{
          transform: `perspective(1000px) rotateX(${(mousePosition.y / window.innerHeight - 0.5) * 2}deg) rotateY(${(mousePosition.x / window.innerWidth - 0.5) * 2}deg)`,
          transition: 'transform 0.1s ease-out'
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-purple-300/20 rounded-full animate-pulse-slow animation-delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full animate-spin-slow" />
        </div>

        <div className="relative z-10 flex flex-wrap justify-between items-center">
          <div className="animate-fadeInUp">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-white/80 tracking-wider uppercase">Inventory Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Package className="w-8 h-8" />
              Stock Management
            </h1>
            <p className="text-indigo-100 mt-1 text-sm">Monitor and manage your inventory levels</p>
          </div>
          <div className="flex items-center gap-3 mt-3 sm:mt-0">
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl text-sm flex items-center gap-2 border border-white/10 animate-pulse-slow">
              <Clock className="w-4 h-4 text-white/80" />
              {new Date().toLocaleTimeString()}
            </div>
            <button onClick={handleRefresh} disabled={isRefreshing} className="bg-white/20 backdrop-blur-sm p-2 rounded-xl hover:bg-white/30 transition hover:scale-110 duration-300">
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <button onClick={exportCSV} className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl hover:bg-white/30 transition hover:scale-105 duration-300 flex items-center gap-2 border border-white/10">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 relative z-10">
          {[
            { label: "Total Products", value: stats.total, icon: "total" },
            { label: "In Stock", value: stats.healthy, icon: "healthy" },
            { label: "Low Stock", value: stats.lowStock, icon: "lowStock" },
            { label: "Out of Stock", value: stats.outOfStock, icon: "outOfStock" },
            { label: "Total Value", value: `$${stats.totalValue.toFixed(2)}`, icon: "totalValue" },
          ].map((stat, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 hover:bg-white/20 transition-all duration-300 hover:scale-105 animate-slideUp border border-white/5" style={{ animationDelay: `${index * 0.08}s` }}>
              <div className="flex items-center gap-2">
                {getStatIcon(stat.icon)}
                <p className="text-xs text-indigo-200">{stat.label}</p>
              </div>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== CONTROLS ===== */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-all duration-300">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[200px] group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors w-4 h-4" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search by name, ID..." className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 group-hover:border-indigo-300" />
            </div>

            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 hover:border-indigo-300">
              <option value="all">All Status</option>
              <option value="instock">In Stock</option>
              <option value="lowstock">Low Stock</option>
              <option value="outofstock">Out of Stock</option>
            </select>

            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none px-2">
                <option value="name">Name</option>
                <option value="stock">Stock</option>
                <option value="alert">Alert Level</option>
                <option value="price">Price</option>
              </select>
              <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")} className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-600 transition-all duration-300 hover:scale-110">
                {sortOrder === "asc" ? <ArrowUp className="w-4 h-4 text-gray-500" /> : <ArrowDown className="w-4 h-4 text-gray-500" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
              <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-all duration-300 hover:scale-110 ${viewMode === "grid" ? "bg-white dark:bg-gray-600 shadow-sm text-indigo-600" : "hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"}`} title="Grid view">
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-lg transition-all duration-300 hover:scale-110 ${viewMode === "list" ? "bg-white dark:bg-gray-600 shadow-sm text-indigo-600" : "hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"}`} title="List view">
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== STOCK GRID ===== */}
      {filteredStock.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center hover:shadow-lg transition-all duration-300">
          <Package className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4 animate-float" />
          <h3 className="text-xl font-medium text-gray-600 dark:text-gray-400">No stock records found</h3>
          <p className="text-gray-400 dark:text-gray-500 mt-2">{search || filterStatus !== "all" ? "Try adjusting your search or filters" : "Add products to start tracking inventory"}</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStock.map((item, index) => {
            const productId = item.product_code;
            const productName = item.name_en || 'Unknown';
            const productNameKh = item.name_kh || '';
            const qtyInStock = getStockValue(item, "qtyinstock");
            const qtyReserved = getStockValue(item, "qtyreserved");
            const qtyAvailable = getStockValue(item, "qtyavailable");
            const alertLevel = getStockValue(item, "qty_alert");
            const salePrice = getStockValue(item, "saleout_price");
            const status = getStockStatus(qtyAvailable, alertLevel);
            const healthPercentage = getStockHealthPercentage(qtyAvailable, alertLevel);
            const healthColor = getStockHealthColor(qtyAvailable, alertLevel);
            const emoji = getProductEmoji(productName);

            return (
              <div key={item.stockid || index} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 transition-all duration-500 hover:shadow-xl hover:-translate-y-2 group animate-fadeIn ${
                status.priority === 3 ? "border-red-200 dark:border-red-800/50 hover:border-red-300" :
                status.priority === 2 ? "border-yellow-200 dark:border-yellow-800/50 hover:border-yellow-300" :
                "border-gray-100 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700"
              }`} style={{ animationDelay: `${index * 0.04}s` }}>
                <div className={`p-5 rounded-t-2xl bg-gradient-to-r ${status.gradient || 'from-gray-50 to-gray-100/50'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white/50 dark:bg-gray-700/50 text-2xl transition-all duration-300 group-hover:scale-110">
                        {emoji}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 dark:text-white text-sm truncate max-w-[130px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {productName}
                        </h3>
                        {productNameKh && <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[130px]">{productNameKh}</p>}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-gray-400">#{productId}</span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500 dark:text-gray-400">Stock Health</span>
                      <span className="font-medium dark:text-white">{qtyAvailable} units</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${healthColor} rounded-full transition-all duration-1000`} style={{ width: `${healthPercentage}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg transition-all duration-300 group-hover:scale-105">
                      <p className="text-[10px] text-gray-400">Total</p>
                      <p className="text-sm font-bold dark:text-white">{qtyInStock}</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg transition-all duration-300 group-hover:scale-105">
                      <p className="text-[10px] text-gray-400">Reserved</p>
                      <p className="text-sm font-bold dark:text-white">{qtyReserved}</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg transition-all duration-300 group-hover:scale-105">
                      <p className="text-[10px] text-gray-400">Alert</p>
                      <p className="text-sm font-bold dark:text-white">{alertLevel}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-xs text-gray-400">Sale Price</p>
                      <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                        {formatPrice(salePrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStatusBadge(status)}
                      <button onClick={(e) => { e.stopPropagation(); viewProductDetail(item); }} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110" title="View details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openEditModal(item); }} className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110" title="Edit stock">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">Reserved</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Available</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">Alert Level</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">Price</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredStock.map((item, index) => {
                  const productName = item.name_en || 'Unknown';
                  const qtyInStock = getStockValue(item, "qtyinstock");
                  const qtyReserved = getStockValue(item, "qtyreserved");
                  const qtyAvailable = getStockValue(item, "qtyavailable");
                  const alertLevel = getStockValue(item, "qty_alert");
                  const salePrice = getStockValue(item, "saleout_price");
                  const status = getStockStatus(qtyAvailable, alertLevel);
                  const emoji = getProductEmoji(productName);

                  return (
                    <tr key={item.stockid || index} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all duration-300 group animate-slideIn ${status.priority === 3 ? "bg-red-50/30 dark:bg-red-900/5" : status.priority === 2 ? "bg-yellow-50/30 dark:bg-yellow-900/5" : ""}`} style={{ animationDelay: `${index * 0.03}s` }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{emoji}</span>
                          <div>
                            <p className="font-medium text-sm dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{productName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium dark:text-white">{qtyInStock}</td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 hidden sm:table-cell">{qtyReserved}</td>
                      <td className={`px-4 py-3 text-right font-bold ${qtyAvailable <= alertLevel ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{qtyAvailable}</td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 hidden md:table-cell">{alertLevel}</td>
                      <td className="px-4 py-3 text-right font-medium dark:text-white hidden lg:table-cell">{formatPrice(salePrice)}</td>
                      <td className="px-4 py-3 text-center">{renderStatusBadge(status)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => viewProductDetail(item)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 group-hover:scale-110" title="View details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditModal(item)} className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-300 group-hover:scale-110" title="Edit stock">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-4 border-t border-gray-200 dark:border-gray-700">
        <p className="flex items-center justify-center gap-4 flex-wrap">
          <span>📦 {filteredStock.length} products displayed</span>
          <span>•</span>
          <span>💾 {stats.total} total products</span>
          <span>•</span>
          <span>⚠️ {stats.lowStock} low stock alerts</span>
          <span>•</span>
          <span>💰 ${stats.totalValue.toFixed(2)} total inventory value</span>
          <span>•</span>
          <span>{new Date().toLocaleString()}</span>
        </p>
      </div>

      {/* ===== DETAIL MODAL ===== */}
      {showDetailModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                Product Details
              </h2>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-300 hover:rotate-90">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</p>
                  <p className="text-lg font-bold dark:text-white">{selectedProduct.name_en || 'Unknown'}</p>
                  {selectedProduct.name_kh && <p className="text-sm text-gray-400 dark:text-gray-500">{selectedProduct.name_kh}</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product ID</p>
                  <p className="font-medium dark:text-white">{selectedProduct.product_code}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</p>
                  <div className="mt-1">{renderStatusBadge(getStockStatus(getStockValue(selectedProduct, "qtyavailable"), getStockValue(selectedProduct, "qty_alert")))}</div>
                </div>
              </div>

              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-500" />
                Stock Information
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                  <p className="text-xs text-gray-400">In Stock</p>
                  <p className="text-lg font-bold dark:text-white">{getStockValue(selectedProduct, "qtyinstock")}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                  <p className="text-xs text-gray-400">Reserved</p>
                  <p className="text-lg font-bold dark:text-white">{getStockValue(selectedProduct, "qtyreserved")}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                  <p className="text-xs text-gray-400">Available</p>
                  <p className={`text-lg font-bold ${getStockValue(selectedProduct, "qtyavailable") <= getStockValue(selectedProduct, "qty_alert") ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{getStockValue(selectedProduct, "qtyavailable")}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                  <p className="text-xs text-gray-400">Alert Level</p>
                  <p className="text-lg font-bold dark:text-white">{getStockValue(selectedProduct, "qty_alert")}</p>
                </div>
              </div>

              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Pricing
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                  <p className="text-xs text-gray-400">Sale Price</p>
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{formatPrice(getStockValue(selectedProduct, "saleout_price"))}</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => { setShowDetailModal(false); openEditModal(selectedProduct); }} className="px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-medium flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                Edit Stock
              </button>
              <button onClick={() => setShowDetailModal(false)} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium flex items-center gap-2">
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== EDIT STOCK MODAL ===== */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                Edit Stock - {formData.productName}
              </h2>
              <button onClick={closeEditModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-300 hover:rotate-90" disabled={submitting}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleUpdateStock} className="p-6">
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
                  <p className="text-xs text-gray-400">Product ID</p>
                  <p className="font-medium dark:text-white">{formData.productId}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Update Action</label>
                  <select
                    value={formData.action}
                    onChange={(e) => setFormData({...formData, action: e.target.value})}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    disabled={submitting}
                  >
                    <option value="set">Set Exact Values</option>
                    <option value="add">Add to Current</option>
                    <option value="reduce">Reduce from Current</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">In Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.qtyInStock}
                      onChange={(e) => setFormData({...formData, qtyInStock: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Available</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.qtyAvailable}
                      onChange={(e) => setFormData({...formData, qtyAvailable: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reserved</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.qtyReserved}
                      onChange={(e) => setFormData({...formData, qtyReserved: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={closeEditModal} className="px-6 py-2.5 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition dark:text-white font-medium disabled:opacity-50" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Update Stock
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;