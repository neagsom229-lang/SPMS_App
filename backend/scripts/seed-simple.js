// backend/scripts/seed-simple.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Simple seed
const seedSimple = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/spms');
    console.log('Connected to MongoDB');

    // Your models here
    const User = mongoose.model('User', new mongoose.Schema({
      username: String,
      email: String,
      password: String,
      firstName: String,
      lastName: String,
      role: String,
      tenantId: mongoose.Schema.Types.ObjectId
    }));

    const Tenant = mongoose.model('Tenant', new mongoose.Schema({
      name: String,
      subdomain: String,
      settings: mongoose.Schema.Types.Mixed
    }));

    // Create tenant
    const tenant = await Tenant.create({
      name: 'Demo Company',
      subdomain: 'demo',
      settings: { currency: 'USD' }
    });

    // Create admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      username: 'admin',
      email: 'admin@demo.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      tenantId: tenant._id
    });

    console.log('✅ Seed complete!');
    console.log('👤 Admin: admin / admin123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedSimple();