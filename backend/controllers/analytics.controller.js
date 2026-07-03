import RequestLog from "../models/RequestLog.js";

function since(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

/** Top-level dashboard stat cards. */
export async function getSummary(req, res) {
  const from = since(24);

  const [totals, activeClients] = await Promise.all([
    RequestLog.aggregate([
      { $match: { timestamp: { $gte: from } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          allowed: { $sum: { $cond: [{ $eq: ["$status", "allowed"] }, 1, 0] } },
          blocked: { $sum: { $cond: [{ $eq: ["$status", "blocked"] }, 1, 0] } },
          avgLatency: { $avg: "$responseTimeMs" },
        },
      },
    ]),
    RequestLog.distinct("clientId", { timestamp: { $gte: from } }),
  ]);

  const t = totals[0] || { total: 0, allowed: 0, blocked: 0, avgLatency: 0 };

  res.json({
    totalRequests: t.total,
    allowedRequests: t.allowed,
    blockedRequests: t.blocked,
    activeClients: activeClients.length,
    avgLatencyMs: Math.round(t.avgLatency || 0),
    successRate: t.total ? +((t.allowed / t.total) * 100).toFixed(2) : 100,
    blockRate: t.total ? +((t.blocked / t.total) * 100).toFixed(2) : 0,
    requestsPerSecond: +(t.total / (24 * 60 * 60)).toFixed(3),
    windowHours: 24,
  });
}

/** Time-series for line/area charts: requests per hour bucket, allowed vs blocked. */
export async function getTimeseries(req, res) {
  const hours = Math.min(Number(req.query.hours) || 24, 168);
  const from = since(hours);

  const rows = await RequestLog.aggregate([
    { $match: { timestamp: { $gte: from } } },
    {
      $group: {
        _id: {
          bucket: { $dateTrunc: { date: "$timestamp", unit: "hour" } },
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.bucket": 1 } },
  ]);

  const buckets = {};
  for (const row of rows) {
    const key = row._id.bucket.toISOString();
    buckets[key] = buckets[key] || { timestamp: key, allowed: 0, blocked: 0 };
    buckets[key][row._id.status] = row.count;
  }

  res.json({ series: Object.values(buckets) });
}

/** Pie chart: requests split by algorithm. */
export async function getAlgorithmUsage(req, res) {
  const rows = await RequestLog.aggregate([
    { $group: { _id: "$algorithm", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  res.json({ usage: rows.map((r) => ({ algorithm: r._id, count: r.count })) });
}

/** Top clients by request volume, and separately the most-blocked clients. */
export async function getTopClients(req, res) {
  const from = since(24);

  const [top, mostBlocked] = await Promise.all([
    RequestLog.aggregate([
      { $match: { timestamp: { $gte: from } } },
      { $group: { _id: "$clientId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    RequestLog.aggregate([
      { $match: { timestamp: { $gte: from }, status: "blocked" } },
      { $group: { _id: "$clientId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  res.json({
    topClients: top.map((r) => ({ clientId: r._id, requests: r.count })),
    mostBlocked: mostBlocked.map((r) => ({ clientId: r._id, blocked: r.count })),
  });
}

/** Most requested endpoints. */
export async function getTopEndpoints(req, res) {
  const from = since(24);
  const rows = await RequestLog.aggregate([
    { $match: { timestamp: { $gte: from } } },
    { $group: { _id: "$endpoint", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
  res.json({ endpoints: rows.map((r) => ({ endpoint: r._id, requests: r.count })) });
}

/** Paginated, filterable request log list. */
export async function listRequestLogs(req, res) {
  const { clientId, endpoint, status, algorithm, tenantId, page = 1, limit = 50 } = req.query;

  const filter = {};
  if (clientId) filter.clientId = clientId;
  if (endpoint) filter.endpoint = new RegExp(endpoint, "i");
  if (status) filter.status = status;
  if (algorithm) filter.algorithm = algorithm;
  if (tenantId) filter.tenantId = tenantId;

  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(200, Number(limit));

  const [logs, total] = await Promise.all([
    RequestLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    RequestLog.countDocuments(filter),
  ]);

  res.json({ logs, total, page: pageNum, pageSize });
}
