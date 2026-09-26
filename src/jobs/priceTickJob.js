const cron = require('node-cron');
const { checkStopsAndTargets } = require('../utils/demoTradeEngine');

// Live market prices now come from the market WebSocket feed.
// This job only checks demo stop-loss/take-profit orders.
function schedulePriceTickJob() {
  cron.schedule('*/2 * * * * *', async () => {
    try {
      await checkStopsAndTargets();
    } catch (err) {
      console.error('[priceTickJob] failed:', err);
    }
  });
  console.log('[priceTickJob] stop/target checker scheduled every 2 seconds');
}

module.exports = { schedulePriceTickJob };
