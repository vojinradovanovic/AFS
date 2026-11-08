import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { Plus, Radio } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { accessQuery, machinesQuery, type Machine } from "@/lib/queries";
import { history, readingAt } from "@/lib/telemetry";
import { PageHeader, Stat, StatusDot, headMeta } from "@/components/afs/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/machines")({
  head: () => headMeta("Live machine data", "Speeds, rejects, temperatures and OEE from every PLC, by line, in real time."),
  loader: ({ context }) => context.queryClient.ensureQueryData(machinesQuery),
  component: Machines,
});

function useNow(ms = 2000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return now;
}

const BRANDS = ["Allen-Bradley", "Siemens", "Omron", "Mitsubishi", "Mettler Toledo", "Other"];
const PROTOCOLS = ["OPC UA", "EtherNet/IP", "Modbus TCP", "PROFINET", "CC-Link", "MQTT"];

function Machines() {
  const { data: access } = useSuspenseQuery(accessQuery);
  const { data: machines } = useSuspenseQuery(machinesQuery);
  const now = useNow();
  const lines = [...new Set(machines.map((m) => m.line))];
  const [line, setLine] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const shown = machines.filter((m) => line === "all" || m.line === line);
  const live = shown.map((m) => ({ m, r: readingAt(m.id, Number(m.nominal_speed), m.status, now) }));
  const running = live.filter((x) => x.m.status === "running");
  const avgOee = running.length ? Math.round(running.reduce((a, x) => a + x.r.oee, 0) / running.length) : 0;

  return (
    <div>
      <PageHeader
        title="Live machine data"
        desc="Every PLC and sensor on one screen, grouped by line."
        actions={access.role === "production_manager" && <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Connect machine</Button>}
      />
      <div className="flex items-center gap-2 px-8 pt-6">
        <span className="tag flex items-center gap-1.5 rounded-md border border-border px-2 py-1"><Radio className="live-dot size-3 text-primary" /> Simulated feed · 2 s</span>
        <div className="ml-4 flex gap-1">
          {["all", ...lines].map((l) => (
            <button key={l} onClick={() => setLine(l)} className={cn("rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground", line === l && "bg-secondary text-foreground")}>{l === "all" ? "All lines" : l}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 px-8 py-6">
        <Stat label="Avg OEE (running)" value={`${avgOee}%`} tone={avgOee > 80 ? "good" : "warn"} />
        <Stat label="Units / min" value={live.reduce((a, x) => a + x.r.speed, 0)} />
        <Stat label="Rejects / min" value={live.reduce((a, x) => a + x.r.rejects, 0)} tone="warn" />
        <Stat label="Down" value={shown.filter((m) => m.status === "down").length} tone="bad" />
      </div>
      <div className="grid grid-cols-2 gap-4 px-8 pb-8 xl:grid-cols-3">
        {live.map(({ m, r }) => <MachineCard key={m.id} m={m} now={now} r={r} />)}
      </div>
      <ConnectDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function MachineCard({ m, now, r }: { m: Machine; now: number; r: ReturnType<typeof readingAt> }) {
  const qc = useQueryClient();
  const data = history(m.id, Number(m.nominal_speed), m.status, now);
  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.rpc("set_machine_status", { p_machine: m.id, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["machines"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2"><StatusDot status={m.status} /><span className="font-medium">{m.name}</span></div>
          <div className="tag mt-1">{m.line} · {m.brand} · {m.protocol}</div>
        </div>
        <select
          value={m.status}
          onChange={(e) => setStatus.mutate(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          aria-label="Machine status"
        >
          <option value="running">Running</option><option value="idle">Idle</option><option value="down">Down</option>
        </select>
      </div>
      <div className="mt-3 h-14">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <YAxis hide domain={[0, Number(m.nominal_speed) * 1.1]} />
            <Line type="monotone" dataKey="speed" stroke="var(--color-primary)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <Metric label="Speed" value={`${r.speed}`} unit={`/${m.nominal_speed}`} />
        <Metric label="Rejects" value={`${r.rejects}`} unit="/min" warn={r.rejects >= 3} />
        <Metric label="Temp" value={`${r.temp}`} unit="°C" />
        <Metric label="OEE" value={`${r.oee}`} unit="%" />
      </div>
    </div>
  );
}

function Metric({ label, value, unit, warn }: { label: string; value: string; unit: string; warn?: boolean }) {
  return (
    <div className="rounded-md bg-secondary px-2 py-2">
      <div className="tag text-[10px]">{label}</div>
      <div className={cn("num text-lg", warn && "text-warning")}>{value}<span className="text-xs text-muted-foreground">{unit}</span></div>
    </div>
  );
}

function ConnectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", line: "Line 1", brand: "Allen-Bradley", protocol: "OPC UA", nominal_speed: "100", criticality: "3", pm_interval_hours: "500" });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("machines").insert({
        name: f.name, line: f.line, brand: f.brand, protocol: f.protocol,
        nominal_speed: Number(f.nominal_speed), criticality: Number(f.criticality), pm_interval_hours: Number(f.pm_interval_hours),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["machines"] }); onOpenChange(false); toast.success("Machine connected"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const sel = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Connect a machine</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Case Packer CP-5" /></div>
          <div className="space-y-1.5"><Label>Line</Label><Input value={f.line} onChange={(e) => setF({ ...f, line: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Nominal speed / min</Label><Input type="number" value={f.nominal_speed} onChange={(e) => setF({ ...f, nominal_speed: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>PLC brand</Label><select className={sel} value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })}>{BRANDS.map((b) => <option key={b}>{b}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Protocol</Label><select className={sel} value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value })}>{PROTOCOLS.map((b) => <option key={b}>{b}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Criticality (1–5)</Label><Input type="number" min={1} max={5} value={f.criticality} onChange={(e) => setF({ ...f, criticality: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>PM interval (hours)</Label><Input type="number" value={f.pm_interval_hours} onChange={(e) => setF({ ...f, pm_interval_hours: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!f.name || save.isPending} onClick={() => save.mutate()}>Connect</Button></div>
      </DialogContent>
    </Dialog>
  );
}
