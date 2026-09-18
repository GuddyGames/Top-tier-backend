// Given a user's stored streak state and "today", works out the new
// streak. Rules:
//  - last active today already      -> streak unchanged
//  - last active yesterday          -> streak + 1 (consecutive day)
//  - last active before that (gap)  -> streak resets to 1
//  - never active before            -> streak starts at 1
function computeStreak({ lastActiveDate, currentStreak, longestStreak }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let newStreak = 1;
  let bonusEarned = false;

  if (lastActiveDate) {
    const last = new Date(lastActiveDate);
    last.setHours(0, 0, 0, 0);
    const dayDiff = Math.round((today - last) / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) {
      newStreak = currentStreak; // already logged today, no change
    } else if (dayDiff === 1) {
      newStreak = currentStreak + 1;
    } else {
      newStreak = 1; // streak broken
    }
  }

  // Every 7-day milestone earns a one-time bonus for that milestone.
  if (newStreak > 0 && newStreak % 7 === 0 && newStreak !== currentStreak) {
    bonusEarned = true;
  }

  const newLongest = Math.max(longestStreak || 0, newStreak);

  return {
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastActiveDate: today.toISOString().slice(0, 10),
    bonusEarned,
  };
}

module.exports = { computeStreak };
