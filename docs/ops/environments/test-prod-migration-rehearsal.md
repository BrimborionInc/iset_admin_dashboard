# TEST PROD-Like Migration Rehearsal

Purpose: rehearse the client/case/application migration on a production-like TEST dataset without doing a dangerous raw PROD clone that immediately re-enables PROD-linked identities and automated outbound side effects.

Last Updated: 2026-04-28

Related cleanup release runbook: `docs/ops/environments/privacy-erm-grand-cleanup-rehearsal.md`

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
- Use `scripts/copy-prod-dump-to-test-artifacts.sh` to stream the PROD dump from `nwac-prod-artifacts` to `nwac-test-artifacts` without writing the live-data dump to local disk. The stream also runs `scripts/sanitize-prod-dump-for-test-restore.js`, which removes the generated `is_active` column from `iset_case_conflict_declaration` inserts so the dump can be restored into TEST.

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
3. Immediately run [`sql/ops/test-prod-like-restore-postload.sql`](../../../sql/ops/test-prod-like-restore-postload.sql) to disable side effects and clear transient queues.
4. Run migration SQL / backfill / compatibility checks while the restored PROD Cognito subjects are still present, because several migrations use those subjects to backfill typed actor references.
5. Run [`sql/ops/test-prod-like-restore-identity-overlay.sql`](../../../sql/ops/test-prod-like-restore-identity-overlay.sql) to neutralize imported PROD identity bindings and rebind the approved TEST staff identities.
6. Only then bring TEST back up for admin UAT.

## Post-load safety SQL

Current bundle:

- [`sql/ops/test-prod-like-restore-postload.sql`](../../../sql/ops/test-prod-like-restore-postload.sql)

Current effects:

- slows backend reminder/allocation pollers to a daily interval
- disables notification-setting email alerts
- removes `budget_allocation.metadata.scheduledApplyAt` from approved rows so the allocation poller cannot auto-apply historical scheduled entries
- clears `iset_event_outbox`, `pending_uploads`, `input_json_state`, and `application_lock`

Identity overlay:

- [`sql/ops/test-prod-like-restore-identity-overlay.sql`](../../../sql/ops/test-prod-like-restore-identity-overlay.sql)
- Run after schema/data migrations and before app restart.
- Clears imported applicant/public `user.cognito_sub` values and `client.applicant_cognito_*` links.
- Replaces imported staff Cognito subjects with deterministic TEST-disabled placeholders.
- Rebinds these TEST staff identities:
  - `bill@sillery.co.uk` -> `System Administrator`
  - `program.admin@awentech.ca` -> `NWAC Administrator`
- Do not add broad email-based rebinding; any extra TEST login identity needs an explicit Cognito-sub overlay.

## Executed rehearsal result

Executed on 2026-04-28 for the privacy ERM grand-cleanup release:

Artifacts:

- TEST pre-restore backup:
  - `s3://nwac-test-artifacts/db-dumps/test/20260428-021742-pre-prod-like-restore.sql.gz`
- PROD source dump:
  - `s3://nwac-prod-artifacts/db-dumps/prod/20260428-021742-prod-like-test-rehearsal.sql.gz`
- Sanitized TEST restore artifact:
  - `s3://nwac-test-artifacts/db-refresh/20260428-021742-prod-like-test-rehearsal.sanitized.sql.gz`

Sequence and result:

1. Stopped `nwac-admin` and `nwac-portal` on both TEST hosts before restore.
2. Restored the sanitized PROD-like dump into TEST.
3. Applied `test-prod-like-restore-postload.sql`.
4. Applied deterministic pre-cleanups:
   - `document-scope-20260428022841`
   - `client-account-event-orphan-20260428022841`
   - `message-item-20260428023306`
   - follow-up document scope rerun `document-scope-20260428024810`
5. Applied all canonical privacy ERM cleanup migrations through `20260427_0020_allow_casefile_secure_message_document_scope.sql`.
6. Applied `test-prod-like-restore-identity-overlay.sql`; imported PROD identity bindings were neutralized and TEST staff overlays were rebound for `bill@sillery.co.uk` and `program.admin@awentech.ca`.
7. Deployed admin and portal code to TEST with release ID `prod-like-privacy-erm-test`.
8. Both TEST target groups recovered to healthy:
   - `nwac-test-admin-tg`: both targets healthy on `:5001`
   - `nwac-test-portal-tg`: both targets healthy on `:5000`

Observed cleanup decisions:

- 121 historical portal upload rows that predated deterministic application/case materialisation were reclassified from `application_submission` to `legacy_intake_upload`.
- 5 application-linked manual-upload documents were backfilled to the applicant user from the owning application submission.
- 29 unresolved legacy event actors were preserved in raw actor fields but reclassified as `system` typed actors to avoid assigning them to the wrong person.
- Case-file secure messaging is now explicitly supported without fabricating an application row; `messages.application_id` and secure-message document `application_id` remain optional when the case file has no application.

Post-migration gates:

- `npm run db:migrate:plan -- --target-env test` reported 0 pending migrations.
- SSM DB smoke checks reported 0 for legacy tables, retired columns, relationship hardening blockers, event actor blockers, message mailbox anomalies, secure-message scope anomalies, document scope anomalies, application ownership anomalies, and client-account event orphans.
- Local `audit:privacy-erm` / `smoke:privacy-erm` cannot connect directly to private TEST RDS from the operator machine (`ETIMEDOUT`); use SSM-backed SQL checks or run the scripts on a host with RDS network access.

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
