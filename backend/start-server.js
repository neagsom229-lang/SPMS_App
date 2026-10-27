process.env.DATABASE_URL = 'postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
process.env.JWT_SECRET = '<placeholder-jwt-secret>';
process.env.PORT = '5000';
process.env.NODE_ENV = 'development';

require('./src/app.js');
