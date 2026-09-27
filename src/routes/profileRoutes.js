const express = require('express');
const { getMyProfile, updateMyProfile, updateNotifications, acceptPrivacy, getNotifications, markNotificationRead } = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, getMyProfile);
router.patch('/me', requireAuth, updateMyProfile);
router.patch('/me/notifications', requireAuth, updateNotifications);
router.post('/me/privacy/accept', requireAuth, acceptPrivacy);
router.get('/me/notifications', requireAuth, getNotifications);
router.patch('/me/notifications/:id/read', requireAuth, markNotificationRead);

module.exports = router;
