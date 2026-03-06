require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { connectRedis } = require("./redisClient");
const startWebSocket = require("./websocket");
const aggregateCandles = require("./utils/candles");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// In‑memory storage
let priceHistory = [];
let alerts = [];

/*
-----------------------------------
Health Check
-----------------------------------
*/
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

/*
-----------------------------------
Latest Price Endpoint
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
Candlestick Data
-----------------------------------
*/
app.get("/candles", (req, res) => {
  const timeframe = parseInt(req.query.tf) || 5;
  const candles = aggregateCandles(priceHistory, timeframe);
  res.json(candles);
});

/*
-----------------------------------
Create Price Alert
-----------------------------------
*/
app.post("/alert", (req, res) => {
  const { price } = req.body;

  if (!price) {
    return res.status(400).json({
      error: "Price required"
    });
  }

  alerts.push(Number(price));

  res.json({
    message: "Alert added",
    alerts
  });
});

/*
-----------------------------------
Start Server + WebSocket
-----------------------------------
*/
async function start() {

  // Connect Redis
  await connectRedis();
  console.log("Redis connected");

  // Start WebSocket price stream
  startWebSocket((priceData) => {

    const data = {
      price: Number(priceData.price),
      time: Date.now()
    };

    priceHistory.push(data);

    // prevent memory overflow
    if (priceHistory.length > 500) {
      priceHistory.shift();
    }

    // check alerts
    alerts.forEach(alertPrice => {
      if (data.price >= alertPrice) {
        console.log("🚨 ALERT: Price reached", alertPrice);
      }
    });

  });

  // START API SERVER (this was missing)
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

}

// Start application
start();