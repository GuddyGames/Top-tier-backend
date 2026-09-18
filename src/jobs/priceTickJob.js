const cron = require('node-cron');
const { tick } = require('../utils/priceSimulator');
const { checkStopsAndTargets } = require('../utils/demoTradeEngine');

// Every 10 seconds — frequent enough for the chart to feel alive and
// for stop-loss/take-profit to trigger promptly, without hammering the
// DB. node-cron's 6-field format (seconds first) enables this.
function schedulePriceTickJob() {
  cron.schedule('*/10 * * * * *', async () => {
    try {
      await tick();
      await checkStopsAndTargets();
    } catch (err) {
      console.error('[priceTickJob] failed:', err);
    }
  });
  console.log('[priceTickJob] scheduled every 10 seconds');
}

module.exports = { schedulePriceTickJob };
