import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, desc, actions }: { title: string; desc: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 border-b border-border px-8 pb-6 pt-8">
      <div>
          <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{desc}</p>
      </div>
      {actions}
    </header>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "warn" | "bad" | "good" }) {
  return (
    <div className="panel p-4">
      <div className="tag">{label}</div>
      <div
        className={cn(
          "num mt-2 text-2xl font-medium",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
          tone === "good" && "text-success",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        status === "running" && "live-dot bg-success",
        status === "idle" && "bg-warning",
        status === "down" && "bg-destructive",
      )}
    />
  );
}

export function headMeta(title: string, description: string) {
  return {
    meta: [
      { title: `${title} · AFS` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} · AFS` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
