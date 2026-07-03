import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "../lib/api";
import { Card } from "../components/ui/Card";
import { Pill, Skeleton } from "../components/ui/Pill";

const PAGE_SIZE = 25;

const emptyFilters = { clientId: "", endpoint: "", status: "", algorithm: "", tenantId: "" };

export function Logs() {
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    ...(filters.clientId && { clientId: filters.clientId }),
    ...(filters.endpoint && { endpoint: filters.endpoint }),
    ...(filters.status && { status: filters.status }),
    ...(filters.algorithm && { algorithm: filters.algorithm }),
    ...(filters.tenantId && { tenantId: filters.tenantId }),
  });

  const logs = useQuery({
    queryKey: ["logs", filters, page],
    queryFn: () => api.get(`/analytics/logs?${params.toString()}`).then((r) => r.data),
    keepPreviousData: true,
  });

  const rows = logs.data?.logs ?? [];
  const total = logs.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Request logs</h1>
        <p className="text-sm text-slate-500 mt-1">Every rate-limited request, filterable and searchable.</p>
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <FilterField label="Client">
          <input className="input" placeholder="IP, hash, user id…" value={filters.clientId} onChange={(e) => updateFilter("clientId", e.target.value)} />
        </FilterField>
        <FilterField label="Tenant">
          <input className="input" placeholder="default" value={filters.tenantId} onChange={(e) => updateFilter("tenantId", e.target.value)} />
        </FilterField>
        <FilterField label="Endpoint">
          <input className="input" placeholder="/api/demo/ping" value={filters.endpoint} onChange={(e) => updateFilter("endpoint", e.target.value)} />
        </FilterField>
        <FilterField label="Status">
          <select className="input" value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
            <option value="">Any</option>
            <option value="allowed">Allowed</option>
            <option value="blocked">Blocked</option>
          </select>
        </FilterField>
        <FilterField label="Algorithm">
          <select className="input" value={filters.algorithm} onChange={(e) => updateFilter("algorithm", e.target.value)}>
            <option value="">Any</option>
            <option value="fixed_window">Fixed Window</option>
            <option value="sliding_window_counter">Sliding Window Counter</option>
            <option value="token_bucket">Token Bucket</option>
            <option value="leaky_bucket">Leaky Bucket</option>
          </select>
        </FilterField>
        {(filters.clientId || filters.endpoint || filters.status || filters.algorithm || filters.tenantId) && (
          <button className="btn-ghost" onClick={() => { setFilters(emptyFilters); setPage(1); }}>
            Clear filters
          </button>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        {logs.isLoading ? (
          <div className="p-5"><Skeleton className="h-64" /></div>
        ) : logs.isError ? (
          <div className="p-8 text-center text-danger text-sm">Couldn't load logs.</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
            <Search className="h-5 w-5 text-slate-600" />
            No requests match these filters.
          </div>
        ) : (
          <>
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-left text-slate-500 border-b border-base-700/60 stat-label font-sans">
                  <th className="px-5 py-3 font-normal">Time</th>
                  <th className="px-5 py-3 font-normal">Tenant</th>
                  <th className="px-5 py-3 font-normal">Client</th>
                  <th className="px-5 py-3 font-normal">Endpoint</th>
                  <th className="px-5 py-3 font-normal">Algorithm</th>
                  <th className="px-5 py-3 font-normal">Status</th>
                  <th className="px-5 py-3 font-normal">Latency</th>
                  <th className="px-5 py-3 font-normal">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log._id} className="border-b border-base-800/80 last:border-0">
                    <td className="px-5 py-2.5 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="px-5 py-2.5 text-slate-500">{log.tenantId || "default"}</td>
                    <td className="px-5 py-2.5 text-slate-300 truncate max-w-[160px]">{log.clientId}</td>
                    <td className="px-5 py-2.5 text-slate-300">{log.endpoint}</td>
                    <td className="px-5 py-2.5 text-slate-500">{log.algorithm}</td>
                    <td className="px-5 py-2.5">
                      <Pill tone={log.status === "allowed" ? "accent" : "danger"}>{log.status}</Pill>
                    </td>
                    <td className="px-5 py-2.5 text-slate-400">{log.responseTimeMs}ms</td>
                    <td className="px-5 py-2.5 text-slate-400">{log.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-5 py-3 border-t border-base-700/60 font-sans text-xs text-slate-500">
              <span>{total.toLocaleString()} total requests</span>
              <div className="flex items-center gap-2">
                <button className="btn-ghost !px-2 !py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button className="btn-ghost !px-2 !py-1" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-slate-400 min-w-[160px]">
      {label}
      {children}
    </label>
  );
}
