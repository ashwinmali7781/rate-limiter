import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const router = Router();

/**
 * By the time a request reaches here, the `rateLimiter` middleware (mounted
 * ahead of this router in server.js) has already allowed it and attached
 * `req.matchedRule`. If that rule has an `upstreamUrl`, we proxy the request
 * there - Throttle is acting as a lightweight API Gateway: rate limit first,
 * then forward. If no rule matched, or the matched rule has no upstream
 * configured, there's nothing to proxy to.
 */
router.use((req, res, next) => {
  const rule = req.matchedRule;

  if (!rule?.upstreamUrl) {
    return res.status(404).json({
      error: "no_upstream_configured",
      message: "No rate limit rule with an upstreamUrl matches this path. Set upstreamUrl on the rule to use gateway mode.",
    });
  }

  return createProxyMiddleware({
    target: rule.upstreamUrl,
    changeOrigin: true,
    pathRewrite: { "^/gateway": "" },
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader("X-Forwarded-By", "throttle-gateway");
      },
      error: (err, req2, res2) => {
        console.error("[gateway] proxy error:", err.message);
        res2.status(502).json({ error: "bad_gateway", message: "Upstream service did not respond." });
      },
    },
  })(req, res, next);
});

export default router;
