/**
 * Token Bucket algorithm.
 *
 * Each client has a bucket with `capacity` tokens that refills at
 * `refillRate` tokens/second. Every request consumes one token; if the
 * bucket is empty, the request is blocked. This allows short bursts up to
 * the bucket capacity while enforcing a steady average rate.
 *
 * Implemented as a Lua script so the read-modify-write is atomic in Redis
 * (avoids race conditions from concurrent requests hitting the same key).
 *
 * Redis keys: rl:tb:{ruleId}:{clientId} -> hash { tokens, lastRefill }
 */
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local bucket = redis.call("HMGET", key, "tokens", "lastRefill")
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  lastRefill = now
end

local elapsed = math.max(0, now - lastRefill)
local refilled = math.min(capacity, tokens + (elapsed * refillRate))

local allowed = 0
if refilled >= 1 then
  allowed = 1
  refilled = refilled - 1
end

redis.call("HMSET", key, "tokens", refilled, "lastRefill", now)
redis.call("EXPIRE", key, ttl)

return { allowed, tostring(refilled) }
`;

let scriptSha = null;

async function loadScript(redis) {
  if (!scriptSha) {
    scriptSha = await redis.script("LOAD", TOKEN_BUCKET_SCRIPT);
  }
  return scriptSha;
}

export async function tokenBucket(redis, { ruleId, clientId, limit, windowSeconds, burst, refillRate }) {
  const capacity = burst || limit;
  const rate = refillRate || limit / windowSeconds; // tokens per second
  const now = Date.now() / 1000;
  const key = `rl:tb:${ruleId}:${clientId}`;
  const ttl = Math.max(windowSeconds * 2, 60);

  const sha = await loadScript(redis);
  let result;
  try {
    result = await redis.evalsha(sha, 1, key, capacity, rate, now, ttl);
  } catch (err) {
    // script cache was flushed (e.g. Redis restart) - reload and retry once
    scriptSha = null;
    const freshSha = await loadScript(redis);
    result = await redis.evalsha(freshSha, 1, key, capacity, rate, now, ttl);
  }

  const [allowedFlag, tokensLeft] = result;
  const allowed = allowedFlag === 1;
  const remaining = Math.floor(Number(tokensLeft));

  return { allowed, remaining, resetAt: null, count: capacity - remaining };
}
