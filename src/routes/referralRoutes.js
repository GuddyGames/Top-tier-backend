const express = require('express');
const { getMyReferral } = require('../controllers/referralController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, getMyReferral);

module.exports = router;
