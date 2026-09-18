const express = require('express');
const { getDashboard, getMyDashboard } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', getDashboard);
router.get('/me', requireAuth, getMyDashboard);

module.exports = router;
