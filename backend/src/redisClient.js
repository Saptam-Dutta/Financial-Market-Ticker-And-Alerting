const { createClient } = require("redis");
require("dotenv").config();

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

client.on("error", (err) => {
  console.error("Redis error:", err.message);
});

async function connectRedis() {
  await client.connect();
  console.log("✅ Redis connected");
}

module.exports = { client, connectRedis };