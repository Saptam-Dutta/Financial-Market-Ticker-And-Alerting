// ============================================================
// index.js — Financial Market Ticker Backend
// Author: Rishabh Ahuja (Backend & Data Streaming Lead)
// ============================================================

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const https    = require("https");
const { connectRedis, redis } = require("./redisClient");
const startWebSocket           = require("./websocket");
const aggregateCandles         = require("./utils/candles");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
app.use(express.json());

// In-memory storage (live ticks from WebSocket)
let priceHistory = [];

// ============================================================
// Binance interval map: tf (minutes) → Binance interval string
// ============================================================
const TF_TO_BINANCE = {
  1:    "1m",
  5:    "5m",
  60:   "1h",
  1440: "1d",
};

// ============================================================
// Smart default limits per timeframe — controls how many
// candles are shown by default for a clean, readable chart
// ============================================================
const TF_DEFAULT_LIMIT = {
  1:    120,   // 1m  → last 2 hours
  5:    288,   // 5m  → last 24 hours
  60:   168,   // 1h  → last 7 days
  1440: 365,   // 1d  → last 1 year
};

// ============================================================
// Fetch historical klines from Binance REST API (no API key)
// ============================================================
function fetchBinanceKlines(interval, limit) {
  return new Promise((resolve, reject) => {
    const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
    https.get(url, (res) => {
      let raw = "";
      res.on("data", chunk => raw += chunk);
      res.on("end", () => {
        try {
          const rows = JSON.parse(raw);
          const candles = rows.map(r => ({
            time:  r[0],
            open:  parseFloat(r[1]),
            high:  parseFloat(r[2]),
            low:   parseFloat(r[3]),
            close: parseFloat(r[4]),
          }));
          resolve(candles);
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

/*
-----------------------------------
Health Check
-----------------------------------
*/
app.get("/", (req, res) => {
  res.send("Backend is running");
});

/*
-----------------------------------
Latest Price
-----------------------------------
*/
app.get("/price", (req, res) => {
  const latest = priceHistory[priceHistory.length - 1];
  res.json(latest || {});
});

/*
-----------------------------------
Price History (live ticks)
-----------------------------------
*/
app.get("/history", (req, res) => {
  res.json(priceHistory);
});

/*
-----------------------------------
Live Candles (aggregated from WebSocket ticks)
-----------------------------------
*/
app.get("/candles", (req, res) => {
  const timeframe = parseInt(req.query.tf) || 5;
  const candles   = aggregateCandles(priceHistory, timeframe);
  res.json(candles);
});

/*
-----------------------------------
Historical Candles from Binance REST API
GET /candles/history?tf=1&limit=120
tf     : timeframe in minutes (1, 5, 60, 1440)
limit  : number of candles (optional, smart default per timeframe)
-----------------------------------
*/
app.get("/candles/history", async (req, res) => {
  const tf       = parseInt(req.query.tf) || 5;
  const interval = TF_TO_BINANCE[tf] || "5m";
  const limit    = parseInt(req.query.limit) || TF_DEFAULT_LIMIT[tf] || 120;
  const cacheKey = `history:${interval}:${limit}`;

  try {
    // Serve from Redis cache if available (TTL = 60s)
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Fetch fresh from Binance
    const candles = await fetchBinanceKlines(interval, limit);

    // Cache result in Redis for 60 seconds
    await redis.set(cacheKey, JSON.stringify(candles), "EX", 60);

    res.json(candles);
  } catch (err) {
    console.error("Binance history fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch historical data" });
  }
});

/*
-----------------------------------
Create Price Alert
-----------------------------------
*/
app.post("/alert", async (req, res) => {
  const { price } = req.body;
  if (!price) return res.status(400).json({ error: "Price required" });
  await redis.lpush("alerts", price);
  res.json({ message: "Alert stored in Redis", price });
});

/*
-----------------------------------
Start Server + WebSocket
-----------------------------------
*/
async function start() {
  await connectRedis();
  console.log("Redis connected");

  startWebSocket(async (priceData) => {
    const data = {
      price: Number(priceData.price),
      time:  Date.now(),
    };

    priceHistory.push(data);
    if (priceHistory.length > 500) priceHistory.shift();

    // Store latest price in Redis (US-3)
    await redis.set("latest:BTCUSDT", JSON.stringify(data));

    // Check price alerts
    const alerts = await redis.lrange("alerts", 0, -1);
    for (let alertPrice of alerts) {
      if (data.price >= Number(alertPrice)) {
        console.log("ALERT TRIGGERED:", alertPrice);
        await redis.lrem("alerts", 0, alertPrice);
      }
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();