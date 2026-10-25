// frontend/src/components/sell/Receipt.jsx
import React from 'react';
import { CheckCircle, Printer, FileText, Plus } from 'lucide-react';
import { exportInvoicePDF } from '../../utils/pdfExport';

const Receipt = ({ order, onNewSale }) => {
  if (!order) return null;

  const items = order.items || [];
  const total = Number(order.total || 0);
  const discount = Number(order.discount || 0);
  const subtotal = total + discount;

  const handlePrint = () => {
    window.print();
  };

  const handlePDF = () => {
    exportInvoicePDF(order, `receipt-${order.order_no || 'order'}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 relative shadow-2xl text-center space-y-4">
        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
        <h2 className="text-2xl font-bold">Sale Completed!</h2>
        <p className="text-sm text-gray-500">Order #{order.order_no || order.or_id}</p>

        {/* 80mm Thermal Receipt Styling Preview */}
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-left text-xs space-y-2 font-mono border border-dashed border-gray-300 dark:border-gray-700">
          <div className="text-center pb-2 border-b border-dashed border-gray-300">
            <p className="font-bold text-sm">SPMS RETAIL STORE</p>
            <p className="text-[10px] text-gray-400">Phnom Penh, Cambodia</p>
            <p className="text-[10px] text-gray-400">{new Date(order.created_at || Date.now()).toLocaleString()}</p>
          </div>
          <div>
            <p><span className="font-semibold">Customer:</span> {order.customer_name || 'Walk-in'}</p>
            <p><span className="font-semibold">Payment:</span> {order.payment_method}</p>
          </div>
          <div className="border-t border-b border-dashed border-gray-300 py-2 space-y-1">
            {items.map((i, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="truncate pr-2">{i.name || i.product_name || 'Item'} x{i.qty || i.quantity}</span>
                <span>${((i.unit_price || 0) * (i.qty || i.quantity || 1)).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Discount:</span>
                <span>-${discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-300">
              <span>Total:</span>
              <span className="text-indigo-600">${total.toFixed(2)}</span>
            </div>
          </div>
          <div className="text-center pt-2 text-[10px] text-gray-400">
            <p>Thank you for your purchase!</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            onClick={handlePrint}
            className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 shadow"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={handlePDF}
            className="py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 shadow"
          >
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={onNewSale}
            className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 shadow"
          >
            <Plus className="w-4 h-4" /> New Sale
          </button>
        </div>
      </div>
    </div>
  );
};

export default Receipt;
