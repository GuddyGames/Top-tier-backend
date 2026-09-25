const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const getMyReferral = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  const referrals = await User.getReferrals(req.user.id);
  res.json({
    referral_code: user.referral_code,
    referral_count: referrals.length,
    referrals,
  });
});

module.exports = { getMyReferral };
