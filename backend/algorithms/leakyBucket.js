/**
 * Leaky Bucket algorithm.
 *
 * Models a queue that drains ("leaks") at a constant rate. Each request adds
 * one unit to the queue; if the queue is already at capacity, the request is
 * rejected. Unlike Token Bucket (which allows bursts up to the bucket size
 * and then throttles to the refill rate), Leaky Bucket smooths output to a
 * strictly constant rate regardless of how bursty the input is - it's the
 * right choice when downstream systems need a steady, predictable request
 * rate rather than permission for occasional bursts.
 *
 * Implemented as a Lua script so the read-decay-write is atomic in Redis.
 *
 * Redis keys: rl:lb:{ruleId}:{clientId} -> hash { level, lastLeak }
 */
const LEAKY_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local leakRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local bucket = redis.call("HMGET", key, "level", "lastLeak")
local level = tonumber(bucket[1])
local lastLeak = tonumber(bucket[2])

if level == nil then
  level = 0
  lastLeak = now
end

local elapsed = math.max(0, now - lastLeak)
local leaked = elapsed * leakRate
level = math.max(0, level - leaked)

local allowed = 0
if level + 1 <= capacity then
  allowed = 1
  level = level + 1
end

redis.call("HMSET", key, "level", level, "lastLeak", now)
redis.call("EXPIRE", key, ttl)

return { allowed, tostring(level) }
`;

let scriptSha = null;

async function loadScript(redis) {
  if (!scriptSha) {
    scriptSha = await redis.script("LOAD", LEAKY_BUCKET_SCRIPT);
  }
  return scriptSha;
}

export async function leakyBucket(redis, { ruleId, clientId, limit, windowSeconds, burst, refillRate }) {
  const capacity = burst || limit;
  const leakRate = refillRate || limit / windowSeconds; // requests drained per second
  const now = Date.now() / 1000;
  const key = `rl:lb:${ruleId}:${clientId}`;
  const ttl = Math.max(windowSeconds * 2, 60);

  const sha = await loadScript(redis);
  let result;
  try {
    result = await redis.evalsha(sha, 1, key, capacity, leakRate, now, ttl);
  } catch (err) {
    // script cache was flushed (e.g. Redis restart) - reload and retry once
    scriptSha = null;
    const freshSha = await loadScript(redis);
    result = await redis.evalsha(freshSha, 1, key, capacity, leakRate, now, ttl);
  }

  const [allowedFlag, levelStr] = result;
  const allowed = allowedFlag === 1;
  const level = Number(levelStr);
  const remaining = Math.max(0, Math.floor(capacity - level));

  return { allowed, remaining, resetAt: null, count: Math.ceil(level) };
}
