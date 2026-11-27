// Single source for the local demo storefront slug. The seeded tenant's
// subdomain is `demo` (backend/scripts/seed-demo.js), and store_settings uses
// the same value. Logged-in links prefer the tenant's own subdomain; this is
// only the fallback for public pages that have no tenant context.
export const DEFAULT_STORE_SLUG = import.meta.env.VITE_DEFAULT_STORE_SLUG || 'demo';
