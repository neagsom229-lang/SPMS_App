// frontend/src/pages/Storefront.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient, { getErrorMessage } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';
import { 
  ShoppingCart, Search, Globe, Phone, MapPin, Clock, CheckCircle, 
  AlertTriangle, X, ChevronRight, ArrowLeft, Cpu, Laptop, Monitor, 
  Headphones, MousePointer, ShieldCheck, Zap, Sparkles, Terminal, Filter, Layers 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

function ProductCard({ product, lang, exchangeRate, addToCart, setSelectedProduct }) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rX = -((y - centerY) / centerY) * 10;
    const rY = ((x - centerX) / centerX) * 10;

    setRotateX(rX);
    setRotateY(rY);
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15
    });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlare(prev => ({ ...prev, opacity: 0 }));
  };

  const displayName = lang === 'kh' && product.name_kh ? product.name_kh : product.name_en;
  const displayDesc = lang === 'kh' && product.description_kh ? product.description_kh : product.description_en;
  const isOut = product.stock_status === 'out';
  const isLow = product.stock_status === 'low';

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1, 1, 1)`,
        transition: rotateX === 0 && rotateY === 0 ? 'transform 0.4s ease-in-out' : 'transform 0.05s ease-out',
        willChange: 'transform',
      }}
      className="relative group bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:border-cyan-500/50 hover:shadow-[0_15px_40px_rgba(6,182,212,0.15)] transition-all duration-300 flex flex-col"
    >
      {/* Neon Glow Background */}
      <div className="absolute -inset-px bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-2xl opacity-0 group-hover:opacity-40 blur-lg transition-opacity duration-500 -z-10" />

      {/* Glare effect */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 rounded-2xl z-20"
        style={{
          opacity: glare.opacity,
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.25) 0%, transparent 70%)`
        }}
      />

      {/* Product Image / 3D Cube Placeholder */}
      <div 
        className="relative h-56 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden cursor-pointer flex items-center justify-center p-6 border-b border-slate-800/80"
        onClick={() => setSelectedProduct(product)}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent opacity-60" />
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={displayName} 
            className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(6,182,212,0.3)] group-hover:scale-110 transition-transform duration-500" 
          />
        ) : (
          <div className="relative w-24 h-24 transform-gpu animate-pulse flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/30 to-indigo-500/30 rounded-2xl blur-xl" />
            <div className="w-16 h-16 border-2 border-cyan-400/80 rounded-2xl bg-slate-900/90 shadow-[0_0_25px_rgba(6,182,212,0.5)] flex items-center justify-center transform rotate-12 group-hover:rotate-45 transition-transform duration-500">
              <Cpu className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3 z-30">
          {isOut ? (
            <span className="bg-red-500/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md shadow-lg border border-red-400/30">
              {lang === 'en' ? 'Out of Stock' : 'អស់ពីស្តុក'}
            </span>
          ) : isLow ? (
            <span className="bg-amber-500/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md shadow-lg border border-amber-400/30">
              {lang === 'en' ? 'Low Stock' : 'ស្តុកនៅសល់តិច'}
            </span>
          ) : (
            <span className="bg-cyan-500/90 text-slate-950 text-xs font-extrabold px-3 py-1 rounded-full backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.6)] border border-cyan-300/50">
              {lang === 'en' ? 'In Stock' : 'មានក្នុងស្តុក'}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between z-10 bg-slate-900/60 backdrop-blur-md">
        <div>
          <h3 
            className="font-bold text-slate-100 text-lg line-clamp-1 cursor-pointer hover:text-cyan-400 transition-colors"
            onClick={() => setSelectedProduct(product)}
          >
            {displayName}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
            {displayDesc || (lang === 'en' ? 'Next-gen high performance gaming & productivity hardware.' : 'ផ្នែករឹងហ្គេមនិងផលិតភាពជំនាន់ក្រោយ។')}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800/80">
          <div>
            <span className="text-xl font-black text-cyan-400 tracking-tight">${product.price.toFixed(2)}</span>
            <span className="block text-[11px] text-slate-500 font-medium">៛{(product.price * exchangeRate).toLocaleString()}</span>
          </div>

          <button
            disabled={isOut}
            onClick={() => addToCart(product)}
            className={`relative px-4 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all duration-150 transform active:translate-y-0.5 shadow-md flex items-center space-x-1.5 ${
              isOut
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-b from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black shadow-[0_4px_0_#0e7490,0_6px_12px_rgba(6,182,212,0.4)] active:shadow-[0_1px_0_#0e7490,0_2px_4px_rgba(6,182,212,0.4)] border border-cyan-300/40'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{lang === 'en' ? 'Add To Cart' : 'បញ្ជាទិញ'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Storefront() {
  const { slug } = useParams();
  const storeSlug = slug || 'demo-store';
  const queryClient = useQueryClient();

  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [priceRange, setPriceRange] = useState('all'); // 'all', 'under_50', '50_200', '200_1000', '1000_plus'
  const [visibleCount, setVisibleCount] = useState(12); // Pagination chunk size
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
    setVisibleCount(12); // Reset pagination on filter change
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

  // Client-side Price Range Filtering on fetched products
  const filteredProducts = useMemo(() => {
    if (priceRange === 'all') return products;
    return products.filter(p => {
      const pr = Number(p.price || 0);
      if (priceRange === 'under_50') return pr < 50;
      if (priceRange === '50_200') return pr >= 50 && pr <= 200;
      if (priceRange === '200_1000') return pr > 200 && pr <= 1000;
      if (priceRange === '1000_plus') return pr > 1000;
      return true;
    });
  }, [products, priceRange]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

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
    toast.success(`Added ${product.name_en || product.name} to cart`);
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
        phone: customerPhone,
        delivery_type: deliveryType,
        delivery_address: deliveryAddress,
        notes,
        payment_method: paymentMethod,
        items: cart.map(i => ({ productid: i.id, product_id: i.id, qty: i.qty, price: i.price })),
        idempotency_key: idempotencyKey
      };

      const res = await apiClient.post(`/public/store/${storeSlug}/orders`, payload);
      setOrderResult(res.data);
      setCart([]);
      localStorage.removeItem(`cart_${storeSlug}`);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);

      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });

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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-cyan-400">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-sm tracking-widest uppercase font-mono animate-pulse">Initializing 3D Store...</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 text-center px-4">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mb-4">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold">Store Not Found</h1>
        <p className="text-slate-400 mt-2 max-w-md">The 3D showroom you are looking for does not exist or is currently offline.</p>
        <Link to="/" className="mt-6 inline-flex items-center px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold rounded-xl hover:opacity-90 transition shadow-lg shadow-cyan-500/20">
          <ArrowLeft className="w-4 h-4 mr-2" /> Return to Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950 font-sans antialiased overflow-x-hidden">
      {/* BACKGROUND GLOW EFFECTS */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-1/3 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[160px]" />
      </div>

      {/* HEADER / NAVBAR */}
      <header className="sticky top-0 z-40 bg-slate-900/70 backdrop-blur-xl border-b border-slate-800/80 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-slate-400 hover:text-white transition mr-2" title="Back to Home">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.store_name} className="w-12 h-12 rounded-xl object-cover ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-500/20" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                {store.store_name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-cyan-400">
                {store.store_name}
              </h1>
              <p className="text-xs text-slate-400 flex items-center mt-0.5 font-medium">
                <MapPin className="w-3.5 h-3.5 mr-1 text-cyan-400" /> {store.address || 'Phnom Penh Tech Hub'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setLang(lang === 'en' ? 'kh' : 'en')}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 transition shadow-inner"
            >
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>{lang === 'en' ? 'ខ្មែរ (KH)' : 'English (EN)'}</span>
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 rounded-xl transition shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center font-bold"
              aria-label="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-bounce">
                  {cart.reduce((sum, item) => sum + item.qty, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {orderResult && (
        <div className="bg-gradient-to-r from-cyan-600 to-emerald-600 text-slate-950 py-4 px-4 text-center font-bold shadow-xl">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between">
            <div className="flex items-center mb-2 sm:mb-0 space-x-2">
              <CheckCircle className="w-6 h-6 text-slate-950" />
              <span>Order placed successfully! Order #{orderResult.order_no}</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="bg-slate-950/20 px-3 py-1 rounded-lg text-xs font-mono">Tracking: {orderResult.tracking_code.substring(0, 8)}...</span>
              <button onClick={() => setOrderResult(null)} className="bg-slate-950 text-cyan-400 px-3 py-1 rounded-lg text-xs font-extrabold hover:bg-slate-900 transition">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <section className="relative py-20 px-4 overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-slate-900/50 via-slate-950 to-slate-950">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-6 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'en' ? '40+ Pro Hardware Items Available' : 'ផលិតផលជាង ៤០មុខមានក្នុងស្តុក'}</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-400 leading-tight">
            {lang === 'en' ? 'Build Your Dream Setup' : 'បង្កើតកន្លែងកម្សាន្តនិងការងារក្នុងក្តីស្រមៃរបស់អ្នក'}
          </h2>

          <p className="text-slate-400 max-w-2xl mx-auto text-base md:text-lg mb-10 leading-relaxed">
            {lang === 'en' 
              ? 'High-performance Custom Gaming PCs, OLED Laptops, 4K Monitors, and Elite Peripherals.'
              : 'កុំព្យូទ័រលេងហ្គេមកម្រិតខ្ពស់ ឡាស្តុបទំនើប និងគ្រឿងបរិក្ខារសម្រាប់ដំណើរការលឿនបំផុត។'}
          </p>

          <div className="flex flex-wrap justify-center gap-6 text-sm font-semibold text-slate-300">
            <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl shadow-lg">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>{store.is_open ? (lang === 'en' ? 'Store Open' : 'ហាងបើកទ្វារ') : (lang === 'en' ? 'Store Closed' : 'ហាងបិទទ្វារ')}</span>
            </div>
            <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl shadow-lg">
              <Phone className="w-4 h-4 text-cyan-400" />
              <span>{store.phone || '+855 12 345 678'}</span>
            </div>
            <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl shadow-lg">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'en' ? 'Official Warranty' : 'ការធានាផ្លូវការ'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* STICKY CONTROLS & CATEGORIES BAR */}
        <div className="sticky top-20 z-30 bg-slate-950/90 backdrop-blur-2xl py-4 mb-8 border-b border-slate-800/80 flex flex-col gap-4">
          
          {/* CATEGORY PILLS */}
          <div className="flex overflow-x-auto w-full pb-2 space-x-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all whitespace-nowrap flex items-center space-x-2 ${
                selectedCategory === ''
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400'
                  : 'bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>{lang === 'en' ? 'All Categories' : 'គ្រប់ប្រភេទ'}</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(String(cat.id))}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all whitespace-nowrap flex items-center space-x-2 ${
                  selectedCategory === String(cat.id)
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400'
                    : 'bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{cat.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-950/40 text-cyan-300 font-mono">
                  {cat.product_count}
                </span>
              </button>
            ))}
          </div>

          {/* SEARCH, PRICE FILTER, & SORT CONTROLS */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full">
            <div className="relative w-full md:w-80">
              <Terminal className="absolute left-3.5 top-3 w-4 h-4 text-cyan-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={lang === 'en' ? 'Search 40+ hardware items...' : 'ស្វែងរកផ្នែករឹង...'}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 shadow-[0_0_15px_rgba(0,0,0,0.5)] transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* PRICE RANGE FILTER */}
              <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400 hidden sm:inline">Price:</span>
                <select
                  value={priceRange}
                  onChange={e => setPriceRange(e.target.value)}
                  className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Prices</option>
                  <option value="under_50" className="bg-slate-900">Under $50</option>
                  <option value="50_200" className="bg-slate-900">$50 - $200</option>
                  <option value="200_1000" className="bg-slate-900">$200 - $1000</option>
                  <option value="1000_plus" className="bg-slate-900">$1000+</option>
                </select>
              </div>

              {/* SORT BY */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500 transition shadow-inner"
              >
                <option value="default">{lang === 'en' ? 'Sort: Featured' : 'តម្រៀប: ពេញនិយម'}</option>
                <option value="price_asc">{lang === 'en' ? 'Price: Low to High' : 'តម្លៃ: ទាបទៅខ្ពស់'}</option>
                <option value="price_desc">{lang === 'en' ? 'Price: High to Low' : 'តម្លៃ: ខ្ពស់ទៅទាប'}</option>
                <option value="name">{lang === 'en' ? 'Name: A-Z' : 'ឈ្មោះ: A-Z'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* PRODUCTS GRID */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800">
            <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 text-cyan-400">
              <Cpu className="w-8 h-8 opacity-40 animate-pulse" />
            </div>
            <p className="text-slate-400 text-base font-semibold">
              {lang === 'en' ? 'No hardware components found matching criteria.' : 'រកមិនឃើញផលិតផលដែលត្រូវគ្នាទេ។'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {paginatedProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  lang={lang}
                  exchangeRate={exchangeRate}
                  addToCart={addToCart}
                  setSelectedProduct={setSelectedProduct}
                />
              ))}
            </div>

            {/* PAGINATION / LOAD MORE */}
            {visibleCount < filteredProducts.length && (
              <div className="mt-12 text-center">
                <button
                  onClick={() => setVisibleCount(prev => prev + 12)}
                  className="px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black rounded-xl uppercase tracking-wider text-xs shadow-[0_0_25px_rgba(6,182,212,0.4)] transition transform hover:scale-105"
                >
                  Load More Hardware ({filteredProducts.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* CART DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={() => setIsCartOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
              <div className="p-5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-base font-black tracking-wider uppercase flex items-center text-cyan-400">
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {lang === 'en' ? 'Tech Cart' : 'កន្ត្រកទំនិញ'} ({cart.reduce((s, i) => s + i.qty, 0)})
                </h2>
                <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-white transition">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-20 text-slate-500">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-3 opacity-20 text-cyan-400 animate-pulse" />
                    <p className="font-medium">{lang === 'en' ? 'Your tech cart is empty' : 'កន្ត្រករបស់អ្នកទទេ'}</p>
                  </div>
                ) : (
                  cart.map(item => {
                    const itemName = lang === 'kh' && item.name_kh ? item.name_kh : item.name_en;
                    return (
                      <div key={item.id} className="flex items-center justify-between bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 shadow-md">
                        <div className="flex-1 pr-3">
                          <h4 className="font-bold text-sm text-slate-100 line-clamp-1">{itemName}</h4>
                          <span className="text-xs text-cyan-400 font-mono font-bold">${item.price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700/80 rounded-lg p-1">
                          <button
                            onClick={() => updateCartQty(item.id, item.qty - 1)}
                            className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center justify-center font-bold text-xs transition"
                          >
                            -
                          </button>
                          <span className="text-xs font-mono font-bold w-6 text-center text-cyan-400">{item.qty}</span>
                          <button
                            onClick={() => updateCartQty(item.id, item.qty + 1)}
                            className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center justify-center font-bold text-xs transition"
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
                <div className="p-5 bg-slate-950/90 border-t border-slate-800">
                  <div className="space-y-2 text-xs mb-5 font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal</span>
                      <span className="font-bold text-slate-200">${cartSubtotal.toFixed(2)}</span>
                    </div>
                    {taxRate > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>Tax ({taxRate}%)</span>
                        <span className="font-bold text-slate-200">${taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black pt-3 border-t border-slate-800 text-white">
                      <span>Total</span>
                      <span className="text-cyan-400 text-base">${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="text-right text-[11px] text-slate-500">៛{(cartTotal * exchangeRate).toLocaleString()}</div>
                  </div>

                  <button
                    onClick={() => {
                      if (!store.accepts_online_orders) {
                        toast.error('Store is not accepting online orders right now');
                        return;
                      }
                      setIsCheckoutOpen(true);
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black rounded-xl uppercase tracking-wider text-xs transition shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center space-x-2"
                  >
                    <span>Proceed to Checkout</span>
                    <ChevronRight className="w-4 h-4" />
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
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsCheckoutOpen(false)} />
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <h3 className="text-lg font-black tracking-tight text-white flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2 text-cyan-400" />
                Secure Checkout
              </h3>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-slate-400 hover:text-white transition">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g., Sok Dara"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Phone Number (Cambodia) *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="e.g., 012 345 678"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {store.pickup_enabled && (
                  <button
                    type="button"
                    onClick={() => setDeliveryType('pickup')}
                    className={`py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border transition ${
                      deliveryType === 'pickup'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Store Pickup
                  </button>
                )}
                {store.delivery_enabled && (
                  <button
                    type="button"
                    onClick={() => setDeliveryType('delivery')}
                    className={`py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border transition ${
                      deliveryType === 'delivery'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Home Delivery
                  </button>
                )}
              </div>

              {deliveryType === 'delivery' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Delivery Address *</label>
                  <textarea
                    required
                    rows={2}
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="Street number, Sangkat, Khan, Phnom Penh"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Order Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Deliver before 5 PM"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition"
                >
                  <option value="Cash">Cash on {deliveryType === 'pickup' ? 'Pickup' : 'Delivery'}</option>
                  <option value="KHQR">KHQR / ABA PayWay</option>
                </select>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black rounded-xl uppercase tracking-wider text-xs transition shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50"
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
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setSelectedProduct(null)} />
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden z-10">
            <div className="relative h-64 bg-slate-950 flex items-center justify-center p-6 border-b border-slate-800">
              {selectedProduct.image_url ? (
                <img src={selectedProduct.image_url} alt={selectedProduct.name_en} className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(6,182,212,0.3)]" />
              ) : (
                <div className="w-24 h-24 border-2 border-cyan-400/80 rounded-2xl bg-slate-900 shadow-[0_0_25px_rgba(6,182,212,0.5)] flex items-center justify-center">
                  <Cpu className="w-12 h-12 text-cyan-400" />
                </div>
              )}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 bg-slate-950/80 border border-slate-700 text-slate-300 p-2 rounded-full hover:bg-slate-900 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-black text-white mb-2">{lang === 'kh' && selectedProduct.name_kh ? selectedProduct.name_kh : selectedProduct.name_en}</h3>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                {lang === 'kh' && selectedProduct.description_kh ? selectedProduct.description_kh : selectedProduct.description_en}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div>
                  <span className="text-2xl font-black text-cyan-400">${selectedProduct.price.toFixed(2)}</span>
                  <span className="block text-xs text-slate-500 font-medium">៛{(selectedProduct.price * exchangeRate).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => {
                    addToCart(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black rounded-xl uppercase tracking-wider text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] transition"
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
