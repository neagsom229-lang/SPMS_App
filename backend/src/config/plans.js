// backend/src/config/plans.js
// Canonical plan values are lowercase: 'market-stall', 'shophouse', 'chain'
// (free needs no price row). create-qr lowercases the request plan before this
// lookup, so only lowercase keys exist — no uppercase duplicates.
module.exports = {
  'market-stall': {
    1: { USD: 0.00 }
  },
  'shophouse': {
    1: { USD: 19.00 }
  },
  'chain': {
    1: { USD: 49.00 }
  }
};
