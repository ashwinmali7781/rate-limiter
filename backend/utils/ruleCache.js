import RateLimitRule from "../models/RateLimitRule.js";

let cache = [];
let lastLoadedAt = 0;
const TTL_MS = 5000; // rules rarely change; a short TTL keeps admin edits responsive

export async function getRules() {
  const now = Date.now();
  if (now - lastLoadedAt > TTL_MS) {
    cache = await RateLimitRule.find({ enabled: true }).sort({ priority: -1 }).lean();
    lastLoadedAt = now;
  }
  return cache;
}

/** Call after any create/update/delete/toggle so the next request sees fresh rules. */
export function invalidateRuleCache() {
  lastLoadedAt = 0;
}

/**
 * Finds the highest-priority enabled rule for the given tenant whose
 * endpointPattern matches the given path. Supports a single trailing "*"
 * wildcard, e.g. "/api/orders/*".
 */
export function matchRule(rules, path, tenantId = "default") {
  for (const rule of rules) {
    const ruleTenant = rule.tenantId || "default";
    if (ruleTenant !== tenantId) continue;
    const pattern = (rule.endpointPattern || "").trim();
    if (pattern === "*" || pattern === path) return rule;
    if (pattern.endsWith("*") && path.startsWith(pattern.slice(0, -1))) return rule;
  }
  return null;
}