const cron = require('node-cron');
const { tick } = require('../utils/priceSimulator');
const { checkStopsAndTargets } = require('../utils/demoTradeEngine');

// Twelve Data owns EUR/USD, BTC/USD and XAU/USD. The existing local
// simulator continues to move every other demo symbol.
function schedulePriceTickJob() {
  cron.schedule('*/10 * * * * *', async () => {
    try {
      await tick();
      await checkStopsAndTargets();
    } catch (err) {
      console.error('[priceTickJob] failed:', err);
    }
  });
  console.log('[priceTickJob] local simulator + stop/target checker scheduled every 10 seconds');
}

module.exports = { schedulePriceTickJob };
