const express = require('express');
const { getLeaderboard } = require('../controllers/leaderboardController');

const router = express.Router();

// Public — a leaderboard is meant to be seen. Switch to requireAuth
// if you'd rather it only be visible to signed-in users.
router.get('/', getLeaderboard);

module.exports = router;
