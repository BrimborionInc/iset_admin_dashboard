# Case Workspace Quick Actions

Purpose: Capture the design decisions, rules, and implementation notes for Case Workspace quick actions.
Audience: Caseworking feature owners, frontend engineers, and QA.
Last Updated: 2025-12-26
Status: Complete

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
- Propose new intervention
- Manage plans and interventions
- View notes and case calendar
- Documents and messages
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
- Manage plans and interventions visibility: all roles (board layout action).
- Manage plans and interventions status gating: all statuses (layout-only action).
- View notes and case calendar visibility: all roles (board layout action).
- View notes and case calendar status gating: all statuses (layout-only action).
- Documents and messages visibility: all roles (board layout action).
- Documents and messages status gating: all statuses (layout-only action).
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
- Ready-to-close behavior: layout-only quick actions remain available.
- Quick actions ordering: use the master list order (Assign/Reassign → Propose → Manage Plans/Interventions → Notes/Calendar → Documents/Messages → ESDC Validation → Mark Ready to Close → Close → Archive → Reopen).
- Archive case confirmation: yes (confirm modal required).
- Reopen case confirmation: yes (confirm modal).

## Deferred Items
- Clarify whether `dormant` is intended to imply all action plans/interventions are terminal; note that `ready_to_close` is a distinct status in code and the ready-to-close API validates open plans/interventions.

## Implementation Progress
- [x] Add quick action layout presets and layout-switch event handler.
- [x] Update case status helpers (archive + reopen to dormant).
- [x] Refactor Case Header quick actions (role/status gating, layout actions, archive confirmation).
