// Shared React Query keys. Pages and invalidation sites must use the same
// arrays, otherwise a mutation refreshes one component while another keeps
// serving a stale copy and issues its own duplicate request.
export const queryKeys = {
  products: ['products'],
  productsSearch: (search) => ['products', search],
  stock: ['stock'],
  orders: ['orders'],
  onlineOrdersCount: ['online-orders-count'],
  dashboardStats: ['dashboardStats'],
  dashboardAnalytics: (from, to) => ['dashboardAnalytics', from, to],
  dashboardSalesMix: (from, to) => ['dashboardSalesMix', from, to],
  salesSummary: (range) => ['dashboard', 'sales-summary', range],
};

export default queryKeys;
