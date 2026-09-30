// backend/scripts/seed-postgres.js
const pool = require('../src/config/postgres');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
  try {
    console.log('🌱 Seeding PostgreSQL database...');

    // 1. Create default tenant
    const tenantRes = await pool.query(
      `INSERT INTO tenants (name, subdomain, status) 
       VALUES ('Default Tenant', 'default', 'ACTIVE')
       ON CONFLICT (subdomain) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const tenantId = tenantRes.rows[0].id;
    console.log('✅ Tenant seeded, ID:', tenantId);

    // 2. Create Super Admin user
    const adminPassword = process.env.ADMIN_SECRET || 'SuperAdminPassword123!';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await pool.query(
      `INSERT INTO tbl_users (username, email, password, role, is_super_admin, tenant_id, status)
       VALUES ('superadmin', 'super@admin.com', $1, 'Super Admin', TRUE, NULL, 'ACTIVE')
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password`,
      [hashedPassword]
    );
    console.log('✅ Super Admin seeded successfully');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

seed();
