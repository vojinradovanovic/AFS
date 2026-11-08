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
- Plant data uses owner IDs for shared plants; protected user_roles and machine_assignments determine manager and assigned-operator access through RLS. Signup creates a standalone manager plant; accepting an email-bound invitation switches the account to an operator without exposing its former plant.
- Pure plant rules (out-of-range flags, failure risk) live in `src/lib/rules.ts` with tests; UI and AI code must call these rather than re-implementing thresholds.
- Live machine readings come from `src/lib/telemetry.ts` (simulated) until real PLC connectors exist; replace that module's source, not the pages.
- AI calls (search, paper-form scanning) are authenticated server functions in `src/lib/ai.functions.ts`; gateway setup stays in `src/lib/ai.server.ts`.
- Excel workbooks are parsed in the browser and saved as spreadsheet paper_records with sheets and row numbers; AI search selects a workbook explicitly to avoid silently truncating spreadsheet context.
- Operator invitations use email-bound, expiring tokens and database-authorized acceptance; invitation links are shared by managers, not automatically emailed.
- Saved chat uses route-derived thread IDs, account/plant-scoped RLS, AI SDK UIMessage parts and an authenticated streaming HTTP boundary; only verified server completions count as AI savings activity.
- Savings use a separate activity ledger for new saved paperwork and successful AI answers, excluding seeded/history records; pure estimation formulas live in src/lib/savings.ts with tests.
- Chat reload retains reasoning UI parts, but model replay uses complete plain-text history to avoid deployment-bound encrypted reasoning references; streaming message IDs are explicitly generated to prevent reply overwrites.
