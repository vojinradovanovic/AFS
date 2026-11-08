import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { accessQuery, machinesQuery } from "@/lib/queries";
import { PageHeader, headMeta } from "@/components/afs/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => headMeta("Plant team", "Invite machine operators and assign machines in your AFS plant."),
  loader: ({ context }) => context.queryClient.ensureQueryData(machinesQuery),
  component: Team,
});
function Team() {
  const { data: access } = useSuspenseQuery(accessQuery);
  const { data: machines } = useSuspenseQuery(machinesQuery);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const { data: invites = [] } = useQuery({ queryKey: ["invites"], queryFn: async () => {
    const { data, error } = await supabase.from("operator_invites").select("*").order("created_at", { ascending: false });
    if (error) throw error; return data;
  }, enabled: access.role === "production_manager" });
  async function invite(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_operator_invite", { p_email: email, p_machines: selected });
      if (error) throw error;
      setLink(`${window.location.origin}/invite?token=${data}`);
      await qc.invalidateQueries({ queryKey: ["invites"] });
      toast.success("Invitation created");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Invitation failed"); }
    finally { setBusy(false); }
  }
  if (access.role !== "production_manager") return <div className="p-8">Team management is available to production managers.</div>;
  return <div>
    <PageHeader title="Plant team" desc="Machine operators and invitations" />
    <div className="max-w-3xl space-y-6 px-8 py-6">
      <form onSubmit={invite} className="space-y-4">
        <h2 className="text-lg font-semibold">Invite machine operator</h2>
        <div className="space-y-2"><Label htmlFor="operator-email">Operator email</Label><Input id="operator-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Assigned machines</legend>
          {machines.map((m) => <label key={m.id} className="flex items-center gap-3 border-b border-border py-2 text-sm"><input type="checkbox" className="accent-primary" checked={selected.includes(m.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, m.id] : s.filter((id) => id !== m.id))} />{m.name}<span className="ml-auto text-muted-foreground">{m.line}</span></label>)}
        </fieldset>
        <Button disabled={busy || !selected.length}><UserPlus />Create invitation</Button>
      </form>
      {link && <div className="space-y-2"><Label>Invitation link · expires in 7 days</Label><div className="flex gap-2"><Input value={link} readOnly /><Button size="icon" variant="outline" aria-label="Copy invitation link" title="Copy invitation link" onClick={async () => { await navigator.clipboard.writeText(link); toast.success("Invitation link copied"); }}><Copy /></Button></div></div>}
      <section><h2 className="mb-3 text-lg font-semibold">Operators & invitations</h2>
        {invites.map((i) => <div key={i.id} className="border-b border-border py-3 text-sm"><div className="flex justify-between gap-4"><span>{i.email}</span><span className="text-muted-foreground">{i.accepted_by ? "Joined" : new Date(i.expires_at) < new Date() ? "Expired" : "Pending"}</span></div><div className="mt-1 text-xs text-muted-foreground">{machines.filter((m) => i.machine_ids.includes(m.id)).map((m) => m.name).join(" · ")}</div></div>)}
        {!invites.length && <p className="text-sm text-muted-foreground">No invitations yet.</p>}
      </section>
    </div>
  </div>;
}