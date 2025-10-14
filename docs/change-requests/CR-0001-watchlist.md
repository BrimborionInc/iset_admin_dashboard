# CR-0001 — Personal Case Watchlist

## Summary
- Introduce a per-user “watch” capability for ISET cases so staff can track specific applications without reassigning ownership.
- Provide an inline watch/unwatch action and watch indicator within the Manage Applications dashboard.
- Generate bell notifications for watched cases using dedicated watcher audience rules instead of role overrides.

## Background
- Program Administrators need to monitor cases they do not own and still receive timely updates when those cases change state.
- The previous idea of reusing “Application Assessor” bell-alert rules for flagged cases would have bypassed Program Administrator notification settings and produced duplicate alerts for real assessors.
- A personal watchlist avoids cross-role noise, keeps settings predictable, and aligns with the “follow” metaphor common in case-management tools.

## Requirements
- Manual watch/unwatch action available directly from the Manage Applications widget; no automated expiration for now.
- Watch state is private to the watcher: other users do not see the flag, and no shared priority flag is introduced.
- Manage Applications widget displays an inline status indicator (e.g., red flag icon) whenever the signed-in user is watching that case, and offers a filter or quick selector for “My watched cases.”
- Backend persists watches per `(case_id, user_id)` with audit timestamps.
- Dispatcher emits bell alerts for watched cases whenever the underlying event would have notified an Application Assessor.
- Emit new `case_watch_added` and `case_watch_removed` events for auditability and future automations.
- Prepare for a future “My Watchlist” homepage widget that surfaces the watcher’s cases (out of scope to implement now, but leave discoverable APIs/data).

## Decisions
- **Watch Scope**: Personal only; visibility limited to the watcher. (Customer confirmation 2025-10-14.)
- **Lifecycle**: Manual management; watches persist until explicitly removed.
- **Notification Behaviour**: Use watcher-specific bell notifications (audience type `user`) rather than repurposing role-based assessor alerts.
- **Event Catalog**: Add two new internal event types (`case_watch_added`, `case_watch_removed`) when watch state changes.
- **Storage**: New table `iset_case_watch` with primary key `(case_id, user_id)`, created/updated timestamps, and optional JSON metadata column for future extensions.
- **API Strategy**: Expose REST endpoints under `/api/cases/:caseId/watch` (POST/DELETE) and `/api/me/case-watches` (GET) secured via existing auth middleware.

## Open Questions
- Should we block watch creation on closed/archived cases, or allow it with no alerts? _(TBD with product owner.)_
- Do we need rate limits or caps on number of watched cases per user? _(TBD.)_
- Should deleting a case automatically purge watcher rows? _(Likely yes, but confirm during implementation.)_

## Change Plan
**Increment 1 — Foundation**
- Write the database migration for `iset_case_watch` (PK on `(case_id, user_id)`, FK constraints, timestamps, optional metadata JSON).
- Register new internal event types (`case_watch_added`, `case_watch_removed`) in the server constants/enums.
- Add placeholder server utilities/models for watch persistence (no routes yet).

**Increment 2 — API Surface**
- Implement `POST /api/cases/:caseId/watch`, `DELETE /api/cases/:caseId/watch`, and `GET /api/me/case-watches`, including validation, auditing, and event emission.
- Add minimal integration/unit tests to lock behaviour.
- Update developer docs (if any) to reference the new endpoints.

**Increment 3 — Notifications**
- Extend the bell notification dispatcher to fetch watchers per case event and insert watcher-targeted notifications (`audience_type='user'`).
- Add dedupe safeguards and tests ensuring assessor behaviour remains unchanged.
- Verify new watch events appear in audit/log streams.

**Increment 4 — Manage Applications UI**
- Wire the widget to load the watch list, display a red-flag column, and expose a watch/unwatch inline action with optimistic updates and toasts.
- Add a “My watched cases” filter/saved view for the signed-in user.
- Cover core flows with component/integration tests.

**Increment 5 — Hardening & Follow-up Prep**
- Smoke-test end-to-end (API + dispatcher + UI) and document learnings.
- Capture open items for the future “My Watchlist” homepage widget.
- Prepare any operational notes (migration rollbacks, monitoring hooks).

_After completing each increment, update this CR with progress details, learnings, and any plan adjustments before starting the next increment._

## Implementation Status Updates
- _2025-10-14_: CR drafted; awaiting approval to proceed with design & implementation.
- _2025-10-14_: Increment 1 completed – added `iset_case_watch` migration, registered new watch event types, and scaffolded repository helpers (no routes yet).
- _2025-10-14_: Increment 2 completed – added watch CRUD endpoints (`GET /api/me/case-watches`, `POST/DELETE /api/cases/:id/watch`), wired in events/auditing, and normalised metadata handling (tests still manual).
- _2025-10-14_: Increment 3 completed – dispatcher now loads case watchers, emits bell alerts using assessor rules, and dedupes per-user so a watcher who also owns the case only gets one notification.
- _2025-10-15_: Increment 4 completed – Manage Applications widget now fetches the watchlist, adds a flag column with inline toggle, provides a "My watched cases" filter, and surfaces success/error toasts for flagging actions; backend aligned with canonical schema (migration renaming `user_id` → `staff_profile_id`, simplified case payloads).
- _2025-10-15_: Increment 5 completed – smoke-tested flag/unflag flows (UI/API/dispatcher), confirmed migrations are idempotent, and documented operational guidance plus follow-up work for the future homepage watchlist widget.

## Post-Implementation Technical Change Summary
- **Schema**: `sql/20251014_create_iset_case_watch.sql` (initial table) and `sql/20251014_align_case_watch_staff_profile.sql` (rename `user_id` to `staff_profile_id`, add FK/index).
- **Server**: `isetadminserver.js` watch endpoints (`GET /api/me/case-watches`, `POST/DELETE /api/cases/:id/watch`) with metadata normalisation and schema-aligned payloads.
- **Shared Services**: `shared/events/notificationDispatcher.js` augments bell alerts with watcher audiences and per-user dedupe.
- **Front-end**: `src/widgets/ApplicationsWidget.js` loads the watchlist, renders the flag column and inline toggle, adds the "My watched cases" filter; `src/widgets/MyWatchlistWidget.js` powers the homepage watchlist panel and is wired into `adminDashboardHomePage.js`.
- **Testing**: Manual verification covering migration application, API responses, UI toggle behaviour, and watcher bell notifications (documented here; automated coverage deferred).

