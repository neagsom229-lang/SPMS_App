// backend/src/constants/sales.js
const REVENUE_STATUSES = ['Completed'];
const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Ready'];
const EXCLUDED_STATUSES = ['Cancelled', 'Refunded', 'Voided', 'Pending'];

module.exports = {
  REVENUE_STATUSES,
  ACTIVE_STATUSES,
  EXCLUDED_STATUSES,
};
