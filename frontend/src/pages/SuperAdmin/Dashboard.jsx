// frontend/src/pages/SuperAdmin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { toast } from 'react-hot-toast';
import {
  Building2, Users, Package, ShoppingCart,
  DollarSign, TrendingUp, Activity, Clock,
  RefreshCw, ChevronRight, Plus, Search,
  Filter, MoreVertical, Eye, Edit, Trash2
} from 'lucide-react';

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [systemStats, setSystemStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [showCreateTenant, setShowCreateTenant] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, tenantsRes] = await Promise.all([
        api.get('/auth/system-stats'),
        api.get('/auth/tenants')
      ]);

      setSystemStats(statsRes.data);
      setTenants(tenantsRes.data);
    } catch (error) {
      console.error('Fetch data error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      title: 'Total Businesses', 
      value: systemStats?.overview?.total_tenants || 0, 
      icon: Building2, 
      color: 'bg-blue-500/20 text-blue-400',
      border: 'border-blue-500/30'
    },
    { 
      title: 'Total Users', 
      value: systemStats?.overview?.total_users || 0, 
      icon: Users, 
      color: 'bg-purple-500/20 text-purple-400',
      border: 'border-purple-500/30'
    },
    { 
      title: 'Total Products', 
      value: systemStats?.overview?.total_products || 0, 
      icon: Package, 
      color: 'bg-emerald-500/20 text-emerald-400',
      border: 'border-emerald-500/30'
    },
    { 
      title: 'Total Orders', 
      value: systemStats?.overview?.total_orders || 0, 
      icon: ShoppingCart, 
      color: 'bg-amber-500/20 text-amber-400',
      border: 'border-amber-500/30'
    },
    { 
      title: 'Total Revenue', 
      value: `$${(systemStats?.overview?.total_revenue || 0).toFixed(2)}`, 
      icon: DollarSign, 
      color: 'bg-green-500/20 text-green-400',
      border: 'border-green-500/30'
    },
    { 
      title: 'Active Businesses', 
      value: tenants.filter(t => t.status === 'ACTIVE').length, 
      icon: Activity, 
      color: 'bg-indigo-500/20 text-indigo-400',
      border: 'border-indigo-500/30'
    },
  ];

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subdomain.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Super Admin Dashboard</h1>
          <p className="text-gray-400">Welcome back, {user?.fullname || 'Super Admin'}!</p>
        </div>
        <button
          onClick={() => setShowCreateTenant(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:shadow-lg transition-all duration-300"
        >
          <Plus className="w-4 h-4" />
          New Business
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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

      {/* Tenants List */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-white font-semibold">All Businesses</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search businesses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <button className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Business</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Subdomain</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Users</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Products</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Orders</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{tenant.name}</p>
                      <p className="text-gray-400 text-xs">{tenant.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{tenant.subdomain}</td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{tenant.user_count || 0}</td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{tenant.product_count || 0}</td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{tenant.order_count || 0}</td>
                  <td className="px-4 py-3 text-gray-300 text-sm">
                    ${(tenant.total_revenue || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      tenant.status === 'ACTIVE' 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : tenant.status === 'INACTIVE'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;