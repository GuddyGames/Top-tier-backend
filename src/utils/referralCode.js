const crypto = require('crypto');

// Short, URL-safe, human-shareable code — e.g. "GUDDIE7F2A".
// Collisions are astronomically unlikely at this length, but User.create
// callers should still catch a unique-violation and retry if paranoid.
function generateReferralCode(username) {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
  const base = (username || 'USER').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
  return `${base}${suffix}`;
}

module.exports = { generateReferralCode };
