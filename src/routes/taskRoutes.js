const express = require('express');
const {
  listTasks,
  createTask,
  deactivateTask,
  submitTask,
  mySubmissions,
  listSubmissions,
  reviewSubmission,
} = require('../controllers/taskController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate, taskValidationRules, taskSubmitValidationRules } = require('../utils/validators');

const router = express.Router();

// Public
router.get('/', listTasks);

// Authenticated users
router.get('/me', requireAuth, mySubmissions);
router.post('/:id/submit', requireAuth, taskSubmitValidationRules, validate, submitTask);

// Admin only
router.post('/', requireAuth, requireAdmin, taskValidationRules, validate, createTask);
router.patch('/:id/deactivate', requireAuth, requireAdmin, deactivateTask);
router.get('/:id/submissions', requireAuth, requireAdmin, listSubmissions);
router.patch('/submissions/:id', requireAuth, requireAdmin, reviewSubmission);

module.exports = router;
