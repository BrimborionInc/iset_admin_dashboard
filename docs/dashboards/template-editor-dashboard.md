# Template Editor Dashboard

Last updated: 2026-05-25

## Purpose
Provide administrators with a focused workspace for drafting, localising, and validating notification templates before they are assigned to events and roles via the Notification Settings dashboard.

## Widgets

### Template Editor
- Library panel lists all templates exposed by `/api/templates`. Selecting a row loads the bilingual subject/body into the editor; deleting removes the template entirely.
- Editor panel supports:
  - Bilingual subjects and bodies with tabbed switching.
  - Formatting toolbar for bold, italic, underline, bulleted/numbered lists, and links (tokens inserted directly into the textarea, preview renders styled HTML).
  - Searchable subject-safe field picker that appends placeholders to the active language subject.
  - Searchable body field picker plus a collapsed field reference for case/applicant, staff/event, intervention proposal, NWAC review, decision, and links/support placeholders.
  - Staff/event placeholders include explicit event timestamp fields (`{event_datetime}` and secure-message-specific `{message_received_at}`) so notification copy does not have to reuse the application submission date for staff event emails.
  - Preview scenario selector for common event families:
    - NWAC changes requested
    - NWAC approved
    - NWAC denied
    - Intervention proposal approved
    - Secure message
    - Applicant submission
    - Decision approved
    - Generic staff alert
  - Compact validation messaging for unknown placeholders and advisory scenario-fit notes when a valid placeholder is not typical for the selected preview scenario.
  - AI translation helper with guardrails and messaging.
  - Live subject/body preview that renders placeholders, formatting tokens, and link tokens using scenario-specific sample data.
  - Localised autosave/persistence so state survives navigation until explicitly saved.
- Save writes back to `/api/templates/:id`; Cancel restores the last saved snapshot.

## Behavioural Notes
- This dashboard no longer shares space with Notification Settings. After saving, use the link (top of the page) to return to `/manage-notifications` and assign templates to events.
- Template read/write/delete API access follows the runtime access-control matrix for `/template-editor`. The Access Control dashboard is the source of truth for which staff roles can use this dashboard.
- The shared template list endpoint can be read by staff with either `/template-editor` or `/manage-notifications` access, because Notification Settings needs the same template catalogue for assignment.
- The template editor's field catalog is a frontend authoring aid aligned with the current renderer/dispatcher context. The backend still renders whatever placeholders are saved in `notification_template.localized`; unsupported placeholders remain visible unless a dispatch path supplies matching context.
- Intervention proposal notification templates can use `{intervention_title}`, `{proposal_type}`, and `{approval_request_type}` in addition to the shared case/applicant/staff/event fields.
- Preview scenarios use sample data only. They do not emit events, send email, or prove that a specific `notification_setting` row is enabled.
- Formatting tokens (`[b]`, `[i]`, `[u]`, `[ul]`, `[ol]`, `[li]`, `[link url="..."]`) remain visible in the textarea but render as styled HTML in the preview and downstream SES pipeline.
- Link modal enforces `https://` URLs and inserts `[link url="..."]text[/link]` tokens; editing within the textarea is possible but the toolbar provides the safest path. The portal sign-in link field remains a configured placeholder link and renders in preview using scenario sample data.

## Follow-ups
- Extend formatting toolbar with keyboard shortcuts and tooltip descriptions.
- Add template-level metadata (audience, default locale) and surface it back in Notification Settings.
- Wire autosave indicators + toast messaging when background saves occur.
- Add a controlled test-send workflow after staff agree on recipient safeguards for DEV/TEST/PROD.
