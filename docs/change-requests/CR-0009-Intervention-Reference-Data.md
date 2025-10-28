# Change Request CR-0009 – Intervention Reference Data Enablement

## Context
- **Trigger:** Follow-up to CR-0008; we wired the Case Workspace intervention modal to live data and now need durable sources of truth for ILMP-controlled fields.
- **Goal:** Replace ad-hoc lists with database-backed catalogues so the UI, services, and exports stay aligned with ESDC schema requirements.
- **Scope:** Intervention code dropdown (completed), plus planned tables for outcomes, funding streams, and NOC references.

## Changes Completed
1. **Database**
   - Added `sql/20251029_01_create_esdc_intervention_code.sql` creating `esdc_intervention_code` and seeding ILMP 1.4 codes (1–20).
   - Added `sql/20251029_02_create_esdc_intervention_outcome.sql` creating `esdc_intervention_outcome` with outcomes 1–6.
   - Added `sql/20251029_03_create_funding_stream.sql` creating `funding_stream` (seeded EI/CRF).
   - Added `sql/20251029_04_create_noc_reference_tables.sql` creating `noc_version` and `noc_code` (seeded representative NOC 2016/2021 entries).
2. **Backend**
   - `GET /api/reference/intervention-codes`, `/intervention-outcomes`, `/funding-streams`, `/noc-versions`, `/noc-codes` now read from the new tables and support filtered NOC code search.
3. **Frontend**
   - `CaseWorkspaceContext` lazily loads codes/outcomes/funding streams/NOC versions and exposes an async NOC search helper.
   - `InterventionModal` renders code/outcome/funding stream as dropdowns, enforces required NOC version/code for ILMP intervention types, and provides async NOC search.
   - `InterventionsWidget` fetches the new reference data on modal open and surfaces load errors.
   - Minor UX tweak: clicking an action-plan row selects the plan (improves table usability).

## Open Work
| Item | Description | Status | Target |
|------|-------------|--------|--------|
| Budget pots | Defer until finance module tables exist (per architecture plan §6) | Deferred | |

## Notes
- Apply migrations `20251029_01` through `20251029_04` and restart the backend to pick up reference data changes.
- Reference data tables include schema/version metadata so we can extend them when ESDC publishes updates.
