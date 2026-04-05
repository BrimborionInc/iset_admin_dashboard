# Admin Home - System Administrator Homepage

Purpose: document the live System Administrator homepage board and the operational widgets that replaced the old development-tracker direction.
Audience: admin dashboard engineers, product owners, and operators.
Last Updated: 2026-04-05

## Scope

- Route: `/`
- Visible to: `System Administrator`
- Hidden from: other roles
- Frontend implementation:
  - `src/pages/home/HomeDashboardPage.jsx`
  - `src/pages/home/widgets/SystemAdminOperationsSnapshotWidget.js`
  - `src/pages/home/widgets/SystemAdminAwsEnvironmentStatusWidget.js`
  - `src/pages/home/widgets/SystemAdminUsersAccessAlertsWidget.js`
  - `src/pages/home/widgets/SystemAdminFeedbackQueueWidget.jsx`
  - `src/pages/home/widgets/RecentActivityWidget.js`
- Backend implementation: `isetadminserver.js`

## Current purpose

- Treat the System Administrator homepage as an operations board, not as a casework queue and not as a development scratchpad.
- The standard homepage `Metrics` widget is hidden for System Administrators.
- The old `Development Tracker` is no longer part of the live System Administrator board surface.

## Current default board

- `Operations Snapshot`
  - shows ILMP / ESDC blockers, applicant activation backlog, and staff access follow-up counts
  - links directly to filtered `ILMP Submissions & Exports` and `User Management` views
  - current data sources are `GET /api/admin/users/summary`, `GET /api/admin/applicants/summary`, and `GET /api/esdc/participants?...`
- `AWS Environment Status`
  - shows read-only live checks for staff Cognito, applicant Cognito, and SES mail in the active environment
  - backed by `GET /api/dashboard/system-admin-aws-environment-status`
  - this is intentionally not a full infrastructure monitor
  - current implementation is cached server-side for 60 seconds and must stay read-only
- `Users & Access Alerts`
  - shows staff MFA gaps, pending first sign-in/reset state, disabled accounts, never-signed-in accounts, and applicant activation backlog
  - backed by `GET /api/dashboard/system-admin-users-access-alerts`
- `Bug & Change Requests`
  - shows the internal triage queue for admin-console bug reports and change requests
  - backed by `GET /api/dashboard/system-admin-feedback-reports`
  - opens a floating review panel backed by:
    - `GET /api/admin/feedback-reports/:id`
    - `PATCH /api/admin/feedback-reports/:id/status`
    - `POST /api/admin/feedback-reports/:id/notes`
  - current review surface exposes report details, captured page context, supporting files, status history, and internal notes without leaving the homepage shell
- `Recent Admin Activity`
  - shows workflow publishes, upload-config changes, event-capture changes, and relevant admin/system case events
  - backed by `GET /api/dashboard/system-admin-recent-activity`
- `My Tagged Applications`
  - retained as a secondary personal follow-up widget on the System Administrator board

## Current layout and storage rule

- The current System Administrator homepage storage key is `admin-home-layout-v10`.
- Bump the System Administrator storage key whenever the default System Administrator widget set changes, so new operational widgets appear by default without resetting other roles.

## Current implementation guardrails

- Prefer schema-free aggregate endpoints for System Administrator homepage widgets unless a schema change is clearly necessary.
- The feedback queue is the current exception: interactive triage required persistent status history and internal notes, so it uses dedicated feedback-management tables instead of a schema-free aggregate-only model.
- Keep the AWS widget read-only. Do not send test mail, mutate Cognito state, or run expensive/destructive probes on normal homepage refresh.
- `AWS Environment Status` should answer whether PATH's AWS-backed services are usable in the current environment, not expose a generic dump of environment data.
- Keep drill-ins actionable. Every System Administrator homepage count or status should open an existing admin surface that can actually be used for follow-up.
