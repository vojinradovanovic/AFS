import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Clock3, TrendingUp } from "lucide-react";
import { savingsQuery } from "@/lib/savings.queries";
import { calculateSavings, DEFAULT_SAVINGS } from "@/lib/savings";
export function SavingsSummary() {
  const { data } = useSuspenseQuery(savingsQuery);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const s = { ...DEFAULT_SAVINGS, ...data.settings };
  const result = calculateSavings(data.activity, s, start, now);
  return (
    <section className="mx-8 mb-8 border-y border-border py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Estimated savings · this month</h2>
        <Link to="/savings" className="flex items-center gap-1 text-xs text-primary">
          View savings
          <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="flex flex-wrap gap-12">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-4" />
            Time saved
          </div>
          <div className="num text-2xl">{result.hours.toFixed(1)} h</div>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="size-4" />
            Labor value
          </div>
          <div className="num text-2xl text-success">
            {new Intl.NumberFormat("en", { style: "currency", currency: s.currency }).format(
              result.gross,
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
