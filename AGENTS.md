<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## AFS architecture
- All plant data (machines, paper_records, maintenance_events) is owner-scoped by `owner_id = auth.uid()` RLS; new users get a sample plant via the `seed_sample_plant` trigger on signup, so the app is never empty.
- Pure plant rules (out-of-range flags, failure risk) live in `src/lib/rules.ts` with tests; UI and AI code must call these rather than re-implementing thresholds.
- Live machine readings come from `src/lib/telemetry.ts` (simulated) until real PLC connectors exist; replace that module's source, not the pages.
- AI calls (search, paper-form scanning) are authenticated server functions in `src/lib/ai.functions.ts`; gateway setup stays in `src/lib/ai.server.ts`.
