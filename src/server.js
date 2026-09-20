require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('[server] JWT_SECRET is not set — refusing to start. Set it in your .env.');
  process.exit(1);
}

const app = require('./app');
const { scheduleDailyRankJob } = require('./jobs/dailyRankJob');
const { schedulePriceTickJob } = require('./jobs/priceTickJob');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Leaderboard backend running on port ${PORT}`);
  scheduleDailyRankJob();
  schedulePriceTickJob();
});
