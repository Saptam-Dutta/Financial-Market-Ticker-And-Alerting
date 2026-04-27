
const Redis = require("ioredis");

const redis = new Redis({
  host:            process.env.REDIS_HOST || "localhost",
  port:            parseInt(process.env.REDIS_PORT) || 6379,
  retryStrategy:   (times) => Math.min(times * 500, 3000),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
});

redis.on("connect", () => {
  console.log("Redis connected");
});

async function connectRedis() {
  try {
    await redis.ping();
    console.log("Redis ping OK");
  } catch (error) {
    console.error("Redis connection failed:", error.message);
  }
}

module.exports = { redis, connectRedis };