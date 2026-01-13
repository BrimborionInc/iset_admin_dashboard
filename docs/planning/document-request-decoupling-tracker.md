Purpose: Track design, planning, and implementation for decoupling document requests from application status and adding reminder/closure thresholds.
Audience: Admin dashboard engineers and operators.
Last Updated: 2026-01-12

## Phase Status
- Design: complete
- Planning: complete
- Implementation: in progress

## Background
- Today, "Action Required" maps to `iset_intake.iset_application.status = 'doc_requested'`.
- Status is set when a case manager sends a secure message with a requested form to sign, and reverts once documents are signed/received.
- Document requests need to be independent of application status so they can occur at any point in the workflow.

## Goals
- Track document requests separately from application status.
- Allow status and document-request state to coexist (e.g., `decision_ready` + documents requested).
- Prepare for event emission when document requests cross reminder/closure thresholds.

## Non-goals (initial)
- Legacy data migrations or fallbacks (dev-only; clean slate).
- Public portal changes.

## Constraints / References
- Follow `docs/guides/configurable-dashboard-notes.md` before dashboard/widget changes.
- Dev DB introspection via Windows MySQL client as documented in `docs/README.md`.

## Open Questions
- None.

## Decisions (Interview Log)
- Owner delegated DB, backend, and frontend implementation decisions to engineering; UX input only.
- Maintain tracker updates after each prompt.
- Backend change should decouple document requests from application status.
- Reminder/closure thresholds will be configurable SLA variables in `src/pages/configurationSettings.js`.
- SLA labels/descriptions can be chosen by engineering; must clarify they trigger events X days after request.
- Application overview will include a manual toggle to set/clear docs requested and start/stop the timer.
- Setting or clearing the toggle must emit events.
- Events should be emitted via the standard mechanism for future notifications and SLA-based reminders.
- Likely future background job to scan for overdue document requests (see Backend jobs widget).
- Existing secure-message-with-form flow should continue to set docs-requested automatically; manual toggle adds to current workflow.
- Default SLA values: reminder at 7 days, mark-for-closure at 28 days (configurable).

## Proposed UX
- Application overview should show application status and document-request timing as separate badges.
- Document request badge should read "Docs Requested X days ago" and coexist with any application status (e.g., In Review).
- Show the document request badge in both the Application overview header and the Applications workspace list/work queue.
- Add a docs-requested toggle in Application overview; allow manual set/clear outside of form-signing flow.

## Data Model / Schema
- Add document-request tracking fields to `iset_application`:
  - `docs_requested_active` (bool)
  - `docs_requested_at` (datetime)
  - `docs_requested_cleared_at` (datetime)
  - `docs_requested_source` (varchar)
- Timer starts from `docs_requested_at` when active.

## API & Persistence
- Extend `PUT /api/cases/:id` to accept `docsRequested` (bool) and `docsRequestedSource` (string).
- Auto-set docs requested when application status is moved to `docs_requested` (unless explicitly overridden); do not auto-clear on other status changes.
- Secure message with form attachments should set docs requested + application status (current behavior preserved).
- Auto-clear docs requested after all signing requests are signed when the source is `secure_message`.
- Emit events on set/clear (new event types in catalog): `document_request_set`, `document_request_cleared`.
- Reserve SLA threshold events for later jobs: `document_request_reminder_due`, `document_request_closure_due`.

## Implementation Plan
1. Add `docs_requested_*` fields to `iset_application` with indexes.
2. Update backend endpoints to read/write document-request fields and emit events.
3. Update UI badges/toggle in Application Overview and work queue lists.
4. Add SLA config fields for doc-request reminder/closure thresholds.
5. Update documentation and changelog.
6. Validate manual toggle, secure message auto-set, and signing auto-clear flows.

## Implementation Progress
- Migration applied in dev for `docs_requested_*` fields + indexes.
- Backend: `/api/cases/:id` + workspace + applications list now include doc-request fields; `PUT /api/cases/:id` handles `docsRequested` + auto-set on status; secure-message signing clears doc requests; events catalog updated.
- Frontend: docs-request badges added to Application Overview, Applications table, and work queue; manual toggle added to Application Overview; secure messaging sets docs-request fields; Application Events handles new doc-request event types.
- Fix: Application Overview doc-request toggle now refreshes case data and updates immediately after toggle.
- UX: Application Overview quick actions reordered into a logical sequence (navigation → ownership/escalation → closure/close → audit trail).
- Fix: Secure messaging form attachments now always set docs-request tracking and only override status for submitted/in-review files.
- Portal: Application card now shows Action required when docs-request tracking is active (external status derived from docs_requested_active).
- Portal: Signing-request completion now clears docs-request tracking when the request originated from secure messaging.
- SLA config ordering + stage placeholders updated in both backend + configuration settings UI.
- Docs updated (status lifecycle guide + changelog).

## Risks / Open Items
- Verify auto-set when status moves to `docs_requested` and auto-clear after signing completion.
- Confirm Application Events widget displays new document-request event types as expected.

## Validation & Testing
- Toggle Docs Requested on/off in Application Overview and confirm events + badge updates.
- Send a secure message with a signing request and confirm docs-request timer auto-starts.
- Complete all signing requests and confirm docs-request auto-clears (source `secure_message` only).
- Check Applications list + work queue show status badge and docs-request badge together.
- Verify Application Events shows the new document-request event types with the expected message text.

## Migration / Rollout
- None (dev-only; no legacy data).
