
require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const https    = require("https");
const winston  = require("winston");
const { connectRedis, redis } = require("./redisClient");
const startWebSocket           = require("./websocket");
const aggregateCandles         = require("./utils/candles");

const app  = express();
const PORT = process.env.PORT || 3000;

const cors = require("cors");
app.use(cors());
app.use(express.json());

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
      return `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      options: { flags: "a" },
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      options: { flags: "a" },
    }),
  ],
});

let priceHistory = [];

const TF_TO_BINANCE = { 1: "1m", 5: "5m", 60: "1h", 1440: "1d" };
const TF_DEFAULT_LIMIT = { 1: 120, 5: 288, 60: 168, 1440: 365 };

function fetchBinanceKlines(symbol, interval, limit) {
  return new Promise((resolve, reject) => {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    https.get(url, (res) => {
      let raw = "";
      res.on("data", chunk => raw += chunk);
      res.on("end", () => {
        try {
          const rows = JSON.parse(raw);
          resolve(rows.map(r => ({
            time:  r[0],
            open:  parseFloat(r[1]),
            high:  parseFloat(r[2]),
            low:   parseFloat(r[3]),
            close: parseFloat(r[4]),
          })));
        } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

function alertId() {
  return `alert:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
}

/*
-----------------------------------
Health Check
-----------------------------------
*/
app.get("/", (req, res) => {
  logger.info("Health check requested");
  res.json({ status: "Backend is running", timestamp: new Date().toISOString() });
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
Price History
-----------------------------------
*/
app.get("/history", (req, res) => {
  res.json(priceHistory);
});

/*
-----------------------------------
Live Candles
-----------------------------------
*/
app.get("/candles", (req, res) => {
  const timeframe = parseInt(req.query.tf) || 5;
  res.json(aggregateCandles(priceHistory, timeframe));
});

/*
-----------------------------------
Historical Candles (Binance REST)
GET /candles/history?tf=5&limit=288&symbol=BTCUSDT
-----------------------------------
*/
app.get("/candles/history", async (req, res) => {
  const tf       = parseInt(req.query.tf) || 5;
  const symbol   = (req.query.symbol || "BTCUSDT").toUpperCase();
  const interval = TF_TO_BINANCE[tf] || "5m";
  const limit    = parseInt(req.query.limit) || TF_DEFAULT_LIMIT[tf] || 120;
  const cacheKey = `history:${symbol}:${interval}:${limit}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug("Cache hit", { symbol, interval, limit });
      return res.json(JSON.parse(cached));
    }
    const candles = await fetchBinanceKlines(symbol, interval, limit);
    await redis.set(cacheKey, JSON.stringify(candles), "EX", 60);
    logger.info("Fetched candles from Binance", { symbol, interval, limit });
    res.json(candles);
  } catch (err) {
    logger.error("Binance history fetch error", { message: err.message, symbol });
    res.status(500).json({ error: "Failed to fetch historical data" });
  }
});

/*
-----------------------------------
US-6: CREATE Alert
POST /alert
Body: { symbol, price, direction }
  symbol    : "BTCUSDT" (default)
  price     : threshold price (required)
  direction : "above" | "below" (required)
-----------------------------------
*/
app.post("/alert", async (req, res) => {
  const { price, direction, symbol = "BTCUSDT" } = req.body;

  if (!price || !direction) {
    return res.status(400).json({ error: "price and direction are required" });
  }
  if (!["above", "below"].includes(direction)) {
    return res.status(400).json({ error: "direction must be 'above' or 'below'" });
  }

  const id    = alertId();
  const alert = { id, symbol: symbol.toUpperCase(), price: Number(price), direction, createdAt: Date.now() };

  await redis.hset("alerts:active", id, JSON.stringify(alert));
  logger.info("Alert created", alert);
  res.json({ message: "Alert created", alert });
});

/*
-----------------------------------
US-6: GET all active alerts
GET /alerts
-----------------------------------
*/
app.get("/alerts", async (req, res) => {
  try {
    const raw    = await redis.hgetall("alerts:active");
    const alerts = raw ? Object.values(raw).map(v => JSON.parse(v)) : [];
    res.json(alerts);
  } catch (err) {
    logger.error("Failed to fetch alerts", { message: err.message });
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

/*
-----------------------------------
US-6: DELETE an alert
DELETE /alert/:id
-----------------------------------
*/
app.delete("/alert/:id", async (req, res) => {
  const { id } = req.params;
  const deleted = await redis.hdel("alerts:active", id);
  if (!deleted) {
    return res.status(404).json({ error: "Alert not found" });
  }
  logger.info("Alert deleted", { id });
  res.json({ message: "Alert deleted", id });
});

/*
-----------------------------------
US-6: GET alert history
GET /alerts/history
-----------------------------------
*/
app.get("/alerts/history", async (req, res) => {
  try {
    const raw     = await redis.lrange("alerts:history", 0, 49); // last 50
    const history = raw.map(v => JSON.parse(v));
    res.json(history);
  } catch (err) {
    logger.error("Failed to fetch alert history", { message: err.message });
    res.status(500).json({ error: "Failed to fetch alert history" });
  }
});

/*
-----------------------------------
Start Server + WebSocket
-----------------------------------
*/
async function start() {
  // Create logs directory if it doesn't exist
  const fs = require("fs");
  if (!fs.existsSync("logs")) fs.mkdirSync("logs");

  await connectRedis();
  logger.info("Redis connected");

  startWebSocket(async (priceData) => {
    const data = {
      price: Number(priceData.price),
      time:  Date.now(),
    };

    priceHistory.push(data);
    if (priceHistory.length > 500) priceHistory.shift();

    // Store latest price in Redis (US-3)
    await redis.set("latest:BTCUSDT", JSON.stringify(data));

    // US-7: Log every tick at debug level
    logger.debug("Price tick", { price: data.price, time: data.time });

    // US-6: Check all active alerts
    try {
      const raw = await redis.hgetall("alerts:active");
      if (raw) {
        for (const [id, val] of Object.entries(raw)) {
          const alert = JSON.parse(val);
          const triggered =
            (alert.direction === "above" && data.price >= alert.price) ||
            (alert.direction === "below" && data.price <= alert.price);

          if (triggered) {
            // US-7: Log alert trigger at warn level
            logger.warn("ALERT TRIGGERED", {
              id: alert.id,
              symbol: alert.symbol,
              direction: alert.direction,
              threshold: alert.price,
              currentPrice: data.price,
            });

            // Move to history
            const record = {
              ...alert,
              triggeredAt:  Date.now(),
              triggeredPrice: data.price,
            };
            await redis.lpush("alerts:history", JSON.stringify(record));
            await redis.ltrim("alerts:history", 0, 99); // keep last 100
            await redis.hdel("alerts:active", id);      // remove from active
          }
        }
      }
    } catch (err) {
      logger.error("Alert check error", { message: err.message });
    }
  });

  // US-7: Log WebSocket lifecycle events
  logger.info(`Server starting on port ${PORT}`);

  app.listen(3000, '0.0.0.0', () => {
	console.log("Server running on port 3000");
  });
}

start();