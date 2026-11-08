import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Unlock, Plus, Wrench, AlertOctagon, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { eventsQuery, machinesQuery, type MaintEvent } from "@/lib/queries";
import { failureRisk, hoursToPm, riskLevel } from "@/lib/rules";
import { PageHeader, Stat, StatusDot, headMeta } from "@/components/afs/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/maintenance")({
  head: () => headMeta("Predictive maintenance", "Machine memories with history, criticality, live status and protected PM windows."),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(machinesQuery), context.queryClient.ensureQueryData(eventsQuery)]),
  component: Maintenance,
});

const KIND = { pm_window: "PM window", repair: "Repair", failure: "Failure" } as const;

function Maintenance() {
  const { data: machines } = useSuspenseQuery(machinesQuery);
  const { data: events } = useSuspenseQuery(eventsQuery);
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ machineId: string; kind: keyof typeof KIND } | null>(null);
  const [move, setMove] = useState<MaintEvent | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["events"] }); qc.invalidateQueries({ queryKey: ["machines"] }); };

  const rows = machines
    .map((m) => {
      const failures = events.filter((e) => e.machine_id === m.id && e.kind === "failure").length;
      const risk = failureRisk({ ...m, recent_failures: failures });
      return { m, risk, failures, toPm: hoursToPm(m), next: events.find((e) => e.machine_id === m.id && e.kind === "pm_window" && new Date(e.ends_at) > new Date()) };
    })
    .sort((a, b) => b.risk - a.risk);
  const upcoming = events.filter((e) => new Date(e.ends_at) > new Date());
  const history = events.filter((e) => new Date(e.ends_at) <= new Date()).reverse();

  const pmDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("machines").update({ hours_since_pm: 0 }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("PM recorded — hours reset"); },
  });
  const toggleLock = useMutation({
    mutationFn: async (e: MaintEvent) => {
      const { error } = await supabase.from("maintenance_events").update({ protected: !e.protected }).eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (e: MaintEvent) => {
      if (e.protected) throw new Error("Unlock this protected window before removing it.");
      const { error } = await supabase.from("maintenance_events").delete().eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const name = (id: string) => machines.find((m) => m.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader title="Predictive maintenance" desc="Failure risk from PM hours, criticality, status and failure history. Protected PM windows can't be bulldozed for one more run." />
      <div className="grid grid-cols-4 gap-4 px-8 py-6">
        <Stat label="High risk" value={rows.filter((r) => riskLevel(r.risk) === "high").length} tone="bad" />
        <Stat label="Watch" value={rows.filter((r) => riskLevel(r.risk) === "watch").length} tone="warn" />
        <Stat label="PM overdue" value={rows.filter((r) => r.toPm < 0).length} tone="bad" />
        <Stat label="Protected windows" value={upcoming.filter((e) => e.protected).length} />
      </div>
      <div className="px-8">
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/50 text-left">
              <tr className="tag">{["Machine", "Criticality", "Hours to PM", "Failures", "Next PM", "Risk", ""].map((h) => <th key={h} className="px-4 py-2.5 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ m, risk, failures, toPm, next }) => {
                const lvl = riskLevel(risk);
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><StatusDot status={m.status} />{m.name}</div><div className="tag mt-0.5">{m.line}</div></td>
                    <td className="num px-4">{"●".repeat(m.criticality)}<span className="text-muted">{"●".repeat(5 - m.criticality)}</span></td>
                    <td className={cn("num px-4", toPm < 0 ? "text-destructive" : toPm < 50 ? "text-warning" : "")}>{toPm < 0 ? `${-toPm} h overdue` : `${toPm} h`}</td>
                    <td className="num px-4">{failures}</td>
                    <td className="num px-4 text-xs text-muted-foreground">{next ? new Date(next.starts_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td className="px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full", lvl === "high" ? "bg-destructive" : lvl === "watch" ? "bg-warning" : "bg-success")} style={{ width: `${risk}%` }} /></div>
                        <span className="num w-8">{risk}</span>
                      </div>
                    </td>
                    <td className="px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ machineId: m.id, kind: "pm_window" })}><Plus className="size-3.5" /> PM</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ machineId: m.id, kind: "failure" })}><AlertOctagon className="size-3.5" /> Failure</Button>
                        <Button size="sm" variant="ghost" onClick={() => pmDone.mutate(m.id)}><Wrench className="size-3.5" /> PM done</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 px-8 py-6">
        <EventList title="Upcoming" events={upcoming} name={name} onLock={(e) => toggleLock.mutate(e)} onMove={setMove} onDelete={(e) => remove.mutate(e)} />
        <EventList title="Machine memory · history" events={history} name={name} />
      </div>
      {dialog && <EventDialog {...dialog} machineName={name(dialog.machineId)} onClose={() => setDialog(null)} onSaved={refresh} />}
      {move && <MoveDialog e={move} onClose={() => setMove(null)} onSaved={refresh} />}
    </div>
  );
}

function EventList({ title, events, name, onLock, onMove, onDelete }: { title: string; events: MaintEvent[]; name: (id: string) => string; onLock?: (e: MaintEvent) => void; onMove?: (e: MaintEvent) => void; onDelete?: (e: MaintEvent) => void }) {
  return (
    <section className="panel">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</h2>
      <ul className="divide-y divide-border">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className={cn("tag w-20", e.kind === "failure" && "text-destructive", e.kind === "pm_window" && "text-primary")}>{KIND[e.kind as keyof typeof KIND]}</span>
            <div className="flex-1">
              <div>{e.title}</div>
              <div className="num text-xs text-muted-foreground">{name(e.machine_id)} · {new Date(e.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} → {new Date(e.ends_at).toLocaleTimeString([], { timeStyle: "short" })}</div>
            </div>
            {onLock && (
              <>
                <button aria-label={e.protected ? "Unlock window" : "Protect window"} onClick={() => onLock(e)} className={cn("rounded p-1.5 hover:bg-accent", e.protected ? "text-primary" : "text-muted-foreground")}>{e.protected ? <Lock className="size-4" /> : <Unlock className="size-4" />}</button>
                <Button size="sm" variant="ghost" disabled={e.protected} onClick={() => onMove?.(e)} title={e.protected ? "Protected — unlock to move" : ""}>Move</Button>
                <button aria-label="Remove" onClick={() => onDelete?.(e)} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"><Trash2 className="size-4" /></button>
              </>
            )}
          </li>
        ))}
        {!events.length && <li className="px-4 py-6 text-sm text-muted-foreground">Nothing here yet.</li>}
      </ul>
    </section>
  );
}

const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function EventDialog({ machineId, kind, machineName, onClose, onSaved }: { machineId: string; kind: keyof typeof KIND; machineName: string; onClose: () => void; onSaved: () => void }) {
  const start = kind === "failure" ? new Date() : new Date(Date.now() + 86400000);
  const [f, setF] = useState({ title: kind === "failure" ? `${machineName} unplanned stop` : `${machineName} PM`, starts: toLocal(start), hours: kind === "failure" ? "1" : "4", notes: "", protected: kind === "pm_window" });
  const save = useMutation({
    mutationFn: async () => {
      const s = new Date(f.starts);
      const { error } = await supabase.from("maintenance_events").insert({
        machine_id: machineId, kind, title: f.title, starts_at: s.toISOString(), ends_at: new Date(s.getTime() + Number(f.hours) * 3600000).toISOString(), protected: f.protected, notes: f.notes || null,
      });
      if (error) throw error;
      if (kind === "failure") await supabase.from("machines").update({ status: "down" }).eq("id", machineId);
    },
    onSuccess: () => { onSaved(); onClose(); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{kind === "failure" ? "Log failure" : "Schedule PM window"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Start</Label><Input type="datetime-local" value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Duration (hours)</Label><Input type="number" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          {kind === "pm_window" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={f.protected} onChange={(e) => setF({ ...f, protected: e.target.checked })} /> Protect this window (must be unlocked before it can move)</label>}
        </div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ e, onClose, onSaved }: { e: MaintEvent; onClose: () => void; onSaved: () => void }) {
  const dur = new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime();
  const [starts, setStarts] = useState(toLocal(new Date(e.starts_at)));
  const save = useMutation({
    mutationFn: async () => {
      const s = new Date(starts);
      const { error } = await supabase.from("maintenance_events").update({ starts_at: s.toISOString(), ends_at: new Date(s.getTime() + dur).toISOString() }).eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => { onSaved(); onClose(); },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Move “{e.title}”</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label>New start</Label><Input type="datetime-local" value={starts} onChange={(ev) => setStarts(ev.target.value)} /></div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()}>Move</Button></div>
      </DialogContent>
    </Dialog>
  );
}
