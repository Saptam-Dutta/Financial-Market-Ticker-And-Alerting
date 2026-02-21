const WebSocket = require("ws");
require("dotenv").config();

const parseTrade = require("./parser");
const { client } = require("./redisClient");

const SYMBOL = process.env.SYMBOL;
const WS_URL = `${process.env.WS_BASE}/${SYMBOL}@trade`;
const RECONNECT_DELAY = process.env.RECONNECT_DELAY || 3000;

let ws;

function startWebSocket() {
  console.log("Connecting to Binance...");

  ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log("✅ WebSocket connected");
  });

  ws.on("message", async (msg) => {
    const trade = parseTrade(msg);

    if (!trade) return;

    console.log("Price:", trade.price);

    // cache latest price
    await client.set(`${trade.symbol}:latest`, trade.price);
  });

  ws.on("close", () => {
    console.log("⚠️ WebSocket disconnected");
    setTimeout(startWebSocket, RECONNECT_DELAY);
  });

  ws.on("error", (err) => {
    console.error("WS error:", err.message);
    ws.close();
  });
}

module.exports = startWebSocket;