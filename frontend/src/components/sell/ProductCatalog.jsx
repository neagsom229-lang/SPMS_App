// frontend/src/components/sell/ProductCatalog.jsx
import React, { useState, useMemo, useRef } from 'react';
import { Search, Plus, Package, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProductCatalog = ({ products, cart, onAddToCart }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const barcodeInputRef = useRef(null);
  const navigate = useNavigate();

  // Compute remaining stock per product (stock minus quantity in cart)
  const cartQtyMap = useMemo(() => {
    const map = {};
    cart.forEach(item => {
      map[item.product_id] = (map[item.product_id] || 0) + item.quantity;
    });
    return map;
  }, [cart]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(['All']);
    products.forEach(p => {
      const cat = p.category || p.category_en || p.CATEGORY || p.brand || p.BRAND;
      if (cat) set.add(cat);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products (Active items with stock)
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const status = p.status || p.STATUS || 'Active';
      if (status.toLowerCase() !== 'active') return false;

      const name = p.name || p.name_en || p.NAME_EN || '';
      const barcode = p.barcode || p.BARCODE || '';
      const cat = p.category || p.category_en || p.CATEGORY || p.brand || p.BRAND || '';

      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            barcode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'All' || cat === selectedCategory;

      const stock = Number(p.stock ?? p.qtyinstock ?? p.qtyavailable ?? 0);
      const inCart = cartQtyMap[p.id] || 0;
      const remaining = stock - inCart;

      return matchesSearch && matchesCat && remaining > 0;
    });
  }, [products, searchQuery, selectedCategory, cartQtyMap]);

  // Barcode / Search form submit (Enter adds product if exact barcode match)
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim().toLowerCase();
    const found = products.find(p => {
      const b = String(p.barcode || p.BARCODE || '').toLowerCase();
      const id = String(p.id || p.PRODUCT_ID || '');
      return b === query || id === query;
    });

    if (found) {
      const stock = Number(found.stock ?? found.qtyinstock ?? found.qtyavailable ?? 0);
      const inCart = cartQtyMap[found.id] || 0;
      if (stock - inCart > 0) {
        onAddToCart(found);
        setSearchQuery('');
      } else {
        alert('Product out of stock');
      }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Barcode & Search Input */}
      <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
          <input
            ref={barcodeInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Scan barcode or search products..."
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow transition flex items-center gap-2"
        >
          <QrCode className="w-5 h-5" /> Add
        </button>
      </form>

      {/* Category Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-lg font-medium text-xs whitespace-nowrap transition ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center">
          <Package className="w-16 h-16 text-gray-400 mb-3" />
          <p className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">No active products with stock found</p>
          <button
            onClick={() => navigate('/products/new')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition"
          >
            Add Products
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto max-h-[560px] pr-1">
          {filteredProducts.map(p => {
            const id = p.id || p.PRODUCT_ID;
            const name = p.name || p.name_en || p.NAME_EN || 'Product';
            const nameKh = p.name_kh || p.NAME_KH || '';
            const price = Number(p.price || p.saleout_price || p.SALEOUT_PRICE || 0);
            const stock = Number(p.stock ?? p.qtyinstock ?? p.qtyavailable ?? 0);
            const inCart = cartQtyMap[id] || 0;
            const remaining = stock - inCart;

            return (
              <div
                key={id}
                onClick={() => onAddToCart(p)}
                className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer shadow-sm hover:shadow transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full font-mono text-gray-600 dark:text-gray-300">
                      {p.barcode || p.BARCODE || `#${id}`}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full font-semibold">
                      Stock: {remaining}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 group-hover:text-indigo-600 transition-colors">
                    {name}
                  </h3>
                  {nameKh && <p className="text-[11px] text-gray-400 line-clamp-1">{nameKh}</p>}
                </div>
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">${price.toFixed(2)}</span>
                  <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductCatalog;
