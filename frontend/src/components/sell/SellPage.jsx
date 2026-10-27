// frontend/src/components/sell/SellPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import ProductCatalog from './ProductCatalog';
import CartPanel from './CartPanel';
import CustomerPicker from './CustomerPicker';
import PaymentModal from './PaymentModal';
import Receipt from './Receipt';
import { ShoppingCart, RefreshCw } from 'lucide-react';

const SellPage = () => {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [discount, setDiscount] = useState(0);
  const [heldOrders, setHeldOrders] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const queryClient = useQueryClient();

  // Reset idempotency key when cart changes
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, [cart]);

  // Fetch Catalog & Customers
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, custRes] = await Promise.all([
        apiClient.get('/products', { params: { limit: 200 } }),
        apiClient.get('/customers', { params: { limit: 200 } })
      ]);

      const prodList = prodRes.data.products || prodRes.data.data || (Array.isArray(prodRes.data) ? prodRes.data : []);
      const custList = custRes.data.customers || custRes.data.data || (Array.isArray(custRes.data) ? custRes.data : []);

      setProducts(prodList);
      setCustomers(custList);
    } catch (err) {
      console.error('Failed to load sell data:', err);
      toast.error('Failed to load product catalog or customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add to cart with stock capping
  const handleAddToCart = (product) => {
    const prodId = product.id || product.PRODUCT_ID;
    const name = product.name || product.name_en || product.NAME_EN || 'Product';
    const price = Number(product.price || product.saleout_price || product.SALEOUT_PRICE || 0);
    const available = Number(product.stock ?? product.qtyinstock ?? product.qtyavailable ?? 100);

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
  };

  // Update quantity (stepper capped by stock)
  const handleUpdateQuantity = (product_id, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(product_id);
      return;
    }
    setCart(prev => {
      return prev.map(item => {
        if (item.product_id === product_id) {
          if (newQty > item.available) {
            toast.error(`Only ${item.available} in stock`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  const handleRemoveItem = (product_id) => {
    setCart(prev => prev.filter(item => item.product_id !== product_id));
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscount(0);
  };

  // Subtotal & Total
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const numericDiscount = Number(discount) || 0;
  const total = Math.max(0, subtotal - numericDiscount);

  // Hold / Resume
  const handleHoldOrder = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setHeldOrders(prev => [...prev, { cart, discount, selectedCustomer, total }]);
    setCart([]);
    setDiscount(0);
    toast.success('Order placed on hold');
  };

  const handleResumeOrder = (index) => {
    const held = heldOrders[index];
    if (!held) return;
    setCart(held.cart);
    setDiscount(held.discount);
    setSelectedCustomer(held.selectedCustomer);
    setHeldOrders(prev => prev.filter((_, i) => i !== index));
    toast.success('Resumed held order');
  };

  // Complete Checkout Sale
  const handleCompleteSale = async (paymentMethod) => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        customer_id: selectedCustomer || null,
        items: cart.map(i => ({ product_id: i.product_id, qty: i.quantity })),
        discount: numericDiscount,
        payment_method: paymentMethod,
        idempotency_key: idempotencyKey
      };

      const { data } = await apiClient.post('/orders', payload);
      setCompletedOrder(data);
      toast.success('🎉 Sale completed successfully!');

      // Invalidate react-query keys as required
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      setCart([]);
      setDiscount(0);
      setShowPaymentModal(false);
      fetchData(); // Refresh product stock levels
    } catch (err) {
      console.error('Checkout error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to complete sale';
      toast.error(errorMsg);
      fetchData();
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            POS Selling Terminal
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Scan items, build cart, and process checkout</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Catalog */}
        <div className="lg:col-span-2">
          <ProductCatalog
            products={products}
            cart={cart}
            onAddToCart={handleAddToCart}
          />
        </div>

        {/* Right Col: Customer & Cart */}
        <div className="flex flex-col h-[750px]">
          <CustomerPicker
            customers={customers}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={setSelectedCustomer}
            onCustomerAdded={(newC) => setCustomers(prev => [newC, ...prev])}
          />
          <div className="flex-1 min-h-0">
            <CartPanel
              cart={cart}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              discount={discount}
              onDiscountChange={setDiscount}
              subtotal={subtotal}
              total={total}
              onHoldOrder={handleHoldOrder}
              onResumeOrder={handleResumeOrder}
              heldOrders={heldOrders}
              onProceedToCheckout={() => setShowPaymentModal(true)}
            />
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          total={total}
          processing={processing}
          onClose={() => setShowPaymentModal(false)}
          onCompleteSale={handleCompleteSale}
        />
      )}

      {/* Receipt Modal */}
      {completedOrder && (
        <Receipt
          order={completedOrder}
          onNewSale={() => setCompletedOrder(null)}
        />
      )}
    </div>
  );
};

export default SellPage;
