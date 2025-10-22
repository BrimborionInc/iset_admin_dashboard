Status Tracking — Unified Design and Implementation Plan

Goal
- Deliver a consistent, auditable application “status” across the public portal (ISET‑intake) and the admin portal (admin‑dashboard), with clear state transitions, UI surfaces, and events.

Current State (as of 2025‑09‑22)
- Public portal
  - Shows friendly statuses (e.g., submitted, approved) on the dashboard card, not backed by a canonical field.
  - Emits case events (application_submitted, document_uploaded, etc.).
- Admin portal
  - Case table has fields status and stage; stage is partially used (assessment_submitted, review_complete).
  - Application Events widget lists events (from iset_case_event).
  - No single canonical status across both apps.
- Submission pipeline
  - iset_application_submission.status tracks ingestion: submitted|validated|ingested|errored.

Canonical Model (proposal)
- Source of truth for “application status”: iset_case.status (VARCHAR).
- “Workflow stage” remains in iset_case.stage (e.g., assessment_submitted), orthogonal to status.
- Public portal reads status via join from iset_case.
- Status set evolves at product layer; DB stays VARCHAR with validation at API boundaries.

Status Set (v1)
- draft (before submission; portal only)
- submitted (initial, post‑submission and case creation)
- in_review (coordinator/NWAC reviewing)
- docs_requested (action required by applicant)
- approved (funding or decision approved)
- completed (service delivered/closed)
- rejected (not approved)
- withdrawn (cancelled by applicant)

Events Mapping (examples)
- application_submitted → status: submitted (set automatically on case creation)
- assessment_submitted → stage: assessment_submitted (status may remain in_review)
- nwac_review_submitted → stage: review_complete
- decision_approved → status: approved
- decision_rejected → status: rejected
- requirements_requested → status: docs_requested
- case_completed → status: completed

APIs (target surface)
- Admin server (isetadminserver.js)
  - GET /api/cases/:id → returns status, stage, applicant_user_id, tracking_id
  - PUT /api/cases/:id { status?, stage?, … } → validates and updates status/stage; logs status_changed/… events
  - PUT /api/cases/:id/status { status } → thin wrapper (optional convenience)
  - PUT /api/cases/:id/stage { stage } → already present
- Public portal (server.js)
  - On dynamic finalize (/api/intake/complete): ensures case row exists and (if new) status=submitted
  - Applicant dashboard endpoints include current status via join to iset_case

UI Surfaces
- Public portal
  - Dashboard ApplicationCard: show canonical status from case join (fallback to submitted if missing)
  - “Action required” banner when status=docs_requested
- Admin portal
  - CoordinatorAssessmentWidget: add “Case status” Select (disabled until minimal fields complete)
  - ApplicationCaseDashboard header: show status pill + stage pill
  - Application Events widget: render status_changed entries

Data & Migrations
- Keep iset_case.status as VARCHAR; add NOT NULL default 'open' (no enum to allow agility)
- Backfill: set status='submitted' for cases created from submissions that lack status
- Indexes: KEY idx_case_status (status), KEY idx_stage (stage) for dashboards/filters

Stage Plan (management checkpoints)
1) Discovery & Guardrails
   - Confirm status set v1 fits program operations
   - Validate RBAC on status updates (SysAdmin, Program Admin, Coordinator)
   - Acceptance: signed‑off list + role matrix

2) Data Model + Migrations
   - Add/verify case.status + indexes; default handling and backfill script
   - Acceptance: SQL applied; backfill complete; no integrity errors

3) Admin API
   - Harden PUT /api/cases/:id for status; add optional /status endpoint
   - Emit status_changed event with { from, to, actor }
   - Acceptance: cURL tests pass; events visible in Application Events

4) Admin UI
   - CoordinatorAssessmentWidget: add Status select; persist via API
   - Dashboard header: show status & stage badges
   - Acceptance: manual flows update status and render instantly

5) Public API & UI
   - Join status in submission/application reads for portal dashboard
   - Map case.status to portal labels (no hardcoded fallbacks)
   - Acceptance: portal shows synced status; no regressions

6) Events & Automation
   - Ensure key transitions auto‑emit events (submitted → in_review, docs_requested, etc.)
   - Optional: notifications on docs_requested/approved
   - Acceptance: event feed reflects transitions

7) RBAC, Auditing, Telemetry
   - Enforce roles for status changes; record actor_id in status_changed event_data
   - Add basic metrics (counts by status)
   - Acceptance: permission tests; metrics endpoint returns counts

8) Rollout & Docs
   - Feature flag exposure; staged rollout
   - Update admin and dev docs
   - Acceptance: FF off/on works; docs merged

Implementation Tasks (initial)
- [x] SQL: add indexes for iset_case.status, iset_case.stage (migration file)
- [x] Admin API: validate and persist status; log status_changed
- [x] Admin UI: status select in CoordinatorAssessmentWidget
- [x] Public API: include status in dashboard list and detail
- [x] Public UI: read canonical status and display
- [x] Backfill script: set status='submitted' where NULL
- [x] Persist coordinator assessment data in new iset_case_assessment table
- [ ] QA checklist: transitions, events, permissions

Testing Strategy
- Unit: API validators; event logging payloads
- Integration: end‑to‑end submit → status reflects across portals
- Manual: role‑based update attempts

Risks / Mitigations
- Divergence between stage and status → Clear owner: status=user‑visible decision; stage=workflow state
- Legacy data w/o case rows → guard join with left joins and safe defaults
- RBAC gaps → restrict status updates to trusted roles; log actors

File Pointers
- Admin: src/pages/applicationCaseDashboard.js, src/widgets/CoordinatorAssessmentWidget.js, src/widgets/applicationEvents.js, isetadminserver.js (/api/cases…)
- Public: ISET-intake/server.js (/api/intake/complete, /api/submissions...), ISET-intake/src/pages/userDashboard.js, ISET-intake/src/components/ApplicationCard.js

Owner / DRI
- Engineering: Codex (this plan), handoff to maintainers post‑merge
