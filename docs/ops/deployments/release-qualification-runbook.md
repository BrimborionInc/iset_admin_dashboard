# PATH Release Qualification and PROD Authorization Runbook

Status: authoritative release gate for local DEV, real-MySQL qualification, TEST deployment, deployed TEST acceptance, and PROD authorization.

Last reviewed: 2026-08-10 after the two-step review release exposed the need to separate universal qualification coverage from harness development and validation.

This runbook supersedes any shorter deploy checklist when deciding whether a PATH release is admissible. The deployment guides still describe mechanics and maintenance handling, but they do not authorize a release by themselves.

## Non-negotiable release rule

A release is not qualified by a green unit suite, successful build, healthy target group, `/healthz`, or `/readyz` alone. PROD authorization requires two unexpired machine-generated decisions for the same exact admin, portal, shared, and migration candidate:

1. `DEV GO`: local aggregates, lint, static privacy checks, both compiled bundles, the deterministic admin browser suite, real DEV MySQL schema/request/write contracts, privacy ERM, payment rollback, AI fixtures, and Intacct drift checks all passed.
2. `TEST GO`: that DEV-qualified candidate was admitted by the TEST deployment manifest, deployed provenance matches, rollback artifacts exist, target health and on-instance readiness pass, configuration and worker state are safe, deployed role/applicant/cross-app journeys pass, strict denials have no skip, rollback fixtures leave no residue, and maintenance state is clear.

Any failed, skipped, unavailable, expired, unmapped, source-drifted, or cleanup-incomplete required check is `NO-GO`; it must never be relabelled `GO`. Normal releases have no skip or waiver flag. A separately recorded operator-authorized emergency PROD release may use the app-only pre-qualification deployment procedure described below without changing or falsifying the `NO-GO` evidence.

## Harness design boundary

A broad reusable qualification harness remains the objective. The 2026-08-07 through 2026-08-10 failure was not that acceptance covered more than one reported defect; the harness correctly exposed wider product weaknesses that warranted repair. The failure was deriving environment, UI, fixture, and workflow contracts by inference during the release loop, coupling harness-only corrections to new product release candidates, and allowing newly written harness behavior to become a mandatory gate before the harness itself was shown to be reliable.

- Establish each test contract from observed or authoritative behavior before encoding it: deployed request/response traces, product-owned UI state, live target metadata, and explicit infrastructure capabilities.
- Version the immutable product candidate, harness implementation, and execution attempt independently. A harness-only repair must not create a new product candidate or require redeployment when the deployed product artifacts are unchanged.
- Qualify new or materially changed harness checks independently through repeatable known-good and deliberate known-bad trials before promoting them to mandatory release gates.
- Classify a failure as product, harness, environment, or infrastructure before changing source or restarting qualification. An unclassified failure stops the loop for diagnosis.
- Keep universal orchestration broad, but compose it from bounded domain checks with explicit prerequisites, effects, assertions, cleanup ownership, and evidence. Do not build one cross-domain simulated journey that makes unrelated systems prerequisites for one another.

Develop the harness bottom-up. Do not begin a new harness generation with the most complex deployed journey. Each layer must first demonstrate repeatable known-good runs, detection of deliberate known-bad cases, bounded timeouts, intelligible evidence, and interruption-safe cleanup before the next layer depends on it:

1. runner lifecycle and evidence format, with no application or environment effects;
2. deterministic local process and HTTP checks;
3. explicit metadata-only database and cloud identity adapters;
4. transactional local fixtures and recovery tests;
5. immutable TEST deployment, provenance, readiness, and rollback checks;
6. one bounded deployed domain journey at a time;
7. cross-domain concurrency and failure/recovery scenarios only after their component journeys are certified.

Do not use ad hoc string parsing to infer JSON structure or SQL correctness. JSON evidence must be schema-validated and compared structurally. SQL-bearing checks must use explicit structured statement declarations or a proven parser/driver boundary, live metadata for the exact target, and the repository's per-statement admission rule. A new test pack starts as advisory and cannot block a product release until its harness behavior has completed this certification path independently of an urgent release.

`scripts/path-deploy.js run` enforces the evidence boundary:

- TEST accepts only a current `DEV GO` file.
- PROD accepts only a current `TEST GO` file.
- The release ID, all three repository heads/tree fingerprints, migration checksum, inventory checksum, declared data/config operations, expiry, and evidence checksum must match.
- Qualification runs against all three source trees even when only one tree changed, because shared runtime, API composition, schema, auth, notifications, files, and cross-application workflows are coupled.

## Control files and evidence

- Machine coverage map: `docs/testing/release-coverage-inventory.json`
- Qualifier: `scripts/path-release-qualify.js` / `npm run release:qualify`
- Real database contract: `scripts/real-mysql-release-contract.js`
- Compiled admin journey suite: `scripts/release-browser-smoke-suite.js`
- Isolated builds: `scripts/release-build-contract.js`
- TEST runtime postflight: `scripts/path-test-runtime-postflight.js`
- Deployment admission and provenance: `scripts/path-deploy.js`
- Evidence output: `tmp/release-qualification/<stage>/`
- Deployment manifests: `tmp/path-deploy/<environment>/`

Evidence contains the commands, timestamps, durations, log paths and SHA-256 hashes, source and schema fingerprints, required-check list, blockers, expiry, and final `GO` or `NO-GO`. Retain the DEV evidence, TEST deploy manifest, TEST evidence, and their log directories together through the PROD observation window.

## Coverage inventory

The JSON inventory is executable project memory. Every changed file must match at least one domain; unknown files block qualification. Declared runtime operations also map to domains; unknown operations block qualification. Domain dependencies expand the check set.

| Release domain | Principal proof |
| --- | --- |
| Admin application and role journeys | Admin aggregate, compiled bundle, 13 deterministic browser journeys, deployed Coordinator/Regional Manager/Decision Maker smoke |
| Portal application and applicant scope | Portal aggregate and composition tests, real caller-boundary tests with live-schema-faithful result shapes, deployed intake completion/retry/files/signing smoke, two-applicant browser/API ownership smoke |
| Shared runtime and API composition | Both aggregate suites, injected full Express-stack tests, exact shared-tree provenance, deployed cross-app journeys |
| Schema and readiness/request parity | Canonical migration plan, exact admin and portal readiness contracts on real MySQL, authenticated `staff_profiles` hydration using the same exported column list, deployed `/readyz`, zero pending migrations and zero unresolved failures for current canonical checksums |
| Identity, authentication, authorization | Unit/composition authorization suites, disposable Cognito role journeys, strict real-token wrong-role/cross-surface/wrong-owner denials with no skipped checks |
| Frontend network and state failures | Compiled admin browser suite covering loading, error, empty, stale-response, retry, network-idle, route, queue, workspace, assessment, and intervention behavior |
| Runtime configuration and intake publish | Declared `dataset:*` and `workflow:*` operations, source plan guard, deployed workflow completion against the published schema, TEST external-routing assertions |
| Jobs, notifications, and delivery queues | Real MySQL event/delivery persistence, worker code suites, on-instance processes, zero stale/dead-letter/ambiguous TEST deliveries, role workflow notification cleanup |
| Files, messages, signing, and object scope | Privacy ERM, payment/file tests, deployed generated-file and object-store fixtures, applicant document/message denials, zero S3/DB residue |
| Payments and Finance | Safety suite, rollback-only DEV and deployed TEST payment fixture, Finance email disabled, no provider call, cleanup assertion |
| External services | Disposable TEST Cognito/S3 only; local Intacct drift guard and AI fixture check; TEST Finance email/Intacct disabled; controlled provider tests require separate explicit scope |
| Deployment, recovery, and provenance | Evidence admission before mutation, candidate provenance inside each artifact, successful deploy manifest, retained prior TEST artifacts, maintenance cleanup, PROD restore point for DB-affecting runs |

The local Intacct check is not Sage certification. A release that changes the external Intacct contract must add approved current official-document or sandbox evidence to the inventory before qualification. A test that would send real email, submit to Sage, invoke a billable AI model, or contact a real applicant is unavailable until a controlled substitute or explicitly approved test is defined; it must not be silently skipped.

## Phase 0 — freeze and plan the candidate

Work from:

```bash
cd /home/bill/ISET/admin-dashboard
```

Choose one release ID and do not reuse it for a different tree. Inspect all three repos and the unversioned Intacct mock. For committed release ranges, provide a merge-base per changed repository; uncommitted files are included automatically.

```bash
git status --short
git -C ../ISET-intake status --short
git -C ../shared status --short

npm run release:qualify -- plan \
  --stage dev \
  --release-id <release-id> \
  --base admin=<last-released-admin-ref> \
  --base portal=<last-released-portal-ref> \
  --base shared=<last-released-shared-ref>
```

Use `--full` when a reliable prior release ref is unavailable. For intended config/data work, declare every operation in both plan and run:

```bash
--operation dataset:intake-release --operation workflow:21
--operation test-db-refresh
```

Pass criteria:

- zero unmapped files and zero unmapped operations;
- all changed surfaces and dependencies appear in the domain list;
- admin, portal, and shared appear under candidate components;
- the operator release manifest names every migration, application surface, shared dependency, dataset/config key, feedback item, and deliberate exclusion.

Any source change after qualification—including committing a previously dirty file—invalidates the tree fingerprint and requires a new run.

Known qualification-granularity gap (recorded 2026-07-20): the current evidence schema and deploy admission compare one whole-tree fingerprint, so even a release-note-only correction forces complete DEV qualification, another TEST deployment, and complete deployed TEST acceptance. That is intentionally still the enforced behavior until the tooling changes, but it is stricter than the risk warrants when the runtime code, dependencies, migrations, inventory, operations, and generated application behavior are otherwise unchanged. The required follow-up is a machine-enforced non-runtime-drift path that positively allowlists release-note/documentation inputs, regenerates and validates the affected bundle/content, proves every runtime fingerprint is unchanged, issues new auditable evidence for the corrected artifact, and rejects any mixed or uncertain drift. Do not bypass exact-source admission manually before that narrower path exists.

## Phase 1 — local DEV qualification

Run the metadata-only DEV database gate first. It pins both configured and live native-label identity to the recorded 2026-08-09 target (`172.26.176.1` / `root` / `iset_intake` / `3306`; server `DESKTOP-PDFA51K`; principal `root@172.26.%`; MySQL `8.0.40`), discovers every declared object individually, and records the exact raw `SHOW CREATE` value and its SHA-256 alongside structured column/index/constraint proof, a structural DDL SHA-256 and the hashes of the 13 attempt-bound residue statements. The prospective structural identity excludes only the observed numeric InnoDB table-level `AUTO_INCREMENT` counter in the exact `ENGINE=InnoDB AUTO_INCREMENT=<positive integer> DEFAULT CHARSET=` form. The raw value remains retained and hashed; engine, charset, collation, table-option ordering and every other raw byte remain structural. MySQL documents that generated InnoDB auto-increment values are not rolled back and that `SHOW CREATE TABLE` exposes the current counter as a table option ([InnoDB auto-increment handling](https://dev.mysql.com/doc/refman/8.0/en/innodb-auto-increment-handling.html), [`SHOW CREATE TABLE`](https://dev.mysql.com/doc/refman/8.0/en/show-create-table.html)). Any absent, different or repeated option form is not normalized. The gate performs zero ordinary reads, transactions, fixtures, residue queries, or cleanup:

```bash
node scripts/real-mysql-release-contract.js --target-env dev --schema-preflight-only --json
```

If a prior rollback fixture failed after mutation began, do not assume rollback or best-effort cleanup was sufficient. Before another fixture attempt, run the same exact identity/full-DDL preflight followed by the contract's guarded residue-only audit:

```bash
node scripts/real-mysql-release-contract.js --target-env dev --residue-audit-only --json
```

This mode performs 14 finished-statement-guarded native `COUNT(*)` checks covering all 13 mutated objects; `staff_profiles` has separate subject and email scopes. The four descendant checks use only current-live-DDL-proven, fully qualified foreign-key joins back to the attempt-owned client or case marker. It performs no fixture mutation, rollback, or cleanup. Any nonzero count or metadata/statement admission failure is `NO-GO` and must be investigated before another ordinary fixture run.

The same mode accepts `--attempt-id <id>` to bind one immutable fixture ledger and exactly one independent count to each of the 13 mutated objects. The full runner records that attempt ID, its derived non-secret fixture markers, the object list, each residue-statement SHA-256 and the ledger digest before mutation. The no-flag release command remains compatible by generating its own unique attempt ID.

The explicit `--fail-after-first-mutation` and `--interrupt-after-first-mutation` controls require a caller-supplied `--attempt-id`, are mutually exclusive and are valid only for the full rollback contract. They act only after the first fixture insert has returned successfully. Their presence does not authorize their execution: run either only inside the separately approved Phase 5 certification boundary, followed by a fresh exact-identity/full-DDL preflight and attempt-bound 13-scope residue verifier. The interrupt control synchronously emits only the attempt ID and ledger digest before signalling its own process. It never runs cleanup SQL.

Then run the resolved mandatory suite. The machine inventory repeats this gate as `real-mysql-schema-preflight` before the schema plan and full real-MySQL contract. This uses local resources and real DEV MySQL only. It must not use TEST or PROD credentials.

```bash
npm run release:qualify -- run \
  --stage dev \
  --release-id <release-id> \
  --base admin=<last-released-admin-ref> \
  --base portal=<last-released-portal-ref> \
  --base shared=<last-released-shared-ref> \
  --evidence-out tmp/release-qualification/dev/<release-id>.json
```

Use the same `--full` and `--operation` flags as the plan. The qualifier runs all mandatory checks, even after a failure, so the evidence reports the complete blocker set.

Local database effects are bounded:

- every SQL-bearing DEV qualifier pins the configured/live identity, captures current one-object-at-a-time structural metadata, and validates the finished ordinary statement immediately before driver execution; helper-issued runtime-readiness, payment, privacy, and Financial Overview policy SQL is not exempt;
- the DEV schema plan proves the pinned database/host/port/principal/version identity, discovers and hashes full migration-ledger DDL metadata when present, and permits only one guarded qualified ledger read; it never creates the ledger;
- privacy ERM is read-only;
- the release MySQL contract runs its full structural preflight before readiness reads, inserts synthetic staff/import/event/delivery and document-policy fixtures inside one transaction, rolls back, then proves zero residue;
- the payment fixture is transaction/rollback only and does not call email or a provider;
- build and browser outputs live under `tmp/release-qualification/`, generated build metadata is restored, and the local HTTP/browser processes are closed.

A schema or finished-statement failure before mutation closes the connection without rollback, residue reads, or cleanup SQL. Once any fixture mutation is dispatched, failure handling must roll back and still run every guarded zero-residue assertion before surfacing the original and cleanup results together.

Pass criteria: decision is `GO`, every required check is `passed`, cleanup counters are zero, and validation succeeds against the still-frozen source:

```bash
npm run release:qualify -- validate \
  --stage dev \
  --evidence tmp/release-qualification/dev/<release-id>.json
```

DEV evidence expires after 72 hours.

## Mandatory stop before TEST

Do not set a TEST warning, mutate TEST, create TEST fixtures, upload an artifact, apply a migration, or deploy until the user explicitly approves the rehearsal in the current thread.

Present this exact approval packet:

- release ID and exact admin/portal/shared heads plus dirty/clean state;
- changed domains, migration count, application surfaces, shared dependencies, declared runtime/data operations, and explicit exclusions;
- DEV evidence path, evidence ID, decision, expiry, and any known evidence limitation;
- deployment sequence and maintenance surfaces;
- required AWS profile/account, Cognito roles/accounts, bearer-token fixtures, database/object fixtures, and who owns cleanup;
- external effects: Cognito users, S3 objects, SES/email, AI, Intacct/Sage, other providers;
- expected TEST interruption and total operator time;
- rollback artifacts/strategy and DB reset strategy;
- objective TEST acceptance criteria listed below;
- risks, including configuration divergence, one-host TEST behavior, migration compatibility, worker backlog, and first-use provenance marker requirements.

Approval of investigation or local DEV work is not approval of this TEST mutation.

## Phase 2 — TEST rehearsal after explicit approval

### Required identities and fixtures

- AWS profile `nwac-test` resolving to account `124355655255`, with SSM, ASG/EC2 describe, test artifact S3, TEST Cognito, and the existing TEST SQL helper access.
- Disposable staff identities created by the two-step smoke for Coordinator, Regional Manager, and Decision Maker/NWAC Administrator behavior. System Administrator remains technical support behavior, not the business approver.
- Disposable applicant identities and relational/object fixtures created by the intake and applicant-scope scripts.
- The strict-denial smoke provisions its own approved disposable Coordinator, Decision Maker, and two applicant Cognito identities plus scoped relational fixtures. Ephemeral tokens are never emitted into qualification evidence or logs, and every Cognito/database residue counter must return zero. Manually supplied `PRIVACY_DENIAL_*` values are not a release prerequisite.
- Portal bearer-token denial probes must use the disposable users' Cognito access tokens (`iset_access`), not ID tokens; an authentication failure does not prove a wrong-owner authorization denial.

### Safe external boundary

- TEST Finance email routing must be disabled.
- TEST Intacct integration/submission mode must be disabled.
- No real email, Sage/Intacct submission, real applicant contact, or paid AI call is authorized by this runbook.
- Cognito and TEST artifact/fixture S3 effects are allowed only for disposable synthetic identities/objects and must be removed by the smoke scripts.
- The privacy AI check must reject sensitive content before external dispatch; the local sentinel environment value does not configure or call a provider.

### Maintenance and deploy sequence

For the normal coupled release, estimate 10–20 minutes of TEST maintenance/restarts and 20–40 additional minutes for acceptance. TEST currently has one cost-pruned app host, so both applications can be briefly unavailable. Use:

1. Set the all-surface `Test and Training environment` warning and state Production is unaffected.
2. Wait the announced window (normally five minutes).
3. Enable all-surface ALB fixed `503` fallback.
4. Run the exact deployment plan and confirm no undeclared dataset/config work appears.
5. Deploy with DEV evidence.
6. Clear fallback so target groups can return healthy.
7. After both target groups are healthy under normal forwarding, clear the warning before TEST qualification so the acceptance gate can prove there is no residual maintenance state.

```bash
npm run path:maintenance -- set --env test --surfaces all --start-in 5m \
  --expected-duration 20m --title "Test and Training maintenance" \
  --message "The Test and Training environment is temporarily unavailable for maintenance. Production is not affected."

npm run path:maintenance:fallback -- set --env test --surfaces all

npm run path:deploy -- --env test --skip-data --release-id <release-id> \
  --qualification-evidence tmp/release-qualification/dev/<release-id>.json

npm run path:maintenance:fallback -- clear --env test --surfaces all
npm run path:maintenance -- clear --env test --surfaces all
```

For an approved dataset or TEST reset, include the exact previously qualified flags. `path:deploy` rejects a dataset/workflow/reset operation absent from DEV evidence. Capture the successful deploy manifest path printed by the command.

The TEST deployment records the prior retained timestamped admin and portal artifacts before uploading the candidate. Missing prior rollback artifacts block TEST acceptance. First adoption of artifact provenance should deploy both applications so both roots receive `.path-release-provenance.json`.

For a partial deployment, exact candidate provenance is required only on components replaced by that deployment; untouched components retain their prior release marker and must still pass process, readiness, and health checks. Do not compare an untouched component's older artifact fingerprint to the new all-repository candidate fingerprint. Qualification still fingerprints all three source trees, and a later deployment of an untouched component must admit matching evidence and stamp its own artifact provenance.

TEST portal preflight builds use an ignored release-scoped directory under `tmp/path-deploy-builds/`, not the portal repo's tracked `build-test/` tree. The same isolated output is packaged if preflight passes and is removed in the deploy command's final cleanup on success or failure. A preflight build must never make its own source fingerprint fail or leave generated portal output dirty.

## Phase 3 — deployed TEST acceptance

Run the qualifier directly; it provisions and removes strict-denial identities and fixtures inside the bounded acceptance checks:

```bash
npm run release:qualify -- run \
  --stage test \
  --release-id <release-id> \
  --dev-evidence tmp/release-qualification/dev/<release-id>.json \
  --deployment-manifest tmp/path-deploy/test/<manifest>.json \
  --evidence-out tmp/release-qualification/test/<release-id>.json
```

The acceptance gate proves:

- deployment manifest `successful`, same release ID, admitted DEV evidence ID, exact source heads/tree fingerprints, and exact migration inventory;
- a distinct prior artifact exists for every replaced TEST application;
- all selected target-group registrations are healthy under normal forwarding;
- every healthy ASG instance is SSM-online; local admin and portal `/readyz` return `ready`;
- deployed admin authenticated-staff contract is the same five-column readiness contract and artifact provenance matches the qualified candidate;
- admin and portal PM2 processes are online with live PIDs and required DB env is present; portal runtime DDL is disabled;
- canonical TEST migration plan has zero pending migrations and zero failed attempts for current canonical checksums; historical failures for obsolete checksums remain visible as audit evidence but are non-blocking only when the current checksum has succeeded;
- no stale, dead-letter, ambiguous, or uncertain event deliveries; Finance email and Intacct are disabled; maintenance announcement count is zero;
- deployed Coordinator, Regional Manager, Decision Maker, intake completion/retry/generated files, CFA signing/finalization, applicant ownership, cross-surface, wrong-role, wrong-owner, Finance, document, message, and payment rollback journeys pass;
- all disposable Cognito, DB, notification, document, and S3 fixtures report zero residue;
- both ALB host rules are normal `forward` actions.

The role, intake, applicant, and payment scripts create only synthetic TEST fixtures. A nonzero cleanup count fails acceptance even if journey assertions passed. Perform documented manual cleanup immediately if automation reports residue, preserve the failed evidence, and rerun the full affected acceptance after cleanup.

TEST evidence expires after 24 hours. Validate it again immediately before seeking PROD authorization:

```bash
npm run release:qualify -- validate \
  --stage test \
  --evidence tmp/release-qualification/test/<release-id>.json
```

After `TEST GO`, rerun the maintenance-only check if any cleanup command was needed after the main acceptance run:

```bash
npm run release:test:postflight -- --maintenance-only --json
```

## Hard PROD go/no-go

`GO` means all of the following are true at the decision time:

- DEV evidence is `GO` and unexpired at TEST deployment time;
- TEST deployment manifest is successful and points to that DEV evidence;
- TEST evidence is `GO`, unexpired, checksum-valid, and still matches all three local source trees and migrations;
- no required check is failed, skipped, unavailable, or cleanup-incomplete;
- every declared config/data operation was exercised in TEST and is still the intended PROD operation;
- the release manifest, maintenance impact, restore point, rollback path, and any controlled external-provider scope are explicitly reviewed;
- user explicitly authorizes the exact PROD release in the current thread.

Otherwise the decision is `NO-GO`. Health alone never changes it.

### Explicit emergency PROD release

When Bill explicitly orders deployment despite failed or unavailable qualification and identifies the qualification system itself as the blocker, the release may use the pre-qualification production procedure through `--emergency-release`. This is not a qualification waiver and must not produce or imply `TEST GO`. It requires a clean source tree, the known evidence artifact, a specific recorded authorization reason, `--skip-schema --skip-data`, and `--yes`. It remains subject to production builds, tests/lint/privacy preflight, immutable artifact staging, maintenance warning/fallback, ASG refresh, normal-routing smoke, and rollback readiness. It cannot apply schema, data, runtime configuration, SQL, TEST refresh, or external-provider operations.

```bash
npm run path:deploy -- --env prod --skip-schema --skip-data --release-id <release-id> \
  --qualification-evidence <known-GO-or-NO-GO-evidence.json> \
  --emergency-release --emergency-release-reason "<explicit operator authorization and rationale>" \
  --skip-smoke --yes
```

The manifest and packaged provenance record `EMERGENCY-AUTHORIZED`, the supplied evidence ID/decision, the exact deployed source, the reason, and all qualification validation errors. Clear fallback, run the normal PROD smoke, and clear the warning only after smoke succeeds.

After explicit PROD authorization, the mutating command must include the TEST evidence:

```bash
npm run path:deploy -- --env prod --skip-data --release-id <release-id> \
  --qualification-evidence tmp/release-qualification/test/<release-id>.json --yes
```

Follow the PROD warning/fallback/restore-point/normal-routing smoke sequence in the primary deploy guide. DB-affecting PROD runs must capture the orchestrator's Aurora restore point before mutation. Application rollback uses the last known-good immutable descriptor where active, or the explicitly recorded compatibility artifact path while the pre-EA-028 bootstrap remains; database restore is not an ordinary application rollback and requires separate approval because of data-loss risk.

## Failure, unavailable, and cleanup handling

- Do not delete or edit failed evidence. Its checksum intentionally makes edits detectable.
- A missing credential, expired token, unavailable browser, unreachable DEV MySQL, AWS denial, absent fixture, disabled script, or missing rollback artifact is `unavailable`/failed and therefore `NO-GO`.
- An authenticated request that does not finish is a failed journey even if `/readyz` is green. Live smoke HTTP response bodies must have bounded timeouts, and fixture cleanup must run in `finally` so a hung or failed journey cannot strand TEST identities/data.
- Do not convert a required check to optional during a release. Change the reviewed inventory in a separate code change, add replacement evidence, and rerun DEV.
- Fix product/test infrastructure, clean fixtures, or obtain the missing approved account; then rerun the complete affected stage against the unchanged candidate.
- If source, migrations, inventory, operations, runtime payload, or release ID changes, start again at DEV qualification.
- Keep maintenance active while deployed TEST is unhealthy. If recovery requires redeploying a prior TEST artifact, record that action and generate a new DEV/deployment/TEST chain before PROD consideration.
- If preflight fails before artifact upload or deployment and the existing TEST applications remain healthy, restore normal forwarding and clear the warning immediately; repair locally, regenerate exact-source DEV evidence, and schedule a fresh maintenance window before retrying.

## July 13 systemic failure closure

The July 13 incident is treated as a release-system defect, not an isolated bad column name. The former sequence admitted a release even though unit/composition checks used injected dependencies, TEST carried the same defect, `/readyz` asserted less than authenticated middleware, deployed signed-in journeys were not run, and configuration-dependent paths could remain unproven.

This gate closes those failure modes by using one exported admin schema contract for readiness and staff hydration, running that contract against real MySQL, requiring deployed authenticated role/applicant journeys, verifying source and config on the instance, treating TEST as evidence rather than a transit stop, and making the final TEST decision a prerequisite enforced by the PROD deploy command.
