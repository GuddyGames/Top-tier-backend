const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Activity = require('../models/Activity');
const POINTS = require('../config/points');
const { generateReferralCode } = require('../utils/referralCode');
const asyncHandler = require('../utils/asyncHandler');
const { computeStreak } = require('../utils/streak');

const SALT_ROUNDS = 10;

async function verifySupabaseGoogleToken(accessToken) {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase authentication is not configured on the server');
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) throw new Error('Invalid Google authentication session');
  return data.user;
}

function googleUsername(email, metadata = {}) {
  const base = String(metadata.user_name || metadata.preferred_username || metadata.full_name || email.split('@')[0])
    .toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 42) || 'user';
  return base;
}

async function uniqueUsername(seed) {
  let candidate = seed;
  let suffix = 1;
  while (await User.findByUsername(candidate)) {
    const tail = String(suffix++);
    candidate = `${seed.slice(0, 50 - tail.length)}${tail}`;
  }
  return candidate;
}

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
  await Activity.log({ userId: user.id, actionType: 'signup_bonus', points: POINTS.signup_bonus, note: 'Signup bonus' });
  await User.addPoints(user.id, POINTS.signup_bonus);

  // Reward whoever referred this signup.
  if (referrer) {
    await Activity.log({ userId: referrer.id, actionType: 'referral_bonus', points: POINTS.referral_bonus, note: `Referral bonus for ${username} joining with your referral code` });
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

  // Award the daily login bonus once per calendar day.
  if (!user.last_active_date || new Date(user.last_active_date).toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10)) {
    await Activity.log({ userId: user.id, actionType: 'login', points: POINTS.login, note: 'Daily login bonus' });
    await User.addPoints(user.id, POINTS.login);
    const fresh = await User.findById(user.id);
    const result = computeStreak({ lastActiveDate: fresh.last_active_date, currentStreak: fresh.current_streak, longestStreak: fresh.longest_streak });
    await User.updateStreak(user.id, result);
  }

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

const googleLogin = asyncHandler(async (req, res) => {
  const { accessToken } = req.body || {};
  if (!accessToken) return res.status(400).json({ error: 'Google authentication token is required' });

  let googleUser;
  try { googleUser = await verifySupabaseGoogleToken(accessToken); }
  catch (error) { return res.status(401).json({ error: error.message }); }

  const email = String(googleUser.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Google account does not provide an email address' });

  let user = await User.findByEmail(email);
  if (!user) {
    const seed = googleUsername(email, googleUser.user_metadata || {});
    const username = await uniqueUsername(seed);
    const referralCode = generateReferralCode(username);
    const metadata = googleUser.user_metadata || {};
    const displayName = String(metadata.full_name || metadata.name || '').trim();
    const passwordHash = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), SALT_ROUNDS);
    user = await User.create({ username, email, passwordHash, referralCode, referredBy: null, telegramUsername: metadata.telegram_username || null });
    await Activity.log({ userId: user.id, actionType: 'signup_bonus', points: POINTS.signup_bonus, note: 'Signup bonus' });
    await User.addPoints(user.id, POINTS.signup_bonus);
    user = await User.findByEmail(email);
    console.log(`[auth] Google account created for ${email}${displayName ? ` (${displayName})` : ''}`);
  }

  if (user.status !== 'active') return res.status(403).json({ error: 'Account is inactive' });
  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role, referral_code: user.referral_code, total_points: user.total_points } });
});

module.exports = { signup, login, googleLogin };
