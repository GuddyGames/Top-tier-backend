const express = require('express');
const { listUsers, getUserDetail, updateUserStatus, scoreUser } = require('../controllers/adminController');
const { listSubmissions } = require('../controllers/taskController'); // re-exposed under /admin for a single control room
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate, adminScoreValidationRules } = require('../utils/validators');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id/status', updateUserStatus);
router.post('/users/:id/score', adminScoreValidationRules, validate, scoreUser);
router.get('/tasks/:id/submissions', listSubmissions);

module.exports = router;
