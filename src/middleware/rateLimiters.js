const rateLimit = require('express-rate-limit');

// Signup/login protection: 20 attempts per 15 minutes per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — try again in a few minutes' },
});

// Market analysis calls consume the shared Twelve Data quota. Authenticate
// first, then limit each Top-tier account to 10 analyses per minute.
const parallaxAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => String(req.user.id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Parallax analysis limit reached. Please wait a minute and try again.' },
});

module.exports = { authLimiter, parallaxAnalysisLimiter };
