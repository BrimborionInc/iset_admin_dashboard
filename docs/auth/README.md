# Auth Docs

Status: current notes plus historical root-cause and migration planning material.

Admin auth is Cognito-only according to `docs/AGENTS.md`. Do not reintroduce simulated admin auth, IAM-off bypasses, or header-driven role impersonation based on older auth docs.

## How To Use

- Use root-level auth notes for historical bugs and root-cause context.
- Use `plans/` for migration planning history unless a current task explicitly revives the plan.
- Verify current behavior against `src/auth/`, `src/context/AuthContext.js`, `isetadminserver.js`, and live Cognito/environment checks when needed.

## Cleanup Rule

When touching auth docs, mark historical root-cause notes and migration plans explicitly so they do not compete with the current Cognito-only model.
