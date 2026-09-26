const WebSocket = require('ws');
const db = require('../config/db');

const DEFAULT_SYMBOLS = [
  'EUR/USD','GBP/USD','USD/JPY','AUD/USD','USD/CAD',
  'XAU/USD','XAG/USD','BTC/USD','ETH/USD','SOL/USD'
];

let providerSocket = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let broadcastClients = new Set();
let latestPrices = new Map();
let symbols = [...DEFAULT_SYMBOLS];

async function loadSymbols() {
  try {
    const { rows } = await db.query('SELECT symbol FROM demo_symbol_prices ORDER BY symbol');
    if (rows.length) symbols = rows.map((r) => r.symbol);
  } catch (err) {
    console.error('[marketFeed] could not load symbols:', err.message);
  }
}

async function persistPrice(symbol, price) {
  await db.query(
    'UPDATE demo_symbol_prices SET price = $2, updated_at = NOW() WHERE symbol = $1',
    [symbol, price]
  );
}

function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const client of broadcastClients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

function handlePrice(message) {
  const symbol = message.symbol || message.data?.symbol;
  const raw = message.price ?? message.data?.price ?? message.close;
  const price = Number(raw);
  if (!symbol || !Number.isFinite(price) || price <= 0) return;

  latestPrices.set(symbol, price);
  broadcast({ type: 'price', symbol, price, timestamp: Date.now() });

  persistPrice(symbol, price).catch((err) => {
    console.error('[marketFeed] price persistence failed:', err.message);
  });
}

function connectProvider() {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) {
    console.warn('[marketFeed] TWELVE_DATA_API_KEY is not set; live market feed is disabled.');
    return;
  }

  if (providerSocket) {
    try { providerSocket.close(); } catch (_) {}
  }

  providerSocket = new WebSocket(
    `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(key)}`
  );

  providerSocket.on('open', () => {
    console.log('[marketFeed] connected to Twelve Data');
    providerSocket.send(JSON.stringify({
      action: 'subscribe',
      params: { symbols: symbols.join(',') },
    }));

    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (providerSocket?.readyState === WebSocket.OPEN) {
        providerSocket.send(JSON.stringify({ action: 'heartbeat' }));
      }
    }, 10000);
  });

  providerSocket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.event === 'price' || message.price != null || message.data?.price != null) {
        handlePrice(message);
      }
    } catch (err) {
      console.error('[marketFeed] invalid provider message:', err.message);
    }
  });

  providerSocket.on('error', (err) => {
    console.error('[marketFeed] provider websocket error:', err.message);
  });

  providerSocket.on('close', () => {
    clearInterval(heartbeatTimer);
    console.warn('[marketFeed] provider connection closed; reconnecting in 5s');
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectProvider, 5000);
  });
}

async function startMarketFeed(wss) {
  await loadSymbols();

  wss.on('connection', (socket) => {
    broadcastClients.add(socket);

    for (const [symbol, price] of latestPrices) {
      socket.send(JSON.stringify({ type: 'price', symbol, price, timestamp: Date.now() }));
    }

    socket.on('close', () => broadcastClients.delete(socket));
    socket.on('error', () => broadcastClients.delete(socket));
  });

  connectProvider();
}

module.exports = { startMarketFeed, getLatestPrice: (symbol) => latestPrices.get(symbol) };
