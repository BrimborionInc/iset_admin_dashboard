# Case Lifecycle Operating Model

Version: 0.1.0 (Draft)  
Last Updated: 2025-09-19

## 1. Scope
- Covers post-submission lifecycle of an application (public portal submission -> internal processing -> decision & closure).
- Excludes: Draft applications (remain private to applicant; future admin purge tooling & inactivity TTL).  
- Excludes (for now): Intake triage stage (not defined per stakeholder request).  
- Includes: Assignment (manual & future auto), Assessment, Recommendation, Decision, Closure, Reassignment, Reopen (future), Appeal (future placeholder).

## 2. Lifecycle States (Initial Set)
| State | Purpose | Entered By | Exit Events |
|-------|---------|-----------|-------------|
| Received | Case just submitted; awaiting assignment | System | Auto-assigned OR Manually Assigned |
| Assigned | Case has a current owner (AA/RC/PA) and is in active work queue | Auto or Manual | Assessment Started / Reassigned |
| In Assessment | Assessor actively compiling assessment | Assessor action | Assessment Submitted / Reassigned |
| Assessment Submitted | Draft assessment completed, pending review/decision (optional review step) | Assessor | Decision Recorded / Returned for Revision |
| Revision Requested (optional) | Returned to assessor for changes | Reviewer (PA/RC) | Assessment Resubmitted |
| Decision Recorded | Formal decision captured (Approved / Denied / Other outcome) | PA or RC (PA always; RC if within purview) | Communicated / Closed |
| Closed | Administrative close; no further internal work | System / PA | Reopened (future) |

Future placeholders: Reopened, Appealed.

Lifecycle Implementation Principles:
- Status column will be ENUM (RECEIVED, ASSIGNED, IN_ASSESSMENT, ASSESSMENT_SUBMITTED, REVISION_REQUESTED, DECISION_RECORDED, CLOSED) in transitional v1. Future reopen will introduce REOPENED without retrofitting past rows.
- Transitions enforced server-side through a small finite state machine helper: validate(currentStatus, intendedTransition) -> allowed/denied reason.
- Any transition produces a CaseEvent row (type = status.change) and, if assignment changes, an AssignmentHistory row (reasonCode derived; see section 5).
- Assessment submissions create/lock Assessment row; subsequent Revision Requested unlocks (new version increment).

## 3. Transitions (High-Level)
Received -> Assigned (auto/manual)  
Assigned -> In Assessment (assessor opens & begins)  
In Assessment -> Assessment Submitted (user submits assessment)  
Assessment Submitted -> Revision Requested (optional)  
Revision Requested -> In Assessment (assessor resumes & edits)  
Assessment Submitted -> Decision Recorded  
Decision Recorded -> Closed  
Closed -> Reopened (future rule-based)  

Guardrails:  
- Only one active assessment per case at a time.  
- Reassignment allowed in Received, Assigned, In Assessment, Revision Requested (not after Decision Recorded except reopen).  

## 4. Roles & Permissions
Role definitions (cumulative visibility):
- Program Administrator (PA): Full visibility. Can assign to anyone. Can assess. Can override or reassign. Records decisions. Configures rules.
- Regional Coordinator (RC): Visibility limited to cases assigned to themselves or to Application Assessors (AAs) in their region/team. Can self-assign within purview, reassign among their AAs, assess, record decisions for their region.
- Application Assessor (AA): Only sees cases currently assigned to them. Can assess and submit assessments, respond to revision requests.

Permissions Matrix (excerpt):
| Action | PA | RC | AA |
|--------|----|----|----|
| View any case | Yes | Region only | Assigned only |
| Manual assign (to any) | Yes | Region/team only | No |
| Auto-assignment config | Yes | No | No |
| Start assessment | Yes | Yes | Yes (if assigned) |
| Submit assessment | Yes | Yes | Yes (if assigned) |
| Request revision | Yes | Yes (region only) | No |
| Record decision | Yes | Yes (region only) | No |
| Reassign post-assessment submit | Yes | Region/team only | No |

Additional Clarifications:
- Region binding for RC / AA derived from join table (UserRegion) not free-form text to avoid drift.
- PA may impersonate (view-only) an AA’s perspective for diagnostics (future feature flag) – NOT ALLOWED to submit assessment while impersonating.
- All role-derived decisions must be auditable: every privileged action (assign, decision, revision request) writes a CaseEvent row.
- AAs cannot self-unassign; reassignment always initiated by PA/RC.

## 5. Assignment Engine (Detailed Spec)
Objectives: Balanced workload, regional routing, override flexibility, auditability, deterministic first-match behavior.

### 5.1 Configuration Storage
Stored in `iset_runtime_config` (transitional) with `scope='workflow'`, `key='autoAssignment'`, `value` = JSON blob. Later may promote to dedicated `workflow_rule_set` table for versioning.

### 5.2 JSON Schema (Draft)
`$id: workflow.autoAssignment.schema.v1`
```
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["enabled", "rules", "defaultFallback"],
  "properties": {
    "enabled": { "type": "boolean" },
    "defaultFallback": { "type": "string", "enum": ["unassigned", "roundRobin:allAssessors", "roundRobin:region", "leastOpen:region", "leastOpen:global"] },
    "rules": {
      "type": "array",
      "items": { "$ref": "#/definitions/rule" },
      "maxItems": 200
    }
  },
  "definitions": {
    "rule": {
      "type": "object",
      "required": ["id", "match", "assign"],
      "properties": {
        "id": { "type": "string", "pattern": "^[a-zA-Z0-9_-]{3,64}$" },
        "priority": { "type": "integer", "minimum": 1 },
        "match": { "$ref": "#/definitions/matchExpr" },
        "assign": { "$ref": "#/definitions/assignExpr" },
        "notes": { "type": "string", "maxLength": 512 }
      },
      "additionalProperties": false
    },
    "matchExpr": {
      "type": "object",
      "oneOf": [
        {"required": ["all"]}, {"required": ["any"]}, {"required": ["field"]}
      ],
      "properties": {
        "all": {"type": "array", "items": {"$ref": "#/definitions/matchExpr"}, "minItems": 1},
        "any": {"type": "array", "items": {"$ref": "#/definitions/matchExpr"}, "minItems": 1},
        "field": {"type": "string", "pattern": "^[a-zA-Z0-9_.]{1,128}$"},
        "op": {"type": "string", "enum": ["eq", "in", "regex", "ne", "exists", "notExists"]},
        "value": {},
        "values": {"type": "array", "items": {} }
      },
      "additionalProperties": false
    },
    "assignExpr": {
      "type": "object",
      "oneOf": [
        {"required": ["userId"]},
        {"required": ["pool"]}
      ],
      "properties": {
        "userId": {"type": "string"},
        "pool": {
          "type": "object",
          "required": ["role", "method"],
          "properties": {
            "role": {"type": "string", "enum": ["AA", "RC"]},
            "region": {"type": ["string", "null"]},
            "method": {"type": "string", "enum": ["leastOpenCases", "roundRobin"]},
            "exclude": {"type": "array", "items": {"type":"string"}, "maxItems": 50},
            "capacityHint": {"type": "integer", "minimum": 1}
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

### 5.3 Evaluation Algorithm (Deterministic)
1. Load active configuration (cached; invalidate on update timestamp change). If `enabled=false` exit -> manual path (case stays RECEIVED).
2. Build evaluation context from submission/case snapshot (province, applicant metadata, channel, createdAt, previous assignments count, etc.).
3. Order rules by explicit `priority` ascending else original array index.
4. For each rule: evaluate match expression recursively (short circuit). First truthy rule proceeds; others ignored.
5. Resolve assignment target:
   - Direct userId: verify active + role authorized + region scope if RC.
   - Pool: filter users by role + optional region; remove `exclude`; discard inactive; compute load metric (# open cases in statuses RECEIVED, ASSIGNED, IN_ASSESSMENT, REVISION_REQUESTED). Method:
     - leastOpenCases: choose min(load); tie break by lexicographic userId.
     - roundRobin: persist rotating cursor per (role,region,poolIdHash) in runtime config.
6. Capacity Check (future): if `capacityHint` defined AND user load >= capacityHint -> treat as unavailable and retry pool selection (or fallback if none remain).
7. If no selectable target -> invoke fallback.
8. Perform atomic assignment (see Concurrency) and write AssignmentHistory (reasonCode = `auto:{ruleId}` or `auto:fallback` plus optional `poolMethod`).
9. Emit CaseEvent (assignment.created) and, if first assignment, transition RECEIVED -> ASSIGNED.

### 5.4 Fallback Strategy
Order:
1. Configured `defaultFallback` (interpret tokens `roundRobin:*`, `leastOpen:*`).
2. If still unresolved -> leave unassigned (RECEIVED) and log AssignmentHistory with reasonCode `auto:fallback:unassigned`.
3. Surface to PA dashboard metric (count of unassigned after auto-run).

### 5.5 Concurrency & Race Conditions
Problem: Multiple workers / retries could double-assign. Strategy:
- Use single SQL `UPDATE iset_case SET assigned_user_id=?, assigned_role=?, updated_at=NOW() WHERE id=? AND assigned_user_id IS NULL` (for first assignment) and check affected row count.
- For reassignment path ensure optimistic concurrency (WHERE assigned_user_id = expectedCurrentUserId) to prevent stale overrides.
- Wrap in transaction when also inserting AssignmentHistory to guarantee ordering; AssignmentHistory has FK to case.
- Add unique partial index approach later if needed (not required if single column null-guard update used).

### 5.6 Audit / History
- `AssignmentHistory`: (id BIGINT PK, case_id FK, from_user_id NULLABLE, to_user_id NOT NULL, to_role, reason_code VARCHAR(64), rule_id NULLABLE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP).
- `CaseEvent` entry couples for general timeline UI: type = assignment.auto | assignment.manual | assignment.reassign.
- Manual override (UI) reason captured free-text (optional 256 chars) stored in CaseEvent.metadataJSON (NOT in AssignmentHistory to keep it slim).

### 5.7 Manual Assignment Path
- Validates target user matches scoping rules (RC cannot assign outside region, AA cannot assign at all).
- If case currently unassigned: RECEIVED -> ASSIGNED transition.
- If reassigning while IN_ASSESSMENT or REVISION_REQUESTED: allowed only if `lock=false` OR assessment not submitted; after ASSESSMENT_SUBMITTED only PA/RC may reassign with reason (policy guardrail).

### 5.8 Error & Recovery Cases
| Scenario | Handling |
|----------|----------|
| Rule match returns empty pool | Log metric `assignment.pool.empty` + fallback |
| Config invalid JSON | Reject update; retain previous working config |
| All candidates at capacity | Fallback -> unassigned + metric `assignment.capacity.block` |
| Race lost (0 rows updated) | Re-fetch case; if assigned stop; else retry once |
| User disabled mid-run | Treated as unavailable; continue selection loop |

### 5.9 Metrics (Phase 1 minimal)
- assignment.auto.total
- assignment.auto.fallback.count
- assignment.manual.total
- assignment.reassign.total
- assignment.pool.empty
- assignment.capacity.block

### 5.10 Phase Gate
Phase 1 purposely excludes dynamic capacity updates and calendar/holiday load adjustments (documented future enhancements section later).

## 6. User Interface Model
Landing Pages (per role):
- PA Dashboard: KPIs (new today, awaiting assignment, SLA at risk), assignment rule health, recent decisions.
- RC Dashboard: Regional queue summary, team workload distribution, SLA at risk in region.
- AA Dashboard (future specialization): My active cases by status, upcoming revision requests, due soon.

Manage Applications (`/manage-applications` / `/case-management`):
- Filter & scope applied server-side based on role & region membership.
- Columns: Case ID, Applicant Name, Province/Territory, Status, Assigned To, Submitted Date, Aging (days), SLA risk flag.
- Bulk actions (role-dependent): Assign (PA, RC), Export (PA), Refresh.

Case Dashboard (`/application-case/:id`) foundation retained:
Recommended widget zones: Summary, Assessment Editor (conditional on state + assignment), Messaging, Documents, Events/History, Assignment Panel, Decision Panel (permission-gated), SLA Timer.

Visibility Logic (front-end hints):
- Hide Decision Panel until status >= Assessment Submitted.
- Show Revision Request controls only to PA/RC & when status = Assessment Submitted.
- Disable Assessment Editor after submission unless status=reopened or revision requested.

Navigation Principles:
- Preserve deep-linking with guarded access.
- Badges in list linking directly to filtered views (e.g., status=Received).

## 7. Data Model (Draft Outline)
Transitional Approach: Minimize disruption—augment existing `iset_case` until new tables stable; then migrate / rename in v2.

### 7.1 Core Tables (Proposed Additions / Adjustments)
1. iset_case (existing) ADD columns (if not present):
  - status ENUM('RECEIVED','ASSIGNED','IN_ASSESSMENT','ASSESSMENT_SUBMITTED','REVISION_REQUESTED','DECISION_RECORDED','CLOSED')
  - assigned_user_id BIGINT NULL (FK user.id)
  - assigned_role ENUM('PA','RC','AA') NULL
  - sla_due_at DATETIME NULL
  - decision_outcome ENUM('APPROVED','DENIED','OTHER') NULL
  - decision_at DATETIME NULL
2. assignment_history (new):
  - id BIGINT AUTO_INCREMENT PK
  - case_id BIGINT NOT NULL FK iset_case(id) ON DELETE CASCADE
  - from_user_id BIGINT NULL FK user(id)
  - to_user_id BIGINT NOT NULL FK user(id)
  - to_role ENUM('PA','RC','AA') NOT NULL
  - reason_code VARCHAR(64) NOT NULL
  - rule_id VARCHAR(64) NULL
  - created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  - INDEX(case_id, created_at)
3. assessment (new):
  - id BIGINT AUTO_INCREMENT PK
  - case_id BIGINT NOT NULL FK iset_case(id)
  - assessor_user_id BIGINT NOT NULL FK user(id)
  - version INT NOT NULL
  - status ENUM('DRAFT','SUBMITTED') NOT NULL
  - payload_json JSON NOT NULL
  - submitted_at DATETIME NULL
  - created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  - UNIQUE(case_id, version)
4. case_event (new):
  - id BIGINT AUTO_INCREMENT PK
  - case_id BIGINT NOT NULL FK iset_case(id)
  - type VARCHAR(48) NOT NULL  -- e.g., status.change, assignment.auto
  - actor_user_id BIGINT NULL FK user(id)
  - metadata_json JSON NULL
  - created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  - INDEX(case_id, created_at)
5. region (new minimal): id INT AUTO_INCREMENT PK, code VARCHAR(8) UNIQUE, name VARCHAR(64)
6. user_region (new): user_id BIGINT, region_id INT, role ENUM('RC','AA'), PRIMARY KEY(user_id, region_id, role)
7. workflow_rule_set (optional later): id BIGINT, name VARCHAR(64), active TINYINT(1), rules_json JSON, created_at, updated_at

### 7.2 Derived / Computed Fields
- sla_due_at: populated on case creation (Received) using policy (e.g., created_at + INTERVAL 14 DAY) until SLA policy refined.
- Aging (UI) computed client/server difference days: FLOOR((NOW() - created_at)/86400).

### 7.3 Index Plan (Phase 1)
- iset_case: INDEX(status, province), INDEX(assigned_user_id, status), INDEX(sla_due_at, status), INDEX(status, sla_due_at)
- assignment_history: already covered above
- assessment: INDEX(case_id, status)
- case_event: handled; consider composite index (case_id, type, created_at) for filtered retrieval.

### 7.4 Migration Order
1. Add ENUM values / columns to iset_case (backfill status -> RECEIVED for existing rows lacking status).
2. Create new tables (assignment_history, case_event, assessment, region, user_region).
3. Seed region & user_region mapping (minimal dev data) in migration or dedicated seed script (dev only).
4. Deploy code that writes to assignment_history + case_event but leaves old logic intact for read (dual-write if necessary) for one release.
5. Switch read endpoints (/api/applications) to prefer new columns after verification flag.

### 7.5 Future (Out-of-Scope Phase 1)
- Aggregation table for workload snapshots.
- Soft-delete strategy for events beyond retention window.
- Assessment rubric versioning table.

## 8. Decision Log (Current)
- Omit triage: CONFIRMED.
- Drafts remain applicant-only: CONFIRMED.
- Roles: PA, RC, AA with overlapping assessment ability: CONFIRMED.
- Auto-assignment: Required with toggle & rule engine (province-based example): CONFIRMED.
- PA override & global visibility: CONFIRMED.
- RC visibility restricted to region/team: CONFIRMED.
- Deterministic rule evaluation first-match: CONFIRMED.
- Optimistic concurrency update pattern for assignment: CONFIRMED.
- Separate AssignmentHistory & CaseEvent for lean vs rich audit: CONFIRMED.

## 9. Open Questions
1. SLA definitions (targets per status?).
2. Capacity limits per assessor (max concurrent In Assessment?).
3. Revision Requested usage frequency – always allow or enable via config?
4. Decision outcomes enumeration (Approved, Denied, Incomplete?).
5. Reopen policy (time-bounded? who can trigger?).
6. Rule authoring UX (JSON editor vs form builder?).
7. Multi-region applicants (if any) – selection logic?
8. Audit retention period & export needs?
9. Capacity definition source (static config vs dynamic utilization service?).
10. SLA policy granularity (single global vs per province / per case type?).

## 10. Next Steps (Proposed Phase 1)
1. Confirm lifecycle & status enum freeze.
2. Create DB migrations for core tables (ApplicationCase, AssignmentHistory, Assessment, CaseEvent).
3. Add runtime config keys for auto-assignment toggle + rule set (temporary single active rule set).
4. Implement backend endpoints: list cases (scoped), assign/reassign, submit assessment, request revision, record decision.
5. Enhance `/manage-applications` query with role-based scoping & server filters.
6. Extend case dashboard to show/hide panels per state & role.
7. Write initial rule evaluator (province match + leastOpenCases strategy).
8. Add audit CaseEvent entries on every transition.
9. Basic SLA timer field population (placeholder logic).
10. Collect metrics for dashboard widgets (counts per status, SLA risk count).
11. Implement concurrency-safe assignment update & retry logic.
12. Add metrics emission (simple in-memory counter + log) pending real telemetry sink.

### 10.1 Interim API (Implemented)
| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/api/case-assignment/unassigned-applications` | GET | List submissions without cases | Uses `iset_application_submission`; scoping TBD |
| `/api/intake-officers` | GET | List evaluators + PTMA label | Existing logic reused |
| `/api/cases` | GET | List assigned cases | FULL_GROUP_BY-safe (ANY_VALUE) |
| `/api/cases` | POST | Create case + copy docs | Still references `iset_application` (promotion gap) |
| `/api/cases/:case_id/application/versions` | GET | List working copy versions | New versioning API |
| `/api/cases/:case_id/application/current` | GET | Fetch current version payload | New versioning API |
| `/api/cases/:case_id/application/versions` | POST | Create new working version | Full snapshot replace |

### 10.2 Versioning Data Structures
Migration file: `sql/20250919_create_application_versioning.sql` adds:
- Columns: `original_payload_hash`, `locked_at` to `iset_application_submission`.
- Table: `iset_application_version` with chained versions and hashes.

Planned (not yet implemented): Initial seeding script creating version 1 rows from submissions when a case is created.

---
Feedback welcome; sections will iterate as clarifications arrive.
