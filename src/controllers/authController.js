const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Activity = require('../models/Activity');
const POINTS = require('../config/points');
const { generateReferralCode } = require('../utils/referralCode');
const asyncHandler = require('../utils/asyncHandler');

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/signup
// Body: { username, email, password, telegramUsername?, referralCode? }
const signup = asyncHandler(async (req, res) => {
  const { username, email, password, telegramUsername, referralCode } = req.body;

  // If a referral code was supplied, resolve it to the referring user.
  // An unknown code is not an error — we just sign up without a referrer,
  // so a stale/mistyped link never blocks someone from joining.
  let referrer = null;
  if (referralCode) {
    referrer = await User.findByReferralCode(referralCode.trim().toUpperCase());
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const ownReferralCode = generateReferralCode(username);

  const user = await User.create({
    username,
    email,
    passwordHash,
    referralCode: ownReferralCode,
    referredBy: referrer ? referrer.id : null,
    telegramUsername,
  });

  // Signup itself earns a starter bonus and shows up in the activity log
  // and dashboard's "new signups today" count immediately.
  await Activity.log({ userId: user.id, actionType: 'signup_bonus', points: POINTS.signup_bonus });
  await User.addPoints(user.id, POINTS.signup_bonus);

  // Reward whoever referred this signup.
  if (referrer) {
    await Activity.log({ userId: referrer.id, actionType: 'referral_bonus', points: POINTS.referral_bonus });
    await User.addPoints(referrer.id, POINTS.referral_bonus);
  }

  const token = signToken({ ...user, role: 'user' });
  res.status(201).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: 'user',
      referral_code: user.referral_code,
      total_points: POINTS.signup_bonus,
    },
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      referral_code: user.referral_code,
      total_points: user.total_points,
    },
  });
});

module.exports = { signup, login };
