import { createFileRoute } from "@tanstack/react-router";
import { recordsQuery } from "@/lib/queries";
import { threadsQuery } from "@/lib/chat/queries";
import { PageHeader, headMeta } from "@/components/afs/page";
import { PlantChat } from "@/components/afs/plant-chat";
export const Route = createFileRoute("/_authenticated/search")({
  head: () =>
    headMeta(
      "AI search",
      "Saved plant conversations with follow-up answers across paperwork and machine data.",
    ),
  validateSearch: (s: Record<string, unknown>) => ({
    record: typeof s["record"] === "string" ? s["record"] : undefined,
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(recordsQuery),
      context.queryClient.ensureQueryData(threadsQuery),
    ]),
  component: SearchPage,
});
function SearchPage() {
  const { record } = Route.useSearch();
  return (
    <div>
      <PageHeader title="AI search" desc="Plant conversations" />
      <PlantChat initialRecordId={record ?? null} />
    </div>
  );
}
