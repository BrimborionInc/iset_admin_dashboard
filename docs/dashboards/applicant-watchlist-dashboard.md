# Applicant Watchlist Dashboard

Last updated: 2026-04-06

## Purpose

Provide NWAC and System Administrators with a direct manager view of the SIN-based applicant watchlist that flags new applications from specific individuals.

## Route and access

- Route: `/configuration/applicant-watchlist`
- Default access: `System Administrator`, `NWAC Administrator`
- Navigation path: `Configuration > Applicant Watchlist`
- Route access is controlled through the standard access-control matrix on both the frontend and backend.

## Current behavior

- The page loads all watchlist entries from `GET /api/admin/applicant-watchlist`.
- The table masks SIN values by default.
- The editor modal shows the full SIN so authorized staff can correct an entry directly.
- Staff can create entries directly from the dashboard through `POST /api/admin/applicant-watchlist`.
- Staff can edit existing entries, including name, DOB, SIN, notes, and status, through `PATCH /api/admin/applicant-watchlist/:id`.
- Removing an applicant from the watchlist marks the entry `inactive`; the row is retained for history.
- Re-adding an inactive applicant reactivates the same row instead of creating a second entry.

## Relationship to existing quick actions

- The case/application quick actions that add an applicant to the watchlist remain broadly available.
- Those contextual quick actions still post to `POST /api/applicant-watchlist`.
- The quick-action path and the direct manager page intentionally use different permission boundaries:
  - quick add remains broad
  - aggregated list view and direct edit remain restricted

## Data model

- Canonical table: `iset_applicant_watchlist`
- Current key fields:
  - `sin` stored as canonical 9 digits
  - `sin_hash` unique match key
  - `status` (`active` / `inactive`)
  - `updated_by_staff_profile_id`
  - `deactivated_at`
  - `deactivated_by_staff_profile_id`
- Because the feature was not yet live in production, the 2026-04-06 schema change uses a destructive rebuild migration instead of a backward-compatibility migration path.

## Queue and events

- Homepage watchlist-hit queue matching now considers only active watchlist entries.
- Shared events now include:
  - `applicant_watchlist_added`
  - `applicant_watchlist_updated`
  - `applicant_watchlist_removed`
  - `applicant_watchlist_hit`
- `applicant_watchlist_hit` is emitted when applications are submitted through:
  - admin manual intake
  - the public intake completion path
- Event payloads use masked SIN values only.

## Privacy and feed rules

- The direct dashboard is restricted because it exposes an aggregated list of people and SIN-linked watchlist entries.
- Generic `/api/events/feed` responses are filtered so users without dashboard access cannot retrieve watchlist events through alternate event-feed filters.
