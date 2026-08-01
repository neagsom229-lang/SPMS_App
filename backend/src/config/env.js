// backend/src/config/env.js
const requiredEnv = [
  'DATABASE_URL',
  'JWT_SECRET',
  // 'STRIPE_SECRET_KEY', // ← Comment this out if not using Stripe
];

const optionalEnv = [
  'PORT',
  'NODE_ENV',
  'FRONTEND_URL',
  'STRIPE_SECRET_KEY', // ← Move here
  'STRIPE_PUBLISHABLE_KEY',
  'SMTP_USER',
  'SMTP_PASS',
];

const checkEnv = () => {
  const missing = requiredEnv.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease add these to your .env file');
    process.exit(1);
  }

  console.log('✅ All required environment variables are set');

  // Check optional variables
  const optional = optionalEnv.filter(key => !process.env[key]);
  if (optional.length > 0) {
    console.log('⚠️ Optional environment variables missing:');
    optional.forEach(key => console.log(`   - ${key} (using default or skipping)`));
  }
};

module.exports = { checkEnv };