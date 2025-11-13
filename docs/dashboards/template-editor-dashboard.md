# Template Editor Dashboard

Last updated: 2025-11-06

## Purpose
Provide administrators with a focused workspace for drafting, localising, and validating notification templates before they are assigned to events and roles via the Notification Settings dashboard.

## Widgets

### Template Editor
- Library panel lists all templates exposed by `/api/templates`. Selecting a row loads the bilingual subject/body into the editor; deleting removes the template entirely.
- Editor panel supports:
  - Bilingual subjects and bodies with tabbed switching.
  - Formatting toolbar for bold, italic, underline, bulleted/numbered lists, and links (tokens inserted directly into the textarea, preview renders styled HTML).
  - Placeholder palette (Insert field dropdown) for applicant/case tokens.
  - AI translation helper with guardrails and messaging.
  - Live preview that renders placeholders, formatting tokens, and link tokens.
  - Localised autosave/persistence so state survives navigation until explicitly saved.
- Save writes back to `/api/templates/:id`; Cancel restores the last saved snapshot.

## Behavioural Notes
- This dashboard no longer shares space with Notification Settings. After saving, use the link (top of the page) to return to `/manage-notifications` and assign templates to events.
- Formatting tokens (`[b]`, `[i]`, `[u]`, `[ul]`, `[ol]`, `[li]`, `[link url="..."]`) remain visible in the textarea but render as styled HTML in the preview and downstream SES pipeline.
- Link modal enforces `https://` URLs and inserts `[link url="..."]text[/link]` tokens; editing within the textarea is possible but the toolbar provides the safest path.

## Follow-ups
- Extend formatting toolbar with keyboard shortcuts and tooltip descriptions.
- Add template-level metadata (audience, default locale) and surface it back in Notification Settings.
- Wire autosave indicators + toast messaging when background saves occur.
- Expand placeholder list with applicant portal URLs once intake-side renderer adopts the same token contract.
