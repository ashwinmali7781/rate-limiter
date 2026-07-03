import clsx from "clsx";

export function Pill({ tone = "accent", children }) {
  const toneClasses = {
    accent: "bg-accent/15 text-accent",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    slate: "bg-slate-500/15 text-slate-300",
  };
  return <span className={clsx("pill", toneClasses[tone])}>{children}</span>;
}

export function Skeleton({ className }) {
  return <div className={clsx("animate-pulse rounded-md bg-base-700/60", className)} />;
}
