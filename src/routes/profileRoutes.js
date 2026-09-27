const express = require('express');
const { getMyProfile, updateMyProfile, updateNotifications, acceptPrivacy } = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, getMyProfile);
router.patch('/me', requireAuth, updateMyProfile);
router.patch('/me/notifications', requireAuth, updateNotifications);
router.post('/me/privacy/accept', requireAuth, acceptPrivacy);

module.exports = router;
