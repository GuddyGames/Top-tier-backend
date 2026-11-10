const express = require("express");
const db = require("../config/db");
const { requireAuth } = require("../middleware/auth");
const { parallaxAnalysisLimiter } = require("../middleware/rateLimiters");
const { analyzeMarket, MarketDataError, TIMEFRAMES } = require("../services/parallaxAnalysis");

const router = express.Router();
const FREE_TIMEFRAMES = new Set(["M15", "H1"]);

router.use(requireAuth);

router.get("/access", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT parallax_plan FROM users WHERE id = $1", [req.user.id]);
    return res.json({ plan: rows[0]?.parallax_plan || "free", freeTimeframes: [...FREE_TIMEFRAMES], premiumTimeframes: Object.keys(TIMEFRAMES).filter((tf) => !FREE_TIMEFRAMES.has(tf)), liveExecutionEnabled: false });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load Parallax access." });
  }
});

router.get("/analyze", parallaxAnalysisLimiter, async (req, res) => {
  const symbol = String(req.query.symbol || "EUR/USD").toUpperCase();
  const timeframe = String(req.query.timeframe || "M15").toUpperCase();
  const outputsize = Number(req.query.outputsize || 120);
  if (!TIMEFRAMES[timeframe]) return res.status(400).json({ error: "Unsupported timeframe." });

  try {
    const { rows } = await db.query("SELECT parallax_plan FROM users WHERE id = $1", [req.user.id]);
    const plan = rows[0]?.parallax_plan || "free";
    if (plan !== "premium" && !FREE_TIMEFRAMES.has(timeframe)) {
      return res.status(403).json({ error: "This timeframe is part of Parallax Premium.", code: "PREMIUM_REQUIRED", plan });
    }
    if (plan !== "premium" && outputsize > 120) {
      return res.status(403).json({ error: "Free analysis is limited to 120 candles. Premium unlocks deeper history.", code: "PREMIUM_REQUIRED", plan });
    }
    const analysis = await analyzeMarket({ symbol, timeframe, outputsize });
    await db.query(
      "INSERT INTO parallax_signal_history (user_id, symbol, timeframe, direction, regime, data_source, analyzed_at, result) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [req.user.id, symbol, timeframe, analysis.direction, analysis.regime, analysis.source, analysis.analyzedAt, JSON.stringify(analysis)]
    );
    return res.json({ data: analysis, plan, liveExecutionEnabled: false });
  } catch (error) {
    if (error instanceof MarketDataError) return res.status(error.status).json({ error: error.message, code: "MARKET_DATA_UNAVAILABLE" });
    console.error("[parallax] analysis failed:", error.message);
    return res.status(502).json({ error: "Parallax could not complete this analysis." });
  }
});

router.get("/history", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT id, symbol, timeframe, direction, regime, data_source, analyzed_at FROM parallax_signal_history WHERE user_id = $1 ORDER BY analyzed_at DESC LIMIT 30",
      [req.user.id]
    );
    return res.json({ history: rows });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load analysis history." });
  }
});

module.exports = router;
