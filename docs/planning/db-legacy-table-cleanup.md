# Legacy Table Cleanup Plan (Dev)
_Last updated: 2025-01-13_

## Objective
Identify tables in the shared database that are unused by the current admin dashboard or public intake codebases, validate no live dependencies, and drop them safely in development.

## Scope
- Environment: **Dev** only (confirm before any wider rollout).
- Systems: Admin dashboard, public intake, backend services, scheduled jobs, and integrations pointing at the same DB.
- Out of scope: Data archival beyond lightweight exports, application feature rewrites.

## Approach
1) **Inventory**: List all tables in dev; tag by feature/domain and current usage status.
2) **Usage verification**: Cross-check code references (backend queries, migrations, cron/jobs) and runtime endpoints against the inventory.
3) **Safety checks**: Snapshot or export schemas/data for any table marked for drop; confirm no foreign key constraints block removal.
4) **Drop in tranches**: Remove clearly unused groups in small batches; rerun smoke checks.
5) **Document**: Record decisions, evidence, and executed SQL in this file; update README with learnings if relevant.

## Deliverables
- Table inventory with status: in-use, unknown, unused → drop.
- Evidence notes per dropped table/group.
- Executed SQL (dev) and outcomes.
- Follow-up actions (e.g., prod plan if requested).

## Tasks & Tranches
- **Tranche 1: Inventory & tagging**
  - [x] Get full table list from dev (MySQL `iset_intake`; includes row estimates and create/update times).
  - [ ] Map each to feature/domain and note suspected legacy features (appointments, VAC mgmt, queue mgmt, package tracking, analytics).
- **Tranche 2: Code/reference scan**
  - [ ] Search admin-dashboard code (frontend/backends) for table/column references.
  - [ ] Search public intake code for the same.
  - [ ] Scan scripts/migrations/cron jobs for usage.
  - [ ] Flag unknowns for manual confirmation.
- **Tranche 3: Candidate drop list (dev)**
  - [ ] Propose drop list with evidence.
  - [ ] Confirm no FK blockers; note any dependent tables needing sequence.
- **Tranche 4: Execute drops (dev)**
  - [ ] Export schema snapshots for tables to drop.
  - [x] Run DROP TABLE statements in dev (grouped by tranche).
  - [ ] Smoke check affected apps/endpoints.
- **Tranche 5: Wrap-up**
  - [ ] Document outcomes and keep this plan updated.
  - [ ] Add README note(s) if needed for future cleanup or prod rollout.

## Open Questions / Dependencies
- None yet. Expect: access to run DB metadata queries and apply DROP TABLE in dev.

## Notes
- Keep groups small to limit blast radius and ease rollback.
- If any table looks unused but has recent data writes, pause and confirm before dropping.
- Current inputs:
  - 2025-01-13: Received MySQL table inventory for schema `iset_intake` with row estimates and create/update timestamps (from `information_schema.tables`).
  - 2025-01-13: Row estimates for legacy-suspect tables (from `information_schema.tables`, dev):
    - Zero rows: `appointment`, `booking`, `counter`, `counter_session`, `operating_hours`, `option_data_sources`, `queue`, `queue_event_log`, `role`, `slot`, `ticket_counter`, `user_role_link`, `value_added_service`.
    - Non-zero rows (small): `country` (5), `country_holiday_link` (21), `facility_requirement` (9), `holiday` (24), `hub_and_spoke_link` (3), `ircc_office` (5), `language` (28), `location_language_link` (13), `location_service_link` (138), `location_type` (4), `queue_ticket_config` (5), `reason_code` (9), `service_type` (9), `service_type_component_link` (72).
  - 2025-01-13: Code scan findings (admin-dashboard + intake):
    - Backend endpoints still present in `admin-dashboard/isetadminserver.js` for `appointment`, `counter_session`, `location_service_link`, `service_type`, `location_*`, etc. These appear to be legacy appointment/queue APIs; not known to be in current navigation.
    - Frontend routes/components for book-appointment flows remain in `admin-dashboard/src/routes/AppRoutes.js` and `src/previews/bookAppointmentQ*.js`; likely unused (legacy VAC booking UI) but still present.
    - Help text/widgets referencing appointment/queue remain (e.g., `src/utils/helpMessages.js`, `src/helpPanelContents/newAppointmentFormHelp.js`); likely legacy content.
    - Intake repo references are limited to historical dumps/examples; no active renderer/runtime usage found for appointment/queue tables.
  - 2025-01-13: User approved dropping zero-row legacy tables despite legacy endpoints remaining in code.
  - 2025-01-13: Dropped zero-row legacy tables in dev: `booking`, `counter_session`, `counter`, `queue_event_log`, `queue_ticket_config`, `queue`, `ticket_counter`, `slot`, `appointment`, `user_role_link`, `option_data_sources`, `operating_hours`, `value_added_service`, `role`.
  - 2025-01-13: User approved dropping remaining small-row legacy tables; confirmed `intake_workflow` and `service_type` (and dependents) are safe to drop; `location` is unused and can be dropped; keep `organization` and `ptma` at that time.
  - 2026-05-29 update: Bill clarified that PTMA data should now be considered legacy/dormant early-development residue. Do not seed PTMA rows for TEST sandbox/demo data or new workflows unless the PTMA operating model is explicitly revived.
  - 2025-01-13: Dropped small-row legacy tables in dev via batch DROP (warning: `queue_ticket_config` already absent): `location_language_link`, `location_service_link`, `intake_workflow_blockstep_link`, `intake_workflow`, `facility_requirement`, `reason_code`, `service_type_component_link`, `service_type`, `location`, `location_type`, `ircc_office`, `hub_and_spoke_link`, `country_holiday_link`, `holiday`, `country`, `language`. `queue_ticket_config` previously dropped.
  - 2025-01-13: Post-drop inventory (`iset_intake`): only current app/case tables remain (e.g., `iset_application*`, `iset_case*`, `workflow*`, `component*`, `organization`, `ptma`, `noc_*`, `notification_*`, `iset_event_*`, `iset_internal_notification_*`, `iset_runtime_config`, `schema_migrations`, `__migrations`, `zz_legacy_documents`, etc.).
  - 2025-01-13: Pruned legacy backend endpoints in `isetadminserver.js` (removed appointment/queue/counter/location/service API routes and option-data-sources helper) to avoid hitting dropped tables.

## Status / Next Actions
- Smoke check: low risk (legacy-only tables removed; legacy endpoints pruned). Proceed with normal app launch; report any errors referencing dropped tables to confirm no hidden runtime dependencies.
- Wrap-up:
  - [x] Add README notes about legacy table cleanup (dev).
  - [ ] Optional: prune remaining legacy UI routes/help content later to remove dead code.

## Tranche 3/4 drop plan (small-row legacy tables)
- Scope to drop (dev): `intake_workflow`, `intake_workflow_blockstep_link`, `service_type`, `service_type_component_link`, `facility_requirement`, `reason_code`, `location_service_link`, `location_language_link`, `location`, `location_type`, `ircc_office`, `queue_ticket_config`, `hub_and_spoke_link`, `country_holiday_link`, `holiday`, `country`, `language`.
- FK sequencing (drop children before parents):
  1) `location_language_link` (FKs: location → language)
  2) `location_service_link` (FKs: location → service_type)
  3) `intake_workflow_blockstep_link` (FK: intake_workflow)
  4) `intake_workflow` (FK: service_type)
  5) `facility_requirement` (FK: service_type)
  6) `reason_code` (FK: service_type)
  7) `service_type_component_link` (FK: service_type)
  8) `service_type`
  9) `location`
  10) `location_type`
  11) `ircc_office`
  12) `queue_ticket_config`
  13) `hub_and_spoke_link`
  14) `country_holiday_link`
  15) `holiday`
  16) `country`
  17) `language`
- Suggested dev SQL (run in this order):
  ```sql
  -- Optionally: SHOW CREATE TABLE <name>; SELECT COUNT(*) FROM <name>; before drop
  DROP TABLE IF EXISTS
    location_language_link,
    location_service_link,
    intake_workflow_blockstep_link,
    intake_workflow,
    facility_requirement,
    reason_code,
    service_type_component_link,
    service_type,
    location,
    location_type,
    ircc_office,
    queue_ticket_config,
    hub_and_spoke_link,
    country_holiday_link,
    holiday,
    country,
    language;
  ```
- Post-drop:
  - [ ] Re-run table inventory to confirm removal.
  - [ ] Smoke check admin dashboard and intake (navigation/load of current features).
  - [ ] Note any errors tied to leftover legacy endpoints; consider pruning code later.

## Next tranche proposal (small-row legacy tables)
- Candidates: `country` (5), `country_holiday_link` (21), `facility_requirement` (9), `holiday` (24), `hub_and_spoke_link` (3), `ircc_office` (5), `language` (28), `location_language_link` (13), `location_service_link` (138), `location_type` (4), `queue_ticket_config` (5), `reason_code` (9), `service_type` (9), `service_type_component_link` (72).
- Checks to run before drop:
  - [ ] Verify current code paths don’t depend on these (service/location taxonomy, workflows).
  - [ ] Confirm FK dependencies (e.g., `location_service_link` references `location` and `service_type`; `service_type_component_link` references components; `intake_workflow` references `service_type`).
  - [ ] Snapshot schemas/data for archival.
  - [ ] Sequence drops to satisfy FK constraints.
  - [ ] Post-drop smoke check.

## Inventory snapshot (WIP tagging for Tranche 2)
- Legacy-suspect (appointment/queue era; mostly 0 rows): `appointment`, `booking`, `slot`, `queue`, `queue_event_log`, `queue_ticket_config`, `ticket_counter`, `counter`, `counter_session`, `hub_and_spoke_link`, `facility_requirement`, `operating_hours`, `value_added_service`, `reason_code`, `service_type`, `service_type_component_link`, `location_service_link`, `location_language_link`, `location_type`, `ircc_office`, `country_holiday_link`, `holiday`, `language`, `country`, `option_data_sources`, `role`, `user_role_link`.
- Workflow/config tables (likely current runtime): `blockstep`, `component`, `component_template`, `component_template_backup`, `step`, `step_component`, `workflow`, `workflow_step`, `workflow_route`, `workflow_route_option`, `intake_workflow`, `intake_workflow_blockstep_link`.
- Metadata/migrations: `__migrations`, `schema_migrations`, `iset_migration`, `system_config`, `system_config_audit`.
- Newer ISET app/case domain tables (Dec 2025 timestamps): `iset_application*`, `iset_case*`, `esdc_*`, `funding_stream`, `noc_*`, `iset_indigenous_bands`, `notification_*`, `iset_internal_notification*`, `iset_event_*`, `contact_message*`, `client`, `staff_profiles`, `application_lock`, `pending_uploads`, `notification_template`, `notification_setting`, `sla_stage_target`, `input_json_state`, `iset_runtime_config`, `organization`, `location`, `user_session_audit`, `system_config*`, `isetc_*` (as listed in the inventory). The `ptma` table was previously grouped here but is now considered legacy/dormant unless explicitly revived.
- Retired in DEV: `jordan_application` and `jordan_application_draft` were confirmed empty legacy experiment tables and dropped by fail-closed migration `20260427_0003_retire_jordan_application_experiment_tables.sql`. TEST/PROD must first prove they are empty, or quarantine/archive non-empty rows separately.
- Retired in DEV: old appointment/queue stored procedures `CheckBILUsage`, `CheckInUser`, `GenerateTicketNumber`, `PurgeAppointments`, and `PurgeSlots` were dropped by `20260427_0004_retire_appointment_queue_legacy_routines.sql` after confirming their backing tables are already absent and no live `CALL` sites remain.
- To confirm with code scan: `intake_workflow*`, `option_data_sources`, `value_added_service`, `country*` group, `language`, `reason_code`, `service_type*`, `location*`, `role/user_role_link`, `queue*`, `appointment*`.
