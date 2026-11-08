import { createFileRoute, Link, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { ClipboardList, Activity, Search, Wrench, LayoutGrid, LogOut, Users, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { accessQuery } from "@/lib/queries";
import { visibleNavigation, type PlantRole } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { invite: undefined } });
    return { user: data.user };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(accessQuery),
  component: Shell,
});

const nav = [
  { to: "/overview", label: "Overview", icon: LayoutGrid },
  { to: "/paperwork", label: "Paperwork", icon: ClipboardList },
  { to: "/machines", label: "Live machine data", icon: Activity },
  { to: "/search", label: "AI search", icon: Search },
  { to: "/savings", label: "Savings", icon: TrendingUp },
  { to: "/maintenance", label: "Predictive maintenance", icon: Wrench },
  { to: "/team", label: "Team", icon: Users },
] as const;

function Shell() {
  const { user } = Route.useRouteContext();
  const { data: access } = useSuspenseQuery(accessQuery);
  const role = access.role as PlantRole;
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", search: { invite: undefined }, replace: true });
  }
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
          {nav.filter((n) => visibleNavigation(role).includes(n.to)).map((n) => {
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
                <span className="flex-1">{n.to === "/overview" && role === "machine_operator" ? "My station" : n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="px-2 pb-2 text-xs font-medium">{role === "production_manager" ? "Production manager" : "Machine operator"}</div>
          <div className="truncate px-2 text-xs text-muted-foreground">{user.email}</div>
          <Button variant="ghost"
            onClick={signOut}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
