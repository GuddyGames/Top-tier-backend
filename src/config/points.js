// Central place to tune how many points each action is worth.
// Add/edit entries here — nothing else in the codebase needs to change
// when you adjust or extend these rules.
module.exports = {
  login: 10,
  signup_bonus: 50,
  post_created: 10,
  comment_created: 3,
  like_received: 1,
  streak_bonus: 15,
  telegram_verification_bonus: 100, // awarded automatically every 7-day streak milestone
  referral_bonus: 1000, // awarded to the referrer when their link is used to sign up
};
