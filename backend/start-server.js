process.env.DATABASE_URL = 'postgresql://postgres.kimpbipjxnoeyvaabrqr:761SiW4njgzrV0GV@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
process.env.JWT_SECRET = 'jRflxozOaeNhkisie4f+C6++Dh1vbU0I5BL64DwZT2Iv91olaFvMOsudtFf/Rt5q/buSfojljNv1q8VdyK6tiw==';
process.env.PORT = '5000';
process.env.NODE_ENV = 'development';

require('./src/app.js');
