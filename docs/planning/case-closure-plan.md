# Case Closure Plan (Draft)

Status: Draft (not implemented)  
Owners: Admin team / Casework  
Last updated: 2025-11-22

## Purpose
Define the expected behaviour, checks, and system impacts when closing a case. This plan deliberately defers implementation until ARMS export integration and financial management are available.

## Entry Criteria (must be true before closure)
- Case status is `ready_to_close` (set via “Mark ready to close” flow).
- No active or draft action plans (only closed/archived).
- No planned/active interventions (only completed/cancelled/archived if supported).
- No open or future-dated reminders or tasks.
- ILMP validation status = clean (blocking issues = 0).
- Finance validation status = clean (once finance module is live).

## Closure Actions (once criteria pass)
1) Set case status to `closed` and update row version; persist audit event (who/when/how).
2) Lock case for mutations: prevent edits to plans, interventions, documents, and messages (read-only history).
3) Finalize ILMP payload: ensure latest clean validation and store a closure snapshot (once export integration exists).
4) Finalize finance: freeze budget/actuals/commitments and store a closure snapshot (once finance module exists).
5) Close outstanding items: mark remaining reminders/tasks complete or cancelled with a system note.
6) Add system note summarizing closure (actor, timestamp, blockers=none/overridden).

## Visibility / UX
- Portfolio table: show as `Closed`, excluded from active/ready queues.
- Case workspace: read-only; show closure banner with actor/time and links to ILMP/finance snapshots.
- Reopen: explicit, audited action (role-gated). Reopen should re-run validation and revert status to `dormant` or `active` with clear rationale.

## Data / API Impacts
- New endpoint: `POST /api/cases/:id/close` with dry-run option to return blockers (plans, interventions, reminders, validation).
- Event emission: `case.closed` with metadata (actor, timestamps, validation summaries, snapshots).
- Snapshots: persist ILMP export and finance snapshot references (storage keys/checksums) when modules are available.
- Locks: enforce read-only guards in existing mutation endpoints for closed cases, with an override path only for reopen flows.

## Open Questions
- Finance rules for “clean”: what checks block closure? (overspend? pending reimbursements?)
- Reopen policy: which roles, what states allowed, and do we re-run ILMP/finance validations automatically?
- Messaging/documents: do we allow inbound applicant messages post-closure, and how do we surface them?

## Deferred Items (post-ARMS/finance)
- ARMS export orchestration on closure.
- Finance finalization and reconciliation hooks.
- UI for closure confirmation, blocker display, and reopen flow.
