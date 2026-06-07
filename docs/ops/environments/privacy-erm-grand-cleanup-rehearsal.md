# Privacy ERM Grand Cleanup Rehearsal

Status: point-in-time cleanup rehearsal plan from 2026-04-27/2026-04-28. Verify target migration state and current branch before acting.
Last reviewed: 2026-04-29 during ops documentation cleanup.

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
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/test-prod-like-restore-postload.sql
```

Do not clear restored Cognito subjects yet. Several cleanup migrations use those PROD subjects to backfill typed staff/applicant actor references. TEST app processes must stay stopped until identity neutralisation is complete.

This PROD-like TEST refresh is database-only. Do not copy PROD upload/supporting-document S3 objects into TEST as part of the rehearsal. Historical `iset_document` rows from PROD may reference objects missing from the TEST uploads bucket, and document-open `not found` errors are acceptable for those records.

4. Run the read-only audit and preview scripts:

```bash
npx env-cmd -f .env.test npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/test-YYYYMMDD-pre-grand-cleanup.md --max-rows 100
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-message-item-cleanup-preview.sql
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-document-scope-preview.sql
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-staff-shared-user-identity-preview.sql
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-client-account-event-orphan-preview.sql
```

5. Apply only the approved deterministic pre-cleanups:

```bash
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-message-item-cleanup-apply.sql
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-document-scope-apply.sql
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-client-account-event-orphan-apply.sql
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
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-duplicate-case-consolidation-preview.sql
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-duplicate-case-consolidation-apply.sql
```

The apply script records `iset_case_merge_audit`, repoints case-owned child rows, archives/detaches merged-away case shells by clearing their `client_id`, and fails closed if unique-key blockers or dangling references remain. Do not add a database unique constraint on `iset_case.client_id` until this consolidation step and the case-creation endpoint review have passed in rehearsal.

10. Neutralize imported identity bindings and rebind approved TEST staff overlays:

```bash
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/test-prod-like-restore-identity-overlay.sql
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
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-message-item-cleanup-preview.sql
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-document-scope-preview.sql
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-staff-shared-user-identity-preview.sql
bash scripts/run-test-sql-via-ssm.sh --sql-file sql/ops/privacy-erm-client-account-event-orphan-preview.sql
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
3. Run the preview SQL files through `bash scripts/run-prod-sql-via-ssm.sh`.
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

## 2026-04-28 Second TEST Rehearsal Outcome

The second TEST rehearsal applied the added duplicate-case consolidation step for real on the restored PROD-like TEST dataset and completed without data-shape blockers.

Measured disruptive window:

- PM2 app stop began at `10:03:24` America/New_York.
- Target-group smoke passed after recovery at `10:42:05` America/New_York.
- Observed TEST downtime from app stop to healthy target groups was approximately `38m 41s`.

Key timings:

- canonical migrations: `10m 37s`
- duplicate-case preview/apply: `18s`
- TEST identity overlay: `8s`
- admin and portal app build/deploy: `12m 29s`
- immediate post-deploy target recovery buffer: about `2m 47s`

Key outcomes:

- `npm run db:migrate:plan -- --target-env test` reported 0 pending migrations after apply.
- Duplicate-case consolidation merged the four known duplicate groups and left 0 duplicate client-case groups.
- Erica Christian now has one attached case in TEST: case `107`; old case `38` is archived, detached from the client, and marked `merged_duplicate`.
- SSM DB smokes reported 0 retired-surface, FK/CHECK, relationship, event actor, message mailbox, secure-message, document scope, application ownership, client-account orphan, identity-overlay, and duplicate-case anomalies.
- Admin and portal target groups both recovered to healthy; the immediate deploy smoke initially caught one portal target still warming up, then the smoke rerun passed.
- `npm run smoke:privacy-routes` passed. Live denial smoke tokens were not present, so `npm run smoke:privacy-denials` reported 26 skips and 0 failures.

Second-rehearsal fix:

- `privacy-erm-message-item-cleanup-preview.sql` and `privacy-erm-message-item-cleanup-apply.sql` were made schema-adaptive. They now use legacy `messages.sender_id` / `recipient_id` before canonical migrations and typed `sender_user_id` / `recipient_user_id` after canonical migrations.

Post-rehearsal checksum validation on 2026-04-28:

- After the second rehearsal, two migration files were hardened for schema-adaptive reruns: `20260426_0007_add_legacy_intake_document_source.sql` no longer depends on retired `iset_case.application_id`, and `20260427_0016_reconcile_event_actor_scope_audit.sql` normalizes the audit/event ID collation comparison.
- Because canonical migration tracking keys on filename plus checksum, TEST correctly showed those two edited files as pending even though earlier checksums had been applied during rehearsal.
- A targeted TEST apply of the two edited files succeeded; follow-up TEST plan reported 0 pending migrations.
- Targeted SSM DB checks remained clean for duplicate client cases, retired case/application pointer, document scope blockers, and event actor blockers.

## 2026-04-28 PROD Preflight

Read-only PROD preflight was run before the planned 9:00 PM EDT maintenance window.

Environment and migration state:

- PROD admin target group `nwac-prod-admin-tg` was healthy on port 5001.
- PROD portal target group `nwac-prod-portal-tg` was healthy on port 5000.
- `npm run db:migrate:plan -- --target-env prod` reported the expected 33 pending canonical migrations, from `20260426_0001_add_case_assigned_staff_profile_id.sql` through `20260427_0020_allow_casefile_secure_message_document_scope.sql`.
- PROD restore-point capture is built into `path:deploy` for DB-affecting PROD runs; do not start mutation without a captured Aurora cluster snapshot or an explicitly recorded manual restore point.

Pre-cleanup previews:

- `privacy-erm-message-item-cleanup-preview.sql` reported 81 unsafe `message_item` rows to remove during the deterministic cleanup: 4 `missing_owner_user` and 77 `owner_not_sender_or_recipient`; 200 rows were already OK.
- `privacy-erm-document-scope-preview.sql` reported the same class of scope gaps rehearsed on TEST. Most rows are backfillable; historical pre-materialisation `application_submission` rows without deterministic case/application candidates should be quarantined as `legacy_intake_upload`, not forced into fabricated application scope.
- `privacy-erm-client-account-event-orphan-preview.sql` reported 5 orphan client-account events with missing client rows: 1 `account_created`, 1 `invitation_sent`, and 3 `activated`; these match the deterministic orphan cleanup class rehearsed on TEST.
- `privacy-erm-staff-shared-user-identity-preview.sql` reported 11 staff profiles, 0 missing Cognito subjects, 0 missing emails, 0 duplicate Cognito-sub groups, and 0 duplicate staff-email groups. It reported one email-overlap mismatch for `bill@sillery.co.uk`, but a separate shared `user` row exists with the exact staff Cognito subject and placeholder email, so subject-only staff resolution has a deterministic path and does not require email fallback.

Duplicate-case preview:

- The post-migration duplicate-case preview script cannot run before canonical migrations because current PROD does not yet have `iset_case.assigned_staff_profile_id`.
- A pre-migration duplicate-case query showed exactly the same four duplicate client case groups as the second TEST rehearsal:
  - Ashlee Barner: cases `36` and `100`
  - Erica Christian: cases `38` and `107`
  - Hailey Lafrance-Chaput: cases `80` and `98`
  - Shelly Van Loon: cases `66` and `85`
- Run `privacy-erm-duplicate-case-consolidation-preview.sql` after canonical migrations and before applying the duplicate-case consolidation step during the outage.

Final pre-window checks:

- Admin repo local release commit: `c6186e8` on `backup-main` (`Prepare v0.6.0 privacy ERM rollout`).
- Public portal repo local release commit: `4953407` on `main` (`Remove maintenance save-progress copy`).
- GitHub push from this operator shell failed for both repos because the shell has no interactive HTTPS credentials: `fatal: could not read Username for 'https://github.com': No such device or address`. The local commits are present; push from a credentialed shell before or during release handoff if remote traceability is required.
- `npm run path:deploy:plan -- --env prod --release-id v0.6.0` succeeded from the committed admin state. It confirmed account `468278742295`, schema pending `33`, app deploy `shared=true admin=true portal=true`, and smoke targets `3`.
- The planned PROD restore point from that plan was `path-prod-v0-6-0-20260428220959` with reason `schema`. This plan does not create the snapshot; snapshot creation happens inside `path:deploy run` before mutation.
- `scripts/path-deploy.js` creates the PROD restore point with `aws rds create-db-cluster-snapshot`, waits for `db-cluster-snapshot-available`, then describes the snapshot before continuing to schema apply.
- Read-only AWS check confirmed PROD cluster `nwac-prod-db` is `available`, engine `aurora-mysql`, backup retention `30` days, latest restorable time `2026-04-28T22:07:05.633000+00:00`.
- Latest manual PROD cluster snapshot at preflight time was `path-prod-20260425-114853-20260425114911`, status `available`, created `2026-04-25T11:49:13.398000+00:00`.
- Final read-only service health pass returned `{"status":"ok"}` from `https://nwac-console.awentech.ca/healthz`, `https://iset.nwac.ca/healthz`, and `https://nwac-public.awentech.ca/healthz`. AWS identity remained `arn:aws:sts::468278742295:assumed-role/nwac-prod-codex-operator/codex-prod-operator`.

## 2026-04-28 PROD Maintenance Warning

At Bill's request, a scheduled maintenance warning was published to PROD runtime config for both admin and public portal surfaces:

- runtime row: `iset_runtime_config(scope='runtime', k='service.announcement')`
- surfaces: `admin`, `portal`
- visible start time: 9:00 PM EDT on Tuesday, April 28, 2026
- stored `startsAt`: `null`, deliberately, so current deployed clients do not append the scheduled-warning stock phrase `Save your progress now.`
- expected end: `2026-04-29T03:00:00.000Z` / 11:00 PM EDT
- expected duration: 120 minutes
- English body: `PATH will go offline for scheduled maintenance at 9:00 PM EDT on Tuesday, April 28.`

Verification:

- `nwac-public.awentech.ca/api/service-announcement/current` and `iset.nwac.ca/api/service-announcement/current` returned the stored announcement.
- `nwac-console.awentech.ca/api/service-announcement/current` returned `401 Missing bearer token` to unauthenticated curl, as expected for the admin surface; the stored payload includes the `admin` surface for authenticated admin clients.
- `path:maintenance:fallback status --env prod --surfaces all` showed all PROD host rules still forwarding normally. No ALB fixed-response maintenance page has been enabled yet.
- The admin and public portal source utilities were also updated locally to stop adding the save-progress stock phrase for future maintenance warnings; that code change will take effect on the next app deploy.

## 2026-04-28 PROD Rollout Outcome

Execution gate:

- Bill explicitly opened the PROD execution gate at approximately 9:00 PM EDT with "OK go."
- Hard ALB maintenance fallback was enabled for admin and both public portal hostnames before DB mutation.
- PROD restore snapshot captured and waited to `available`: `path-prod-v0-6-0-20260429010341`, created `2026-04-29T01:03:42.481000+00:00`.

Database apply:

- Pre-migration cleanup applied:
  - `privacy-erm-message-item-cleanup-apply.sql`: deleted `81` unsafe `message_item` rows (`4` missing owner users, `77` owner not sender/recipient).
  - `privacy-erm-document-scope-apply.sql`: updated `1132` documents from `1248` candidates.
  - `privacy-erm-client-account-event-orphan-apply.sql`: deleted `5` orphan client-account events.
- Canonical migrations initially stopped at `20260426_0007_harden_secure_message_scope_constraints.sql` because `chk_iset_document_manual_upload_scope` found `9` manual-upload documents whose `case_id` became deterministic only after the early `iset_application.case_id` backfill.
- Narrow repair applied under audit run `document-scope-post-app-case-20260429011422`: updated exactly `9` `manual_upload` documents, setting `iset_document.case_id = iset_application.case_id`; follow-up manual-upload scope violations were `0`.
- Canonical migration apply then resumed and completed through `20260427_0020_allow_casefile_secure_message_document_scope.sql`.
- Follow-up migration plan reported `Pending migrations: 0`.
- Duplicate-case consolidation preview reported the expected `4` merge pairs and `0` blockers.
- Duplicate-case consolidation apply run `duplicate-case-consolidation-20260429012409` merged `4` case pairs and reported `remaining_case_refs=0`, `remaining_duplicate_clients=0`.

Post-DB checks:

- Duplicate client-case groups: `0`.
- Retired `iset_case.application_id` column: `0` remaining.
- Document source-scope blockers for manual upload, application submission, system-generated, and secure-message attachments: all `0`.
- Client applicant-account event orphans: `0`.
- Message mailbox cleanup preview: `ok=200`, no unsafe rows.
- Duplicate-case preview after apply: `merge_pairs=0`, `blocker_rows=0`, `rows_that_would_be_repointed=0`.

App deploy:

- Deployed release `v0.6.0` under manifest `tmp/path-deploy/prod/v0.6.0--2026-04-29T01-25-23-679Z.json`.
- Shared artifact uploaded to `s3://nwac-prod-artifacts/shared/shared-latest.zip`.
- Admin artifact built from release stamp `v0.6.0 | 9ce25a5f` and uploaded to `s3://nwac-prod-artifacts/admin/admin-dashboard-latest.zip`.
- Portal artifact built from release stamp `v0.1.0 | v0.6.0 | 49534071 | production` and uploaded to `s3://nwac-prod-artifacts/portal/portal-latest.zip`.
- PROD instance refresh `30154c46-1b6f-4315-9322-d92088033903` completed `Successful` at `2026-04-29T01:35:56+00:00`.
- During refresh, fallback maintenance had to be cleared before the ASG could complete because the portal target group reported `Target.NotInUse` while ALB rules were fixed responses. After fallback clear, both PROD target groups reported healthy on replacement instance `i-07ce08779486e2032`.

Completion checks:

- `npm run path:deploy:smoke -- --env prod` returned `200` for:
  - `https://nwac-console.awentech.ca/healthz`
  - `https://iset.nwac.ca/healthz`
  - `https://nwac-public.awentech.ca/healthz`
- Direct curl checks returned `{"status":"ok"}` from all three health endpoints.
- ALB fallback status returned normal forwarding for admin and both portal hostnames.
- Runtime maintenance warning was cleared; `iset_runtime_config(scope='runtime', k='service.announcement')` row count was `0`, and public service-announcement endpoints returned the default disabled payload.
- Final target group checks showed replacement instance `i-07ce08779486e2032` healthy on admin port `5001` and portal port `5000`.

Outstanding operational note:

- Local GitHub push still requires credentials from an interactive shell. Admin remains ahead of origin by the local rollout/preflight documentation commits, and portal remains ahead by the local maintenance-copy commit.

Post-rollout approved assessment PDF audit and corrected repair:

- After PROD rollout, a corrected audit separated real approval-workflow decisions from imported/application-less `manual_backload` existing interventions.
- The first audit had over-counted backloaded existing interventions because compatibility rows in `iset_intervention_proposal` can have `review_status='approved'`; `metadata.source='manual_backload'` and `metadata.entryMode='existing'` identify those as silent historical backloads, not proposal approvals requiring assessment PDFs.
- Initial corrected PROD repair target:
  - Katrina Woodgate, application `6`, case `88` / `MI-MNT3JPF0-5BFEF1`: submitted assessment PDF already existed as document `774`; approved dual-signed assessment PDF was missing.
  - Erica Christian, proposal `30`, intervention `15`, application `25`, case `107` / `ISET-20260416-5490A4`: both submitted and approved assessment PDFs were missing.
- Repair runner: `tmp/prod-repair-approved-assessment-pdfs-20260428/repair-approved-assessment-pdfs.js`, staged through `s3://nwac-prod-artifacts/ssm-sql/prod-repair-approved-assessment-pdfs-20260428/repair-approved-assessment-pdfs.js` and executed on PROD app host `i-07ce08779486e2032`.
- Apply run ID: `approved-assessment-backfill-20260428`.
- The run inserted document rows `1668`, `1669`, and `1670`, but the signature evidence was wrong:
  - Katrina's generated approved assessment incorrectly used the later Madison Coppola approval-transaction `assessment_submitted` event as the case manager signature, even though the existing submitted assessment document `774` was created by Amanda Curtis and shows Amanda as case manager.
  - Erica's generated approved assessment used Amanda Curtis as both case manager and approver because the legacy proposal/intervention rows both store staff profile `54`; case `107` has no separate approval event evidence.
- Bill rejected those generated artefacts. The generated document rows `1668`, `1669`, and `1670` were hard-deleted from `iset_document` and `iset_document_intervention`; follow-up SQL verification showed `0` remaining rows for those ids. The corresponding S3 objects could not be deleted by the available PROD app-host role because `nwac-prod-app-role` lacks `s3:DeleteObject` on `nwac-prod-uploads-b6bb`; they are unreferenced orphan objects and are not visible through PATH.
- The repair runner was corrected so Katrina's approved assessment uses the owner of the existing submitted assessment document `774` as the case-manager signature source, instead of the later approval-transaction `assessment_submitted` event.
- Corrected PROD generation completed on `2026-04-29 02:47 UTC`:
  - Katrina Woodgate document `1671`: `case_assessment_approved`, label `Approved case manager assessment v1`, application `6`, case `88`, path `uploads/2026/04/29/116/775e71c7-c33c-4317-af68-e89c3012436b-approved-case-manager-assessment-v1-mi-mnt3jpf0-5bfef1.pdf`. Signature metadata: case manager Amanda Curtis signed `2026-04-17T22:01:35.000Z`; approver Madison Coppola signed `2026-04-21T13:15:14.344Z`.
  - Erica Christian document `1672`: `case_assessment`, label `Case manager assessment v1`, application `25`, case `107`, action plan `9`, intervention `15`, path `uploads/2026/04/29/41/51373c9f-7ec4-47e2-b7a4-74093801ed9e-case-manager-assessment-v1-iset-20260416-5490a4.pdf`. Signature metadata: case manager Amanda Curtis signed `2026-04-20T17:47:29.000Z`.
  - Erica Christian document `1673`: `case_assessment_approved`, label `Approved case manager assessment v1`, application `25`, case `107`, action plan `9`, intervention `15`, path `uploads/2026/04/29/41/ef983c55-268e-439d-b921-b2d6f7d3a4f0-approved-case-manager-assessment-v1-iset-20260416-5490a4.pdf`. Signature metadata: case manager Amanda Curtis signed `2026-04-20T17:47:29.000Z`; approver Amanda Curtis signed `2026-04-20T17:48:09.000Z`.
- Erica's approved PDF reflects the legacy data evidence in PROD: both `iset_intervention_proposal.id=30` and `iset_case_intervention.id=15` store staff profile `54` / Amanda Curtis for the submit/review path, and no separate case `107` approval event was found.

## 2026-04-28 TEST UI Validation Findings

During guided TEST UI validation, Wabanang Polson's pending-approval application exposed a release/data-quality finding:

- application: `2`
- case: `84` / `ISET-20260409-A85F59`
- status: `pending_approval`
- lifecycle: `pending_decision`
- event history includes `assessment_submitted` on `2026-04-16 14:21:04.362`
- supporting-document library has no active `system_generated` `case_assessment`, `application_form`, or `financial_overview` rows for the application/case
- control record Hailey Lafrance-Chaput (`application_id=16`, `case_id=98`) has all three expected generated rows

This appears to be an existing data/workflow gap also visible on PROD, not a duplicate-case consolidation issue. Treat it as a pre-PROD-release repair candidate: either regenerate the missing assessment/application/financial overview documents for Wabanang through a reviewed script or confirm a deliberate business reason they should remain absent before cutover.

Follow-up code fix started in DEV:

- Backend route `PUT /api/cases/:id` now treats generated assessment-submission documents as required when an application assessment is being submitted into Pending Decision.
- The route generates the case manager assessment, application form, and financial overview before committing the status transition. If any required document cannot be generated or recorded as an active `iset_document` row, the transaction fails and the application should not land in Pending Decision without those documents.
- The three generated-document storage helpers now accept the active DB connection so their document rows participate in the same transaction as the status update.

Post-rollout assurance note:

- Read-only PROD SQL check after the `v0.6.0` rollout found no live `assessment_submitted` or `nwac_review_submitted` events after the rollout window; the only assessment PDFs created after `2026-04-29 01:00:00 UTC` were the explicit repair rows `1671`, `1672`, and `1673` with `metadata.ops_repair.run_id='approved-assessment-backfill-20260428'`.
- Therefore the new live PROD UI path has not yet been exercised by staff after rollout. Current confidence is based on deployed-code inspection plus the TEST rehearsal, not on a post-rollout PROD user transaction.
- Recommended first-production-use smoke: use a controlled internal/test applicant record, submit one new application assessment through the UI, verify active `system_generated` `case_assessment`, `application_form`, and `financial_overview` rows/signatures, then commit an approval and verify active `system_generated` `case_assessment_approved` with the assessor as recommendation signer and the NWAC approver as approval signer.

PROD data repair completed:

- A guarded one-off runner generated Wabanang Polson's missing PROD generated-document set for application `2`, case `84`, reference `ISET-20260409-A85F59`.
- Dry-run guard confirmed the target application was still `pending_approval` / `pending_decision` and that exactly `case_assessment`, `application_form`, and `financial_overview` were missing.
- Inserted active `system_generated` document rows:
  - `1499` `case_assessment`: `case-manager-assessment-v1-ISET-20260409-A85F59.pdf`
  - `1500` `application_form`: `application-form-ISET-20260409-A85F59.pdf`
  - `1501` `financial_overview`: `financial-overview-ISET-20260409-A85F59.pdf`
- Post-repair PROD SQL verification showed one active row for each of the three categories, all linked to application `2`, case `84`, client `89`, applicant user `99`.
- S3 `headObject` verification confirmed all three object keys exist as `application/pdf` with sizes matching the DB rows.
- Repair caveat: while loading the deployed admin server helpers for the first dry-run/apply, the deployed server's startup component-template sync updated a small number of component templates from its filesystem source of truth. The final repair runner suppresses those startup sync calls.

## 2026-04-28 PROD Public-Portal Signed-Form PDF Gap Trace

TEST validation also exposed that early PROD public-portal submissions had signed consent/declaration payload data but no generated signed-form PDF rows in `iset_document`.

Evidence from PROD:

- Affected ISET public-portal submissions from `ISET-20260409-A85F59` through `ISET-20260416-628C50` have signed payload fields such as `consent.signed`, `auth_froici_sing.signed`, `sig_caofs.signed`, `indigenous_declaration.signed`, and `conflict_applicant_signature.signed`.
- Those same submissions have 0 active `iset_document` rows with `source='application_submission'` and document categories `ei_consent`, `iset_client_info_release`, `client_acknowledgement`, `indigenous_declaration`, or `conflict_of_interest`.
- The first active generated signed-form rows appear for `ISET-20260418-D6CEEE` / application `27` / case `109` / applicant user `100` at `2026-04-18 00:06:43` UTC. Five rows were created together: `ei_consent`, `iset_client_info_release`, `client_acknowledgement`, `indigenous_declaration`, and `conflict_of_interest`.
- Public-portal submissions immediately after that point also have five signed-form rows, confirming the behavior had started working for new submissions.

Deployment trace:

- The source feature was not newly added in April. The portal signed-form generation function was originally added in `../ISET-intake` commit `f796937f04a8109daf2d2f11c19851b3b7b1aa28` on `2025-12-09` (`Signed forms stored in the supporting documents folder.`), and both pre-release portal commit `268827fe` and release commit `880f3a85` contain that function.
- The release that aligns with the behavior change is PROD deployment `prod-client-case-application-20260416`, manifest `tmp/path-deploy/prod/prod-client-case-application-20260416--2026-04-17T02-10-02-689Z.json`.
- That deployment completed successfully at `2026-04-17T02:30:15.493Z`, deployed portal git head `880f3a85e530acc7bf5e9437b1ac293c0564d3c3` and admin/schema git head `6b8811b17c0d64614281b1d06d378c07b8957633`, and applied the `20260416_0001` through `20260416_0004` schema migrations between `2026-04-17 02:14:51` and `2026-04-17 02:16:21` UTC.
- `20260416_0001_add_application_ownership_and_status_columns.sql` added durable `iset_application.client_id` and `iset_application.case_id`. The matching portal commit updates `/api/intake/complete` to insert/persist that client/case/application ownership linkage before the generated signed-form documents are written.
- A later portal-only PROD deploy, `20260417-prod-portal-imported-message-reply`, completed at `2026-04-17T17:21:18.457Z` and redeployed the same portal git head `880f3a85`. The first successful signed-form rows were created after both deployments, so the data proves the fix was in place by then; the underlying schema/code change entered PROD in `prod-client-case-application-20260416`.

Proof limit:

- Historical CloudWatch/app logs for the pre-fix submissions were not available to the current operator role, so the exact swallowed exception from the old runtime was not recovered.
- The defensible conclusion is that pre-`2026-04-17` PROD was not materializing generated public-portal signed forms into scoped `iset_document` rows even though the signature data existed in the submission payload. The behavior starts immediately with the first public-portal ISET submission after the client/case/application ownership release.

PROD repair completed:

- Repair runner: `scripts/repair-missing-portal-signed-form-docs.js`, executed on PROD app host `i-08ac3b26965466f3f` using deployed portal root `/opt/nwac/portal`.
- Dry-run before apply: scanned `38` portal-origin applications, found `22` affected applications and `109` missing signed-form documents, with `0` errors.
- Apply run ID: `signed-form-repair-2026-04-28T20-48-43-389Z`.
- Apply result: created `109` active `iset_document` rows, skipped `80` already-existing rows, and reported `0` errors.
- Created rows by document category:
  - `ei_consent`: `21`
  - `iset_client_info_release`: `22`
  - `client_acknowledgement`: `22`
  - `indigenous_declaration`: `22`
  - `conflict_of_interest`: `22`
- SQL verification for that repair run showed `109` total rows, created between `2026-04-28 20:48:54` and `2026-04-28 20:52:37` UTC.
- Post-repair dry-run: scanned `38` portal-origin applications, found `0` affected applications, `0` missing documents, and `0` errors.
