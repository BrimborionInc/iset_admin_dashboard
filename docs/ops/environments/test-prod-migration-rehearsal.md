# TEST PROD-Like Migration Rehearsal

Purpose: rehearse the client/case/application migration on a production-like TEST dataset without doing a dangerous raw PROD clone that immediately re-enables PROD-linked identities and automated outbound side effects.

Last Updated: 2026-04-16

## Current rehearsal artifacts

Captured on 2026-04-16:

- Reversible TEST backup:
  - `s3://nwac-test-artifacts/db-dumps/test/20260416-pre-prod-rehearsal.sql.gz`
- Fresh PROD dump:
  - `s3://nwac-prod-artifacts/db-dumps/prod/20260416-migration-rehearsal.sql.gz`

Created via:

- `scripts/run-db-dump-via-ssm.sh --env test ...`
- `scripts/run-db-dump-via-ssm.sh --env prod ...`
- In the current Codex sandbox, the prod form of this helper works with the reduced role-backed `nwac-prod` profile because the helper now exports temporary credentials from the active AWS profile before copying the dump back to S3.

## Why raw PROD -> TEST is unsafe as-is

The migration plan already called for a recent **sanitized production snapshot**, not a blind raw clone.

Concrete reasons confirmed on 2026-04-16:

- TEST `.env.test` files still contain live SES credentials.
- `isetadminserver.js` starts reminder/doc-request/allocation pollers on an interval in memory.
- A raw PROD DB clone also copies PROD identity links (`staff_profiles.cognito_sub`, applicant identity linkage fields, legacy portal `user.cognito_sub` rows), while TEST auth still uses the TEST Cognito pools.

Implications:

- outbound mail or finance-side effects can be triggered accidentally
- TEST staff sign-in can drift or break until DB-side staff identities are relinked to the TEST staff pool
- applicant portal sign-in on copied PROD applicant data is not reliable in TEST without deliberate relinking or neutralization

## Recommended rehearsal path

1. Stop the TEST PM2 apps (`nwac-admin`, `nwac-portal`) on the TEST app hosts.
2. Restore the fresh PROD dump into TEST.
3. Immediately run [`sql/ops/test-prod-like-restore-postload.sql`](../../../sql/ops/test-prod-like-restore-postload.sql).
4. Relink required TEST staff rows in `staff_profiles.cognito_sub` to the TEST staff Cognito pool before admin UAT.
5. Only then bring TEST back up.
6. Run the migration SQL / backfill / compatibility checks on that TEST dataset.

## Post-load safety SQL

Current bundle:

- [`sql/ops/test-prod-like-restore-postload.sql`](../../../sql/ops/test-prod-like-restore-postload.sql)

Current effects:

- slows backend reminder/allocation pollers to a daily interval
- disables notification-setting email alerts
- removes `budget_allocation.metadata.scheduledApplyAt` from approved rows so the allocation poller cannot auto-apply historical scheduled entries

## Executed rehearsal result

Executed on 2026-04-16:

1. TEST PM2 apps were stopped on both TEST app hosts.
2. The fresh PROD dump was restored into TEST using a sanitized variant of the dump because the raw dump attempted to insert a generated column on `iset_case_conflict_declaration`.
3. [`sql/ops/test-prod-like-restore-postload.sql`](../../../sql/ops/test-prod-like-restore-postload.sql) was applied immediately after restore.
4. TEST staff Cognito subs were relinked from the TEST staff pool.
5. TEST PM2 apps were restarted and both ALB target groups returned to `healthy`.
6. The current refactored code/schema were deployed to TEST.
7. [`sql/ops/20260416_release2_client_case_application_backfill_apply.sql`](../../../sql/ops/20260416_release2_client_case_application_backfill_apply.sql) was executed successfully on the restored TEST dataset.

Observed outcomes:

- TEST counts matched the PROD-like source snapshot before migration rehearsal:
  - `applications = 23`
  - `cases = 104`
  - `clients = 118`
  - `action_plans = 6`
  - `interventions = 6`
- Post-backfill preview checks reached:
  - `applications_missing_client_id = 0`
  - `applications_missing_case_id = 0`
  - `action_plans_missing_application_provenance = 0`
  - `application_rows_needing_status_backfill = 0`
  - `case_rows_needing_lifecycle_backfill = 0`
  - `intervention_proposal_backfill_candidates = 0`
  - `live_interventions_needing_delivery_status_backfill = 0`
- Fresh post-deploy log sweeps showed both `nwac-admin` and `nwac-portal` online on both TEST hosts, with current stdout logs updating and no fresh writes to the long-standing PM2 error logs during the rehearsal window.

Residual findings:

- three clients still have multiple cases in the PROD-like dataset and must remain in a manual-review / merge queue before uniqueness is enforced on `iset_case.client_id`
- the only active documents missing `client_id` were seeded placeholder uploads (`metadata.placeholderUpload = true`), not live participant documents

## Related docs

- [`docs/planning/client-case-application-migration-plan.md`](../../planning/client-case-application-migration-plan.md)
- [`docs/guides/test-staff-cognito-recovery.md`](../../guides/test-staff-cognito-recovery.md)
- [`docs/ops/environments/test-env-db-refresh.md`](./test-env-db-refresh.md)
