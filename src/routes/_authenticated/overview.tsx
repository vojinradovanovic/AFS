import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { eventsQuery, machinesQuery, recordsQuery } from "@/lib/queries";
import { failureRisk, riskLevel } from "@/lib/rules";
import { PageHeader, Stat, StatusDot, headMeta } from "@/components/afs/page";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => headMeta("Overview", "Plant overview: flagged paperwork, machine status and maintenance risk."),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(machinesQuery), context.queryClient.ensureQueryData(recordsQuery), context.queryClient.ensureQueryData(eventsQuery)]),
  component: Overview,
});

function Overview() {
  const { data: machines } = useSuspenseQuery(machinesQuery);
  const { data: records } = useSuspenseQuery(recordsQuery);
  const { data: events } = useSuspenseQuery(eventsQuery);
  const flagged = records.filter((r) => r.flagged);
  const risks = machines.map((m) => ({
    m,
    risk: failureRisk({ ...m, recent_failures: events.filter((e) => e.machine_id === m.id && e.kind === "failure").length }),
  }));
  const high = risks.filter((r) => riskLevel(r.risk) === "high");

  return (
    <div>
      <PageHeader code="00 · Overview" title="Plant floor" desc="Everything the AI layer is watching, on one screen." />
      <div className="grid grid-cols-4 gap-4 px-8 py-6">
        <Stat label="Machines running" value={`${machines.filter((m) => m.status === "running").length}/${machines.length}`} tone="good" />
        <Stat label="Machines down" value={machines.filter((m) => m.status === "down").length} tone="bad" />
        <Stat label="Flagged entries" value={flagged.length} tone="warn" />
        <Stat label="High failure risk" value={high.length} tone={high.length ? "bad" : "good"} />
      </div>
      <div className="grid grid-cols-2 gap-4 px-8 pb-8">
        <section className="panel">
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Flagged paperwork</h2><Link to="/paperwork" className="tag flex items-center gap-1 hover:text-foreground">Open <ArrowRight className="size-3" /></Link></div>
          <ul className="divide-y divide-border">
            {flagged.slice(0, 6).map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex justify-between text-sm"><span>{r.title}</span><span className="tag">{r.line}</span></div>
                <div className="mt-1 text-xs text-warning">{(r.flags as string[]).join(" · ")}</div>
              </li>
            ))}
            {!flagged.length && <li className="px-4 py-6 text-sm text-muted-foreground">No flagged entries.</li>}
          </ul>
        </section>
        <section className="panel">
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Machines by risk</h2><Link to="/maintenance" className="tag flex items-center gap-1 hover:text-foreground">Open <ArrowRight className="size-3" /></Link></div>
          <ul className="divide-y divide-border">
            {risks.sort((a, b) => b.risk - a.risk).map(({ m, risk }) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <StatusDot status={m.status} />
                <span className="flex-1">{m.name}</span>
                <span className="tag">{m.line}</span>
                <span className={`num w-10 text-right ${riskLevel(risk) === "high" ? "text-destructive" : riskLevel(risk) === "watch" ? "text-warning" : "text-success"}`}>{risk}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
