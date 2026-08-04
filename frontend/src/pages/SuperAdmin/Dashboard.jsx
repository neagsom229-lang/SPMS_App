// frontend/src/pages/SuperAdmin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { toast } from 'react-hot-toast';
import { 
  Building2, Users, Package, ShoppingCart,
  DollarSign, RefreshCw, TrendingUp
} from 'lucide-react';

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0
  });
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch system stats and tenants
      const [statsRes, tenantsRes] = await Promise.all([
        apiClient.get('/system/stats'),
        apiClient.get('/tenants?limit=5')
      ]);
      
      setStats(statsRes.data);
      setTenants(tenantsRes.data.tenants || []);
    } catch (error) {
      console.error('❌ Fetch data error:', error);
      setError(error.response?.data?.error || 'Failed to load dashboard data');
      toast.error('Failed to load dashboard data');
      
      // Set default values so UI doesn't break
      setStats({
        totalTenants: 0,
        totalUsers: 0,
        totalProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalCustomers: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      title: 'Total Businesses', 
      value: stats.totalTenants || 0, 
      icon: Building2, 
      color: 'bg-blue-500/20 text-blue-400',
      border: 'border-blue-500/30'
    },
    { 
      title: 'Total Users', 
      value: stats.totalUsers || 0, 
      icon: Users, 
      color: 'bg-purple-500/20 text-purple-400',
      border: 'border-purple-500/30'
    },
    { 
      title: 'Total Products', 
      value: stats.totalProducts || 0, 
      icon: Package, 
      color: 'bg-emerald-500/20 text-emerald-400',
      border: 'border-emerald-500/30'
    },
    { 
      title: 'Total Orders', 
      value: stats.totalOrders || 0, 
      icon: ShoppingCart, 
      color: 'bg-amber-500/20 text-amber-400',
      border: 'border-amber-500/30'
    },
    { 
      title: 'Total Revenue', 
      value: `$${(stats.totalRevenue || 0).toFixed(2)}`, 
      icon: DollarSign, 
      color: 'bg-green-500/20 text-green-400',
      border: 'border-green-500/30'
    },
    { 
      title: 'Total Customers', 
      value: stats.totalCustomers || 0, 
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Admin Dashboard</h1>
          <p className="text-gray-400">
            Welcome back, {user?.fullname || 'Super Admin'}!
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className={`bg-white/5 backdrop-blur-sm border ${stat.border} rounded-xl p-4 transition-all hover:scale-105 hover:shadow-lg`}
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

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <h2 className="text-white font-semibold mb-4">Recent Businesses</h2>
        {tenants.length === 0 ? (
          <p className="text-gray-400 text-sm">No businesses registered yet</p>
        ) : (
          <div className="space-y-3">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                <div>
                  <p className="text-white font-medium">{tenant.name}</p>
                  <p className="text-gray-400 text-xs">{tenant.subdomain} • {tenant.email}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    tenant.status === 'ACTIVE' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {tenant.status || 'ACTIVE'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;