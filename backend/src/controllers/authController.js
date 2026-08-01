// backend/src/controllers/authController.js
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Tenant } from '../models/Tenant.js';

export const authController = {
  // Login
  login: async (req, res) => {
    try {
      const { username, password } = req.body;

      // Find user
      const user = await User.findOne({
        $or: [{ username }, { email: username }]
      }).populate('tenantId');

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if active
      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is disabled' });
      }

      // Check tenant
      if (!user.tenantId || !user.tenantId.isActive) {
        return res.status(403).json({ error: 'Tenant is inactive' });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = jwt.sign(
        {
          userId: user._id,
          role: user.role,
          tenantId: user.tenantId._id
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      // Log activity
      await ActivityLog.create({
        user: user._id,
        action: 'login',
        entity: 'User',
        entityId: user._id,
        details: 'User logged in successfully',
        tenantId: user.tenantId._id,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.role,
          permissions: user.permissions,
          tenant: {
            id: user.tenantId._id,
            name: user.tenantId.name,
            subdomain: user.tenantId.subdomain
          },
          preferences: user.preferences
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  },

  // Get current user
  getMe: async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
        .select('-password')
        .populate('tenantId');

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Logout
  logout: async (req, res) => {
    try {
      await ActivityLog.create({
        user: req.user._id,
        action: 'logout',
        entity: 'User',
        entityId: req.user._id,
        details: 'User logged out',
        tenantId: req.user.tenantId
      });

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },


  
  // Change password
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user._id);
      const isMatch = await user.comparePassword(currentPassword);

      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      user.password = newPassword;
      await user.save();

      await ActivityLog.create({
        user: req.user._id,
        action: 'update',
        entity: 'User',
        entityId: req.user._id,
        details: 'Password changed',
        tenantId: req.user.tenantId
      });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
// backend/src/controllers/authController.js
const refreshToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const newToken = jwt.sign(
      { userId: decoded.userId, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};