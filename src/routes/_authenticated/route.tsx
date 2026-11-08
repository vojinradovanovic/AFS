import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Activity, Search, Wrench, LayoutGrid, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const nav = [
  { to: "/overview", label: "Overview", code: "00", icon: LayoutGrid },
  { to: "/paperwork", label: "Paperwork", code: "U1", icon: ClipboardList },
  { to: "/machines", label: "Live machine data", code: "U2", icon: Activity },
  { to: "/search", label: "AI search", code: "U4", icon: Search },
  { to: "/maintenance", label: "Predictive maintenance", code: "U12", icon: Wrench },
] as const;

function Shell() {
  const { user } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid size-8 place-items-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">A</div>
          <div>
            <div className="font-display text-base font-semibold leading-none">AFS</div>
            <div className="tag mt-1">AI Factory System</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <n.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1">{n.label}</span>
                <span className="num text-[10px] text-muted-foreground">{n.code}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="truncate px-2 text-xs text-muted-foreground">{user.email}</div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
