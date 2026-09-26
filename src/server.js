require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('[server] JWT_SECRET is not set — refusing to start. Set it in your .env.');
  process.exit(1);
}

const http = require('http');
const { WebSocketServer } = require('ws');
const app = require('./app');
const { scheduleDailyRankJob } = require('./jobs/dailyRankJob');
const { schedulePriceTickJob } = require('./jobs/priceTickJob');
const { configureTelegramWebhook } = require('./controllers/telegramController');
const { startMarketFeed } = require('./services/marketFeed');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/market' });

server.listen(PORT, async () => {
  console.log(`Leaderboard backend running on port ${PORT}`);
  scheduleDailyRankJob();
  schedulePriceTickJob();
  configureTelegramWebhook();
  await startMarketFeed(wss);
});
