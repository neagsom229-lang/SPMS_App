// frontend/src/components/sell/CartPanel.jsx
import React, { useState } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, PauseCircle, PlayCircle, Tag } from 'lucide-react';

const CartPanel = ({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  discount,
  onDiscountChange,
  subtotal,
  total,
  onHoldOrder,
  onResumeOrder,
  heldOrders,
  onProceedToCheckout
}) => {
  const [showHeldList, setShowHeldList] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700 mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-indigo-600" /> Current Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
        </h2>
        <div className="flex items-center gap-2">
          {heldOrders.length > 0 && (
            <button
              onClick={() => setShowHeldList(!showHeldList)}
              className="text-xs px-2.5 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg font-semibold hover:bg-amber-200 transition"
            >
              Held ({heldOrders.length})
            </button>
          )}
          {cart.length > 0 && (
            <>
              <button
                onClick={onHoldOrder}
                className="p-1.5 text-amber-600 hover:text-amber-700 rounded-lg hover:bg-amber-50 transition"
                title="Hold Order"
              >
                <PauseCircle className="w-5 h-5" />
              </button>
              <button
                onClick={onClearCart}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Held Orders Dropdown List */}
      {showHeldList && heldOrders.length > 0 && (
        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Held Orders:</p>
          {heldOrders.map((h, idx) => (
            <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-lg text-xs">
              <span>Order #{idx + 1} ({h.cart.length} items) - ${h.total.toFixed(2)}</span>
              <button
                onClick={() => {
                  onResumeOrder(idx);
                  setShowHeldList(false);
                }}
                className="px-2.5 py-1 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 transition flex items-center gap-1"
              >
                <PlayCircle className="w-3.5 h-3.5" /> Resume
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 mb-3 max-h-[360px]">
        {cart.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Cart is empty. Select products to build sale.</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.product_id} className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0 mr-2">
                <p className="font-semibold text-xs truncate">{item.name}</p>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  ${item.price.toFixed(2)} {item.discount > 0 ? `(Disc: $${item.discount})` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                  className="p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                  className="p-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onRemoveItem(item.product_id)}
                  className="p-1 text-red-500 hover:text-red-700 ml-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary & Totals */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Subtotal</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">${subtotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Order Discount ($)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={e => onDiscountChange(e.target.value)}
            className="w-24 px-2 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-right text-xs"
          />
        </div>

        <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
          <span>Total Due</span>
          <span className="text-indigo-600 dark:text-indigo-400">${total.toFixed(2)}</span>
        </div>

        <button
          onClick={onProceedToCheckout}
          disabled={cart.length === 0}
          className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm"
        >
          Proceed to Payment (${total.toFixed(2)})
        </button>
      </div>
    </div>
  );
};

export default CartPanel;
