/**
 * Resolves req.tenantId for multi-tenant rate limiting.
 *
 * Priority:
 *  1. An explicit `X-Tenant-Id` header (e.g. set by an API gateway or a
 *     trusted internal caller that already knows the tenant).
 *  2. The tenant baked into a validated API key (looked up separately in
 *     rules/apikeys controllers when relevant - this middleware doesn't hit
 *     the DB to keep the hot path cheap).
 *  3. Falls back to "default" - a single-tenant deployment just never sets
 *     the header and everything behaves exactly as before Phase 3.
 */
export function resolveTenant(req, res, next) {
  const headerTenant = req.headers["x-tenant-id"];
  req.tenantId = (typeof headerTenant === "string" && headerTenant.trim()) || "default";
  next();
}
