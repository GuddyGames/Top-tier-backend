const express = require('express');
const {
  listUsers,
  getUserDetail,
  updateUserStatus,
  updateUserProfile,
  updateUserContribution,
  scoreUser,
  getGlobalActivity,
  getGlobalTrades,
  getPendingSubmissions,
} = require('../controllers/adminController');
const { listSubmissions } = require('../controllers/taskController'); // re-exposed under /admin for a single control room
const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
  validate,
  adminScoreValidationRules,
  adminProfileEditValidationRules,
} = require('../utils/validators');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id', adminProfileEditValidationRules, validate, updateUserProfile);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/contribution', updateUserContribution);
router.post('/users/:id/score', adminScoreValidationRules, validate, scoreUser);
router.get('/tasks/:id/submissions', listSubmissions);
router.get('/tasks/pending', getPendingSubmissions);
router.get('/activity', getGlobalActivity);
router.get('/trades', getGlobalTrades);

module.exports = router;
