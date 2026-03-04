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

// price history buffer
let priceHistory = [];

// health check
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// latest price
app.get("/price", (req, res) => {
  const latest = priceHistory[priceHistory.length - 1];
  res.json(latest || {});
});

// price history
app.get("/history", (req, res) => {
  res.json(priceHistory);
});

// candlestick endpoint
app.get("/candles", (req, res) => {
  const timeframe = parseInt(req.query.tf);

  const candles = aggregateCandles(priceHistory, timeframe);

  res.json(candles);
});

async function start() {

  await connectRedis();

  // start websocket and store incoming prices
  startWebSocket((priceData) => {

    priceHistory.push(priceData);

    if (priceHistory.length > 200) {
      priceHistory.shift();
    }

  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

}

start();