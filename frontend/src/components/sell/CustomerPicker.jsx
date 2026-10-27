// frontend/src/components/sell/CustomerPicker.jsx
import React, { useState } from 'react';
import { User, UserPlus, X } from 'lucide-react';
import apiClient from '../../api/client';
import { toast } from 'react-hot-toast';

const CustomerPicker = ({ customers, selectedCustomer, onSelectCustomer, onCustomerAdded }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.post('/customers', {
        name,
        phone,
        email,
        address
      });
      toast.success('Customer added successfully');
      onCustomerAdded(data);
      onSelectCustomer(data.id);
      setShowAddModal(false);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
    } catch (err) {
      console.error('Error adding customer:', err);
      toast.error(err.response?.data?.error || 'Failed to add customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1.5">
          <User className="w-4 h-4 text-indigo-600" /> Customer / Client
        </label>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold flex items-center gap-1"
        >
          <UserPlus className="w-3.5 h-3.5" /> Quick Add
        </button>
      </div>

      <select
        value={selectedCustomer}
        onChange={e => onSelectCustomer(e.target.value)}
        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">-- Walk-in Customer --</option>
        {customers.map(c => {
          const cid = c.id || c.CUS_ID;
          const cname = c.name || c.name_en || `${c.FIRST_NAME || ''} ${c.LAST_NAME || ''}`.trim() || 'Customer';
          return (
            <option key={cid} value={cid}>
              {cname} {c.phone ? `(${c.phone})` : ''}
            </option>
          );
        })}
      </select>

      {/* Quick Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-indigo-600" /> Quick Add Customer
            </h3>
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Customer full name"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-gray-900 dark:border-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-gray-900 dark:border-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-gray-900 dark:border-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Address"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-gray-900 dark:border-gray-700 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 font-semibold rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow transition"
                >
                  {loading ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPicker;
