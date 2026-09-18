// Wrap async route handlers with this so a rejected promise (e.g. a
// failed DB query) is forwarded to errorHandler.js instead of hanging
// the request or crashing the process.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
