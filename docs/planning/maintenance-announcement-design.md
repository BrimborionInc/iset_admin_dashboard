# Maintenance Announcement Design

Purpose: capture the current design recommendation for planned and unplanned maintenance warnings that must reach both the admin console and the public portal without a rebuild.
Audience: developers, operators, future Codex threads.
Last Updated: 2026-04-11

## Implementation status

- Phase 1 is now implemented.
- Storage: `iset_runtime_config(scope='runtime', k='service.announcement')`.
- Admin delivery: `src/AppContent.js` polls `GET /api/service-announcement/current` every 15 seconds and renders a non-dismissible shell-level Cloudscape `Flashbar` item.
- Portal delivery: `../ISET-intake/src/App.js` polls the same endpoint every 15 seconds and renders a global GOV.UK notification banner through `../ISET-intake/src/components/MaintenanceAnnouncementBanner.js`.
- Operator control: `npm run path:maintenance -- set|clear ...` from `admin-dashboard`.
- Hard-cutover fallback: `npm run path:maintenance:fallback -- set|clear ...` to switch selected ALB host rules to a static HTML `503` maintenance page.
- Current phase-1 constraint: countdown text is live after load, but delivery is still polling-based, so the operator minimum warning window should remain 2 to 5 minutes.

## Goal

- Hot-push a service-wide maintenance warning to signed-in admin users and public-portal users.
- Support both scheduled and unscheduled maintenance.
- Let Codex/operator workflows set, update, and clear the warning as part of deployment or incident handling.
- Warn users to save progress before an outage starts.

## Current architecture

- Admin shell:
  - `src/AppContent.js` owns the global `AppLayout` shell and renders the top-of-page notifications rail through `AppLayout.notifications`.
  - `/api/me/notifications` reads from `iset_internal_notification` via `src/internalNotifications.js`.
  - `iset_internal_notification` already supports `audience_type`, `starts_at`, and `expires_at`.
  - Bell notifications still fetch on initial load, auth/storage change, and manual side-nav refresh only. The maintenance-announcement path is separate and now polls `/api/service-announcement/current` every 15 seconds.
- Public portal:
  - `../ISET-intake/src/App.js` owns the shared shell (`Header` + all routes), so any true portal-wide banner belongs there.
  - Existing GOV.UK notification banners in `../ISET-intake/src/pages/userDashboard.js` and `../ISET-intake/src/pages/Welcome.js` are page-local examples only.
  - Phase 1 uses the explicit public endpoint `GET /api/service-announcement/current` rather than extending the broader public runtime-config snapshot.
- Deployment/operator:
  - `scripts/path-deploy.js` is the preferred deploy control plane.
  - There is prior prod precedent for placing `iset.nwac.ca` behind an ALB fixed-response `503` rule when the portal must be fully unavailable.

## Options considered

### 1. Reuse `iset_internal_notification`

- Pros:
  - Admin shell UI already exists.
  - Scheduling fields already exist (`starts_at`, `expires_at`).
  - No new schema required for admin-only delivery.
- Cons:
  - The model is staff notification oriented, not cross-app service-state oriented.
  - Dismissal semantics are wrong for a critical maintenance warning.
  - The public portal does not currently consume this feed.
  - This does not solve hot-push by itself; polling/push is still required.

### 2. Dedicated service-announcement source

- Pros:
  - Clean separation between workflow/event notifications and service-status messaging.
  - One source can drive both Cloudscape and GOV.UK renderers.
  - Easier operator scripting: set, update, clear.
  - Cleaner support for structured countdown data.
- Cons:
  - Requires new API/client wiring.
  - If implemented as a new table, requires schema work.

### 3. Infrastructure-only maintenance mode (`503`)

- Pros:
  - Strong guarantee once traffic must stop.
  - Useful emergency fallback if the portal/admin app itself is unhealthy.
- Cons:
  - It is not a warning channel.
  - It cannot tell already signed-in users to save progress before the cutover.
  - It should not be the only design for planned maintenance messaging.

## Recommendation

- Use a dedicated service-announcement source for maintenance messages.
- Phase 1 should store a single active announcement as structured JSON, not as a pre-rendered sentence.
- Recommended initial storage: a dedicated `iset_runtime_config` key rather than `iset_internal_notification`.
  - Reason: this is a cross-application service-state flag, not a per-user bell alert.
  - If announcement history/audit becomes a hard requirement later, move to a first-class `service_announcement` table without changing the shell rendering contract.

## Recommended payload shape

Store structured data and let the clients format the live countdown:

```json
{
  "enabled": true,
  "kind": "maintenance",
  "status": "scheduled",
  "surfaces": ["admin", "portal"],
  "severity": "warning",
  "startsAt": "2026-04-11T16:00:00Z",
  "expectedEndAt": "2026-04-11T16:20:00Z",
  "expectedDurationMinutes": 20,
  "title": {
    "en": "Scheduled maintenance",
    "fr": "Maintenance planifiee"
  },
  "body": {
    "en": "PATH will be unavailable soon. Save your work now.",
    "fr": "PATH sera bientot indisponible. Enregistrez votre travail maintenant."
  },
  "updatedAt": "2026-04-11T15:55:00Z"
}
```

Key rule:
- Do not store only text like "going down in 5 minutes." That text goes stale immediately. Store absolute times and derive relative text in the client.

## Rendering recommendation

- Admin console:
  - Render in the existing shell-level `AppLayout.notifications` area as a non-dismissible Cloudscape `Flashbar` item.
  - This matches Cloudscape guidance that flashbars belong at the top of the page and can be used for service-wide announcements.
- Public portal:
  - Render one global GOV.UK notification banner from `../ISET-intake/src/App.js`, below the shared header and before page content.
  - Keep it to one banner. If other page-local banners exist, the maintenance banner takes priority.

## Hot-push requirement

- The current apps do not have websocket/SSE infrastructure for live announcement delivery.
- Phase 1 should therefore add client polling for the active announcement plus a local one-second countdown renderer.
- Recommended compromise:
  - Poll every 15 seconds for normal operation.
  - Render the countdown locally every second once the announcement is loaded.
- Important constraint:
  - A warning like "20 seconds from now" is not reliable with a simple 15-second polling design.
  - If sub-minute warning precision is a real requirement, add SSE/websocket push or set an operational minimum warning lead time of at least 2 to 5 minutes.

## Operator workflow recommendation

- Keep maintenance announcement control as an explicit operator command that `path:deploy` can invoke, rather than overloading the main deploy command with too much inline copy logic.
- Recommended command shape:
  - `npm run path:maintenance -- set --surfaces all --start-in 5m --expected-duration 20m`
  - `npm run path:maintenance -- set --surfaces all --start-now --expected-duration 20m --unscheduled`
  - `npm run path:maintenance -- clear`
- Current implementation notes:
  - Use `--env test` or `--env prod` for remote targets.
  - Prod mutations require `--yes`.
  - The command updates the single runtime-config row directly; it does not currently toggle the ALB `503` hard-maintenance fallback.
- PROD deploy guardrail:
  - Treat ASG instance refreshes, app restarts, target-group rotations, and ALB rule changes as user-impacting unless the deploy plan proves they cannot interrupt active users.
  - "Admin-only", "portal-only", and "code-only" do not by themselves mean "no warning needed".
  - If the affected surface can show a transient `502 Bad Gateway` or unavailable response, set the scoped maintenance warning before the deploy and wait the 2 to 5 minute polling window.
  - If a hard outage is expected, enable the ALB fixed-response maintenance page so users see an intentional maintenance message.
- Current fallback implementation notes:
  - The ALB helper modifies the matching HTTPS listener rules in place for the selected hostnames and restores them back to their admin/portal target groups on `clear`.
  - This is the operator path for showing a meaningful static maintenance page instead of a generic browser error during hard downtime.
- Recommended deployment sequence for planned work:
  1. Set the maintenance warning.
  2. Wait through the warning window.
  3. If full downtime is required, enable the hard maintenance fallback (`503`).
  4. Run `path:deploy`.
  5. Clear the announcement after smoke passes.
  6. Clear the hard maintenance fallback if it was enabled.

## Non-goals for phase 1

- No notification-center inbox for maintenance notices.
- No per-user dismissal for active maintenance warnings.
- No attempt to reuse reminder/event notification templates for this feature.
- No promise of precise 20-second delivery without adding a real push channel.
