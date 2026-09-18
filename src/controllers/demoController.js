const DemoAccount = require('../models/DemoAccount');
const DemoPrice = require('../models/DemoPrice');
const DemoTrade = require('../models/DemoTrade');
const DemoPriceHistory = require('../models/DemoPriceHistory');
const { calculatePnl } = require('../utils/demoTradeEngine');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/demo/prices — public, current simulated prices
const getPrices = asyncHandler(async (req, res) => {
  const prices = await DemoPrice.all();
  res.json({ prices });
});

// GET /api/demo/prices/:symbol/candles?hours=4 — public, 1-minute OHLC candles
const getCandles = asyncHandler(async (req, res) => {
  const symbol = decodeURIComponent(req.params.symbol);
  const hours = Math.min(parseInt(req.query.hours, 10) || 4, 24);
  const candles = await DemoPriceHistory.getCandles(symbol, hours);
  res.json({ symbol, candles });
});

// GET /api/demo/account — auth. Creates the account on first visit.
const getAccount = asyncHandler(async (req, res) => {
  const account = await DemoAccount.findOrCreate(req.user.id);
  const openTrades = (await DemoTrade.listForUser(req.user.id)).filter((t) => t.status === 'open');
  res.json({ account, open_trades: openTrades });
});

// GET /api/demo/performance — auth. Beginner performance summary for the Home page.
const getPerformance = asyncHandler(async (req, res) => {
  const account = await DemoAccount.findOrCreate(req.user.id);
  const summary = await DemoTrade.summaryForUser(req.user.id);
  const recentTrades = (await DemoTrade.listForUser(req.user.id)).slice(0, 10);

  res.json({
    balance: account.balance,
    starting_balance: 10000,
    return_pct: Math.round(((account.balance - 10000) / 10000) * 1000) / 10,
    ...summary,
    recent_trades: recentTrades,
  });
});

// POST /api/demo/trades — auth. Body: { symbol, side: "buy"|"sell", size, stopLoss?, takeProfit? }
// No leverage/margin modeling in this v1 — size is just a notional
// amount used to scale P&L. Good enough for teaching the mechanics;
// swap in real margin math if you want it closer to a real platform.
const openTrade = asyncHandler(async (req, res) => {
  const { symbol, side, size, stopLoss, takeProfit } = req.body;

  const priceRow = await DemoPrice.get(symbol);
  if (!priceRow) return res.status(400).json({ error: `Unknown symbol "${symbol}"` });

  const account = await DemoAccount.findOrCreate(req.user.id);
  if (size > account.balance) {
    return res.status(400).json({ error: 'Trade size exceeds available demo balance' });
  }

  const price = parseFloat(priceRow.price);

  // Sanity-check stop-loss/take-profit sit on the correct side of entry —
  // this is exactly the mistake beginners make, so catch it here with a
  // plain-language error rather than silently accepting a useless order.
  if (stopLoss) {
    const wrongSide = side === 'buy' ? stopLoss >= price : stopLoss <= price;
    if (wrongSide) {
      return res.status(400).json({
        error: `A ${side} stop-loss must be ${side === 'buy' ? 'below' : 'above'} the entry price`,
      });
    }
  }
  if (takeProfit) {
    const wrongSide = side === 'buy' ? takeProfit <= price : takeProfit >= price;
    if (wrongSide) {
      return res.status(400).json({
        error: `A ${side} take-profit must be ${side === 'buy' ? 'above' : 'below'} the entry price`,
      });
    }
  }

  const trade = await DemoTrade.open({
    userId: req.user.id,
    symbol,
    side,
    size,
    entryPrice: price,
    stopLoss,
    takeProfit,
  });

  res.status(201).json({ trade });
});

// POST /api/demo/trades/:id/close — auth, manual close
const closeTrade = asyncHandler(async (req, res) => {
  const trade = await DemoTrade.findOpenById(req.params.id, req.user.id);
  if (!trade) return res.status(404).json({ error: 'Open trade not found' });

  const priceRow = await DemoPrice.get(trade.symbol);
  const exitPrice = parseFloat(priceRow.price);

  const pnl = calculatePnl({
    side: trade.side,
    size: parseFloat(trade.size),
    entryPrice: parseFloat(trade.entry_price),
    exitPrice,
  });

  const closed = await DemoTrade.close(trade.id, { exitPrice, pnl, closeReason: 'manual' });
  await DemoAccount.adjustBalance(req.user.id, pnl);

  res.json({ trade: closed });
});

// GET /api/demo/trades — auth. Trade history (open + closed).
const listTrades = asyncHandler(async (req, res) => {
  const trades = await DemoTrade.listForUser(req.user.id);
  res.json({ trades });
});

module.exports = {
  getPrices,
  getCandles,
  getAccount,
  getPerformance,
  openTrade,
  closeTrade,
  listTrades,
};
