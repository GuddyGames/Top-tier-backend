const express = require('express');
const { getMyProfile, updateMyProfile } = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, getMyProfile);
router.patch('/me', requireAuth, updateMyProfile);

module.exports = router;
