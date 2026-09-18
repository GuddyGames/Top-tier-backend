const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/referral/me — auth required
const getMyReferral = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  const referralCount = await User.countReferrals(req.user.id);

  res.json({
    referral_code: user.referral_code,
    referral_count: referralCount,
  });
});

module.exports = { getMyReferral };
