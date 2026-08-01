// backend/src/models/Product.js
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  barcode: String,
  category: {
    type: String,
    required: true,
    enum: ['electronics', 'furniture', 'clothing', 'food', 'beauty', 'other']
  },
  subcategory: String,
  description: String,
  price: {
    type: Number,
    required: true,
    min: 0
  },
  costPrice: {
    type: Number,
    min: 0
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  minStock: {
    type: Number,
    default: 5,
    min: 0
  },
  maxStock: {
    type: Number
  },
  unit: {
    type: String,
    default: 'pcs'
  },
  weight: Number,
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  images: [String],
  mainImage: String,
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  tags: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for search
productSchema.index({ name: 'text', description: 'text', sku: 'text' });
productSchema.index({ category: 1, tenantId: 1 });

// Virtual: Check if low stock
productSchema.virtual('isLowStock').get(function() {
  return this.quantity <= this.minStock;
});

export const Product = mongoose.model('Product', productSchema);