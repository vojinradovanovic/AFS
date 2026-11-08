import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { recordsQuery } from "@/lib/queries";
import { threadsQuery, threadQuery } from "@/lib/chat/queries";
import { PageHeader, headMeta } from "@/components/afs/page";
import { PlantChat } from "@/components/afs/plant-chat";
export const Route = createFileRoute("/_authenticated/search_/$threadId")({
  head: () =>
    headMeta(
      "Plant conversation",
      "Continue a saved AFS conversation with source-backed plant answers.",
    ),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(threadQuery(params.threadId)),
      context.queryClient.ensureQueryData(recordsQuery),
      context.queryClient.ensureQueryData(threadsQuery),
    ]),
  component: ThreadPage,
});
function ThreadPage() {
  const { threadId } = Route.useParams();
  const { data } = useSuspenseQuery(threadQuery(threadId));
  return (
    <div>
      <PageHeader title="AI search" desc={data.thread.title} />
      <PlantChat
        threadId={threadId}
        initialMessages={data.messages}
        initialRecordId={data.thread.record_id}
      />
    </div>
  );
}
