# Government Submissions Dashboard (formerly ARMS submissions)
Purpose: Capture context, defaults, and work-in-progress notes for the Government/ARMS submissions dashboard so changes stay coordinated.  
Audience: Admin dashboard engineers and reviewers.  
Last Updated: 2026-05-28

Overview
- Dashboard lives at `src/pages/esdc/EsdcParticipantSubmissionsPage.jsx`; uses Cloudscape Board with palette/reset events.
- Renamed from “ARMS Submissions”; no prior dedicated doc existed (see `docs/dashboards/dashboard-pruning-notes.md` for the old ARMS placeholder removal).
- Storage key: `esdc-participants-layout-v6` (localStorage). Bump if default widgets change.
- Default layout/widgets: `queue` (Participant submission queue, 4x7, bucket-style readiness summary + Validate all + Generate batch XML + queue table). The separate Batch export widget is no longer registered on this dashboard; batch generation/download now happens from the queue header. `history` (Recent ILMP exports, 4x5) remains available from the palette for downloaded-file audit/requeue work, but is not part of the default layout.
- Palette/listeners: responds to `esdcParticipants:openPalette` and `esdcParticipants:resetLayout`; also listens for `palette:add` to place widgets. Palette updates are signature-guarded to avoid render loops per `docs/guides/configurable-dashboard-notes.md`.
- Help: the queue links to `esdcParticipantQueueHelp`, the optional history widget links to `esdcParticipantHistoryHelp`, and the page uses `EsdcParticipantsHelp` for broader context. `esdcBatchSubmissionHelp` is historical/legacy copy for the retired standalone widget. Help and AI context must describe PATH's participant workflow as export/download plus manual external upload, not direct ESDC submission.
- Participant queue data: `/api/esdc/participants` returns reportable active or close-out action-plan submissions with `submission_status` limited to `pending`/`rejected` (awaiting action). With `groupByClient=true`, the backend groups all filtered rows by participant/client, applies allowlisted column sorting (`participant_name`, `readiness_status`, `submission_reason`, `detail`), and only then applies `limit`/`offset`; it returns the grouped total and readiness summary so Cloudscape pagination and the combined summary reflect the full queue. Response includes `case_id`, `action_plan_id`, `action_plan_status`, `action_plan_start_date`, `action_plan_result_code`, `action_plan_result_date`.
- Batch modal behavior: `Generate batch XML` prepares the XML and shows ready/excluded counts plus excluded-record links and a filename field. The modal intentionally does not show raw XML or ask for a local path. On browsers that support the File System Access API, the primary save action opens the native Save dialog before marking records as exported/downloaded; otherwise it falls back to the standard browser download after `/api/esdc/participants/batch-submit`. PATH does not upload the file to ESDC; staff handle that manual upload outside PATH.
- AI guidance: seeded chatbot cards now cover the participant batch export flow and Recent ILMP exports XML-snapshot/requeue behavior. Keep those cards and eval fixtures aligned with queue/history help when labels or side effects change.

Open Items / TODO
- TODO: Confirm backend payloads/endpoints for queue, validation summary, and history widgets (assumption freeze: do not add fields unless exposed by the API).
- TODO: Document nav/ACL entry once the route and permissions are finalized for Government Submissions.
- TODO: Add widget-level data notes (filters, pagination, empty-state expectations) once APIs are verified.
- TODO: Add monitoring/testing notes for widget API failures and board layout persistence once flows are exercised.

Related References
- Dashboard implementation: `src/pages/esdc/EsdcParticipantSubmissionsPage.jsx`
- Widget components: `src/pages/esdc/widgets/EsdcParticipantQueueWidget.jsx`, optional `EsdcParticipantHistoryWidget.jsx`; legacy standalone batch source remains at `EsdcBatchSubmissionWidget.jsx` but is not registered on the dashboard.
- Help content: `src/helpPanelContents/esdcParticipantsHelp.js`, `esdcParticipantQueueHelp.js`, `esdcBatchSubmissionHelp.js`, `esdcParticipantHistoryHelp.js`
- Board guardrails: `docs/guides/configurable-dashboard-notes.md`

Submission Trigger Model (proposed; needs validation vs ILMP guide/backend events)
- Reportable unit = Action Plan (not application, payments, or standalone interventions); one submission row per action plan.
- Do NOT trigger on: application submission/approval, draft/plan Action Plans, funding agreement signing, intervention creation/approval before start, payments, uploads, case notes.
- First valid submission (plan becomes reportable): Action Plan exists AND ≥1 intervention under it is active AND that intervention’s start date is today/past (not future-dated).
- Final submission (close-out): Action Plan closed with Result Date + Result Code AND all interventions under it are in terminal states (completed/cancelled/failed/etc.) AND required final fields (intervention outcomes, duration, total cost) are populated.
- Subsequent plans: clients can have multiple non-overlapping Action Plans; identity keys = SIN + Agreement Number + Action Plan Start Date (immutable once submitted). Multiple submissions for the same plan are updates only (identity fields fixed).
- Constraints: draft vs active is internal only for ESDC; future-dated starts should reject submission; adding/modifying interventions alone does not trigger; monthly/per-payment submissions not supported by schema.
- Design implication: submissions queue should react solely to Action Plan lifecycle events, not application workflow or finance events.
