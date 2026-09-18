const express = require('express');
const { logActivity, myActivity } = require('../controllers/activityController');
const { requireAuth } = require('../middleware/auth');
const { validate, activityValidationRules } = require('../utils/validators');

const router = express.Router();

router.post('/', requireAuth, activityValidationRules, validate, logActivity);
router.get('/me', requireAuth, myActivity);

module.exports = router;
