import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Trash2, Copy, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { accessQuery, recordsQuery, machinesQuery } from "@/lib/queries";
import { ChatMedia, MediaPreview, type ChatAttachment } from './chat-media';
import { threadsQuery } from "@/lib/chat/queries";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";

export function PlantChat({
  threadId,
  initialMessages = [],
  initialRecordId = null,
}: {
  threadId?: string;
  initialMessages?: UIMessage[];
  initialRecordId?: string | null;
}) {
  const { data: access } = useSuspenseQuery(accessQuery);
  const { data: threads } = useSuspenseQuery(threadsQuery);
  const { data: records } = useSuspenseQuery(recordsQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [recordId, setRecordId] = useState(initialRecordId ?? "");
  useEffect(() => {
    setRecordId(initialRecordId ?? "");
  }, [initialRecordId]);
  const [creating, setCreating] = useState(false);
  async function createThread() {
    setCreating(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Please sign in again.");
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({
          user_id: user.user.id,
          plant_owner_id: access.plant_owner_id,
          record_id: recordId || null,
        })
        .select()
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["chat-threads"] });
      await navigate({ to: "/search/$threadId", params: { threadId: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create conversation.");
    } finally {
      setCreating(false);
    }
  }
  async function removeThread(id: string) {
    if (!window.confirm("Delete this conversation?")) return;
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["chat-threads"] });
    if (id === threadId) await navigate({ to: "/search", search: { record: undefined } });
  }
  return (
    <div className="flex min-h-[700px] flex-col lg:h-[calc(100dvh-137px)] lg:min-h-0 lg:flex-row">
      <aside className="w-full shrink-0 border-b border-border bg-panel p-4 lg:w-64 lg:border-b-0 lg:border-r">
        <Button className="w-full" onClick={createThread} disabled={creating}>
          <Plus />
          New conversation
        </Button>
        <div className="tag mb-3 mt-6">Conversations</div>
        <div className="max-h-48 space-y-1 overflow-y-auto lg:max-h-[calc(100dvh-280px)]">
          {threads.map((t) => (
            <div
              key={t.id}
              className={cn("group flex items-center rounded-md", threadId === t.id && "bg-accent")}
            >
              <Link
                to="/search/$threadId"
                params={{ threadId: t.id }}
                className="min-w-0 flex-1 px-2 py-3 text-sm"
              >
                <div className="truncate">{t.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(t.updated_at).toLocaleDateString()}
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Delete conversation"
                aria-label={`Delete ${t.title}`}
                onClick={() => removeThread(t.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          {!threads.length && (
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
          )}
        </div>
      </aside>
      <section data-thread-id={threadId} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-6 py-3">
          <FileText className="size-4 text-muted-foreground" />
          <select
            aria-label="Search paperwork"
            value={recordId}
            disabled={!!threadId}
            onChange={(e) => setRecordId(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-input bg-panel px-3 py-2 text-sm"
          >
            <option value="">General plant data</option>
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
                {r.record_type === "spreadsheet" ? " · Excel" : ""}
              </option>
            ))}
          </select>
        </div>
        {threadId ? (
          <ChatWindow key={threadId} threadId={threadId} initialMessages={initialMessages} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-md bg-primary font-display text-xl font-bold text-primary-foreground">
              A
            </div>
            <h2 className="text-2xl font-semibold">Ask the plant</h2>
            <Button onClick={createThread} disabled={creating}>
              <Plus />
              Start conversation
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
function ChatWindow({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const [input, setInput] = useState("");
  const {data:machines}=useSuspenseQuery(machinesQuery);
  const [machineId,setMachineId]=useState(machines.length===1 ? machines[0]?.id ?? '' : '');
  const [attachments,setAttachments]=useState<ChatAttachment[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const cancelSaved = useRef(false);
  const qc = useQueryClient();
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId, machineId: machineId || undefined },
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
      }),
    [threadId,machineId],
  );
  const { messages, sendMessage, status, error, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message),
    onFinish: async ({ message, isAbort }) => {
      if (isAbort && message && !cancelSaved.current) {
        cancelSaved.current = true;
        const parts = [...message.parts, { type: "text" as const, text: "_Stopped._" }];
        const { error } = await supabase.from("chat_messages").upsert(
          {
            thread_id: threadId,
            sdk_id: message.id,
            role: "assistant",
            parts: parts as unknown as Json,
            completed: false,
          },
          { onConflict: "thread_id,sdk_id" },
        );
        if (error) toast.error("Stopped reply could not be saved.");
      }
      await qc.invalidateQueries({ queryKey: ["chat-threads"] });
      qc.invalidateQueries({ queryKey: ["savings"] });
      textarea.current?.focus();
    },
  });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => {
    if (!busy) textarea.current?.focus();
  }, [busy]);
  return (
    <>
      <Conversation className="min-h-[300px] flex-1">
        <ConversationContent className="mx-auto w-full max-w-4xl gap-7 p-6">
          {!messages.length && (
            <div className="py-12">
              <div className="mb-4 inline-grid size-9 place-items-center rounded-md bg-primary font-display font-bold text-primary-foreground">
                A
              </div>
              <h2 className="text-xl font-semibold">What’s happening on the floor?</h2>
            </div>
          )}
          {messages.map((m, index) => (
            <Message key={m.id} from={m.role}>
              <MessageContent
                className={
                  m.role === "user"
                    ? "bg-secondary text-secondary-foreground"
                    : "max-w-full bg-transparent text-foreground"
                }
              >
                {m.role === "assistant" && <div className="tag mb-2 text-primary">AFS</div>}
                {m.parts.map((p, i) =>
                  p.type === "text" ? (
                    <MessageResponse key={i}>{p.text}</MessageResponse>
                  ) : p.type === "reasoning" ? (
                    <Reasoning
                      key={i}
                      defaultOpen={false}
                      isStreaming={busy && index === messages.length - 1}
                    >
                      <ReasoningTrigger />
                      <ReasoningContent>{p.text}</ReasoningContent>
                    </Reasoning>
                  ) : p.type === 'file' ? <MediaPreview key={i} file={{...p,filename:p.filename ?? 'Attachment'}}/> : null,
                )}
                {m.role === "assistant" && !busy && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Copy answer"
                    aria-label="Copy answer"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(
                          m.parts
                            .filter((p) => p.type === "text")
                            .map((p) => p.text)
                            .join("\n"),
                        )
                        .catch(() => toast.error("Could not copy answer."))
                    }
                  >
                    <Copy />
                  </Button>
                )}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer>Checking plant data…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-4xl px-6 pb-6">
        <select aria-label="Fault machine" value={machineId} onChange={e=>setMachineId(e.target.value)} disabled={busy} className="mb-3 w-full rounded-md border border-input bg-panel px-3 py-2 text-sm"><option value="">Select machine for fault analysis</option>{machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
        {attachments.map((file,i)=><MediaPreview key={file.url} file={file} onRemove={()=>setAttachments(files=>files.filter((_,index)=>index!==i))}/>)}
        {error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error.message}
          </p>
        )}
        <PromptInput
          onSubmit={async () => {
            if (!input.trim() || busy) return;
            const text = input;
            cancelSaved.current = false;
            setInput("");
            const files=attachments;setAttachments([]);
            await sendMessage({ text, files });
            textarea.current?.focus();
          }}
        >
          <PromptInputTextarea
            ref={textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or write a follow-up…"
            aria-label="Message AFS"
            className="min-h-20"
          />
          <PromptInputFooter className="justify-between">
            <ChatMedia threadId={threadId} machines={machines} machineId={machineId} onMachine={setMachineId} onAttachment={file=>setAttachments([file])} onTranscript={text=>setInput(value=>value ? `${value}\n${text}` : text)} input={input} busy={busy}/>
            <PromptInputSubmit
              size="icon-sm"
              status={status}
              disabled={!busy && !input.trim()}
              onStop={stop}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}
