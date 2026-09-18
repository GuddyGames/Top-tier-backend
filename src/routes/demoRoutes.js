const express = require('express');
const {
  getPrices,
  getCandles,
  getAccount,
  getPerformance,
  openTrade,
  closeTrade,
  listTrades,
} = require('../controllers/demoController');
const { requireAuth } = require('../middleware/auth');
const { validate, demoTradeValidationRules } = require('../utils/validators');

const router = express.Router();

router.get('/prices', getPrices);
router.get('/prices/:symbol/candles', getCandles);
router.get('/account', requireAuth, getAccount);
router.get('/performance', requireAuth, getPerformance);
router.get('/trades', requireAuth, listTrades);
router.post('/trades', requireAuth, demoTradeValidationRules, validate, openTrade);
router.post('/trades/:id/close', requireAuth, closeTrade);

module.exports = router;
