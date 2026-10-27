// frontend/src/components/sell/PaymentModal.jsx
import React, { useState } from 'react';
import { X, DollarSign, QrCode, CreditCard, Building2, CheckCircle, RefreshCw } from 'lucide-react';
import KHQRPayment from '../KHQRPayment';

const PaymentModal = ({ total, onCompleteSale, onClose, processing }) => {
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [cashReceived, setCashReceived] = useState('');

  const cashNum = Number(cashReceived) || 0;
  const changeDue = Math.max(0, cashNum - total);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-indigo-600" /> Complete Payment — Total: ${total.toFixed(2)}
        </h2>

        {/* Payment Methods */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { id: 'Cash', label: 'Cash', icon: DollarSign },
            { id: 'KHQR', label: 'KHQR', icon: QrCode },
            { id: 'Card', label: 'Card', icon: CreditCard },
            { id: 'Bank', label: 'Bank', icon: Building2 },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setPaymentMethod(m.id)}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 font-semibold text-xs transition ${
                paymentMethod === m.id
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <m.icon className="w-5 h-5" />
              {m.label}
            </button>
          ))}
        </div>

        {/* Method Specific UI */}
        {paymentMethod === 'Cash' && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cash Received ($)</label>
              <input
                type="number"
                min={total}
                step="0.01"
                value={cashReceived}
                onChange={e => setCashReceived(e.target.value)}
                placeholder={total.toFixed(2)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-lg font-bold"
                autoFocus
              />
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Change Due:</span>
              <span className={`text-2xl font-bold ${changeDue >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                ${changeDue.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {paymentMethod === 'KHQR' && (
          <div className="mb-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl text-center space-y-3">
              <QrCode className="w-24 h-24 mx-auto text-indigo-600" />
              <p className="text-sm font-semibold">Scan KHQR to pay ${total.toFixed(2)}</p>
              <p className="text-xs text-gray-400">ABA Mobile / Bakong Compatible</p>
            </div>
          </div>
        )}

        {paymentMethod !== 'Cash' && paymentMethod !== 'KHQR' && (
          <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-xl text-center">
            <p className="text-sm font-semibold">Process payment via {paymentMethod}</p>
            <p className="text-xs text-gray-400 mt-1">Terminal or direct bank transfer confirmed.</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 font-bold rounded-xl text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onCompleteSale(paymentMethod)}
            disabled={processing || (paymentMethod === 'Cash' && cashNum < total)}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg transition flex items-center justify-center gap-2"
          >
            {processing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Confirm Sale (${total.toFixed(2)})
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
