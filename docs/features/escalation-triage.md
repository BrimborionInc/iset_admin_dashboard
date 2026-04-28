# Escalation & Triage Flows

**Purpose:** Capture design for escalating problem applications/cases and addressing them across tiers.
**Audience:** Admin dashboard engineers and product owners.
**Last Updated:** 2026-04-26

## Overview
ISET coordinators should be able to escalate cases to regional managers, who can respond with guidance, take ownership, reassign, or escalate further to Program Admins. The flow must remain auditable, role-gated, and visible in dashboards/work queues.

## Roles & Pathways
- **Coordinator → Regional Manager → Program Admin** (primary path).
- Each tier can: respond with guidance, reassign, take ownership, or escalate further (if applicable).
- Only the current escalation owner can act; originator can view status and receive responses.

## States (proposed)
- `draft` (pending submission)
- `pending_review` (awaiting current owner’s action)
- `responded` (guidance provided back to requester)
- `escalated` (sent to next tier)
- `resolved` (closed after action/ownership change)

## Data to Capture
- Requester (id/email), target (id/role), timestamps.
- Category/reason, description, optional attachments/links.
- Desired outcome (guidance, reassignment, ownership transfer, escalate further).
- Decision/outcome notes, final disposition, and any reassignment/ownership changes applied.
- Audit trail entry per transition (who, when, what changed).
- Current DB rule: escalation records are application- and case-scoped. `requester_user_id`, `current_owner_user_id`, and `resolved_by_user_id` are shared `user.id` values, not `staff_profiles.id` values.

## UX Entry Points
- **Application Overview widget:** show current escalation state and a focused “Escalate” / “Address escalation” action (role-gated).
- **Work queues:** buckets for “Escalations pending review” per role; item detail drawer shows state, requester, and actions.
- **Notifications/feed:** requester notified when guidance arrives or ownership changes; target notified on new escalation.

### Quick Actions / Escalation Entry
- Only expose escalation entry points when the application is in a non-terminal status (not `approved/completed/rejected/closed/archived`).
- Role gating for quick actions:
  - **Coordinators:** may initiate/escalate only.
  - **Regional Managers:** may both escalate (to Program Admins) and respond/resolve escalations from Coordinators.
  - **Program Admins:** may respond/resolve escalations received from Regional Managers (no further escalation).
- System Administrators can override terminal statuses for “fix” workflows, but that is outside the normal escalation loop.
- Require the application lock before allowing quick actions to avoid dueling updates; mirror the same checks server-side (defense in depth).

## API/Contracts (to define)
- Create escalation (coordinator → manager).
- Address escalation (respond with guidance, reassign, take ownership, escalate up one tier).
- List escalations for a user/role and per-case history.
- Activity log entry + optional notification dispatch per transition.

## Event Emission
- Escalation create/respond/resolve must emit new event types via the shared event service (`shared/events/*`) so they appear in timelines/feeds and can drive notifications.
- Add event type definitions to `shared/events/catalog.js` (e.g., `escalation_created`, `escalation_escalated`, `escalation_resolved/responded`) with category/severity/source metadata; keep catalog and emitters in sync.
- Payload should include actor (id/role/display), subject (case/application id), escalation id, prior/new escalation state, and optional message/notes; enforce capture toggles as with other events.

## Permissions
- Only eligible roles see the action for their tier; hide/disable otherwise.
- Only current escalation owner can act on a pending item.
- Originator and current owner can view history; audit entries visible to Program Admins.

## Homepage Integration (Work Queues)
- Use the escalation model as a data source for homepage widgets. Add a fast `has_open_escalation`/`current_escalation_id` marker on `iset_application` to avoid heavy joins for counts.
- Bucket concepts:
  - **Coordinators:** “Escalations sent” (pending manager response), “Returned with guidance.”
  - **Regional Managers:** “Escalations pending review” (from coordinators); optional “Escalate to Program Admin” for forwarded items.
  - **Program Admins:** “Exceptions & Escalations” = open escalations where `current_owner_role` = Program Admin and state is not resolved/closed.
- Items should map to the Program Admin Work Items widget shape (id, title, bucketId, summary, status, owner, region, due/age) and include escalation state/last action note.
- Counts for homepage cards derive from the escalation table filtered by role and non-terminal application status; events keep Recent Activity in sync.

## Quick Action UX (High-Level)
- Show quick actions only when the application is non-terminal and the user holds the lock; role-gate the menu (coordinator = escalate; regional manager = escalate/respond; program admin = respond only).
- Each quick action opens a modal that collects required info and confirms intent:
  - **Escalate:** reason/category, optional notes/attachments, target (manager/program admin), show resulting escalation state.
  - **Respond/resolve:** response note, disposition (return with guidance, take ownership/reassign, or escalate up if allowed).
  - **Close (if exposed):** confirm word + note; keep SysAdmin-only for fixes.
- Modal executes the action (status/escalation change) with loading/error states and lock conflict handling; on success, emit escalation events, refresh case data, and show a success acknowledgment.
- Include inline context in the modal (current escalation state/history) so users see what they are acting on.

## Implementation Progress (ongoing)
- 2025-03-17: Migration added (`sql/20250317_create_application_escalations.sql`) creating `iset_application_escalation` plus helper flags on `iset_application` (`has_open_escalation`, `current_escalation_id`).
- 2025-03-17: Event catalog updated (`../shared/events/catalog.js`) with escalation types: `escalation_created`, `escalation_escalated`, `escalation_responded`, `escalation_resolved`.
- 2025-03-17: Server endpoints scaffolded in `isetadminserver.js`:
  - `POST /api/escalations`: create escalation (coordinator/regional manager; requires lock; blocks terminal applications; one open escalation per app).
  - `POST /api/escalations/:id/respond`: respond/escalate/resolve (role-gated to current owner; lock-enforced; emits escalation events; clears helper flags on resolve).
  - `GET /api/escalations`: list escalations (defaults to owner=current role and state != resolved unless `includeResolved=true`; supports filters for state/ownerRole/requesterRole/applicationId; returns application/case status slices for homepage wiring).
- 2025-03-17: Application Overview quick actions now role/status-gated with escalation flows (escalate/respond/resolve) using lock enforcement and the new API; modals collect required notes and emit events via the backend.
- 2026-04-26: Privacy ERM cleanup added FKs for `iset_application_escalation.application_id`, `case_id`, requester/current-owner/resolver users, plus the `iset_application.current_escalation_id` helper pointer. Escalation creation now fails closed if the application cannot resolve to a case.
- 2026-04-27: Escalation create/respond now validates application visibility through the owning case before mutating, and escalation list results are filtered through case access before returning role queue metadata. Role/owner filters are not sufficient access authority by themselves.

## Decisions
- 2025-03-17: Keep application lifecycle status canonical (submitted → in_review → pending_approval → final states). Model escalation separately via a dedicated escalation record/table + event log; optionally add `current_escalation_id` / `has_open_escalation` on `iset_application` for fast filtering. This preserves lifecycle logic while allowing a state machine for escalation ownership and history.

## Open Questions / TODO
- Confirm backend endpoints/payloads and storage model (separate table vs. reuse case comments + state machine).
- Decide attachment support and storage (S3) for evidence/screenshots.
- Define SLA/aging rules for pending escalations and how they surface in work queues.
- Align with existing reassignment/ownership APIs to avoid duplicating flows.
