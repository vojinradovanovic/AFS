import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Maximize2, Minimize2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PaperRecord } from "@/lib/queries";
import type { SpreadsheetData } from "@/lib/spreadsheets";
import { detectHeaderRow } from "@/lib/spreadsheets";
import { cn } from "@/lib/utils";

function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

export function WorkbookView({ workbook }: { workbook: SpreadsheetData }) {
  const [sheetIndex, setSheetIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{ address: string; value: string } | null>(null);
  const [headerOverride, setHeaderOverride] = useState<string>("auto");
  const sheet = workbook.sheets[sheetIndex];
  const headerRow = headerOverride === "auto" ? (sheet ? detectHeaderRow(sheet) : null) : headerOverride === "none" ? null : Number(headerOverride);
  const rows = useMemo(() => (sheet?.rows ?? []).map((cells, index) => ({ cells, number: index + 1 }))
    .filter(({ cells, number }) => number - 1 !== headerRow && (!search.trim() || cells.some((cell) => cell.toLowerCase().includes(search.trim().toLowerCase())))), [sheet, search, headerRow]);
  const columns = Math.max(1, ...(sheet?.rows ?? []).map((row) => row.length));
  const pageCount = Math.max(1, Math.ceil(rows.length / 50));
  const activePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(activePage * 50, (activePage + 1) * 50);

  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative min-w-48 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input aria-label="Search workbook rows" placeholder="Search rows…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
      </div>
      <span className="text-sm text-muted-foreground">{sheet?.rows.length ?? 0} rows · {columns} columns</span>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">Column titles
        <select aria-label="Column title row" className="rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground" value={headerOverride} onChange={(e) => { setHeaderOverride(e.target.value); setPage(0); }}>
          <option value="auto">Auto{headerRow !== null && headerOverride === "auto" ? ` · Row ${headerRow + 1}` : ""}</option>
          <option value="none">No titles</option>
          {sheet?.rows.slice(0, 10).map((_, index) => <option key={index} value={index}>Row {index + 1}</option>)}
        </select>
      </label>
    </div>
    <div className="flex items-start gap-3 border border-border bg-secondary px-3 py-2 text-sm">
      <span className="num min-w-10 font-medium">{selected?.address ?? "—"}</span>
      <div className="max-h-24 min-w-0 overflow-auto whitespace-pre-wrap break-words">{selected?.value ?? ""}</div>
    </div>
    <div className="min-h-0 flex-1 overflow-auto border border-border">
      <table className="w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="sticky top-0 z-10"><tr><th className="sticky left-0 border-b border-r border-border bg-secondary px-3 py-2">#</th>{Array.from({ length: columns }, (_, index) => <th key={index} className="min-w-36 max-w-64 border-b border-r border-border bg-secondary px-3 py-2 text-left font-medium"><span className="block min-w-28 max-w-64 whitespace-normal break-words">{headerRow !== null ? sheet?.rows[headerRow]?.[index]?.trim() || columnName(index) : columnName(index)}</span></th>)}</tr></thead>
        <tbody>{visible.map((row) => <tr key={row.number}>
          <th className="sticky left-0 border-b border-r border-border bg-secondary px-3 py-2 font-normal text-muted-foreground">{row.number}</th>
          {Array.from({ length: columns }, (_, index) => {
            const address = `${columnName(index)}${row.number}`;
            const value = row.cells[index] ?? "";
            return <td key={index} className="border-b border-r border-border p-0"><Button variant="ghost" aria-label={`Cell ${address}: ${value || "empty"}`} className={cn("h-10 w-full justify-start rounded-none px-3 text-sm font-normal", selected?.address === address && "bg-accent ring-1 ring-inset ring-primary")} onClick={() => setSelected({ address, value })}><span className="block max-w-64 truncate">{value}</span></Button></td>;
          })}
        </tr>)}</tbody>
      </table>
      {!rows.length && <div className="p-8 text-center text-sm text-muted-foreground">No matching rows.</div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label="Workbook sheets">{workbook.sheets.map((s, index) => <Button key={s.name} role="tab" aria-selected={sheetIndex === index} variant={sheetIndex === index ? "secondary" : "ghost"} onClick={() => { setSheetIndex(index); setPage(0); setSelected(null); setHeaderOverride("auto"); }}>{s.name}</Button>)}</div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{rows.length ? `${activePage * 50 + 1}–${Math.min((activePage + 1) * 50, rows.length)} of ${rows.length}` : "0 rows"}</span>
        <Button size="icon-sm" variant="outline" aria-label="Previous rows" title="Previous rows" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}><ChevronLeft /></Button>
        <Button size="icon-sm" variant="outline" aria-label="Next rows" title="Next rows" disabled={activePage >= pageCount - 1} onClick={() => setPage(activePage + 1)}><ChevronRight /></Button>
      </div>
    </div>
  </div>;
}

const FIELD_LABELS: Record<string, string> = {
  product: "Product", target: "Target (g)", tolerance: "Tolerance ±", samples: "Samples (g)", batch: "Batch number",
  mix_temp_c: "Mix temperature (°C)", target_temp_c: "Target temperature (°C)", from: "From product", to: "To product",
  minutes: "Duration (minutes)", machine: "Machine", reason: "Reason", checklist: "Changeover checklist",
};

function RecordValue({ value }: { value: unknown }) {
  if (typeof value === "boolean") return <span className={cn("inline-flex items-center gap-2", value ? "text-success" : "text-warning")}>{value ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}{value ? "Complete" : "Not complete"}</span>;
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">Not recorded</span>;
  if (Array.isArray(value)) return <div className="flex flex-wrap gap-x-4 gap-y-2">{value.map((item, index) => <div key={index}><RecordValue value={item} /></div>)}</div>;
  if (typeof value === "object") return <dl className="divide-y divide-border">{Object.entries(value).map(([key, item]) => <div key={key} className="flex flex-wrap justify-between gap-3 py-2"><dt>{FIELD_LABELS[key] ?? key.replaceAll("_", " ")}</dt><dd><RecordValue value={item} /></dd></div>)}</dl>;
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

export function PaperworkPreview({ record, onClose }: { record: PaperRecord | null; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  if (!record) return null;
  const workbook = record.record_type === "spreadsheet" ? record.data as unknown as SpreadsheetData : null;
  const fields = record.data && typeof record.data === "object" && !Array.isArray(record.data) ? Object.entries(record.data) : [];
  const flags = Array.isArray(record.flags) ? record.flags.filter((flag): flag is string => typeof flag === "string") : [];
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className={cn("flex h-[85dvh] max-h-[85dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden", expanded && "h-[96dvh] max-h-[96dvh] max-w-[calc(100%-2rem)]")}>
      <DialogHeader className="pr-8">
        <div className="flex items-start justify-between gap-3"><DialogTitle className="break-words leading-6">{record.title}</DialogTitle><Button size="icon-sm" variant="ghost" aria-label={expanded ? "Reduce preview" : "Expand preview"} title={expanded ? "Reduce preview" : "Expand preview"} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 /> : <Maximize2 />}</Button></div>
        <DialogDescription>{record.line} · {new Date(record.recorded_at).toLocaleString()}{record.recorded_by ? ` · ${record.recorded_by}` : ""} · {record.source === "scan" ? "Scanned form" : workbook ? "Excel workbook" : "Recorded entry"}</DialogDescription>
      </DialogHeader>
      {workbook ? <WorkbookView key={record.id} workbook={workbook} /> : <div className="min-h-0 flex-1 overflow-auto">
        <dl className="divide-y divide-border">{fields.map(([key, value]) => <div key={key} className="grid gap-2 py-4 sm:grid-cols-[12rem_1fr]"><dt className="text-sm text-muted-foreground">{FIELD_LABELS[key] ?? key.replaceAll("_", " ")}</dt><dd className="min-w-0 text-sm"><RecordValue value={value} /></dd></div>)}</dl>
        {!!flags.length && <div className="mt-4 border-t border-border pt-4 text-sm text-warning">{flags.map((flag) => <p key={flag}>{flag}</p>)}</div>}
      </div>}
      <div className="flex justify-end gap-2 border-t border-border pt-3"><Button variant="ghost" onClick={onClose}>Close</Button><Button asChild><Link to="/search" search={{ record: record.id }}>Ask about file</Link></Button></div>
    </DialogContent>
  </Dialog>;
}