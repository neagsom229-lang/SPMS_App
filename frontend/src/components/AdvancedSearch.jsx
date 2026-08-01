// frontend/src/components/AdvancedSearch.jsx
import React, { useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline';

const AdvancedSearch = ({ onSearch, placeholder, fields, initialFilters = {} }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = () => {
    onSearch({ search: searchTerm, ...filters });
  };

  const handleClear = () => {
    setSearchTerm('');
    setFilters({});
    onSearch({});
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder={placeholder || 'Search...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          {searchTerm && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Search
        </button>
        {fields && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 ${
              showFilters ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300' : ''
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {showFilters && fields && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select
                  value={filters[field.name] || ''}
                  onChange={(e) => setFilters({...filters, [field.name]: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">All</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === 'range' ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters[`${field.name}_min`] || ''}
                    onChange={(e) => setFilters({...filters, [`${field.name}_min`]: e.target.value})}
                    className="w-1/2 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters[`${field.name}_max`] || ''}
                    onChange={(e) => setFilters({...filters, [`${field.name}_max`]: e.target.value})}
                    className="w-1/2 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              ) : field.type === 'checkbox' ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters[field.name] || false}
                    onChange={(e) => setFilters({...filters, [field.name]: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{field.label}</span>
                </label>
              ) : (
                <input
                  type="text"
                  placeholder={field.placeholder || ''}
                  value={filters[field.name] || ''}
                  onChange={(e) => setFilters({...filters, [field.name]: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              )}
            </div>
          ))}
          <div className="flex items-end">
            <button
              onClick={() => setFilters({})}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;