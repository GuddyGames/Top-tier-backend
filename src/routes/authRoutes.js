const express = require('express');
const { signup, login, googleLogin } = require('../controllers/authController');
const { validate, signupValidationRules, loginValidationRules } = require('../utils/validators');
const { authLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/signup', authLimiter, signupValidationRules, validate, signup);
router.post('/login', authLimiter, loginValidationRules, validate, login);
router.post('/google', authLimiter, googleLogin);

module.exports = router;
