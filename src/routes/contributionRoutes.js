const express = require('express');
const {
  recordContribution,
  myContributions,
  allContributions,
} = require('../controllers/contributionController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate, contributionValidationRules } = require('../utils/validators');

const router = express.Router();

router.get('/me', requireAuth, myContributions);
router.get('/', requireAuth, requireAdmin, allContributions);
router.post('/', requireAuth, requireAdmin, contributionValidationRules, validate, recordContribution);

module.exports = router;
