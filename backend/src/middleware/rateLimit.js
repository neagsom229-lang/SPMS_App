// backend/src/middleware/rateLimit.js
const rateLimit = require("express-rate-limit");

const skipPreflight = (req) => req.method === "OPTIONS";

// General API limiter. Generous on purpose: a whole shop shares one IP address.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  message: {
    error: "Too many requests, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
});

// Login limiter. Counts FAILED logins only, so normal use never trips it.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: {
    error: "Too many failed login attempts, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
});

// Registration limiter. Counts every attempt to stop tenant spam.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    error: "Too many sign-ups from this address, please try again later.",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
});

// Heavy endpoints (reports, analytics, exports)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    error: "Rate limit exceeded for this endpoint.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
});

module.exports = {
  generalLimiter,
  authLimiter,
  registerLimiter,
  apiLimiter,
};