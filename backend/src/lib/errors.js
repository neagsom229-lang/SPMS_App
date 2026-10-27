// backend/src/lib/errors.js
class BusinessError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = 'BusinessError';
    this.status = status;
  }
}

module.exports = {
  BusinessError,
};
