# Single Case Per Client

Purpose: capture the agreed operating rule that a client should have one long-lived case record, even when multiple applications arrive over time.

Audience: assessors, case managers, and developers wiring client/application/case flows.

Last Updated: 2026-04-16

## Status

- This is the agreed target operating model for PATH.
- Current implementation remains partial/hybrid; migration work is tracked in `docs/planning/client-case-application-target-model.md`.

## Rule

- One real person maps to one `client`.
- One `client` maps to one `case`.
- `application` is a repeatable intake/request/decision event and can occur many times for the same client.
- `action_plan` represents an episode of support inside the case.

## Entry-Path Implications

- Portal registration alone does not create a case.
- On submitted application receipt, PATH must resolve or create both the client and that client's single case.
- Manual Intake follows the same rule.
- Client Batch Import may create a client/case without creating an application when the source record is historical casework rather than an intake event.

## Operational Implications

- Repeat yearly ISET applications should reuse the client's existing case rather than creating a parallel case.
- Case history, documents, action plans, and interventions should accumulate in that single case.
- Duplicate case rows for the same client are data defects unless a future exception is explicitly designed and approved.

## Current Implementation Note

- The admin backend already detects prior same-client cases and surfaces a warning in the assessment workspace, but current write paths still do not fully enforce case reuse.
- Use `docs/planning/client-case-application-target-model.md` for the canonical target-model and migration plan.
