const Redis = require("ioredis");

const redis = new Redis({
  host: "localhost",
  port: 6379,
});

async function connectRedis() {
  try {
    await redis.ping();
    console.log("Connected to Redis");
  } catch (error) {
    console.error("Redis connection failed:", error);
  }
}

module.exports = {
  redis,
  connectRedis,
};