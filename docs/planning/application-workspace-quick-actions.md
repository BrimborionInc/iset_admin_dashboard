# Application Workspace Quick Actions (Non-Layout)

Purpose: Capture requirements for non-layout quick actions in the Application Workspace.
Audience: Application management owners, frontend engineers, QA.
Last Updated: 2026-05-06
Status: In progress

## Scope
Define non-layout quick actions for the Application Workspace header, including role visibility, status gating, backend support, and confirmation requirements.

## Current UI split

- `Quick layouts` contains non-mutating board/view presets: Review application, Documents and messages, Notes and case calendar, and View audit trail.
- `Quick actions` contains mutating or workflow-launching actions: Add applicant to watchlist, Assign / reassign, Put on hold, Resume review, escalation actions, Put on closure notice, Close application, Archive application, Reopen application, and Release lock.
- Keep layout switches out of the mutating action menu so staff can distinguish navigation from workflow changes.

## Actions to confirm
- Assign / reassign
- Put on hold
- Put on closure notice
- Resume review
- Close application
- Archive application (if supported)
- Reopen application (if supported)
- Escalate application
- Respond to escalation
- Resolve escalation

## Open questions (tracking)

### Global status support
- Verified: application status already supports `archived` (backend terminal status list + UI selector).
- Add new application status for "closure notice" (key: `closure_notice`, label: "Closure Notice") + backend support and transitions.

### Assign / reassign
- Roles that can see/use: System Administrator, Program Administrator, Regional Manager.
- Role naming note: "ISET coordinator" maps to assessor role; exclude from assign/reassign visibility.
- Status gating: Available for all statuses except Approved, Archived, Closed.
- Backend endpoint + payload: Match Case Workspace assign/reassign behavior (same roles/constraints).
- Confirmation/modal requirements: Reuse Case Workspace assign modal (select assignee + save/cancel).

### Put on closure notice
- Roles that can see/use: All roles (including ISET Coordinator).
- Status gating: Available from `submitted`, `in_review`, `docs_requested`, `pending_approval` (not from approved/completed/rejected/closed/archived).
- Backend endpoint + payload: Set status to `closure_notice` (new status).
- Confirmation/modal requirements: Confirm modal with required note; note text should state that if the applicant does not respond, the application should be escalated to a manager/admin for closure.
- Intent: applicant has not responded or provided key documents; application remains open but flagged for closure notice.

### Put on hold
- Roles that can see/use: All roles with Application Overview quick-action access for the file.
- Status gating: Available from `submitted`, `in_review`, `docs_requested`, `closure_notice`, and `pending_approval`; unavailable from terminal statuses and when already `on_hold`.
- Backend endpoint + payload: Set `applicationStatus` to `on_hold` through `PUT /api/cases/:id`; send `applicationAwaitingReason` with the selected parking reason.
- Confirmation/modal requirements: Confirm modal asks for hold reason, review date, and optional note.
- Side effects: Creates a case reminder with category `Application hold review`; records the reason/review date in the case note text; moves the row to homepage `On Hold` and out of active assessment/decision queues.
- Intent: application remains open while PATH waits on external funding, a future program/school start, applicant-requested pause, internal follow-up, or another scheduled hold reason.

### Resume review
- Roles that can see/use: All roles (including ISET Coordinator).
- Status gating: Available from `docs_requested` (Action Required), `closure_notice`, and `on_hold`.
- Backend endpoint + payload: Set status to `in_review`.
- Confirmation/modal requirements: Confirm modal with required note for consistency.

### Close application
- Roles that can see/use: System Administrator, Program Administrator, Regional Manager.
- Status gating: Available from `submitted`, `in_review`, `docs_requested`, `pending_approval`, `closure_notice`, and `on_hold`.
- Backend endpoint + payload: Set status to `closed`.
- Confirmation/modal requirements: Confirm modal with required note.
- Escalation handling: Allow closing with an open escalation, but ensure the escalation queue is resolved/closed to avoid orphaned items.
- Escalation handling detail: If an escalation is open, auto-resolve it and attach the close note as the resolution note.

### Archive application
- Roles that can see/use: System Administrator, Program Administrator.
- Status gating: Available from `approved`, `completed`, `rejected`, `closed`.
- Backend endpoint + payload: Set status to `archived`.
- Confirmation/modal requirements: Confirm modal with required note.
- Escalation handling: Block if an escalation is open; show a note explaining why.

## Confirmation default
Unless explicitly stated otherwise, quick actions should use a confirmation modal with a required note.

## Notes storage decision
- Required notes will be stored as case notes via `POST /api/cases/:caseId/notes` (status updates do not accept notes).
- Note body should include the action name and status transition for traceability.

## Status update decision
- Quick actions will update `applicationStatus` only (not `status`) via `PUT /api/cases/:id`, to avoid unintended case-status side effects. The application status is the source of truth for this workspace.
- Requirement: status changes must appear in the Events timeline (emit `status_changed`).
- Implementation decision: emit `status_changed` when `applicationStatus` changes (application + case remain separate; no case status updates).
- Notification decision: decision emails follow the application status change (approved/rejected) to avoid losing applicant notices when case status is not updated.

## Closure notice status behavior
- Treat `closure_notice` like Action Required/hold for SLA and work-queue logic.

### Reopen application
- Roles that can see/use: System Administrator, Program Administrator (closed only); System Administrator only (archived).
- Status gating: Available from `closed` (System + Program Admin), from `archived` (System Admin only).
- Backend endpoint + payload: Set status to `in_review`.
- Confirmation/modal requirements: Confirm modal with required note (default).

### Escalate application
- Roles that can see/use: ISET Coordinators and Regional Managers.
- Status gating: Available from all non-terminal statuses (approved/completed/rejected/closed/archived excluded).
- Backend endpoint + payload: Single "Escalate application" action; target = Regional Manager (from Coordinator), Program Administrator (from Regional Manager). If Regional Manager is responding to an escalation, include "Escalate to Program Administrator".
- Confirmation/modal requirements:

### Respond to escalation
- Roles that can see/use: Escalation owner only (Regional Manager or Program Administrator as current owner).
- Status gating: Escalation open only.
- Backend endpoint + payload:
- Confirmation/modal requirements: Confirm modal with required note (default).

### Resolve escalation
- Roles that can see/use: Escalation owner only.
- Status gating: Escalation open only.
- Backend endpoint + payload:
- Confirmation/modal requirements: Confirm modal with required note (default).
