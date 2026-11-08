import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { headMeta } from "@/components/afs/page";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/invite")({
  head: () => headMeta("Join your plant", "Accept your AFS machine operator invitation."),
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s["token"] === "string" ? s["token"] : "" }),
  component: Invite,
});
function Invite() {
  const { token } = Route.useSearch();
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: user, isPending } = useQuery({ queryKey: ["invite-session"], queryFn: async () => (await supabase.auth.getUser()).data.user });
  async function accept() {
    setBusy(true); setError("");
    const { error } = await supabase.rpc("accept_operator_invite", { p_token: token });
    setBusy(false);
    if (error) { setError(error.message); return; }
    await queryClient.cancelQueries(); queryClient.clear();
    await navigate({ to: "/overview" });
  }
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-8">
    <div className="font-display text-lg font-semibold text-primary-foreground">AFS</div>
    <h1 className="text-3xl font-semibold">Join your plant</h1>
    <p className="text-sm text-muted-foreground">Machine operator invitation</p>
    {!token ? <p className="text-destructive">The invitation link is incomplete.</p> : isPending ? <p>Checking account…</p> : user ? <><p className="text-sm">Signed in as {user.email}</p><Button disabled={busy} onClick={accept}>{busy ? "Joining…" : "Accept invitation"}</Button></> : <Button asChild><Link to="/auth" search={{ invite: token }}>Sign in or create account</Link></Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </main>;
}