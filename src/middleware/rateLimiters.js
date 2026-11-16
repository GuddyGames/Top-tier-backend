const rateLimit = require('express-rate-limit');

// Signup/login are the endpoints worth protecting most — without this,
// nothing stops repeated password guesses against one account or a
// script spamming fake signups. 20 attempts per 15 minutes per IP is
// generous for a real user, tight for a script.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — try again in a few minutes' },
});

module.exports = { authLimiter };
