// backend/src/models/Tenant.js
import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  subdomain: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  logo: String,
  primaryColor: {
    type: String,
    default: '#3b82f6'
  },
  settings: {
    currency: {
      type: String,
      default: 'USD'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY'
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    autoApproveOrders: {
      type: Boolean,
      default: false
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['starter', 'pro', 'enterprise', 'trial'],
      default: 'trial'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'trial', 'expired'],
      default: 'trial'
    },
    trialEnds: Date,
    expiresAt: Date,
    maxUsers: {
      type: Number,
      default: 5
    },
    maxOrders: {
      type: Number,
      default: 100
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export const Tenant = mongoose.model('Tenant', tenantSchema);