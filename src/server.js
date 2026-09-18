require('dotenv').config();
const app = require('./app');
const { scheduleDailyRankJob } = require('./jobs/dailyRankJob');
const { schedulePriceTickJob } = require('./jobs/priceTickJob');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Leaderboard backend running on port ${PORT}`);
  scheduleDailyRankJob();
  schedulePriceTickJob();
});
