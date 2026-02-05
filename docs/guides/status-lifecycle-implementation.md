# Status Lifecycle Implementation Guide

This document captures the end-to-end status model in the ISET admin dashboard after the case-status realignment (CR-0012). It explains which entities expose lifecycle statuses, how we canonicalise and persist them, and where the frontend consumes the data. Use this as the source of truth when extending workflows, authoring tests, or debugging status-related issues.

---

## 1. Overview
- **Applications** track the intake lifecycle (`iset_application.status`). These reflect program decisions and remain separate from casework.
- **Document requests** are tracked independently on `iset_application` so they can overlap any application status (e.g., `decision_ready` + docs requested).
- **Cases** represent the ongoing service relationship (`iset_case.status`). The status is derived from application state and action plan activity via `recomputeCaseStatus`.
- **Action plans** and **interventions** retain their own lifecycle fields; the case status derives from the aggregate state of action plans.
- All primary APIs now return both application and case statuses so widgets can render the correct context without guessing.

---

## 2. Status Inventories

### 2.1 Application Statuses
Stored in `iset_application.status` (varchar). Canonical values:

| Canonical Value | Meaning | Typical Entry Point |
| ---------------- | ------- | ------------------- |
| `submitted` | Applicant completed the public portal submission. | Auto-ingest of `iset_application_submission`. |
| `in_review` | Case staff has claimed the application and is performing assessment work. | Manual assignment or clerical updates (optional). |
| `docs_requested` (aka “Action Required”) | Additional information is needed from the applicant. | Manual status update from Application Overview widget. |
| `closure_notice` | Closure notice sent; awaiting applicant response before closing. | Application Overview quick action. |
| `pending_approval` | Assessor submitted their review; awaiting NWAC outcome decision. | `CoordinatorAssessmentWidget.handleSubmit`. |
| `approved` | NWAC outcome marked as approved. | `CoordinatorAssessmentWidget.handleComplete` with `approve`. |
| `completed` | Post-approval processing completed (future use). | Finance/closure flows. |
| `rejected` | NWAC outcome rejected. | `CoordinatorAssessmentWidget.handleCommunicationComplete` after the denial letter is sent. |
| `declined` | Legacy decision status treated as rejected/terminal. | Legacy/imported records. |
| `cancelled` | Legacy terminal status for cancelled applications. | Legacy/imported records. |
| `closed` | Application closed (e.g., applicant withdrew or file closed administratively). | Manual status change or automation. |
| `archived` | Historical record retained, no further action. | Manual administrative action. |
| `withdrawn` | Applicant withdrew; normalized to `closed` in UI. | Legacy/imported records or portal withdrawal. |

> **Normalization:** `getApplicationStatusContext()` (in `src/utils/rbac.js`) lowercases/underscores incoming values and maps `withdrawn` to `closed`. SLA and queue logic also treat hold variants (`action_required`, `docs requested`, `closure notice`, `pending info`, `information requested`, `on_hold`) as assessment/hold states (see `APPLICATION_STATUS_HOLD_VALUES` in `isetadminserver.js`).
> **Note:** `docs_requested` remains an application status option, but document-request timing is now tracked separately (see below) so requests can overlap any status.

### 2.2 Document Request Tracking (independent of status)
Document requests are recorded on `iset_application` to allow "docs requested" to coexist with any application status.

**Fields**
- `docs_requested_active` (bool)
- `docs_requested_at` (datetime)
- `docs_requested_cleared_at` (datetime)
- `docs_requested_source` (varchar, e.g., `secure_message`, `manual`, `status`)

**Sources**
- Manual toggle in the Application Overview widget (sets `docs_requested_source = 'manual'`).
- Secure messages with form attachments (sets `docs_requested_source = 'secure_message'` and may still move status to `docs_requested`).

**Events**
- `document_request_set` and `document_request_cleared` emitted on toggle/set/clear.
- `document_request_reminder_due` and `document_request_closure_due` reserved for background jobs (thresholds configured via SLA settings).

### 2.3 Case Statuses
Stored in `iset_case.status`. Canonical set defined in `CASE_STATUS_DERIVED_VALUES` (see `isetadminserver.js`):

| Canonical Value | Meaning | Trigger |
| --------------- | ------- | ------- |
| `pending_approval` | Default state: case exists but application not yet approved. | Application ingestion or reassignment prior to approval. |
| `initiated` | Application approved but no active action plans. | Application transitions to `approved`; no plans active. |
| `active` | At least one action plan is active. | Action plan activate/create or manual status update. |
| `dormant` | Plans exist but all are closed/archived. | All plans closed/archived while case not yet ready to close. |
| `ready_to_close` | No active plans and closure prerequisites satisfied (placeholder logic). | `recomputeCaseStatus` when closure checklist satisfied. |
| `closed` | Casework complete and formally closed. | Manual close action or automation. |
| `archived` | Historical record retained, no further activity. | Administrative archive. |

> **Note:** Stage/sub-stage columns are deprecated. All consumers must rely on the derived case status above.

### 2.4 Action Plan Statuses
Persisted in `iset_case_action_plan.status`:

- `draft` – optional staging state.
- `active` – plan currently in execution.
- `closed` – plan was completed.
- `archived` – plan retained for history, no updates allowed.

### 2.5 Intervention Statuses
Persisted in `iset_case_intervention.status`. Common values:

- `planned`
- `in_progress`
- `suspended` / `on_hold`
- `completed`
- `failed_to_report`
- `cancelled`

The set is intentionally broad to accommodate funder reporting requirements; case status ignores these directly but action plan metrics may incorporate them.

**Outcome handling:**
- ESDC outcome codes now derive from status. Open states (`planned`, `in_progress`, `suspended`) always persist outcome code `02 – In progress`.
- The close workflow (available only when editing an open intervention) gathers the final status (`completed` or `cancelled`) and unlocks the ESDC outcome selector for the terminal code that should be persisted.
- Closed interventions surface the ESDC outcome in read-only form both in the modal and in the Interventions table (column renamed to "ESDC Outcome").

---

## 3. Transition Rules

### 3.1 Application → Case Interactions
1. **Submission** (`submitted`): auto-created `iset_case` row defaults to `pending_approval`.
2. **Assessment Submitted** (`pending_approval`): triggered in `CoordinatorAssessmentWidget.handleSubmit`, which sends `status: 'pending_approval'` via `PUT /api/cases/:id`. Backend persists the new application status and recalculates action plan-derived case status (which typically remains `pending_approval` until approval).
3. **Outcome Decision** (`approved` / `rejected`): `handleComplete` records the decision and moves the application to `decision_ready`. For denials, the application status moves to `rejected` only after the denial letter is sent in the communication step; approvals continue to follow the approval/funding-docs path. When the outcome is **approved** the server also seeds an initial action plan and intervention from the NWAC recommendation. As of 2026‑02 the auto-generated plan always starts in `draft` (regardless of the recommended start date) and the intervention in `planned`, keeping the case in `initiated` until a caseworker explicitly activates the plan.
4. **Manual Overrides**: The Application Overview widget can POST/PUT `status` changes via `PUT /api/cases/:id`. Locks ensure only one user manipulates state at a time.
5. **Secure Messaging with forms**: Sending a secure message with attached forms from the Application Workspace while status is `submitted` or `in_review` sets `docs_requested_active` and updates the application status to `docs_requested` so the applicant action is still visible.
6. **Manual doc-request toggle**: The Application Overview widget can set/clear `docs_requested_active` without changing application status, and the secure-message flow auto-clears document requests once all signing requests are complete.

### 3.2 Case Status Derivation
Implemented in `recomputeCaseStatus(caseId)` (see `isetadminserver.js`):
- Loads action plan summary: counts active, closed, archived plans.
- Evaluates application status to detect pre-approval scenarios.
- Applies ordered rules (pseudo):
  1. If application status is not approved and there is no active plan ⇒ `pending_approval`.
  2. If application approved and zero plans ⇒ `initiated`.
  3. If any plan `active` ⇒ `active`.
  4. If no active plans but at least one closed ⇒ `dormant` (or `ready_to_close` when closure criteria satisfied).
  5. If case flagged for closure ⇒ `ready_to_close` / `closed` / `archived` as per manual actions.
- Writes the derived value back to `iset_case.status` and returns it to callers.
- Invoked after plan create/update/close/archive endpoints and wherever application status changes (`/api/cases/:id` PUT, assignment flows, etc.).

### 3.3 Action Plan & Intervention Implications
- Activating an action plan (`POST /api/action-plans/:id/activate`) or creating an active plan forces case status to `active` via `recomputeCaseStatus`.
- Closing or archiving the last active plan moves the case to `dormant` unless other logic upgrades it to `ready_to_close`. A guard now blocks plan closure while any linked intervention remains in an open state; the API response lists the blocking interventions so caseworkers can jump straight to the Interventions widget to finish them.
- Intervention status updates do not directly change case status; instead they influence plan health metrics surfaced in widgets/counts.

---

## 4. Technical Implementation

### 4.1 Backend
- **Constants & Helpers**: `CASE_STATUS_DERIVED_VALUES`, `CASE_STATUS_PRIORITIES`, and `normaliseCaseStatusValue` reside in `isetadminserver.js`. The RBAC helper `getCaseStatusContext` (in `src/utils/rbac.js`) maps raw strings to canonical values and signals pending/final states.
- **Recompute Hook**: `async function recomputeCaseStatus(caseId)` handles the derivation. Called from:
  - Action plan create/activate/update/close/archive endpoints.
  - Case assignment and status update endpoints.
  - Application approval workflows (assessment submission & outcome completion).
- **API Surface**:
  - `/api/cases/:id` now returns both `status` (case) and `application_status` (application). This query must always project `a.status AS application_status`; earlier omissions caused null application statuses downstream.
  - `/api/cases/:id` returns `docs_requested_*` fields and accepts `docsRequested` + `docsRequestedSource` updates; these emit `document_request_set`/`document_request_cleared` events.
  - `/api/cases` summary list also surfaces both values for dashboards.
  - `/api/cases/:id/workspace` continues to provide the full workspace payload; ensure any new fields added here stay in sync with the case summary query.
  - `/api/signing-requests/:id/sign` clears `docs_requested_active` for secure-message requests once all forms are signed and emits a `document_request_cleared` event.

### 4.2 Frontend
- **Normalization**: `normaliseCasePayload` (in `ApplicationCaseDashboard`) copies `application_status` into `applicationStatus` for widgets. The dashboard caches responses in `window.__ISET_CASE_CACHE`; every code path must normalise before caching or rehydrating.
- **Application Overview Widget**:
  - Reads `caseData.applicationStatus` preferentially, falling back to live `/api/applications/:id` data if needed.
  - On manual status change triggers `actions.refreshCaseData()` so sibling widgets update immediately.
  - Displays a separate Docs Requested badge + toggle and persists `docs_requested_active` independently of status.
- **Coordinator Assessment Widget**:
  - Uses `getApplicationStatusContext` and `getCaseStatusContext` to decide which panels to show.
  - Calls `actions.refreshCaseData()` after successful submit or outcome decision, ensuring the Application Overview widget reflects the new status without page reloads.
- **Badges & Tables**: Portfolio and workspace headers display derived case status badges; they no longer present stage/sub-stage chips.
- **Portfolio filtering**: The ISET Case Portfolio widget defaults to `initiated`, `active`, `dormant`, `ready_to_close`, `closed`, and `archived` statuses so newly submitted (`pending_approval`) cases remain on the assessor dashboard rather than the portfolio view.

### 4.3 Data Synchronisation Lessons
During the November 2025 testing cycle the NWAC widget kept showing the outcome notice prematurely because `/api/cases/:id` omitted `application_status`. We spent hours debugging front-end caching (`__ISET_CASE_CACHE`) before identifying the missing SQL column. Always validate API projections first when a widget reports stale data—especially when new fields were recently introduced.

---

## 5. Operational Notes
- **Caching**: When debugging status flows, clear `window.__ISET_CASE_CACHE` to force a refetch. Long-lived caches can retain stale data if the API response is incomplete.
- **Testing**: End-to-end tests should walk an application through:
  1. Submission (`submitted` → case `pending_approval`).
  2. Assessment submission (`pending_approval`).
  3. Outcome approval (`approved`, case transitions to `initiated`/`active` depending on plans).
  4. Action plan activation and closure to exercise `active` → `dormant` transitions.
- **Backfill/Migration**: The original migration used action plan summaries to backfill existing cases; rerun or adapt this logic if importing historical datasets.

---

## 6. Quick Reference
- **Backend Source**: `isetadminserver.js` (`CASE_STATUS_DERIVED_VALUES`, `recomputeCaseStatus`, `/api/cases/:id` handler).
- **Frontend Source**: `src/pages/applicationCaseDashboard.js`, `src/widgets/ApplicationOverviewWidget.js`, `src/widgets/CoordinatorAssessmentWidget.js`.
- **Helpers**: `src/utils/rbac.js` (`getCaseStatusContext`, `getApplicationStatusContext`, `canonicalizeStatus`).
- **Documentation Links**: CR-0012 implementation log and `docs/guides/case-workspace-guidance.md` for ongoing updates.

Keep this guide updated whenever new status values, transitions, or automation paths are introduced.
