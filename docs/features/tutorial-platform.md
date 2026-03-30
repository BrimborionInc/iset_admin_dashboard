# Tutorial Platform (Admin Console)

Purpose: Canonical design + operating notes for the Cloudscape hands-on tutorial system in the admin dashboard.

Status: Active (refactored to centralized platform on 2026-02-11).

## Architecture (single source of truth)

- Tutorial catalog and shared runtime helpers live in `src/tutorials/tutorialPlatform.js`.
- Legacy files are now thin category wrappers:
  - `src/tutorials/isetCoordinatorIntroTutorials.js`
  - `src/tutorials/applicationWorkspaceTutorials.js`
  - `src/tutorials/caseWorkspaceTutorials.js`
  - `src/tutorials/nwacAssessmentTutorials.js`
- App runtime wiring (prompting/start/end/routing/status) is in `src/AppContent.js`.
- Home header hotspots are wired in `src/routes/AppRoutes.js`.
- Role-filtered home tutorial listing in help panel is in `src/helpPanelContents/homeDashboardHelp.js`.
- Tutorials dashboard status management UI is in `src/pages/support/TutorialsDashboardPage.jsx`.

## Tutorial IDs (current)

- `iset-coordinator-intro-v2`
- `regional-manager-intro-v1`
- `program-admin-intro-v1`
- `application-workspace-overview-v3`
- `case-workspace-overview-v3`
- `nwac-assessment-decision`

## Home intro hotspot contract

These IDs must exist and remain stable unless intentionally versioning tutorial IDs:

- `home-overview` (homepage header/title area)
- `home-layout-controls` (Add widget / Reset layout controls area)
- `home-program-work-queue`
- `home-coordinator-work-queue`
- `home-work-queue-items`
- `home-my-tagged-applications`
- `home-info-link` (homepage Info link)
- `intro-side-navigation`
- `intro-tutorials-link`

If any next-step hotspot is missing, Cloudscape can disable `Next` on the current step.

## Case workspace hotspot contract

These IDs must exist for the case workspace walkthrough:

- `case-workspace-header`
- `case-workspace-quick-actions`
- `case-workspace-participant-details`
- `case-workspace-action-plans`
- `case-workspace-interventions`
- `app-workspace-supporting-documents` (shared widget)
- `app-workspace-secure-messaging` (shared widget)
- `app-workspace-notes-tasks` (shared widget)
- `app-workspace-case-calendar` (shared widget)

## Prompting and progress rules

- Progress is DB-backed via `/api/me/tutorial-progress` (`completed` / `dismissed`).
- Home intro auto-prompt is role-specific and mapped via `getHomeIntroTutorialIdForRole`.
- Case workspace auto-prompt appears on first visit to `/cases/:id` when `case-workspace-overview-v3` is not `completed` or `dismissed`.
- `Not now` and `End` persist `dismissed`.
- `Finish` persists `completed`.
- Tutorials dashboard reset emits `tutorials:refresh`; app resets in-memory prompt guards and reloads DB progress.
- Tutorials dashboard lists role-relevant tutorials only, one row per tutorial.
- Tutorials dashboard per-row toggle:
  - `On` -> `POST /api/me/tutorial-progress` with `status: completed`
  - `Off` -> `POST /api/me/tutorial-progress/reset` with `{ tutorialId }` (marks tutorial incomplete by removing completion/dismissal row)
- Tutorials dashboard `Reset all` uses `POST /api/me/tutorial-progress/reset` with empty body.
- Workspace tutorials force a layout reset before start so required hotspot widgets are present and `Next` cannot dead-end due to customized layouts.

## Content-edit safety rules

- Prefer content-only edits in `tutorialPlatform.js`.
- Do not change runtime logic in `AppContent.js` for copy-only requests.
- For coordinator-facing tutorials, write the copy as PATH onboarding for staff who are learning how to do their work in the system. Bias toward task flow, what to record, and what happens next rather than generic dashboard mechanics.
- If the onboarding purpose changes materially and existing staff should see the revised walkthrough automatically, bump the tutorial ID version intentionally even when the hotspot structure still works.
- Keep role mapping in one place (`tutorialPlatform.js`) and import it where needed.
- When hotspot placement changes, verify all steps in order for each affected tutorial.
- If hotspot structure changes incompatibly, bump tutorial ID version (`*-v2`) to avoid stale progress collisions.

## Regression checklist (minimum)

For each changed tutorial:

1. Start from help panel and from auto-prompt.
2. Verify every `Next` transition across all steps.
3. Verify `Restart tour` resets to step 1.
4. Verify `End` exits and suppresses auto-prompt.
5. Reset tutorial progress in Tutorials dashboard.
6. Revisit page and confirm prompt appears again.
7. Confirm role sees only its own homepage intro in home help panel.

## Known pitfalls

- Wrapping major header text in a hotspot can alter layout (e.g., Info link line-break).
- Anchoring to a broad container may be less reliable than anchoring to a concrete element.
- Missing `home-info-link` caused step progression to block on the previous step.
