# Admin Home - System Administrator Homepage

Purpose: document the live System Administrator homepage board and the operational widgets that replaced the old development-tracker direction.
Audience: admin dashboard engineers, product owners, and operators.
Last Updated: 2026-06-18

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
  - shows read-only live checks for app capacity, database stress, database query pressure, staff Cognito, applicant Cognito, and SES mail in the active environment
  - backed by `GET /api/dashboard/system-admin-aws-environment-status`
  - still intentionally not a full infrastructure monitor or load test surface
  - current implementation is cached server-side for 60 seconds and must stay read-only
  - app capacity reads the active environment's Auto Scaling group, EC2 CPU over the last 15 minutes, desired/in-service/healthy instance counts, and instance ids
  - database stress reads the Aurora/RDS cluster state plus CloudWatch CPU, connection, and Aurora Serverless ACU utilization metrics over the last 15 minutes
  - database query pressure reads MySQL global status counters from the app's existing DB connection; it compares current and previous widget samples to surface sudden query-rate spikes that can indicate runaway frontend/API polling
  - default resource discovery:
    - ASG: `SYSTEM_ADMIN_AWS_ASG_NAME`, `APP_ASG_NAME`, `AUTO_SCALING_GROUP_NAME`, or inferred `nwac-prod-asg` / `nwac-test-asg`
    - DB cluster: `SYSTEM_ADMIN_AWS_DB_CLUSTER_IDENTIFIER`, `RDS_CLUSTER_IDENTIFIER`, `DB_CLUSTER_IDENTIFIER`, `AURORA_CLUSTER_IDENTIFIER`, or inferred from an Aurora `DB_HOST`
    - AWS metrics region: `SYSTEM_ADMIN_AWS_METRICS_REGION` or `AWS_REGION`
  - read-only IAM actions needed by the deployed admin runtime for the new infrastructure checks:
    - `autoscaling:DescribeAutoScalingGroups`
    - `cloudwatch:GetMetricData`
    - `rds:DescribeDBClusters`
  - optional threshold env vars:
    - `SYSTEM_ADMIN_APP_CPU_WARNING_PERCENT` / `SYSTEM_ADMIN_APP_CPU_ERROR_PERCENT` (defaults `75` / `90`)
    - `SYSTEM_ADMIN_DB_CPU_WARNING_PERCENT` / `SYSTEM_ADMIN_DB_CPU_ERROR_PERCENT` (defaults `75` / `90`)
    - `SYSTEM_ADMIN_DB_ACU_WARNING_PERCENT` / `SYSTEM_ADMIN_DB_ACU_ERROR_PERCENT` (defaults `80` / `95`)
    - `SYSTEM_ADMIN_DB_QPS_WARNING` / `SYSTEM_ADMIN_DB_QPS_ERROR` (defaults `150` / `500`)
    - `SYSTEM_ADMIN_DB_THREADS_RUNNING_WARNING` / `SYSTEM_ADMIN_DB_THREADS_RUNNING_ERROR` (defaults `8` / `20`)
- `Users & Access Alerts`
  - shows staff MFA gaps, pending first sign-in/reset state, disabled accounts, never-signed-in accounts, and applicant activation backlog
  - backed by `GET /api/dashboard/system-admin-users-access-alerts`
- `Bugs and Change Requests`
  - shows the internal triage queue for admin-console bug reports and change requests
  - backed by `GET /api/dashboard/admin-feedback-reports`; `GET /api/dashboard/system-admin-feedback-reports` remains as a compatibility alias
  - opens a floating review panel backed by:
    - `GET /api/admin/feedback-reports/:id`
    - `PATCH /api/admin/feedback-reports/:id/status`
    - `POST /api/admin/feedback-reports/:id/notes`
  - current review surface exposes report details, captured page context, supporting files, status history, and internal notes without leaving the homepage shell
  - the same widget is reused on the dedicated `Support > Bugs and Change Requests` dashboard for System Administrators, NWAC Administrators, and Regional Managers
- `Recent Admin Activity`
  - shows workflow publishes, upload-config changes, event-capture changes, and relevant admin/system case events
  - backed by `GET /api/dashboard/system-admin-recent-activity`
- `My Tagged Applications`
  - retained as a secondary personal follow-up widget on the System Administrator board

## Current layout and storage rule

- The current System Administrator homepage storage key is `admin-home-layout-v11`.
- Bump the System Administrator storage key whenever the default System Administrator widget set changes, so new operational widgets appear by default without resetting other roles.

## Current implementation guardrails

- Prefer schema-free aggregate endpoints for System Administrator homepage widgets unless a schema change is clearly necessary.
- The feedback queue is the current exception: interactive triage required persistent status history and internal notes, so it uses dedicated feedback-management tables instead of a schema-free aggregate-only model.
- Keep the AWS widget read-only. Do not send test mail, mutate Cognito state, or run expensive/destructive probes on normal homepage refresh.
- `AWS Environment Status` should answer whether PATH's AWS-backed services are usable in the current environment, not expose a generic dump of environment data.
- Do not add automatic frontend polling to `AWS Environment Status`; use the manual refresh button and server-side cache unless Bill explicitly approves bounded polling.
- Keep drill-ins actionable. Every System Administrator homepage count or status should open an existing admin surface that can actually be used for follow-up.
