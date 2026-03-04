const { createClient } = require("redis");

let client;

async function connectRedis() {

  const host = process.env.REDIS_HOST || "localhost";

  client = createClient({
    url: `redis://${host}:6379`
  });

  client.on("error", (err) => {
    console.error("Redis error:", err.message);
  });

  await client.connect();

  console.log("Redis connected");

}

module.exports = { connectRedis };