                                                                                // frontend/src/pages/Storefront.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient, { getErrorMessage } from '../api/client';
import { ShoppingCart, Search, Globe, Phone, MapPin, Clock, CheckCircle, AlertTriangle, X, ChevronRight, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Storefront() {
  const { slug } = useParams();
  const storeSlug = slug || 'demo-store';

  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [lang, setLang] = useState('en'); // 'en' | 'kh'

  // Cart state
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(`cart_${storeSlug}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Checkout state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  useEffect(() => {
    localStorage.setItem(`cart_${storeSlug}`, JSON.stringify(cart));
  }, [cart, storeSlug]);

  useEffect(() => {
    fetchStoreData();
  }, [storeSlug]);

  useEffect(() => {
    fetchProducts();
  }, [storeSlug, selectedCategory, searchQuery, sortBy]);

  const fetchStoreData = async () => {
    try {
      const [storeRes, catRes] = await Promise.all([
        apiClient.get(`/public/store/${storeSlug}`),
        apiClient.get(`/public/store/${storeSlug}/categories`)
      ]);
      setStore(storeRes.data.store);
      setCategories(catRes.data.categories || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.q = searchQuery;
      if (sortBy !== 'default') params.sort = sortBy;

      const res = await apiClient.get(`/public/store/${storeSlug}/menu`, { params });
      setProducts(res.data.products || []);
    } catch (err) {
      console.error('Failed to fetch menu products:', err);
    }
  };

  const addToCart = (product, qty = 1) => {
    if (product.stock_status === 'out') {
      toast.error('Product is out of stock');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, qty: item.qty + qty } : item
        );
      }
      return [...prev, { ...product, qty }];
    });
    toast.added ? null : toast.success(`Added ${product.name_en} to cart`);
  };

  const updateCartQty = (productId, qty) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.id !== productId));
    } else {
      setCart(prev => prev.map(item => item.id === productId ? { ...item, qty } : item));
    }
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const taxRate = store?.tax_rate ? parseFloat(store.tax_rate) : 0;
  const taxAmount = (cartSubtotal * taxRate) / 100;
  const cartTotal = cartSubtotal + taxAmount;
  const exchangeRate = store?.exchange_rate ? parseFloat(store.exchange_rate) : 4000;

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error('Please enter your name and phone number');
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = 'idemp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_type: deliveryType,
        delivery_address: deliveryAddress,
        notes,
        payment_method: paymentMethod,
        items: cart.map(i => ({ product_id: i.id, qty: i.qty })),
        idempotency_key: idempotencyKey
      };

      const res = await apiClient.post(`/public/store/${storeSlug}/orders`, payload);
      setOrderResult(res.data);
      setCart([]);
      localStorage.removeItem(`cart_${storeSlug}`);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      toast.success('Order placed successfully!');
    } catch (err) {
      if (err.response?.status === 409) {
        const data = err.response.data;
        toast.error(`Stock conflict: ${data.product_name} only has ${data.available} left.`);
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-center px-4">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Store Not Found</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">The store you are looking for does not exist or is inactive.</p>
        <Link to="/" className="mt-6 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* HEADER */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.store_name} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xl">
                {store.store_name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{store.store_name}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-0.5">
                <MapPin className="w-3.5 h-3.5 mr-1" /> {store.address || 'Phnom Penh'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setLang(lang === 'en' ? 'kh' : 'en')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Globe className="w-4 h-4 text-indigo-600" />
              <span>{lang === 'en' ? 'ខ្មែរ (KH)' : 'English (EN)'}</span>
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition"
              aria-label="Shopping Cart"
            >
              <ShoppingCart className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {cart.reduce((sum, item) => sum + item.qty, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {orderResult && (
        <div className="bg-emerald-600 text-white py-4 px-4 text-center">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between">
            <div className="flex items-center mb-2 sm:mb-0">
              <CheckCircle className="w-6 h-6 mr-2" />
              <span className="font-semibold">Order placed successfully! Order #{orderResult.order_no}</span>
            </div>
            <div className="flex space-x-2">
              <span className="bg-emerald-700 px-3 py-1 rounded text-sm">Tracking: {orderResult.tracking_code.substring(0, 8)}...</span>
              <button onClick={() => setOrderResult(null)} className="bg-white text-emerald-800 px-3 py-1 rounded text-sm font-medium">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* HERO BANNER */}
      <div className="bg-gradient-to-r from-indigo-800 to-indigo-600 text-white py-12 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3">
            {lang === 'en' ? 'Explore Our Menu & Order Online' : 'បញ្ជាទិញម្ហូបអាហារនិងភេសជ្ជៈតាមអនឡាញ'}
          </h2>
          <p className="text-indigo-100 max-w-2xl mx-auto text-sm md:text-base">
            {lang === 'en' ? 'Freshly prepared, fast delivery or convenient pickup.' : 'រៀបចំថ្មីៗ សេវាកម្មដឹកជញ្ជូនរហ័សទាន់ចិត្ត។'}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm font-medium">
            <span className="bg-indigo-700/60 px-4 py-2 rounded-full flex items-center">
              <Clock className="w-4 h-4 mr-2" /> {store.is_open ? 'Open Now' : 'Closed'}
            </span>
            <span className="bg-indigo-700/60 px-4 py-2 rounded-full flex items-center">
              <Phone className="w-4 h-4 mr-2" /> {store.phone || '+855 12 345 678'}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* CONTROLS: SEARCH & SORT */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          {/* CATEGORY TABS */}
          <div className="flex overflow-x-auto w-full md:w-auto pb-2 space-x-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                selectedCategory === ''
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              {lang === 'en' ? 'All Items' : 'មុខទំនិញទាំងអស់'}
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  selectedCategory === String(cat.id)
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                }`}
              >
                {cat.name} ({cat.product_count})
              </button>
            ))}
          </div>

          {/* SEARCH & SORT */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={lang === 'en' ? 'Search menu...' : 'ស្វែងរកមុខម្ហូប...'}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="default">{lang === 'en' ? 'Sort by: Featured' : 'តម្រៀបតាម: ពេញនិយម'}</option>
              <option value="price_asc">{lang === 'en' ? 'Price: Low to High' : 'តម្លៃ: ទាបទៅខ្ពស់'}</option>
              <option value="price_desc">{lang === 'en' ? 'Price: High to Low' : 'តម្លៃ: ខ្ពស់ទៅទាប'}</option>
              <option value="name">{lang === 'en' ? 'Name: A-Z' : 'ឈ្មោះ: A-Z'}</option>
            </select>
          </div>
        </div>

        {/* PRODUCTS GRID */}
        {products.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {lang === 'en' ? 'No menu items found.' : 'រកមិនឃើញមុខទំនិញទេ។'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(product => {
              const displayName = lang === 'kh' && product.name_kh ? product.name_kh : product.name_en;
              const displayDesc = lang === 'kh' && product.description_kh ? product.description_kh : product.description_en;
              const isOut = product.stock_status === 'out';
              const isLow = product.stock_status === 'low';

              return (
                <div key={product.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                  <div className="relative h-48 bg-gray-100 dark:bg-gray-700 cursor-pointer" onClick={() => setSelectedProduct(product)}>
                    {product.image_url ? (
                      <img src={product.image_url} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-2xl bg-indigo-50 dark:bg-gray-700">
                        {displayName.charAt(0)}
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {isOut ? (
                        <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                          {lang === 'en' ? 'Out of Stock' : 'អស់ពីស្តុក'}
                        </span>
                      ) : isLow ? (
                        <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                          {lang === 'en' ? 'Low Stock' : 'ស្តុកនៅសល់តិច'}
                        </span>
                      ) : (
                        <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                          {lang === 'en' ? 'Available' : 'មានក្នុងស្តុក'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-base line-clamp-1 cursor-pointer hover:text-indigo-600" onClick={() => setSelectedProduct(product)}>
                        {displayName}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                        {displayDesc || (lang === 'en' ? 'Freshly prepared item' : 'រៀបចំថ្មីៗស្រស់ៗ')}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">${product.price.toFixed(2)}</span>
                        <span className="block text-xs text-gray-400">៛{(product.price * exchange_rate).toLocaleString()}</span>
                      </div>
                      <button
                        disabled={isOut}
                        onClick={() => addToCart(product)}
                        className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition ${
                          isOut
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                        }`}
                      >
                        {lang === 'en' ? 'Add' : 'បញ្ជាទិញ'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CART DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-md bg-white dark:bg-gray-800 shadow-xl flex flex-col">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2 text-indigo-600" />
                  {lang === 'en' ? 'Your Cart' : 'កន្ត្រកទំនិញ'} ({cart.reduce((s, i) => s + i.qty, 0)})
                </h2>
                <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-3 opacity-30" />
                    <p>{lang === 'en' ? 'Your cart is empty' : 'កន្ត្រករបស់អ្នកទទេ'}</p>
                  </div>
                ) : (
                  cart.map(item => {
                    const itemName = lang === 'kh' && item.name_kh ? item.name_kh : item.name_en;
                    return (
                      <div key={item.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex-1 pr-2">
                          <h4 className="font-semibold text-sm">{itemName}</h4>
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">${item.price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateCartQty(item.id, item.qty - 1)}
                            className="w-7 h-7 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center font-bold text-sm"
                          >
                            -
                          </button>
                          <span className="text-sm font-semibold w-6 text-center">{item.qty}</span>
                          <button
                            onClick={() => updateCartQty(item.id, item.qty + 1)}
                            className="w-7 h-7 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center font-bold text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                  <div className="space-y-1.5 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                      <span className="font-semibold">${cartSubtotal.toFixed(2)}</span>
                    </div>
                    {taxRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Tax ({taxRate}%)</span>
                        <span className="font-semibold">${taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200 dark:border-gray-600">
                      <span>Total</span>
                      <span className="text-indigo-600 dark:text-indigo-400">${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="text-right text-xs text-gray-400">៛{(cartTotal * exchange_rate).toLocaleString()}</div>
                  </div>

                  <button
                    onClick={() => {
                      if (!store.accepts_online_orders) {
                        toast.error('Store is not accepting online orders right now');
                        return;
                      }
                      setIsCheckoutOpen(true);
                    }}
                    className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow transition flex items-center justify-center"
                  >
                    <span>Proceed to Checkout</span>
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCheckoutOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700 mb-4">
              <h3 className="text-lg font-bold">Complete Your Order</h3>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g., Sok Dara"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Phone Number (Cambodia) *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="e.g., 012 345 678"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {store.pickup_enabled && (
                  <button
                    type="button"
                    onClick={() => setDeliveryType('pickup')}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-sm border transition ${
                      deliveryType === 'pickup'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Store Pickup
                  </button>
                )}
                {store.delivery_enabled && (
                  <button
                    type="button"
                    onClick={() => setDeliveryType('delivery')}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-sm border transition ${
                      deliveryType === 'delivery'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Home Delivery
                  </button>
                )}
              </div>

              {deliveryType === 'delivery' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Delivery Address *</label>
                  <textarea
                    required
                    rows={2}
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="Street number, Sangkat, Khan, Phnom Penh"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Order Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Less sugar, call upon arrival"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-900"
                >
                  <option value="Cash">Cash on {deliveryType === 'pickup' ? 'Pickup' : 'Delivery'}</option>
                  <option value="KHQR">KHQR / ABA PayWay</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition shadow disabled:opacity-50"
                >
                  {submitting ? 'Placing Order...' : `Confirm Order ($${cartTotal.toFixed(2)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRODUCT DETAIL MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden z-10">
            <div className="relative h-64 bg-gray-100 dark:bg-gray-700">
              {selectedProduct.image_url ? (
                <img src={selectedProduct.image_url} alt={selectedProduct.name_en} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-3xl">
                  {selectedProduct.name_en.charAt(0)}
                </div>
              )}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-1">{lang === 'kh' && selectedProduct.name_kh ? selectedProduct.name_kh : selectedProduct.name_en}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {lang === 'kh' && selectedProduct.description_kh ? selectedProduct.description_kh : selectedProduct.description_en}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">${selectedProduct.price.toFixed(2)}</span>
                  <span className="block text-xs text-gray-400">៛{(selectedProduct.price * exchange_rate).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => {
                    addToCart(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
