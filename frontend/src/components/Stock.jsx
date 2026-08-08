// frontend/src/pages/Stock.jsx - Fixed Version
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import {
  Search, RefreshCw, AlertCircle, CheckCircle, Package, Clock,
  X, Download, Eye, Loader2, Database, ArrowUp, ArrowDown,
  Grid3x3, List, AlertTriangle, Layers, DollarSign, Edit2, Save,
  Trash2, Plus, Filter, Info
} from "lucide-react";
import '../styles/stock.css';

// ============================================================
//  STOCK TABLE SCHEMA (Neon PostgreSQL)
//  ----------------------------------
//  CREATE TABLE IF NOT EXISTS tbl_stock (
//    stockid SERIAL PRIMARY KEY,
//    productid INTEGER NOT NULL,
//    qtyinstock INTEGER DEFAULT 0,
//    qtyavailable INTEGER DEFAULT 0,
//    qtyreserved INTEGER DEFAULT 0,
//    lastupdated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//    CONSTRAINT stock_productid_unique UNIQUE (productid)
//  );
//
//  *Backend now uses INSERT ... ON CONFLICT (UPSERT) on productid.
// ============================================================

// -------- Helpers (all in one place) --------
const extractArrayData = (responseData, extraKeys = []) => {
  if (typeof responseData === "string" && responseData.includes("<!DOCTYPE html>")) return null;
  if (Array.isArray(responseData)) return responseData;
  if (responseData && typeof responseData === "object") {
    if (Array.isArray(responseData.data)) return responseData.data;
    for (const key of extraKeys) {
      if (Array.isArray(responseData[key])) return responseData[key];
    }
    if (responseData.data && typeof responseData.data === "object") {
      for (const key of extraKeys) {
        if (Array.isArray(responseData.data[key])) return responseData.data[key];
      }
      const values = Object.values(responseData.data);
      if (values.length > 0 && Array.isArray(values[0])) return values[0];
    }
  }
  return [];
};


const getStockValue = (item, field) => {
  if (!item || typeof item !== 'object') return 0;
  const value = item[field] || item[field.toLowerCase()] || item[field.toUpperCase()] || 0;
  return Number(value) || 0;
};

const getStockStatus = (available, alert) => {
  const qty = Number(available) || 0;
  const alertLevel = Number(alert) || 10;
  if (qty <= 0) return { label: "Out of Stock", color: "status-outofstock", icon: AlertCircle, priority: 3, gradient: "from-red-50 to-red-100/50 dark:from-red-900/10 dark:to-red-800/5" };
  if (qty <= alertLevel) return { label: "Low Stock", color: "status-lowstock", icon: AlertTriangle, priority: 2, gradient: "from-yellow-50 to-yellow-100/50 dark:from-yellow-900/10 dark:to-yellow-800/5" };
  return { label: "In Stock", color: "status-instock", icon: CheckCircle, priority: 1, gradient: "from-emerald-50 to-emerald-100/50 dark:from-emerald-900/10 dark:to-emerald-800/5" };
};

const formatPrice = (price) => `$${Number(price || 0).toFixed(2)}`;
const getProductEmoji = (name) => {
  const emojis = ['📱', '💻', '⌨️', '🖥️', '📷', '🎧', '⌚', '📡', '🔋', '💾', '🖱️', '📀', '💿', '📹', '🎮', '📺', '🔊', '📻', '⏰', '💡'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return emojis[Math.abs(hash) % emojis.length];
};
const getStockHealthColor = (available, alert) => {
  const qty = Number(available) || 0;
  const alertLevel = Number(alert) || 10;
  if (qty <= 0) return "bg-red-500";
  if (qty <= alertLevel) return "bg-yellow-500";
  return "bg-emerald-500";
};
const getStockHealthPercentage = (available, alert) => {
  const qty = Number(available) || 0;
  const alertLevel = Number(alert) || 10;
  if (qty <= 0) return 0;
  if (qty <= alertLevel) return (qty / alertLevel) * 50;
  return Math.min(100, 50 + ((qty - alertLevel) / (alertLevel * 2)) * 50);
};

const ACTION_LABELS = {
  set: { inStock: 'In Stock', available: 'Available', reserved: 'Reserved' },
  add: { inStock: 'Add to In Stock', available: 'Add to Available', reserved: 'Add to Reserved' },
  reduce: { inStock: 'Reduce from In Stock', available: 'Reduce from Available', reserved: 'Reduce from Reserved' },
};

// ============================================================
// MAIN STOCK COMPONENT
// ============================================================
const Stock = () => {
  const queryClient = useQueryClient();

  // UI state
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStock, setEditingStock] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(true);

  // Form data
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    qtyInStock: 0,
    qtyAvailable: 0,
    qtyReserved: 0,
    action: 'set'
  });

  const headerRef = useRef(null);
  const messageTimeout = useRef(null);

  // Mouse tracking for 3D effect
  useEffect(() => {
    const handleMouseMove = (e) => setMousePosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const showMessage = useCallback((text, type = "success") => {
    setMessage(text);
    setMessageType(type);
    if (messageTimeout.current) clearTimeout(messageTimeout.current);
    messageTimeout.current = setTimeout(() => setMessage(""), 5000);
  }, []);

  useEffect(() => () => { if (messageTimeout.current) clearTimeout(messageTimeout.current); }, []);

  // ============================================================
  // QUERY: Fetch stock (with client‑side deduplication)
  // ============================================================
  const {
    data: rawStock = [],
    isLoading: loading,
    isFetching: isRefreshing,
    refetch,
    error: fetchError,
  } = useQuery({
    queryKey: ['stock'],
    queryFn: async () => {
  try {
    const res = await apiClient.get("/stock");
    const data = extractArrayData(res.data, ['stock', 'items', 'data']);
    if (data === null) {
      showMessage("❌ API not available — could not load stock", "error");
      return [];
    }
    const stockArray = Array.isArray(data) ? data : [];
    if (stockArray.length > 0) {
      showMessage(`✅ Loaded ${stockArray.length} stock items`, "success");
    }
    return stockArray;
  } catch (error) {
    console.error("❌ Error fetching stock:", error);
    if (error.response?.data?.error?.includes('Unique constraint missing')) {
      showMessage("⚠️ Database constraint missing. Please run the SQL fix in the console.", "error");
    } else {
      showMessage("❌ Failed to load stock from server", "error");
    }
    return [];
  }
},
    staleTime: 30_000,
    retry: 1,
  });

  // ============================================================
  // DEDUPLICATION: Keep only the most recent row per product.
  // ============================================================
  const dedupedStock = useMemo(() => {
    const raw = Array.isArray(rawStock) ? rawStock : [];
    const key = (item) => String(
      item.product_code || item.PRODUCT_CODE || item.productid || item.PRODUCTID || item.product_id
    );
    const counts = new Map();
    raw.forEach((item) => counts.set(key(item), (counts.get(key(item)) || 0) + 1));

    const latestByKey = new Map();
    raw.forEach((item) => {
      const k = key(item);
      const existing = latestByKey.get(k);
      const itemStockId = Number(item.stockid || item.STOCKID || 0);
      const existingStockId = existing ? Number(existing.stockid || existing.STOCKID || 0) : -Infinity;
      if (!existing || itemStockId > existingStockId) latestByKey.set(k, item);
    });

    return Array.from(latestByKey.entries()).map(([k, item]) => ({
      ...item,
      __duplicateCount: counts.get(k) || 1,
    }));
  }, [rawStock]);

  const duplicateProductCount = useMemo(
    () => dedupedStock.filter((item) => item.__duplicateCount > 1).length,
    [dedupedStock]
  );

  // ============================================================
  // MUTATION: Update stock - FIXED
  // ============================================================
  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, payload }) => {
      // Send to stock endpoint with product ID
      const response = await apiClient.put(`/stock/${productId}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showMessage('✅ Stock updated successfully!', 'success');
      closeEditModal();
    },
    onError: (error) => {
      console.error('❌ Update stock error:', error);
      const errorData = error.response?.data;
      const errorMsg = errorData?.error || error.message || 'Failed to update stock';
      
      // Check for unique constraint error
      if (errorMsg.includes('Unique constraint missing') || errorMsg.includes('CONSTRAINT')) {
        showMessage(
          '⚠️ Database constraint missing. Please run this SQL in your database:\n\n' +
          'ALTER TABLE tbl_stock ADD CONSTRAINT stock_productid_unique UNIQUE (productid);',
          'error'
        );
        // Show the SQL in console
        console.error('🔧 Run this SQL to fix:\nALTER TABLE tbl_stock ADD CONSTRAINT stock_productid_unique UNIQUE (productid);');
      } else if (errorMsg.includes('duplicate key')) {
        showMessage('⚠️ Duplicate product detected! Please clean up duplicate rows.', 'error');
      } else {
        showMessage(`❌ ${errorMsg}`, 'error');
      }
    },
  });

  const submitting = updateStockMutation.isPending;

  // ===== FILTER & SORT =====
  const filteredStock = useMemo(() => {
    let result = [...dedupedStock];

    if (search) {
      const term = search.toLowerCase();
      result = result.filter((item) => {
        const name = (item.name_en || item.NAME_EN || '').toLowerCase();
        const nameKh = (item.name_kh || item.NAME_KH || '').toLowerCase();
        const id = String(item.product_code || item.PRODUCT_CODE || '');
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
      const aName = a.name_en || a.NAME_EN || '';
      const bName = b.name_en || b.NAME_EN || '';
      switch (sortBy) {
        case "name": comparison = aName.localeCompare(bName); break;
        case "stock": comparison = getStockValue(a, "qtyavailable") - getStockValue(b, "qtyavailable"); break;
        case "alert": comparison = getStockValue(a, "qty_alert") - getStockValue(b, "qty_alert"); break;
        case "price": comparison = getStockValue(a, "saleout_price") - getStockValue(b, "saleout_price"); break;
        default: comparison = aName.localeCompare(bName);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [dedupedStock, search, filterStatus, sortBy, sortOrder]);

  // ===== STATS =====
  const stats = useMemo(() => {
    const stockArray = dedupedStock;
    let lowStock = 0, outOfStock = 0, healthy = 0, totalValue = 0;

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

    return { total: stockArray.length, lowStock, outOfStock, healthy, totalValue };
  }, [dedupedStock]);

  // ===== EDIT MODAL =====
  const openEditModal = useCallback((item) => {
    setEditingStock(item);
    const productId = item.productid || item.PRODUCTID || '';
    setFormData({
      productId: productId,
      productName: item.name_en || item.NAME_EN || 'Unknown',
      qtyInStock: getStockValue(item, "qtyinstock"),
      qtyAvailable: getStockValue(item, "qtyavailable"),
      qtyReserved: getStockValue(item, "qtyreserved"),
      action: 'set',
    });
    setShowEditModal(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingStock(null);
    setFormData({
      productId: '',
      productName: '',
      qtyInStock: 0,
      qtyAvailable: 0,
      qtyReserved: 0,
      action: 'set'
    });
  }, []);

  const handleActionChange = useCallback((newAction) => {
    setFormData(prev => {
      if (newAction === 'set') {
        return {
          ...prev,
          action: newAction,
          qtyInStock: getStockValue(editingStock, "qtyinstock"),
          qtyAvailable: getStockValue(editingStock, "qtyavailable"),
          qtyReserved: getStockValue(editingStock, "qtyreserved"),
        };
      }
      return { ...prev, action: newAction, qtyInStock: 0, qtyAvailable: 0, qtyReserved: 0 };
    });
  }, [editingStock]);

  const handleUpdateStock = useCallback((e) => {
    e.preventDefault();
    const payload = {
      QtyInStock: parseInt(formData.qtyInStock) || 0,
      QtyAvailable: parseInt(formData.qtyAvailable) || 0,
      QtyReserved: parseInt(formData.qtyReserved) || 0,
      action: formData.action || 'set',
    };
    updateStockMutation.mutate({ productId: formData.productId, payload });
  }, [formData, updateStockMutation]);

  // ===== EXPORT CSV =====
  const exportCSV = useCallback(() => {
    const stockArray = dedupedStock;
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
          item.product_code || item.PRODUCT_CODE || "",
          `"${item.name_en || item.NAME_EN || ''}"`,
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
  }, [dedupedStock, showMessage]);

  const viewProductDetail = useCallback((item) => {
    setSelectedProduct(item);
    setShowDetailModal(true);
  }, []);

  const renderStatusBadge = useCallback((status) => {
    const StatusIcon = status.icon;
    return (
      <span className={`status-badge ${status.color}`}>
        <StatusIcon className="w-3 h-3" />
        {status.label}
      </span>
    );
  }, []);

  const getStatIcon = useCallback((type) => ({
    total: <Package className="w-5 h-5 text-indigo-500" />,
    healthy: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    lowStock: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    outOfStock: <AlertCircle className="w-5 h-5 text-red-500" />,
    totalValue: <DollarSign className="w-5 h-5 text-purple-500" />,
  }[type] || <Package className="w-5 h-5 text-indigo-500" />), []);

  // ===== SQL FIX HELPER =====
  const sqlFix = `ALTER TABLE tbl_stock ADD CONSTRAINT stock_productid_unique UNIQUE (productid);`;

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="stock-loading">
        <div className="stock-loading-spinner">
          <div className="stock-loading-ring">
            <div className="stock-loading-ring-inner" />
            <div className="stock-loading-ring-pulse" />
          </div>
        </div>
        <p className="stock-loading-text">Loading stock data...</p>
        <div className="stock-loading-dots">
          <span className="stock-loading-dot" style={{ animationDelay: "0s" }} />
          <span className="stock-loading-dot" style={{ animationDelay: "0.2s" }} />
          <span className="stock-loading-dot" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    );
  }

  const labels = ACTION_LABELS[formData.action] || ACTION_LABELS.set;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="stock-container">

      {/* ---- Toast message ---- */}
      {message && (
        <div className={`toast-message toast-${messageType}`}>
          <div className="toast-content">
            <div className="toast-icon">
              {messageType === "success" && <CheckCircle className="w-5 h-5 text-green-500" />}
              {messageType === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
              {messageType === "warning" && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
              {messageType === "info" && <Database className="w-5 h-5 text-blue-500" />}
            </div>
            <div className="toast-text whitespace-pre-wrap">{message}</div>
            <button onClick={() => setMessage("")} className="toast-close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- Header with 3D effect ---- */}
      <div
        ref={headerRef}
        className="stock-header"
        style={{
          transform: `perspective(1000px) rotateX(${(mousePosition.y / window.innerHeight - 0.5) * 2}deg) rotateY(${(mousePosition.x / window.innerWidth - 0.5) * 2}deg)`,
          transition: 'transform 0.1s ease-out'
        }}
      >
        <div className="stock-header-bg">
          <div className="stock-header-bg-circle" />
          <div className="stock-header-bg-circle2" />
          <div className="stock-header-bg-circle3" />
        </div>

        <div className="stock-header-content">
          <div className="stock-header-left">
            <div className="stock-header-badge">
              <div className="stock-header-badge-dot" />
              <span className="stock-header-badge-text">Inventory Management</span>
            </div>
            <h1 className="stock-header-title">
              <Package className="stock-header-icon" />
              Stock Management
            </h1>
            <p className="stock-header-subtitle">Monitor and manage your inventory levels</p>
          </div>
          <div className="stock-header-actions">
            <div className="stock-header-time">
              <Clock className="w-4 h-4 text-white/80" />
              {new Date().toLocaleTimeString()}
            </div>
            <button onClick={() => { refetch(); }} disabled={isRefreshing} className="stock-header-btn">
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <button onClick={exportCSV} className="stock-header-btn-primary">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="stock-stats">
          {[
            { label: "Total Products", value: stats.total, icon: "total" },
            { label: "In Stock", value: stats.healthy, icon: "healthy" },
            { label: "Low Stock", value: stats.lowStock, icon: "lowStock" },
            { label: "Out of Stock", value: stats.outOfStock, icon: "outOfStock" },
            { label: "Total Value", value: `$${stats.totalValue.toFixed(2)}`, icon: "totalValue" },
          ].map((stat, index) => (
            <div key={index} className="stock-stat-card" style={{ animationDelay: `${index * 0.08}s` }}>
              <div className="stock-stat-header">
                {getStatIcon(stat.icon)}
                <p className="stock-stat-label">{stat.label}</p>
              </div>
              <p className="stock-stat-value">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Data integrity warning ---- */}
      {duplicateProductCount > 0 && showDuplicateWarning && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm mt-4">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">
              ⚠️ {duplicateProductCount} product{duplicateProductCount > 1 ? 's have' : ' has'} duplicate stock records
            </p>
            <p className="mt-1">
              Showing the most recent record for each product. The extra rows should be cleaned up on the backend.
            </p>
            <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto">
              <p className="text-xs font-mono text-amber-700 dark:text-amber-300">
                -- Fix: Add unique constraint
                <br />
                {sqlFix}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                -- Then remove duplicate rows (keep the latest)
                <br />
                DELETE FROM tbl_stock a
                <br />
                USING tbl_stock b
                <br />
                WHERE a.productid = b.productid
                <br />
                AND a.stockid &lt; b.stockid;
              </p>
            </div>
            <button
              onClick={() => setShowDuplicateWarning(false)}
              className="mt-2 text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ---- Controls ---- */}
      <div className="stock-controls">
        <div className="stock-controls-content">
          <div className="stock-controls-left">
            <div className="stock-search">
              <Search className="stock-search-icon" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search by name, ID..."
                className="stock-search-input"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="stock-filter"
            >
              <option value="all">All Status</option>
              <option value="instock">In Stock</option>
              <option value="lowstock">Low Stock</option>
              <option value="outofstock">Out of Stock</option>
            </select>

            <div className="stock-sort">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="stock-sort-select"
              >
                <option value="name">Name</option>
                <option value="stock">Stock</option>
                <option value="alert">Alert Level</option>
                <option value="price">Price</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="stock-sort-btn"
              >
                {sortOrder === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="stock-controls-right">
            <div className="stock-view-toggle">
              <button
                onClick={() => setViewMode("grid")}
                className={`stock-view-btn ${viewMode === "grid" ? "stock-view-active" : ""}`}
                title="Grid view"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`stock-view-btn ${viewMode === "list" ? "stock-view-active" : ""}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Stock Grid / List ---- */}
      {filteredStock.length === 0 ? (
        <div className="stock-empty">
          <Package className="stock-empty-icon" />
          <h3 className="stock-empty-title">No stock records found</h3>
          <p className="stock-empty-text">
            {search || filterStatus !== "all" ? "Try adjusting your search or filters" : "Add products to start tracking inventory"}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="stock-grid">
          {filteredStock.map((item, index) => {
            const productId = item.product_code || item.PRODUCT_CODE || '';
            const productName = item.name_en || item.NAME_EN || 'Unknown';
            const productNameKh = item.name_kh || item.NAME_KH || '';
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
              <div
                key={item.stockid || item.STOCKID || index}
                className={`stock-grid-card ${status.priority === 3 ? "stock-grid-card-danger" : status.priority === 2 ? "stock-grid-card-warning" : ""}`}
                style={{ animationDelay: `${index * 0.04}s` }}
              >
                <div className={`stock-grid-card-header ${status.gradient || 'from-gray-50 to-gray-100/50'}`}>
                  <div className="stock-grid-card-header-content">
                    <div className="stock-grid-card-emoji">{emoji}</div>
                    <div>
                      <h3 className="stock-grid-card-name">{productName}</h3>
                      {productNameKh && <p className="stock-grid-card-name-kh">{productNameKh}</p>}
                    </div>
                  </div>
                  <span className="stock-grid-card-id">
                    #{productId}
                    {item.__duplicateCount > 1 && (
                      <span title={`${item.__duplicateCount} stock records found for this product`} className="ml-1 text-amber-500">⚠</span>
                    )}
                  </span>
                </div>

                <div className="stock-grid-card-body">
                  <div>
                    <div className="stock-grid-card-health-header">
                      <span className="stock-grid-card-health-label">Stock Health</span>
                      <span className="stock-grid-card-health-value">{qtyAvailable} units</span>
                    </div>
                    <div className="stock-grid-card-health-bar">
                      <div className={`stock-grid-card-health-fill ${healthColor}`} style={{ width: `${healthPercentage}%` }} />
                    </div>
                  </div>

                  <div className="stock-grid-card-stats">
                    <div className="stock-grid-card-stat">
                      <p className="stock-grid-card-stat-label">Total</p>
                      <p className="stock-grid-card-stat-value">{qtyInStock}</p>
                    </div>
                    <div className="stock-grid-card-stat">
                      <p className="stock-grid-card-stat-label">Reserved</p>
                      <p className="stock-grid-card-stat-value">{qtyReserved}</p>
                    </div>
                    <div className="stock-grid-card-stat">
                      <p className="stock-grid-card-stat-label">Alert</p>
                      <p className="stock-grid-card-stat-value">{alertLevel}</p>
                    </div>
                  </div>

                  <div className="stock-grid-card-footer">
                    <div>
                      <p className="stock-grid-card-price-label">Sale Price</p>
                      <p className="stock-grid-card-price">{formatPrice(salePrice)}</p>
                    </div>
                    <div className="stock-grid-card-actions">
                      {renderStatusBadge(status)}
                      <button
                        onClick={(e) => { e.stopPropagation(); viewProductDetail(item); }}
                        className="stock-grid-card-action"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                        className="stock-grid-card-action stock-grid-card-action-edit"
                        title="Edit stock"
                      >
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
        <div className="stock-list-view">
          <div className="stock-list-table-wrapper">
            <table className="stock-list-table">
              <thead className="stock-list-thead">
                <tr>
                  <th className="stock-list-th">Product</th>
                  <th className="stock-list-th text-right">Total</th>
                  <th className="stock-list-th text-right hidden sm:table-cell">Reserved</th>
                  <th className="stock-list-th text-right">Available</th>
                  <th className="stock-list-th text-right hidden md:table-cell">Alert Level</th>
                  <th className="stock-list-th text-right hidden lg:table-cell">Price</th>
                  <th className="stock-list-th text-center">Status</th>
                  <th className="stock-list-th text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="stock-list-tbody">
                {filteredStock.map((item, index) => {
                  const productName = item.name_en || item.NAME_EN || 'Unknown';
                  const qtyInStock = getStockValue(item, "qtyinstock");
                  const qtyReserved = getStockValue(item, "qtyreserved");
                  const qtyAvailable = getStockValue(item, "qtyavailable");
                  const alertLevel = getStockValue(item, "qty_alert");
                  const salePrice = getStockValue(item, "saleout_price");
                  const status = getStockStatus(qtyAvailable, alertLevel);
                  const emoji = getProductEmoji(productName);

                  return (
                    <tr
                      key={item.stockid || item.STOCKID || index}
                      className={`stock-list-tr ${status.priority === 3 ? "stock-list-tr-danger" : status.priority === 2 ? "stock-list-tr-warning" : ""}`}
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <td className="stock-list-td">
                        <div className="stock-list-product">
                          <span className="stock-list-product-emoji">{emoji}</span>
                          <div>
                            <p className="stock-list-product-name">
                              {productName}
                              {item.__duplicateCount > 1 && (
                                <span title={`${item.__duplicateCount} stock records found for this product`} className="ml-1 text-amber-500">⚠</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="stock-list-td text-right font-medium dark:text-white">{qtyInStock}</td>
                      <td className="stock-list-td text-right text-gray-500 dark:text-gray-400 hidden sm:table-cell">{qtyReserved}</td>
                      <td className={`stock-list-td text-right font-bold ${qtyAvailable <= alertLevel ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{qtyAvailable}</td>
                      <td className="stock-list-td text-right text-gray-500 dark:text-gray-400 hidden md:table-cell">{alertLevel}</td>
                      <td className="stock-list-td text-right font-medium dark:text-white hidden lg:table-cell">{formatPrice(salePrice)}</td>
                      <td className="stock-list-td text-center">{renderStatusBadge(status)}</td>
                      <td className="stock-list-td text-center">
                        <div className="stock-list-actions">
                          <button onClick={() => viewProductDetail(item)} className="stock-list-action" title="View details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditModal(item)} className="stock-list-action stock-list-action-edit" title="Edit stock">
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

      {/* ---- Footer ---- */}
      <div className="stock-footer">
        <p className="stock-footer-text">
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

      {/* ---- Detail Modal ---- */}
      {showDetailModal && selectedProduct && (
        <div className="stock-modal-overlay">
          <div className="stock-modal-content">
            <div className="stock-modal-header">
              <h2 className="stock-modal-title">
                <Package className="w-5 h-5 text-indigo-600" />
                Product Details
              </h2>
              <button onClick={() => setShowDetailModal(false)} className="stock-modal-close">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="stock-modal-body">
              <div className="stock-modal-product-info">
                <div className="stock-modal-product-name">
                  <p className="stock-modal-product-label">Product</p>
                  <p className="stock-modal-product-value">{selectedProduct.name_en || selectedProduct.NAME_EN || 'Unknown'}</p>
                  {(selectedProduct.name_kh || selectedProduct.NAME_KH) && (
                    <p className="stock-modal-product-name-kh">{selectedProduct.name_kh || selectedProduct.NAME_KH}</p>
                  )}
                </div>
                <div>
                  <p className="stock-modal-product-label">Product ID</p>
                  <p className="stock-modal-product-value">{selectedProduct.product_code || selectedProduct.PRODUCT_CODE}</p>
                </div>
                <div>
                  <p className="stock-modal-product-label">Status</p>
                  <div className="mt-1">
                    {renderStatusBadge(getStockStatus(getStockValue(selectedProduct, "qtyavailable"), getStockValue(selectedProduct, "qty_alert")))}
                  </div>
                </div>
              </div>

              <h3 className="stock-modal-section-title">
                <Layers className="w-4 h-4 text-purple-500" />
                Stock Information
              </h3>
              <div className="stock-modal-stock-grid">
                <div className="stock-modal-stock-item">
                  <p className="stock-modal-stock-label">In Stock</p>
                  <p className="stock-modal-stock-value">{getStockValue(selectedProduct, "qtyinstock")}</p>
                </div>
                <div className="stock-modal-stock-item">
                  <p className="stock-modal-stock-label">Reserved</p>
                  <p className="stock-modal-stock-value">{getStockValue(selectedProduct, "qtyreserved")}</p>
                </div>
                <div className="stock-modal-stock-item">
                  <p className="stock-modal-stock-label">Available</p>
                  <p className={`stock-modal-stock-value ${getStockValue(selectedProduct, "qtyavailable") <= getStockValue(selectedProduct, "qty_alert") ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{getStockValue(selectedProduct, "qtyavailable")}</p>
                </div>
                <div className="stock-modal-stock-item">
                  <p className="stock-modal-stock-label">Alert Level</p>
                  <p className="stock-modal-stock-value">{getStockValue(selectedProduct, "qty_alert")}</p>
                </div>
              </div>

              <h3 className="stock-modal-section-title">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Pricing
              </h3>
              <div className="stock-modal-price">
                <p className="stock-modal-stock-label">Sale Price</p>
                <p className="stock-modal-price-value">{formatPrice(getStockValue(selectedProduct, "saleout_price"))}</p>
              </div>
            </div>

            <div className="stock-modal-footer">
              <button
                onClick={() => { setShowDetailModal(false); openEditModal(selectedProduct); }}
                className="stock-modal-footer-btn edit"
              >
                <Edit2 className="w-4 h-4" />
                Edit Stock
              </button>
              <button onClick={() => setShowDetailModal(false)} className="stock-modal-footer-btn close">
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Edit Modal ---- */}
      {showEditModal && (
        <div className="stock-modal-overlay">
          <div className="stock-modal-content">
            <div className="stock-modal-header">
              <h2 className="stock-modal-title">
                <Package className="w-5 h-5 text-indigo-600" />
                Edit Stock - {formData.productName}
              </h2>
              <button onClick={closeEditModal} className="stock-modal-close" disabled={submitting}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleUpdateStock} className="stock-modal-form">
              <div className="stock-form-group">
                <div className="stock-form-product-id">
                  <p className="stock-form-label">Product ID</p>
                  <p className="stock-form-product-id-value">{formData.productId}</p>
                </div>

                <div className="stock-form-field">
                  <label className="stock-form-label">Update Action</label>
                  <select
                    value={formData.action}
                    onChange={(e) => handleActionChange(e.target.value)}
                    className="stock-form-select"
                    disabled={submitting}
                  >
                    <option value="set">Set Exact Values</option>
                    <option value="add">Add to Current</option>
                    <option value="reduce">Reduce from Current</option>
                  </select>
                  {formData.action !== 'set' && (
                    <p className="text-xs text-gray-400 mt-1">
                      Enter the amount to {formData.action === 'add' ? 'add' : 'subtract'} — not the new total.
                    </p>
                  )}
                </div>

                <div className="stock-form-row">
                  <div className="stock-form-field">
                    <label className="stock-form-label">{labels.inStock}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.qtyInStock}
                      onChange={(e) => setFormData({ ...formData, qtyInStock: parseInt(e.target.value) || 0 })}
                      className="stock-form-input"
                      disabled={submitting}
                    />
                  </div>
                  <div className="stock-form-field">
                    <label className="stock-form-label">{labels.available}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.qtyAvailable}
                      onChange={(e) => setFormData({ ...formData, qtyAvailable: parseInt(e.target.value) || 0 })}
                      className="stock-form-input"
                      disabled={submitting}
                    />
                  </div>
                  <div className="stock-form-field">
                    <label className="stock-form-label">{labels.reserved}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.qtyReserved}
                      onChange={(e) => setFormData({ ...formData, qtyReserved: parseInt(e.target.value) || 0 })}
                      className="stock-form-input"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>

              <div className="stock-form-actions">
                <button type="button" onClick={closeEditModal} className="stock-form-btn-cancel" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="stock-form-btn-submit" disabled={submitting}>
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