import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { recordsQuery } from "@/lib/queries";
import { useState } from "react";
import { Loader2, Search as SearchIcon, Sparkles } from "lucide-react";
import { askPlant, type SearchResult } from "@/lib/ai.functions";
import { PageHeader, headMeta } from "@/components/afs/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => headMeta("AI search", "Ask anything about your plant and get answers in seconds, with sources shown."),
  validateSearch: (search: Record<string, unknown>) => ({ record: typeof search["record"] === "string" ? search["record"] : undefined }),
  loader: ({ context }) => context.queryClient.ensureQueryData(recordsQuery),
  component: SearchPage,
});

const EXAMPLES = [
  "Which weight checks failed today and on which line?",
  "Why is Line 3 losing output?",
  "Which machine is most likely to fail next?",
  "What changeover steps were skipped this week?",
];
const LINK = { machine: "/machines", record: "/paperwork", maintenance: "/maintenance" } as const;

function SearchPage() {
  const { data: records } = useSuspenseQuery(recordsQuery);
  const search = Route.useSearch();
  const [recordId, setRecordId] = useState(search.record ?? "");
  const ask = useServerFn(askPlant);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<(SearchResult & { q: string }) | null>(null);

  async function run(question: string) {
    if (question.trim().length < 2) return;
    setQ(question); setBusy(true); setRes(null);
    try {
      const r = await ask({ data: { question, recordId: recordId || undefined } });
      setRes({ ...r, q: question });
    } catch {
      setRes({ answer: "", sources: [], error: "Search failed. Please try again.", q: question });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Ask the plant" desc="Answers across paperwork, machine data and maintenance history — with the sources shown." />
      <div className="mx-auto max-w-3xl px-8 py-8">
        <select aria-label="Search paperwork" value={recordId} onChange={(e) => setRecordId(e.target.value)} className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">General plant data</option>{records.map((r) => <option key={r.id} value={r.id}>{r.title}{r.record_type === "spreadsheet" ? " · Excel" : ""}</option>)}</select>
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="panel glow flex items-center gap-2 p-2">
          <SearchIcon className="ml-2 size-5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Why did line 3 rework spike last week?" className="border-0 bg-transparent text-base focus-visible:ring-0" />
          <Button type="submit" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Ask"}</Button>
        </form>
        {!res && !busy && (
          <div className="mt-6 grid grid-cols-2 gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => run(e)} className="panel px-4 py-3 text-left text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground">{e}</button>
            ))}
          </div>
        )}
        {busy && <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Searching all plant data…</div>}
        {res && (
          <div className="panel mt-6 p-6">
            <div className="tag">Question</div>
            <div className="mt-1 text-sm">{res.q}</div>
            {res.error ? (
              <p className="mt-4 text-sm text-destructive">{res.error}</p>
            ) : (
              <>
                <div className="tag mt-5 flex items-center gap-1.5 text-primary"><Sparkles className="size-3" /> Answer</div>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{res.answer}</p>
                {res.sources.length > 0 && (
                  <>
                    <div className="tag mt-5">Sources</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {res.sources.map((s, i) => (
                        <Link key={i} to={LINK[s.kind]} className="rounded-md border border-border px-2.5 py-1 text-xs hover:border-primary/60">
                          <span className="num mr-1.5 text-primary">{s.kind}</span>{s.label}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
