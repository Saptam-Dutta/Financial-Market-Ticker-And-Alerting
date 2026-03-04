const WebSocket = require("ws");

function startWebSocket(onPriceUpdate) {

  console.log("Connecting to Binance...");

  const ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

  ws.on("open", () => {
    console.log("WebSocket connected");
  });

  ws.on("message", (data) => {

    const trade = JSON.parse(data);

    const price = parseFloat(trade.p);
    const timestamp = trade.T;

    const entry = {
      price,
      timestamp
    };

    if (onPriceUpdate) {
      onPriceUpdate(entry);
    }

  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });

  ws.on("close", () => {
    console.log("WebSocket disconnected");
  });

}

module.exports = startWebSocket;