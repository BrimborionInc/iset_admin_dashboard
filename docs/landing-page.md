# Admin Landing Page Redesign

## Purpose
Provide a role-aware, task-oriented entry point that accelerates common workflows, surfaces critical alerts, and reduces cognitive load compared to the legacy flat dashboard list.

## Goals (MVP)
- Show contextual greeting (user + role badge) when signed in.
- Display 3–6 role-based "Quick Actions".
- Present a concise "My Work" summary (static placeholders first).
- List recent activity items (mock initially, future API).
- Provide links to documentation & support resources.
- Hide configuration / system areas for roles without access.
- Graceful signed-out state (prompt to sign in if IAM mode is active).

## Roles & Sections Matrix (MVP)
| Section | SysAdmin | Program Admin | Regional Coordinator | PTMA Staff | Unknown/Other |
|---------|----------|---------------|----------------------|-----------|---------------|
| Greeting + Role Badge | yes | yes | yes | yes | yes |
| Alerts (placeholder) | yes | yes | yes | limited | limited |
| Quick Actions | yes | yes | yes | yes | yes |
| My Work Summary | yes | yes | yes | yes | yes |
| KPIs Snapshot (future) | planned | planned | limited | minimal | minimal |
| Recent Activity | yes | yes | yes | yes | limited |
| System Status (future) | yes | hidden | hidden | hidden | hidden |
| Resources & Help | yes | yes | yes | yes | yes |
| First-Time / Empty State | conditional | conditional | conditional | conditional | conditional |

## Quick Actions (Initial Mapping)
- System Administrator: Manage Users, Workflows, Upload Config, Release Mgmt.
- Program Administrator: Case Assignment, Reporting & Monitoring, Manage Notifications.
- Regional Coordinator: Case Assignment, Reporting & Monitoring, Secure Messaging.
- PTMA Staff: My Queue, Continue Last Case, Secure Messaging.
- Fallback: Case Management, Help & Docs.

## Component Structure (MVP)
```
<LandingPage>
  <Greeting />
  <RoleBanner (if impersonating) />
  <QuickActions />
  <Grid>
    <MyWork />
    <RecentActivity />
    <Resources />
  </Grid>
</LandingPage>
```
Future slots: <Kpis />, <SystemStatus />, <Announcements />.

## Data Providers (Mock Phase)
- useRole(): derived from existing cognito helpers.
- getMockMyWork(role): returns counts object.
- getMockRecentActivity(role): array of items { id, type, title, timestamp }.

## Accessibility & UX Notes
- Use semantic headings (h1 greeting hidden visually if needed, h2 section titles).
- All quick actions: buttons with aria-label describing action destination.
- Recent activity: list with time descriptions (e.g., "2h ago").

## Incremental Roadmap
1. Scaffold MVP with mock data (this change).
2. Add dismissible Alerts panel (optional if data present).
3. Add personalization: pinned actions (local storage).
4. Integrate real metrics/activity endpoints.
5. Add KPI tiles + system status for admins.

## Open Questions (For Later Feedback)
- Do we expose environment (e.g., UAT / Prod) in greeting?
- Level of detail for activity items (show user emails?).
- SLA / performance metrics source availability.

## Change Log
- v0.1 (MVP scaffold) – Created file and initial spec.
- v0.2 – User-focused greeting copy, relative time formatting for activity items, role-based mock Alerts section, gated Status section only for System Administrator.
- v0.3 – Added sessionStorage role simulation fallback and event listener to update landing page when switching roles via Demo Navigation.
- v0.4 – Signed-out hard restriction (no side nav except docs), removed notifications badge, simplified breadcrumbs (Home only), adaptive top nav (Sign in only when signed out, settings button limited to System Administrator).
- v0.5 – Unified signed-out experience: simulateSignedOut now mirrors IAM signed-out (landing sign-in prompt, minimal top & side navigation).
 - v0.6 – Expanded role-specific welcome messaging; replaced System Administrator Status placeholder with interactive Development Tracker (session-persisted task states: planned, in-progress, blocked, done).
