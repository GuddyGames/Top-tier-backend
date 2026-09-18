const User = require('../models/User');
const Contribution = require('../models/Contribution');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/contributions — admin only. Body: { userId, amount, note? }
// Records a contribution after the admin has confirmed the off-platform
// payment (bank transfer / crypto) actually arrived.
const recordContribution = asyncHandler(async (req, res) => {
  const { userId, amount, note } = req.body;

  const contribution = await Contribution.create({
    userId,
    amount,
    note,
    recordedBy: req.user.id,
  });
  const updated = await User.addContribution(userId, amount);

  res.status(201).json({ contribution, total_contribution: updated.total_contribution });
});

// GET /api/contributions/me — auth required
const myContributions = asyncHandler(async (req, res) => {
  const contributions = await Contribution.listForUser(req.user.id);
  res.json({ contributions });
});

// GET /api/contributions — admin only, full ledger + pool total
const allContributions = asyncHandler(async (req, res) => {
  const [contributions, poolTotal] = await Promise.all([
    Contribution.listAll(),
    Contribution.totalPool(),
  ]);
  res.json({ contributions, pool_total: poolTotal });
});

module.exports = { recordContribution, myContributions, allContributions };
