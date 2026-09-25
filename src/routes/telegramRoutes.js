const express = require('express');
const {
  startVerification,
  startTelegramTask,
  getVerificationStatus,
  webhook,
} = require('../controllers/telegramController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/verification/start', requireAuth, startVerification);
router.post('/tasks/:id/start', requireAuth, startTelegramTask);
router.get('/verification/status', requireAuth, getVerificationStatus);
router.post('/webhook', asyncHandler(webhook));

module.exports = router;
