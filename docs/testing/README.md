# Testing Docs

Status: UAT prompts/checklists and testing reference material.

These docs support manual/UAT validation. They do not replace automated tests, route smokes, database smokes, or live environment checks required by `docs/AGENTS.md`.

When touching testing docs, include the environment, date, and scope the checklist applies to.

## Admin AI Chatbot

- `admin-ai-chatbot-evals.md`: eval discipline and fixture format for the admin `Ask the AI` knowledge-base overhaul.
- `admin-ai-chatbot-eval-fixtures.json`: drafted fixture set for high-risk chatbot prompts.
- Run `npm run ai:eval:check` after fixture edits.
