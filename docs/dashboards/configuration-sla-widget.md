# SLA Configuration Widget Plan

## Current Status
- Front-end widget now loads SLA targets, supports inline editing, and exposes Save/Cancel actions (saved in header).
- SLA schema migration `20251002_0006_add_sla_stage_target.sql` lives in ISET-intake repo and has been applied.
- SQL table `sla_stage_target` seeded with four baseline stages.

## Next Steps
1. Implement API handlers in `isetadminserver.js`:
   - `GET /api/admin/sla-targets` (requires System/Program Administrator roles).
   - `PUT /api/admin/sla-targets/:id` for updates.
   - `POST /api/admin/sla-targets` for new versions / overrides.
2. Wire authentication helpers (reuse `resolveRequestActor`, ensure role check via `hasSlaAdminAccess`).
3. After endpoints exist, re-test dashboard workflow (GET/PUT/POST) and ensure optimistic state resets properly.
4. Extend downstream dashboards/alerts to consume stored targets.

## References
- Migration runner documentation: `docs/architecture/migration-runner-overview.md`
- Live schema snapshot: `docs/data/snapshot.sql`
- Table: `iset_intake.sla_stage_target`
