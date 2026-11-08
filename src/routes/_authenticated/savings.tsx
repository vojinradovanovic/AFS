import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock3, TrendingUp, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { accessQuery } from "@/lib/queries";
import { savingsQuery } from "@/lib/savings.queries";
import { DEFAULT_SAVINGS, calculateSavings, type SavingsAssumptions } from "@/lib/savings";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Stat, headMeta } from "@/components/afs/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
export const Route = createFileRoute("/_authenticated/savings")({
  head: () =>
    headMeta(
      "Savings",
      "Estimated time savings, labor value and net benefit from recorded AFS activity.",
    ),
  loader: ({ context }) => context.queryClient.ensureQueryData(savingsQuery),
  component: SavingsPage,
});
function SavingsPage() {
  const { data } = useSuspenseQuery(savingsQuery);
  const { data: access } = useSuspenseQuery(accessQuery);
  const manager = access.role === "production_manager";
  const qc = useQueryClient();
  const [period, setPeriod] = useState<"month" | "30days" | "all">("month");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const settings = { ...DEFAULT_SAVINGS, ...data.settings };
  const [draft, setDraft] = useState<SavingsAssumptions>(settings);
  const now = new Date();
  const first = data.activity[0]?.created_at;
  const start =
    period === "month"
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : period === "30days"
        ? new Date(now.getTime() - 30 * 86400000)
        : first
          ? new Date(first)
          : now;
  const result = calculateSavings(
    data.activity,
    manager ? settings : { ...settings, monthly_service_cost: 0 },
    start,
    now,
  );
  const money = (n: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency: settings.currency }).format(n);
  async function save() {
    setSaving(true);
    try {
      if (
        [
          draft.paperwork_minutes,
          draft.ai_minutes,
          draft.hourly_cost,
          draft.monthly_service_cost,
        ].some((n) => !Number.isFinite(n) || n < 0)
      )
        throw new Error("Enter valid non-negative values.");
      const { error } = await supabase
        .from("savings_settings")
        .upsert({ ...draft, plant_owner_id: access.plant_owner_id });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["savings"] });
      setOpen(false);
      toast.success("Savings assumptions saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save assumptions");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <PageHeader
        title="Savings"
        desc={
          manager ? "Estimated benefit across your plant" : "Estimated benefit from your activity"
        }
        actions={
          manager && (
            <Button
              variant="outline"
              onClick={() => {
                setDraft(settings);
                setOpen(true);
              }}
            >
              <Settings2 />
              Assumptions
            </Button>
          )
        }
      />
      <div className="flex items-center justify-between gap-4 px-8 pt-6">
        <div className="tag">Estimated · {manager ? "Plant activity" : "Your activity"}</div>
        <select
          aria-label="Savings period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as typeof period)}
          className="rounded-md border border-input bg-panel px-3 py-2 text-sm"
        >
          <option value="month">This month</option>
          <option value="30days">Last 30 days</option>
          <option value="all">Since tracking began</option>
        </select>
      </div>
      <div className="grid gap-4 px-8 py-6 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Time saved"
          value={
            <span>
              {result.hours.toFixed(1)} <span className="text-sm">hours</span>
            </span>
          }
        />
        <Stat label="Labor value" value={money(result.gross)} tone="good" />
        <Stat label="Service cost · prorated" value={money(result.cost)} />
        <Stat
          label="Estimated net benefit"
          value={money(result.net)}
          tone={result.net >= 0 ? "good" : "bad"}
        />
      </div>
      <section className="px-8 pb-8">
        <h2 className="mb-4 text-lg font-semibold">Where the savings come from</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="py-3">Activity</th>
                <th>Completed</th>
                <th>Minutes saved / action</th>
                <th>Time saved</th>
                <th>Labor value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-5">Paperwork saved</td>
                <td className="num">{result.paperwork}</td>
                <td className="num">{settings.paperwork_minutes}</td>
                <td className="num">{(result.paperworkMinutes / 60).toFixed(1)} h</td>
                <td className="num">
                  {money((result.paperworkMinutes / 60) * settings.hourly_cost)}
                </td>
              </tr>
              <tr>
                <td className="py-5">AI answers completed</td>
                <td className="num">{result.answers}</td>
                <td className="num">{settings.ai_minutes}</td>
                <td className="num">{(result.aiMinutes / 60).toFixed(1)} h</td>
                <td className="num">{money((result.aiMinutes / 60) * settings.hourly_cost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {!data.activity.length && (
          <div className="border-b border-border py-6 text-sm text-muted-foreground">
            No tracked activity yet.
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-8 text-sm">
          <span className="flex items-center gap-2">
            <Clock3 className="size-4 text-primary" />
            Time saved × {money(settings.hourly_cost)}/hour
          </span>
          <span className="flex items-center gap-2">
            <TrendingUp className="size-4 text-success" />
            Service cost: {money(settings.monthly_service_cost)}/month
          </span>
        </div>
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Estimates, not measured cash savings. Sample records and earlier activity are excluded.
          Each newly saved record and completed AI answer counts once. Stopped or failed answers do
          not count. Costs are prorated using a 30-day month.{" "}
          {manager ? "" : "Plant service cost is not deducted from individual estimates."}
        </p>
        {!data.settings && (
          <p className="mt-2 text-xs text-warning">
            Starter assumptions: 5 minutes per saved record, 10 minutes per AI answer, €25/hour and
            €0 service cost.
          </p>
        )}
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Savings assumptions</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                { key: "paperwork_minutes", label: "Minutes per saved record", max: 480 },
                { key: "ai_minutes", label: "Minutes per AI answer", max: 480 },
                { key: "hourly_cost", label: "Hourly labor cost", max: 10000 },
                { key: "monthly_service_cost", label: "Monthly AFS cost", max: 100000 },
              ] as const
            ).map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  type="number"
                  min="0"
                  max={f.max}
                  step="0.5"
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
          <Label htmlFor="currency">Currency</Label>
          <select
            id="currency"
            value={draft.currency}
            onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            className="rounded-md border border-input bg-panel p-2"
          >
            <option value="EUR">EUR · Euro</option>
            <option value="RSD">RSD · Serbian dinar</option>
            <option value="USD">USD · US dollar</option>
            <option value="GBP">GBP · British pound</option>
          </select>
          <Button onClick={save} disabled={saving}>
            Save assumptions
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
