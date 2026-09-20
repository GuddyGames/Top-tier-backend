const { body, validationResult } = require('express-validator');

// Runs after the *ValidationRules array below; short-circuits with a
// 400 if any rule failed, so controllers never see bad input.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, details: errors.array() });
  }
  next();
}

const signupValidationRules = [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('telegramUsername').optional({ checkFalsy: true }).trim().isLength({ max: 50 }),
  body('referralCode').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
];

const taskValidationRules = [
  body('title').trim().isLength({ min: 3, max: 150 }).withMessage('Title must be 3-150 characters'),
  body('points').isInt({ min: 1 }).withMessage('Points must be a positive integer'),
  body('link').optional({ checkFalsy: true }).isURL().withMessage('Link must be a valid URL'),
  body('description').optional({ checkFalsy: true }).isLength({ max: 1000 }),
];

const taskSubmitValidationRules = [
  body('proofUrl').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
];

const demoTradeValidationRules = [
  body('symbol').trim().notEmpty().withMessage('symbol is required'),
  body('side').isIn(['buy', 'sell']).withMessage('side must be "buy" or "sell"'),
  body('size').isFloat({ gt: 0 }).withMessage('size must be a positive number'),
  body('stopLoss').optional({ checkFalsy: true }).isFloat({ gt: 0 }).withMessage('stopLoss must be a positive number'),
  body('takeProfit').optional({ checkFalsy: true }).isFloat({ gt: 0 }).withMessage('takeProfit must be a positive number'),
];

const loginValidationRules = [
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const activityValidationRules = [
  body('actionType').trim().notEmpty().withMessage('actionType is required'),
];

const adminScoreValidationRules = [
  body('points').isInt().withMessage('points must be an integer (negative to deduct)'),
  body('note').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
];

module.exports = {
  validate,
  signupValidationRules,
  loginValidationRules,
  activityValidationRules,
  taskValidationRules,
  taskSubmitValidationRules,
  demoTradeValidationRules,
  adminScoreValidationRules,
};
