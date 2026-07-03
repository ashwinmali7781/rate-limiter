/**
 * Fixed Window algorithm.
 *
 * Divides time into fixed-size windows (e.g. 60s buckets). Each client gets
 * a counter per window. Simple and cheap, but bursts can happen at window
 * boundaries (up to 2x limit right at the edge).
 *
 * Redis keys: rl:fw:{ruleId}:{clientId}:{windowIndex}
 */
export async function fixedWindow(redis, { ruleId, clientId, limit, windowSeconds }) {
  const now = Date.now();
  const windowIndex = Math.floor(now / 1000 / windowSeconds);
  const key = `rl:fw:${ruleId}:${clientId}:${windowIndex}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  const resetAt = (windowIndex + 1) * windowSeconds * 1000;

  return { allowed, remaining, resetAt, count };
}
