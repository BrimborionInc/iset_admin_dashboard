# ILMP 2023 Gap Analysis (Current Implementation vs ESDC 2023 Extract)

Prepared: 2026-02-19  
Scope: case workspace ILMP handling (validation, warnings/errors), ILMP Submissions & Exports dashboard queue/prepare/submit flow, and backend participant payload pipeline.

## Sources reviewed
- `docs/data/ESDC/ilmp-standard-data-file-iset-spf-2023-extracted.md`
- `docs/data/ESDC/ilmp-standard-data-file-iset-spf-2023-reference.xml`
- `docs/data/ESDC/ilmp-standard-data-file-iset-spf-2023-reference.xsd`
- `docs/data/ESDC/ilmp-iset-spf-2023-path-reference.xsd`
- `docs/data/ESDC/ilmp-iset-spf-2023-path-reference.sch`
- `isetadminserver.js`
- `src/server/esdcIlmpParticipantRules.js`
- `src/pages/Caseworking/caseWorkspace/modals/ActionPlanDetailsModal.jsx`
- `src/pages/Caseworking/caseWorkspace/modals/InterventionModal.jsx`
- `src/pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx`
- `src/pages/esdc/widgets/EsdcParticipantQueueWidget.jsx`
- `src/pages/esdc/widgets/EsdcParticipantValidationWidget.jsx`
- `src/pages/esdc/widgets/EsdcBatchSubmissionWidget.jsx`
- `src/pages/esdc/widgets/EsdcPayloadPreviewWidget.jsx`
- `docs/dashboards/government-submissions-dashboard.md`

## Important source caveat
The 2023 XSD/Schematron files in this folder are explicitly marked as reference/draft and not official ESDC validators.
- `docs/data/ESDC/ilmp-standard-data-file-iset-spf-2023-reference.xsd:6`
- `docs/data/ESDC/ilmp-iset-spf-2023-path-reference.xsd:7`
- `docs/data/ESDC/ilmp-iset-spf-2023-path-reference.sch:6`

This means final conformance still depends on official ESDC Data Exchange Guide + Data Gateway behavior.

## Executive summary
- Core action plan/intervention chronology rules are mostly implemented backend-side.
- Significant gaps remain for strict 2023 alignment: first/last-name validation, strict NOC validity checks, and immutable identity key handling after first submission.
- Backend and UI have rule mismatches that can cause inconsistent user outcomes.
- The participant queue trigger model is mainly product logic in code; there is no direct ESDC text that prescribes this exact queue lifecycle.
- Existing dashboard documentation is out of date versus implemented queue logic.

## Requirement source excerpts (ESDC)
Relevant quotes from the extracted 2023 material:
- "An Action Plan must have at least one (1) intervention."  
  `docs/data/ESDC/ilmp-standard-data-file-iset-spf-2023-extracted.md:467`
- "A client shall not have more than one active Action Plan at a time."  
  `docs/data/ESDC/ilmp-standard-data-file-iset-spf-2023-extracted.md:349`
- "Current Action Plan Result Date must have a value in order to start another Action Plan."  
  `docs/data/ESDC/ilmp-standard-data-file-iset-spf-2023-extracted.md:359`
- "If 'Barriers to Employment' is 'None' then no other barriers must be selected."  
  `docs/data/ESDC/ilmp-standard-data-file-iset-spf-2023-extracted.md:340`
- "When the 'Intervention Code' is 6 to 13 the 'Intervention Related NOC' is required."  
  `docs/data/ESDC/ilmp-standard-data-file-iset-spf-2023-extracted.md:509`
- "You may submit full client set each time or only new/modified records."  
  `docs/data/ESDC/ilmp-standard-data-file-iset-spf-2023-extracted.md:23`

## Participant submission queue: actual trigger logic in code
### Conditions for appearing in queue
A participant submission row is included when all applicable SQL conditions are true:
1. Action plan is not archived.  
   `isetadminserver.js:16384`
2. Reportable plan condition:
- Active plan with at least one intervention whose `start_date <= CURDATE()` and status in started/active/terminal sets.  
  `isetadminserver.js:16387` to `isetadminserver.js:16397`
- OR closed/ready-to-close plan with `result_date` and `result_code`, at least one intervention, and no non-terminal or missing-start interventions.  
  `isetadminserver.js:16399` to `isetadminserver.js:16418`
3. Submission status condition:
- `pending` or `rejected`, OR
- `submitted` only when still in qualifying final-plan state above.  
  `isetadminserver.js:16424` to `isetadminserver.js:16448`

Same queue conditions are reused for validate-all, batch-prepare, and batch-submit.
- `isetadminserver.js:16667` to `isetadminserver.js:16733`
- `isetadminserver.js:16830` to `isetadminserver.js:16907`
- `isetadminserver.js:16994` to `isetadminserver.js:17078`

### Events that push a participant back to "needs review"
- Intervention create/update/close/delete call `markIlmpNeedsReviewForCase`.  
  `isetadminserver.js:32787`, `isetadminserver.js:33510`, `isetadminserver.js:33700`, `isetadminserver.js:33799`
- Action plan patch calls `markIlmpNeedsReviewForCase`.  
  `isetadminserver.js:34495`
- Assessment/version workflows can reset participant submission readiness/status.  
  `isetadminserver.js:30408`, `isetadminserver.js:54179`

### Gap vs requirement source
No direct ESDC text was found that defines this exact queue trigger model. ESDC text defines data validity and reporting cadence/content, not internal queue event semantics.

## Rule-by-rule gap matrix
| ID | ESDC 2023 rule | Current implementation status | Gap assessment | Evidence |
|---|---|---|---|---|
| P-01 | SIN must be valid | Implemented (format + checksum) | Match | `src/server/esdcIlmpParticipantRules.js:53` to `src/server/esdcIlmpParticipantRules.js:87`; source `...extracted.md:56` |
| P-02 | DOB not future, age 1-100 | Implemented | Match | `src/server/esdcIlmpParticipantRules.js:89` to `src/server/esdcIlmpParticipantRules.js:123`; source `...extracted.md:87` |
| P-03 | Last name and first name must not be only numbers | No explicit blocking validation found for these fields | Gap | source `...extracted.md:64`, `...extracted.md:79`; participant rules do not include first/last name fields `src/server/esdcIlmpParticipantRules.js:51` to `src/server/esdcIlmpParticipantRules.js:246` |
| P-04 | Postal first letter must match province | Implemented | Match | `src/server/esdcIlmpParticipantRules.js:207` to `src/server/esdcIlmpParticipantRules.js:225`; source `...extracted.md:209` |
| P-05 | If intake status is employed, intake NOC and employment status required | Implemented backend + UI | Match (with extra NOC version requirement) | backend `isetadminserver.js:5679` to `isetadminserver.js:5744`; UI `ActionPlanDetailsModal.jsx:640` to `ActionPlanDetailsModal.jsx:643`; source `...extracted.md:239`, `...extracted.md:250` |
| P-06 | Barriers "None" cannot be combined with other barriers | Implemented backend | Match | `isetadminserver.js:5430` to `isetadminserver.js:5442`; source `...extracted.md:340` |
| AP-01 | Action plan start date not future, >= year 2000, before result/intervention start | Implemented backend + UI | Partial (allows same-day start/result where wording implies "before") | backend `isetadminserver.js:5525` to `isetadminserver.js:5603`; UI closeout chronology `ActionPlanDetailsModal.jsx:682` to `ActionPlanDetailsModal.jsx:689`; source `...extracted.md:352` |
| AP-02 | Result date required when result code exists; not future; not before start | Implemented backend + close endpoint + UI | Match | backend `isetadminserver.js:5746` to `isetadminserver.js:5784`; endpoint `isetadminserver.js:33990` to `isetadminserver.js:33998`; UI `ActionPlanDetailsModal.jsx:662` to `ActionPlanDetailsModal.jsx:689`; source `...extracted.md:360` |
| AP-03 | Employed result requires NOC | Implemented | Match (plus extra NOC version requirement) | backend `isetadminserver.js:5815` to `isetadminserver.js:5844`; endpoint `isetadminserver.js:34015` to `isetadminserver.js:34030`; UI `ActionPlanDetailsModal.jsx:693` to `ActionPlanDetailsModal.jsx:701`; source `...extracted.md:392` |
| AP-04 | Return-to-school result requires school detail | Implemented | Match | backend `isetadminserver.js:5845` to `isetadminserver.js:5857`; endpoint `isetadminserver.js:34006` to `isetadminserver.js:34010`; UI `ActionPlanDetailsModal.jsx:692`; source `...extracted.md:405` |
| AP-05 | At least one intervention per action plan | Implemented | Match | `isetadminserver.js:5566` to `isetadminserver.js:5577`; source `...extracted.md:467` |
| AP-06 | One active action plan at a time | Implemented in validation and activation endpoint | Match | `isetadminserver.js:5475` to `isetadminserver.js:5487`; `isetadminserver.js:33852` to `isetadminserver.js:33864`; source `...extracted.md:349` |
| AP-07 | Do not change action plan start date after upload (identity key stability) | No immutability guard after submission detected | Gap | source `...extracted.md:351`; updates currently allowed via patch path `isetadminserver.js:34453` to `isetadminserver.js:34455` |
| IV-01 | Intervention start date >= 2000, >= plan start, <= end | Implemented backend + UI | Match | backend `isetadminserver.js:5914` to `isetadminserver.js:6019`; UI `InterventionModal.jsx:818` to `InterventionModal.jsx:838`; source `...extracted.md:468` |
| IV-02 | Intervention end date <= action plan result date | Implemented backend | Match | `isetadminserver.js:6021` to `isetadminserver.js:6033`; source `...extracted.md:476` |
| IV-03 | When action plan result date provided, intervention outcome required | Partially implemented (current backend requires outcome only when end date exists) | Partial gap | backend `isetadminserver.js:6125` to `isetadminserver.js:6137`; source `...extracted.md:491` |
| IV-04 | Intervention code 6-13 requires intervention related NOC and valid NOC | Implemented requirement for NOC + version + digit length, but not strict validity against official NOC list | Partial gap | backend `isetadminserver.js:6139` to `isetadminserver.js:6189`; UI `InterventionModal.jsx:805` to `InterventionModal.jsx:816`; source `...extracted.md:509` |
| IV-05 | NOC validity (real code list, not only length) | Not fully enforced server-side | Gap | backend checks length/pattern only `isetadminserver.js:6155` to `isetadminserver.js:6165`; source `...extracted.md:509` |
| SUB-01 | Upload strategy may be full set or changed records | Current dashboard queue is "action-needed" subset, not explicit full/history set builder | Decision gap (product policy vs ESDC optionality) | source `...extracted.md:23`; queue SQL `isetadminserver.js:16380` to `isetadminserver.js:16448` |

## Non-ESDC (or not-explicitly-sourced) rules currently enforced
These can be valid business decisions, but they are stricter than the extracted 2023 rule text and can create avoidable blockers.
- Intervention end date must be within 60 months of start.  
  `isetadminserver.js:6034` to `isetadminserver.js:6048`; UI `InterventionModal.jsx:841` to `InterventionModal.jsx:847`
- Intervention duration/cost required for end-date or close-out scenarios.  
  `isetadminserver.js:6057` to `isetadminserver.js:6095`
- End date requires status completed/cancelled.  
  `isetadminserver.js:5981` to `isetadminserver.js:5994`
- Warning heuristics affect readiness (`needs_review`), e.g., long plan/intervention gaps or estimated costs.  
  `isetadminserver.js:5606` to `isetadminserver.js:5619`, `isetadminserver.js:5870` to `isetadminserver.js:5882`, `isetadminserver.js:6110` to `isetadminserver.js:6122`

## Cross-layer inconsistencies (backend vs UI vs docs)
1. Employed result NOC requirement mismatch:
- Backend enforces NOC for result code 2 and 3.  
  `isetadminserver.js:5815`
- UI enforces only for result code 2.  
  `src/pages/Caseworking/caseWorkspace/modals/ActionPlanDetailsModal.jsx:693`

2. NOC version set mismatch:
- Backend validation accepts 2006/2011/2016/2021 in some flows.  
  `isetadminserver.js:5142`
- Action plan close endpoint accepts 2016/2021 only.  
  `isetadminserver.js:33921`
- Case workspace UI exposes 2016/2021 only.  
  `src/pages/Caseworking/caseWorkspace/modals/ActionPlanDetailsModal.jsx:143`

3. Agreement number payload behavior mismatch risk:
- UI validates entered agreement number, but payload build derives from funding stream constant values.  
  `src/pages/Caseworking/caseWorkspace/modals/ActionPlanDetailsModal.jsx:628` and `src/pages/Caseworking/caseWorkspace/modals/ActionPlanDetailsModal.jsx:709`

4. Dashboard documentation is stale versus implemented queue conditions:
- Doc says queue is active + non-closed intervention and pending/rejected only.  
  `docs/dashboards/government-submissions-dashboard.md:13`
- Code includes closed/final-plan cases and some submitted rows for final resubmission lifecycle.  
  `isetadminserver.js:16399` to `isetadminserver.js:16448`

## High-priority refactor backlog
1. Align canonical ruleset and source-of-truth
- Decide authoritative rule profile from ESDC for each field (strictly extracted 2023 vs legacy Data Exchange Guide overlays).
- Encode one shared rule catalog consumed by backend and case workspace UI.

2. Fix clear compliance gaps
- Add first/last-name numeric-only validation.
- Enforce intervention outcome when action plan result date is set (not only when intervention end date exists).
- Add strict NOC-code validity checks against approved NOC dataset/version.
- Add immutability guard for submission identity keys after first successful submission (SIN + agreement number + action plan start date).

3. Remove cross-layer drift
- Reconcile result-code NOC rules (backend vs UI).
- Reconcile NOC version allow-lists across validation, close endpoint, and UI pickers.
- Correct agreement number payload behavior in action plan modal.

4. Queue model/documentation hardening
- Explicitly document queue model as product policy (not ESDC-mandated trigger language).
- Update dashboard docs to match current SQL filter logic.

5. Add targeted automated tests
- Backend: rule-by-rule validation tests (especially chronology, conditional requirements, NOC checks, readiness states).
- API: queue selection tests for active/final/submission-status scenarios.
- UI: modal validation parity tests against backend rule catalog.

## Practical answer to "what triggers queue entry"
Current implementation queues participants when an action plan becomes reportable by SQL conditions (active+started intervention OR closed/ready with final result and terminal interventions) and submission status indicates action needed.  
See `isetadminserver.js:16380` to `isetadminserver.js:16448`.

There is not a direct ESDC statement defining this exact queue trigger model; ESDC sources define data/reporting rules, while queue lifecycle is internal product logic.
