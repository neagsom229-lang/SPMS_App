import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Pagination from "./Pagination";
import {
  Plus,
  X,
  Save,
  Printer,
  Search,
  ClipboardList,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Package,
  User,
  ShoppingCart,
  Eye,
  Trash2,
  List,
  Zap,
  Check,
  AlertTriangle,
  Clock,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { exportInvoicePDF } from "../utils/pdfExport";
import '../styles/orders.css';
// ✅ Shared axios instance — attaches the Authorization header from
// localStorage on every request.
import apiClient from '../api/client';

// ============================================
// SHARED DATA HELPERS
// ============================================
const extractArrayData = (responseData, extraKeys = []) => {
  if (
    typeof responseData === "string" &&
    responseData.includes("<!DOCTYPE html>")
  ) {
    return null;
  }
  if (Array.isArray(responseData)) return responseData;
  if (responseData && typeof responseData === "object") {
    if (Array.isArray(responseData.data)) return responseData.data;
    for (const key of extraKeys) {
      if (Array.isArray(responseData[key])) return responseData[key];
    }
    if (responseData.data && typeof responseData.data === "object") {
      for (const key of extraKeys) {
        if (Array.isArray(responseData.data[key]))
          return responseData.data[key];
      }
      const values = Object.values(responseData.data);
      if (values.length > 0 && Array.isArray(values[0])) return values[0];
    }
  }
  return [];
};

const getFallbackCustomers = () => [
  {
    CUS_ID: "CUS001",
    FIRST_NAME: "John",
    LAST_NAME: "Doe",
    PHONE: "555-0101",
    E_MAIL: "john@example.com",
    ADDRESS: "123 Main St, NY",
    BALANCE: 150.0,
    STATUS: "Active",
    image_url:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
  },
  {
    CUS_ID: "CUS002",
    FIRST_NAME: "Jane",
    LAST_NAME: "Smith",
    PHONE: "555-0102",
    E_MAIL: "jane@example.com",
    ADDRESS: "456 Oak Ave, LA",
    BALANCE: 0.0,
    STATUS: "Active",
    image_url:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
  },
  {
    CUS_ID: "CUS003",
    FIRST_NAME: "Robert",
    LAST_NAME: "Johnson",
    PHONE: "555-0103",
    E_MAIL: "robert@example.com",
    ADDRESS: "789 Pine Rd, SF",
    BALANCE: 75.5,
    STATUS: "Active",
    image_url:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
  },
  {
    CUS_ID: "CUS004",
    FIRST_NAME: "Mary",
    LAST_NAME: "Williams",
    PHONE: "555-0104",
    E_MAIL: "mary@example.com",
    ADDRESS: "321 Elm St, CHI",
    BALANCE: 200.0,
    STATUS: "Active",
    image_url:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
  },
];

const getFallbackProducts = () => [
  {
    PRODUCT_ID: "PROD001",
    NAME_EN: "Laptop Pro",
    NAME_KH: "កុំព្យូទ័រយួរដៃ",
    BARCODE: "LP001",
    BRAND: "TechPro",
    BUYIN_PRICE: 899.99,
    SALEOUT_PRICE: 1299.99,
    QtyInStock: 50,
    QTY_ALERT: 10,
    STATUS: "Active",
    image_url: null,
  },
  {
    PRODUCT_ID: "PROD002",
    NAME_EN: "Smartphone X",
    NAME_KH: "ទូរស័ព្ទឆ្លាត",
    BARCODE: "SP002",
    BRAND: "PhoneMaster",
    BUYIN_PRICE: 599.99,
    SALEOUT_PRICE: 899.99,
    QtyInStock: 30,
    QTY_ALERT: 10,
    STATUS: "Active",
    image_url: null,
  },
  {
    PRODUCT_ID: "PROD003",
    NAME_EN: "Wireless Mouse",
    NAME_KH: "កណ្ដុរឥតខ្សែ",
    BARCODE: "WM003",
    BRAND: "Accessory",
    BUYIN_PRICE: 15.99,
    SALEOUT_PRICE: 29.99,
    QtyInStock: 100,
    QTY_ALERT: 15,
    STATUS: "Active",
    image_url: null,
  },
  {
    PRODUCT_ID: "PROD004",
    NAME_EN: "Keyboard Pro",
    NAME_KH: "ក្ដារចុច",
    BARCODE: "KP004",
    BRAND: "Accessory",
    BUYIN_PRICE: 45.99,
    SALEOUT_PRICE: 79.99,
    QtyInStock: 45,
    QTY_ALERT: 10,
    STATUS: "Active",
    image_url: null,
  },
];

// ============================================
// FIXED: STOCK HELPER
// ============================================
const getProductStock = (product) => {
  if (!product) return undefined;
  const val =
    product?.QtyInStock ??
    product?.qty_instock ??
    product?.STOCK ??
    product?.stock;
  // If the key doesn't exist or is null, return undefined instead of 0
  if (val === undefined || val === null || val === '') return undefined;
  return Number(val) || 0;
};

const getProductImage = (product) => {
  const url = product?.image_url || product?.IMAGE_URL || "";
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("data:image/")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (url.includes("example.com") || url.includes("placeholder")) return "";
    return url;
  }
  if (url.startsWith("/uploads/")) return url;
  return "";
};

const getCustomerImage = (customer) =>
  customer?.image_url || customer?.IMAGE_URL || "";

// ============================================
// MAIN ORDERS COMPONENT
// ============================================
const Orders = () => {
  // ===== STATE =====
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [orderNo, setOrderNo] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [orderStatus, setOrderStatus] = useState("Pending");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savedOrderData, setSavedOrderData] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // ===== PURCHASE STATE =====
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState(null);

  // ===== ORDER LIST STATE =====
  const [savedOrders, setSavedOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [viewMode, setViewMode] = useState("create");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ===== REFS =====
  const isMounted = useRef(true);
  const itemsEndRef = useRef(null);
  const headerRef = useRef(null);
  const messageTimeout = useRef(null);

  // ===== MOUSE TRACKING =====
  useEffect(() => {
    const handleMouseMove = (e) =>
      setMousePosition({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // ===== SHOW MESSAGE =====
  const showMessage = useCallback((text, type = "success") => {
    setMessage(text);
    setMessageType(type);
    if (messageTimeout.current) clearTimeout(messageTimeout.current);
    messageTimeout.current = setTimeout(() => setMessage(""), 5000);
  }, []);

  // ============================================
  // FETCH CUSTOMERS
  // ============================================
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await apiClient.get("/customers");
      if (!isMounted.current) return;
      const extracted = extractArrayData(res.data, ["customers", "items"]);
      if (extracted === null) throw new Error("API not available");
      setCustomers(extracted.length > 0 ? extracted : getFallbackCustomers());
      console.log("✅ Customers loaded:", extracted.length);
    } catch (error) {
      console.warn(
        "⚠️ Customers API unavailable, using fallback:",
        error.message,
      );
      if (isMounted.current) setCustomers(getFallbackCustomers());
    }
  }, []);

  // ============================================
  // FETCH PRODUCTS
  // ============================================
  const fetchProducts = useCallback(async () => {
    try {
      const res = await apiClient.get("/products");
      if (!isMounted.current) return;
      const extracted = extractArrayData(res.data, ["products", "items"]);
      if (extracted === null) throw new Error("API not available");
      setProducts(extracted.length > 0 ? extracted : getFallbackProducts());
      console.log("✅ Products loaded:", extracted.length);
    } catch (error) {
      console.warn(
        "⚠️ Products API unavailable, using fallback:",
        error.message,
      );
      if (isMounted.current) setProducts(getFallbackProducts());
    }
  }, []);

  // ============================================
  // FETCH ORDERS - Properly maps data
  // ============================================
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await apiClient.get("/orders");
      const extracted = extractArrayData(res.data, ["orders", "items"]);
      if (extracted === null) throw new Error("API not available");

      // Map the data to match frontend expectations
      const mappedOrders = extracted.map((order) => ({
        id: order.or_id || order.id || order.OR_ID,
        order_no: order.order_no || order.ORDER_NO,
        date: order.order_date || order.ORDER_DATE || order.date,
        total: Number(order.amount_us || order.AMOUNT_US || order.total || 0),
        status: order.status || order.STATUS || "Pending",
        payment_method: order.paymentmethod || order.PAYMENT_METHOD || order.payment_method,
        customer_id: order.customer_id || order.CUSTOMER_ID,
        customer_name: order.customer_name || order.CUSTOMER_NAME || "Unknown",
        items: order.items || [],
        item_count: order.item_count || order.items?.length || 0,
        discount: order.discount || order.DISCOUNT || 0,
        subtotal: order.subtotal || order.SUBTOTAL || 0,
        saved_locally: order.saved_locally || false,
        notes: order.notes || order.NOTES || "",
      }));

      if (isMounted.current) {
        setSavedOrders(mappedOrders);
        try {
          localStorage.setItem("pos_orders_cache", JSON.stringify(mappedOrders));
        } catch {
          /* ignore */
        }
      }
    } catch (error) {
      console.warn(
        "⚠️ Orders API unavailable, using local cache:",
        error.message,
      );
      try {
        const cached = JSON.parse(
          localStorage.getItem("pos_orders_cache") ||
            localStorage.getItem("orders") ||
            "[]",
        );
        if (isMounted.current)
          setSavedOrders(Array.isArray(cached) ? cached : []);
      } catch {
        if (isMounted.current) setSavedOrders([]);
      }
    } finally {
      if (isMounted.current) setOrdersLoading(false);
    }
  }, []);

  // ============================================
  // FETCH SINGLE ORDER DETAILS
  // ============================================
  const fetchOrderDetails = useCallback(async (orderId) => {
    try {
      const res = await apiClient.get(`/orders/${orderId}`);
      const data = res.data;

      // Map the response to match frontend expectations
      const customerName = data.customer
        ? `${data.customer.FIRST_NAME || data.customer.first_name || ""} ${data.customer.LAST_NAME || data.customer.last_name || ""}`.trim()
        : data.customer_name || "Unknown";

      return {
        id: data.OR_ID || data.id || data.or_id,
        order_no: data.ORDER_NO || data.order_no,
        date: data.ORDER_DATE || data.order_date || data.date,
        total: Number(data.AMOUNT_US || data.amount_us || data.total || 0),
        status: data.STATUS || data.status || "Pending",
        payment_method: data.PaymentMethod || data.payment_method,
        customer_id: data.CUSTOMER_ID || data.customer_id,
        customer_name: customerName,
        items: (data.items || []).map((item) => ({
          product_id: item.product_id || item.PRODUCT_ID,
          product_name: item.product_name || item.PRODUCT_NAME || "Product",
          qty: Number(item.qty || item.QTY || 0),
          unit_price: Number(item.unit_price || item.UNIT_PRICE || 0),
          discount: Number(item.discount || item.DISCOUNT || 0),
          subtotal: Number(item.subtotal || item.SUBTOTAL || 0),
          image: item.image_url || item.IMAGE_URL || "",
        })),
        discount: data.discount || data.DISCOUNT || 0,
        subtotal: data.subtotal || data.SUBTOTAL || 0,
        notes: data.NOTES || data.notes || "",
        saved_locally: false,
      };
    } catch (error) {
      console.error("❌ Failed to fetch order details:", error);
      return null;
    }
  }, []);

  // ===== PERSIST ORDER LOCALLY =====
  const persistOrderLocally = useCallback((orderData) => {
    try {
      const cached = JSON.parse(localStorage.getItem("pos_orders_cache") || "[]");
      const updated = [orderData, ...(Array.isArray(cached) ? cached : [])];
      localStorage.setItem("pos_orders_cache", JSON.stringify(updated));
      localStorage.setItem("orders", JSON.stringify(updated));
      setSavedOrders(updated);
    } catch (e) {
      console.error("❌ Failed to persist order locally:", e);
    }
  }, []);

  // ===== GENERATE ORDER NUMBER =====
  const generateOrderNo = useCallback(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    setOrderNo(`ORD-${year}${month}${day}-${random}`);
    setOrderId(null);
    setSavedOrderData(null);
    setPurchaseResult(null);
  }, []);

  // ===== INITIAL LOAD =====
  useEffect(() => {
    isMounted.current = true;
    setDataLoading(true);
    Promise.all([fetchCustomers(), fetchProducts()]).finally(() => {
      if (isMounted.current) setDataLoading(false);
    });
    generateOrderNo();
    fetchOrders();

    return () => {
      isMounted.current = false;
      if (messageTimeout.current) clearTimeout(messageTimeout.current);
    };
  }, [fetchCustomers, fetchProducts, fetchOrders, generateOrderNo]);

  // ===== SCROLL TO ITEMS =====
  useEffect(() => {
    if (items.length > 0 && itemsEndRef.current) {
      itemsEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [items.length]);

  // ===== RESET PAGE ON FILTER/SEARCH CHANGE =====
  useEffect(() => {
    setPage(1);
  }, [filterStatus, orderSearchTerm, sortBy, sortOrder]);

  // ===== ITEM FUNCTIONS =====
  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        product_id: "",
        qty: 1,
        unit_price: 0,
        discount: 0,
        subtotal: 0,
        product_name: "",
        image: "",
        stock: undefined,
      },
    ]);
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItem = useCallback(
    (id, field, value) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const updated = { ...item, [field]: value };

          if (field === "product_id") {
            const product = products.find(
              (p) => String(p.PRODUCT_ID || p.product_id) === String(value),
            );
            if (product) {
              updated.unit_price = Number(
                product.SALEOUT_PRICE || product.saleout_price || 0,
              );
              updated.product_name = product.NAME_EN || product.name_en || "";
              updated.image = getProductImage(product);
              updated.stock = getProductStock(product);
            } else {
              updated.unit_price = 0;
              updated.product_name = "";
              updated.image = "";
              updated.stock = undefined;
            }
          }

          updated.subtotal =
            updated.qty * updated.unit_price - (updated.discount || 0);
          return updated;
        }),
      );
    },
    [products],
  );

  // ===== CALCULATE TOTALS =====
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.subtotal || 0), 0),
    [items],
  );
  const grandTotal = useMemo(
    () => Math.max(0, subtotal - (discount || 0)),
    [subtotal, discount],
  );
  const totalItems = items.length;

  // ============================================
  // STOCK CHECK
  // ============================================
  const checkStockAvailability = useCallback(() => {
    let hasStockIssue = false;
    const stockMessages = [];

    for (const item of items) {
      if (!item.product_id) continue;
      const product = products.find(
        (p) => String(p.PRODUCT_ID || p.product_id) === String(item.product_id),
      );
      if (!product) continue;
      const available = getProductStock(product);
      if (available !== undefined && available < item.qty) {
        hasStockIssue = true;
        stockMessages.push({
          product: item.product_name || `Product ${item.product_id}`,
          available,
          requested: item.qty,
        });
      }
    }

    return { hasStockIssue, stockMessages };
  }, [items, products]);

  // ============================================
  // PROCESS PURCHASE
  // ============================================
  const handlePurchase = useCallback(async () => {
    if (!selectedCustomer) {
      showMessage("❌ Please select a customer", "error");
      return;
    }
    if (items.length === 0) {
      showMessage("❌ Please add at least one item", "error");
      return;
    }
    if (items.some((item) => !item.product_id)) {
      showMessage("❌ Please select a product for all items", "error");
      return;
    }

    const { hasStockIssue, stockMessages } = checkStockAvailability();
    if (hasStockIssue) {
      const summary = stockMessages
        .map(
          (m) =>
            `${m.product}: ${m.available} available, ${m.requested} requested`,
        )
        .join("\n");
      if (
        !window.confirm(
          `⚠️ Some items have stock issues:\n${summary}\n\nContinue anyway?`,
        )
      )
        return;
    }

    setIsProcessingPurchase(true);

    const purchasePayload = {
      CUSTOMER_ID: String(selectedCustomer),
      items: items.map((item) => ({
        product_id: String(item.product_id),
        qty: Number(item.qty),
        unit_price: Number(item.unit_price),
        discount: Number(item.discount || 0),
      })),
      DISCOUNT: Number(discount),
      discount: Number(discount),
      PAYMENT_METHOD: paymentMethod,
      payment_method: paymentMethod,
      STATUS: orderStatus,
      status: orderStatus,
      order_no: orderNo,
    };

    try {
      const response = await apiClient.post("/orders", purchasePayload);
      const responseData = response?.data || {};
      const finalOrderNo = responseData.order_no || orderNo;
      const orderData = responseData.order || {
        ...purchasePayload,
        id: responseData.order_id || Date.now(),
        order_no: finalOrderNo,
        customer_name: selectedCustomerName || "Unknown",
      };

      setOrderId(responseData.order_id || orderData.id);
      setSavedOrderData(orderData);
      setPurchaseResult({
        success: true,
        order_no: finalOrderNo,
        message: "Purchase completed successfully! Stock updated.",
        local: false,
      });
      showMessage(
        `✅ Purchase completed! Order ${finalOrderNo} created.`,
        "success",
      );

      setItems([]);
      setDiscount(0);
      setSelectedCustomer("");
      setSelectedCustomerName("");
      generateOrderNo();

      await Promise.all([fetchProducts(), fetchOrders()]);
    } catch (apiError) {
      console.warn(
        "⚠️ Purchase API failed, saving locally:",
        apiError.response?.data || apiError.message,
      );

      const localOrder = {
        ...purchasePayload,
        id: Date.now(),
        order_no: orderNo,
        customer_name: selectedCustomerName || "Unknown",
        saved_locally: true,
        date: new Date().toISOString(),
        total: grandTotal,
        subtotal: subtotal,
        items: items.map((item) => ({
          product_id: String(item.product_id),
          product_name: item.product_name || "Product",
          qty: Number(item.qty),
          unit_price: Number(item.unit_price),
          discount: Number(item.discount || 0),
          subtotal: Number(item.subtotal || 0),
        })),
      };
      persistOrderLocally(localOrder);

      setOrderId(localOrder.id);
      setSavedOrderData(localOrder);
      setPurchaseResult({
        success: true,
        order_no: orderNo,
        message: "Order saved locally (API unavailable)",
        local: true,
      });
      showMessage(
        `✅ Purchase completed! Order ${orderNo} saved locally`,
        "success",
      );

      setItems([]);
      setDiscount(0);
      setSelectedCustomer("");
      setSelectedCustomerName("");
      generateOrderNo();
    } finally {
      setIsProcessingPurchase(false);
    }
  }, [
    selectedCustomer,
    selectedCustomerName,
    items,
    discount,
    orderStatus,
    orderNo,
    subtotal,
    grandTotal,
    paymentMethod,
    generateOrderNo,
    showMessage,
    fetchProducts,
    fetchOrders,
    checkStockAvailability,
    persistOrderLocally,
  ]);

  // ============================================
  // SAVE ORDER (draft)
  // ============================================
  const handleSaveOrder = useCallback(async () => {
    if (!selectedCustomer) {
      showMessage("❌ Please select a customer", "error");
      return;
    }
    if (items.length === 0) {
      showMessage("❌ Please add at least one item", "error");
      return;
    }
    if (items.some((item) => !item.product_id)) {
      showMessage("❌ Please select a product for all items", "error");
      return;
    }

    setLoading(true);

    const orderPayload = {
      CUSTOMER_ID: String(selectedCustomer),
      items: items.map((item) => ({
        product_id: String(item.product_id),
        qty: Number(item.qty),
        unit_price: Number(item.unit_price),
        discount: Number(item.discount || 0),
      })),
      discount: Number(discount),
      payment_method: paymentMethod,
      status: orderStatus,
      order_no: orderNo,
    };

    try {
      const res = await apiClient.post("/orders", orderPayload);
      const saved = res?.data?.order || {
        ...orderPayload,
        id: res?.data?.order_id || Date.now(),
        order_no: orderNo,
        customer_name: selectedCustomerName || "Unknown",
      };
      setOrderId(res?.data?.order_id || saved.id);
      setSavedOrderData(saved);
      showMessage(`✅ Order ${orderNo} saved successfully!`, "success");
      await fetchOrders();
    } catch (error) {
      console.warn("⚠️ Save via API failed, saving locally:", error.message);
      const localOrder = {
        ...orderPayload,
        id: Date.now(),
        order_no: orderNo,
        customer_name: selectedCustomerName || "Unknown",
        saved_locally: true,
        date: new Date().toISOString(),
        total: grandTotal,
        subtotal: subtotal,
        items: items.map((item) => ({
          product_id: String(item.product_id),
          product_name: item.product_name || "Product",
          qty: Number(item.qty),
          unit_price: Number(item.unit_price),
          discount: Number(item.discount || 0),
          subtotal: Number(item.subtotal || 0),
        })),
      };
      persistOrderLocally(localOrder);
      setOrderId(localOrder.id);
      setSavedOrderData(localOrder);
      showMessage(`✅ Order ${orderNo} saved locally (offline)`, "success");
    }

    setItems([]);
    setDiscount(0);
    setSelectedCustomer("");
    setSelectedCustomerName("");
    generateOrderNo();
    setLoading(false);
  }, [
    selectedCustomer,
    selectedCustomerName,
    items,
    discount,
    orderStatus,
    orderNo,
    subtotal,
    grandTotal,
    paymentMethod,
    generateOrderNo,
    showMessage,
    fetchOrders,
    persistOrderLocally,
  ]);

  // ============================================
  // PRINT INVOICE
  // ============================================
  const handlePrintInvoice = useCallback(
    async (orderOverride) => {
      const source = orderOverride || savedOrderData;
      if (!source && !orderId) {
        showMessage("❌ Please complete a purchase first", "error");
        return;
      }

      try {
        const pdfData = {
          order_no: source?.order_no || orderNo,
          customer_name:
            source?.customer_name || selectedCustomerName || "Customer",
          status: source?.status || source?.STATUS || orderStatus,
          discount: source?.discount ?? discount,
          items: source?.items || items,
          payment_method:
            source?.payment_method || source?.PAYMENT_METHOD || paymentMethod,
          total: source?.total ?? grandTotal,
        };

        await exportInvoicePDF(pdfData, `invoice-${pdfData.order_no}.pdf`);
        showMessage("✅ Invoice generated successfully!", "success");
      } catch (error) {
        console.error("❌ Print invoice error:", error);
        showMessage("❌ Failed to generate invoice", "error");
      }
    },
    [
      savedOrderData,
      orderId,
      orderNo,
      selectedCustomerName,
      orderStatus,
      discount,
      items,
      paymentMethod,
      grandTotal,
      showMessage,
    ],
  );

  // ===== REFRESH DATA =====
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchCustomers(), fetchProducts(), fetchOrders()]);
    setIsRefreshing(false);
    showMessage("✅ Data refreshed!", "success");
  }, [fetchCustomers, fetchProducts, fetchOrders, showMessage]);

  // ===== RESET FORM =====
  const handleReset = useCallback(() => {
    if (
      items.length > 0 &&
      !window.confirm("Are you sure you want to reset? All items will be lost.")
    )
      return;
    setItems([]);
    setDiscount(0);
    setSelectedCustomer("");
    setSelectedCustomerName("");
    setOrderStatus("Pending");
    setPaymentMethod("Cash");
    setOrderId(null);
    setSavedOrderData(null);
    setPurchaseResult(null);
    generateOrderNo();
    showMessage("🔄 Form reset", "info");
  }, [items, generateOrderNo, showMessage]);

  // ============================================
  // DELETE ORDER
  // ============================================
  const handleDeleteOrder = useCallback(
    async (order) => {
      if (!window.confirm("Are you sure you want to delete this order?"))
        return;
      const id =
        order.id ||
        order._id ||
        order.ORDER_ID ||
        order.order_id ||
        order.or_id;

      // If it's a local order, just remove from cache
      if (order.saved_locally || !id) {
        const updated = savedOrders.filter(
          (o) => (o.id || o._id || o.ORDER_ID || o.order_id || o.or_id) !== id,
        );
        setSavedOrders(updated);
        try {
          localStorage.setItem("pos_orders_cache", JSON.stringify(updated));
          localStorage.setItem("orders", JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        showMessage("✅ Order deleted successfully!", "success");
        return;
      }

      try {
        await apiClient.delete(`/orders/${id}`);
        showMessage("✅ Order deleted successfully!", "success");
        await fetchOrders();
      } catch (error) {
        console.warn(
          "⚠️ Delete via API failed, removing from local cache:",
          error.message,
        );
        const updated = savedOrders.filter(
          (o) => (o.id || o._id || o.ORDER_ID || o.order_id || o.or_id) !== id,
        );
        setSavedOrders(updated);
        try {
          localStorage.setItem("pos_orders_cache", JSON.stringify(updated));
          localStorage.setItem("orders", JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        showMessage("✅ Order deleted from local cache", "success");
      }
    },
    [savedOrders, showMessage, fetchOrders],
  );

  // ============================================
  // VIEW ORDER DETAIL
  // ============================================
  const handleViewOrder = useCallback(
    async (order) => {
      // If it's a local order or already has full details, show it directly
      if (order.saved_locally || (order.items && order.items.length > 0)) {
        setSelectedOrder(order);
        setShowOrderDetail(true);
        return;
      }

      // Otherwise fetch full details from API
      const id =
        order.id ||
        order._id ||
        order.ORDER_ID ||
        order.order_id ||
        order.or_id;
      if (!id) {
        setSelectedOrder(order);
        setShowOrderDetail(true);
        return;
      }

      const fullOrder = await fetchOrderDetails(id);
      if (fullOrder) {
        setSelectedOrder(fullOrder);
        setShowOrderDetail(true);
      } else {
        // Fallback: show what we have
        setSelectedOrder(order);
        setShowOrderDetail(true);
      }
    },
    [fetchOrderDetails],
  );

  // ===== CLEAR ALL LOCAL ORDERS =====
  const handleClearAll = useCallback(() => {
    if (
      !window.confirm(
        "Clear all locally-cached orders? Orders stored on the server will not be affected.",
      )
    )
      return;
    try {
      localStorage.setItem("pos_orders_cache", JSON.stringify([]));
      localStorage.setItem("orders", JSON.stringify([]));
    } catch {
      /* ignore */
    }
    fetchOrders();
    showMessage("🗑️ Local order cache cleared!", "info");
  }, [showMessage, fetchOrders]);

  // ===== ORDER STATS =====
  const orderStats = useMemo(() => {
    const arr = Array.isArray(savedOrders) ? savedOrders : [];
    return {
      total: arr.length,
      pending: arr.filter(
        (o) =>
          (o.status || o.STATUS) === "Pending" ||
          (o.status || o.STATUS) === "Processing",
      ).length,
      completed: arr.filter((o) => (o.status || o.STATUS) === "Completed")
        .length,
      revenue: arr.reduce((sum, o) => sum + Number(o.total || o.TOTAL || 0), 0),
    };
  }, [savedOrders]);

  // ===== FILTERED ORDERS =====
  const filteredOrders = useMemo(() => {
    const arr = Array.isArray(savedOrders) ? savedOrders : [];
    let result = [...arr];

    if (filterStatus !== "all") {
      result = result.filter((o) => (o.status || o.STATUS) === filterStatus);
    }

    if (orderSearchTerm.trim()) {
      const q = orderSearchTerm.trim().toLowerCase();
      result = result.filter(
        (o) =>
          (o.order_no || "").toLowerCase().includes(q) ||
          (o.customer_name || "").toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "date":
          comparison =
            new Date(a.date || a.order_date) - new Date(b.date || b.order_date);
          break;
        case "total":
          comparison = (a.total || 0) - (b.total || 0);
          break;
        case "status":
          comparison = (a.status || a.STATUS || "").localeCompare(
            b.status || b.STATUS || "",
          );
          break;
        default:
          comparison =
            new Date(a.date || a.order_date) - new Date(b.date || b.order_date);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [savedOrders, filterStatus, orderSearchTerm, sortBy, sortOrder]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / ITEMS_PER_PAGE),
  );

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, page]);

  // ===== FILTERED PRODUCTS =====
  const filteredProducts = useMemo(() => {
    const arr = Array.isArray(products) ? products : [];
    if (!searchTerm) return arr;
    const q = searchTerm.toLowerCase();
    return arr.filter((p) => {
      const nameEn = p.NAME_EN || p.name_en || "";
      const nameKh = p.NAME_KH || p.name_kh || "";
      const barcode = p.BARCODE || p.barcode || "";
      return (
        nameEn.toLowerCase().includes(q) ||
        nameKh.includes(q) ||
        barcode.toLowerCase().includes(q)
      );
    });
  }, [products, searchTerm]);

  // ===== HELPER FUNCTIONS =====
  const getProductEmoji = (name) => {
    const emojis = [
      "📱",
      "💻",
      "⌨️",
      "🖥️",
      "📷",
      "🎧",
      "⌚",
      "📡",
      "🔋",
      "💾",
      "🖱️",
      "📀",
      "💿",
      "📹",
      "🎮",
      "📺",
      "🔊",
    ];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return emojis[Math.abs(hash) % emojis.length];
  };

  const getInitials = (name) => {
    const parts = (name || "").trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    return parts
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  };

  const getAvatarColor = (name) => {
    const colors = [
      "bg-indigo-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-red-500",
      "bg-orange-500",
      "bg-teal-500",
      "bg-cyan-500",
      "bg-rose-500",
      "bg-amber-500",
    ];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const formatPhone = (phone) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10)
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    if (cleaned.length === 9)
      return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
    return phone;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr || "N/A";
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      Pending:
        "status-badge status-pending",
      Processing:
        "status-badge status-processing",
      Completed:
        "status-badge status-completed",
      Cancelled:
        "status-badge status-cancelled",
    };
    return colors[status] || colors["Pending"];
  };

  const getStatusIcon = (status) => {
    const icons = {
      Pending: <Clock className="w-3 h-3" />,
      Processing: <Loader2 className="w-3 h-3 animate-spin" />,
      Completed: <CheckCircle className="w-3 h-3" />,
      Cancelled: <X className="w-3 h-3" />,
    };
    return icons[status] || icons["Pending"];
  };

  const getStatIcon = (type) => {
    const icons = {
      total: <ClipboardList className="w-5 h-5 text-indigo-100" />,
      pending: <Clock className="w-5 h-5 text-yellow-300" />,
      completed: <CheckCircle className="w-5 h-5 text-green-300" />,
      revenue: <DollarSign className="w-5 h-5 text-indigo-100" />,
    };
    return icons[type] || icons.total;
  };

  const selectedCustomerObj = useMemo(
    () =>
      customers.find(
        (c) => String(c.CUS_ID || c.cus_id) === String(selectedCustomer),
      ),
    [customers, selectedCustomer],
  );

  // ===== RENDER =====
  return (
    <div className="orders-container">
      {/* ===== MESSAGE TOAST ===== */}
      {message && (
        <div className={`toast-message toast-${messageType}`}>
          <div className="toast-content">
            <div className="toast-icon">
              {messageType === "success" && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {messageType === "error" && (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              {messageType === "warning" && (
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              )}
              {messageType === "info" && (
                <RefreshCw className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <div className="toast-text">{message}</div>
            <button
              onClick={() => setMessage("")}
              className="toast-close"
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===== HEADER WITH STATS ===== */}
      <div
        ref={headerRef}
        className="orders-header"
        style={{
          transform: `perspective(1000px) rotateX(${(mousePosition.y / window.innerHeight - 0.5) * 2}deg) rotateY(${(mousePosition.x / window.innerWidth - 0.5) * 2}deg)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <div className="orders-header-bg">
          <div className="orders-header-bg-circle" />
          <div className="orders-header-bg-circle2" />
          <div className="orders-header-bg-circle3" />
        </div>

        <div className="orders-header-content">
          <div className="orders-header-left">
            <div className="orders-header-badge">
              <div className="orders-header-badge-dot" />
              <span className="orders-header-badge-text">
                Order Management
              </span>
            </div>
            <h1 className="orders-header-title">
              <ShoppingCart className="orders-header-icon" />
              Orders Management
            </h1>
            <p className="orders-header-subtitle">
              Create and manage customer orders
            </p>
          </div>
          <div className="orders-header-actions">
            <div className="orders-header-time">
              <Clock className="w-4 h-4 text-white/80" />
              {new Date().toLocaleTimeString()}
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="orders-header-btn"
              aria-label="Refresh data"
            >
              <RefreshCw
                className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        <div className="orders-stats">
          {[
            {
              label: "Total Orders",
              value: orderStats.total,
              icon: "total",
              valueClass: "",
            },
            {
              label: "Pending",
              value: orderStats.pending,
              icon: "pending",
              valueClass: "text-yellow-300",
            },
            {
              label: "Completed",
              value: orderStats.completed,
              icon: "completed",
              valueClass: "text-green-300",
            },
            {
              label: "Revenue",
              value: `$${orderStats.revenue.toFixed(2)}`,
              icon: "revenue",
              valueClass: "",
            },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className="orders-stat-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="orders-stat-header">
                {getStatIcon(stat.icon)}
                <p className="orders-stat-label">{stat.label}</p>
              </div>
              <p className={`orders-stat-value ${stat.valueClass}`}>
                {ordersLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  stat.value
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== MODE SELECTOR ===== */}
      <div className="orders-mode-selector">
        <div className="orders-mode-content">
          <div className="orders-mode-buttons">
            <button
              onClick={() => setViewMode("create")}
              className={`orders-mode-btn ${viewMode === "create" ? "orders-mode-btn-active" : ""}`}
            >
              <Plus className="w-4 h-4" />
              New Order
            </button>
            <button
              onClick={() => {
                setViewMode("list");
                fetchOrders();
              }}
              className={`orders-mode-btn ${viewMode === "list" ? "orders-mode-btn-active" : ""}`}
            >
              <List className="w-4 h-4" />
              Orders
              <span className="orders-mode-count">
                {savedOrders.length}
              </span>
            </button>
          </div>
          <button
            onClick={handleReset}
            className="orders-mode-reset"
            title="Reset form"
            aria-label="Reset form"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* ===== CREATE ORDER VIEW ===== */}
      {viewMode === "create" && (
        <div className="orders-create-view">
          {/* Order Header */}
          <div className="orders-create-header">
            <div>
              <h2 className="orders-create-title">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                Order #{orderNo}
              </h2>
              <p className="orders-create-subtitle">
                Create a new customer order
              </p>
            </div>
            <div className="orders-create-controls">
              <div className="orders-create-status">
                <span className="orders-create-status-label">Status:</span>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  className="orders-create-select"
                >
                  <option value="Pending">⏳ Pending</option>
                  <option value="Processing">🔄 Processing</option>
                  <option value="Completed">✅ Completed</option>
                  <option value="Cancelled">❌ Cancelled</option>
                </select>
              </div>
              <div className="orders-create-payment">
                <span className="orders-create-status-label">Payment:</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="orders-create-select"
                >
                  <option value="Cash">💵 Cash</option>
                  <option value="Card">💳 Card</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                  <option value="Mobile Payment">📱 Mobile Payment</option>
                </select>
              </div>
            </div>
          </div>

          {dataLoading ? (
            <div className="orders-loading">
              <div className="orders-loading-spinner">
                <div className="orders-loading-ring" />
              </div>
              <p className="orders-loading-text">
                Loading customers &amp; products...
              </p>
            </div>
          ) : (
            <>
              {/* Customer Selection */}
              <div className="orders-customer-section">
                <label className="orders-customer-label">
                  <User className="w-4 h-4 text-indigo-500" />
                  Select Customer <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCustomer(val);
                    const customer = customers.find(
                      (c) => String(c.CUS_ID || c.cus_id) === String(val),
                    );
                    if (customer) {
                      const firstName =
                        customer.FIRST_NAME || customer.first_name || "";
                      const lastName =
                        customer.LAST_NAME || customer.last_name || "";
                      setSelectedCustomerName(
                        `${firstName} ${lastName}`.trim() || "Customer",
                      );
                    } else {
                      setSelectedCustomerName("");
                    }
                  }}
                  className="orders-customer-select"
                >
                  <option value="">🔍 Select a customer...</option>
                  {customers.map((customer) => {
                    const cId = customer.CUS_ID || customer.cus_id;
                    const firstName =
                      customer.FIRST_NAME || customer.first_name || "";
                    const lastName =
                      customer.LAST_NAME || customer.last_name || "";
                    const phone = customer.PHONE || customer.phone || "";
                    const fullName =
                      `${firstName} ${lastName}`.trim() || "Customer";
                    return (
                      <option key={cId} value={cId}>
                        {fullName} {phone ? `— ${phone}` : ""}
                      </option>
                    );
                  })}
                </select>

                {/* Selected customer mini profile card */}
                {selectedCustomerObj && (
                  <div className="orders-customer-profile">
                    {getCustomerImage(selectedCustomerObj) ? (
                      <img
                        src={getCustomerImage(selectedCustomerObj)}
                        alt={selectedCustomerName}
                        className="orders-customer-avatar"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className={`orders-customer-avatar-placeholder ${getAvatarColor(selectedCustomerName)}`}
                      >
                        {getInitials(selectedCustomerName)}
                      </div>
                    )}
                    <div className="orders-customer-info">
                      <p className="orders-customer-name">
                        <Check className="w-3.5 h-3.5 text-green-500" />
                        {selectedCustomerName}
                      </p>
                      <div className="orders-customer-details">
                        {(selectedCustomerObj.PHONE ||
                          selectedCustomerObj.phone) && (
                          <span className="orders-customer-detail">
                            <Phone className="w-3 h-3" />{" "}
                            {formatPhone(
                              selectedCustomerObj.PHONE ||
                                selectedCustomerObj.phone,
                            )}
                          </span>
                        )}
                        {(selectedCustomerObj.E_MAIL ||
                          selectedCustomerObj.e_mail) && (
                          <span className="orders-customer-detail">
                            <Mail className="w-3 h-3" />{" "}
                            {selectedCustomerObj.E_MAIL ||
                              selectedCustomerObj.e_mail}
                          </span>
                        )}
                        {(selectedCustomerObj.ADDRESS ||
                          selectedCustomerObj.address) && (
                          <span className="orders-customer-detail">
                            <MapPin className="w-3 h-3" />{" "}
                            {selectedCustomerObj.ADDRESS ||
                              selectedCustomerObj.address}
                          </span>
                        )}
                      </div>
                    </div>
                    {Number(
                      selectedCustomerObj.BALANCE ||
                        selectedCustomerObj.balance ||
                        0,
                    ) > 0 && (
                      <span className="orders-customer-balance">
                        $
                        {Number(
                          selectedCustomerObj.BALANCE ||
                            selectedCustomerObj.balance,
                        ).toFixed(2)}{" "}
                        balance
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Product Search & Items */}
              <div className="orders-items-section">
                <div className="orders-items-header">
                  <h3 className="orders-items-title">
                    <Package className="w-4 h-4 text-purple-500" />
                    Order Items
                    <span className="orders-items-count">
                      {totalItems} items
                    </span>
                  </h3>
                  <button
                    onClick={addItem}
                    className="orders-items-add-btn"
                  >
                    <Plus className="w-4 h-4" /> Add Item
                  </button>
                </div>

                <div className="orders-search-wrapper">
                  <Search className="orders-search-icon" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="🔍 Search products by name, barcode..."
                    className="orders-search-input"
                  />
                </div>
              </div>

              {/* Items Table */}
              {items.length === 0 ? (
                <div className="orders-empty-items">
                  <Package className="orders-empty-icon" />
                  <p className="orders-empty-title">No items added yet</p>
                  <p className="orders-empty-text">
                    Search for products and click "Add Item" to start building
                    your order
                  </p>
                  <button
                    onClick={addItem}
                    className="orders-empty-btn"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Add First Item
                  </button>
                </div>
              ) : (
                <div className="orders-items-table-wrapper">
                  <table className="orders-items-table">
                    <thead className="orders-items-thead">
                      <tr>
                        <th className="orders-items-th">Product</th>
                        <th className="orders-items-th text-center">Qty</th>
                        <th className="orders-items-th text-right">Price</th>
                        <th className="orders-items-th text-right">Discount</th>
                        <th className="orders-items-th text-right">Subtotal</th>
                        <th className="orders-items-th text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="orders-items-tbody">
                      {items.map((item, index) => {
                        const overStock =
                          item.stock !== undefined && item.qty > item.stock;
                        return (
                          <tr
                            key={item.id}
                            className="orders-items-tr"
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <td className="orders-items-td">
                              <div className="orders-items-product">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt=""
                                    className="orders-items-product-img"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <span className="orders-items-product-emoji">
                                    {getProductEmoji(item.product_name || "")}
                                  </span>
                                )}
                                <select
                                  value={item.product_id}
                                  onChange={(e) =>
                                    updateItem(
                                      item.id,
                                      "product_id",
                                      e.target.value,
                                    )
                                  }
                                  className="orders-items-product-select"
                                >
                                  {/* FIX: Placeholder moved OUTSIDE the map loop */}
                                  <option value="">Select Product</option>
                                  
                                  {filteredProducts.map((product) => {
                                    const pId =
                                      product.PRODUCT_ID || product.product_id;
                                    const name =
                                      product.NAME_EN ||
                                      product.name_en ||
                                      "Unknown";
                                    const price =
                                      product.SALEOUT_PRICE ||
                                      product.saleout_price ||
                                      0;
                                    const stock = getProductStock(product);
                                    
                                    return (
                                      <option key={pId} value={pId} disabled={stock === 0}>
                                        {name} - ${Number(price).toFixed(2)}
                                        {/* FIX: Only show status if stock exists */}
                                        {stock !== undefined && (
                                          stock > 0 
                                            ? ` (${stock} in stock)` 
                                            : ` ⚠️ Out of stock`
                                        )}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            </td>
                            <td className="orders-items-td text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "qty",
                                    Math.max(1, Number(e.target.value) || 1),
                                  )
                                }
                                className={`orders-items-qty ${overStock ? "orders-items-qty-warning" : ""}`}
                              />
                              {item.stock !== undefined && (
                                <p
                                  className={`orders-items-stock ${overStock ? "orders-items-stock-warning" : ""}`}
                                >
                                  Max: {item.stock}
                                </p>
                              )}
                            </td>
                            <td className="orders-items-td text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unit_price}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "unit_price",
                                    Math.max(0, Number(e.target.value) || 0),
                                  )
                                }
                                className="orders-items-price"
                              />
                            </td>
                            <td className="orders-items-td text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.discount}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    "discount",
                                    Math.max(0, Number(e.target.value) || 0),
                                  )
                                }
                                className="orders-items-discount"
                              />
                            </td>
                            <td className="orders-items-td text-right font-bold text-indigo-600 dark:text-indigo-400">
                              ${(item.subtotal || 0).toFixed(2)}
                            </td>
                            <td className="orders-items-td text-center">
                              <button
                                onClick={() => removeItem(item.id)}
                                className="orders-items-remove"
                                title="Remove item"
                                aria-label="Remove item"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div ref={itemsEndRef} />

              {/* Order Summary */}
              <div className="orders-summary">
                <div className="orders-summary-content">
                  <div className="orders-summary-details">
                    <div className="orders-summary-row">
                      <span className="orders-summary-label">
                        Subtotal ({totalItems} items):
                      </span>
                      <span className="orders-summary-value">
                        ${subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="orders-summary-row">
                      <span className="orders-summary-label">
                        Discount:
                      </span>
                      <div className="orders-summary-discount">
                        <span className="orders-summary-discount-symbol">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={discount}
                          onChange={(e) =>
                            setDiscount(
                              Math.max(0, Number(e.target.value) || 0),
                            )
                          }
                          className="orders-summary-discount-input"
                        />
                      </div>
                    </div>
                    <div className="orders-summary-total">
                      <span className="orders-summary-total-label">
                        Grand Total:
                      </span>
                      <span className="orders-summary-total-value">
                        ${grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="orders-actions">
                <button
                  onClick={handleSaveOrder}
                  disabled={loading || items.length === 0}
                  className="orders-actions-btn orders-actions-save"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Draft
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={isProcessingPurchase || items.length === 0}
                  className="orders-actions-btn orders-actions-purchase"
                >
                  {isProcessingPurchase ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {isProcessingPurchase ? "Processing..." : "💳 Purchase Now"}
                </button>
                <button
                  onClick={() => handlePrintInvoice()}
                  disabled={!orderId && !savedOrderData}
                  className="orders-actions-btn orders-actions-print"
                >
                  <Printer className="w-4 h-4" />
                  Print Invoice
                </button>
              </div>

              {/* Purchase Result */}
              {purchaseResult && (
                <div
                  className={`orders-result ${purchaseResult.success ? "orders-result-success" : "orders-result-error"}`}
                >
                  <div className="orders-result-content">
                    {purchaseResult.success ? (
                      <CheckCircle className="w-6 h-6 text-green-500 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-500 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={`orders-result-message ${purchaseResult.success ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}
                      >
                        {purchaseResult.message}
                      </p>
                      {purchaseResult.order_no && (
                        <p className="orders-result-order">
                          Order #:{" "}
                          <span className="orders-result-order-number">
                            {purchaseResult.order_no}
                          </span>
                        </p>
                      )}
                      {purchaseResult.local && (
                        <p className="orders-result-local">
                          <AlertTriangle className="w-3 h-3" />
                          Saved locally. It will sync automatically once the
                          server is reachable.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===== ORDER LIST VIEW ===== */}
      {viewMode === "list" && (
        <div className="orders-list-view">
          {/* Header */}
          <div className="orders-list-header">
            <div>
              <h2 className="orders-list-title">
                <List className="w-5 h-5 text-indigo-600" />
                Saved Orders
              </h2>
              <p className="orders-list-subtitle">
                {filteredOrders.length} orders{" "}
                {filterStatus !== "all" ? `(${filterStatus})` : ""}
              </p>
            </div>
            <div className="orders-list-controls">
              <div className="orders-list-search">
                <Search className="orders-list-search-icon" />
                <input
                  type="text"
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                  placeholder="Search order # or customer..."
                  className="orders-list-search-input"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="orders-list-filter"
              >
                <option value="all">All Status</option>
                <option value="Pending">⏳ Pending</option>
                <option value="Processing">🔄 Processing</option>
                <option value="Completed">✅ Completed</option>
                <option value="Cancelled">❌ Cancelled</option>
              </select>

              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split("-");
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder);
                }}
                className="orders-list-sort"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="total-desc">Highest Amount</option>
                <option value="total-asc">Lowest Amount</option>
                <option value="status-asc">Status A-Z</option>
                <option value="status-desc">Status Z-A</option>
              </select>

              <button
                onClick={fetchOrders}
                className="orders-list-refresh"
                title="Refresh"
                aria-label="Refresh orders"
              >
                <RefreshCw
                  className={`w-4 h-4 text-gray-500 ${ordersLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Orders List */}
          {ordersLoading ? (
            <div className="orders-list-loading">
              <div className="orders-list-loading-spinner" />
              <p className="orders-list-loading-text">Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="orders-list-empty">
              <ShoppingCart className="orders-list-empty-icon" />
              <p className="orders-list-empty-title">No orders found</p>
              <p className="orders-list-empty-text">
                {savedOrders.length > 0
                  ? "Try changing the filter or search"
                  : "Orders you create will appear here"}
              </p>
              {savedOrders.length === 0 && (
                <button
                  onClick={() => setViewMode("create")}
                  className="orders-list-empty-btn"
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Create New Order
                </button>
              )}
            </div>
          ) : (
            <div className="orders-list-table-wrapper">
              <table className="orders-list-table">
                <thead className="orders-list-thead">
                  <tr>
                    <th className="orders-list-th">Order #</th>
                    <th className="orders-list-th hidden sm:table-cell">Customer</th>
                    <th className="orders-list-th hidden md:table-cell">Date</th>
                    <th className="orders-list-th text-right">Total</th>
                    <th className="orders-list-th text-center">Status</th>
                    <th className="orders-list-th text-center hidden sm:table-cell">Items</th>
                    <th className="orders-list-th text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="orders-list-tbody">
                  {paginatedOrders.map((order, index) => {
                    const status = order.status || order.STATUS || "Pending";
                    const itemCount =
                      order.items?.length || order.item_count || 0;
                    return (
                      <tr
                        key={order.id || order.order_no || index}
                        className="orders-list-tr"
                        style={{ animationDelay: `${index * 0.04}s` }}
                      >
                        <td className="orders-list-td orders-list-order-no">
                          {order.order_no}
                          {order.saved_locally && (
                            <span className="orders-list-offline-badge">
                              offline
                            </span>
                          )}
                        </td>
                        <td className="orders-list-td hidden sm:table-cell">
                          {order.customer_name || "Unknown"}
                        </td>
                        <td className="orders-list-td hidden md:table-cell text-gray-500 dark:text-gray-400">
                          {formatDate(order.date || order.order_date)}
                        </td>
                        <td className="orders-list-td text-right font-bold dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          ${Number(order.total || 0).toFixed(2)}
                        </td>
                        <td className="orders-list-td text-center">
                          <span
                            className={getStatusBadge(status)}
                          >
                            {getStatusIcon(status)}
                            {status}
                          </span>
                        </td>
                        <td className="orders-list-td text-center text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                          {itemCount}
                        </td>
                        <td className="orders-list-td text-center">
                          <div className="orders-list-actions">
                            <button
                              onClick={() => handleViewOrder(order)}
                              className="orders-list-action"
                              title="View details"
                              aria-label="View order details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order)}
                              className="orders-list-action delete"
                              title="Delete order"
                              aria-label="Delete order"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* ===== PAGINATION ===== */}
          {filteredOrders.length > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filteredOrders.length}
              itemsPerPage={ITEMS_PER_PAGE}
              loading={ordersLoading}
            />
          )}
          {/* Footer */}
          <div className="orders-list-footer">
            <span>Total: {filteredOrders.length} orders</span>
            <span className="orders-list-footer-sync">
              <span>
                🔄 Synced with server when available, cached locally when
                offline
              </span>
              {savedOrders.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="orders-list-clear-cache"
                >
                  Clear local cache
                </button>
              )}
            </span>
          </div>
        </div>
      )}

      {/* ===== ORDER DETAIL MODAL ===== */}
      {showOrderDetail && selectedOrder && (
        <div className="orders-modal-overlay">
          <div className="orders-modal-content">
            <div className="orders-modal-header">
              <h2 className="orders-modal-title">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                Order Details
                <span className="orders-modal-order-no">
                  #{selectedOrder.order_no}
                </span>
              </h2>
              <button
                onClick={() => setShowOrderDetail(false)}
                className="orders-modal-close"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="orders-modal-body">
              {/* Order Info */}
              <div className="orders-modal-info">
                <div className="orders-modal-info-item">
                  <p className="orders-modal-info-label">Customer</p>
                  <p className="orders-modal-info-value">
                    {selectedOrder.customer_name || "Unknown"}
                  </p>
                </div>
                <div className="orders-modal-info-item">
                  <p className="orders-modal-info-label">Date</p>
                  <p className="orders-modal-info-value">
                    {formatDate(selectedOrder.date || selectedOrder.order_date)}
                  </p>
                </div>
                <div className="orders-modal-info-item">
                  <p className="orders-modal-info-label">Status</p>
                  <span
                    className={getStatusBadge(selectedOrder.status || selectedOrder.STATUS)}
                  >
                    {getStatusIcon(
                      selectedOrder.status || selectedOrder.STATUS,
                    )}
                    {selectedOrder.status || selectedOrder.STATUS || "Pending"}
                  </span>
                </div>
                <div className="orders-modal-info-item">
                  <p className="orders-modal-info-label">Payment</p>
                  <p className="orders-modal-info-value">
                    {selectedOrder.payment_method ||
                      selectedOrder.PAYMENT_METHOD ||
                      "N/A"}
                  </p>
                </div>
              </div>

              {/* Items */}
              <h3 className="orders-modal-items-title">
                <Package className="w-4 h-4 text-purple-500" />
                Order Items ({selectedOrder.items?.length || 0})
              </h3>
              <div className="orders-modal-items-table-wrapper">
                <table className="orders-modal-items-table">
                  <thead className="orders-modal-items-thead">
                    <tr>
                      <th className="orders-modal-items-th">Product</th>
                      <th className="orders-modal-items-th text-center">Qty</th>
                      <th className="orders-modal-items-th text-right">Price</th>
                      <th className="orders-modal-items-th text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="orders-modal-items-tbody">
                    {selectedOrder.items?.map((item, index) => (
                      <tr
                        key={index}
                        className="orders-modal-items-tr"
                      >
                        <td className="orders-modal-items-td">
                          <div className="orders-modal-items-product">
                            {item.image && (
                              <img
                                src={item.image}
                                alt=""
                                className="orders-modal-items-product-img"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                              />
                            )}
                            {item.product_name || "Product"}
                          </div>
                        </td>
                        <td className="orders-modal-items-td text-center">
                          {item.qty}
                        </td>
                        <td className="orders-modal-items-td text-right">
                          ${Number(item.unit_price || 0).toFixed(2)}
                        </td>
                        <td className="orders-modal-items-td text-right font-medium">
                          ${Number(item.subtotal || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="orders-modal-items-footer">
                      <td
                        colSpan="3"
                        className="orders-modal-items-footer-label"
                      >
                        Subtotal:
                      </td>
                      <td className="orders-modal-items-footer-value">
                        ${Number(selectedOrder.subtotal || 0).toFixed(2)}
                      </td>
                    </tr>
                    {Number(selectedOrder.discount || 0) > 0 && (
                      <tr>
                        <td
                          colSpan="3"
                          className="orders-modal-items-footer-label text-gray-500 dark:text-gray-400"
                        >
                          Discount:
                        </td>
                        <td className="orders-modal-items-footer-value text-red-500">
                          -${Number(selectedOrder.discount || 0).toFixed(2)}
                        </td>
                      </tr>
                    )}
                    <tr className="orders-modal-items-footer-total">
                      <td
                        colSpan="3"
                        className="orders-modal-items-footer-label font-bold text-lg"
                      >
                        Grand Total:
                      </td>
                      <td className="orders-modal-items-footer-value font-bold text-xl text-indigo-600 dark:text-indigo-400">
                        ${Number(selectedOrder.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="orders-modal-footer">
              <button
                onClick={() => setShowOrderDetail(false)}
                className="orders-modal-footer-btn orders-modal-footer-close"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handlePrintInvoice(selectedOrder);
                  setShowOrderDetail(false);
                }}
                className="orders-modal-footer-btn orders-modal-footer-print"
              >
                <Printer className="w-4 h-4" />
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="orders-footer">
        <p className="orders-footer-text">
          <span>🛒 {filteredOrders.length} orders displayed</span>
          <span>•</span>
          <span>💰 ${orderStats.revenue.toFixed(2)} total revenue</span>
          <span>•</span>
          <span>⏳ {orderStats.pending} pending</span>
          <span>•</span>
          <span>✅ {orderStats.completed} completed</span>
          <span>•</span>
          <span>{new Date().toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
};

export default Orders;