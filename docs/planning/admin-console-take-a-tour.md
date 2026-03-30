# Admin Console "Take a Tour" (Hands-on Tutorials) - Interview Notes

Purpose: Capture requirements and decisions for adding a "Take a tour" feature to the Admin Console using Cloudscape hands-on tutorials.

Audience: Admin dashboard engineers and reviewers.

Last Updated: 2026-02-10

## Status

- Implemented (2026-02-10): ISET Coordinator intro tour + one-time sign-in prompt + DB-backed progress tracking.
- Current live coordinator intro tutorial ID: `iset-coordinator-intro-v2` after the PATH onboarding rewrite on 2026-03-30.
- Deferred: Tutorials dashboard (`/tutorials-dashboard`) and additional role-specific tours (Program Admin, Regional Manager).

## Implementation Summary (2026-02-10)

- Tutorial ID: `iset-coordinator-intro-v1` (role: canonical `Application Assessor`).
- Auto-trigger: on homepage (`/`) after sign-in, show a one-time confirmation modal (Start tour / Not now).
- Persistence: stored per staff profile in MySQL table `staff_tutorial_progress` (`completed` | `dismissed`).
- Hotspots: added stable anchors on the homepage widgets and side navigation so the tour does not depend on live row-level data.
- LocalStorage migration: legacy completion key `iset-tutorials.completed.v1` is migrated into DB once, then cleared.

## Workflow Constraints (from `docs/AGENTS.md`)

- Follow Interview -> Planning -> Implementation for complex tasks.
- Ask one short question at a time; stop and wait after each answer.
- Prefer evidence over guesses: inspect code/docs before claiming behavior exists.
- Use Cloudscape components/patterns (avoid native HTML when a Cloudscape equivalent exists).
- Keep secrets/credentials out of docs.

## Evidence From Current Codebase (as of 2026-02-10)

- Cloudscape hands-on tutorials infrastructure already exists:
  - `AnnotationContext` wraps the app in `src/AppContent.js`.
  - Many widgets render `Hotspot` anchors (examples in `src/widgets/*`).
  - Help panels render `TutorialPanel` (examples in `src/helpPanelContents/*`).
- Tutorials list is assembled in `src/AppContent.js` and exposed via `src/context/TutorialsContext.js`.
- Tutorial definitions exist under `src/tutorials/` (e.g., `src/tutorials/applicationWorkspaceTutorials.js`).
- Tutorial completion is currently persisted client-side via `loadTutorialCompletionMap()` / `persistTutorialCompletionMap()` in `src/AppContent.js`.
- Navigation includes a "Tutorials" side-nav link to `/tutorials-dashboard` (`src/layouts/SideNavigation.js`); access mapping references this route (`src/widgets/AccessControlMatrix.jsx`).
- Post-login landing page is `/` which renders `src/pages/home/HomeDashboardPage.jsx` via `src/routes/AppRoutes.js`.

## Requirements Captured So Far

- Target roles: Program Admin, Regional Manager, ISET Coordinator.
- Start with ISET Coordinator tutorial first (simplest; fewer dashboards).
- Track which staff have completed which tutorials.
- If a staff member has not completed the introductory tutorial, it should auto-trigger after they sign in.
- The auto-triggered intro tour must start on the ISET Coordinator homepage (do not navigate to the tutorials dashboard).
- On sign-in, show a confirmation prompt with "Start tour" and "Not now" before beginning the tour.
- "Not now" should mean do not prompt again automatically ("never"). The prompt copy should mention tutorials can be run later from the Tutorials page.
- If a user starts the tour but exits part-way through, treat that exit as equivalent to "Not now" (never auto-prompt again).
- The "Tutorials" link in the side navigation is currently a placeholder; the full tutorials dashboard (reset tutorials, access to all tutorials, etc.) will be a later task.
- Do not implement the `/tutorials-dashboard` page/route in this task; focus on the intro tutorial itself.
- Manual replay/start entry point is not required in this task; one-time sign-in prompt is sufficient (replay will wait for the future Tutorials page).
- Tutorial completion must be persisted in the database (add/amend tables as needed) so completion follows the staff account across browsers/devices.
- Use the database as the source of truth for tutorial completion tracking (including existing tutorials currently stored in localStorage).
- Intro tour content scope (ISET Coordinator): cover what's on the homepage and what is available via side navigation/top navigation (orientation and wayfinding).

## Proposed Step Outline (from interview)

ISET Coordinator intro tutorial steps:

1) Welcome + orientation: overview of the Admin Console and reminder tutorials are accessible from Support (highlight the Tutorials link in side navigation).
2) Home page: "When you first sign in you will be taken to your home page."
3) Main homepage widgets: Work Queue, Queue Items widget, My Tagged Applications.
4) In-context help: how the Info links can be used to access help relevant to the current page.
5) Navigation: quick tour of the side navigation (and other top-level navigation where relevant).

## Decision Defaults (best judgement)

- If the user clicks "Not now", record the intro tutorial as `dismissed` (not `completed`) so:
  - It will not auto-prompt again.
  - It can still appear as incomplete later on the Tutorials page when that dashboard is built.
- If the user starts the intro tutorial but exits before finishing, treat it the same as "Not now" (`dismissed`).

## Implementation Plan (Implemented)

### Phase 1: Data model (DB)

- Add a new table to persist per-staff tutorial progress.
- Use the existing staff identity already present in the admin server (`staff_profiles` + `resolveActiveStaffProfileId(req)`).

Proposed table: `staff_tutorial_progress`

- Columns:
  - `id` INT PK
  - `staff_profile_id` INT NOT NULL
  - `tutorial_id` VARCHAR(128) NOT NULL
  - `status` VARCHAR(32) NOT NULL  (`completed` | `dismissed`)
  - `completed_at` DATETIME NULL
  - `dismissed_at` DATETIME NULL
  - `created_at` / `updated_at` timestamps
- Constraints / indexes:
  - UNIQUE (`staff_profile_id`, `tutorial_id`)
  - INDEX (`staff_profile_id`)
  - INDEX (`tutorial_id`)

Files:
- `sql/20260210_0001_create_staff_tutorial_progress.sql` (new)

### Phase 2: Server API (progress read/write)

- Add authenticated endpoints for the current staff member:
  - `GET /api/me/tutorial-progress` -> returns progress map for all known tutorials.
  - `POST /api/me/tutorial-progress` -> upsert `{ tutorialId, status }`.
  - `POST /api/me/tutorial-progress/bulk-complete` -> upsert `{ tutorialIds: [...] }` as completed (migration helper).
- Use `resolveActiveStaffProfileId(req)`; require staff profile (401 if missing).
- Keep payloads small and explicit; ignore unknown tutorial IDs (or accept any string, but validate length).

Files:
- `isetadminserver.js` (add routes near other `/api/me/*` handlers)

### Phase 3: Client persistence (DB is source of truth)

- Replace `localStorage` tutorial completion persistence with DB-backed state.
- On app load (signed-in), fetch progress map and derive:
  - `completedMap` for tutorial UI (`status === 'completed'`)
  - `dismissedMap` for gating auto-prompt (`status === 'dismissed'`)
- One-time migration: if server returns no progress yet and localStorage contains prior completions:
  - POST those tutorial IDs to `bulk-complete`
  - then clear the localStorage key `iset-tutorials.completed.v1`

Files:
- `src/AppContent.js` (replace `loadTutorialCompletionMap` / `persistTutorialCompletionMap` with API load + write helpers)
- `src/tutorials/applicationWorkspaceTutorials.js` (adapt to DB-backed completion map input)
- `src/tutorials/nwacAssessmentTutorials.js` (adapt to DB-backed completion map input)

### Phase 4: New intro tutorial definition (ISET Coordinator)

- Add a new tutorial definition file and include it in `tutorials` list.
- Tutorial ID strategy:
  - `iset-coordinator-intro-v1` (stable; version suffix increments only on breaking changes)
- Category strategy:
  - `admin-console-intro` (or similar) so it can be grouped later on the Tutorials dashboard.

Files:
- `src/tutorials/isetCoordinatorIntroTutorials.js` (new)
- `src/AppContent.js` (include builder in tutorials list)

### Phase 5: Hotspots (home page + navigation)

- Add hotspot anchors needed by the intro tutorial:
  - Side navigation (Support area / Tutorials link context) -> wrap the side nav container.
  - Home page overview -> hotspot near the board top.
  - Widget hotspots -> Work Queue, Work Queue Items, My Tagged Applications.
  - Info link hotspot -> pick one canonical Info link and wrap it.
- Hotspot ID convention:
  - `intro-*` for cross-page/navigation anchors.
  - `home-*` for homepage widget anchors.

Files (expected):
- `src/AppContent.js` (wrap `<SideNavigation />` with `<Hotspot ...>`; and optionally force-expand Support during the tutorial)
- `src/pages/home/HomeDashboardPage.jsx` (add a top-of-page hotspot anchor)
- `src/pages/home/widgets/IsetCoordinatorWorkQueueWidget.js` (add hotspot)
- `src/pages/home/widgets/WorkQueueItemsTableWidget.js` (add hotspot + optional info link hotspot)
- `src/pages/home/widgets/MyWatchlistWidget.js` (add hotspot)

### Phase 6: Auto-trigger UX (one-time sign-in prompt)

- On route `/` for role "Application Assessor" (ISET Coordinator):
  - If intro tutorial has no progress row yet, show a modal prompt:
    - Primary: "Start tour"
    - Secondary: "Not now" (records `dismissed`)
    - Copy: mentions tutorials can be accessed later from the Tutorials link under Support (even though the dashboard is a later task).
- If "Start tour":
  - Open the tools/help panel with a TutorialPanel focused on the intro tutorial.
  - Start the tutorial immediately (set `currentTutorial`).
- If the user exits before finishing:
  - Record `dismissed` for the intro tutorial (no further auto-prompts).
- If the user finishes:
  - Record `completed`.

Files:
- `src/AppContent.js` (modal + trigger logic; onExit/onFinish handlers)
- `src/helpPanelContents/` (new minimal help panel content that embeds `TutorialPanel` for this intro tutorial)

### Testing

- DB: verify migration runs and table exists; verify unique constraint prevents duplicates.
- API: manual `curl` with `X-Dev-UserId` header to GET/POST progress and check DB rows.
- UI:
  - Sign in as ISET Coordinator: confirm prompt shows once when no progress exists.
  - "Not now": confirm no repeat prompt on refresh/sign-out+sign-in and DB row is `dismissed`.
  - "Start tour": confirm tutorial panel opens and hotspots appear for each step.
  - Exit mid-tour: confirm DB row becomes `dismissed`.
  - Finish: confirm DB row is `completed`.
  - Existing tutorials: confirm completion is written to DB and no longer depends on localStorage.

## Deferred / Out of Scope For This Task

- LLM "tour guide" integration (previously requested) is explicitly deferred; focus on a simple intro tutorial first.

## Deferred Questions (Future Work)

- What should the ISET Coordinator "intro" tour cover (sections/pages, and step order)?
- Should the tour stay on the coordinator homepage only, or guide across multiple routes (and if multi-route, what routing behavior is acceptable)?
- Completion semantics: what counts as "completed" vs "dismissed" vs "snoozed"?
- Persistence expectations: should completion follow the staff account across browsers/devices (server-side), or is per-browser acceptable for the first iteration?
- Manual entry point: besides auto-trigger, where should "Take a tour" be launched from until the tutorials dashboard is built?
