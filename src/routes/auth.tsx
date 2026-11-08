import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { headMeta } from "@/components/afs/page";

export const Route = createFileRoute("/auth")({
  head: () => headMeta("Sign in", "Sign in to AFS, the AI layer for your plant floor."),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && navigate({ to: "/overview" }));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && navigate({ to: "/overview" }));
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    if (mode === "up" && !res.data.session) setSent(true);
  }

  async function oauth(p: "google" | "lovable") {
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message ?? "Sign-in failed");
  }

  return (
    <div className="grid min-h-screen grid-cols-2">
      <div className="grid-bg relative flex flex-col justify-between border-r border-border p-12">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-md bg-primary font-display font-bold text-primary-foreground">A</div>
          <span className="font-display text-lg font-semibold">AFS</span>
        </div>
        <div>
          <div className="tag">Consumer packaged goods · AI layer</div>
          <h1 className="mt-4 max-w-md text-5xl font-semibold leading-[1.05]">
            Your plant floor, <span className="text-primary">one screen.</span>
          </h1>
          <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
            <li><span className="num text-primary">U1</span> &nbsp;Paperwork digitization</li>
            <li><span className="num text-primary">U2</span> &nbsp;Live machine data</li>
            <li><span className="num text-primary">U4</span> &nbsp;AI search across all data</li>
            <li><span className="num text-primary">U12</span> Predictive maintenance</li>
          </ul>
        </div>
        <p className="tag">Every agent proposes. A person approves.</p>
      </div>
      <div className="flex items-center justify-center p-12">
        <div className="w-full max-w-sm">
          {sent ? (
            <div className="panel p-6">
              <h2 className="text-xl font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-muted-foreground">We sent a confirmation link to {email}. Open it to finish creating your account.</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold">{mode === "in" ? "Sign in" : "Create account"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">New accounts start with a sample plant you can explore.</p>
              <div className="mt-6 space-y-2">
                <Button type="button" variant="outline" className="w-full" onClick={() => oauth("google")}>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
                  Continue with Google
                </Button>
                <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
                  Continue with Lovable
                </button>
              </div>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
              </form>
              <button className="mt-4 text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
                {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
