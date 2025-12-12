# Government Submissions Dashboard (formerly ARMS submissions)
Purpose: Capture context, defaults, and work-in-progress notes for the Government/ARMS submissions dashboard so changes stay coordinated.  
Audience: Admin dashboard engineers and reviewers.  
Last Updated: 2025-12-12

Overview
- Dashboard lives at `src/pages/esdc/EsdcParticipantSubmissionsPage.jsx`; uses Cloudscape Board with palette/reset events.
- Renamed from “ARMS Submissions”; no prior dedicated doc existed (see `docs/dashboards/dashboard-pruning-notes.md` for the old ARMS placeholder removal).
- Storage key: `esdc-participants-layout-v3` (localStorage). Bump if default widgets change.
- Default layout/widgets: `queue` (Participant submission queue, 4x3), `validation` (Validation summary, 2x4), `batch` (Batch submission, 2x4), `history` (Recent submissions, 4x3). Palette shows any missing widgets from this set.
- Palette/listeners: responds to `esdcParticipants:openPalette` and `esdcParticipants:resetLayout`; also listens for `palette:add` to place widgets. Palette updates are signature-guarded to avoid render loops per `docs/guides/configurable-dashboard-notes.md`.
- Help: widgets link to `esdcParticipantQueueHelp`, `esdcParticipantValidationHelp`, `esdcParticipantHistoryHelp`; page uses `EsdcParticipantsHelp` for broader context.
- Participant queue data: `/api/esdc/participants` now returns only reportable cases that have an active action plan with at least one non-closed intervention whose `start_date` is today/past; submission_status is limited to `pending`/`rejected` (awaiting action). Response includes `action_plan_id`, `action_plan_status`, `action_plan_start_date`, `action_plan_result_code`, `action_plan_result_date`.

Open Items / TODO
- TODO: Confirm backend payloads/endpoints for queue, validation summary, and history widgets (assumption freeze: do not add fields unless exposed by the API).
- TODO: Document nav/ACL entry once the route and permissions are finalized for Government Submissions.
- TODO: Add widget-level data notes (filters, pagination, empty-state expectations) once APIs are verified.
- TODO: Add monitoring/testing notes for widget API failures and board layout persistence once flows are exercised.

Related References
- Dashboard implementation: `src/pages/esdc/EsdcParticipantSubmissionsPage.jsx`
- Widget components: `src/pages/esdc/widgets/EsdcParticipantQueueWidget.jsx`, `EsdcParticipantValidationWidget.jsx`, `EsdcParticipantHistoryWidget.jsx`
- Help content: `src/helpPanelContents/esdcParticipantsHelp.js`, `esdcParticipantQueueHelp.js`, `esdcParticipantValidationHelp.js`, `esdcParticipantHistoryHelp.js`
- Board guardrails: `docs/guides/configurable-dashboard-notes.md`

Submission Trigger Model (proposed; needs validation vs ILMP guide/backend events)
- Reportable unit = Action Plan (not application, payments, or standalone interventions); one submission row per action plan.
- Do NOT trigger on: application submission/approval, draft/plan Action Plans, funding agreement signing, intervention creation/approval before start, payments, uploads, case notes.
- First valid submission (plan becomes reportable): Action Plan exists AND ≥1 intervention under it is active AND that intervention’s start date is today/past (not future-dated).
- Final submission (close-out): Action Plan closed with Result Date + Result Code AND all interventions under it are in terminal states (completed/cancelled/failed/etc.) AND required final fields (intervention outcomes, duration, total cost) are populated.
- Subsequent plans: clients can have multiple non-overlapping Action Plans; identity keys = SIN + Agreement Number + Action Plan Start Date (immutable once submitted). Multiple submissions for the same plan are updates only (identity fields fixed).
- Constraints: draft vs active is internal only for ESDC; future-dated starts should reject submission; adding/modifying interventions alone does not trigger; monthly/per-payment submissions not supported by schema.
- Design implication: submissions queue should react solely to Action Plan lifecycle events, not application workflow or finance events.
