// backend/src/config/env.js
const isProd = process.env.NODE_ENV === 'production';
const requiredEnv = [
  'DATABASE_URL',
  'JWT_SECRET',
  ...(isProd ? ['CORS_ORIGINS'] : [])
];

const optionalEnv = [
  'PORT',
  'NODE_ENV',
  'FRONTEND_URL',
  'CORS_ORIGINS',
  'STRIPE_SECRET_KEY',
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

  const optional = optionalEnv.filter(key => !process.env[key]);
  if (optional.length > 0) {
    console.log('⚠️ Optional environment variables missing:');
    optional.forEach(key => console.log(`   - ${key} (using default or skipping)`));
  }
};

module.exports = { checkEnv };
