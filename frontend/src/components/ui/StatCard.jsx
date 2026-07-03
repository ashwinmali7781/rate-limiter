import { Card } from "./Card";
import clsx from "clsx";

/**
 * The dashboard's signature element: every top-line number sits on a thin
 * horizontal "throttle gauge" rather than a bare number, so the same visual
 * language reads as a valve/flow indicator - fitting for a rate limiter.
 */
export function StatCard({ label, value, sublabel, tone = "accent", fillPct = 60 }) {
  const toneClasses = {
    accent: "bg-accent",
    warn: "bg-warn",
    danger: "bg-danger",
    slate: "bg-slate-400",
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="stat-label">{label}</div>
      <div className="font-display text-3xl font-semibold tabular-nums">{value}</div>
      <div className="h-1 w-full rounded-full bg-base-700 overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all", toneClasses[tone])}
          style={{ width: `${Math.min(100, Math.max(4, fillPct))}%` }}
        />
      </div>
      {sublabel && <div className="text-xs text-slate-500 font-mono">{sublabel}</div>}
    </Card>
  );
}
