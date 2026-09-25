const express = require('express');
const multer = require('multer');
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
const uploadProof = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

// Public
router.get('/', listTasks);

// Authenticated users
router.get('/me', requireAuth, mySubmissions);
router.post('/:id/submit', requireAuth, uploadProof.single('proof'), taskSubmitValidationRules, validate, submitTask);

// Admin only
router.post('/', requireAuth, requireAdmin, taskValidationRules, validate, createTask);
router.patch('/:id/deactivate', requireAuth, requireAdmin, deactivateTask);
router.get('/:id/submissions', requireAuth, requireAdmin, listSubmissions);
router.patch('/submissions/:id', requireAuth, requireAdmin, reviewSubmission);

module.exports = router;
