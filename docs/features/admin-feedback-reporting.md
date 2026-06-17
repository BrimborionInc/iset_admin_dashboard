# Admin Feedback Reporting

Status: implemented in admin shell on 2026-04-05, with shared admin/manager triage dashboard added on 2026-04-30

## Purpose

Provide an in-app way for signed-in PATH staff to report admin-console bugs and request changes without leaving the current workflow.

## Current UX

- Top header now includes a dedicated report button beside the existing `Admin Console Help` utility.
- Clicking that button opens a help panel titled `Bug reporting and change requests`.
- The help panel explains what to include and exposes two launch actions:
  - `Report a bug`
  - `Request a change`
- Those actions open a non-modal floating report window, similar in spirit to `Ask the AI`, so staff can keep interacting with PATH while they write.
- The floating window captures the current page context when it is opened. The captured context includes:
  - current path and URL
  - document title
  - current breadcrumbs
  - browser language / user agent
  - viewport size
  - browser timezone
- Successful submission now closes the floating report window and opens a shell-level confirmation modal.
- Submission failures remain inline in the floating report window so staff can correct and resubmit without reopening it.

## Triage surfaces

- The System Administrator homepage includes the `Bugs and Change Requests` widget.
- A dedicated `Support > Bugs and Change Requests` dashboard reuses the same widget so `System Administrator`, `NWAC Administrator`, and `Regional Manager` users can view and update the queue.
- The widget is backed by `GET /api/dashboard/admin-feedback-reports`, with the older `GET /api/dashboard/system-admin-feedback-reports` path retained as a compatibility alias.
- Opening a report from that widget launches a second non-modal floating panel for triage/review.
- The review panel is backed by:
  - `GET /api/admin/feedback-reports/:id`
  - `PATCH /api/admin/feedback-reports/:id/status`
  - `POST /api/admin/feedback-reports/:id/notes`
- The review panel exposes:
  - report details
  - captured page context
  - supporting-file links
  - status history
  - internal admin notes

## Operational triage expectations

- If a PROD feedback report is materially investigated, fixed, deployed, or otherwise resolved through Codex, update the live PROD feedback log before closing the thread.
- Keep `admin_feedback_report.status`, `admin_feedback_status_history`, and `admin_feedback_note` in sync with the real PROD outcome instead of leaving the resolution only in chat or repo docs.
- When Bill asks Codex to triage bugs / change requests, treat that as a queue-review workflow:
  - review the open queue
  - inspect each item's available evidence and related product/code/data context
  - add internal notes for substantive triage judgments
  - change statuses where appropriate
  - return a prioritized analysis for planning, not just a cleaned-up queue
- Treat submitted reports as evidence to validate, not as automatic product defects or change requests.
  Before calling something a bug, compare it against the agreed product behavior in current docs/code/live data.
  If the system is behaving as designed and the issue is staff understanding, training, wording, or support, close it as by-design/support-only with a note instead of expanding scope into a new CR.
- Current status intent for Codex triage:
  - `triaging`: acknowledged and under validation, design review, or information gathering
  - `planned`: fix/change is complete and tested, but has not yet been deployed to PROD
  - `in_progress`: fix/change is underway but not complete; use this for work blocked on a user/staff answer, targeted recheck, or other feedback needed before completion
  - `closed`: duplicate, by-design/support-only, withdrawn, or otherwise non-actionable
  - `resolved`: requested outcome is actually delivered in the target environment
- If evidence is insufficient, keep the item open and note what additional information is needed from the reporter instead of guessing.
- If an item is a duplicate, note the canonical item before closing the duplicate.
- For workflow or client-facing-output bugs, use holistic validation before saying an issue is fixed or moving it to `resolved`: inspect the full affected workflow and every generated/sent artifact in the packet, not only the specific artifact named in the report. If one part is fixed but adjacent output remains unverified, keep the report open and describe the remaining verification explicitly.
- Current autonomy boundary: this workflow is for queue review, notes/status updates, and planning analysis. Do not assume a triage request also authorizes autonomous implementation or deployment unless the user asks for that separately.
- Current release-planning boundary: a prepared bug/CR fix does not imply an immediate PROD deploy. Unless Bill explicitly approves an emergency hotfix, keep the report open with notes, continue building the prioritized queue, and batch suitable fixes into the next planned PROD maintenance release. Move reports to `resolved` only after that release and targeted live recheck.
- User-facing hotfix or release-note copy should stay neutral and outcome-focused. Use short bullets such as `Fixed a bug...` or `Made a change...`, and do not reference report IDs, reporter names, or that a change came from a complaint.

## Current form model

- Report type: `bug` or `change_request`
- Severity: `critical`, `high`, `medium`, `low`
- Short summary: optional in UI; backend derives one from the description if blank
- Description: required
- Supporting files: optional, up to 5 files per report

## Attachment rules

- Accepted types:
  - PDF
  - Word (`.doc`, `.docx`)
  - Excel (`.xls`, `.xlsx`)
  - CSV / text
  - PNG / JPG
- Current per-file size limit: 10 MB
- Storage path uses the shared object-store layer already used by PATH uploads:
  - DEV: MinIO-backed S3-compatible path when configured
  - TEST / PROD: S3
- Download links are not exposed through a raw attachment route. The System Administrator report-detail endpoint loads attachments for the selected report and returns short-lived presigned URLs.

## Backend contract

- Create report: `POST /api/admin/feedback-reports`
  - Multipart form-data
  - Fields:
    - `reportType`
    - `severity`
    - `summary` (optional)
    - `description`
    - `contextSnapshot` (optional JSON string)
    - `attachments` (0..5 files)

## Persistence model

Canonical migrations:

- `sql/migrations/20260405_0001_create_admin_feedback_reporting.sql`
- `sql/migrations/20260405_0002_create_admin_feedback_management_tables.sql`

Tables:

- `admin_feedback_report`
  - one row per submitted bug report or change request
  - stores type, severity, status, summary, description, reporter snapshot, and captured page context
- `admin_feedback_attachment`
  - one row per uploaded supporting file
  - stores object-storage key, mime type, size, checksum, and uploader snapshot
- `admin_feedback_status_history`
  - one row per persisted status change
  - stores previous/new status and the admin actor snapshot at the time of change
- `admin_feedback_note`
  - one row per internal admin note
  - stores note text plus the admin actor snapshot at the time of entry

Deliberate design choice:

- These reports do **not** use `iset_document`.
- Internal bug/change evidence is not a client/application/case document, so mixing it into Supporting Documents would pollute the case-document domain and create false document records.

## Shell wiring

- Help-panel launcher event: `help:open-topnav`
- Report-window launcher event: `admin-feedback:open-composer`
- Review-window launcher event: `admin-feedback:open-review`
- Floating report window component: `src/features/adminFeedback/FloatingFeedbackReporter.jsx`
- Floating review window component: `src/features/adminFeedback/FloatingFeedbackReviewPanel.jsx`
- Help content entry point: `src/helpPanelContents/adminFeedbackHelp.js`
- Top-nav integration: `src/layouts/TopNavigation.js`
- Shell state/event listener: `src/AppContent.js`
- System Administrator homepage widget: `src/pages/home/widgets/SystemAdminFeedbackQueueWidget.jsx`
- Dedicated dashboard: `src/pages/support/BugsChangeRequestsDashboard.jsx`
- Navigation route: `/support/bugs-change-requests`
- Access Control matrix label/default route: `src/widgets/AccessControlMatrix.jsx`, `src/config/roleMatrix.json`

## Follow-on work

- Decide whether report-status changes should emit internal notifications.
- Consider whether the dedicated dashboard should add saved dashboard preferences or additional grouping once the queue grows.
