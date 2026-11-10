const TIMEFRAMES = {
  M1: { interval: "1min", milliseconds: 60_000 },
  M5: { interval: "5min", milliseconds: 300_000 },
  M15: { interval: "15min", milliseconds: 900_000 },
  M30: { interval: "30min", milliseconds: 1_800_000 },
  H1: { interval: "1h", milliseconds: 3_600_000 },
  H4: { interval: "4h", milliseconds: 14_400_000 },
  D1: { interval: "1day", milliseconds: 86_400_000 },
};

class MarketDataError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function ema(values, period) {
  const alpha = 2 / (period + 1);
  let current = values[0];
  for (let i = 1; i < values.length; i += 1) current = values[i] * alpha + current * (1 - alpha);
  return current;
}

function rsi(values, period = 14) {
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return gains === 0 ? 50 : 100;
  return 100 - 100 / (1 + gains / losses);
}

function round(value) {
  return Number(value.toFixed(8));
}

async function analyzeMarket({ symbol, timeframe, outputsize = 120 }) {
  const config = TIMEFRAMES[timeframe];
  if (!config) throw new MarketDataError("Unsupported timeframe.", 400);
  if (!/^[A-Z0-9]{3,10}\/[A-Z0-9]{3,10}$/.test(symbol)) {
    throw new MarketDataError("Use a symbol such as EUR/USD or BTC/USD.", 400);
  }
  if (!Number.isInteger(outputsize) || outputsize < 60 || outputsize > 500) {
    throw new MarketDataError("Candle count must be between 60 and 500.", 400);
  }
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new MarketDataError("Top-tier market data is unavailable because its existing Twelve Data server credential is not configured.", 503);

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", config.interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("order", "asc");
  url.searchParams.set("apikey", key);

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new MarketDataError("Market data provider could not be reached. Try again later.", 502);
  }
  if (!response.ok) throw new MarketDataError("Market data provider returned an HTTP error.", 502);
  const raw = await response.json();
  if (!Array.isArray(raw.values)) {
    const message = typeof raw.message === "string" ? raw.message.slice(0, 200) : "Unexpected market data response.";
    throw new MarketDataError(message, 502);
  }

  const candles = raw.values.map((item) => {
    const time = new Date(item.datetime.includes("T") ? item.datetime : item.datetime.replace(" ", "T") + "Z");
    const candle = { time: time.getTime(), open: Number(item.open), high: Number(item.high), low: Number(item.low), close: Number(item.close) };
    if (!Number.isFinite(candle.time) || Object.values(candle).some((v) => !Number.isFinite(v)) ||
      candle.open <= 0 || candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close) || candle.low <= 0) {
      throw new MarketDataError("Provider returned an invalid candle.", 502);
    }
    return candle;
  }).sort((a, b) => a.time - b.time);

  if (candles.length < 60) throw new MarketDataError("Fewer than 60 valid candles were returned; analysis is withheld.", 503);
  for (let i = 1; i < candles.length; i += 1) {
    if (candles[i].time <= candles[i - 1].time) throw new MarketDataError("Provider returned duplicate candle timestamps.", 502);
  }

  const closes = candles.map((c) => c.close);
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes);
  const ranges = candles.slice(-14).map((c, index) => {
    const prior = candles[candles.length - 14 + index - 1]?.close ?? c.close;
    return Math.max(c.high - c.low, Math.abs(c.high - prior), Math.abs(c.low - prior));
  });
  const atr14 = ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
  const age = Date.now() - latest.time;
  const freshness = age < 0 ? "future-timestamp" : age <= config.milliseconds * 2 ? "fresh" : "stale";
  const bullish = ema20 > ema50 && latest.close > ema20;
  const bearish = ema20 < ema50 && latest.close < ema20;
  const regime = atr14 / latest.close > 0.01 ? "high-volatility" :
    Math.abs(ema20 - ema50) / latest.close > 0.0005 && (bullish || bearish) ? "trend" :
    Math.abs(ema20 - ema50) / latest.close <= 0.0005 ? "range" : "unclear";

  let direction = "WAIT";
  if (freshness === "fresh" && regime === "trend") {
    if (bullish && rsi14 > 50 && rsi14 < 70 && latest.close >= previous.close) direction = "BUY";
    if (bearish && rsi14 < 50 && rsi14 > 30 && latest.close <= previous.close) direction = "SELL";
  }
  const reasons = [];
  if (bullish) reasons.push("EMA 20 is above EMA 50 and price is above EMA 20.");
  if (bearish) reasons.push("EMA 20 is below EMA 50 and price is below EMA 20.");
  reasons.push(rsi14 >= 70 ? "RSI is in the upper extreme zone." : rsi14 <= 30 ? "RSI is in the lower extreme zone." : "RSI is not at an extreme.");
  if (freshness !== "fresh") reasons.push("Market data is not fresh for this timeframe; no directional setup is issued.");
  if (regime === "high-volatility") reasons.push("Volatility is elevated; the basic model avoids directional entries.");
  if (direction === "WAIT") reasons.push("The rules do not show a sufficiently aligned setup.");

  return {
    symbol, timeframe, source: "Twelve Data composite feed",
    analyzedAt: new Date().toISOString(), latestCandleAt: new Date(latest.time).toISOString(),
    dataFreshness: freshness, regime, direction,
    indicators: { ema20: round(ema20), ema50: round(ema50), rsi14: round(rsi14), atr14: round(atr14) },
    referencePrice: latest.close, reasons,
    limitations: [
      "Experimental rules-based analysis, not a validated profitable strategy or guaranteed signal.",
      "Does not yet include executable broker bid/ask, spread, slippage, commissions, news or multi-timeframe confluence.",
      "A BUY or SELL is an analysis candidate, not an instruction to place a live trade."
    ],
    liveExecutionEnabled: false
  };
}

module.exports = { analyzeMarket, MarketDataError, TIMEFRAMES };
