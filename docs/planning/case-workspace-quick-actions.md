# Case Workspace Quick Actions

Purpose: Capture the design decisions, rules, and implementation notes for Case Workspace quick actions.
Audience: Caseworking feature owners, frontend engineers, and QA.
Last Updated: 2026-05-03
Status: Complete for current behavior; future backload-scope consideration open

## Scope
Define a master list of quick actions for the Case Workspace header and map each action to role + case status rules, including actions that reconfigure the Cloudscape board layout.

## Role Terminology
Display/conversation roles (Cognito group names are inconsistent; map to these labels in UI and docs):
- System Administrator
- Program Administrator
- Regional Manager
- ISET Coordinator (sometimes labeled Case Manager in Case Workspace)

## Master Action List (Draft)
- Assign / reassign
- Propose new intervention / resume current proposal
- Add existing action plan (current UI gate: application-less, non-archived cases)
- Add existing intervention (current UI gate: application-less, non-archived cases)
- Manage plans and interventions
- View notes and case calendar
- Documents and messages
- View audit trail
- ESDC validation (show Compliance + Export Preview widgets)
- Mark ready to close
- Close case
- Archive case
- Reopen case

## Decisions
- ESDC validation quick action reconfigures the board to show Compliance and Export Preview widgets.
- Layout quick actions should switch the board to a specific layout (not just add widgets).
- Backend supports case status `archived` via `PUT /api/cases/:id` (status field includes `archived`).
- Assign / reassign visibility and scope:
  - System Administrator: can assign/reassign to any user.
  - Program Administrator: can assign/reassign to any user except System Administrators.
  - Regional Manager: can assign/reassign only to users in their region (including themselves).
  - ISET Coordinator: does not see the action.
- Assign / reassign status gating: available for all statuses except `archived` (archived locks the case).
- Assign / reassign should emit an event per the events catalog/emitter.
- Propose new intervention visibility: all roles see/use this action.
- Propose new intervention label: when an intervention proposal is already open, the quick action relabels to resume, update, or view the pending intervention proposal/change instead of advertising a new proposal.
- Backload quick-action current visibility: `Add existing action plan`, `Add existing intervention`, and `Upload existing documents` are shown only when the case exists, the case is not `archived`, and the workspace payload has no linked `applicationId` / `application_id`.
- Backload quick-action current data meaning: a missing `application_id` means no `iset_application` row currently points at the case through `iset_application.case_id`; application-backed case context is derived from that relationship, not from `iset_case.application_id`.
- Manage plans and interventions visibility: all roles (board layout action).
- Manage plans and interventions status gating: all statuses (layout-only action).
- View notes and case calendar visibility: all roles (board layout action).
- View notes and case calendar status gating: all statuses (layout-only action).
- Documents and messages visibility: all roles (board layout action).
- Documents and messages status gating: all statuses (layout-only action).
- View audit trail visibility: all roles (board layout action).
- View audit trail status gating: all statuses (layout-only action).
- ESDC validation visibility: all roles (board layout action).
- ESDC validation status gating: all statuses (layout-only action).
- Mark ready to close visibility: all roles.
- Close case visibility: System Administrator, Program Administrator, Regional Manager.
- Archive case visibility: System Administrator, Program Administrator.
  - Current understanding: archive is a status only; intended to hide items from normal view and allow restore via a future “view archive” toggle (likely System Administrator only).
- Reopen case visibility: System Administrator, Program Administrator (closed cases only).
- Reopen archived case visibility: System Administrator only.
- Propose new intervention status gating: allowed only for case-management statuses after application approval; `ready_to_close`, `closed`, and `archived` should not allow new interventions.
- Propose new intervention status gating detail: allow for `initiated`, `active`, `dormant`; block `pending_approval`, `ready_to_close`, `closed`, `archived`.
- Manage plans and interventions layout:
  - Widgets: `caseHeader` (colSpan 4, rowSpan 3), `actionPlans` (colSpan 4, rowSpan 3), `interventions` (colSpan 4, rowSpan 3).
  - Order: Action Plans first, then Interventions.
  - All other widgets removed (available via palette).
- View notes and case calendar layout:
  - Widgets: `caseHeader` (colSpan 4, rowSpan 3), `case-notes` (colSpan 2, rowSpan 6), `case-calendar` (colSpan 2, rowSpan 6).
  - Order: Notes and Calendar side-by-side below the header.
- Documents and messages layout:
  - Widgets: `caseHeader` (colSpan 4, rowSpan 3), `supporting-documents` (colSpan 2, rowSpan 6), `secure-messaging` (colSpan 2, rowSpan 6).
  - Order: Supporting Documents and Secure Messaging side-by-side below the header.
- View audit trail layout:
  - Widgets: `caseHeader` (colSpan 4, rowSpan 3), `participantDetails` (colSpan 2, rowSpan 6), `case-events` (colSpan 2, rowSpan 6).
  - Order: Participant Details and Events Timeline side-by-side below the header.
- ESDC validation layout:
  - Widgets: `caseHeader` (colSpan 4, rowSpan 3), `compliancePanel` (colSpan 2, rowSpan 6), `exportPreview` (colSpan 2, rowSpan 6).
  - Order: Compliance and Export Preview side-by-side below the header.
- Propose new intervention layout:
  - Widgets: `caseHeader` (colSpan 4, rowSpan 3), `participantDetails` (colSpan 2, rowSpan 7), `interventionAssessment` (colSpan 2, rowSpan 7).
  - Order: Participant Details and Intervention Assessment side-by-side below the header.
- Mark ready to close status gating: show for `active` and `dormant`; API validation enforces terminal action plans/interventions before transition.
- Close case status gating: only when status is `ready_to_close`.
- Ready-to-close semantics: once in `ready_to_close`, the only allowed transitions should be close or reopen; block proposals or other new work items while in this state.
- Archive case status gating: only when status is `closed` and not already `archived`.
- Reopen case status gating: allowed for `ready_to_close` and `closed` (System Administrator + Program Administrator); `archived` allowed only for System Administrator.
- Reopen case target status: `dormant`.
- Quick actions visibility behavior: hide actions that are not allowed for the current role/status (no disabled menu items).
- Quick action proposal behavior: if an open proposal exists, selecting the action opens that proposal in the intervention assessment widget; it only starts a new proposal when no draft, submitted, in-review, or changes-requested proposal exists.
- Ready-to-close behavior: layout-only quick actions remain available.
- Quick actions ordering: use the master list order (Assign/Reassign → Propose → Manage Plans/Interventions → Notes/Calendar → Documents/Messages → View Audit Trail → ESDC Validation → Mark Ready to Close → Close → Archive → Reopen).
- Follow-on UI design decision from 2026-05-04: split the overloaded quick-action menus in both Case Workspace and Application Workspace into `Quick Layouts` and `Quick Actions`. `Quick Layouts` should contain non-mutating board/view presets. Case Workspace layouts: View plans and interventions, View payments, View notes and calendar, View documents and messages, View audit trail, and ILMP Validation and Export. Application Workspace layouts: Review application, Documents and messages, Notes and case calendar, and View audit trail. `Quick Actions` should contain mutating or workflow-launching actions. Case Workspace actions: Assign / reassign, Propose/resume intervention, Add existing action plan, Add existing intervention, Upload existing documents, Activate/resend PATH account, Add client SIN to watchlist, Mark ready to close, Close case, Archive case, Reopen case, and Release lock. Application Workspace actions: Add applicant to watchlist, Assign / reassign, Resume review, escalation actions, closure notice, Close application, Archive application, Reopen application, and Release lock.
- Archive case confirmation: yes (confirm modal required).
- Reopen case confirmation: yes (confirm modal).

## Deferred Items
- Clarify whether `dormant` is intended to imply all action plans/interventions are terminal; note that `ready_to_close` is a distinct status in code and the ready-to-close API validates open plans/interventions.
- Future consideration: users have asked for the flexibility to add old action plans and old interventions to cases that also have applications. There is no obvious hard data-model blocker because action plans and interventions are case-level records, and the backend backload submit paths already key to case/action-plan scope rather than requiring an application-less case. The main risk is product/reporting meaning: `manual_backload` records are real case records that can affect case history, ILMP validation/export readiness, budget burn, finance reporting, and active-plan conflicts while intentionally skipping approval routing, assessment PDFs, CFA versions, payment packets, checklist progression, and applicant notifications.
- If the application-less condition is removed later, do not make it a blind menu unlock. Preferred direction from the 2026-05-03 design discussion: make the labels and modal copy explicitly historical, keep `metadata.source = 'manual_backload'` and `metadata.entryMode = 'existing'`, and keep payment-packet blocking and lifecycle validation.
- Follow-on design decision from 2026-05-04, point 1/workflow-bypass risk: widening `Add existing action plan` and `Add existing intervention` to application-backed cases is acceptable if the feature is restricted to `NWAC Administrator` and `Regional Manager` users, with `System Administrator` included unless deliberately excluded as a support/break-glass role. Enforce the role limit in both the Case Header UI gate and the backend `backloadMode` / `entryMode=backload` submit paths; do not rely on hiding the quick actions alone.
- Required warning if widened: before opening the add-existing form, show a simple acknowledgement modal explaining that this is for historical records only; it creates a real case record but does not start approval routing, checklist steps, payment packets, applicant notifications, or signing workflows; and current/new work that needs approval should use the normal proposal workflow. Suggested buttons: `Continue` and `Cancel`.
- Follow-on design decision from 2026-05-04, point 2/reporting meaning: backloaded historical action plans and interventions should appear in operational, service, ILMP, budget-burn, and finance reporting when they represent real historical supports. Do not exclude them merely because `metadata.source = 'manual_backload'`; rely on the stored action-plan/intervention/service/payment dates for period filtering. The source metadata remains useful for audit/explanation and for workflow-performance metrics that specifically measure work completed through normal PATH approval/timing flows.
- Follow-on design decision from 2026-05-04, point 4/document upload coupling: if the application-less condition is removed for historical action-plan/intervention backload, widen `Upload existing documents` at the same time. Keep it framed as historical document upload and make sure the upload path preserves correct document scope for application-backed cases instead of treating every historical document as application-less case-only evidence.
- Implementation decision from 2026-05-04: the widened historical-entry quick actions are no longer application-less only. Show `Add existing action plan`, `Add existing intervention`, and `Upload existing documents` on non-archived cases for `System Administrator`, `NWAC Administrator`, and `Regional Manager`; show a historical-record warning before launching any of the three actions; and reject backend `backloadMode` / `entryMode=backload` submissions from other roles.

## Implementation Progress
- [x] Add quick action layout presets and layout-switch event handler.
- [x] Update case status helpers (archive + reopen to dormant).
- [x] Refactor Case Header quick actions (role/status gating, layout actions, archive confirmation).
