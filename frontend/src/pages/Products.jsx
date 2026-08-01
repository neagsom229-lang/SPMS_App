// frontend/src/pages/Products.jsx
import { useQuery } from '@tanstack/react-query';
import { productApi } from '../api/products';
import { useState } from 'react';
import { productApi } from '../api/products';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import AdvancedSearch from '../components/AdvancedSearch';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import SkeletonLoader from '../components/SkeletonLoader';


const Products = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', page, limit],
    queryFn: () => productApi.getAll(page, limit),
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: productApi.getAll,
  });

  if (isLoading) return <SkeletonLoader type="table" />;

  const products = data?.data || [];
  const total = data?.pagination?.total || 0;
  const totalPages = data?.pagination?.totalPages || 1;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      {/* Products table/content */}
      
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        itemsPerPage={limit}
        onPageChange={setPage}
        loading={isLoading}
      />
    </div>
  );
};


const { data: products, isLoading } = useQuery({
  queryKey: ['products'],
  queryFn: productApi.getAll,
});
// frontend/src/pages/Products.jsx
const [filters, setFilters] = useState({
  search: '',
  category: '',
  minPrice: '',
  maxPrice: '',
  inStock: false,
});

// frontend/src/pages/Products.jsx - Add these features

const [selectedIds, setSelectedIds] = useState([]);
const [selectAll, setSelectAll] = useState(false);

// Toggle all selection
const handleSelectAll = () => {
  if (selectAll) {
    setSelectedIds([]);
  } else {
    setSelectedIds(products.map(p => p.id));
  }
  setSelectAll(!selectAll);
};

// Bulk delete
const handleBulkDelete = async () => {
  if (!confirm(`Delete ${selectedIds.length} products?`)) return;
  
  try {
    await api.delete('/products/bulk', { data: { ids: selectedIds } });
    toast.success(`${selectedIds.length} products deleted`);
    setSelectedIds([]);
    setSelectAll(false);
    refetch();
  } catch (error) {
    toast.error('Failed to delete products');
  }
};

// Bulk update stock
const handleBulkUpdateStock = async () => {
  const quantity = prompt('Enter quantity to add to selected products:');
  if (quantity === null) return;
  
  try {
    await api.patch('/products/bulk-stock', { 
      ids: selectedIds, 
      quantity: parseInt(quantity) 
    });
    toast.success(`Stock updated for ${selectedIds.length} products`);
    setSelectedIds([]);
    setSelectAll(false);
    refetch();
  } catch (error) {
    toast.error('Failed to update stock');
  }
};

// Bulk export
const handleBulkExport = () => {
  window.location.href = `${API_URL}/products/export?ids=${selectedIds.join(',')}`;
};

// Bulk action bar
{selectedIds.length > 0 && (
  <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
    <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-lg p-4 flex items-center gap-4 border border-gray-200 dark:border-gray-700">
      <span className="font-medium">{selectedIds.length} selected</span>
      <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
      <button 
        onClick={handleBulkUpdateStock}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Update Stock
      </button>
      <button 
        onClick={handleBulkExport}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        Export
      </button>
      <button 
        onClick={handleBulkDelete}
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
      >
        Delete
      </button>
      <button 
        onClick={() => {
          setSelectedIds([]);
          setSelectAll(false);
        }}
        className="px-4 py-2 text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </div>
  </div>
)}

const SearchBar = () => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    <input
      type="text"
      placeholder="Search products..."
      value={filters.search}
      onChange={(e) => setFilters({...filters, search: e.target.value})}
      className="border rounded-lg px-4 py-2"
    />
    
    <select
      value={filters.category}
      onChange={(e) => setFilters({...filters, category: e.target.value})}
      className="border rounded-lg px-4 py-2"
    >
      <option value="">All Categories</option>
      <option value="Electronics">Electronics</option>
      <option value="Audio">Audio</option>
      <option value="Wearables">Wearables</option>
    </select>
    
    <div className="flex gap-2">
      <input
        type="number"
        placeholder="Min Price"
        value={filters.minPrice}
        onChange={(e) => setFilters({...filters, minPrice: e.target.value})}
        className="border rounded-lg px-4 py-2 w-1/2"
      />
      <input
        type="number"
        placeholder="Max Price"
        value={filters.maxPrice}
        onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
        className="border rounded-lg px-4 py-2 w-1/2"
      />
    </div>
    
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={filters.inStock}
          onChange={(e) => setFilters({...filters, inStock: e.target.checked})}
        />
        In Stock Only
      </label>
      <button
        onClick={() => setFilters({search: '', category: '', minPrice: '', maxPrice: '', inStock: false})}
        className="text-gray-500 hover:text-gray-700"
      >
        Clear
      </button>
    </div>
  </div>
);
// frontend/src/pages/Products.jsx
const [selectedIds, setSelectedIds] = useState([]);

const handleBulkDelete = async () => {
  if (!confirm(`Delete ${selectedIds.length} products?`)) return;
  
  try {
    await api.delete('/products/bulk', { data: { ids: selectedIds } });
    toast.success(`${selectedIds.length} products deleted`);
    setSelectedIds([]);
    refetch();
  } catch (error) {
    toast.error('Failed to delete products');
  }
};

// Add checkbox to each row
<input
  type="checkbox"
  checked={selectedIds.includes(product.id)}
  onChange={() => {
    if (selectedIds.includes(product.id)) {
      setSelectedIds(selectedIds.filter(id => id !== product.id));
    } else {
      setSelectedIds([...selectedIds, product.id]);
    }
  }}
/>

// Add bulk action bar
{selectedIds.length > 0 && (
  <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg p-4 flex items-center gap-4">
    <span>{selectedIds.length} selected</span>
    <button onClick={handleBulkDelete} className="bg-red-500 text-white px-4 py-2 rounded">
      Delete Selected
    </button>
    <button onClick={() => setSelectedIds([])} className="text-gray-500">
      Cancel
    </button>
  </div>
)}
const [filters, setFilters] = useState({});

const searchFields = [
  { name: 'category', label: 'Category', type: 'select', options: ['Electronics', 'Audio', 'Wearables'] },
  { name: 'price', label: 'Price Range', type: 'range' },
  { name: 'inStock', label: 'In Stock Only', type: 'checkbox' },
];

const handleSearch = (searchParams) => {
  setFilters(searchParams);
  setPage(1);
  refetch();
};

// In the JSX:
<AdvancedSearch
  onSearch={handleSearch}
  placeholder="Search products by name, SKU, or brand..."
  fields={searchFields}
  initialFilters={filters}
/>

// Update useQuery to include filters
const { data, isLoading } = useQuery({
  queryKey: ['products', page, limit, filters],
  queryFn: () => productApi.getAll(page, limit, filters),
});

const Products = () => {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => productApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      toast.success(`${selectedIds.length} products deleted`);
      setSelectedIds([]);
      setSelectAll(false);
    },
    onError: () => {
      toast.error('Failed to delete products');
    },
  });

  // Bulk update stock mutation
  const bulkStockMutation = useMutation({
    mutationFn: ({ ids, quantity }) => productApi.bulkUpdateStock(ids, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      toast.success('Stock updated successfully');
      setSelectedIds([]);
      setSelectAll(false);
    },
    onError: () => {
      toast.error('Failed to update stock');
    },
  });

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
    }
    setSelectAll(!selectAll);
  };

  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selectedIds.length} products?`)) return;
    bulkDeleteMutation.mutate(selectedIds);
  };

  const handleBulkUpdateStock = () => {
    const quantity = prompt('Enter quantity to add:');
    if (quantity === null || isNaN(quantity)) return;
    bulkStockMutation.mutate({ 
      ids: selectedIds, 
      quantity: parseInt(quantity) 
    });
  };

  const handleBulkExport = () => {
    window.location.href = `${API_URL}/products/export?ids=${selectedIds.join(',')}`;
  };

  // Add checkbox to columns
  const columns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={selectAll}
          onChange={handleSelectAll}
          className="rounded border-gray-300"
        />
      ),
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => {
            if (selectedIds.includes(row.id)) {
              setSelectedIds(selectedIds.filter(id => id !== row.id));
            } else {
              setSelectedIds([...selectedIds, row.id]);
            }
          }}
          className="rounded border-gray-300"
        />
      ),
    },
    // ... other columns
  ];

  return (
    <div>
      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-lg p-4 flex items-center gap-4 border border-gray-200 dark:border-gray-700">
            <span className="font-medium text-gray-900 dark:text-white">
              {selectedIds.length} selected
            </span>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
            <button 
              onClick={handleBulkUpdateStock}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              Update Stock
            </button>
            <button 
              onClick={handleBulkExport}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
            >
              Export
            </button>
            <button 
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
            >
              Delete
            </button>
            <button 
              onClick={() => {
                setSelectedIds([]);
                setSelectAll(false);
              }}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
