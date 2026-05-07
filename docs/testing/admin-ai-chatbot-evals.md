# Admin AI Chatbot Evals

Status: current eval scaffold
Last updated: 2026-05-07

## Purpose

This file defines the evaluation discipline for the admin `Ask the AI` knowledge-base overhaul.

The goal is not to grade the model's prose. The goal is to catch ungrounded workflow claims, missing PATH labels, unsafe policy shortcuts, and generic answers that sound plausible but do not match the system.

## Fixture File

Initial fixtures live in:

- `docs/testing/admin-ai-chatbot-eval-fixtures.json`

Run:

```bash
npm run ai:eval:check
```

The check is intentionally lightweight. It validates fixture shape, uniqueness, and required anchor/forbidden-pattern fields. It does not call OpenRouter.

## Fixture Fields

| Field | Meaning |
| --- | --- |
| `id` | Stable unique fixture id. |
| `domain` | Coverage-register domain. |
| `route` | Route context to send with the prompt where applicable. |
| `helpTitle` | Help-panel title/context. |
| `role` | Staff role context. |
| `prompt` | User prompt. |
| `expectedAnchors` | Strings or concepts the answer should include. |
| `forbiddenPatterns` | Strings or concepts that indicate hallucination, unsafe advice, or outdated workflow. |
| `sourceRefs` | Code/docs/training sources to verify against before promoting the eval. |
| `status` | `drafted`, `verified`, `passing`, `failing`, or `retired`. |

## Rules

- Every high-risk workflow card should have at least one eval fixture.
- A fixture should fail for generic SaaS answers even when the answer sounds reasonable.
- Forbidden patterns should capture tempting wrong answers, not just exact previous hallucinations.
- Policy/process fixtures should distinguish training expectations from PATH UI labels.
- Do not mark an eval `verified` until source refs have been checked against current code/docs or live behavior.
- A failing eval should create either a knowledge-card task or a retrieval/prompt bug.

## Initial Domains

The seed fixture set intentionally spans the system:

- Case Management
- Home / Work Queues
- Imports / Backload
- Application Assessment
- Training / Financial Need
- Supporting Documents
- Secure Messaging / Contact
- Case Notes
- ESDC / ILMP
- Finance / Payments
- Notifications
- Workflow Studio / Manual Intake
- Public Portal Relationship

## Work Log

- 2026-05-07: Created initial fixture scaffold and lint check for broad chatbot coverage. Fixtures are `drafted` until each source-ref set is verified and a future eval runner can compare real model output against anchors/forbidden patterns.
- 2026-05-07: Promoted `case-intervention-approval-letters` to `verified` after checking the Case Workspace intervention row action, approval follow-up communication step, generated letter tabs, send action, and widget docs.
- 2026-05-07: Promoted `home-pending-completion-purpose` to `verified` after checking homepage queue composition/routing, Work Queue Items behavior, intervention completion item API usage, and dashboard/help docs.
- 2026-05-07: Promoted `application-missing-documents-next-step` to `verified` after checking application-workspace help, Supporting Documents checklist behavior, Secure Messaging missing-information guidance, Case Notes follow-up guidance, and training-documentation expectations.
- 2026-05-07: Promoted `application-request-changes` to `verified` after checking the Application Approval decision controls, required Request Changes note validation, server-side Case Notes write, and widget docs.
