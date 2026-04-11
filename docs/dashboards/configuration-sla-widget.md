# Workflow Timing Targets Widget

## Current Behavior
- Route: `Configuration > Workflow timing targets`
- Frontend: `src/pages/configurationSettings.js`, `src/widgets/SlaConfigWidget.js`
- Backend: `GET /api/config/sla-targets`, `PUT /api/config/sla-targets/:id`, `POST /api/config/sla-targets`
- Storage: `sla_stage_target`

The widget is live. It loads the active default workflow timing targets, allows inline edits, and saves changes back to `sla_stage_target` by creating a new active row per stage when needed.

## Stage Order
- `assignment`
- `ei_status_verification`
- `assessment`
- `program_decision`
- `docs_request_reminder`
- `docs_request_closure`

The EI stage was added on `2026-04-11` through migration `db/migrations/20260411_0001_add_ei_status_verification_sla_stage.sql`.

## Current Timing Model
- Application-facing timeline badges and overdue calculations are milestone-based and still anchor to the application submission/creation timestamp.
- The active stage is chosen from the live file state:
  - `assignment`: file is still unassigned.
  - `ei_status_verification`: file is assigned and `assessment_esdc_eligibility` is still blank.
  - `assessment`: EI status is recorded and the file is still in pre-decision review.
  - `program_decision`: application status is `pending_approval` or `decision_ready`.
- Shared frontend helper: `src/utils/applicationSla.js`
- Shared backend helpers: `getApplicationSlaStageKey()` and `computeApplicationSlaTiming()` in `isetadminserver.js`

## Impacted Surfaces
- `Manage ISET Applications` table `Overdue` column
- `Application Overview` widget `Timeline status`
- Homepage/work-queue due and overdue badges
- Application work-queue due/overdue counters

## References
- `src/helpPanelContents/slaWidgetHelp.js`
- `docs/dashboards/application-assessment-dashboard.md`
- `docs/guides/status-lifecycle-implementation.md`
