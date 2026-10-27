// frontend/src/components/orders/OnlineOrders.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import {
  Package,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Printer,
  RefreshCw,
  AlertCircle,
  ShoppingBag,
  Truck,
  Store,
  Check,
  Ban,
  ArrowRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const STATUSES = ['All', 'Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'];

const NEXT_STATUS = {
  'Pending': 'Confirmed',
  'Confirmed': 'Preparing',
  'Preparing': 'Ready',
  'Ready': 'Completed',
};

const STATUS_COLORS = {
  Pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700',
  Confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700',
  Preparing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-700',
  Ready: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700',
  Completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700',
  Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700',
};

const OnlineOrders = () => {
  const [activeTab, setActiveTab] = useState('Pending');
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const queryClient = useQueryClient();

  // Fetch counts per status
  const { data: counts = {} } = useQuery({
    queryKey: ['online-orders-count'],
    queryFn: async () => {
      const res = await apiClient.get('/orders/online/count');
      return res.data;
    },
    refetchInterval: 20000,
  });

  // Fetch orders by status
  const { data: ordersData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['online-orders', activeTab],
    queryFn: async () => {
      const params = activeTab !== 'All' ? { status: activeTab } : {};
      const res = await apiClient.get('/orders/online', { params });
      return res.data;
    },
    refetchInterval: 20000,
  });

  // Mutation for status update
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await apiClient.patch(`/orders/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (data, variables) => {
      toast.success(`Order #${data.order_no || variables.id} status updated to ${variables.status}`);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['online-orders'] });
      queryClient.invalidateQueries({ queryKey: ['online-orders-count'] });
    },
    onError: (err) => {
      const serverMsg = err.response?.data?.error || err.message || 'Failed to update status';
      setActionError(serverMsg);
      toast.error(serverMsg);
    }
  });

  const handleStatusChange = (id, nextStatus) => {
    setActionError(null);
    statusMutation.mutate({ id, status: nextStatus });
  };

  const handleCancelOrder = (id) => {
    setActionError(null);
    statusMutation.mutate({ id, status: 'Cancelled' });
    setConfirmCancelId(null);
  };

  const handlePrintPackingSlip = (order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups for printing packing slips');
      return;
    }

    const itemsHtml = (order.items || []).map(item => `
      <tr>
        <td style="padding: 6px; border-bottom: 1px solid #ddd;">${item.product_name || item.name || 'Item'}</td>
        <td style="padding: 6px; border-bottom: 1px solid #ddd; text-align: center;">${item.qty}</td>
        <td style="padding: 6px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(item.unit_price || 0).toFixed(2)}</td>
        <td style="padding: 6px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(item.subtotal || (item.qty * item.unit_price)).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Packing Slip #${order.order_no}</title>
          <style>
            @page { size: 80mm auto; margin: 5mm; }
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; width: 70mm; margin: 0 auto; padding: 10px; }
            h2, h3 { text-align: center; margin: 4px 0; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            th, td { font-size: 11px; }
            .bold { font-weight: bold; }
            .right { text-align: right; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <h2>PACKING SLIP</h2>
          <h3>Order #${order.order_no}</h3>
          <div class="center">${new Date(order.created_at || Date.now()).toLocaleString()}</div>
          <div class="divider"></div>
          <div><strong>Customer:</strong> ${order.customer_name || 'Walk-in'}</div>
          <div><strong>Phone:</strong> ${order.customer_phone || 'N/A'}</div>
          <div><strong>Type:</strong> ${(order.delivery_type || 'pickup').toUpperCase()}</div>
          ${order.delivery_address ? `<div><strong>Address:</strong> ${order.delivery_address}</div>` : ''}
          ${order.notes ? `<div><strong>Notes:</strong> ${order.notes}</div>` : ''}
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Item</th>
                <th>Qty</th>
                <th class="right">Price</th>
                <th class="right">Sub</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="right bold" style="font-size: 14px;">Total: $${Number(order.total || 0).toFixed(2)}</div>
          <div class="center" style="margin-top: 15px; font-size: 10px;">Thank you for your order!</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const orders = ordersData?.orders || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Online Orders Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Real-time queue for online store purchases and delivery tracking.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{actionError}</span>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {STATUSES.map(status => {
          const count = status === 'All' 
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : (counts[status] || 0);
          const isActive = activeTab === status;

          return (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all shadow-xs ${
                isActive
                  ? 'bg-blue-600 text-white shadow-blue-500/25'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <span>{status}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 animate-pulse space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
              <div className="h-20 bg-gray-100 dark:bg-gray-700/50 rounded-xl"></div>
              <div className="flex gap-2">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl flex-1"></div>
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-24"></div>
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-12 text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Failed to load online orders</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm max-w-md mx-auto">{error?.message || 'Please check your connection and try again.'}</p>
          <button onClick={() => refetch()} className="px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition">
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-16 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">No online orders yet</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto">
            When customers place orders from your public store, they will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map(order => {
            const nextStatus = NEXT_STATUS[order.status];
            const isProcessing = statusMutation.isPending;
            const timeAgo = new Date(order.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div 
                key={order.or_id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-700/60 flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-semibold text-gray-400 dark:text-gray-500">#{order.order_no}</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{order.customer_name || 'Customer'}</h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {order.status}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4 flex-1">
                  {/* Customer Phone & Delivery */}
                  <div className="space-y-2 text-sm">
                    {order.customer_phone && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Phone className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <a href={`tel:${order.customer_phone}`} className="hover:underline font-medium text-emerald-600 dark:text-emerald-400">
                          {order.customer_phone} (Tap to call)
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      {order.delivery_type === 'delivery' ? (
                        <Truck className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      ) : (
                        <Store className="h-4 w-4 text-purple-500 flex-shrink-0" />
                      )}
                      <span className="capitalize font-medium">
                        {order.delivery_type || 'Pickup'}
                      </span>
                    </div>
                    {order.delivery_address && (
                      <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                        <MapPin className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs">{order.delivery_address}</span>
                      </div>
                    )}
                    {order.notes && (
                      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 p-2.5 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                        <strong>Notes:</strong> {order.notes}
                      </div>
                    )}
                  </div>

                  {/* Order Items */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Items ({order.items?.length || 0})</p>
                    <div className="max-h-32 overflow-y-auto space-y-1.5 scrollbar-thin">
                      {(order.items || []).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs text-gray-700 dark:text-gray-300">
                          <span className="truncate pr-2">{item.qty}x {item.product_name || item.name}</span>
                          <span className="font-mono font-medium">${Number(item.subtotal || (item.qty * item.unit_price)).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total & Time */}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700/60">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{timeAgo}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">Total:</span>
                      <p className="text-lg font-bold text-gray-900 dark:text-white font-mono">${Number(order.total || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Card Footer / Actions */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handlePrintPackingSlip(order)}
                    className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    title="Print Packing Slip"
                  >
                    <Printer className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-2 flex-1 justify-end">
                    {['Pending', 'Confirmed', 'Preparing', 'Ready'].includes(order.status) && (
                      <button
                        onClick={() => setConfirmCancelId(order.or_id)}
                        disabled={isProcessing}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}

                    {nextStatus && (
                      <button
                        onClick={() => handleStatusChange(order.or_id, nextStatus)}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                      >
                        <span>Mark {nextStatus}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Confirm Cancel Modal per card */}
                {confirmCancelId === order.or_id && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-20 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">Cancel Order #{order.order_no}?</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        This will restore inventory for all items in this order and set status to Cancelled.
                      </p>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setConfirmCancelId(null)}
                          className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          Keep Order
                        </button>
                        <button
                          onClick={() => handleCancelOrder(order.or_id)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
                        >
                          Yes, Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OnlineOrders;
