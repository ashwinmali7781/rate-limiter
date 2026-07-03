import crypto from "crypto";

/**
 * Resolves a stable "clientId" string for a request, given a rule's
 * identifierType. This is what the rate limiting counters key off.
 */
export function resolveClientId(req, identifierType) {
  switch (identifierType) {
    case "user_id":
      return req.auth?.userId || req.headers["x-user-id"] || "anonymous";

    case "api_key": {
      const key = req.headers["x-api-key"];
      if (!key) return "no-api-key";
      // never key Redis/Mongo off the raw secret
      return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
    }

    case "jwt": {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      return token ? crypto.createHash("sha256").update(token).digest("hex").slice(0, 16) : "no-jwt";
    }

    case "ip":
    default:
      return req.ip || req.connection?.remoteAddress || "unknown-ip";
  }
}
