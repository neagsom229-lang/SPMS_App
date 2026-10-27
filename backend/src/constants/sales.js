// backend/src/constants/sales.js
// Revenue calculation rule: Only Completed or Paid orders count as revenue.
// Pending, Confirmed, Preparing are open/active orders.
// Cancelled and Refunded are excluded from revenue.

const REVENUE_STATUSES = ['Completed', 'Paid', 'Delivered'];
const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Ready'];
const EXCLUDED_STATUSES = ['Cancelled', 'Refunded'];

module.exports = {
  REVENUE_STATUSES,
  ACTIVE_STATUSES,
  EXCLUDED_STATUSES,
};
