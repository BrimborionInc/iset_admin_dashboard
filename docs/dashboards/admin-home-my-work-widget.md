# Admin Home - "Application Work Queue" Widget Design

## Scope
- Surface the work queue for ISET applications that a signed-in user is responsible for.
- Role-aware counts and descriptions; single shared widget used across personas.

## Roles & Buckets
- **Program Administrator**: New submissions, Unassigned backlog, In assessment, Awaiting program decision, On hold / info requested, Overdue.
- **Regional Coordinator**: Assigned to my region, Assigned to me, Awaiting applicant info, Due this week, Overdue.
- **Application Assessor**: Assigned to me, Due today, Awaiting applicant response, Overdue.
- **System Administrator**: Workflow drafts, Release prep tasks, Platform alerts.

## Implementation
### Backend Endpoint
- `/api/dashboard/application-work-queue` fetches all Program Administrator buckets in one request.
- Helpers in `isetadminserver.js` compute each count:
  - **New submissions**: submissions in the last 24 hours with no linked case.
  - **Unassigned backlog**: cases missing an assignee and not in a terminal status.
  - **In assessment**: active cases with an assignee whose stage is not `assessment_submitted`/`review_complete`.
  - **Awaiting program decision**: cases with stage `assessment_submitted` or `review_complete` still awaiting outcome.
  - **On hold / info requested**: cases whose status matches on-hold values (`docs_requested`, `action required`, etc.).
  - **Overdue**: compares elapsed hours since `COALESCE(last_activity_at, updated_at, created_at)` against SLA targets from `sla_stage_target` for assignment, assessment, and program decision stages.
- SLA targets are loaded via `fetchActiveSlaTargets` with placeholder defaults if the table is missing.
- Helper constants manage status/stage normalization and guard against missing schema.

### Frontend Wiring
- `src/pages/adminDashboardHomePage.js` fetches the endpoint with `apiFetch` inside a `useEffect`.
- When IAM is toggled off, dev-bypass headers (`X-Dev-Role`, `X-Dev-Bypass`, etc.) are attached so the call works without Cognito.
- API results merge into the persona-specific mock array; tiles render counts in the returned order.

### Notes
- Queries default to zero when `stage`, `last_activity_at`, or `sla_stage_target` are absent.
- Status comparisons are case-insensitive.
- Overdue numbers reflect current SLA targets and will be zero until cases exceed those thresholds.
- Regional Coordinator / Application Assessor buckets remain placeholders until wired to data.

### Recent Implementation Changes
- Backend helpers now compute live counts for all Program Administrator buckets (new submissions, unassigned, in assessment, awaiting decision, on hold, overdue).
- Overdue detection pulls SLA targets from `sla_stage_target` and compares elapsed hours in assignment/assessment/program decision stages.
- Frontend uses `apiFetch` with IAM toggle support; dev bypass headers are appended automatically.
