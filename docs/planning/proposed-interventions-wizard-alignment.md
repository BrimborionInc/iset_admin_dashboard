Purpose: Track design, planning, and implementation for aligning the Case Workspace Proposed Interventions wizard with the Coordinator Assessment wizard.
Audience: Admin dashboard engineers, product owners, and workflow owners.
Last Updated: 2025-03-10

# Proposed Interventions Wizard Alignment

## Phase Status
- Design: In progress
- Planning: Not started
- Implementation: Not started

## Decision Log
- 2025-03-10: Proposed Interventions wizard should mirror Coordinator Assessment wizard behavior end-to-end.
- 2025-03-10: Step 1 will be a multi-intervention list with add/edit/delete (Coordinator Assessment style).
- 2025-03-10: Steps 2-6 should iterate over each intervention (Coordinator Assessment style).
- 2025-03-10: Saving progress should create multiple draft interventions, visible as multiple draft rows in the Interventions table.

## Open Questions
- Should Supporting Documents in Proposed Interventions switch to the application-level checklist (Coordinator Assessment behavior), or remain intervention-scoped?

## Scope (Phase 1)
- Replace Proposed Interventions step 1 with a multi-intervention table matching Coordinator Assessment.
- Update steps 2-6 to operate across multiple interventions (rationale, type, cost, docs, review).
- Align step titles and validation flow with Coordinator Assessment.

## Future Scope
- Update "What does it cost?" (step 4) to mirror the Application Workspace equivalent step (per user note).

## References
- src/widgets/CoordinatorAssessmentWidget.js
- src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx
