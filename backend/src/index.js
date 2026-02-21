require("dotenv").config();
const { connectRedis } = require("./redisClient");
const startWebSocket = require("./websocket");

async function start() {
  await connectRedis();
  startWebSocket();
}

start();