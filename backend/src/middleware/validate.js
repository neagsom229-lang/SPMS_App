// backend/src/middleware/validate.js
const { body, validationResult } = require('express-validator');

/**
 * Middleware to validate request data
 *
 * FIX: previously this did `validations.map(...)` with no guard. If a
 * caller ever passes `undefined` (e.g. a validation set missing an
 * `update` key), `.map` throws inside an async function, which becomes
 * an *unhandled promise rejection* rather than an HTTP error response —
 * Express never sends a response, so the request just hangs until the
 * client's own timeout fires. Two changes fix this permanently:
 *   1. Guard against non-array input up front with a clear 500 message
 *      instead of a silent crash.
 *   2. Wrap the whole body in try/catch and forward to next(err) so
 *      Express's error handler always gets a chance to respond.
 */
const validate = (validations) => {
  return async (req, res, next) => {
    if (!Array.isArray(validations)) {
      console.error(
        '❌ validate() called with a non-array validation set:',
        validations
      );
      return res.status(500).json({
        error: 'Server misconfiguration: missing validation rules for this route',
      });
    }

    try {
      await Promise.all(validations.map((validation) => validation.run(req)));

      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }

      res.status(400).json({
        errors: errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
        })),
      });
    } catch (err) {
      // Never let a validation-time error become a silent hang.
      next(err);
    }
  };
};

// ============================================
// PRODUCT VALIDATIONS
// ============================================
const productValidations = {
  create: [
    body('NAME_EN').notEmpty().withMessage('Product English name is required'),
    body('NAME_EN').isLength({ max: 100 }).withMessage('Product name too long (max 100 characters)'),
    body('NAME_KH').notEmpty().withMessage('Product Khmer name is required'),
    body('SALEOUT_PRICE').isNumeric().withMessage('Price must be a number'),
    body('SALEOUT_PRICE').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('QTY_ALERT').optional().isNumeric().withMessage('Alert quantity must be a number'),
    body('QTY_ALERT').optional().isInt({ min: 0 }).withMessage('Alert quantity must be positive'),
    body('BUYIN_PRICE').optional().isNumeric().withMessage('Buy-in price must be a number'),
    body('BUYIN_PRICE').optional().isFloat({ min: 0 }).withMessage('Buy-in price must be positive'),
  ],
  update: [
    body('NAME_EN').optional().notEmpty().withMessage('Product English name cannot be empty'),
    body('NAME_EN').optional().isLength({ max: 100 }).withMessage('Product name too long'),
    body('SALEOUT_PRICE').optional().isNumeric().withMessage('Price must be a number'),
    body('SALEOUT_PRICE').optional().isFloat({ min: 0 }).withMessage('Price must be positive'),
  ],
};

// ============================================
// CUSTOMER VALIDATIONS
// ============================================
const customerValidations = {
  create: [
    body('FIRST_NAME').notEmpty().withMessage('First name is required'),
    body('FIRST_NAME').isLength({ max: 50 }).withMessage('First name too long'),
    body('LAST_NAME').notEmpty().withMessage('Last name is required'),
    body('LAST_NAME').isLength({ max: 50 }).withMessage('Last name too long'),
    body('E_MAIL').optional().isEmail().withMessage('Invalid email format'),
    body('PHONE').optional().isString().withMessage('Phone must be a string'),
    body('PHONE').optional().isLength({ max: 20 }).withMessage('Phone too long'),
  ],
  update: [
    body('FIRST_NAME').optional().notEmpty().withMessage('First name cannot be empty'),
    body('LAST_NAME').optional().notEmpty().withMessage('Last name cannot be empty'),
    body('E_MAIL').optional().isEmail().withMessage('Invalid email format'),
  ],
};

// ============================================
// ORDER VALIDATIONS
// ============================================
const orderValidations = {
  create: [
    body('CUSTOMER_ID').notEmpty().withMessage('Customer is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.product_id').notEmpty().withMessage('Product ID is required'),
    body('items.*.qty').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Unit price must be positive'),
  ],
};

// ============================================
// USER VALIDATIONS
// ============================================
const userValidations = {
  create: [
    body('username').notEmpty().withMessage('Username is required'),
    body('username').isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('password').notEmpty().withMessage('Password is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullname').optional().isString().withMessage('Full name must be a string'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
  ],
  update: [
    body('username').optional().notEmpty().withMessage('Username cannot be empty'),
    body('username').optional().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
  ],
};

// ============================================
// SUPPLIER VALIDATIONS
// ============================================
// FIX: `update` was missing entirely. app.js's
// `PUT /api/suppliers/:id` route calls
// `validate(supplierValidations.update)`, which was `undefined` —
// that's what caused the "Cannot read properties of undefined
// (reading 'map')" unhandled rejection and the 30s frontend timeout.
const supplierValidations = {
  create: [
    body('SUP_NAME').notEmpty().withMessage('Supplier name is required'),
    body('SUP_NAME').isLength({ max: 100 }).withMessage('Supplier name too long'),
    body('PHONE').optional().isString().withMessage('Phone must be a string'),
    body('EMAIL').optional().isEmail().withMessage('Invalid email format'),
  ],
  update: [
    body('SUP_NAME').optional().notEmpty().withMessage('Supplier name cannot be empty'),
    body('SUP_NAME').optional().isLength({ max: 100 }).withMessage('Supplier name too long'),
    body('PHONE').optional().isString().withMessage('Phone must be a string'),
    body('EMAIL').optional().isEmail().withMessage('Invalid email format'),
  ],
};

// ============================================
// REGISTER VALIDATION
// ============================================
const registerValidations = [
  body('username').notEmpty().withMessage('Username is required'),
  body('username').isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('companyName').notEmpty().withMessage('Company name is required'),
];

module.exports = {
  validate,
  productValidations,
  customerValidations,
  orderValidations,
  userValidations,
  supplierValidations,
  registerValidations,
};