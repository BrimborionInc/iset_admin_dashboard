# CR-0013 – Reminders & Task Orchestration

Date created: 2025-10-30  
Owner: Admin Dashboard team  
Status: Draft (needs ongoing updates)

---

## 1. Problem Statement

Caseworkers, coordinators, and finance reviewers currently rely on ad-hoc notes or spreadsheet trackers to remember follow-ups. The admin dashboard surfaces activity (messages, interventions, submissions) but does not offer:

- Structured tasks with owners, due dates, or completion state.
- Alerts when a case or application sits idle past our service thresholds.
- Visibility into upcoming deadlines (document submissions, assessments, finance approvals).

As the Case Workspace matures, we need a consistent reminder system that spans cases, applications, and configuration dashboards while avoiding one-off “nag” logic inside each widget.

## 2. Goals & Success Criteria

1. **Centralised reminder model**  
   - Canonical storage for tasks/reminders tied to case, application, or global contexts.  
   - Support due dates, optional recurrence, ownership, and status (`open`, `completed`, `overdue`, etc.).

2. **Scheduler & notifications**  
   - Background job(s) to flag overdue items, detect inactivity thresholds, and emit events for UI consumption.  
   - Provide hooks for in-app alerts first; design so email / secure messaging can be added later.

3. **UI integration**  
   - Extend existing widgets (e.g., Notes and Tasks) to create/manage structured tasks.  
   - Surface alerts in global navigation (badge/flashbar) and embed list views in relevant dashboards (Case Workspace, Application Assessment, Finance).  
   - Consider roadmap for a consolidated calendar/timeline view once data volume warrants it.

4. **Cross-feature alignment**  
   - Standardise how reminders interact with secure messaging, case notes, and future workflow automation.  
   - Document RBAC requirements so only authorised roles can create/complete reminders.

## 3. Scope

### In scope (Phase 1)
- Schema design (`iset_case_task` or generic `iset_reminder`) with auditing fields.
- CRUD endpoints under `/api/cases/:id/tasks` plus admin-level `/api/reminders`.
- Scheduled inactivity check leveraging existing `last_activity_at` timestamps.
- UI enhancements for Case Workspace “Notes and Tasks” widget: create/due-date/complete.
- Global alert beacon (counter in shell) fed by overdue reminders for the signed-in staff member.

### Potential Phase 2
- Calendar/agenda dashboard spanning all reminders.
- SLA configuration UI (per reminder type) under Configuration module.
- Email/SMS/secure-message notifications triggered by scheduler.
- Portal-visible reminders (if we expose tasks to applicants in future).

### Out of scope (for now)
- Applicant-facing reminders (needs separate CR).
- Complex recurrence rules beyond simple due date + optional repeat.
- Full workflow automation (rule engine). We will align but not deliver the engine here.

## 4. Proposed Architecture

1. **Data layer**
   - Table storing `id`, `scope` (case/application/global), `entity_id`, `title`, `details`, `due_at`, `status`, `assigned_staff_profile_id`, `created_by`, timestamps.
   - Optional metadata JSON for future extensibility (recurrence, tags).
   - Index by `assigned_staff_profile_id`, `due_at`, `status` for quick queries.

2. **Service layer**
   - New ReminderService encapsulating CRUD + query helpers (`listByCase`, `listOverdueByStaff`, etc.).
   - Background job (cron or queue) run hourly/daily:
     - Flag tasks where `due_at` < now & status=open → set to `overdue`.
     - Detect case inactivity: compare `last_activity_at` to thresholds, create reminders if none exists.
     - Emit domain events for UI (e.g., push onto websocket/notification stream when available).

3. **Frontend**
   - Extend `CaseNotesWidget` (now “Notes and Tasks”) to show structured task list alongside notes, with inline create/edit modals.
   - Introduce shared `useReminders` hook/context for fetching/updating tasks per case.
   - Global badge (AppLayout tools header) listing top 5 overdue/upcoming items for the logged-in user.
   - For future calendar: reuse same API but aggregate by due date.

4. **Security**
   - Enforce RBAC on endpoints. Case staff can CRUD tasks on cases they can access; finance admins limited to finance-related reminders, etc.
   - Audit trail on create/update/complete actions (store `updated_by_staff_profile_id`).

## 5. Milestones / Checklist

| Milestone | Target | Notes | Status |
|-----------|--------|-------|--------|
| Schema proposal & review | 2025-11-05 | Align with DBA + analytics | Done - migration 20251101 applied 2025-11-01 |
| API design sketch | 2025-11-05 | Document endpoints in OpenAPI | In progress - CRUD endpoints live; OpenAPI & RBAC pending |
| Scheduler POC | 2025-11-08 | Reuse existing job runner (see events-tracking-overhaul) | Pending |
| Case Workspace UI spike | 2025-11-12 | Show combined notes + tasks list with mock data | Pending |
| Global notification beacon | 2025-11-15 | Display count of overdue items for current user | Pending |
| Phase 1 release | TBD | Feature flag reminders.enabled | Pending |

1. **Task ownership** – Do we allow assignment to teams (queues) or only individuals?  
2. **SLA thresholds** – Where do inactivity + due date rules live? Config table vs. hard-coded defaults?  
3. **Notification channel** – In-app first; do we need email/SMS from day one?  
4. **Portal visibility** – Any applicant-facing reminders required in near term?  
5. **Calendar experience** – Do stakeholders want a full calendar board now, or is a list with filters enough?  
6. **Integration with secure messaging** – Should sending a message auto-complete related reminders?  
7. **Analytics** – What reporting (overdue counts, completion rates) do managers require?

## 7. Dependencies & Risks

- Relies on accurate `last_activity_at` timestamps (`CR-0008` work must be stable).  
- Scheduler introduces new operational responsibility; need monitoring/alerting.  
- UI complexity: merging notes + tasks without overwhelming users.  
- RBAC alignment with existing Access Control matrix to avoid privilege gaps.  
- Potential overlap with planned Workflow automation CRs—ensure scopes remain distinct.

## 8. Next Actions

- [ ] Circulate this CR for review with product + ops.  
- [ ] Schedule architecture session to finalise schema + job runner approach.  
- [ ] Identify pilot dashboard (Case Workspace) and confirm UX flow with design.  
- [ ] Draft API contract & start backend spike behind feature flag. (Backend CRUD endpoints landed 2025-11-01; documentation + RBAC review pending.)  
- [ ] Wire Case Calendar / Notes and Tasks widgets to `/api/reminders` once backend stabilises.  
- [ ] Update this document as discoveries occur (especially open questions & timeline).

## 9. Progress Log

- 2025-11-01: Added migration `20251101_create_iset_case_reminder.sql` and scaffolded REST endpoints (`GET/POST/PUT /api/reminders`, `/api/reminders/:id`, `/api/reminders/:id/complete`). RBAC gates and OpenAPI documentation still required before exposure to non-dev environments.
- 2025-11-02: Case Workspace Notes widget now captures optional follow-up dates, persisting them on `iset_case_note` and coordinating linked reminders (create/update/delete) in `iset_case_reminder`. Retired legacy placeholder widget from the workspace palette.

---

_Keep this CR current as we refine scope, answer open questions, and deliver iterations._




