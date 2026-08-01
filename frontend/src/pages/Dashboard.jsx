// Add stats cards with icons, quick actions, charts
// I'll provide complete code
// frontend/src/pages/Dashboard.jsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import StatsCard from '../components/StatsCard';
import RevenueChart from '../components/RevenueChart';
import RecentOrders from '../components/RecentOrders';
import LowStockAlert from '../components/LowStockAlert';
import LoadingSpinner from '../components/LoadingSpinner';
import SkeletonLoader from '../components/SkeletonLoader';

import { 
  CurrencyDollarIcon, 
  ShoppingBagIcon, 
  UsersIcon, 
  CubeIcon,
  PlusIcon,
  DocumentChartBarIcon,
  UserPlusIcon,
  CubePlusIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 30000
  });
   const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: dashboardApi.getStats,
  });

  if (isLoading) return <LoadingSpinner />;
  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['recentOrders'],
    queryFn: () => dashboardApi.getRecentOrders()
  });

  const { data: lowStock, isLoading: stockLoading } = useQuery({
    queryKey: ['lowStock'],
    queryFn: () => dashboardApi.getLowStock()
  });

  // Quick action buttons
  const quickActions = [
    { name: 'New Order', icon: PlusIcon, href: '/orders/new', color: 'bg-blue-600' },
    { name: 'Add Product', icon: CubePlusIcon, href: '/products/new', color: 'bg-green-600' },
    { name: 'New Customer', icon: UserPlusIcon, href: '/customers/new', color: 'bg-purple-600' },
    { name: 'Reports', icon: DocumentChartBarIcon, href: '/reports', color: 'bg-orange-600' },
  ];

  // Stats data
  const statsData = [
    {
      title: 'Total Revenue',
      value: `$${stats?.totalRevenue?.toFixed(2) || '0.00'}`,
      icon: CurrencyDollarIcon,
      color: 'bg-green-500',
      change: '+12.5%',
      trend: 'up'
    },
    {
      title: 'Total Orders',
      value: stats?.totalOrders || 0,
      icon: ShoppingBagIcon,
      color: 'bg-blue-500',
      change: '+8.2%',
      trend: 'up'
    },
    {
      title: 'Active Customers',
      value: stats?.totalCustomers || 0,
      icon: UsersIcon,
      color: 'bg-purple-500',
      change: '+5.3%',
      trend: 'up'
    },
    {
      title: 'Low Stock Items',
      value: stats?.lowStockItems || 0,
      icon: CubeIcon,
      color: 'bg-red-500',
      change: '-2.1%',
      trend: 'down'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Welcome back! Here's what's happening.</p>
        </div>
        <button 
          onClick={() => refetch()}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.name}
            to={action.href}
            className={`${action.color} text-white p-4 rounded-xl hover:shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2`}
          >
            <action.icon className="h-5 w-5" />
            <span>{action.name}</span>
          </Link>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat, index) => (
          <StatsCard key={index} {...stat} loading={isLoading} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Revenue Trend</h3>
          <RevenueChart data={stats?.monthlyRevenue} loading={isLoading} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">⚠️ Low Stock Alerts</h3>
          <LowStockAlert products={lowStock} loading={stockLoading} />
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Orders</h3>
          <Link to="/orders" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm">
            View All →
          </Link>
        </div>
        <RecentOrders orders={recentOrders} loading={ordersLoading} />
      </div>
    </div>
  );
};

export default Dashboard;