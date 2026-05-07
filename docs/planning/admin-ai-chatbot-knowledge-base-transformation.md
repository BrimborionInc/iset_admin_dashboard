# Admin AI Chatbot Knowledge Base Transformation

Status: current plan
Last updated: 2026-05-07

## Purpose

Transform the embedded admin `Ask the AI` chat from a lightly prompted general model into a PATH workflow assistant grounded in curated operational knowledge across the whole system.

The assistant's primary job is to guide staff in how to use PATH. It should also answer NWAC policy and process questions that are represented in the admin Guidance Library at `/documentation`, while clearly separating training/policy guidance from current system behavior.

This is a systematic knowledge-base overhaul, not a series of one-off fixes for individual bad answers. Individual hallucinations are useful as regression examples, but they must feed a coverage model, source inventory, retrieval design, and evaluation suite for the whole admin console.

The active coverage register is `docs/planning/admin-ai-chatbot-coverage-register.md`. Use it as the execution map for routes, domains, source refs, card status, and eval backlog.

## Starting Problem

The current chatbot can produce plausible but false workflow guidance when the current help-panel context and the database-backed guidance layer do not contain the exact PATH workflow facts.

Example observed on 2026-05-07:

- User asked: `How do i prepare approval letters for approved new interventions?`
- The bot answered with generic, invented controls such as `Interventions or Approvals area`, `Generate Approval Letter`, `equivalent letter/print action`, and template-selection guidance.
- Correct PATH shape: Case Workspace -> Interventions widget -> row action `Prepare approval letters` -> intervention approval follow-up `Approval letters` step -> `Generate drafts` -> edit/review Client letter and supporting letter tabs -> `Send client approval letter`; institution/loan-provider/other-funder letters are reviewed/downloaded for manual handling.

Root cause found in code/docs at the start of the transformation:

- `src/helpPanelContents/caseWorkspaceInterventionsHelp.js` initially did not include approval-letter follow-up guidance.
- `src/server/adminAiGuidanceService.js` seeds only a narrow initial guidance set for imported/application-less backload workflows.
- `src/AppContent.js` asks the model not to invent behavior, but retrieval initially had no strict no-grounding/no-answer enforcement when no relevant PATH guidance matched.

The first implementation pass now adds a server-side no-match guard. The content gap still remains: most workflows need verified guidance cards and eval coverage before the bot can answer them directly.

Do not treat this example as the transformation boundary. The same failure mode can occur anywhere the bot lacks curated PATH knowledge.

## Scope

In scope:

- Admin console `Ask the AI` help-panel chat across all staff-facing routes, dashboards, widgets, and workflows.
- A system-wide knowledge inventory that maps every significant PATH surface to workflow guidance, policy/process guidance, source refs, gaps, and eval coverage.
- PATH workflow usage guidance: where to go, which widget/action/button to use, what state or role is required, what happens next, and what not to do.
- NWAC training/policy/process guidance from the Guidance Library source corpus:
  - `docs/training/TRAINING_MODULES_September_2025_extracted.md`
  - `src/documentation/runtime/trainingModules2025.json`
  - `src/documentation/documentationLinks.js`
  - `/documentation` (`src/pages/documentation/DocumentationLibrary.jsx`)
- Knowledge-base authoring, retrieval, answer shaping, evals, and release/maintenance process.

Out of scope unless explicitly approved:

- Sending raw applicant/client identifiers or live case facts to OpenRouter.
- Case-specific eligibility decisions based on live applicant data.
- Replacing formal NWAC training, policy approval, or legal/compliance review.
- A generic semantic search over the entire docs tree with no curation or source ranking.

## Source Of Truth Layers

Use these layers in this order when building guidance. The chatbot should preserve the distinction in its answers.

1. **Current implementation truth**
   - Code, API payloads, schema, runtime config, tests, and live-environment evidence when needed.
   - Use for exact UI labels, route behavior, role/status gates, side effects, and current workflow state.

2. **Current admin workflow/help docs**
   - `src/helpPanelContents/*`
   - `docs/widgets/admin/*`
   - `docs/dashboards/*`
   - `docs/features/*`
   - `docs/guides/*`
   - Use for staff-facing wording and canonical operating guidance after verifying important claims against code.

3. **NWAC training and process source corpus**
   - `docs/training/TRAINING_MODULES_September_2025_extracted.md`
   - `src/documentation/runtime/trainingModules2025.json`
   - `/documentation` Guidance Library content.
   - Use for process expectations, documentation standards, compliance reminders, case-management cadence, and policy context.
   - Do not treat training artifacts as proof of current PATH UI behavior.

4. **Historical planning/change docs**
   - Useful for intent and provenance.
   - Never sufficient as the only source for chatbot guidance.

## Target Behavior

The bot should act like a PATH job aid:

- Lead with the direct answer when the workflow is known.
- Name exact PATH surfaces and controls.
- Keep answers operational: immediate next action, where in PATH to do it, what to document, and timing/compliance reminders when relevant.
- Use training/policy context to explain why a process matters, but do not invent UI steps from policy text.
- Refuse or narrow the answer when the knowledge base has no strong grounding for a workflow-specific question.
- Ask a clarifying question only when the missing fact is genuinely needed and cannot be inferred from route/help/role context.

No-grounding rule:

- If no strong workflow or policy/process match is found, the assistant should not improvise. It should say it does not have the exact PATH steps from the current guidance and suggest where the user can look or what context would allow a safer answer.

Sensitive-data rule:

- Preserve the existing admin AI privacy rule: do not send raw applicant/client identifiers, PATH references, case numbers, tracking IDs, names, emails, SINs, phone numbers, credentials, or live-record JSON fields to OpenRouter.

## Knowledge Unit Model

Treat the knowledge base as curated workflow/process cards, not as raw document chunks.

Each card must belong to a coverage register. The register should make it clear which page, widget, workflow, role, queue, or policy area is covered, partially covered, or still missing.

### Workflow Guidance Card

Use for how-to-use-PATH answers.

Required fields:

- `slug`
- `title`
- `surface`
- `sourceType`
- `coverageDomain`
- `coverageStatus`
- `routePatterns`
- `helpTitles`
- `roles`
- `workflowStates`
- `topicTags`
- `keywords`
- `sourceRefs`
- `expectedAnchors`
- `applicability`
- `steps`
- `sideEffects`
- `restrictions`
- `doNotSay`
- `guidanceText`
- `lastReviewedAt`

Recommended content rules:

- Include exact UI labels such as `Prepare approval letters`, `Generate drafts`, and `Send client approval letter`.
- Include disambiguation when one user phrase maps to multiple workflows.
- Include negative guardrails for tempting false answers.
- Keep one card focused on one workflow question or closely related workflow cluster.

### Policy / Process Guidance Card

Use for NWAC policy, compliance, and training expectations.

Required fields:

- `slug`
- `title`
- `trainingSource`
- `module`
- `section`
- `topicTags`
- `keywords`
- `policyExpectation`
- `staffAction`
- `documentationStandard`
- `PATHWhereToRecord`
- `caveats`
- `sourceRefs`

Recommended content rules:

- Translate training material into job-aid language.
- Avoid long copied passages.
- Distinguish `NWAC process expectation` from `PATH control label`.

### Approved Q&A Example

Use to steer answer phrasing and evaluation.

Fields:

- `guidanceSlug`
- `questionText`
- `answerText`
- `mustMention`
- `mustNotMention`
- `roleContext`
- `routeContext`
- `sourceRefs`
- `evalFixtureId`
- `coverageStatus`

## Retrieval Requirements

Retrieval should combine:

- current route/pathname
- help-panel title
- widget/page `aiContext`
- current staff role
- user question
- current workflow state when available
- tags/keywords
- approved examples

A future retrieval pass may add embeddings or OpenRouter-assisted classification, but the first quality bar is precision, not breadth.

Minimum scoring rules:

- Workflow-specific questions need a strong matching workflow card before the bot gives exact steps.
- Policy/process questions may match training cards without a route match, but the answer must avoid inventing UI controls unless a workflow card also matches.
- If a candidate card contains `doNotSay` patterns and the draft answer includes them, the answer should be regenerated or blocked.

## Coverage Methodology

The overhaul starts with a full inventory before broad content writing.

Build and maintain a coverage register with at least:

- route/path
- page/dashboard
- widget or workflow surface
- primary roles
- common user intents/questions
- current help-panel source
- implementation source refs
- training/policy source refs when applicable
- guidance-card status: missing, drafted, verified, approved, deployed
- eval status: missing, drafted, passing, failing
- known risks or forbidden generic answers

Initial inventory sources:

- `src/routes/AppRoutes.js`
- `src/helpPanelContents/*`
- `docs/widgets/admin/*`
- `docs/dashboards/*`
- `docs/features/*`
- `docs/workflows/admin/*`
- `src/documentation/documentationLinks.js`
- `src/documentation/runtime/trainingModules2025.json`
- `docs/training/TRAINING_MODULES_September_2025_extracted.md`

Coverage should be prioritized by staff risk and usage, but the plan remains whole-system. A high-priority tranche is an execution order, not a narrowing of scope.

The current register lives at `docs/planning/admin-ai-chatbot-coverage-register.md`.
Use `npm run ai:inventory` to regenerate the raw route/help/training inventory before broad coverage updates.
The current eval scaffold lives at `docs/testing/admin-ai-chatbot-evals.md` and `docs/testing/admin-ai-chatbot-eval-fixtures.json`.

## Evaluation Suite

Create a small eval suite before broad content expansion. Each eval should specify route/help/role context, prompt, required answer anchors, and forbidden phrases.

Initial high-priority evals:

| Prompt | Required anchors | Forbidden answer patterns |
| --- | --- | --- |
| How do I prepare approval letters for approved new interventions? | `Case Workspace`, `Interventions`, `Prepare approval letters`, `Approval letters`, `Generate drafts`, `Send client approval letter` | `Approvals area`, `equivalent action`, `record toolbar`, `select template` |
| What is Pending Completion for? | application post-decision follow-through, approval letters, funding forms/signatures, approved intervention proposal/revision approval-letter follow-up | generic completed/closed queue only |
| Can I backload an active intervention? | active plan required, archived plans blocked, closed plans only completed/cancelled, historical workflow | live payment packet from backload |
| What documentation is needed before recommending a living allowance? | financial situation evidence required, income/expense documentation, record rationale in PATH | approve first and collect later |
| Where do I record missing-document follow-up? | Supporting Documents or assessment context plus Case Notes/Secure Messaging, document attempts | email-only with no PATH record |

Acceptance gate:

- The bot passes all high-priority evals before any TEST/PROD rollout that claims chatbot quality improvement.
- A failing eval should create either a knowledge-card task or a retrieval/prompt bug, not a one-off prompt tweak.

## Implementation Phases

### Phase 0 - Baseline And Instrumentation

- Create the whole-system coverage register from routes, help panels, widget docs, dashboard docs, workflow docs, and `/documentation` training sources.
- Add DEV/System Administrator diagnostics for matched guidance slugs, scores, and no-match outcomes.
- Capture representative bad answers and prompts as eval fixtures.
- Confirm model/runtime settings and fallback behavior through `/api/ai/status`.

### Phase 1 - Knowledge Model Hardening

- Decide where the coverage register lives and how it relates to deployed guidance rows.
- Extend the existing lazy-created `admin_ai_guidance_entry` / `admin_ai_guidance_example` tables with versioned migration coverage unless the content volume later requires a separate authoring/versioning model.
- Add fields needed for workflow state, `doNotSay`, source type, and policy/process cards.
- Move seed data out of ad hoc server constants if the content volume grows beyond a small bootstrap seed.

### Phase 2 - System Inventory And Content Roadmap

- Complete enough inventory to classify all major admin surfaces as covered, partially covered, or missing.
- Identify content domains, dependencies, and shared concepts that should become reusable cards instead of duplicated page-local prose.
- Define approval/review workflow for knowledge cards.
- Pick the first implementation tranche from the coverage register.

### Phase 3 - First Workflow Content Tranche

Prioritize workflows with high user risk or recent observed failures:

- approved new/revised intervention approval-letter follow-up
- application approval letters and funding forms/signatures
- Pending Decision and Pending Completion queues
- supporting-document checklist and missing-document follow-up
- Secure Messaging compose/reply and attachment expectations
- Case Notes documentation expectations
- application assessment decision workflow
- case workspace intervention proposal/revision lifecycle
- imported/application-less backloads
- living allowance evidence and financial documentation

Each content slice should include at least one approved Q&A eval.

### Phase 4 - Training / Policy Knowledge Tranche

- Convert the `/documentation` training corpus into curated policy/process cards.
- Preserve source refs to training module/section IDs.
- Add process guidance for eligibility documentation, Indigenous identity documentation, financial need evidence, childcare, living allowance, intervention follow-up, closure, and audit-ready file standards.
- Link policy/process cards to PATH workflow cards where the system records the action.

### Phase 5 - Strict Answer Policy

- Maintain and tune the no-grounding/no-answer behavior now injected by `src/server/adminAiGuidanceService.js` when no help-panel guidance card matches.
- Add draft-answer guardrails for forbidden generic workflow patterns.
- Tune the system prompt so model creativity is limited to wording, not workflow facts.

### Phase 6 - Admin Maintenance UX

- Provide a System Administrator/NWAC Administrator way to inspect, edit, activate/deactivate, and test guidance cards.
- Include source refs, last reviewed date, and eval status.
- Do not let broad staff edit live guidance until approval/versioning rules exist.

### Phase 7 - Rollout And Monitoring

- TEST with representative staff prompts before PROD.
- Monitor no-match rates, sensitive-content blocks, model failures, and user feedback.
- Treat bad chatbot answers as knowledge/retrieval defects with reproducible prompts.

## Cross-Thread Runbook

At the start of every task thread in this transformation:

1. Read `docs/AGENTS.md`.
2. Read this plan.
3. Read `docs/planning/admin-ai-chatbot-coverage-register.md`.
4. Read `docs/features/admin-ai-guidance.md`.
5. Inspect the current code for the workflow being changed.
6. If the task touches policy/process guidance, inspect the relevant `/documentation` source in `docs/training/TRAINING_MODULES_September_2025_extracted.md` and/or `src/documentation/runtime/trainingModules2025.json`.
7. For broad coverage work, run `npm run ai:inventory -- --format=summary` or `npm run ai:inventory -- --format=markdown` to refresh the raw inventory.
8. For eval fixture work, run `npm run ai:eval:check`.

During each task:

- Keep the slice small enough to verify.
- Tie every slice back to the whole-system coverage register.
- Add or update eval prompts for every workflow card added.
- Update help-panel `aiContext` when page-local context is misleading or incomplete.
- Avoid adding unverified UI labels from training docs.
- Preserve the admin AI privacy gates.
- Do not target isolated chatbot flaws without recording what coverage gap or retrieval defect they represent.

Before handoff:

- Run targeted tests or static checks for touched code.
- Run `git diff --check`.
- Update this plan's work log if the task materially advances the transformation.
- Update `docs/features/admin-ai-guidance.md` when behavior changes.
- Update `docs/meta/changelog.md` and `docs/meta/next-release-notes-log.md` only for user-visible or operational behavior changes.
- Update `docs/meta/codex-thread-index.md` only if the exact Codex Task History title is known.

## Work Log

- 2026-05-07: Created the transformation plan after an observed hallucinated answer about approved new-intervention approval letters. Confirmed the current code already has an OpenRouter proxy, a narrow DB-backed guidance seed, page-local `aiContext`, and the `/documentation` Guidance Library backed by extracted NWAC training modules. Added entry-point pointers in `docs/AGENTS.md`, `docs/features/admin-ai-guidance.md`, and `docs/planning/README.md`.
- 2026-05-07: Clarified that the transformation is a whole-system knowledge-base overhaul. Individual bad answers are regression examples only; future work should start from a coverage register and system inventory, not isolated flaw chasing.
- 2026-05-07: Added `docs/planning/admin-ai-chatbot-coverage-register.md` as the initial whole-system inventory and eval backlog. Most surfaces are intentionally `inventory-only` until verified guidance cards and eval coverage exist.
- 2026-05-07: Added `scripts/admin-ai-inventory.js` and npm script `ai:inventory` as a read-only helper for regenerating route, help-panel, training-section, and docs-group inventory.
- 2026-05-07: Added `docs/testing/admin-ai-chatbot-evals.md`, `docs/testing/admin-ai-chatbot-eval-fixtures.json`, `scripts/admin-ai-eval-fixtures-check.js`, and npm script `ai:eval:check` as the initial eval scaffold. The first fixture set spans major domains and remains `drafted` until source verification and real-output checking exist.
- 2026-05-07: Added admin AI guidance diagnostics behind `ADMIN_AI_GUIDANCE_DEBUG=true` for System Administrators. The chat response can now include `_guidance` match/no-match metadata without exposing it to ordinary users.
- 2026-05-07: Hardened the guidance-card data model with richer entry/example metadata plus migration coverage, and added a no-match guardrail prompt so unmatched workflow-specific help questions do not get generic invented PATH steps.
- 2026-05-07: Added the first verified workflow card and approved example for approved new/revised intervention approval-letter follow-up. Updated `caseWorkspaceInterventionsHelp.js` so the visible help panel and page `aiContext` match the seeded card.
- 2026-05-07: Added a verified workflow card and approved example for homepage Pending Completion purpose/routing. Updated `homeWorkQueueItemsHelp.js` so the help panel explicitly covers approved intervention proposal/revision letter follow-up rows as well as application post-decision rows.
- 2026-05-07: Added a verified workflow card and approved example for missing required documents during Application Assessment. Updated `supportingDocumentsHelp.js` to make the checklist -> Secure Messaging -> Notes/Case Notes follow-up path visible in the help panel.
- 2026-05-07: Added a verified workflow card and approved example for Application Approval `Request Changes`. Updated `applicationAssessmentHelp.js` so the help panel distinguishes Request Changes from final approval/denial communication.
