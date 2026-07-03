import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Power, Pencil } from "lucide-react";
import { api } from "../lib/api";
import { Card } from "../components/ui/Card";
import { Pill, Skeleton } from "../components/ui/Pill";
import { useToast } from "../components/ui/Toast";

const ALGORITHMS = [
  { value: "fixed_window", label: "Fixed Window" },
  { value: "sliding_window_counter", label: "Sliding Window Counter" },
  { value: "token_bucket", label: "Token Bucket" },
  { value: "leaky_bucket", label: "Leaky Bucket" },
];

const IDENTIFIERS = [
  { value: "ip", label: "IP Address" },
  { value: "user_id", label: "User ID" },
  { value: "api_key", label: "API Key" },
  { value: "jwt", label: "JWT Token" },
];

const emptyForm = {
  tenantId: "default",
  name: "",
  endpointPattern: "/api/demo/*",
  identifierType: "ip",
  algorithm: "fixed_window",
  limit: 100,
  windowSeconds: 60,
  upstreamUrl: "",
};

export function Rules() {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creating, else editing this rule's _id

  const rules = useQuery({ queryKey: ["rules"], queryFn: () => api.get("/rules").then((r) => r.data.rules) });
  const ruleList = rules.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["rules"] });

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const createRule = useMutation({
    mutationFn: (payload) => api.post("/rules", payload),
    onSuccess: () => {
      invalidate();
      closeForm();
      toast("Rule created.");
    },
    onError: () => toast("Couldn't create rule — check the fields.", "danger"),
  });

  const updateRule = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/rules/${id}`, payload),
    onSuccess: () => {
      invalidate();
      closeForm();
      toast("Rule updated.");
    },
    onError: () => toast("Couldn't update rule — check the fields.", "danger"),
  });

  const toggleRule = useMutation({
    mutationFn: (id) => api.patch(`/rules/${id}/toggle`),
    onSuccess: invalidate,
  });

  const deleteRule = useMutation({
    mutationFn: (id) => api.delete(`/rules/${id}`),
    onSuccess: () => {
      invalidate();
      toast("Rule deleted.");
    },
  });

  const startEdit = (rule) => {
    setForm({
      tenantId: rule.tenantId || "default",
      name: rule.name,
      endpointPattern: rule.endpointPattern,
      identifierType: rule.identifierType,
      algorithm: rule.algorithm,
      limit: rule.limit,
      windowSeconds: rule.windowSeconds,
      upstreamUrl: rule.upstreamUrl || "",
    });
    setEditingId(rule._id);
    setShowForm(true);
  };

  const startCreate = () => {
    if (showForm && !editingId) {
      closeForm();
    } else {
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(true);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = { ...form, limit: Number(form.limit), windowSeconds: Number(form.windowSeconds) };
    if (editingId) {
      updateRule.mutate({ id: editingId, payload });
    } else {
      createRule.mutate(payload);
    }
  };

  const saving = createRule.isPending || updateRule.isPending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Rate limit rules</h1>
          <p className="text-sm text-slate-500 mt-1">Define which requests get throttled, and how.</p>
        </div>
        <button className="btn-primary" onClick={startCreate}>
          <Plus className="h-4 w-4" /> New rule
        </button>
      </div>

      {showForm && (
        <Card>
          <div className="stat-label mb-4">{editingId ? "Edit rule" : "New rule"}</div>
          <form className="grid grid-cols-2 md:grid-cols-3 gap-4" onSubmit={submit}>
            <Field label="Name">
              <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Public API default" />
            </Field>
            <Field label="Tenant ID">
              <input className="input" value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} placeholder="default" />
            </Field>
            <Field label="Endpoint pattern">
              <input required className="input" value={form.endpointPattern} onChange={(e) => setForm({ ...form, endpointPattern: e.target.value })} placeholder="/api/demo/*" />
            </Field>
            <Field label="Identify by">
              <select className="input" value={form.identifierType} onChange={(e) => setForm({ ...form, identifierType: e.target.value })}>
                {IDENTIFIERS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </Field>
            <Field label="Algorithm">
              <select className="input" value={form.algorithm} onChange={(e) => setForm({ ...form, algorithm: e.target.value })}>
                {ALGORITHMS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="Limit (requests)">
              <input required type="number" min="1" className="input" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} />
            </Field>
            <Field label="Window (seconds)">
              <input required type="number" min="1" className="input" value={form.windowSeconds} onChange={(e) => setForm({ ...form, windowSeconds: e.target.value })} />
            </Field>
            <Field label="Upstream URL (optional — API Gateway mode)">
              <input className="input" value={form.upstreamUrl} onChange={(e) => setForm({ ...form, upstreamUrl: e.target.value })} placeholder="https://internal-service.example.com" />
            </Field>
            <div className="col-span-full flex gap-3 pt-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create rule"}
              </button>
              <button type="button" className="btn-ghost" onClick={closeForm}>Cancel</button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {rules.isLoading ? (
          <div className="p-5"><Skeleton className="h-40" /></div>
        ) : rules.isError ? (
          <div className="p-8 text-center text-danger text-sm">
            Couldn't load rules — check that you're signed in with an admin role and the backend is reachable.
          </div>
        ) : ruleList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No rules yet. Traffic won't be limited until you create one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-base-700/60 stat-label">
                <th className="px-5 py-3 font-normal">Name</th>
                <th className="px-5 py-3 font-normal">Tenant</th>
                <th className="px-5 py-3 font-normal">Pattern</th>
                <th className="px-5 py-3 font-normal">Algorithm</th>
                <th className="px-5 py-3 font-normal">Limit</th>
                <th className="px-5 py-3 font-normal">Identify by</th>
                <th className="px-5 py-3 font-normal">Status</th>
                <th className="px-5 py-3 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ruleList.map((rule) => (
                <tr key={rule._id} className="border-b border-base-800/80 last:border-0">
                  <td className="px-5 py-3 font-medium">
                    <span className="mr-2">{rule.name}</span>
                    {rule.upstreamUrl && <Pill tone="slate">gateway</Pill>}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">{rule.tenantId || "default"}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">{rule.endpointPattern}</td>
                  <td className="px-5 py-3 text-slate-300">{ALGORITHMS.find((a) => a.value === rule.algorithm)?.label}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">{rule.limit} / {rule.windowSeconds}s</td>
                  <td className="px-5 py-3 text-slate-300">{IDENTIFIERS.find((i) => i.value === rule.identifierType)?.label}</td>
                  <td className="px-5 py-3">
                    <Pill tone={rule.enabled ? "accent" : "slate"}>{rule.enabled ? "enabled" : "disabled"}</Pill>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button className="btn-ghost !px-2 !py-1.5" onClick={() => startEdit(rule)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button className="btn-ghost !px-2 !py-1.5" onClick={() => toggleRule.mutate(rule._id)} title="Toggle enabled">
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button className="btn-ghost !px-2 !py-1.5 hover:!text-danger" onClick={() => deleteRule.mutate(rule._id)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-slate-400">
      {label}
      {children}
    </label>
  );
}
