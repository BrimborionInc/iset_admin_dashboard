# Admin AI Guidance

Purpose: move PATH workflow grounding for the embedded admin help chat out of brittle page-local `aiContext` strings and into dedicated database-backed guidance records.

Last updated: 2026-07-30

## Transformation plan

The current long-running plan is `docs/planning/admin-ai-chatbot-knowledge-base-transformation.md`.
The active coverage register is `docs/planning/admin-ai-chatbot-coverage-register.md`.
The initial eval scaffold is `docs/testing/admin-ai-chatbot-evals.md`.

Use those planning docs for cross-thread scope, source-of-truth rules, knowledge-card shape, coverage status, retrieval/eval requirements, and rollout sequencing. This feature doc describes the current implementation state.

## Current design

- The embedded help chat still keeps a small system-prompt layer for answer style and safety.
- The admin AI proxy is for workflow guidance and template-style copy help, not for processing live applicant records.
- When the help chat calls `POST /api/ai/chat`, it now sends a `chatContext` object containing:
  - `surface`
  - `pathname`
  - `helpTitle`
  - `aiContext`
  - `role`
- The server uses that metadata plus the latest user question to retrieve matching guidance rows and prepend a grounded system message before calling the model.
- If no guidance card matches a help-panel question, the server now prepends a no-match guardrail prompt. The model may answer from explicit current help context, but for workflow-specific questions it must say verified PATH guidance is not available yet instead of inventing controls, queues, templates, side effects, or permission rules.
- When `ADMIN_AI_GUIDANCE_DEBUG=true`, System Administrator callers receive a `_guidance` debug object with prompt-injected, match/no-match status, matched guidance slugs, scores, source refs, expected anchors, forbidden phrases, and matched example slugs. Ordinary users do not receive this metadata.
- Before calling OpenRouter, the server blocks obvious raw identifiers and secrets in the submitted messages and chat context, including SIN-style values, PATH reference numbers, email/phone values, credentials, and JSON fields such as `applicant_name`, `tracking_id`, or `case_number` with live values.
- Denial-letter drafts use the local decision-letter template path. They do not send applicant denial context to OpenRouter.
- Application approval-letter drafting has one optional OpenRouter copy-editing call. It sends only generic opening/closing templates and three non-personal mode flags; applicant, case, program, institution, funding, payee, date, and staff details are merged locally after that call. The former unreachable full-record decision-letter payload has been removed, and source-level privacy checks require that only this narrow approval call remains.
- AI-backed dummy-data generators are local-dev/demo utilities only and require `ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES=true` plus System Administrator access.

## Guidance Library relationship

The admin Guidance Library at `/documentation` is a staff-facing source for NWAC training, policy, and process context. Its current runtime content comes from:

- `src/pages/documentation/DocumentationLibrary.jsx`
- `src/documentation/documentationLinks.js`
- `src/documentation/runtime/trainingModules2025.json`
- `docs/training/TRAINING_MODULES_September_2025_extracted.md`

For chatbot work, treat this corpus as source material for curated policy/process guidance cards. Do not use it as proof of current PATH UI behavior without checking the implementation.

## Current coverage limit

The existing guidance seed is narrow. The no-match guard reduces hallucinations, but it also means many workflow-specific questions will get a safe "not verified yet" answer until their workflow cards and evals are added. This is intentional during the whole-system knowledge-base buildout.

## Tables

- `admin_ai_guidance_entry`
  - one row per guidance rule or workflow instruction
  - stores route patterns, help titles, roles, workflow states, topic tags, keywords, source anchors, expected answer anchors, forbidden answer patterns, applicability, step/side-effect/restriction text, review metadata, and guidance text
- `admin_ai_guidance_example`
  - approved example Q&A pairs tied to a guidance slug
  - stores route/role context, must-mention and must-not-mention anchors, source refs, eval fixture ID, and coverage status
  - used to steer answer level and phrasing

The server still creates these tables lazily when guidance retrieval first runs. Migration `sql/migrations/20260507_0001_harden_admin_ai_guidance_schema.sql` records the current richer schema for managed environment promotion.

## Seeded scope

The first seeded guidance slice is intentionally narrow:

- application approval `Request Changes` review
- application assessment missing-document follow-up
- homepage `Pending Completion` queue purpose and routing
- approved new/revised intervention approval-letter follow-up
- imported/application-less backload overview
- existing-intervention lifecycle guardrails
- historical finance handling for `manual_backload` interventions
- annual Financial Reports / `ISET Advances and Active Clients` report purpose, funded-interventions default, export scope, PATH payment-follow-up caveat, and explicit Financial Reports vs Data and Results comparison prompts
- ILMP participant XML export flow from `/esdc/participants`, including `Validate all`, `Generate batch XML`, mark-exported wording, and the manual external ESDC upload boundary
- Recent ILMP exports history, including Summary/Clients exported/XML tab purpose, stored XML snapshot semantics, and Requeue behavior

This limited seed exists to tune answer quality before expanding coverage across the full admin dashboard.

## Current source of truth

The seeded rows were derived from existing curated guidance in:

- `src/helpPanelContents/caseWorkspaceHelp.js`
- `src/helpPanelContents/caseWorkspaceInterventionsHelp.js`
- `src/helpPanelContents/homeWorkQueueHelp.js`
- `src/helpPanelContents/homeWorkQueueItemsHelp.js`
- `src/helpPanelContents/applicationCaseDashboardHelp.js`
- `src/helpPanelContents/applicationAssessmentHelp.js`
- `src/helpPanelContents/supportingDocumentsHelp.js`
- `src/helpPanelContents/secureMessagesHelpPanelContent.js`
- `src/helpPanelContents/caseNotesHelp.js`
- `src/widgets/CoordinatorAssessmentWidget.js`
- `isetadminserver.js`
- `src/pages/home/HomeDashboardPage.jsx`
- `src/pages/home/widgets/WorkQueueItemsTableWidget.js`
- `docs/dashboards/admin-home-my-work-widget.md`
- `src/pages/Caseworking/caseWorkspace/widgets/InterventionsWidget.jsx`
- `src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx`
- `src/utils/interventionStatus.js`
- `docs/widgets/admin/interventions-widget.md`
- `docs/widgets/admin/intervention-assessment-widget.md`
- `docs/guides/client-file-imports.md`
- `src/helpPanelContents/esdcParticipantsHelp.js`
- `src/helpPanelContents/esdcParticipantQueueHelp.js`
- `src/helpPanelContents/esdcParticipantHistoryHelp.js`
- `docs/widgets/admin/esdc-participant-submission-queue-widget.md`
- `docs/widgets/admin/esdc-participant-submission-history-widget.md`
- `docs/workflows/admin/ilmp-reporting.md`

## Expansion plan

- Add more workflow and policy/process guidance rows by area.
- Add approved Q&A examples and eval prompts for high-risk workflows.
- Tune strict no-grounding/no-answer behavior as eval coverage grows.
- Add admin editing/versioning once the retrieval shape is validated.
- Reduce reliance on large frontend `aiContext` strings as DB-backed coverage expands.
