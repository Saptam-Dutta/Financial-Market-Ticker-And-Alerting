require("dotenv").config();
const express = require("express");
const { connectRedis } = require("./redisClient");
const startWebSocket = require("./websocket");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

async function start() {
  await connectRedis();
  startWebSocket();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
