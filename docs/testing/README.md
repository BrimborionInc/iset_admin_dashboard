# Testing Docs

Status: UAT prompts/checklists and testing reference material.

Last Updated: 2026-07-13

These docs support manual/UAT validation. They do not replace automated tests, route smokes, database smokes, or live environment checks required by `docs/AGENTS.md`.

Release qualification is controlled by `../ops/deployments/release-qualification-runbook.md` and the machine-readable `release-coverage-inventory.json`. The inventory maps changed code, shared dependencies, and declared data/config operations to mandatory DEV and TEST evidence; unknown or unavailable coverage is a release blocker.

When touching testing docs, include the environment, date, and scope the checklist applies to.

## Admin AI Chatbot

- `admin-ai-chatbot-evals.md`: eval discipline and fixture format for the admin `Ask the AI` knowledge-base overhaul.
- `admin-ai-chatbot-eval-fixtures.json`: drafted fixture set for high-risk chatbot prompts.
- Run `npm run ai:eval:check` after fixture edits.

## Browser Workflow Smokes

- `browser-workflow-smoke-automation.md`: lessons and reusable pattern from the repeat-application assessment release for DB/API fixtures, authenticated browser smokes, deployed TEST routing, cleanup, and approval-workflow automation.
- `payments-workflow-automation.md`: payment transformation automation plan, safety-regression command, rollback DEV DB smoke, authenticated API/browser smoke entrypoints, and the 2026-05-11 TEST rehearsal evidence for the NWAC email workflow.
- `admin-console-bug-swatting-audit-2026-05-28.md`: first audit snapshot for the PATH admin-console bug-swatting program, including current lint/test failures and seed backlog items.
