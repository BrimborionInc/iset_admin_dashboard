# Denial Letter Drafting & Prompt Refactor (Draft)
Status: Implemented (pending review)  
Owners: Casework / Admin Dashboard  
Last updated: 2026-01-11

## Purpose
Refine the denial-letter drafting flow so it captures a single program-level denial reason + short explanation, then uses a structured AI prompt to generate a trauma-informed, compliant denial letter.

## Audience
Product, casework operations, and engineering.

## Scope / Guardrails
- Applies to denial letters only (approval flow unchanged).
- Modal reason selection + short explanation is transient and not persisted to the DB.
- Letter output must stay compatible with the existing denial-letter workflow template and token fields.
- Use Cloudscape genAI ingress guidance for AI actions (sparkle icon, avoid multiple primary buttons).

## Data / DB Findings (runtime mapping)
- Decision letters are rendered via workflow templates (`workflow.document_type = assessment_approval_letter|assessment_denial_letter`).
- Both approval and denial use workflow step `step_id = 143`, with a single paragraph template (`component_template.id = 29`).
- Template HTML uses tokens: `decision_date`, `applicant_name`, `applicant_full_name`, `applicant_salutation_name`, `tracking_id`, `letter_title`, `decision_intro`, `decision_reason`, `next_step_1`, `next_step_2`, `coordinator_name`, `organization_name`. Existing templates still use `applicant_name`, which is populated with the resolved salutation name so greetings render as `Dear Claire` instead of `Dear Applicant` when participant data is available.
- `show_next_steps` is only enabled for approvals; denial letters render `decision_intro` and `decision_reason` only.

## Requirements (from stakeholders)
- Denial letters must include: clear outcome, authority reference, high-level denial reason + brief explanation, a non-judgment statement, options going forward, effective date (today), and a single contact path.
- Must not include: detailed evidence weighing, subjective language, financial amounts, legal findings, or contradictions with case records.
- Denial reason selection uses a single radio choice with required short explanation (100-word guidance).
- Modal reason + explanation are used only to construct the AI prompt and are not stored.

## Design Decisions
- Add a denial-reason modal that always appears when generating a denial draft.
- Use radio choices for program-level reasons; show a required text area when a reason is selected.
- Use a word counter with a 100-word guidance cap (no hard blocking).
- Use the existing "Reason for Not Approving" field as the placeholder for the modal explanation.
- Build the AI prompt to place required denial elements across `decision_intro` + `decision_reason` (since next steps are not rendered for denial letters).
- Keep the current letter template unchanged; adjust prompt content to meet requirements.

## Open Questions
- None.

## Planning Phase
1. Add transient modal state + UI to the CoordinatorAssessmentWidget for denial draft generation.
2. Extend denial AI prompt/context with: selected reason label, explanation, authority statement, non-judgment statement, options forward, effective date (today), and strict "must not include" rules.
3. Update the decision-date seed for denial drafts to today when drafting.
4. Update changelog and record implementation notes.

## Implementation Phase
- Added denial-reason modal with single radio choice and required explanation, including 100-word guidance and the existing "Reason for Not Approving" placeholder.
- Updated denial AI prompt/context with authority language, reason label + explanation, non-judgment statement, options going forward, and effective date set to today.
- Refactored decision letter editing into a single letter body textarea that parses back into draft fields for approvals and denials.
