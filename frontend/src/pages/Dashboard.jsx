// frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { toast } from 'react-hot-toast';
import { 
  Package, ShoppingCart, Users, AlertTriangle, 
  DollarSign, TrendingUp, Clock, RefreshCw
} from 'lucide-react';

const Dashboard = () => {
  const { user, tenant } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalCustomers: 0,
    lowStock: 0,
    recentOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // ✅ FIX: Added /api/ prefix to all calls
      const [statsRes, ordersRes, stockRes] = await Promise.all([
        apiClient.get('/api/dashboard/stats'),
        apiClient.get('/api/orders/recent?limit=5'),
        apiClient.get('/api/stock/low-stock')
      ]);

      setStats(statsRes.data);
      setRecentOrders(ordersRes.data);
      setLowStockItems(stockRes.data);
    } catch (error) {
      console.error('Fetch dashboard error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      title: 'Total Products', 
      value: stats.totalProducts, 
      icon: Package, 
      color: 'bg-blue-500/20 text-blue-400',
      border: 'border-blue-500/30'
    },
    { 
      title: 'Total Orders', 
      value: stats.totalOrders, 
      icon: ShoppingCart, 
      color: 'bg-green-500/20 text-green-400',
      border: 'border-green-500/30'
    },
    { 
      title: 'Total Customers', 
      value: stats.totalCustomers, 
      icon: Users, 
      color: 'bg-purple-500/20 text-purple-400',
      border: 'border-purple-500/30'
    },
    { 
      title: 'Low Stock Alert', 
      value: stats.lowStock, 
      icon: AlertTriangle, 
      color: 'bg-red-500/20 text-red-400',
      border: 'border-red-500/30'
    },
    { 
      title: 'Total Revenue', 
      value: `$${stats.totalRevenue.toFixed(2)}`, 
      icon: DollarSign, 
      color: 'bg-yellow-500/20 text-yellow-400',
      border: 'border-yellow-500/30'
    },
    { 
      title: 'Pending Orders', 
      value: stats.pendingOrders, 
      icon: Clock, 
      color: 'bg-orange-500/20 text-orange-400',
      border: 'border-orange-500/30'
    },
    { 
      title: 'Recent Orders (7d)', 
      value: stats.recentOrders, 
      icon: TrendingUp, 
      color: 'bg-indigo-500/20 text-indigo-400',
      border: 'border-indigo-500/30'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.fullname || 'Admin'}!
        </h1>
        <p className="text-gray-400">
          {tenant?.name || 'Your Business'} Dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className={`bg-white/5 backdrop-blur-sm border ${stat.border} rounded-xl p-4`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{stat.title}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <h2 className="text-white font-semibold mb-4">Recent Orders</h2>
          {recentOrders.length === 0 ? (
            <p className="text-gray-400 text-sm">No recent orders</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div>
                    <p className="text-white text-sm">#{order.id}</p>
                    <p className="text-gray-400 text-xs">{order.customer_name || 'Walk-in'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm">${order.total_amount}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                      order.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <h2 className="text-white font-semibold mb-4">Low Stock Alert</h2>
          {lowStockItems.length === 0 ? (
            <p className="text-green-400 text-sm">✅ All products have sufficient stock</p>
          ) : (
            <div className="space-y-3">
              {lowStockItems.map((product) => (
                <div key={product.id} className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div>
                    <p className="text-white text-sm">{product.name_en}</p>
                    <p className="text-gray-400 text-xs">In stock: {product.qty_instock}</p>
                  </div>
                  <span className="text-red-400 text-xs px-2 py-0.5 bg-red-500/20 rounded-full">
                    Alert: {product.qty_alert}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;