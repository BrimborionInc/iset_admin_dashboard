# Change Request CR-0007: ESDC Intervention Data Alignment

## Overview
- **Requestor:** Internal (prompted via admin dashboard review)
- **Date Raised:** 2025-10-24
- **Status:** Draft
- **Related Components:** Admin Dashboard (Coordinator Assessment widget, Participant Workspace payload generation), ISET intake payload, esdc_participant_submission pipeline

## Problem Statement
The current ILMP participant XML snapshots generated for ESDC lack several mandatory Action Plan and Intervention elements defined in the "SPECS-DG-ILMP Data Exchange Guide" (Nov 2022). The NWAC Assessment widget captures partial details but does not provide structured data for intervention codes, NOC identifiers, childcare information, or intervention outcomes. As a result, payloads fall back to minimal data, risking rejection once full ESDC validation is enforced.

## Goals & Outcomes
1. Capture the full set of intervention/action-plan attributes required by ESDC within the admin workflow.
2. Ensure generated ILMP payloads always include at least one fully populated `<Intervention>` with compliant fields (code, NOC, cost, duration, outcome, etc.).
3. Maintain backward compatibility so existing submissions still succeed while gradually enriching data quality.

## Current Findings
- `buildIlmpParticipantPayload` already emits `<ActionPlan>` and nested `<Interventions>`, but only when intake answers provide minimal fields (target program, dates).
- The NWAC Assessment widget collects narrative context, start/end dates, institutions, and funding breakdowns (ITP/Wage tables) but lacks structured inputs for:
  - Intervention code (Working Group codes 1–20)
  - NOC and NOC version (intervention/result/previous employment)
  - Action plan result code/date and intervention outcomes (ESDC enumerations)
  - Childcare need/funding flags
  - Intervention duration and cost validations expected by ESDC
- Intake answers (`target-program`, `intervention-start-date`, etc.) remain a useful fallback but are insufficient to satisfy schema validation (e.g., `interventionCost` becomes mandatory once dates/results exist).

## Proposed Scope
1. **UX/Data Capture**
   - Extend NWAC Assessment widget to collect the missing structured fields: intervention code, NOC + version, childcare need/funding, action-plan result code/date, intervention outcome, duration (or allow auto-derivation with override), and any other conditional fields noted in the ILMP guide.
   - Align dropdown values with the ESDC enumerations (Working Group intervention codes; action plan result codes; NOC version years).
   - Persist new fields in `iset_case_assessment` (new columns or JSON blocks as appropriate).
   - Provide validation/error messaging consistent with the ESDC rules (e.g., cost required when end date supplied).

2. **Server/Payload Logic**
   - Update extractors in `isetadminserver.js` to read the new assessment fields, falling back to intake answers when assessment data is missing.
   - Enhance `buildIlmpParticipantPayload` to populate action plan and intervention nodes with the richer dataset (including `interventionCost`, `interventionDuration`, `InterventionRelatedNOC`, `InterventionRelatedNOCVersion`, childcare fields, result code/date, notes).
   - Ensure ITP/Wage tables feed into total cost calculations in a format compatible with the XML schema (numeric only, no currency symbols).

3. **Testing & Validation**
   - Unit/integration tests for payload builder covering scenarios: no assessment data, partial data, full NWAC override.
   - Manual validation against schema examples from the ESDC guide.
   - Confirm backward compatibility for participants created prior to the change (payload still generates, with or without new data).

## Open Questions
- Do we need to capture multiple interventions per action plan? (Guide allows many; current intake only maps one.)
- Should NOC data come from NWAC assessment or separate labour-market profiling? (Pending stakeholder confirmation.)
- How should intervention duration be derived when start/end are present—auto compute days or collect explicit weeks/hours?
- Are there reporting implications for the new fields (e.g., finance module)?

## Dependencies & References
- **Spec:** `docs/data/ESDC/SPECS-DG-ILMP Data Exchange Guide_nov2022.odt` (expanded under `spec_odt/`).
- **Widgets:** `src/widgets/CoordinatorAssessmentWidget.js` (NWAC Assessment), `src/pages/esdc/widgets/EsdcPayloadPreviewWidget.jsx` (preview), `src/pages/esdc/ParticipantWorkspacePage.jsx` (context).
- **Server:** `isetadminserver.js` (`extractActionPlanDetails`, `buildIlmpParticipantPayload`).

## Acceptance Criteria
- NWAC assessment UI presents all required intervention fields with validation aligned to the ESDC guide.
- `iset_case_assessment` stores new data and exposes it via existing case detail endpoints.
- Generated XML for a submission containing assessment data includes a compliant `<ActionPlan>` with at least one `<Intervention>` covering code, dates, outcome, cost, NOC, childcare fields, and notes.
- Payload passes schema validation using example checklists from the guide.
- Documentation updated to guide assessors on providing the new data points.

## Next Steps
- Confirm data requirements with NWAC/ESDC stakeholders.
- Design updated UI mock-ups / workflow for NWAC assessment changes.
- Implement persistence schema updates (migration + API changes).
- Update payload builder and add automated tests.
- Pilot with sample submissions and validate against ESDC acceptance tooling.
