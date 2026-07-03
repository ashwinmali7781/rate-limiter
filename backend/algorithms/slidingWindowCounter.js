/**
 * Sliding Window Counter algorithm.
 *
 * Approximates a true sliding log without storing every timestamp. It keeps
 * a counter for the current fixed window and the previous one, then weights
 * the previous window's count by how much of it still overlaps the sliding
 * window. Much cheaper than Sliding Window Log, and smooths out the
 * boundary-burst problem that Fixed Window has.
 *
 * Redis keys: rl:sw:{ruleId}:{clientId}:{windowIndex}
 */
export async function slidingWindowCounter(redis, { ruleId, clientId, limit, windowSeconds }) {
  const now = Date.now();
  const currentWindowIndex = Math.floor(now / 1000 / windowSeconds);
  const previousWindowIndex = currentWindowIndex - 1;

  const currentKey = `rl:sw:${ruleId}:${clientId}:${currentWindowIndex}`;
  const previousKey = `rl:sw:${ruleId}:${clientId}:${previousWindowIndex}`;

  const elapsedInCurrent = (now / 1000) % windowSeconds;
  const weight = 1 - elapsedInCurrent / windowSeconds;

  const pipeline = redis.pipeline();
  pipeline.incr(currentKey);
  pipeline.get(previousKey);
  const results = await pipeline.exec();

  const currentCount = results[0][1];
  const previousCount = Number(results[1][1]) || 0;

  if (currentCount === 1) {
    // keep the key around slightly longer than the window so it can serve
    // as "previous window" for the next window too
    await redis.expire(currentKey, windowSeconds * 2);
  }

  const weightedCount = previousCount * weight + currentCount;
  const allowed = weightedCount <= limit;
  const remaining = Math.max(0, Math.floor(limit - weightedCount));
  const resetAt = (currentWindowIndex + 1) * windowSeconds * 1000;

  return { allowed, remaining, resetAt, count: Math.round(weightedCount) };
}
