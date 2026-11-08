import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Camera, CheckCircle2, Plus, Loader2, FileSpreadsheet, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { accessQuery, machinesQuery, recordsQuery, type PaperRecord } from "@/lib/queries";
import { flagBatchSheet, flagChangeover, flagWeightCheck } from "@/lib/rules";
import { extractPaper, type Extracted } from "@/lib/ai.functions";
import { PageHeader, Stat, headMeta } from "@/components/afs/page";
import { PaperworkPreview, WorkbookView } from "@/components/afs/paperwork-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { readSpreadsheet, type SpreadsheetData } from "@/lib/spreadsheets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/paperwork")({
  head: () => headMeta("Paperwork", "Digitize batch sheets, weight checks, changeovers and downtime logs with instant out-of-range flags."),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(recordsQuery), context.queryClient.ensureQueryData(machinesQuery)]),
  component: Paperwork,
});

type RType = "weight_check" | "batch_sheet" | "changeover" | "downtime";
const TYPES: { id: RType; label: string }[] = [
  { id: "weight_check", label: "Weight check" },
  { id: "batch_sheet", label: "Batch sheet" },
  { id: "changeover", label: "Changeover" },
  { id: "downtime", label: "Downtime log" },
];
const DEFAULT_STEPS = ["Line cleared", "Labels verified", "Date code set", "First-off approved"];

type Form = {
  type: RType; title: string; line: string; recorded_by: string;
  product: string; target: string; tolerance: string; samples: string;
  batch: string; mix_temp_c: string; target_temp_c: string; temp_tol: string;
  steps: { step: string; done: boolean }[]; from: string; to: string;
  machine: string; reason: string; minutes: string;
};
const empty = (type: RType = "weight_check"): Form => ({
  type, title: "", line: "Line 1", recorded_by: "", product: "", target: "340", tolerance: "5", samples: "",
  batch: "", mix_temp_c: "", target_temp_c: "70", temp_tol: "3", steps: DEFAULT_STEPS.map((s) => ({ step: s, done: false })),
  from: "", to: "", machine: "", reason: "", minutes: "",
});

function build(f: Form) {
  const num = (s: string) => Number(s);
  switch (f.type) {
    case "weight_check": {
      const samples = f.samples.split(/[\s,;]+/).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
      const data = { product: f.product, target: num(f.target), tolerance: num(f.tolerance), samples };
      return { data, flags: flagWeightCheck(data) };
    }
    case "batch_sheet": {
      const data = { batch: f.batch, product: f.product, mix_temp_c: num(f.mix_temp_c), target_temp_c: num(f.target_temp_c), tolerance: num(f.temp_tol) };
      return { data, flags: f.mix_temp_c ? flagBatchSheet(data) : [] };
    }
    case "changeover": {
      const checklist = Object.fromEntries(f.steps.map((s) => [s.step, s.done]));
      return { data: { from: f.from, to: f.to, checklist, minutes: num(f.minutes) || null }, flags: flagChangeover(checklist) };
    }
    case "downtime":
      return { data: { machine: f.machine, reason: f.reason, minutes: num(f.minutes) || null }, flags: [] as string[] };
  }
}

function fromExtracted(x: Extracted): Form {
  const f = empty(x.record_type);
  return {
    ...f, title: x.title, line: x.line || f.line, recorded_by: x.recorded_by ?? "", product: x.product ?? "",
    target: x.target?.toString() ?? f.target, tolerance: x.tolerance?.toString() ?? f.tolerance, samples: x.samples.join(", "),
    batch: x.batch ?? "", mix_temp_c: x.mix_temp_c?.toString() ?? "", target_temp_c: x.target_temp_c?.toString() ?? f.target_temp_c,
    steps: x.checklist.length ? x.checklist : f.steps, machine: x.machine ?? "", reason: x.reason ?? "", minutes: x.minutes?.toString() ?? "",
  };
}

function Paperwork() {
  const { data: access } = useSuspenseQuery(accessQuery);
  const { data: machines } = useSuspenseQuery(machinesQuery);
  const [machineId, setMachineId] = useState("");
  const machine = machines.find((m) => m.id === machineId);
  const [workbook, setWorkbook] = useState<SpreadsheetData | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<PaperRecord | null>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const { data: records } = useSuspenseQuery(recordsQuery);
  const [filter, setFilter] = useState<RType | "all" | "flagged" | "spreadsheet">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty());
  const [scanning, setScanning] = useState(false);
  const [source, setSource] = useState<"manual" | "scan">("manual");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const extract = useServerFn(extractPaper);

  const shown = records.filter((r) => filter === "all" || (filter === "flagged" ? r.flagged : r.record_type === filter));
  const preview = useMemo(() => build(form), [form]);

  const save = useMutation({
    mutationFn: async () => {
      if (access.role === "machine_operator" && !machine) throw new Error("Select an assigned machine first.");
      const { data, flags } = build(form);
      const { error } = await supabase.from("paper_records").insert({
        owner_id: access.plant_owner_id, machine_id: machine?.id ?? null,
        record_type: form.type, title: form.title || TYPES.find((t) => t.id === form.type)?.label || "Entry", line: machine?.line ?? form.line,
        recorded_by: form.recorded_by || null, data, flags, flagged: flags.length > 0, source,
      });
      if (error) throw error;
      return flags;
    },
    onSuccess: (flags) => {
      qc.invalidateQueries({ queryKey: ["records"] });
      setOpen(false);
      flags.length ? toast.warning(`Saved with ${flags.length} flag(s)`) : toast.success("Entry saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File) {
    if (file.size > 7_000_000) { toast.error("Photo is too large (max 7 MB)."); return; }
    setScanning(true);
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file);
    });
    const out = await extract({ data: { image: dataUrl } }).catch(() => ({ error: "Could not read the photo." }) as { error: string; result?: undefined });
    setScanning(false);
    if (!out.result) { toast.error(out.error ?? "Could not read the photo."); return; }
    setForm(fromExtracted(out.result)); setSource("scan"); setOpen(true);
    toast.success("Form read — review before saving");
  }

  async function importFile(file: File) {
    setImporting(true);
    try { setWorkbook(await readSpreadsheet(file)); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not read workbook"); }
    finally { setImporting(false); }
  }
  async function saveWorkbook() {
    if (!workbook) return;
    if (access.role === "machine_operator" && !machine) { toast.error("Select an assigned machine first."); return; }
    setImporting(true);
    try {
      const { error } = await supabase.from("paper_records").insert({
        owner_id: access.plant_owner_id, machine_id: machine?.id ?? null,
        line: machine?.line ?? "Plant", record_type: "spreadsheet", source: "excel",
        title: workbook.filename, data: JSON.parse(JSON.stringify(workbook)),
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["records"] });
      setWorkbook(null); toast.success("Excel paperwork saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); }
    finally { setImporting(false); }
  }
  const machineSelector = <select aria-label="Paperwork machine" value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
    <option value="">{access.role === "production_manager" ? "Plant-wide paperwork" : "Select assigned machine"}</option>
    {machines.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.line}</option>)}
  </select>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader
        title="Paperwork digitization"
        desc="Capture once at the station. Entries are checked against spec the moment they are written."
        actions={
          <div className="flex flex-wrap gap-2">
            <input ref={excelRef} aria-label="Excel workbook" type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
            <Button variant="outline" disabled={importing} onClick={() => excelRef.current?.click()}><FileSpreadsheet />{importing ? "Reading…" : "Upload Excel"}</Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={scanning}>
              {scanning ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} Scan paper form
            </Button>
            <Button onClick={() => { setForm(empty()); setSource("manual"); setOpen(true); }}><Plus className="size-4" /> New entry</Button>
          </div>
        }
      />
      <div className="grid grid-cols-4 gap-4 px-8 py-6">
        <Stat label="Entries" value={records.length} />
        <Stat label="Flagged" value={records.filter((r) => r.flagged).length} tone="warn" />
        <Stat label="From scans" value={records.filter((r) => r.source === "scan").length} />
        <Stat label="Today" value={records.filter((r) => new Date(r.recorded_at).toDateString() === new Date().toDateString()).length} />
      </div>
      <div className="flex gap-1 px-8">
        {(["all", "flagged", "spreadsheet", ...TYPES.map((t) => t.id)] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground", filter === f && "bg-secondary text-foreground")}>
            {f === "all" ? "All" : f === "flagged" ? "Flagged" : f === "spreadsheet" ? "Excel" : TYPES.find((t) => t.id === f)?.label}
          </button>
        ))}
      </div>
      <div className="px-8 py-4">
        <div className="panel divide-y divide-border">
          {shown.map((r) => <RecordRow key={r.id} r={r} onPreview={() => setPreviewRecord(r)} />)}
          {!shown.length && <div className="p-8 text-center text-sm text-muted-foreground">No entries yet.</div>}
        </div>
      </div>

      <PaperworkPreview record={previewRecord} onClose={() => setPreviewRecord(null)} />
      <Dialog open={!!workbook} onOpenChange={(o) => !o && setWorkbook(null)}>
        <DialogContent className="flex h-[85dvh] max-h-[85dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{workbook?.filename}</DialogTitle></DialogHeader>
          {machineSelector}
          {workbook && <WorkbookView key={workbook.filename} workbook={workbook} />}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setWorkbook(null)}>Cancel</Button><Button disabled={importing} onClick={saveWorkbook}>Save workbook</Button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{source === "scan" ? "Review scanned form" : "New entry"}</DialogTitle></DialogHeader>
          {machineSelector}
          <div className="flex gap-1">
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => set("type", t.id)} className={cn("rounded-md border border-border px-3 py-1.5 text-xs", form.type === t.id ? "border-primary text-primary" : "text-muted-foreground")}>{t.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Title"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Hourly check 10:00" /></Field>
            <Field label="Line"><Input value={form.line} onChange={(e) => set("line", e.target.value)} /></Field>
            <Field label="Recorded by"><Input value={form.recorded_by} onChange={(e) => set("recorded_by", e.target.value)} /></Field>
          </div>
          {form.type === "weight_check" && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Product"><Input value={form.product} onChange={(e) => set("product", e.target.value)} /></Field>
              <Field label="Target (g)"><Input type="number" value={form.target} onChange={(e) => set("target", e.target.value)} /></Field>
              <Field label="Tolerance ± (g)"><Input type="number" value={form.tolerance} onChange={(e) => set("tolerance", e.target.value)} /></Field>
              <div className="col-span-3"><Field label="Samples (g), comma separated"><Input className="num" value={form.samples} onChange={(e) => set("samples", e.target.value)} placeholder="341, 339, 342, 333, 340" /></Field></div>
            </div>
          )}
          {form.type === "batch_sheet" && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Batch no."><Input value={form.batch} onChange={(e) => set("batch", e.target.value)} /></Field>
              <Field label="Product"><Input value={form.product} onChange={(e) => set("product", e.target.value)} /></Field>
              <Field label="Mix temp (°C)"><Input type="number" value={form.mix_temp_c} onChange={(e) => set("mix_temp_c", e.target.value)} /></Field>
              <Field label="Target temp (°C)"><Input type="number" value={form.target_temp_c} onChange={(e) => set("target_temp_c", e.target.value)} /></Field>
              <Field label="Tolerance ± (°C)"><Input type="number" value={form.temp_tol} onChange={(e) => set("temp_tol", e.target.value)} /></Field>
            </div>
          )}
          {form.type === "changeover" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label="From"><Input value={form.from} onChange={(e) => set("from", e.target.value)} /></Field>
                <Field label="To"><Input value={form.to} onChange={(e) => set("to", e.target.value)} /></Field>
                <Field label="Minutes"><Input type="number" value={form.minutes} onChange={(e) => set("minutes", e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {form.steps.map((s, i) => (
                  <label key={s.step} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                    <input type="checkbox" className="accent-primary" checked={s.done} onChange={(e) => set("steps", form.steps.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
                    {s.step}
                  </label>
                ))}
              </div>
            </div>
          )}
          {form.type === "downtime" && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Machine"><Input value={form.machine} onChange={(e) => set("machine", e.target.value)} /></Field>
              <Field label="Reason"><Input value={form.reason} onChange={(e) => set("reason", e.target.value)} /></Field>
              <Field label="Minutes"><Input type="number" value={form.minutes} onChange={(e) => set("minutes", e.target.value)} /></Field>
            </div>
          )}
          <div className={cn("rounded-md border px-3 py-2 text-sm", preview.flags.length ? "border-warning/50 text-warning" : "border-success/40 text-success")}>
            {preview.flags.length ? (
              <div className="space-y-1">{preview.flags.map((f) => <div key={f} className="flex items-center gap-2"><AlertTriangle className="size-4" />{f}</div>)}</div>
            ) : (
              <div className="flex items-center gap-2"><CheckCircle2 className="size-4" /> Within spec</div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save entry</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function RecordRow({ r, onPreview }: { r: PaperRecord; onPreview: () => void }) {
  const d = r.data as { sheets?: { name: string; rows: string[][] }[]; product?: string; target?: number; tolerance?: number; samples?: number[]; batch?: string; mix_temp_c?: number; from?: string; to?: string; minutes?: number; machine?: string; reason?: string };
  const flags = r.flags as string[];
  const summary =
    r.record_type === "spreadsheet" ? `${d.sheets?.map((s) => `${s.name}: ${s.rows.length} rows`).join(" · ")}`
    : r.record_type === "weight_check" ? `${d.product ?? ""} · target ${d.target} ± ${d.tolerance} g · ${d.samples?.join(", ")}`
    : r.record_type === "batch_sheet" ? `${d.batch ?? ""} · ${d.product ?? ""} · mix ${d.mix_temp_c} °C`
    : r.record_type === "changeover" ? `${d.from ?? ""} → ${d.to ?? ""}${d.minutes ? ` · ${d.minutes} min` : ""}`
    : `${d.machine ?? ""} · ${d.reason ?? ""}${d.minutes ? ` · ${d.minutes} min` : ""}`;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3">
      <div>
        <div className="flex items-center gap-2 text-sm">
          {r.flagged ? <AlertTriangle className="size-4 text-warning" /> : <CheckCircle2 className="size-4 text-success" />}
          <span className="font-medium">{r.title}</span>
          <span className="tag">{r.record_type === "spreadsheet" ? "Excel" : TYPES.find((t) => t.id === r.record_type)?.label}</span>
          {r.source === "scan" && <span className="tag text-primary">scanned</span>}
        </div>
        <div className="num mt-1 text-xs text-muted-foreground">{summary}</div>
        {flags.length > 0 && <div className="mt-1 text-xs text-warning">{flags.join(" · ")}</div>}
      </div>
      <div className="text-right text-xs text-muted-foreground">
        <Button size="sm" variant="outline" className="mb-2 mr-2" onClick={onPreview}><Eye /> Preview</Button>
        {r.record_type === "spreadsheet" && <Button asChild size="sm" variant="outline" className="mb-2"><Link to="/search" search={{ record: r.id }}>Ask about file</Link></Button>}
        <div>{r.line}</div>
        <div className="num">{new Date(r.recorded_at).toLocaleString()}</div>
        <div>{r.recorded_by}</div>
      </div>
    </div>
  );
}
