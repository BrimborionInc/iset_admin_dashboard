# PATH Data Promotion Catalog

Purpose: define which database data can move across environments, which data must never be promoted into prod, and which explicit commands are approved for Codex-operated promotion work.

Last updated: 2026-04-04

## Core rules

- `DEV` is the authoring/source-of-truth environment for configuration and workflow promotion.
- `TEST` / training is disposable. It may be reset from a scrubbed snapshot or overwritten by explicit sync jobs.
- `PROD` is persistent. Do not restore full dumps from DEV or TEST into prod.
- `PROD` receives:
  - schema changes through canonical migrations in `sql/migrations/`
  - allowlisted config/reference promotions only
- `PROD` never receives:
  - applicant, client, case, action-plan, intervention, document, message, payment, audit, or identity-link data copied from another environment

## Data classes

### Never copy to prod

- `client`
- `iset_application*`
- `iset_case*`
- `iset_document*`
- `messages`, `message_attachment`, signing/message thread tables
- `payment_*`, `finance_transaction`, reimbursement/packet evidence
- applicant/staff identity-linkage state tied to real users
- operational/audit/event history

### Test-only reset data

- Full scrubbed database snapshots
- Synthetic/demo seed packs
- Any throwaway training fixtures intended to be overwritten later

### Allowlisted cross-environment config/reference data

- Published intake runtime row: `iset_runtime_config(scope='publish', k='workflow.schema.intake')`
- Workflow authoring graph for a specific workflow ID:
  - `workflow`
  - `workflow_step`
  - `workflow_route`
  - `workflow_route_option`
  - referenced `step`
  - referenced `step_component`

Additional datasets should be added here before new sync code is introduced.

## Implemented sync datasets

### `intake-runtime-publish`

- Class: `config`
- Source envs: `dev`
- Target envs: `dev`, `test`, `prod`
- Effect: upserts only the published intake runtime row in `iset_runtime_config`
- Prod rule: allowed

### `workflow-authoring`

- Class: `config`
- Source envs: `dev`
- Target envs: `dev`, `test`, `prod`
- Required option: `--workflow-id`
- Effect: replaces workflow membership/routing rows for one workflow ID and upserts the referenced step definitions/components
- Prod rule: allowed with care; this keeps admin-side authoring aligned, but applicant-facing portal behavior still depends on the published runtime-config row

### `intake-release`

- Class: `config`
- Source envs: `dev`
- Target envs: `dev`, `test`, `prod`
- Required option: `--workflow-id`
- Effect: applies both `workflow-authoring` and `intake-runtime-publish`
- Prod rule: allowed

## Commands

Catalog:

```bash
npm run data:sync:catalog
```

Plan:

```bash
npm run data:sync:plan -- --dataset intake-release --workflow-id 21
```

Write a bundle without applying:

```bash
npm run data:sync:bundle -- --dataset intake-release --workflow-id 21 --output /tmp/intake-release.sql
```

Apply to test:

```bash
npm run data:sync:apply -- --dataset intake-release --workflow-id 21 --target-env test
```

Apply to prod:

```bash
npm run data:sync:apply -- --dataset intake-release --workflow-id 21 --target-env prod --yes
```

## Current limitations

- Source promotion currently supports `dev` only.
- Test/prod apply uses SSM on the application hosts because the Aurora clusters are not directly reachable from the sandbox.
- Workflow sync intentionally does not try to clean up orphaned `step` rows; it only replaces workflow membership/routing and aligns referenced step definitions/components.
- Shared step IDs across workflows are allowed. The plan output warns when syncing a shared step because aligning that step definition also affects the other workflows that reference the same step ID.
