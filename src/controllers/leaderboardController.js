const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/leaderboard?limit=20&offset=0
const getLeaderboard = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = parseInt(req.query.offset, 10) || 0;

  const users = await User.getLeaderboard({ limit, offset });
  res.json({ leaderboard: users, limit, offset });
});

module.exports = { getLeaderboard };
