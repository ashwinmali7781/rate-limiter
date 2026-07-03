import Redis from "ioredis";

let redis;

export function getRedis() {
  if (!redis) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

    redis.on("connect", () => console.log("[redis] connected"));

    let lastLoggedError = null;
    redis.on("error", (err) => {
      const signature = `${err.code || ""}:${err.message || ""}`;
      if (signature !== lastLoggedError) {
        console.error(`[redis] connection error (code=${err.code || "unknown"}): ${err.message || err}`);
        lastLoggedError = signature;
      }
    });
  }
  return redis;
}
