# Application Case Dashboard Widgets Catalog

Purpose: Record the full intended / previously present widget set for the Application Case Dashboard so we can deliberately re‑enable them one at a time after the stabilization phase (during which only Supporting Documents remains active).

## Current State (Stabilization Mode)
Active widget only:
- SupportingDocumentsWidget (id: `supporting-documents`) – unified applicant / case documents.

All other widgets are temporarily removed from the board composition in `src/pages/applicationCaseDashboard.js` to avoid 500s and schema-mismatch churn while the backend evolves.

## Widget Inventory (To Reintroduce Incrementally)
Below each widget: purpose, critical backend dependencies, and re‑enablement prerequisites.

1. IsetApplicationFormWidget (id: `iset-application-form`) – ACTIVE (refactored)
   - Purpose: Read-only rendering of the submitted application (dynamic JSON driven).
   - Data Source: `/api/applications/:id` (now consumed via `apiFetch`; widget parses `payload_json` if present).
   - Implementation Notes (2025-09-20 refactor):
     * Removed direct flat column assumptions; uses resolver over `application`, `__payload.answers`, and `submission_snapshot`.
     * Income / expense tables computed from config arrays; gracefully default 0 / empty.
     * Case summary PUT unchanged; save feedback via Flashbar.
     * Safe parsing of stringified `payload_json`.
   - Follow-ups: If field taxonomy changes, update only the resolver mapping arrays (no layout rewrite needed).

2. CoordinatorAssessmentWidget (id: `assessment`)
   - Purpose: Capture / edit assessment fields (employment goals, barriers, recommendation, wage, dates, etc.).
   - Depends on: Writable `/api/cases/:id` (PUT) or dedicated assessment endpoint; assessment columns present in `iset_case` (already partially present); role-based auth for who can edit.
   - Prereqs: Finalize which assessment columns survive migration; confirm RBAC.

3. SecureMessagesWidget (id: `secure-messages`)
   - Purpose: View and send secure messages; adopt attachments into `iset_document`.
   - Depends on: Message list endpoint (existing), message create endpoint, attachment adoption endpoint, and applicant user identifier (`applicant_user_id`).
   - Prereqs: Stable applicant identity derivation in `/api/cases/:id` fallback; confirm attachment adoption remains idempotent.

4. CaseUpdates (caseUpdates.js) (id: `case-updates`)
   - Purpose: Timeline of recent events (submitted, documents added, assignments, etc.).
   - Depends on: `/api/case-events` with filtering & read/unread semantics.
   - Prereqs: Event emission parity across key flows; finalize event type taxonomy.

5. CaseTasks (caseTasks.js) (id: `case-tasks`)
   - Purpose: Display tasks linked to events or manual creation (future work).
   - Depends on: Tasks table + CRUD endpoints (partial / planned). Currently may be stubbed.
   - Prereqs: Decide persistence model & lifecycle (open/complete/auto-close).

6. (Optional) ApplicationEvents / notificationSettingsWidget (id: `notification-settings`)
   - Purpose: Admin configuration of which events trigger notifications and channels.
   - Depends on: `/api/events` and notification settings endpoints (in-progress / prototype).
   - Prereqs: Harden event registry & template linkage.

7. IsetEvaluatorsWidget (id: `evaluators`)
   - Purpose: Display staff/evaluator availability & allow assignment.
   - Depends on: Evaluator / staff profiles source (currently fallback to `staff_profiles`).
   - Prereqs: Decide canonical evaluator schema (retain `iset_evaluators` or consolidate into `staff_profiles`).

8. (Future) Reinstated combined Application Overview widget (if created) bundling summary stats.

## Suggested Re-Enable Order
1. IsetApplicationFormWidget (low write risk, read-only).
2. CaseUpdates (observability for subsequent widget actions).
3. SecureMessagesWidget (communication channel) – requires applicant identity stability.
4. CoordinatorAssessmentWidget (writes to case record; ensure migration complete first).
5. CaseTasks (once task lifecycle endpoints finalized).
6. IsetEvaluatorsWidget (after evaluator/staff schema decision).
7. NotificationSettings (after event taxonomy & templates stabilized).

## Technical Guardrails for Reintroduction
- Each widget added back should: (a) Feature-flag or conditional mount; (b) Use `apiFetch`; (c) Handle missing optional fields gracefully; (d) Avoid causing the entire dashboard to block rendering.
- `/api/cases/:id` must always return a minimal object with: `id`, `application_id`, `status` (plus applicant identity or explicit nulls) — never 500.
- Use progressive enhancement: attempt richer joins only when columns and tables confirmed present (already pattern in fallback logic).

## File References
- Dashboard composition: `src/pages/applicationCaseDashboard.js`
- Widgets directory: `src/widgets/`
  - Application form: `IsetApplicationFormWidget.js`
  - Assessment: `CoordinatorAssessmentWidget.js`
  - Secure messages: `SecureMessagesWidget.js`
  - Supporting docs: `SupportingDocumentsWidget.js`
  - Case updates: `caseUpdates.js`
  - Tasks: `caseTasks.js`
  - Evaluators: `IsetEvaluatorsWidget.js`
  - Notification settings: `notificationSettingsWidget.js`

## Open Questions to Resolve Before Full Restore
- Final canonical source of applicant identity if `a.user_id` column remains absent (submission join vs derived user mapping).
- Assessment columns: confirm which remain in `iset_case` vs move to versioned table.
- Task model: adopt existing event-driven tasks or create dedicated workflow.
- Evaluator schema convergence: unify `iset_evaluators` and `staff_profiles` to avoid double maintenance.
- Event taxonomy & notification templates: lock stable identifiers to prevent migration churn.

## Next Action
When beginning reintroduction, create a small helper in the dashboard to compose `boardItems` from an ordered feature list that checks environment readiness (schema + endpoints) before pushing each widget. This avoids repeated manual edits.

---
Document created: 2025-09-20
