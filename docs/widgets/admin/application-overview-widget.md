# Application Overview widget

## Workflow

Application Assessment

## Source

- src/widgets/ApplicationOverviewWidget.js

## Primary Route Context

- /application-case/:id

## Purpose

Case summary, status context, quick layouts, and quick actions.

## User Actions (observed)

- Open and inspect widget state for current case/submission/packet context.
- Use widget controls to progress work for the owning workflow.
- Navigate to linked records or execute relevant operational actions.
- Use `Quick layouts` for review, documents/messages, notes/calendar, and audit trail views.
- Use `Quick actions` for mutating or workflow-launching actions such as assignment, watchlist, escalation, put application on hold, resume review, closure notice, withdraw/archive/reopen, and lock release.

## Inputs / Dependencies

- Route context identifiers (case id, participant id, or selected packet).
- Back-end API payloads and runtime configuration for this feature area.
- Role/permission checks enforced by route guards and server APIs.

## Outputs / Side Effects

- Persists workflow data and emits status transitions relevant to the workflow.
- Updates dependent widgets through shared context/event updates.
- Contributes auditability via timeline/history/notes where applicable.

## Current Notes

- Keep this document aligned whenever this widget is refactored, renamed, moved, or given new actions.
- The manual status selector in this widget is currently available to `System Administrator` and `NWAC Administrator` users; other roles see the read-only status badge plus any role-gated quick actions.
- `Withdraw application` and `Reopen application` quick actions are role-neutral within normal Application Workspace file access: assigned ISET Coordinators, scoped Regional Managers, and administrators can use them when the application status is eligible. Withdrawal resolves open escalation rows through the case status-update route so staff do not need separate escalation-owner permission to complete the withdrawal.
- Quick-action and workflow eligibility must use the raw persisted application status, not only the display status. For example, raw `closure_notice` displays as `Awaiting Applicant`, but it remains eligible for `Withdraw application`; raw `docs_requested` also displays under the awaiting-applicant umbrella but still drives document-response/resume-review behavior.
- `Put on hold` is an application-level workflow action. It persists raw application status `on_hold`, keeps lifecycle semantics under `awaiting_applicant`, requires a hold reason, creates a review-date reminder, and moves the row into the homepage `On Hold` workflow bucket until `Resume review` returns it to `in_review`.
- Add endpoint-level detail and UAT script rows in the next documentation pass.
