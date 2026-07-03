import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Ban, KeyRound } from "lucide-react";
import { api } from "../lib/api";
import { Card } from "../components/ui/Card";
import { Pill, Skeleton } from "../components/ui/Pill";
import { CopyButton } from "../components/ui/CopyButton";
import { useToast } from "../components/ui/Toast";

export function ApiKeys() {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [freshKey, setFreshKey] = useState(null); // { rawKey, name } - shown once after creation

  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => api.get("/keys").then((r) => r.data.keys) });
  const keyList = keys.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["api-keys"] });

  const generate = useMutation({
    mutationFn: (payload) => api.post("/keys", payload).then((r) => r.data),
    onSuccess: (data) => {
      invalidate();
      setFreshKey({ rawKey: data.rawKey, name: data.key.name });
      setName("");
    },
    onError: () => toast("Couldn't generate a key.", "danger"),
  });

  const revoke = useMutation({
    mutationFn: (id) => api.post(`/keys/${id}/revoke`),
    onSuccess: () => {
      invalidate();
      toast("Key revoked.");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">API keys</h1>
          <p className="text-sm text-slate-500 mt-1">
            Use an API key as the identifier for rules with <span className="font-mono text-xs">Identify by: API Key</span>.
          </p>
        </div>
      </div>

      <Card>
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            generate.mutate({ name: name.trim() });
          }}
        >
          <div className="flex flex-col gap-1.5 flex-1 max-w-xs">
            <label className="text-xs text-slate-400">Key name</label>
            <input className="input" placeholder="Mobile app, CI pipeline…" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={generate.isPending || !name.trim()}>
            <Plus className="h-4 w-4" /> {generate.isPending ? "Generating…" : "Generate key"}
          </button>
        </form>

        {freshKey && (
          <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
            <div className="flex items-center gap-2 text-xs text-accent mb-2">
              <KeyRound className="h-3.5 w-3.5" />
              Copy this now — you won't be able to see it again.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-base-900 px-3 py-2 text-xs font-mono text-slate-200 truncate">{freshKey.rawKey}</code>
              <CopyButton value={freshKey.rawKey} />
              <button className="btn-ghost !px-2 !py-1.5" onClick={() => setFreshKey(null)}>Dismiss</button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        {keys.isLoading ? (
          <div className="p-5"><Skeleton className="h-32" /></div>
        ) : keys.isError ? (
          <div className="p-8 text-center text-danger text-sm">Couldn't load API keys.</div>
        ) : keyList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No API keys yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-base-700/60 stat-label">
                <th className="px-5 py-3 font-normal">Name</th>
                <th className="px-5 py-3 font-normal">Key</th>
                <th className="px-5 py-3 font-normal">Created</th>
                <th className="px-5 py-3 font-normal">Last used</th>
                <th className="px-5 py-3 font-normal">Status</th>
                <th className="px-5 py-3 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keyList.map((k) => (
                <tr key={k._id} className="border-b border-base-800/80 last:border-0">
                  <td className="px-5 py-3 font-medium">{k.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">{k.keyPrefix}…</td>
                  <td className="px-5 py-3 text-slate-400 text-xs font-mono">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs font-mono">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}</td>
                  <td className="px-5 py-3">
                    <Pill tone={k.revoked ? "danger" : "accent"}>{k.revoked ? "revoked" : "active"}</Pill>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!k.revoked && (
                      <button className="btn-ghost !px-2 !py-1.5 hover:!text-danger" onClick={() => revoke.mutate(k._id)} title="Revoke">
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
