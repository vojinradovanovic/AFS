import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, Mic, Square, Wrench, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordWav } from "@/lib/chat/record-wav";
import { transcribeVoice } from "@/lib/chat/voice.functions";
import { validateMedia } from "@/lib/chat/media-rules";
import type { Machine } from "@/lib/queries";
export type ChatAttachment = { type: "file"; mediaType: string; filename: string; url: string };
export function ChatMedia({
  threadId,
  machines,
  machineId,
  onMachine,
  onAttachment,
  onTranscript,
  input,
  busy,
}: {
  threadId: string;
  machines: Machine[];
  machineId: string;
  onMachine: (id: string) => void;
  onAttachment: (file: ChatAttachment) => void;
  onTranscript: (text: string) => void;
  input: string;
  busy: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const recorder = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [fault, setFault] = useState("");
  const [resolution, setResolution] = useState("");
  const [saved, setSaved] = useState<
    { id: string; title: string; fault: string; resolution: string }[]
  >([]);
  const transcribe = useServerFn(transcribeVoice);
  useEffect(
    () => () => {
      void recorder.current?.stop().catch(() => {});
    },
    [],
  );
  useEffect(() => {
    let active = true;
    supabase
      .from("repair_logs")
      .select("id,title,fault,resolution")
      .eq("machine_id", machineId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (active && !error) setSaved(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [machineId, open]);
  async function upload(file: File) {
    setWorking(true);
    try {
      const kind = validateMedia(file.type, file.size);
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Please sign in again.");
      const path = `${data.user.id}/${threadId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("chat-media")
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      if (kind === "audio") {
        const text = await transcribe({ data: { path, threadId } });
        onTranscript(text);
        toast.success("Voice note transcribed — review before sending or saving.");
      } else
        onAttachment({
          type: "file",
          mediaType: file.type,
          filename: file.name,
          url: `https://afs.invalid/media/${encodeURIComponent(path)}`,
        });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload file.");
    } finally {
      setWorking(false);
    }
  }
  async function toggleRecording() {
    try {
      if (recorder.current) {
        const current = recorder.current;
        recorder.current = null;
        setRecording(false);
        await upload(await current.stop());
      } else {
        recorder.current = await recordWav();
        setRecording(true);
      }
    } catch (e) {
      setRecording(false);
      toast.error(e instanceof Error ? e.message : "Microphone is unavailable.");
    }
  }
  async function saveRepair() {
    setWorking(true);
    try {
      const { error } = await supabase
        .from("repair_logs")
        .insert({ machine_id: machineId, thread_id: threadId, title, fault, resolution });
      if (error) throw error;
      toast.success("Completed repair shared with the machine team.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save repair.");
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          aria-label="Fault photo, video or voice note"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/wav,audio/mpeg,audio/webm,audio/mp4"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Attach photo, video or voice note"
          title="Attach photo, video or voice note"
          disabled={busy || working || recording}
          onClick={() => fileRef.current?.click()}
        >
          {working ? <Loader2 className="animate-spin" /> : <Paperclip />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={recording ? "Stop voice recording" : "Record voice note"}
          title={recording ? "Stop voice recording" : "Record voice note"}
          disabled={busy || working}
          onClick={() => void toggleRecording()}
        >
          {recording ? <Square className="text-destructive" /> : <Mic />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || working || recording || !machineId}
          onClick={() => {
            setResolution(input);
            setOpen(true);
          }}
        >
          <Wrench />
          Save repair
        </Button>
        {recording && (
          <span role="status" className="text-xs text-destructive">
            Recording…
          </span>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Completed repair</DialogTitle>
          </DialogHeader>
          <Label htmlFor="repair-machine">Machine</Label>
          <select
            id="repair-machine"
            value={machineId}
            onChange={(e) => onMachine(e.target.value)}
            className="rounded-md border border-input bg-background p-2"
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Label htmlFor="repair-title">Repair title</Label>
          <Input
            id="repair-title"
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Label htmlFor="repair-fault">Fault observed</Label>
          <textarea
            id="repair-fault"
            maxLength={5000}
            className="min-h-20 rounded-md border border-input bg-background p-2"
            value={fault}
            onChange={(e) => setFault(e.target.value)}
          />
          <Label htmlFor="repair-resolution">Actual fix and verification</Label>
          <textarea
            id="repair-resolution"
            maxLength={10000}
            className="min-h-32 rounded-md border border-input bg-background p-2"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Operator-reported history · Shared with this machine’s team
          </p>
          <Button
            disabled={
              working ||
              title.trim().length < 2 ||
              fault.trim().length < 2 ||
              resolution.trim().length < 2
            }
            onClick={() => void saveRepair()}
          >
            <Wrench />
            Save completed repair
          </Button>
          <div className="border-t border-border pt-3">
            <h3 className="text-sm font-semibold">Machine repair history</h3>
            {!saved.length ? (
              <p className="mt-2 text-sm text-muted-foreground">No completed repairs recorded.</p>
            ) : (
              saved.map((r) => (
                <div key={r.id} className="mt-3 text-sm">
                  <strong>{r.title}</strong>
                  <p className="text-muted-foreground">{r.fault}</p>
                  <p>{r.resolution}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function MediaPreview({ file, onRemove }: { file: ChatAttachment; onRemove?: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    const prefix = "https://afs.invalid/media/";
    if (file.url.startsWith(prefix))
      supabase.storage
        .from("chat-media")
        .createSignedUrl(decodeURIComponent(file.url.slice(prefix.length)), 3600)
        .then(({ data }) => {
          if (active) setUrl(data?.signedUrl ?? "");
        });
    return () => {
      active = false;
    };
  }, [file.url]);
  return (
    <div className="my-2 max-w-sm overflow-hidden rounded-md border border-border bg-panel p-2">
      {url &&
        (file.mediaType.startsWith("image/") ? (
          <img src={url} alt={file.filename} className="max-h-64 w-full object-contain" />
        ) : file.mediaType.startsWith("video/") ? (
          <video src={url} controls className="max-h-64 w-full" />
        ) : (
          <audio src={url} controls className="w-full" />
        ))}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs">{file.filename}</span>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove attachment"
            onClick={onRemove}
          >
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}
