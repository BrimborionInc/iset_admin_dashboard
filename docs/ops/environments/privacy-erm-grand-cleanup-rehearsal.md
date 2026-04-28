# Privacy ERM Grand Cleanup Rehearsal

Purpose: operational rehearsal plan for promoting the DEV privacy ERM cleanup to TEST and eventually PROD without guessing on live data.

Last Updated: 2026-04-27

## Current Status

DEV has the cleanup code and migrations through `20260427_0019_retire_zzz_legacy_documents_table.sql`.

DEV code also removes the checked shared-user-to-staff-profile email fallback paths. Existing staff local-user rows must resolve by Cognito subject or be repaired/quarantined during rehearsal. Admin/public OpenRouter calls now include sensitive-content blocks; these are code-only gates, not schema migrations.

TEST and PROD have not received this grand cleanup migration set yet.

Do not deploy this cleanup to TEST or PROD until the preflight and rollback steps below are ready.

## Release Shape

Treat the cleanup as one coordinated release train:

- admin backend and frontend code
- current public portal backend/frontend changes in `../ISET-intake`
- shared code used by both surfaces
- canonical migrations in `sql/migrations/`
- one-off preflight/quarantine SQL in `sql/ops/`
- post-apply smokes and route-level denial checks

Do not promote a destructive schema migration by itself. The runtime code must already be compatible with the target schema shape.

## Required Local DEV Gates

Before any TEST rehearsal:

```bash
npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev
npx env-cmd -f .env npm run smoke:privacy-erm
npx env-cmd -f .env npm run smoke:privacy-routes
npx env-cmd -f .env npm run seed:privacy-denials
npx env-cmd -f .env npm run smoke:privacy-denials
npx env-cmd -f .env node --check isetadminserver.js
npx env-cmd -f .env node --check ../ISET-intake/server.js
git diff --check && git -C ../ISET-intake diff --check
```

Expected DEV state:

- pending migrations: `0`
- privacy ERM smoke: pass
- privacy route-scope smoke: pass
- privacy route-denial smoke: pass when real DEV Cognito tokens and fixtures are supplied; otherwise explicit `SKIP` rows only
- no syntax failures
- no whitespace errors

`smoke:privacy-denials` uses real bearer tokens only. Do not add test-auth bypasses or header impersonation to make these checks pass. Useful local env vars:

```bash
PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN=...
PRIVACY_DENIAL_STAFF_TOKEN=...
PRIVACY_DENIAL_CASEWORK_PAYMENTS_TOKEN=...
PRIVACY_DENIAL_FINANCE_OR_ADMIN_TOKEN=...
PRIVACY_DENIAL_APPLICANT_A_TOKEN=...
PRIVACY_DENIAL_APPLICANT_B_TOKEN=...
PRIVACY_DENIAL_ADMIN_CASE_ID=...
PRIVACY_DENIAL_ADMIN_APPLICATION_ID=...
PRIVACY_DENIAL_ADMIN_DOCUMENT_ID=...
PRIVACY_DENIAL_PAYMENT_PACKET_ID=...
```

For local DEV, `npm run seed:privacy-denials` can create synthetic wrong-owner fixtures from the supplied applicant/staff tokens and writes ignored IDs to `tmp/privacy-denial-fixtures.env`. Treat that as DEV test-data setup only; TEST/PROD rehearsal must use reviewed environment-specific fixtures or existing safe test records.

Run with `-- --require-live` once the token/fixture set is ready. Without that flag, missing live tokens are reported as `SKIP` so the script remains safe to run in a clean shell.

## TEST Rehearsal Command Checklist

Use this as the concrete TEST rehearsal package. Keep the apps in maintenance/stopped state while canonical migrations are applied; do not let admin and portal run against a half-migrated schema.

1. Capture the checkout and migration range:

```bash
git rev-parse HEAD
ls sql/migrations/20260426_*.sql sql/migrations/20260427_*.sql
```

2. Capture or identify the TEST restore point.

3. If TEST is being refreshed from PROD-like data, stop TEST apps first, restore the dataset, then immediately apply the side-effect guard:

```bash
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/test-prod-like-restore-postload.sql
```

Do not clear restored Cognito subjects yet. Several cleanup migrations use those PROD subjects to backfill typed staff/applicant actor references. TEST app processes must stay stopped until identity neutralisation is complete.

4. Run the read-only audit and preview scripts:

```bash
npx env-cmd -f .env.test npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/test-YYYYMMDD-pre-grand-cleanup.md --max-rows 100
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-message-item-cleanup-preview.sql
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-document-scope-preview.sql
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-staff-shared-user-identity-preview.sql
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-client-account-event-orphan-preview.sql
```

5. Apply only the approved deterministic pre-cleanups:

```bash
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-message-item-cleanup-apply.sql
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-document-scope-apply.sql
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-client-account-event-orphan-apply.sql
```

There is intentionally no generic staff/shared-user identity apply script. Rows flagged by `privacy-erm-staff-shared-user-identity-preview.sql` need explicit staff identity repair or quarantine; do not fix them by email fallback.

6. Re-run the preview scripts. Continue only when deterministic blocker counts are zero or every non-zero row has an explicit quarantine decision.

7. Deploy the compatible admin, portal, and shared code to TEST, with the TEST apps still in a controlled state.

8. Plan and apply canonical migrations:

```bash
npm run db:migrate:plan -- --target-env test
npm run db:migrate:apply -- --target-env test
```

9. Preview and apply duplicate-case consolidation for the one-client/one-case target model:

```bash
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-duplicate-case-consolidation-preview.sql
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-duplicate-case-consolidation-apply.sql
```

The apply script records `iset_case_merge_audit`, repoints case-owned child rows, archives/detaches merged-away case shells by clearing their `client_id`, and fails closed if unique-key blockers or dangling references remain. Do not add a database unique constraint on `iset_case.client_id` until this consolidation step and the case-creation endpoint review have passed in rehearsal.

10. Neutralize imported identity bindings and rebind approved TEST staff overlays:

```bash
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/test-prod-like-restore-identity-overlay.sql
```

The current approved TEST staff overlays are `bill@sillery.co.uk` as System Administrator and `program.admin@awentech.ca` as NWAC Administrator. Add further TEST identities only through explicit Cognito-sub overlays, not by email fallback.

11. Re-run data and route gates:

```bash
npx env-cmd -f .env.test npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/test-YYYYMMDD-post-grand-cleanup.md --max-rows 100
npx env-cmd -f .env.test npm run smoke:privacy-erm
npx env-cmd -f .env.test npm run smoke:privacy-routes
npx env-cmd -f .env.test npm run smoke:privacy-denials -- --require-live
```

12. Restart TEST apps only after the post-migration gates pass or after a rollback decision is made.

## TEST Rehearsal Sequence

1. Record the exact local checkout state intended for TEST.
2. Create or identify a reversible TEST DB backup.
3. If rehearsing against prod-like data, follow `docs/ops/environments/test-prod-migration-rehearsal.md` first so identity links and outbound side effects are neutralized before apps restart.
4. Run the read-only privacy audit against the target TEST dataset where DB credentials are available:

```bash
npx env-cmd -f .env.test npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/test-YYYYMMDD-pre-grand-cleanup.md --max-rows 100
```

5. Run targeted preview/quarantine SQL before applying canonical migrations:

```bash
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-message-item-cleanup-preview.sql
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-document-scope-preview.sql
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-staff-shared-user-identity-preview.sql
scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-client-account-event-orphan-preview.sql
```

6. Review blocker counts before continuing. Do not apply migrations if any fail-closed migration would drop non-empty legacy experiment rows or force ambiguous identity mappings.
7. Deploy the compatible admin, portal, and shared code to TEST.
8. Apply canonical migrations to TEST:

```bash
npm run db:migrate:plan -- --target-env test
npm run db:migrate:apply -- --target-env test
```

9. Run `privacy-erm-duplicate-case-consolidation-preview.sql`; apply `privacy-erm-duplicate-case-consolidation-apply.sql` only when blockers are zero or explicitly resolved.
10. Re-run the privacy audit and smokes against TEST.
11. Run `smoke:privacy-denials` against TEST with real TEST staff/applicant/payment-role tokens and `-- --require-live`, then manually cover any remaining route class that still cannot be automated.
12. Perform route-denial checks with real TEST staff/applicant identities for:

- wrong-applicant public message/document access
- wrong-region/wrong-assignee case/application access
- generated consent/declaration PDFs for out-of-scope applications
- document presign by raw ID without case/application scope
- finance payment-packet access for case-scoped versus global finance roles
- Query Editor server export rejects non-active database selections
- admin AI chat rejects obvious applicant/client identifiers before proxying, and AI dummy-data routes return 404 unless unsafe debug routes are explicitly enabled
- notification template/settings/sender APIs reject non-System/NWAC Administrator staff tokens
- generic `/api/users` and `/api/users/:id` return `410 retired_endpoint`

## TEST Blocker Decisions

Handle non-zero preflight rows this way:

- `message_item` nonparticipant rows: preserve/delete only through `privacy-erm-message-item-cleanup-apply.sql`, then re-preview.
- `iset_document` source-scope gaps: apply deterministic backfills through `privacy-erm-document-scope-apply.sql`; quarantine anything the script cannot derive.
- Historical portal uploads that were written before an application/case existed should be reclassified as `legacy_intake_upload`, not forced into a fabricated application.
- staff shared-user overlap or missing Cognito subject: repair the staff/applicant identity link explicitly or quarantine the row from the rehearsal. Do not map by email.
- client applicant-account orphan events: preserve/delete only through `privacy-erm-client-account-event-orphan-apply.sql`, then re-preview.
- non-empty `jordan_application`, `jordan_application_draft`, or `zzz_legacy_documents`: stop and create a reviewed archive/quarantine script before destructive table retirement.
- application/client/case mismatches: repair only when the owning case/client is deterministic; otherwise stop for manual review.
- generated-document or manual-upload scope violations: fix the writer/backfill to provide `client_id`, `case_id`, and the required applicant/application scope; do not loosen CHECK constraints.
- case-file secure messaging is allowed without `messages.application_id`; require `case_id` plus exactly one applicant actor, and do not fabricate an application row for application-less cases.
- duplicate cases for one client: run `privacy-erm-duplicate-case-consolidation-preview.sql`, review the proposed survivor/merged pairs, then use the apply script only when unique-key blockers are zero. Endpoint code must still reuse the existing client case; database uniqueness is a backstop after code and data are proven, not the ordinary creation path.

## PROD Preflight

PROD requires explicit operator intent before any DB mutation.

Before PROD apply:

1. Capture a PROD restore point through the deployment orchestrator or a manually recorded Aurora snapshot.
2. Run a read-only privacy audit against PROD, preserving the output outside the app artifact.
3. Run the preview SQL files through `scripts/run-prod-sql-via-ssm.sh`.
4. Record row counts and blocker decisions in the release notes.
5. Prepare any quarantine/archive SQL for non-empty legacy experiment tables or ambiguous orphan rows.
6. Rehearse the exact SQL on TEST first.
7. Run the duplicate-case preview against PROD and include every survivor/merged case decision in the release record before applying the consolidation script.

## Stop Conditions

Stop the release and do not apply destructive migrations if any of these are true:

- `message_item` still has nonparticipant mailbox rows that have not been preserved and deleted.
- `iset_document` has source-scope blockers that cannot be deterministically backfilled.
- `iset_application` has missing `client_id`, missing `case_id`, case/client mismatches, or multiple plausible cases.
- staff-profile/shared-user rows would require email fallback because Cognito subject is missing or mismatched.
- `jordan_application`, `jordan_application_draft`, or `zzz_legacy_documents` has PROD rows that have not been quarantined or archived.
- duplicate client case groups remain after the consolidation preview/apply step, or the duplicate-case apply script reports case-assessment/watch/conflict/snapshot blockers.
- event, notification, assignment, or version author legacy shadows have non-zero unresolved drift.
- TEST route-denial checks expose out-of-scope client/application/case/message/document/generated-file data.
- the cleanup would require weakening any privacy CHECK constraint to make live data fit.

## Rollback

For TEST, restore the TEST backup or reset TEST from the chosen source dataset.

For PROD, rollback is DB restore-point based. Do not rely on reverse migrations for this release, because several migrations intentionally retire legacy columns/tables after audit rows are recorded.

Code rollback must include admin, portal, and shared surfaces together.

## Durable Notes

- Static route smoke is a guard-marker tripwire only. It does not prove wrong-user denial.
- The admin server currently requires real Cognito bearer tokens. Do not add a production-reachable test-auth bypass just to make denial tests easier.
- Query Editor server export must remain limited to the active environment PATH database.
- Generated consent/declaration PDFs must validate application visibility before rendering.
- Shared `user.id` to `staff_profiles.id` mapping must stay Cognito-sub only; repair identity rows rather than falling back by email.
- `chk_iset_document_manual_upload_scope` and `chk_iset_document_system_generated_scope` are privacy guards. Fix caller scope resolution or quarantine data; do not loosen those constraints.
- `chk_iset_document_secure_message_attachment_scope` permits application-less case-file messages, but still requires client, case, applicant, uploader, and origin-message lineage.

## 2026-04-28 TEST PROD-Like Rehearsal Outcome

The privacy ERM grand-cleanup migration was rehearsed against a sanitized PROD-like TEST restore.

Key outcomes:

- TEST backup: `s3://nwac-test-artifacts/db-dumps/test/20260428-021742-pre-prod-like-restore.sql.gz`
- PROD source dump: `s3://nwac-prod-artifacts/db-dumps/prod/20260428-021742-prod-like-test-rehearsal.sql.gz`
- Sanitized TEST artifact: `s3://nwac-test-artifacts/db-refresh/20260428-021742-prod-like-test-rehearsal.sanitized.sql.gz`
- Canonical migrations reached 0 pending on TEST through `20260427_0020_allow_casefile_secure_message_document_scope.sql`.
- Identity overlay removed imported PROD Cognito bindings and rebound TEST `bill@sillery.co.uk` / `program.admin@awentech.ca`.
- Admin and portal code were deployed to TEST as `prod-like-privacy-erm-test`; both TEST ALB target groups are healthy.
- SSM DB smoke checks are clean for retired legacy surfaces, message mailbox containment, secure-message actor scope, document source scope, application ownership, event actor scope, relationship FK hardening, and client-account event orphans.

Rehearsal-specific data decisions now baked into migrations:

- 121 historical pre-materialisation portal uploads are quarantined as `legacy_intake_upload`.
- 5 application-linked manual-upload rows get applicant scope from the owning application submission.
- 29 unresolved legacy event actors are preserved in raw actor fields and reclassified as `system`.
- One application-less case-file secure message confirmed that secure messaging must support case-file scope without an application row.

Post-rehearsal duplicate-case follow-up:

- TEST showed four clients with two cases each after the first privacy ERM rehearsal: Ashlee Barner, Erica Christian, Hailey Lafrance-Chaput, and Shelly Van Loon.
- `sql/ops/privacy-erm-duplicate-case-consolidation-preview.sql` now proposes deterministic survivor/merged pairs using the documented canonical-case rules: open action-plan/intervention history first, then richest case history, then assigned/open case, then recency.
- A rollback-only validation of `sql/ops/privacy-erm-duplicate-case-consolidation-apply.sql` on TEST reported `4` merge pairs, `0` remaining duplicate clients, and `0` remaining dangling case-owned references, then rolled back. Current TEST was unchanged by that validation.
