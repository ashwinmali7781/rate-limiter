import { getRedis } from "../config/redis.js";
import { getRules, matchRule } from "../utils/ruleCache.js";
import { resolveClientId } from "./identifyClient.js";
import { runAlgorithm } from "../algorithms/index.js";
import RequestLog from "../models/RequestLog.js";
import { emitLive } from "../utils/socket.js";
import { recordRequestMetric } from "../utils/metrics.js";

const adminBypassIds = new Set(
  (process.env.ADMIN_BYPASS_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

export async function rateLimiter(req, res, next) {
  const startedAt = Date.now();
  const tenantId = req.tenantId || "default";

  // Admins configured for bypass skip limiting entirely, but still pass through.
  const userId = req.auth?.userId;
  if (userId && adminBypassIds.has(userId)) {
    return next();
  }

  const rules = await getRules();
  const path = req.originalUrl.split("?")[0];
  const rule = matchRule(rules, path, tenantId);

  // No rule matches this path -> not rate limited.
  if (!rule) return next();

  const clientId = resolveClientId(req, rule.identifierType);
  const redis = getRedis();

  let result;
  try {
    result = await runAlgorithm(rule.algorithm, redis, {
      ruleId: rule._id.toString(),
      clientId,
      limit: rule.limit,
      windowSeconds: rule.windowSeconds,
      burst: rule.burst,
      refillRate: rule.refillRate,
    });
  } catch (err) {
    // Fail open: a Redis hiccup shouldn't take down the whole API.
    console.error("[rate-limiter] algorithm error, failing open:", err.message);
    return next();
  }

  const responseTimeMs = Date.now() - startedAt;

  res.set("X-RateLimit-Limit", String(rule.limit));
  res.set("X-RateLimit-Remaining", String(Math.max(0, result.remaining)));
  if (result.resetAt) res.set("X-RateLimit-Reset", String(result.resetAt));

  const status = result.allowed ? "allowed" : "blocked";

  recordRequestMetric({ tenantId, algorithm: rule.algorithm, status, durationMs: responseTimeMs });

  // Log asynchronously - don't block the response on a Mongo write.
  RequestLog.create({
    tenantId,
    clientId,
    identifierType: rule.identifierType,
    ip: req.ip,
    endpoint: path,
    method: req.method,
    algorithm: rule.algorithm,
    status,
    responseTimeMs,
    remaining: result.remaining,
    ruleId: rule._id,
  }).catch((err) => console.error("[rate-limiter] log write failed:", err.message));

  emitLive("request", {
    tenantId,
    clientId,
    endpoint: path,
    status,
    algorithm: rule.algorithm,
    timestamp: Date.now(),
  });

  if (!result.allowed) {
    return res.status(429).json({
      error: "rate_limit_exceeded",
      message: `Too many requests. Try again ${result.resetAt ? "after reset" : "shortly"}.`,
      limit: rule.limit,
      remaining: 0,
    });
  }

  req.matchedRule = rule;
  next();
}
