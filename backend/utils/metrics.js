import client from "prom-client";

// Collects default Node.js process metrics (CPU, memory, event loop lag, etc.)
// under the "throttle_" prefix so they're easy to distinguish in Grafana.
client.collectDefaultMetrics({ prefix: "throttle_" });

export const register = client.register;

export const requestsTotal = new client.Counter({
  name: "throttle_requests_total",
  help: "Total number of rate-limited requests evaluated",
  labelNames: ["tenant", "algorithm", "status"],
});

export const requestDuration = new client.Histogram({
  name: "throttle_request_duration_ms",
  help: "Time taken to evaluate a rate limit decision, in milliseconds",
  labelNames: ["tenant", "algorithm", "status"],
  buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000],
});

export function recordRequestMetric({ tenantId, algorithm, status, durationMs }) {
  const labels = { tenant: tenantId, algorithm, status };
  requestsTotal.inc(labels);
  requestDuration.observe(labels, durationMs);
}
