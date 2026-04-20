Purpose: Define the cross-app document signing capability so case managers can send participant-facing intake workflows (authored in the intake workflow studio) for review and signature, reusing the intake renderer and `signature-ack`.
Audience: Product, engineering, security, ops.
Last Updated: 2025-12-10

## Goals
- Case managers send intake workflows (single-step or mini-workflow) for signature from the admin dashboard with status tracking and audit history.
- Participants complete/sign via the public portal using the existing intake renderer, including `signature-ack`, branching, validation, and file-upload components.
- Preserve legal/audit integrity: capture signer metadata, immutable snapshot (PDF), and tamper detection.
- Keep bilingual (EN/FR) flows and accessibility aligned to the current intake renderer.

## MVP scope (current intent)
- Participant-only: no case-manager inputs or signatures required; CM selects a workflow template and sends it.
- Single signer: participant signs; once signed, lock and issue the artifact.
- Uses intake-renderer components as-is (including file-upload where required by the workflow).
- Later versions will add CM prefill/read-only fields and optional CM signature with flexible order.

## Non-goals (phase 1)
- Offline paper upload ingestion; only e-sign via the portal UI.
- General-purpose document editor outside the intake workflow studio.

## Surfaces
- Admin dashboard: issue/manage requests from a participant profile or case record; select an intake workflow template, prefill fields (case-manager-entered data), set due date/message, send/cancel; view status and download signed artifact.
- Public portal: “Documents to sign” task list; each opens a single-step or multi-step intake workflow rendered with the portal renderer; participant completes remaining fields (if any), signs, gets confirmation, and can download the signed PDF.

## Template model
- Authored in the intake workflow studio as intake JSON schemas (steps/components already supported by the portal renderer: paragraph, inputs, radios, conditional sections, file-upload, `signature-ack`).
- Fields: `id`, `name`, `version`, `languageVariants`, `schema` (components array or multi-step), `mergeFields` (e.g., participant name, case file id), `allowedSigners` (participant + optional staff/co-signer), `prefillSchema` (fields case managers populate and lock).
- Authoring location: stored with intake schemas for parity; avoid duplicating renderer logic or creating a separate template system.
- Intake-derived standalone forms may reuse the same `step` rows as the main intake workflow when the goal is to expose an existing intake declaration as a sendable signable form in the workflow library/editor.
- Workflow type flag: add `workflowType` metadata with values `main-intake`, `consent-no-prefill`, or `consent-cm-prefill` (labels: “Main Intake”, “Consent Form (No prefill)”, “Consent Form (CM prefill)”) to distinguish the primary intake from consent/document flows and to drive routing/permissions.
- CM prefill (funding agreement): HTML blocks may include `{{token}}` placeholders. The admin backend resolves them when creating the signing request (client name, case manager signature/date, institution, program, dates, funding amounts, and other line items from intervention/assessment). CFA signer prefill should prefer the case's assigned case manager and persist that signer name in the CFA version snapshot so later rerenders do not drift to whichever staff member triggered a resend or regeneration.
- Conditional HTML blocks: use `<!-- IF token --> ... <!-- END token -->` to hide sections (e.g., living allowance) when the token resolves to empty.

## Sending UX (high level)
- Case manager composes a secure message and picks one or more workflows flagged with `workflowType=consent-no-prefill` or `workflowType=consent-cm-prefill` from a picker; they can still edit subject/body (e.g., “please sign this form”).
- Sending creates a signing request per selected workflow, links it to the message thread, and adds a “document to sign” card in the conversation. Status updates (sent/viewed/signed) post back into the thread; outstanding items can still be listed elsewhere for visibility.
- Checklist integration: each consent workflow (`consent-no-prefill` / `consent-cm-prefill`) maps to a supporting-documents checklist item type. When the participant submits, the signed PDF is stored in the supporting documents library with the mapped doc-type and the checklist item is auto-completed; signing status remains the source of truth (avoid manual uploads ticking the box).
- PDF parity rule: when a standalone signing workflow represents an intake declaration that already has a dedicated intake PDF renderer (for example `ei_consent`, `indigenous_declaration`, `conflict_of_interest`, `iset_client_info_release`, `client_acknowledgement`), the signing-request completion path should generate the same document-style PDF rather than falling back to the generic workflow snapshot layout.
- Promotion note: standalone signable intake declarations are workflow-authoring records, not schema migrations. To move them from DEV into TEST/PROD, promote each workflow ID through the `workflow-authoring` data-sync path in addition to deploying the admin/portal code that renders and stores the signed output.
- Data contracts (initial):
  - Message POST supports `attachments: [{ workflow_id, due_at?, checklist_doc_type? }]` for consent workflows; backend creates `signing_request` rows with status `pending` and links them to the message.
  - Message GET returns `attachments` per message: `[ { id (signing_request_id), workflow_id, workflow_name, workflow_type, status } ]` for UI display.
  - Signing request DB shape: `id, workflow_id, workflow_name, workflow_type, case_id, participant_user_id, created_by_user_id, status(pending/viewed/signed/cancelled/expired), due_at, resolved_schema_json, signed_payload_json, artifact_url, checklist_doc_type, timestamps`.

## Request model (DB/API shape)
- Table `signing_request`: `id`, `template_id`, `participant_id`, `case_manager_id`, `status` (draft|pending|viewed|signed|cancelled|expired), `due_at`, `sent_at`, `viewed_at`, `signed_at`, `prefill_payload_json` (case-manager-entered, read-only to participant), `resolved_schema_json` (schema with merges applied), `signed_payload_json` (final normalized values), `signature_artifact_url` (PDF), `audit_trail` (JSON events), `hash` (artifact checksum), `cancelled_by`, timestamps.
- Optional later: `co_signer_user_id`, `co_signer_status`, `co_signer_signed_at`.

## APIs (proposed)
- Admin: `POST /api/signing-requests` (template_id, participant_id, merge fields, due_at, message), `GET /api/signing-requests/:id`, `POST /api/signing-requests/:id/cancel`.
- Participant: `GET /api/signing-requests/:id` (resolved schema + merge values), `POST /api/signing-requests/:id/sign` (signature payload incl. typed name, timestamp, IP/user agent).
- Events/notifications: emit `signing_request.sent/viewed/signed/cancelled/expired` for audit + email hooks.

## Rendering + UX notes
- Reuse the intake `signature-ack` renderer; do not fork. Keep labels/action/clear buttons, status text, handwriting font, and required flag behavior.
- Mini-workflow support: multi-step, branching (e.g., EFT vs Wire), validation, and file uploads (e.g., void cheque) work as in intake.
- Participant read-only fields: prefilled by case manager; participant can edit only the designated remaining fields.
- The instance is read-only after signing. Once signed, lock fields and show a success state plus a download link.
- Allow save/return before signing (persist partial view state and audit view events).
- EN/FR text stays in the template; renderer chooses by user locale as intake does.

## Controls & integrity
- AuthZ: participant-only access to their requests; admin-only creation/cancel. If email links are used, pair with one-time token plus DOB/identifier check.
- Audit: log every send/view/sign/cancel with actor, timestamp, IP, user agent.
- Immutability: after signing, freeze payload, store PDF, and compute checksum hash; block edits.
- Storage: signed PDF and raw signature payload stored in MinIO/S3; avoid keeping base64 blobs inline in primary tables.
- Compliance: retain EN/FR content; keep ARIA/keyboard flow identical to intake; respect existing PII handling (no extra exposure in logs).

## Notifications (v1)
- Email to participant on send with link to portal task; optional reminder 48h before due; email on successful signing to both participant and case manager with download link.

## Example patterns to support
- EFT/Wire payment form: branch on EFT vs Wire; conditional required fields; required file upload (void cheque) when EFT.
- Single-step consent: static text + single signature with timestamp.
- Case-manager-prepped agreement: case manager fills program, dates, funding tables (amounts, totals), and living allowance table; participant reviews read-only values, signs. Allow multiple `signature-ack` fields (client, case manager) with defined order.

## Open questions / TODO
- Decide on expiry policy and reminder cadence; add `expired` status handling.
- Confirm whether one-time token links are required vs portal-auth-only.
- Confirm signer roles/order for post-MVP (participant only vs participant + case manager, and who signs first).
- Clarify offline exception process (paper upload) if mandated later; would require a separate intake-like flow.
- Define retention period for audit and artifacts.
