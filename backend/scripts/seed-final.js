// backend/scripts/seed-final.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// ====== DEFINE MODELS INLINE ======
const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'staff'], default: 'staff' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 0 },
  minStock: { type: Number, default: 5 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }
}, { timestamps: true });

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  address: { type: mongoose.Schema.Types.Mixed },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    price: Number,
    total: Number
  }],
  total: { type: Number, required: true },
  status: { type: String, default: 'pending' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }
}, { timestamps: true });

// Register models
const Tenant = mongoose.model('Tenant', tenantSchema);
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Customer = mongoose.model('Customer', customerSchema);
const Order = mongoose.model('Order', orderSchema);

// ====== CONNECTION WITH RETRY ======
const connectWithRetry = async (retries = 5, delay = 2000) => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spms';
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`📡 Attempt ${i + 1}/${retries} connecting to MongoDB...`);
      await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('✅ Connected to MongoDB successfully!');
      return true;
    } catch (error) {
      console.log(`❌ Connection attempt ${i + 1} failed: ${error.message}`);
      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error('Failed to connect to MongoDB after multiple retries');
};

// ====== SEED FUNCTION ======
const seedDatabase = async () => {
  try {
    // Connect with retry
    await connectWithRetry();

    // Clear existing data
    console.log('🗑️  Clearing old data...');
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Customer.deleteMany({}),
      Tenant.deleteMany({}),
      Order.deleteMany({})
    ]);
    console.log('✅ Data cleared');

    // Create Tenant
    console.log('🏢 Creating tenant...');
    const tenant = await Tenant.create({
      name: 'Demo Company',
      subdomain: 'demo',
      settings: { currency: 'USD' },
      isActive: true
    });
    console.log(`✅ Tenant created: ${tenant.name}`);

    // Create Admin User
    console.log('👤 Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      username: 'admin',
      email: 'admin@demo.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      tenantId: tenant._id,
      isActive: true
    });
    console.log(`✅ Admin created: admin / admin123`);

    // Create Manager
    const managerPassword = await bcrypt.hash('manager123', 10);
    const manager = await User.create({
      username: 'manager',
      email: 'manager@demo.com',
      password: managerPassword,
      firstName: 'Manager',
      lastName: 'User',
      role: 'manager',
      tenantId: tenant._id,
      isActive: true
    });
    console.log(`✅ Manager created: manager / manager123`);

    // Create Products
    console.log('📦 Creating products...');
    const products = await Product.create([
      {
        name: 'iPhone 15 Pro',
        sku: 'PHN-001',
        category: 'Electronics',
        price: 999,
        quantity: 25,
        minStock: 5,
        tenantId: tenant._id
      },
      {
        name: 'MacBook Pro 16"',
        sku: 'LPT-002',
        category: 'Electronics',
        price: 2499,
        quantity: 15,
        minStock: 3,
        tenantId: tenant._id
      },
      {
        name: 'Sony WH-1000XM5',
        sku: 'AUD-003',
        category: 'Audio',
        price: 349,
        quantity: 30,
        minStock: 10,
        tenantId: tenant._id
      },
      {
        name: 'Samsung Galaxy S24',
        sku: 'PHN-004',
        category: 'Electronics',
        price: 799,
        quantity: 20,
        minStock: 5,
        tenantId: tenant._id
      },
      {
        name: 'Dell XPS 15',
        sku: 'LPT-005',
        category: 'Electronics',
        price: 1899,
        quantity: 12,
        minStock: 3,
        tenantId: tenant._id
      },
      {
        name: 'Apple Watch Series 9',
        sku: 'WCH-006',
        category: 'Wearables',
        price: 399,
        quantity: 18,
        minStock: 5,
        tenantId: tenant._id
      }
    ]);
    console.log(`✅ ${products.length} products created`);

    // Create Customers
    console.log('👥 Creating customers...');
    const customers = await Customer.create([
      {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1-555-0101',
        address: { street: '123 Main St', city: 'New York', state: 'NY', zipCode: '10001' },
        tenantId: tenant._id
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+1-555-0102',
        address: { street: '456 Oak Ave', city: 'Los Angeles', state: 'CA', zipCode: '90001' },
        tenantId: tenant._id
      },
      {
        name: 'Bob Johnson',
        email: 'bob@example.com',
        phone: '+1-555-0103',
        address: { street: '789 Pine Rd', city: 'Chicago', state: 'IL', zipCode: '60601' },
        tenantId: tenant._id
      },
      {
        name: 'Alice Williams',
        email: 'alice@example.com',
        phone: '+1-555-0104',
        address: { street: '321 Elm St', city: 'Houston', state: 'TX', zipCode: '77001' },
        tenantId: tenant._id
      },
      {
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        phone: '+1-555-0105',
        address: { street: '654 Maple Dr', city: 'Phoenix', state: 'AZ', zipCode: '85001' },
        tenantId: tenant._id
      }
    ]);
    console.log(`✅ ${customers.length} customers created`);

    // Create Orders
    console.log('📦 Creating orders...');
    const orders = await Order.create([
      {
        orderNumber: 'ORD-000001',
        customer: customers[0]._id,
        items: [
          { product: products[0]._id, quantity: 2, price: 999, total: 1998 },
          { product: products[2]._id, quantity: 1, price: 349, total: 349 }
        ],
        total: 2347,
        status: 'delivered',
        tenantId: tenant._id
      },
      {
        orderNumber: 'ORD-000002',
        customer: customers[1]._id,
        items: [
          { product: products[1]._id, quantity: 1, price: 2499, total: 2499 }
        ],
        total: 2499,
        status: 'processing',
        tenantId: tenant._id
      },
      {
        orderNumber: 'ORD-000003',
        customer: customers[2]._id,
        items: [
          { product: products[3]._id, quantity: 1, price: 799, total: 799 },
          { product: products[5]._id, quantity: 2, price: 399, total: 798 }
        ],
        total: 1597,
        status: 'pending',
        tenantId: tenant._id
      },
      {
        orderNumber: 'ORD-000004',
        customer: customers[3]._id,
        items: [
          { product: products[4]._id, quantity: 1, price: 1899, total: 1899 }
        ],
        total: 1899,
        status: 'shipped',
        tenantId: tenant._id
      },
      {
        orderNumber: 'ORD-000005',
        customer: customers[4]._id,
        items: [
          { product: products[0]._id, quantity: 1, price: 999, total: 999 }
        ],
        total: 999,
        status: 'cancelled',
        tenantId: tenant._id
      }
    ]);
    console.log(`✅ ${orders.length} orders created`);

    // Summary
    console.log('\n🎉 ====== SEED COMPLETE ======');
    console.log(`🏢 Tenant: ${tenant.name}`);
    console.log(`👤 Admin: admin / admin123`);
    console.log(`👤 Manager: manager / manager123`);
    console.log(`📦 Products: ${products.length}`);
    console.log(`👥 Customers: ${customers.length}`);
    console.log(`📦 Orders: ${orders.length}`);
    console.log('===============================\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ SEED ERROR:', error.message);
    console.error('\n💡 TROUBLESHOOTING TIPS:');
    console.error('1. Make sure MongoDB is running (Status: Running ✅)');
    console.error('2. Check if models are defined correctly');
    console.error('3. Verify MongoDB connection string in .env');
    process.exit(1);
  }
};

seedDatabase();