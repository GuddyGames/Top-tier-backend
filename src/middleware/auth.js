const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Protects a route: requires "Authorization: Bearer <token>".
// The token proves identity, while the database is checked for the current
// account status/role so suspension or role changes take effect immediately.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query(
      'SELECT id, username, role, status FROM users WHERE id = $1',
      [payload.id]
    );
    const user = rows[0];

    if (!user) return res.status(401).json({ error: 'Account not found' });
    if (user.status !== 'active') return res.status(403).json({ error: 'Account is inactive' });

    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Use after requireAuth. The role is read from the current database record,
// not trusted solely from a long-lived JWT claim.
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
