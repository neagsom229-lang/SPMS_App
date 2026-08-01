// frontend/src/components/LowStockAlert.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const LowStockAlert = ({ products, loading }) => {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>
    );
  }

  const lowStockItems = products || [];

  if (lowStockItems.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">✅</div>
        <p className="text-gray-600 dark:text-gray-400">All products are well stocked</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lowStockItems.map((item, index) => (
        <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{item.name_en}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Stock: {item.qtyavailable} / Alert: {item.qty_alert}
              </p>
            </div>
          </div>
          <Link 
            to={`/products/${item.product_id}`}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            Restock
          </Link>
        </div>
      ))}
    </div>
  );
};

export default LowStockAlert;