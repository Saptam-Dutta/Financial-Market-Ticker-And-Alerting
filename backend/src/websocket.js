
const WebSocket = require("ws");

function startWebSocket(onPriceUpdate, onEvent) {
  const WS_URL = `wss://stream.binance.com:9443/ws/${process.env.SYMBOL || "btcusdt"}@trade`;

  console.log(`[WS] Connecting to ${WS_URL}`);

  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log("[WS] WebSocket connected");
    if (onEvent) onEvent("open", { url: WS_URL });
  });

  ws.on("message", (data) => {
    try {
      const trade = JSON.parse(data);
      const entry = {
        price: parseFloat(trade.p),
        time:  trade.T,          // ← FIXED: was 'timestamp', now 'time' to match priceHistory schema
      };
      if (onPriceUpdate) onPriceUpdate(entry);
    } catch (err) {
      console.error("[WS] Message parse error:", err.message);
      if (onEvent) onEvent("parse_error", { message: err.message });
    }
  });

  ws.on("error", (err) => {
    console.error("[WS] WebSocket error:", err.message);
    if (onEvent) onEvent("error", { message: err.message });
  });

  ws.on("close", (code, reason) => {
    console.log(`[WS] WebSocket disconnected (code: ${code})`);
    if (onEvent) onEvent("close", { code, reason: reason?.toString() });

    // Auto-reconnect after 3 seconds
    console.log("[WS] Reconnecting in 3s...");
    setTimeout(() => startWebSocket(onPriceUpdate, onEvent), 3000);
  });
}

module.exports = startWebSocket;