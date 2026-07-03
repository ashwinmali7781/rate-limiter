import { NavLink, Outlet } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { LayoutDashboard, ListTree, Gauge, ScrollText, KeyRound } from "lucide-react";
import clsx from "clsx";
import { useMe } from "../hooks/useMe";
import { Pill } from "./ui/Pill";

const adminNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/rules", label: "Rules", icon: ListTree },
  { to: "/logs", label: "Logs", icon: ScrollText },
];

const commonNavItems = [{ to: "/keys", label: "API Keys", icon: KeyRound }];

export function AppShell() {
  const me = useMe();
  const isAdmin = me.data?.role === "admin";
  const navItems = isAdmin ? [...adminNavItems, ...commonNavItems] : commonNavItems;

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-base-700/60 flex flex-col p-5">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center">
            <Gauge className="h-4 w-4 text-accent" />
          </div>
          <span className="font-display font-semibold text-lg tracking-tight">Throttle</span>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-accent/10 text-accent" : "text-slate-400 hover:text-slate-100 hover:bg-base-800"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-5 border-t border-base-700/60 flex items-center gap-2">
          <UserButton afterSignOutUrl="/" />
          {!me.isLoading && (
            <Pill tone={isAdmin ? "accent" : "slate"}>{isAdmin ? "admin" : "member"}</Pill>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-8">
        <Outlet />
      </main>
    </div>
  );
}
