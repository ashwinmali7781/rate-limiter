import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";

/** Attaches req.auth to every request when a valid Clerk session is present. */
export const withClerk = clerkMiddleware();

/** Blocks the request with 401 unless the user is signed in. */
export const requireSignedIn = requireAuth();

/**
 * Blocks the request with 403 unless the signed-in user's public metadata
 * marks them as an admin. Set via Clerk dashboard: publicMetadata.role = "admin".
 */
export function requireAdmin(req, res, next) {
  const auth = getAuth(req);
  const role = auth?.sessionClaims?.metadata?.role;
  if (role !== "admin") {
    return res.status(403).json({ error: "forbidden", message: "Admin role required." });
  }
  next();
}
