const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/authRoutes');
const activityRoutes = require('./routes/activityRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const referralRoutes = require('./routes/referralRoutes');
const taskRoutes = require('./routes/taskRoutes');
const profileRoutes = require('./routes/profileRoutes');
const demoRoutes = require('./routes/demoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
const supportRoutes = require('./routes/supportRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());

// Keep CORS deployment-friendly: exact origins remain the secure default, while
// aliases and an optional regex allow Blue/Green Vercel deployments without code changes.
const configuredOrigins = [
  process.env.ALLOWED_ORIGINS || '',
  process.env.FRONTEND_URLS || '',
  process.env.FRONTEND_URL || '',
  process.env.CORS_ALLOWED_ORIGINS || '',
]
  .flatMap((value) => String(value).split(','))
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = [...new Set(configuredOrigins)];
let allowedOriginRegex = null;
if (process.env.ALLOWED_ORIGIN_REGEX) {
  try {
    allowedOriginRegex = new RegExp(process.env.ALLOWED_ORIGIN_REGEX);
  } catch (error) {
    console.error('[app] Invalid ALLOWED_ORIGIN_REGEX; ignoring it:', error.message);
  }
}

if (allowedOrigins.length === 0 && !allowedOriginRegex && process.env.NODE_ENV === 'production') {
  console.warn('[app] No production CORS origin configured — cross-origin requests will be blocked.');
}

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser/server-to-server requests normally have no Origin header.
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/$/, '');
      const allowed = allowedOrigins.includes(normalizedOrigin)
        || (allowedOriginRegex && allowedOriginRegex.test(normalizedOrigin));

      if (allowed) return callback(null, true);
      return callback(new Error('CORS origin not allowed'));
    },
  })
);
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/support', supportRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
