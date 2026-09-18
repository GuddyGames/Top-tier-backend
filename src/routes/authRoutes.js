const express = require('express');
const { signup, login } = require('../controllers/authController');
const { validate, signupValidationRules, loginValidationRules } = require('../utils/validators');

const router = express.Router();

router.post('/signup', signupValidationRules, validate, signup);
router.post('/login', loginValidationRules, validate, login);

module.exports = router;
