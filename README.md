# PATH Admin Dashboard

Admin console and backend for the PATH/ISET platform. This repo contains the Cloudscape React admin UI, the Node admin API server, canonical schema migrations, deployment tooling, and the agent-maintained project memory under `docs/`.

## Agent Entry

AI coding agents must start with `AGENTS.md`, which points to the canonical project entry point at `docs/AGENTS.md`.

The documentation under `docs/` is maintained as persistent project memory for future short task-based threads. Treat it as operational guidance, not proof. Current code, migrations, package scripts, config, tests, and live environment checks outrank narrative docs when they disagree.

## Main Areas

- `src/`: React admin UI, Cloudscape widgets, routes, auth helpers, shared utilities, help panels, and workflow authoring/preview code.
- `isetadminserver.js`: Admin API server, DB access, startup template sync, migration runner integration, and operational endpoints.
- `sql/migrations/`: Canonical PATH shared-schema migrations.
- `sql/ops/`: One-off/manual SQL that is intentionally not auto-applied.
- `scripts/`: Build, deploy, migration, smoke-test, data-sync, and repair utilities.
- `docs/`: Agent-facing project memory plus source/reference artifacts.
- `infra/`: AWS/Terraform infrastructure material.
- `../ISET-intake`: Current deployed public portal repo used by PATH portal deploy tooling.
- `../iset-public-portal`: Parked/experimental public portal rebuild unless a task explicitly targets it.

## Common Commands

Verified from `package.json` and WSL task config on 2026-05-07.

- WSL local dev checkout: open `/home/bill/ISET/admin-dashboard` in VS Code and run task `dev:all` for admin, public portal, MinIO, and the Sage Intacct mock service. See `docs/guides/wsl-local-development.md`.

- `npm start`: write local build info and start the CRA dev server on port `3001`.
- `npm run server`: start `isetadminserver.js`.
- `npm run dev`: legacy Windows/PowerShell launcher; prefer VS Code task `dev:all` in the WSL checkout.
- `npm run build`: production React build.
- `npm test -- --watch=false`: React test runner in non-watch mode.
- `npm run lint`: ESLint over `src`.
- `npm run db:migrate:plan -- --target-env test|prod`: plan canonical remote schema migrations.
- `npm run db:migrate:apply -- --target-env test|prod`: apply canonical remote schema migrations.
- `npm run path:deploy -- --env test|prod`: PATH deploy orchestrator.
- `npm run path:maintenance -- set|clear -- --env test|prod`: in-app maintenance warning control.
- `npm run path:maintenance:fallback -- set|clear -- --env test|prod --surfaces admin|portal|all`: ALB fixed-response maintenance page control.
- `npm run smoke:privacy-erm`: privacy ERM DB integrity smoke.
- `npm run smoke:privacy-routes`: static route-scope guard smoke.
- `npm run smoke:privacy-denials`: live route-denial smoke after seeding fresh tokens.
- `python3 scripts/check-doc-links.py`: read-only local Markdown reference check for admin and portal docs.

## Documentation Map

- `docs/AGENTS.md`: Required project entry point and current high-level guardrails.
- `docs/meta/standing-directive.md`: Durable maintenance contract for the project memory layer.
- `docs/meta/documentation-audit-2026-04-29.md`: Current documentation cleanup inventory and queue.
- `docs/meta/project-map.md`: Repo/module map.
- `docs/meta/codex-thread-index.md`: Cross-thread recovery index.
- `docs/meta/changelog.md`: Technical/user-visible change log.
- `docs/meta/next-release-notes-log.md`: Working log for user-facing "What's New" content.
- `scripts/check-doc-links.py`: Read-only guard for broken local Markdown references across admin and portal docbases.

## Safety Notes

- Do not reintroduce simulated admin auth or dev-bypass behavior. Admin auth is Cognito-only.
- Do not treat docs as current unless verified when the claim matters.
- Do not put credentials, tokens, or unnecessary sensitive personal data in docs.
- Before TEST or PROD deploys, read the deployment guidance linked from `docs/AGENTS.md`; PROD refreshes that can cause user-visible interruption require an appropriate maintenance warning.
