const { createClient } = require("redis");

const client = createClient({
  socket: {
    host: "redis",
    port: 6379
  }
});

client.on("error", (err) => {
  console.error("Redis error:", err.message);
});

async function connectRedis() {
  await client.connect();
  console.log("Redis connected");
}

module.exports = { client, connectRedis };