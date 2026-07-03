import { AnimatePresence, motion } from "framer-motion";
import { Pill } from "./ui/Pill";

export function LiveFeed({ events, connected }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-base-700/60">
        <span className="stat-label">Live request feed</span>
        <span className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-accent" : "bg-slate-600"}`} />
          {connected ? "streaming" : "disconnected"}
        </span>
      </div>

      <div className="h-72 overflow-y-auto font-mono text-xs">
        {events.length === 0 && (
          <div className="p-5 text-slate-500">Waiting for traffic — hit a demo endpoint to see it here.</div>
        )}
        <AnimatePresence initial={false}>
          {events.map((e, i) => (
            <motion.div
              key={`${e.timestamp}-${i}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-5 py-2 border-b border-base-800/80"
            >
              <span className="text-slate-500 w-20 shrink-0">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
              <Pill tone={e.status === "allowed" ? "accent" : "danger"}>{e.status}</Pill>
              <span className="text-slate-300 truncate">{e.endpoint}</span>
              <span className="ml-auto text-slate-500 truncate max-w-[120px]">{e.clientId}</span>
              <span className="text-slate-600">{e.algorithm}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
