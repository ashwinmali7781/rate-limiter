import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { api } from "../lib/api";
import { StatCard } from "../components/ui/StatCard";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Pill";
import { LiveFeed } from "../components/LiveFeed";
import { useLiveFeed } from "../hooks/useLiveFeed";

const PIE_COLORS = ["#6ee7c8", "#f5a35c", "#7dd3fc", "#f0665f"];

function useDashboardData() {
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => api.get("/analytics/summary").then((r) => r.data), refetchInterval: 10000 });
  const timeseries = useQuery({ queryKey: ["timeseries"], queryFn: () => api.get("/analytics/timeseries?hours=24").then((r) => r.data), refetchInterval: 15000 });
  const algoUsage = useQuery({ queryKey: ["algo-usage"], queryFn: () => api.get("/analytics/algorithm-usage").then((r) => r.data), refetchInterval: 20000 });
  const topClients = useQuery({ queryKey: ["top-clients"], queryFn: () => api.get("/analytics/top-clients").then((r) => r.data), refetchInterval: 20000 });
  const topEndpoints = useQuery({ queryKey: ["top-endpoints"], queryFn: () => api.get("/analytics/top-endpoints").then((r) => r.data), refetchInterval: 20000 });
  return { summary, timeseries, algoUsage, topClients, topEndpoints };
}

/**
 * Layers live socket events on top of the last polled summary so stat cards
 * update the instant a request happens, instead of waiting up to 10s for the
 * next poll. Resets to zero every time a fresh summary poll lands (since
 * that poll's numbers already include everything up to that point).
 */
function useLiveDelta(events, summaryUpdatedAt) {
  const [delta, setDelta] = useState({ total: 0, allowed: 0, blocked: 0 });

  useEffect(() => {
    setDelta({ total: 0, allowed: 0, blocked: 0 });
  }, [summaryUpdatedAt]);

  useEffect(() => {
    const latest = events[0];
    if (!latest || latest.timestamp <= summaryUpdatedAt) return;
    setDelta((d) => ({
      total: d.total + 1,
      allowed: d.allowed + (latest.status === "allowed" ? 1 : 0),
      blocked: d.blocked + (latest.status === "blocked" ? 1 : 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  return delta;
}

export function Dashboard() {
  const { summary, timeseries, algoUsage, topClients, topEndpoints } = useDashboardData();
  const { events, connected } = useLiveFeed();
  const delta = useLiveDelta(events, summary.dataUpdatedAt);

  const base = summary.data;
  const hasSummary = typeof base?.totalRequests === "number";

  // Merge polled summary with the live delta for display.
  const s = hasSummary
    ? {
        totalRequests: base.totalRequests + delta.total,
        allowedRequests: base.allowedRequests + delta.allowed,
        blockedRequests: base.blockedRequests + delta.blocked,
        activeClients: base.activeClients,
        avgLatencyMs: base.avgLatencyMs,
        requestsPerSecond: base.requestsPerSecond,
        successRate: (() => {
          const total = base.totalRequests + delta.total;
          const allowed = base.allowedRequests + delta.allowed;
          return total ? +((allowed / total) * 100).toFixed(2) : 100;
        })(),
        blockRate: (() => {
          const total = base.totalRequests + delta.total;
          const blocked = base.blockedRequests + delta.blocked;
          return total ? +((blocked / total) * 100).toFixed(2) : 0;
        })(),
      }
    : null;

  const series = timeseries.data?.series ?? [];
  const usage = algoUsage.data?.usage ?? [];
  const clientsList = topClients.data?.topClients ?? [];
  const endpointsList = topEndpoints.data?.endpoints ?? [];

  const anyError = summary.isError || timeseries.isError || algoUsage.isError || topClients.isError || topEndpoints.isError;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Traffic and enforcement over the last 24 hours.</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-accent animate-pulse" : "bg-slate-600"}`} />
          {connected ? "live" : "reconnecting…"}
        </span>
      </div>

      {anyError && (
        <div className="card p-4 text-sm text-danger border-danger/30">
          Couldn't load analytics — make sure the backend is running, you're signed in, and your account has the admin role.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.isLoading || !s ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="Total requests" value={s.totalRequests.toLocaleString()} sublabel={`${s.requestsPerSecond} req/s avg`} tone="accent" fillPct={100} />
            <StatCard label="Allowed" value={s.allowedRequests.toLocaleString()} sublabel={`${s.successRate}% success rate`} tone="accent" fillPct={s.successRate} />
            <StatCard label="Blocked" value={s.blockedRequests.toLocaleString()} sublabel={`${s.blockRate}% block rate`} tone="danger" fillPct={Math.max(6, s.blockRate)} />
            <StatCard label="Active clients" value={s.activeClients.toLocaleString()} sublabel={`${s.avgLatencyMs}ms avg latency`} tone="slate" fillPct={70} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="stat-label mb-4">Traffic — allowed vs blocked</div>
          {timeseries.isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="allowedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6ee7c8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6ee7c8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="blockedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f0665f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f0665f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#242833" vertical={false} />
                <XAxis dataKey="timestamp" tickFormatter={(v) => new Date(v).getHours() + "h"} stroke="#5b6472" fontSize={11} />
                <YAxis stroke="#5b6472" fontSize={11} />
                <Tooltip contentStyle={{ background: "#12141b", border: "1px solid #242833", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="allowed" stroke="#6ee7c8" fill="url(#allowedFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="blocked" stroke="#f0665f" fill="url(#blockedFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div className="stat-label mb-4">Algorithm usage</div>
          {algoUsage.isLoading ? (
            <Skeleton className="h-64" />
          ) : usage.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">No traffic yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={usage} dataKey="count" nameKey="algorithm" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {usage.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#12141b", border: "1px solid #242833", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiveFeed events={events} connected={connected} />

        <div className="flex flex-col gap-6">
          <Card>
            <div className="stat-label mb-3">Top clients</div>
            <ul className="flex flex-col gap-2 text-sm">
              {clientsList.length === 0 && <li className="text-xs text-slate-500">No data yet.</li>}
              {clientsList.slice(0, 6).map((c) => (
                <li key={c.clientId} className="flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-300 truncate max-w-[70%]">{c.clientId}</span>
                  <span className="text-slate-500">{c.requests}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="stat-label mb-3">Top endpoints</div>
            <ul className="flex flex-col gap-2 text-sm">
              {endpointsList.length === 0 && <li className="text-xs text-slate-500">No data yet.</li>}
              {endpointsList.slice(0, 6).map((e) => (
                <li key={e.endpoint} className="flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-300 truncate max-w-[70%]">{e.endpoint}</span>
                  <span className="text-slate-500">{e.requests}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
