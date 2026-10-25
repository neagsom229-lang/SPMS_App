// frontend/src/components/POS.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import apiClient from '../api/client';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, Printer, CheckCircle,
  CreditCard, DollarSign, QrCode, User, Package, AlertTriangle, RefreshCw, X, Check
} from 'lucide-react';

const POS = () => {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [showKHQRModal, setShowKHQRModal] = useState(false);
  const [khqrData, setKhqrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const barcodeInputRef = useRef(null);

  // Fetch Products & Customers
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, custRes] = await Promise.all([
        apiClient.get('/products', { params: { limit: 100 } }),
        apiClient.get('/customers', { params: { limit: 100 } })
      ]);

      const prodList = prodRes.data.products || prodRes.data.data || (Array.isArray(prodRes.data) ? prodRes.data : []);
      const custList = custRes.data.customers || custRes.data.data || (Array.isArray(custRes.data) ? custRes.data : []);

      setProducts(prodList);
      setCustomers(custList);
      if (custList.length > 0 && !selectedCustomer) {
        setSelectedCustomer(custList[0].id || custList[0].CUS_ID);
      }
    } catch (error) {
      console.error('Failed to load POS data:', error);
      toast.error('Failed to load products or customers');
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(['All']);
    products.forEach(p => {
      if (p.category || p.CATEGORY) set.add(p.category || p.CATEGORY);
      if (p.brand || p.BRAND) set.add(p.brand || p.BRAND);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const name = p.name || p.NAME_EN || '';
      const barcode = p.barcode || p.BARCODE || '';
      const cat = p.category || p.CATEGORY || p.brand || p.BRAND || '';
      
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            barcode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'All' || cat === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategory]);

  // Add to cart
  const addToCart = (product) => {
    const prodId = product.id || product.PRODUCT_ID;
    const name = product.name || product.NAME_EN || 'Product';
    const price = Number(product.price || product.SALEOUT_PRICE || 0);
    const available = Number(product.qtyavailable ?? product.QtyInStock ?? 100);

    setCart(prev => {
      const existing = prev.find(item => item.product_id === prodId);
      if (existing) {
        if (existing.quantity >= available) {
          toast.error(`Stock limit reached for ${name}`);
          return prev;
        }
        return prev.map(item =>
          item.product_id === prodId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      if (available <= 0) {
        toast.error(`Product ${name} is out of stock`);
        return prev;
      }
      return [...prev, { product_id: prodId, name, price, quantity: 1, available }];
    });
    toast.success(`Added ${name} to cart`);
  };

  // Update cart quantity
  const updateQuantity = (product_id, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product_id === product_id) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.available) {
            toast.error(`Only ${item.available} in stock`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  // Remove from cart
  const removeFromCart = (product_id) => {
    setCart(prev => prev.filter(item => item.product_id !== product_id));
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const numericDiscount = Number(discount) || 0;
  const total = Math.max(0, subtotal - numericDiscount);

  // Handle Barcode Scan / Enter
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const found = products.find(p => 
      (p.barcode && p.barcode.toLowerCase() === searchQuery.trim().toLowerCase()) ||
      (p.BARCODE && p.BARCODE.toLowerCase() === searchQuery.trim().toLowerCase()) ||
      (String(p.id) === searchQuery.trim())
    );
    if (found) {
      addToCart(found);
      setSearchQuery('');
    } else {
      toast.error('Product not found by barcode/ID');
    }
  };

  // Checkout execution
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }

    if (paymentMethod === 'KHQR' && !showKHQRModal) {
      setQrLoading(true);
      setShowKHQRModal(true);
      try {
        const { data } = await apiClient.get('/payment/khqr', {
          params: { amount: total, plan: 'pos_sale' }
        });
        setKhqrData(data);
      } catch (err) {
        console.error('KHQR generation error:', err);
        // Fallback simulated KHQR
        setKhqrData({ qrString: '00020101021230560016A0000006770101110113123456789012353038405802KH5913SPMS Merchant6009Phnom Penh63041234', amount: total });
      } finally {
        setQrLoading(false);
      }
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        customer_id: selectedCustomer,
        items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        discount: numericDiscount,
        payment_method: paymentMethod,
        notes: notes || 'POS Sale',
        idempotency_key: `pos-${Date.now()}-${Math.random()}`
      };

      const { data } = await apiClient.post('/orders', payload);
      setCompletedOrder(data);
      toast.success('🎉 Sale completed successfully!');
      setCart([]);
      setDiscount(0);
      setNotes('');
      setShowKHQRModal(false);
      fetchData(); // Refresh stock
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.response?.data?.error || 'Failed to complete sale');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            POS Selling Terminal
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Scan items, build cart, and process lightning-fast checkout</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Catalog
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Product Catalog & Search */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search & Barcode Form */}
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products by name, barcode, or ID..."
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow transition flex items-center gap-2"
            >
              <QrCode className="w-5 h-5" /> Scan / Add
            </button>
          </form>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-2" />
              <p className="text-lg font-medium text-gray-600 dark:text-gray-300">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
              {filteredProducts.map(p => {
                const id = p.id || p.PRODUCT_ID;
                const name = p.name || p.NAME_EN || 'Product';
                const price = Number(p.price || p.SALEOUT_PRICE || 0);
                const stock = p.qtyavailable ?? p.QtyInStock ?? 0;
                const outOfStock = stock <= 0;

                return (
                  <div
                    key={id}
                    onClick={() => !outOfStock && addToCart(p)}
                    className={`p-4 rounded-xl border transition flex flex-col justify-between bg-white dark:bg-gray-800 ${
                      outOfStock
                        ? 'opacity-50 cursor-not-allowed border-red-200 dark:border-red-900/50'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full font-mono text-gray-600 dark:text-gray-300">
                          {p.barcode || p.BARCODE || `#${id}`}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          outOfStock ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          Stock: {stock}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1">{name}</h3>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">${price.toFixed(2)}</span>
                      <button
                        disabled={outOfStock}
                        className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Cart & Checkout */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col h-[750px] shadow-lg">
          <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700 mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" /> Current Sale ({cart.reduce((s, i) => s + i.quantity, 0)})
            </h2>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Customer Selector */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Customer</label>
            <select
              value={selectedCustomer}
              onChange={e => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {customers.map(c => {
                const cid = c.id || c.CUS_ID;
                const cname = c.name || `${c.FIRST_NAME || ''} ${c.LAST_NAME || ''}`.trim() || 'Walk-in Customer';
                return (
                  <option key={cid} value={cid}>
                    {cname} {c.phone ? `(${c.phone})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4">
            {cart.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Cart is empty. Select products to begin.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product_id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="font-semibold text-sm truncate">{item.name}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">${item.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product_id, -1)}
                      className="p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product_id, 1)}
                      className="p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="p-1 text-red-500 hover:text-red-700 ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Summary & Totals */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold">${subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Discount ($)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-24 px-2 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-right text-sm"
              />
            </div>

            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
              <span>Total Due</span>
              <span className="text-blue-600 dark:text-blue-400">${total.toFixed(2)}</span>
            </div>

            {/* Payment Method */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('Cash')}
                className={`py-2 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition ${
                  paymentMethod === 'Cash'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                }`}
              >
                <DollarSign className="w-4 h-4" /> Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('KHQR')}
                className={`py-2 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition ${
                  paymentMethod === 'KHQR'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                }`}
              >
                <QrCode className="w-4 h-4" /> KHQR
              </button>
            </div>

            <button
              onClick={handleCheckout}
              disabled={processing || cart.length === 0}
              className="w-full mt-3 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              {processing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              Complete Sale (${total.toFixed(2)})
            </button>
          </div>
        </div>
      </div>

      {/* KHQR Modal */}
      {showKHQRModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setShowKHQRModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <QrCode className="w-6 h-6 text-blue-600" /> Scan KHQR to Pay
            </h3>
            {qrLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="bg-white p-4 inline-block rounded-xl shadow border">
                  {/* QR Display Placeholder or Image */}
                  <div className="w-48 h-48 bg-gray-100 flex items-center justify-center rounded border border-dashed border-gray-300">
                    <QrCode className="w-32 h-32 text-gray-800" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-600">${total.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Scan with ABA Mobile, ACLEDA, or any Bakong KHQR App</p>
                <button
                  onClick={handleCheckout}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition"
                >
                  Confirm Payment Received
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed Order Success Modal / Receipt */}
      {completedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 relative shadow-2xl text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
            <h3 className="text-2xl font-bold">Sale Completed!</h3>
            <p className="text-sm text-gray-500">Order #{completedOrder.order_no}</p>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-left text-sm space-y-1">
              <p><span className="font-semibold">Customer:</span> {completedOrder.customer_name || 'Walk-in'}</p>
              <p><span className="font-semibold">Total:</span> ${Number(completedOrder.total).toFixed(2)}</p>
              <p><span className="font-semibold">Payment:</span> {completedOrder.payment_method}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" /> Print Receipt
              </button>
              <button
                onClick={() => setCompletedOrder(null)}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold rounded-xl transition"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
