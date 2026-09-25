const express = require('express');
const {
  startVerification,
  getVerificationStatus,
  webhook,
} = require('../controllers/telegramController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/verification/start', requireAuth, startVerification);
router.get('/verification/status', requireAuth, getVerificationStatus);
router.post('/webhook', asyncHandler(webhook));

module.exports = router;
