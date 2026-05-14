# Status Lifecycle Implementation Guide

This document captures the end-to-end status model in the ISET admin dashboard after the case-status realignment (CR-0012). It explains which entities expose lifecycle statuses, how we canonicalise and persist them, and where the frontend consumes the data. Use this as the source of truth when extending workflows, authoring tests, or debugging status-related issues.

> Important: this guide now reflects the current DEV implementation, not yet a completed TEST/PROD rollout. DEV now dual-writes additive application lifecycle/decision fields and canonical case lifecycle fields while preserving legacy compatibility columns during cutover. The agreed long-term entity model is tracked separately in `docs/planning/client-case-application-target-model.md`, and the broader target status redesign remains in `docs/planning/status-architecture-overhaul.md`.

---

## 1. Overview
- **Applications** still expose legacy `iset_application.status`, but DEV now also writes additive workflow fields (`application_lifecycle_status`, `decision_outcome`, awaiting/closure qualifiers) so workflow, decision, and blocker state can be separated during the migration.
- **Application SLA stages** are derived, not stored. PATH currently chooses the active SLA milestone from application status, assignment state, and `assessment_esdc_eligibility`.
- **Document requests** are tracked independently on `iset_application` so they can overlap any application status (e.g., `approved` + docs requested).
- **Cases** represent the ongoing service relationship. DEV now persists canonical lifecycle in `iset_case.lifecycle_status` and keeps legacy `iset_case.status` aligned for compatibility during cutover.
- **Action plans** retain their own lifecycle field; intervention proposal review state and live intervention delivery state are now being separated during the DEV cutover.
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
| `on_hold` | Application is intentionally parked while PATH waits on an external funding answer, future start date, applicant-requested pause, internal follow-up, or other scheduled hold reason. | Application Overview `Put on hold` quick action. |
| `pending_approval` | Assessor submitted their review; awaiting NWAC outcome decision. | `CoordinatorAssessmentWidget.handleSubmit`. |
| `approved` | NWAC outcome approved; approval correspondence and funding-signature follow-up may still be outstanding. | `CoordinatorAssessmentWidget.handleComplete` with `approve`. |
| `completed` | Post-approval correspondence and required funding-form/signature follow-up are complete. | `CoordinatorAssessmentWidget.handleFundingDocsComplete`. |
| `rejected` | NWAC outcome denied. | `CoordinatorAssessmentWidget.handleComplete` with `reject`, or legacy denial records finalized in `handleCommunicationComplete`. |
| `declined` | Legacy decision status treated as rejected/terminal. | Legacy/imported records. |
| `cancelled` | Legacy terminal status for cancelled applications. | Legacy/imported records. |
| `closed` | Application closed administratively. | Manual status change or automation. |
| `archived` | Historical record retained, no further action. | Manual administrative action. |
| `withdrawn` | Applicant withdrew; lifecycle normalizes to `closed` while staff-facing status displays as `Withdrawn`. | Application Overview `Withdraw application` quick action, legacy/imported records, or portal withdrawal. |

> **Normalization:** `getApplicationStatusContext()` (in `src/utils/rbac.js`) lowercases/underscores incoming values and maps `withdrawn` to `closed` for lifecycle, permission, and queue semantics. Display helpers preserve the staff-facing `Withdrawn` label when the raw application status or closure reason is `withdrawn`. `on_hold` persists as the raw workflow status but normalizes to application lifecycle `awaiting_applicant`; homepage queue logic gives it a dedicated `On Hold` bucket instead of mixing it into active assessment. SLA timing returns no active stage while an application is parked.
> **Note:** `docs_requested` remains an application status option, but document-request timing is now tracked separately (see below) so requests can overlap any status.
> **DEV migration note:** the development branch now also writes `application_lifecycle_status`, `decision_outcome`, `application_awaiting_reason`, and `application_closure_reason`. `iset_application.status` remains in place as the legacy compatibility field until rollout and backfill are complete.

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

### 2.2A Application On Hold / Parking

`on_hold` is an application workflow status for open files that should be revisited later without closing, denying, or leaving them in active assessment/decision queues.

- Persistence: `iset_application.status = 'on_hold'`, `iset_application.lifecycle_status = 'awaiting_applicant'`.
- Reason: `iset_application.awaiting_reason` stores one of `external_funding`, `future_start`, `applicant_pause`, `internal_follow_up`, `other_hold`, or generic `on_hold`.
- Entry point: Application Overview `Quick actions > Put on hold`.
- The quick action asks for a reason, optional note, and review date; the review date creates an `iset_case_reminder` with category `Application hold review`.
- Queue behavior: homepage `On Hold` buckets use raw workflow status `on_hold`; active `In Assessment`, `Missing Docs`, and SLA-stage queues exclude parked files.
- Exit path: `Resume review` moves the application back to `in_review`.

### 2.2B Application SLA Stages
PATH currently derives the active application SLA stage from live record state rather than storing a separate SLA-stage column.

| SLA Stage | Derived When | Current Helper |
| --------- | ------------ | -------------- |
| `assignment` | File is still unassigned. | `getApplicationSlaStageKey()` / `src/utils/applicationSla.js` |
| `ei_status_verification` | File is assigned and `assessment_esdc_eligibility` is still blank while the application remains in pre-decision review. | same |
| `assessment` | EI status has been recorded and the file is still in active assessment/hold review. | same |
| `program_decision` | Application status is `pending_approval` (plus legacy `decision_ready` rows). | same |

Current implementation note:
- Due/overdue milestones are still anchored to the original application submission/creation timestamp.
- The stage can change as assignment and EI status change, but PATH does not yet persist dedicated per-stage start timestamps.
- Frontend source of truth: `src/utils/applicationSla.js`
- Backend source of truth: `getApplicationSlaStageKey()` and `computeApplicationSlaTiming()` in `isetadminserver.js`

### 2.3 Case Statuses
Canonical lifecycle is now stored in `iset_case.lifecycle_status` in DEV, with `iset_case.status` kept aligned as a compatibility mirror during cutover. Canonical set defined in `CASE_STATUS_DERIVED_VALUES` (see `isetadminserver.js`):

| Canonical Value | Meaning | Trigger |
| --------------- | ------- | ------- |
| `intake` | Default case lifecycle before service delivery begins. | Application ingestion/receipt, reassignment, or returned-for-changes review state. |
| `initiated` | Application approved but no active action plans. | Application transitions to `approved`; no plans active. |
| `active` | At least one action plan is active. | Action plan activate/create or manual status update. |
| `dormant` | Plans exist but all are closed/archived. | All plans closed/archived while case not yet ready to close. |
| `ready_to_close` | No active plans and closure prerequisites satisfied (placeholder logic). | `recomputeCaseStatus` when closure checklist satisfied. |
| `closed` | Casework complete and formally closed. | Manual close action or automation. |
| `archived` | Historical record retained, no further activity. | Administrative archive. |

> **Note:** `pending_approval` and `rejected` are no longer valid target case lifecycle values in DEV. Legacy rows with those values are normalized to canonical lifecycle on read and progressively removed from write paths.

### 2.4 Action Plan Statuses
Persisted in `iset_case_action_plan.status`:

- `draft` – optional staging state.
- `active` – plan currently in execution.
- `closed` – plan was completed.
- `archived` – plan retained for history, no updates allowed.

### 2.5 Intervention Statuses
Persisted in `iset_case_intervention.status`. Common values:

- `draft`
- `submitted`
- `in_review`
- `changes_requested`
- `approved`
- `rejected`
- `in_progress`
- `suspended`
- `completed`
- `cancelled`

The intervention status set is now canonical and single-source. `approved` is the pre-start approved state; `planned`, `on_hold`, and `ready_to_close` are not valid intervention statuses.

**DEV migration note:**
- Proposal-review state is now also dual-written into `iset_intervention_proposal.review_status`.
- Live delivery state is now carried separately in `iset_case_intervention.delivery_status`.
- During cutover, queues and workspaces should prefer derived `review_status` / `delivery_status` over raw legacy `status`.

**Outcome handling:**
- ESDC outcome codes now derive from status. Open delivery states (`approved`, `in_progress`, `suspended`) always persist outcome code `02 – In progress`.
- The close workflow (available only when editing an open intervention) gathers the final status (`completed` or `cancelled`) and unlocks the ESDC outcome selector for the terminal code that should be persisted.
- Closed interventions surface the ESDC outcome in read-only form both in the modal and in the Interventions table (column renamed to "ESDC Outcome").

---

## 3. Transition Rules

### 3.1 Application → Case Interactions
1. **Submission** (`submitted`): application receipt resolves or creates the client and case; the case lifecycle starts at `intake`.
2. **Assessment Submitted** (`pending_approval` on the application): `CoordinatorAssessmentWidget.handleSubmit` now keeps case lifecycle at `intake` while moving the application into the pending-decision stage.
3. **Outcome Decision** (`approved` / `rejected` / returned for changes): `handleComplete` records the decision immediately on the application. Approvals move the application to `approved` and the case to `initiated`; denials move the application to `rejected` and the case to `closed`; `Request Changes` returns the application to `in_review` and the case to `intake`.
4. **Manual Overrides**: The Application Overview widget can still POST/PUT changes via `PUT /api/cases/:id`, but DEV now writes canonical case lifecycle plus additive application lifecycle/decision fields rather than relying on one overloaded case status value.
5. **Secure Messaging with forms**: Sending a secure message with attached forms from the Application Workspace while status is `submitted` or `in_review` sets `docs_requested_active` and updates the application status to `docs_requested` so the applicant action is still visible.
6. **Manual doc-request toggle**: The Application Overview widget can set/clear `docs_requested_active` without changing application status, and the secure-message flow auto-clears document requests once all signing requests are complete.

### 3.2 Case Status Derivation
Implemented in `recomputeCaseStatus(caseId)` (see `isetadminserver.js`):
- Loads action plan summary: counts active, closed, archived plans.
- Evaluates application lifecycle/decision state to detect pre-service and post-decision scenarios.
- Applies ordered rules (pseudo):
  1. If there is no active plan and the case has not yet entered delivery lifecycle ⇒ `intake`.
  2. If application approved and zero plans ⇒ `initiated`.
  3. If any plan `active` ⇒ `active`.
  4. If no active plans but at least one closed ⇒ `dormant` (or `ready_to_close` when closure criteria satisfied).
  5. If case flagged for closure ⇒ `ready_to_close` / `closed` / `archived` as per manual actions.
- Writes the derived value back to `iset_case.lifecycle_status`, mirrors compatibility `iset_case.status`, and returns it to callers.
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
  - `/api/cases/:id` now returns both case lifecycle and application workflow fields. In DEV that includes compatibility `status`, canonical `lifecycle_status`, legacy `application_status`, and additive application fields such as `application_lifecycle_status` and `decision_outcome`.
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
- **Portfolio filtering**: The ISET Clients table sends the default case lifecycle set (`initiated`, `active`, `dormant`, `ready_to_close`, `closed`, and `archived`) to `/api/cases`, so newly submitted/intake-only cases remain on the assessment surfaces rather than the case-management client list. The widget's `Show` selector then narrows that list with `clientCategory`: `active` means `initiated`/`active`/`ready_to_close` and excludes reporting-only files; `funded` means at least one positive funded intervention amount in effective status `approved`, `in_progress`, `suspended`, `completed`, or `cancelled`; `dormant` means `dormant`/`closed`/`archived`; `ineligible_reporting` means files flagged `reportingOnlyDeniedIneligible`; `all` includes ordinary and reporting-only files within the default lifecycle set.

### 4.3 Data Synchronisation Lessons
During the November 2025 testing cycle the NWAC widget kept showing the outcome notice prematurely because `/api/cases/:id` omitted `application_status`. We spent hours debugging front-end caching (`__ISET_CASE_CACHE`) before identifying the missing SQL column. Always validate API projections first when a widget reports stale data—especially when new fields were recently introduced.

---

## 5. Operational Notes
- **Caching**: When debugging status flows, clear `window.__ISET_CASE_CACHE` to force a refetch. Long-lived caches can retain stale data if the API response is incomplete.
- **Testing**: End-to-end tests should walk an application through:
  1. Submission (`submitted` → case `intake`).
  2. Assessment submission (`pending_approval` on the application while case remains `intake`).
  3. Outcome approval (`approved`, case transitions to `initiated`/`active` depending on plans).
  4. Outcome denial (`rejected`, case transitions to `closed`).
  5. Action plan activation and closure to exercise `active` → `dormant` transitions.
- **Backfill/Migration**: The original migration used action plan summaries to backfill existing cases; rerun or adapt this logic if importing historical datasets.

---

## 6. Quick Reference
- **Backend Source**: `isetadminserver.js` (`CASE_STATUS_DERIVED_VALUES`, `recomputeCaseStatus`, `/api/cases/:id` handler).
- **Frontend Source**: `src/pages/applicationCaseDashboard.js`, `src/widgets/ApplicationOverviewWidget.js`, `src/widgets/CoordinatorAssessmentWidget.js`.
- **Helpers**: `src/utils/rbac.js` (`getCaseStatusContext`, `getApplicationStatusContext`, `canonicalizeStatus`).
- **Documentation Links**: CR-0012 implementation log and `docs/guides/case-workspace-guidance.md` for ongoing updates.

Keep this guide updated whenever new status values, transitions, or automation paths are introduced.
