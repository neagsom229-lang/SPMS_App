// backend/middleware/tenant.js
const { db } = require('../config/database');

// Get tenant from subdomain
const getTenantFromSubdomain = async (subdomain) => {
    const result = await db.query(
        'SELECT id, name, subdomain, settings FROM tenants WHERE subdomain = $1 AND status = $2',
        [subdomain, 'active']
    );
    return result.rows[0];
};

// Middleware to set tenant context
const tenantMiddleware = async (req, res, next) => {
    try {
        // Get subdomain from host
        const host = req.get('host');
        let subdomain = req.headers['x-tenant-id']; // For API calls
        
        if (!subdomain && host) {
            // Extract subdomain from URL (e.g., client1.yourdomain.com)
            const parts = host.split('.');
            if (parts.length > 2) {
                subdomain = parts[0];
            }
        }
        
        if (!subdomain) {
            return res.status(400).json({ error: 'Tenant identifier required' });
        }
        
        // Get tenant
        const tenant = await getTenantFromSubdomain(subdomain);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        
        // Attach tenant to request
        req.tenant = tenant;
        req.tenantId = tenant.id;
        
        next();
    } catch (error) {
        console.error('Tenant middleware error:', error);
        res.status(500).json({ error: 'Tenant resolution failed' });
    }
};

// Middleware to filter queries by tenant
const withTenant = (query, params = []) => {
    return {
        query: query.replace(/WHERE/g, 'WHERE tenant_id = $1 AND '),
        params: params
    };
};

module.exports = { tenantMiddleware, withTenant, getTenantFromSubdomain };