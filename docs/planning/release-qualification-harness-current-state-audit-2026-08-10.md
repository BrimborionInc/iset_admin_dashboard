# Release Qualification Harness Current-State Audit

Status: Sprints `0A`, `0B`, `0C`, and `0D`, including the Sprint `0B` severity correction, are complete;
Phase 0 deliverables are complete pending Bill's review, and Phase 1 is not authorized.

Date: 2026-08-10

Controlling plan: [Release Qualification Harness Rebuild Plan](./release-qualification-harness-rebuild-plan-2026-08-10.md)

## Sprint 0A Boundary

Sprint `0A` inventories the current qualification entry points, declared checks,
invoked runners, evidence artifacts, and repository/file ownership. It is a
source inventory only.

This sprint did not classify any component, map runtime dependencies or effects,
map environment or cleanup ownership, assign test levels, analyze the `r3-r34`
history, propose an architecture, or repair anything. No test, build, browser,
SQL, database, AWS, deployment, fixture, TEST, or PROD operation was run.

## Confirmed Qualification Inventory

### Control Inputs

| Input | Ownership and role | Exact source |
| --- | --- | --- |
| Coverage inventory | Admin-owned machine-readable repository, operation, always-required check, check-command, and domain declaration | `docs/testing/release-coverage-inventory.json:1-63`; documentation pointer at `docs/testing/README.md:7-11` |
| Qualification library | Admin-owned inventory validation, check selection, source hashing, evidence identity, and evidence validation functions | `src/lib/releaseQualification.js:7-90`, `src/lib/releaseQualification.js:122-149`, `src/lib/releaseQualification.js:165-210` |
| Repository registry | Central qualifier paths for admin, portal, shared, and Intacct mock | `scripts/path-release-qualify.js:21-28`; matching inventory declarations at `docs/testing/release-coverage-inventory.json:4-9` |

### Qualification Entry Points

| Entry point | Recorded behavior | Exact source |
| --- | --- | --- |
| `npm run release:qualify` | Package alias for the central qualifier | `package.json:143` |
| `release:qualify -- plan` | Resolves and emits the candidate domains and required checks; JSON output is optional | `scripts/path-release-qualify.js:30-53`, `scripts/path-release-qualify.js:423-454`; documented invocation at `docs/ops/deployments/release-qualification-runbook.md:82-103` |
| `release:qualify -- run` | Runs the resolved checks and writes qualification evidence | `scripts/path-release-qualify.js:352-405`, `scripts/path-release-qualify.js:457-464`; DEV invocation at `docs/ops/deployments/release-qualification-runbook.md:141-149`, TEST invocation at `docs/ops/deployments/release-qualification-runbook.md:245-256` |
| `release:qualify -- validate` | Validates existing evidence against its declared stage and current source/inventory/schema fingerprints | `scripts/path-release-qualify.js:407-420`, `scripts/path-release-qualify.js:441-446`; `src/lib/releaseQualification.js:177-210`; documented DEV invocation at `docs/ops/deployments/release-qualification-runbook.md:164-170` and TEST invocation at `docs/ops/deployments/release-qualification-runbook.md:274-280` |
| TEST qualification input admission | TEST planning requires a DEV evidence file and deployment manifest before resolving its inherited candidate | `scripts/path-release-qualify.js:184-208` |
| Deploy admission | `path-deploy` requires qualification evidence and calls the admin-owned evidence admission function before release preflight | `scripts/path-deploy.js:86-112`, `scripts/path-deploy.js:2038-2108`, `scripts/path-deploy.js:2343-2348`; package alias at `package.json:132` |
| `npm run release:test:postflight` | Standalone alias for the TEST postflight runner also selected in three TEST checks | `package.json:144`; runner modes at `scripts/path-test-runtime-postflight.js:12-51`, `scripts/path-test-runtime-postflight.js:255-288` |

The qualifier resolves required checks as the stage's `alwaysRequired` list plus
the checks declared by resolved domains. The selection function is at
`src/lib/releaseQualification.js:122-128`; the current always-required lists are
at `docs/testing/release-coverage-inventory.json:28-61`.

### DEV Checks

The current inventory declares 17 always-required DEV checks.

| Check | Directly invoked runner | Repository/file owner | Exact source |
| --- | --- | --- | --- |
| `inventory-contract` | Internal inventory, command-reference, and unmapped-input check | Admin; `scripts/path-release-qualify.js` | `docs/testing/release-coverage-inventory.json:64-70`; `scripts/path-release-qualify.js:237-255` |
| `admin-aggregate` | `npm test` -> `node scripts/run-test-all.js` | Admin | `docs/testing/release-coverage-inventory.json:78-85`; `package.json:81-85` |
| `portal-aggregate` | Portal `npm test` -> `node scripts/run-test-all.js` | Portal | `docs/testing/release-coverage-inventory.json:86-93`; `../ISET-intake/package.json:56-60` |
| `admin-lint` | `npm run lint -- --quiet` -> ESLint over `src` | Admin | `docs/testing/release-coverage-inventory.json:94-101`; `package.json:94` |
| `portal-lint` | Portal `npm run lint -- --quiet` -> ESLint over `src` | Portal | `docs/testing/release-coverage-inventory.json:102-109`; `../ISET-intake/package.json:61` |
| `privacy-route-static` | `node scripts/privacy-route-scope-smoke.js` through npm | Admin | `docs/testing/release-coverage-inventory.json:110-117`; `package.json:99` |
| `real-mysql-schema-preflight` | `node scripts/real-mysql-release-contract.js --target-env dev --schema-preflight-only --json` | Admin | `docs/testing/release-coverage-inventory.json:118-125` |
| `schema-plan-dev` | `node scripts/path-schema-migrate.js plan --target-env dev` through npm | Admin | `docs/testing/release-coverage-inventory.json:126-133`; `package.json:123-125` |
| `real-mysql-contract` | `node scripts/real-mysql-release-contract.js --target-env dev --json` | Admin | `docs/testing/release-coverage-inventory.json:134-141` |
| `admin-build` | `node scripts/release-build-contract.js --admin` | Admin | `docs/testing/release-coverage-inventory.json:142-149` |
| `portal-build` | `node scripts/release-build-contract.js --portal` | Admin wrapper invoking portal-owned build entry points | `docs/testing/release-coverage-inventory.json:150-157`; `scripts/release-build-contract.js:67-81` |
| `admin-browser-suite` | `node scripts/release-browser-smoke-suite.js --json` | Admin | `docs/testing/release-coverage-inventory.json:158-165` |
| `privacy-erm-db` | `npx env-cmd -f .env node scripts/privacy-erm-smoke.js --json` | Admin | `docs/testing/release-coverage-inventory.json:166-173` |
| `payment-db-rollback` | `node scripts/payments-workflow-smoke.js` through npm | Admin | `docs/testing/release-coverage-inventory.json:174-181`; `package.json:87-89` |
| `intacct-local-contract` | `node scripts/intacct-contract-audit.js` through npm | Admin audit over declared PATH/mock source | `docs/testing/release-coverage-inventory.json:182-189`; `package.json:97`; `scripts/intacct-contract-audit.js:6-13`, `scripts/intacct-contract-audit.js:37-79` |
| `ai-guidance-contract` | `node scripts/admin-ai-eval-fixtures-check.js` through npm | Admin | `docs/testing/release-coverage-inventory.json:190-197`; `package.json:121-122` |
| `candidate-source-stability` | Internal repository re-fingerprint | Admin; `scripts/path-release-qualify.js` | `docs/testing/release-coverage-inventory.json:71-77`; `scripts/path-release-qualify.js:293-304` |

### TEST Checks

The current inventory declares 12 always-required TEST checks. The source
stability check is the same unique check used at both stages, so the inventory
contains 28 unique check IDs in total.

| Check | Directly invoked runner | Repository/file owner | Exact source |
| --- | --- | --- | --- |
| `test-deployment-provenance` | Internal DEV-evidence/deployment-manifest comparison | Admin; `scripts/path-release-qualify.js` | `docs/testing/release-coverage-inventory.json:198-204`; `scripts/path-release-qualify.js:257-273` |
| `test-rollback-readiness` | Internal deployment-manifest artifact check | Admin; `scripts/path-release-qualify.js` | `docs/testing/release-coverage-inventory.json:205-211`; `scripts/path-release-qualify.js:274-292` |
| `test-target-health` | `node scripts/path-deploy.js smoke --env test` through npm | Admin | `docs/testing/release-coverage-inventory.json:212-219`; `package.json:132-134` |
| `test-runtime-postflight` | `node scripts/path-test-runtime-postflight.js --json` | Admin | `docs/testing/release-coverage-inventory.json:220-227` |
| `test-two-step-role-journeys` | `node scripts/two-step-review-test-smoke.js --profile nwac-test --region ca-central-1 --json` | Admin | `docs/testing/release-coverage-inventory.json:228-235` |
| `test-intake-completion` | `node scripts/r1-intake-completion-test-smoke.js --profile nwac-test --region ca-central-1 --json` | Admin | `docs/testing/release-coverage-inventory.json:236-243` |
| `test-cfa-signing` | `node scripts/cfa-signing-test-smoke.js --profile nwac-test --region ca-central-1 --json` | Admin wrapper; deployed child runner is portal-owned | `docs/testing/release-coverage-inventory.json:244-251`; `scripts/cfa-signing-test-smoke.js:175-192`, `scripts/cfa-signing-test-smoke.js:227-280` |
| `test-applicant-scope-browser` | `node scripts/applicant-scope-guard-test-smoke.js --profile nwac-test --region ca-central-1 --json` | Admin | `docs/testing/release-coverage-inventory.json:252-259` |
| `test-live-privacy-denials` | Same applicant-scope runner with `--privacy-denials --skip-browser --json` | Admin | `docs/testing/release-coverage-inventory.json:260-267` |
| `test-payment-rollback` | `node scripts/path-test-runtime-postflight.js --payment-rollback --json` | Admin | `docs/testing/release-coverage-inventory.json:268-275`; mode parser at `scripts/path-test-runtime-postflight.js:31-51` |
| `test-maintenance-cleanup` | `node scripts/path-test-runtime-postflight.js --maintenance-only --json` | Admin | `docs/testing/release-coverage-inventory.json:276-283`; mode parser at `scripts/path-test-runtime-postflight.js:31-51` |
| `candidate-source-stability` | Internal repository re-fingerprint | Admin; `scripts/path-release-qualify.js` | `docs/testing/release-coverage-inventory.json:71-77`; `scripts/path-release-qualify.js:293-304` |

### Runner Expansion

This section records only explicit runner-to-runner invocation visible in source.
It does not assign dependencies, effects, cleanup ownership, or test levels.

| Invoking runner | Explicitly invoked runner(s) | Exact source |
| --- | --- | --- |
| Central qualifier | Internal checks or the inventory command array in the command's repository cwd | `scripts/path-release-qualify.js:249-305`, `scripts/path-release-qualify.js:308-343`, `scripts/path-release-qualify.js:352-380` |
| Admin aggregate | React Scripts frontend test runner, then Jest with `tests/jest.config.js` | `scripts/run-test-all.js:9-25`, `scripts/run-test-all.js:27-38`; alias contract at `tests/testAllContract.test.js:11-20` |
| Portal aggregate | CRACO frontend test runner, then Node's native test runner over discovered `.test.js` files beneath `auth`, `notifications`, and `routes` | `../ISET-intake/scripts/run-test-all.js:10-21`, `../ISET-intake/scripts/run-test-all.js:24-59`; alias at `../ISET-intake/package.json:56-60` |
| Release build contract | Admin `npm run build:test`, or portal `scripts/write-build-info.js` followed by CRACO build | `scripts/release-build-contract.js:43-81`; admin alias at `package.json:76-79`; portal writer entry at `../ISET-intake/scripts/write-build-info.js:64-122` |
| Admin browser suite | One admin TEST-target build followed by 13 named browser-smoke scripts | child list at `scripts/release-browser-smoke-suite.js:14-28`; invocation at `scripts/release-browser-smoke-suite.js:127-169` |
| CFA TEST wrapper | Deployed portal `scripts/cfa-signing-smoke.js`, first in identity mode and then in its full mode | `scripts/cfa-signing-test-smoke.js:192`, `scripts/cfa-signing-test-smoke.js:227-280`; portal CLI/entry at `../ISET-intake/scripts/cfa-signing-smoke.js:55-100`, `../ISET-intake/scripts/cfa-signing-smoke.js:676-680` |
| TEST postflight | The same runner exposes full, payment-rollback, and maintenance-only modes selected by three inventory checks | `scripts/path-test-runtime-postflight.js:12-51`, `scripts/path-test-runtime-postflight.js:255-288` |

The browser suite's 13 explicitly named child runners are:

1. `scripts/app-shell-navigation-browser-smoke.js`
2. `scripts/esdc-participant-queue-browser-smoke.js`
3. `scripts/case-assignment-dashboard-browser-smoke.js`
4. `scripts/home-overdue-queue-browser-smoke.js`
5. `scripts/manual-application-intake-browser-smoke.js`
6. `scripts/manage-components-dashboard-browser-smoke.js`
7. `scripts/modify-component-editor-browser-smoke.js`
8. `scripts/application-overview-docs-requested-browser-smoke.js`
9. `scripts/application-workspace-dashboard-browser-smoke.js`
10. `scripts/application-assessment-workflow-browser-smoke.js`
11. `scripts/intervention-posting-context-browser-smoke.js`
12. `scripts/intervention-assessment-recall-browser-smoke.js`
13. `scripts/intervention-assessment-workflow-browser-smoke.js`

Source for the complete list and invocation is
`scripts/release-browser-smoke-suite.js:14-28,127-169`.

### Evidence Artifacts

| Artifact | Producer/consumer and recorded shape | Declared or retained location | Exact source |
| --- | --- | --- | --- |
| Qualification plan output | `plan` emits text or JSON; no default plan-file writer is declared | Standard output | `scripts/path-release-qualify.js:423-454` |
| DEV or TEST qualification evidence | `run` records schema version, timestamps/expiry, stage, release ID, decision, inventory hash, domains, changed files, operations, candidate, required checks, results, blockers, and `evidenceId` | Default `tmp/release-qualification/<stage>/<release-id>--<timestamp>.json`; overridable with `--evidence-out` | `scripts/path-release-qualify.js:346-350`, `scripts/path-release-qualify.js:382-404` |
| Per-command logs | Combined stdout/stderr, with path and SHA-256 recorded in the parent evidence result | `<evidence-path>.logs/<check-id>.log` | `scripts/path-release-qualify.js:308-343`, `scripts/path-release-qualify.js:352-355` |
| Internal-check results | Structured `details` or `error` embedded in the parent evidence; no separate command log is written | Qualification evidence JSON | `scripts/path-release-qualify.js:357-379` |
| DEV evidence used by TEST | TEST qualification reads an admitted DEV qualification JSON | User-supplied `--dev-evidence` path | `scripts/path-release-qualify.js:184-208` |
| Deployment manifest used by TEST and deploy admission | `path-deploy` writes a release manifest; TEST qualification reads it for two internal checks | `tmp/path-deploy/<environment>/<release-id>--<timestamp>.json` | writer at `scripts/path-deploy.js:502-518`; qualification readers at `scripts/path-release-qualify.js:257-292` |
| Deployment-manifest step records | Manifest steps record name, status, timestamps, duration, and result or error; qualification admission and packaging preflight are retained as manifest sections | Parent deployment manifest JSON | step writer at `scripts/path-deploy.js:521-546`; qualification admission at `scripts/path-deploy.js:2038-2108`; packaging preflight at `scripts/path-deploy.js:2136-2185` |
| Candidate and prior-artifact records | TEST manifest application-artifact sections record the candidate and prior artifact references produced by the deploy runner | `appApply.artifacts.admin` and/or `appApply.artifacts.portal` inside the deployment manifest | `scripts/path-deploy.js:943-958`, `scripts/path-deploy.js:1309-1394`, `scripts/path-deploy.js:1402-1489` |
| Packaged release provenance | The deploy runner writes a release/source/qualification marker into staged application archives | `.path-release-provenance.json` in the staged admin or portal package root | `scripts/path-deploy.js:867-882`; documented at `docs/ops/deployments/release-qualification-runbook.md:239-241` |
| Release descriptor | Release admission defines a checksum-bearing descriptor referenced by the deployment manifest | `releases/<release-id>/release-descriptor.json` | `scripts/lib/releaseAdmission.js:117-130`; `scripts/path-deploy.js:992-1002` |
| Prebuilt bundle manifest | Build-manifest entry point records generated build information and asset hash/count | `build/path-build-manifest.json` in each application tree | `scripts/lib/releaseAdmission.js:5-62`; `scripts/write-build-manifest.js:3-14`; package aliases at `package.json:80` and `../ISET-intake/package.json:55` |
| Two-step detailed runner output | The two-step runner declares separate detailed preflight and journey JSON artifacts | `tmp/two-step-review-test-smoke/<stamp>-<preflight|journey>.json` | `scripts/two-step-review-test-smoke.js:1552-1608` |
| Browser-smoke screenshots | Individual runners define screenshot output beneath runner-specific `tmp/` directories | Current directories include `tmp/esdc-smoke/`, `tmp/case-assignment-smoke/`, `tmp/manual-intake-smoke/`, `tmp/application-assessment-workflow-smoke/`, and the other aggregate child-runner directories | aggregate list at `scripts/release-browser-smoke-suite.js:14-28`; representative path declarations at `scripts/esdc-participant-queue-browser-smoke.js:15`, `scripts/manual-application-intake-browser-smoke.js:16`, `scripts/application-assessment-workflow-browser-smoke.js:21` |
| Temporary qualification bundles | The build and browser wrappers declare isolated admin/portal build paths | `tmp/release-qualification/admin-build-contract`, `portal-build-contract`, and `admin-browser-build` | `scripts/release-build-contract.js:43-52`; `scripts/release-browser-smoke-suite.js:9-13` |
| Runtime-postflight report | Postflight emits its structured report to standard output; the qualifier retains that output in the corresponding check log | Qualification log for `test-runtime-postflight`, `test-payment-rollback`, or `test-maintenance-cleanup` | `scripts/path-test-runtime-postflight.js:255-283`; check declarations at `docs/testing/release-coverage-inventory.json:220-227`, `docs/testing/release-coverage-inventory.json:268-282` |
| Operational retention set | Runbook identifies qualification JSON, sibling logs, and deployment manifests as the retained set | `tmp/release-qualification/<stage>/` and `tmp/path-deploy/<environment>/` | `docs/ops/deployments/release-qualification-runbook.md:47-59` |

The read-only retained-artifact snapshot found 56 DEV and 34 TEST qualification
JSON files, 198 TEST and 139 PROD deployment manifests, and 58 detailed two-step
JSON files. Representative paths were
`tmp/release-qualification/dev/20260810-two-step-review-assurance-r33.json`,
`tmp/release-qualification/test/20260809-two-step-review-assurance-r31.json`, and
`tmp/path-deploy/test/20260809-two-step-review-assurance-r31--2026-08-10T03-24-21-698Z.json`.
Their sibling logs and the other declared `tmp/` artifacts were also present.
Sprint `0A` recorded only their presence and shape; it did not classify outcomes
or analyze the release-attempt history. The generated `tmp/` roots are ignored
by Git at `.gitignore:52-53`.

### Repository and File Ownership

| Repository | Qualification ownership recorded in Sprint 0A | Exact source |
| --- | --- | --- |
| `admin-dashboard` | Owns the central qualifier, coverage inventory, qualification library, deploy admission, evidence paths, every internal check, all direct command wrappers except the portal aggregate/lint commands, and the documentation control surface | `scripts/path-release-qualify.js:9-28`, `scripts/path-release-qualify.js:237-420`; `docs/testing/release-coverage-inventory.json:63-283`; `scripts/path-deploy.js:2038-2108` |
| `ISET-intake` | Owns the portal aggregate and lint package entry points, portal aggregate runner, portal build-info writer, and deployed CFA child runner | `../ISET-intake/package.json:48-62`; `../ISET-intake/scripts/run-test-all.js:10-59`; `../ISET-intake/scripts/write-build-info.js:64-122`; `../ISET-intake/scripts/cfa-signing-smoke.js:55-100`, `../ISET-intake/scripts/cfa-signing-smoke.js:676-680` |
| `shared` | Is registered and fingerprinted as source. It has no `package.json` and no direct inventory command with `cwd: shared`. Its repository instructions identify it as shared PATH runtime code for admin and portal. | registry at `scripts/path-release-qualify.js:23-27`; DEV candidate fingerprinting at `scripts/path-release-qualify.js:210-215`; `../../../shared/AGENTS.md:11-15` |
| `intacct-mock-service` | Is registered in the inventory. The admin-owned Intacct audit inspects declared mock/PATH source; the mock package itself declares only `npm start`, not a test runner. The qualifier contains explicit non-Git fingerprint handling for this directory. | `docs/testing/release-coverage-inventory.json:4-9`, `docs/testing/release-coverage-inventory.json:182-188`; `scripts/intacct-contract-audit.js:37-79`; `../intacct-mock-service/package.json:1-15`; `scripts/path-release-qualify.js:109-124` |

## Suspected Findings

These are observations requiring later analysis, not confirmed defects and not
repair authorizations.

- Shared contains `applicationAssessmentReviewState.test.js`, a native
  `node:test` definition at `../shared/applicationAssessmentReviewState.test.js:1-11`.
  No current package or direct qualifier runner was found for it. Whether that is
  intentional ownership or missing coverage is unresolved.
- The qualifier's ordinary changed-file collection enumerates admin, portal, and
  shared; its Intacct mock file population is a special `--full` branch.
  `scripts/path-release-qualify.js:144-160` confirms the mechanics. The intended
  qualification treatment of an ordinary Intacct mock change is unresolved.
- Portal declares a standalone `smoke:portal:workflow` package alias at
  `../ISET-intake/package.json:73`; no current coverage-inventory check invokes
  that alias. Its intended qualification status is unresolved.
- `tmp/release-qualification/test/cleanup-20260713-hung-scope-fixtures.sql`
  exists beside the retained qualification JSON, while the qualifier's declared
  writer produces JSON and sibling log files. Its contents were not read and its
  origin and role remain unresolved.

## Unresolved Questions and Risks

- The four suspected findings above require an explicit later audit decision.
- At the Sprint `0A` checkpoint, runtime dependencies, effects, environment
  boundaries, cleanup ownership, and test-level placement remained deliberately
  unexamined. Sprint `0B` records them below.
- The retained attempt history remains deliberately unclassified until Sprint
  `0C`.
- One read-only inspection convenience (`jq`) was unavailable. No rerun or repair
  was attempted; the inventory was recovered from numbered source instead. This
  did not prevent Sprint `0A` completion.

## Files Examined

Central admin control and documentation:

- `docs/AGENTS.md`
- `docs/planning/release-qualification-harness-rebuild-plan-2026-08-10.md`
- `docs/ops/deployments/release-qualification-runbook.md`
- `docs/testing/README.md`
- `docs/testing/release-coverage-inventory.json`
- `package.json`
- `scripts/path-release-qualify.js`
- `src/lib/releaseQualification.js`
- `scripts/path-deploy.js`
- `scripts/lib/releaseAdmission.js`
- `scripts/write-build-manifest.js`

Admin-owned invoked runners and runner definitions:

- `scripts/run-test-all.js`
- `tests/testAllContract.test.js`
- `scripts/release-build-contract.js`
- `scripts/release-browser-smoke-suite.js`
- `scripts/path-test-runtime-postflight.js`
- `scripts/cfa-signing-test-smoke.js`
- `scripts/two-step-review-test-smoke.js`
- `scripts/r1-intake-completion-test-smoke.js`
- `scripts/applicant-scope-guard-test-smoke.js`
- `scripts/intacct-contract-audit.js`
- representative browser-smoke output-path declarations

Cross-repository ownership and runners:

- `../ISET-intake/package.json`
- `../ISET-intake/scripts/run-test-all.js`
- `../ISET-intake/craco.config.js`
- `../ISET-intake/scripts/write-build-info.js`
- `../ISET-intake/scripts/cfa-signing-smoke.js`
- current portal test-definition filenames under `src`, `auth`, `notifications`, and `routes`
- `../../../shared/AGENTS.md`
- `../shared/applicationAssessmentReviewState.test.js`
- `../intacct-mock-service/package.json`
- `.gitignore` and `../ISET-intake/.gitignore`
- sampled retained files beneath `tmp/release-qualification/`, `tmp/path-deploy/`, and `tmp/two-step-review-test-smoke/`

## Sprint 0A Completion Decision

Sprint `0A` is complete. The requested qualification inventory is recorded with
source references. Phase 0 is not complete, and no later sprint or implementation
work is authorized by this decision.

That sprint's next-approval condition was satisfied when Bill separately
authorized Sprint `0B`. The result of that bounded sprint follows.

## Sprint 0B Boundary

Sprint `0B` maps the inventoried qualification machinery's test levels, direct
and transitive runners, repository and product boundaries, declared dependencies
and effects, environment selection and proof, lifecycle ownership, and evidence
coupling. This is a source-supported map, not an execution result.

Only committed source, package/configuration declarations, current documentation,
and the Sprint `0A` inventory were inspected. No qualification workflow, test,
build, SQL, database connection, AWS operation, browser, HTTP service,
deployment, fixture, TEST, or PROD action was run. No application, harness, test,
schema, configuration, or environment file was changed. The only authorized
changes were this audit and the controlling plan's checkpoint and ledger.

Sprint `0A` did not require a factual correction for Sprint `0B` to proceed.
The existing-component disposition, `r3-r34` history, target architecture,
interfaces, and repairs remain outside this sprint.

## Control-Plane Dependency and Effect Map

| Entry point or mechanism | Runtime dependencies, reads, and boundaries | Writes, lifecycle, and evidence | Exact source |
| --- | --- | --- | --- |
| `release:qualify -- plan` | Node reads the inventory, invokes local Git, hashes tracked and unignored-untracked files, and hashes migration SQL as bytes. DEV fixes candidate components to admin, portal, and shared. TEST reads supplied DEV evidence, re-fingerprints its inherited components, and reads a supplied deployment-manifest path. | Emits text or JSON to stdout; no plan-file writer is declared. The Git and filesystem inspection is local and does not execute SQL. | `package.json:143`; `scripts/path-release-qualify.js:95-166,177-235,423-454` |
| `release:qualify -- run` | Resolves the same plan and executes required checks sequentially in their declared repository cwd. Command checks inherit the ambient environment plus release/source marker variables. | Creates the log directory, writes one combined stdout/stderr log for each command check, and writes final qualification JSON only after the loop completes. It declares no restoration or cleanup of transitive check effects. | `scripts/path-release-qualify.js:308-405` |
| `release:qualify -- validate` | Reads existing evidence, derives the component set from that evidence, re-fingerprints those local source trees, and checks evidence identity, stage, decision, expiry, inventory hash, migration hash, recorded check statuses, and source state. | Emits validation output only. It does not rerun checks or read the recorded command logs. | `scripts/path-release-qualify.js:407-420,441-446`; `src/lib/releaseQualification.js:165-210` |
| TEST plan admission | Requires DEV evidence and a deployment-manifest path. It validates DEV evidence before constructing the plan, but it does not validate deployment status/provenance/rollback content until those later internal checks run. | Inherits domains, changed files, operations, and candidate components from DEV evidence. | `scripts/path-release-qualify.js:184-208,218-234,257-292` |
| Deploy admission | `path-deploy` reads qualification evidence before deploy preflight. TEST expects DEV evidence; PROD expects TEST evidence. It requires admin, portal, and shared in the admitted candidate and compares release ID and declared operations. | Admission and later deployment steps are retained in the deployment manifest. Deployment itself was not exercised in this sprint. | `scripts/path-deploy.js:2038-2108,2339-2348`; environment registry at `scripts/path-deploy.js:52-78` |
| Check selection | An insertion-ordered set is seeded from the stage's `alwaysRequired` array, then domain checks are appended. Every currently declared domain check is already in its stage's mandatory array. | All 17 DEV and all 12 TEST checks therefore run regardless of changed domain; `candidate-source-stability` is the shared check, for 28 unique IDs. | `src/lib/releaseQualification.js:122-128`; `docs/testing/release-coverage-inventory.json:28-60,285-446` |
| Process runner | Uses synchronous child processes with inherited environment, a 64 MiB output buffer, and no declared timeout, abort signal, signal forwarding, process-group termination, or retry. A failed check is recorded and the loop continues. | Child stdout/stderr is flattened into one log. Result records status, timing, command, log path/hash, error, and exit code, but no failure class, cleanup result, environment identity, or parsed child evidence. | `scripts/path-release-qualify.js:308-343,352-404` |
| Source identity | DEV hashes whole admin, portal, and shared working trees using `git ls-files -co --exclude-standard`; TEST inherits that component set. The same tree fingerprint includes shipped product source, harness, tests, and documentation in each repository. | `candidate-source-stability` repeats those whole-tree hashes at the end. The evidence has no distinct `harnessVersion`, `attemptId`, or `testPackVersions`. | `scripts/path-release-qualify.js:95-132,184-215,293-304,382-404`; required separate identities at `docs/planning/release-qualification-harness-rebuild-plan-2026-08-10.md:54-64` |

No current check declaration supplies `requiredEnv`; the central mechanism exists
but the current inventory relies on inherited environment or runner-specific CLI,
file, AWS, and database checks (`scripts/path-release-qualify.js:308-323`;
`docs/testing/release-coverage-inventory.json:63-283`).

## DEV Check Map

The level column uses only the Sprint `0B` taxonomy. Lint is marked unresolved
because static analysis is not one of the supplied levels. The two aggregate
commands are explicitly mixed because one command spans several levels.

| Check | Test level | Direct/transitive dependencies and boundaries | Declared reads, writes, cleanup, and evidence | Exact source |
| --- | --- | --- | --- | --- |
| `inventory-contract` | Component/contract | Internal inventory validation plus direct-Node script existence and unmapped source/operation checks. Plan construction already depends on Git/filesystem reads across admin, portal, shared, and migration files. | Read-only; result embeds counts. It validates direct `node <file>.js` references but does not traverse npm/npx aliases. | `scripts/path-release-qualify.js:237-255`; `src/lib/releaseQualification.js:31-90` |
| `admin-aggregate` | Mixed unit, component/contract, integration, local system | `npm test` -> admin aggregate -> React Scripts tests, then Node-environment Jest over `tests/**/*.test.js`. Suites include injected/fake dependencies, loopback Express servers, cross-repository source reads, Bash/Node child probes, and system `unzip`. | Wrapper sets `BABEL_ENV=NODE_ENV=test` and `CI=true`, otherwise inherits ambient environment. Cleanup is owned per suite; no aggregate timeout, cancellation, sandbox, or residue assertion exists. One opaque qualifier log covers both phases. | `package.json:81-85`; `scripts/run-test-all.js:9-38`; `tests/jest.config.js:3-14`; representative effects at `tests/fullExpressStack.test.js:24-113`, `tests/localDevLaunchers.test.js:8-35`, `scripts/path-deploy.js:885-929` |
| `portal-aggregate` | Mixed unit, component/contract, integration, local system | Portal `npm test` -> CRACO frontend tests, then Node's test runner over recursively discovered tests below `auth`, `notifications`, and `routes`. Backend suites use injected stores/fake pools and loopback HTTP; shared runtime modules are imported directly. | Same inherited environment with test/CI overrides. Individual suites own server, mock, and environment restoration; there is no aggregate-level timeout, cancellation, or residue proof. | `../ISET-intake/package.json:56-60`; `../ISET-intake/scripts/run-test-all.js:10-59`; representative effects at `../ISET-intake/routes/__tests__/intakeComplete.test.js:270-339`, `../ISET-intake/routes/__tests__/s3Provider.test.js:4-32` |
| `admin-lint` | Explicitly unresolved | `npm run lint -- --quiet` -> ESLint 8.57.1 over admin `src` JS/JSX. Server, scripts, and backend tests are outside the declared lint root. | No `--fix` or explicit cache flag. Source declares read-only; external cache behavior and runner defaults are unresolved. | `package.json:94`; `.eslintrc.cjs:1-16`; `package-lock.json:17262-17272` |
| `portal-lint` | Explicitly unresolved | Portal ESLint 8.57.1 over portal `src` JS/JSX; portal server, auth, notifications, and routes are outside that root. | Same inherited environment and unresolved external cache/default behavior as admin lint. | `../ISET-intake/package.json:61,82-86`; `../ISET-intake/package-lock.json:12644-12654` |
| `privacy-route-static` | Component/contract | Node scans fixed source windows in the admin server, portal server, and admin coordinator widget for required/forbidden strings. It does not execute routes. | Local filesystem reads only; no HTTP, SQL, DB, AWS, browser, write, or cleanup. Its deliberate-removal tests execute separately inside `admin-aggregate`. | `scripts/privacy-route-scope-smoke.js:11-45,47-158,882-930`; `tests/privacyRouteScopeSmoke.test.js:4-10,43-63` |
| `real-mysql-schema-preflight` | Integration | Direct runner depends on `mysql2`, the live schema guard, admin runtime-schema declarations, portal schema-readiness declarations, and financial-document policy source. `--target-env dev` selects the runner's exact configured/live DEV identity. | Opens MySQL and performs identity and metadata-only queries. Schema-only mode performs zero ordinary statements. The connection closes in `finally`; no query/overall timeout or cancellation is declared. Structured schema evidence reaches the qualifier log. | `scripts/real-mysql-release-contract.js:4-35,102-154,619-651,708-735`; `scripts/lib/live-mysql-schema-guard.js:1001-1042` |
| `schema-plan-dev` | Integration | npm alias -> `path-schema-migrate.js plan` -> shared migration runner/live schema guard. Reads canonical admin migrations, admin ops/archive paths, retired portal migrations, exact DEV identity/DDL, and the optional ledger. | Hashes local SQL bytes and performs metadata plus guarded ledger reads; plan mode performs no migration/ledger write. Pool closes in `finally`. The mandatory non-JSON rendering omits the schema identity evidence contained in the internal plan object. | `package.json:123-125`; `scripts/path-schema-migrate.js:161-197,216-249,404-417,672-721`; `src/lib/sharedSchemaMigrationRunner.js:106-157,170-214,233-274` |
| `real-mysql-contract` | Integration | Same runner/guard as preflight, then runtime-readiness, staff/import/event-delivery, and financial-policy contracts over the exact DEV target. | After metadata preflight, performs guarded reads and transactional synthetic inserts/updates. Success rolls back and runs eight zero-residue reads; post-mutation failure attempts rollback/residue evidence; connection closes in `finally`. No HTTP, AWS, browser, provider, or object-store path is invoked. | `scripts/real-mysql-release-contract.js:258-616,619-705,708-741`; `scripts/lib/live-mysql-schema-guard.js:1045-1067` |
| `admin-build` | Component/contract | Wrapper -> `npm run build:test` -> build-info writer -> `.env.test` via `env-cmd` -> React Scripts. Reads package/Git/release-note inputs. | Forces a TEST-labelled local build and isolated `BUILD_PATH`; writes a temporary bundle plus two tracked generated files. Wrapper snapshots/restores both generated files and removes temporary output in `finally`. The TEST label is not deployed-environment identity proof. | `scripts/release-build-contract.js:34-65,83-89`; `package.json:76-79`; `scripts/write-build-info.js:199-208,258-286` |
| `portal-build` | Component/contract | Admin wrapper invokes portal build-info writer, then `.env.test`/CRACO build in the portal repository. | Writes isolated build output and portal generated metadata. Wrapper restores only portal `buildInfo.js` and temporary output; the transitive writer also writes tracked `publicBuildInfo.js`. No deployed identity proof occurs. | `scripts/release-build-contract.js:43-50,67-88`; `../ISET-intake/scripts/write-build-info.js:8-12,64-118` |
| `admin-browser-suite` | Local system | Builds admin, serves the compiled bundle on loopback, and sequentially spawns all 13 Puppeteer children. Each receives the loopback frontend base and intercepts API requests with synthetic identity/state. | Local server/build cleanup and generated admin metadata restoration occur in the suite `finally`. Child screenshots remain in runner-specific `tmp/` roots. Child JSON is flattened into one qualifier log and is not parsed or separately linked. | `scripts/release-browser-smoke-suite.js:9-28,59-80,105-180`; `scripts/path-release-qualify.js:308-343` |
| `privacy-erm-db` | Smoke with integration dependency | `env-cmd -f .env` -> Node/MySQL/live-schema guard. Runner requires configured DEV values and then proves exact live identity/schema. | Count-only guarded DEV relational/privacy reads; no mutation, HTTP, AWS, browser, or fixture. Connection closes in `finally`; no explicit overall/query timeout or cancellation. | `scripts/privacy-erm-smoke.js:4-21,283-315,347-576,600-617` |
| `payment-db-rollback` | Smoke with integration dependency | npm alias invokes the no-flag DB rollback mode. Effective DB configuration is derived from `.env`/`process.env`; source does not establish precedence. The runner allowlists exact DEV and exact TEST identities. | Preflights, selects an environment-owned code, starts a transaction, creates payment/evidence/communication/follow-up fixtures, rolls back, and counts residue. No API/browser/email/provider path is selected. Human success output omits target/schema and residue counts contained in the internal result. | `package.json:87`; `scripts/payments-workflow-smoke.js:21-25,38-71,124-174,214-264,743-827,1484-1509,1512-1604` |
| `intacct-local-contract` | Component/contract | Admin audit reads its manifest and literal source strings in admin and Intacct mock. External Sage references are data only. | Local read-only source inspection; no service, HTTP, DB, AWS, identity, write, or cleanup. Mock source is a transitive input outside the DEV candidate component set. | `scripts/intacct-contract-audit.js:6-13,37-92`; `docs/data/integrations/intacct-interface-fidelity-manifest.json:3-5,44-208`; `scripts/path-release-qualify.js:210-215` |
| `ai-guidance-contract` | Component/contract | Reads the default admin JSON fixture and validates required shapes, unique IDs, and allowed status values. | No application-guidance execution, model/network call, write, or cleanup. It does not resolve recorded source references or compare expected anchors with model output. | `scripts/admin-ai-eval-fixtures-check.js:6-19,22-90`; `package.json:121-122` |
| `candidate-source-stability` | Component/contract | Internal final re-fingerprint of the plan's candidate components. DEV checks fixed admin/portal/shared; TEST checks the DEV-inherited set. | Local Git/filesystem reads only; details are embedded in final evidence. It is currently last by inventory order, but that position is not an inventory invariant. | `scripts/path-release-qualify.js:184-215,293-304`; `src/lib/releaseQualification.js:122-128`; `docs/testing/release-coverage-inventory.json:28-60` |

## Browser Child Dependency and Cleanup Map

All 13 children are local-system smokes against the loopback compiled admin
bundle. Their API identity and state are synthetic; none declares SQL, database,
AWS, deployed TEST, provider, or email effects. Except for app-shell navigation,
they declare screenshot writes. This common runner chain is established at
`scripts/release-browser-smoke-suite.js:9-28,127-169`.

| Child | Product surface and effects | Timeout, shutdown, and residue evidence |
| --- | --- | --- |
| `app-shell-navigation` | Shell/sidebar navigation with stubbed APIs | 45-second page timeout; browser closes in `finally`; no screenshot (`scripts/app-shell-navigation-browser-smoke.js:94-180,237-294,306-364`). |
| `esdc-participant-queue` | Participant queue and prepare/submit requests mutate in-memory state; screenshot writes | 45-second page timeout; browser closes only on the normal path (`scripts/esdc-participant-queue-browser-smoke.js:156-305,353-473`). |
| `case-assignment-dashboard` | Assignment/search/bucket behavior with stubbed APIs; screenshot writes | 45-second page timeout plus bounded waits; browser closes only on the normal path (`scripts/case-assignment-dashboard-browser-smoke.js:267-383,456-729`). |
| `home-overdue-queue` | Resolve/reassign requests recorded in memory; screenshot writes | 45-second page timeout and bounded waits; browser closes in `finally` (`scripts/home-overdue-queue-browser-smoke.js:165-299,479-669`). |
| `manual-application-intake` | Create-application payload retained in JS state; screenshot writes | 45-second page timeout; browser closes in `finally` (`scripts/manual-application-intake-browser-smoke.js:169-334,389-524`). |
| `manage-components-dashboard` | Component preview is generated in memory; screenshot writes | 45-second page timeout; browser closes only on the normal path (`scripts/manage-components-dashboard-browser-smoke.js:169-275,349-617`). |
| `modify-component-editor` | Save/render/validate request bodies retained in memory; screenshot writes | 45-second page timeout; browser closes only on the normal path (`scripts/modify-component-editor-browser-smoke.js:571-735,782-991`). |
| `application-overview-docs-requested` | Optimistic-lock PUT mutates JS state; diagnostics/screenshot writes | 45-second page timeout; selected wait failures close explicitly, but no encompassing `finally` owns other exceptions (`scripts/application-overview-docs-requested-browser-smoke.js:195-270,393-581`). |
| `application-workspace-dashboard` | Widget/lock/document/message/note requests use stub state; screenshot writes | 60-second page timeout; browser closes only on the normal path (`scripts/application-workspace-dashboard-browser-smoke.js:350-545,636-797`). |
| `application-assessment-workflow` | Fourteen role/state assessment journeys mutate stub case/review/message state; screenshot writes | 60-second page timeout; scenario pages and shared browser close in `finally` (`scripts/application-assessment-workflow-browser-smoke.js:758-1011,1233-1910,1913-2019`). |
| `intervention-posting-context` | PATCH retained in JS state; screenshot writes | 60-second page timeout; page/browser close in `finally` (`scripts/intervention-posting-context-browser-smoke.js:214-401,506-651`). |
| `intervention-assessment-recall` | Recall POST mutates JS state; screenshot writes | 60-second page timeout; page/browser close in `finally` (`scripts/intervention-assessment-recall-browser-smoke.js:300-478,572-666`). |
| `intervention-assessment-workflow` | Proposal/revision/review/sign-off/follow-up scenarios mutate stub state; screenshot writes | 60-second page timeout; pages/browser close in `finally`. Ambient `INTERVENTION_ASSESSMENT_WORKFLOW_SMOKE_SCENARIOS` can narrow the scenario list (`scripts/intervention-assessment-workflow-browser-smoke.js:88-128,590-856,1383-1438,1442-1864`). |

## TEST Check Map

All TEST checks are mandatory and run in the order shown. Planning validates DEV
evidence first, but the command loop continues after any check failure
(`docs/testing/release-coverage-inventory.json:48-60`;
`scripts/path-release-qualify.js:184-208,352-404`).

| Check | Test level | Direct/transitive dependencies and environment proof | Effects, cleanup, and evidence | Exact source |
| --- | --- | --- | --- | --- |
| `test-deployment-provenance` | Component/contract | Internal local read of DEV evidence and deployment manifest; compares manifest success/release/evidence ID and candidate Git/tree fingerprints. | No AWS/artifact/deployed target access. Details are embedded in parent evidence. | `scripts/path-release-qualify.js:257-273` |
| `test-rollback-readiness` | Component/contract | Internal local manifest read for deployed admin/portal candidate and prior-artifact URI strings. | No artifact existence, checksum, version, access, or recoverability query. URIs are embedded in parent evidence. | `scripts/path-release-qualify.js:274-291` |
| `test-target-health` | Smoke | npm -> `path-deploy.js smoke --env test`; selects fixed TEST profile/region/account and registered admin/portal target groups, proves AWS account with STS, then reads ELB target health. | Read-only local processes and AWS control-plane/network calls; no cleanup. AWS subprocesses have no explicit timeout. Qualifier log is evidence. | `package.json:132-134`; `scripts/path-deploy.js:52-64,293-311,413-423,645-660,1940-1979,2439-2487` |
| `test-runtime-postflight` | Deployed smoke | Local wrapper invokes STS, ASG, SSM, deployed shell, loopback admin/portal readiness, provenance files, PM2, env/runtime config, migration-ledger, runtime-metric, and maintenance helpers. Account is fixed; the operator ARN is recorded rather than fixed. Remote DB helpers prove exact TEST identities. | Read-only AWS, deployed filesystem/process/HTTP, TEST DB, and ALB effects; SSM history remains. Local SSM polling is bounded near 300 seconds but does not cancel the remote command; local/AWS child processes have no timeout. JSON is flattened into the qualifier log. | `scripts/path-test-runtime-postflight.js:6-10,54-183,185-283`; `scripts/path-test-migration-ledger.js:14-22,68-126`; `scripts/path-test-runtime-metrics.js:9-27,57-116`; `scripts/path-maintenance-fallback.js:205-260,300-364` |
| `test-two-step-role-journeys` | Deployed end-to-end | Fixed TEST operator/account/profile/region/ASG/pools/bucket; proves operator, remote instance, AWS, database, pool, and object identities. Uses SSM, Cognito, TEST DB, S3, deployed HTTP, and Puppeteer across admin/portal workflows. | Creates suppressed Cognito users, DB/document/notification/event/object fixtures, sessions, and browser/API effects. Remote cleanup re-resolves DB ownership and proves DB/object/notification residue counts; outer cleanup deletes and proves Cognito/temp-object absence. Local wait is 30 minutes without remote cancellation. Detailed preflight/journey JSON is downloaded/hash-checked and remote versions removed; local evidence remains. | `scripts/two-step-review-test-smoke.js:18-37,1108-1479,1522-1608,1619-1925,2228-2416,2632-2895,3754-3844,7383-8305` |
| `test-intake-completion` | Deployed end-to-end | Wrapper -> remote AWS identity helper -> SSM self-runner -> deployed portal MySQL/S3/completion modules. Fixed TEST account/operator/profile/region, portal env/DB identity, and loopback URL are checked. | Creates one suppressed Cognito applicant plus DB/object/document/event/notification fixtures, then exercises completion/retry. DB/object cleanup re-resolves ownership and proves zero counts; Cognito deletion proves absence. SSM polling is unbounded and has no cancellation. Schema-safety-classified failures can suppress DB/object cleanup after fixture work begins, and no recovery mode is declared. Compact marker flows through SSM output to the qualifier log. | `scripts/r1-intake-completion-test-smoke.js:11-84,217-350,358-385,399-523,566-770,809-875,1106-1346` |
| `test-cfa-signing` | Deployed end-to-end | Admin wrapper -> remote identity helper -> admin schema preflight -> deployed portal CFA runner. The portal child imports an admin two-step schema guard, creating a deployed cross-repository layout dependency. Exact outer and remote TEST AWS/DB identity are checked. | Creates a suppressed Cognito applicant, DB signing fixture, authenticated portal actions, PDF/object/event effects and idempotent retry. Portal child deletes/proves DB/object residue; outer deletes Cognito without read-back. SSM waits and portal fetches have no explicit timeout. JSON passes through SSM to the qualifier log. | `scripts/cfa-signing-test-smoke.js:16-26,103-162,175-294`; `scripts/cfa-signing-schema-preflight.js:8-25,73-114`; `scripts/lib/test-instance-aws-identity.js:5-42`; `../ISET-intake/scripts/cfa-signing-smoke.js:24-31,252-428,515-667` |
| `test-applicant-scope-browser` | Deployed end-to-end | Wrapper -> remote identity helper -> SSM -> deployed portal MySQL/HTTP/Puppeteer. Checks TEST region/bucket/operator, remote identity, portal env, DB identity, then preflights before fixtures. | Creates two suppressed applicants and relational wrong-owner fixtures; exercises API/browser pages. DB cleanup and residue query are mandatory. Cognito deletion warns on non-NotFound failures and performs no absence proof. A remote `/tmp` progress log is appended and not removed. SSM polling is unbounded; HTTP/browser/DB-connect waits are bounded. | `scripts/applicant-scope-guard-test-smoke.js:12-120,266-412,434-609,627-833,845-1184,1305-1778` |
| `test-live-privacy-denials` | Deployed end-to-end | Same applicant wrapper with `--privacy-denials --skip-browser`; creates applicant plus staff identities/fixtures, then invokes the denial child with real tokens and loopback admin/portal URLs. | Makes authenticated denial requests, including mutation-capable POSTs. Shares applicant DB/Cognito/progress cleanup behavior. Tokens are environment inputs and are excluded from compact evidence. Child process and outer SSM wait have no timeout. | `scripts/applicant-scope-guard-test-smoke.js:34-70,471-609,892-1184,1552-1608`; `scripts/privacy-route-denial-smoke.js:79-166,185-373,500-586` |
| `test-payment-rollback` | Integration | Postflight payment mode repeats TEST AWS/instance/maintenance/migration/runtime checks, then runs the DB rollback child on every SSM-online instance. Child allowlists exact DEV/TEST identity and performs guarded transactional payment work. | Synthetic DB transaction only; rollback and residue counts are produced. No API/browser/email/provider path. Postflight has a bounded local SSM wait without remote cancellation; DB connect/query timeouts are undeclared. Nested stdout is retained in postflight JSON and qualifier log. | `scripts/path-test-runtime-postflight.js:109-183,255-283`; `scripts/payments-workflow-smoke.js:1-13,38-122,124-264,743-827,1512-1604` |
| `test-maintenance-cleanup` | Smoke | Postflight maintenance mode still performs AWS identity, ALB maintenance status, ASG/SSM discovery, and guarded TEST DB runtime metrics. | Read-only AWS/ALB/TEST DB inspection; no cleanup. Metric SSM wait is locally bounded without remote cancellation. | `scripts/path-test-runtime-postflight.js:255-264`; `scripts/path-maintenance-fallback.js:205-260,300-364`; `scripts/path-test-runtime-metrics.js:19-27,77-116` |
| TEST `candidate-source-stability` | Component/contract | Re-fingerprints the DEV-inherited local component set after TEST checks. It proves local candidate stability, not deployed target identity. | Local Git/filesystem reads only; result is embedded in final evidence. | `scripts/path-release-qualify.js:95-132,184-208,293-304` |

## Evidence Handoffs and Coupling

| Producer -> consumer | Confirmed handoff and coupling | Exact source |
| --- | --- | --- |
| Command runner -> qualification JSON | Combined stdout/stderr is written and hashed; the parent stores path/hash/status but does not parse child JSON or later re-read the log during validation. | `scripts/path-release-qualify.js:308-343,382-404`; `src/lib/releaseQualification.js:177-210` |
| Internal checks -> qualification JSON | Details/errors are embedded directly and have no sibling log. Final JSON is not written until every check returns. | `scripts/path-release-qualify.js:352-404` |
| DEV evidence -> TEST plan | TEST validates the supplied DEV GO evidence against current local source/inventory/migration hashes, then inherits candidate/domains/operations. | `scripts/path-release-qualify.js:184-234` |
| DEV evidence -> TEST deploy admission | TEST deployment requires DEV qualification; the deploy manifest records its evidence ID and candidate/apply artifacts. | `scripts/path-deploy.js:2038-2108,2274-2284,2320-2348`; manifest writer at `scripts/path-deploy.js:495-546` |
| TEST deployment manifest -> TEST checks | Provenance and rollback-readiness read the manifest locally. Later deployed checks do not consume their result records and still run after either failure. | `scripts/path-release-qualify.js:257-292,352-404` |
| TEST evidence -> PROD admission | PROD deploy admission expects TEST GO evidence and repeats release/operation/source admission checks. | `scripts/path-deploy.js:2038-2108` |
| Browser children -> browser suite -> qualifier | Children inherit stdout/stderr; suite retains only child ID/status/timing in its result; qualifier retains one flat suite log. Screenshots are not hash-linked in qualification evidence. | `scripts/release-browser-smoke-suite.js:151-186`; `scripts/path-release-qualify.js:308-343` |
| Two-step remote -> local wrapper -> qualifier | Detailed remote preflight/journey artifacts are downloaded and hash/size checked, retained locally, and summarized through wrapper JSON/log. | `scripts/two-step-review-test-smoke.js:1552-1608,1799-1819,2228-2318` |

Validation recomputes the parent `evidenceId`, but it trusts the evidence's own
`requiredChecks` list and recorded check entries; it does not recompute the
required set from current domains or verify the retained log bytes against
`logSha256` (`src/lib/releaseQualification.js:165-210`). Standalone validation
also derives required components from the evidence itself, whereas deploy
admission independently requires admin, portal, and shared
(`scripts/path-release-qualify.js:407-420`;
`scripts/path-deploy.js:2038-2108`).

## Lifecycle and Residue Ownership

| Scope | Confirmed owner or gap | Exact source |
| --- | --- | --- |
| Central qualifier | Owns retained logs/final JSON. It declares no timeout, cancellation, interruption record, or transitive cleanup. If a child never returns, final evidence is not written. | `scripts/path-release-qualify.js:308-405` |
| Aggregates | Individual tests own servers, mocks, temp files, and environment restoration. No aggregate-wide cleanup/residue proof exists. | `scripts/run-test-all.js:9-38`; `../ISET-intake/scripts/run-test-all.js:24-59` |
| Build wrappers | Admin wrapper restores both declared generated files and temp output. Portal wrapper does not restore every file written by its child writer. | `scripts/release-build-contract.js:34-89`; `../ISET-intake/scripts/write-build-info.js:99-118` |
| Browser suite | Parent owns build/server/generated metadata. Each child owns its browser; six have no encompassing exceptional-path owner. Screenshots are intentional but have no declared retention owner/period. | `scripts/release-browser-smoke-suite.js:170-177`; child references in the browser map above |
| DEV database runners | Each connection/pool has a close path. Mutating contracts declare rollback/residue behavior only after their own mutation-state conditions. No central timeout/cancellation exists. | `scripts/real-mysql-release-contract.js:546-616,708-735`; `scripts/path-schema-migrate.js:679-721`; `scripts/privacy-erm-smoke.js:600-615`; `scripts/payments-workflow-smoke.js:743-827,1584-1604` |
| TEST remote runners | Cleanup is runner-specific. Two-step has both automatic zero-residue checks and `--cleanup-stamp`; R1 has no recovery mode; CFA/applicant Cognito cleanup lacks full absence proof; SSM history is retained. | `scripts/two-step-review-test-smoke.js:963-1020,7383-8305`; `scripts/r1-intake-completion-test-smoke.js:704-740,1106-1346`; `scripts/cfa-signing-test-smoke.js:155-162`; `scripts/applicant-scope-guard-test-smoke.js:348-363` |

## Confirmed Findings

These are directly evidenced defects or contract/invariant gaps. They are not
repair authorizations and do not classify the affected component's future.

Severity uses the project scale at
`docs/planning/engineering-audit-register.md:55-65`: severity measures
demonstrated impact rather than implementation effort, confidence, scheduling
priority, or a hypothetical worst case. The controlling plan automatically stops
harness work only for a confirmed `critical` security, privacy, data-integrity,
or environment-safety issue
(`docs/planning/release-qualification-harness-rebuild-plan-2026-08-10.md:313-324`).

The resulting distribution is **0 critical, 0 high, 8 medium, and 5 low**. None
triggers the automatic-stop rule.

1. **A DEV check authorizes TEST mutation.**
   **Severity:** `medium`.
   **Realistic impact:** A mandatory DEV check can accept TEST identity and
   perform transactional synthetic payment-fixture writes there. The recorded
   path rolls back and checks residue; the effective target was not inspected,
   and no persistent change, provider/email/API action, PROD reach, or real
   financial action is demonstrated.
   **Evidence:** `docs/testing/release-coverage-inventory.json:174-180`;
   `scripts/payments-workflow-smoke.js:38-71,229-264,743-827,1512-1552`.
   **Automatic stop:** No. This is a practical but contained and recoverable TEST
   environment-binding failure, not a critical-impact path under the scale.
2. **Portal build restoration is incomplete.**
   **Severity:** `low`.
   **Realistic impact:** The wrapper can leave tracked `publicBuildInfo.js`
   changed when the writer's output differs from the prior bytes. Current bytes
   match the package version, so no present content change is demonstrated; the
   impact is conditional local workspace/source-evidence contamination.
   **Evidence:** `scripts/release-build-contract.js:43-50,67-88`;
   `../ISET-intake/scripts/write-build-info.js:8-12,99-118`;
   `../ISET-intake/package.json:1-4`;
   `../ISET-intake/src/generated/publicBuildInfo.js:1-5`.
   **Automatic stop:** No. This is narrow, recoverable restoration debt with no
   current material failure.
3. **Admin aggregate teardown is not complete.**
   **Severity:** `low`.
   **Realistic impact:** The selected Jest suite repeatably leaves three local
   OS-temporary directory trees, causing local residue and eventual cleanup/disk
   cost. No product, deployed environment, or material workflow effect is
   recorded.
   **Evidence:** `tests/jest.config.js:4-6`;
   `tests/releaseAdmission.test.js:18-31,94-101,143-179`;
   `docs/testing/release-coverage-inventory.json:78-85`.
   **Automatic stop:** No. The demonstrated effect is narrow and locally
   recoverable.
4. **Six browser children have no general exceptional-path shutdown.**
   **Severity:** `low`.
   **Realistic impact:** An exception can leave local Chromium cleanup unowned in
   six loopback/synthetic children. Actual post-exit residue was not tested, and
   no deployed, database, AWS, provider, or user-data effect is recorded.
   **Evidence:** `scripts/esdc-participant-queue-browser-smoke.js:293-473`;
   `scripts/case-assignment-dashboard-browser-smoke.js:456-729`;
   `scripts/manage-components-dashboard-browser-smoke.js:349-617`;
   `scripts/modify-component-editor-browser-smoke.js:725-991`;
   `scripts/application-overview-docs-requested-browser-smoke.js:393-581`;
   `scripts/application-workspace-dashboard-browser-smoke.js:636-797`.
   **Automatic stop:** No. The record demonstrates cleanup-design debt, not
   material runtime impact.
5. **Failed TEST prerequisites do not gate later fixture effects.**
   **Severity:** `medium`.
   **Realistic impact:** A run that has already failed provenance, rollback,
   target-health, or runtime prerequisites can still create Cognito, database,
   object, and browser fixture effects in TEST. Blockers are still computed at
   the end, so the recorded path does not establish a false GO, persistent
   residue, or PROD impact.
   **Evidence:** `docs/testing/release-coverage-inventory.json:48-60`;
   `scripts/path-release-qualify.js:352-404`; `docs/AGENTS.md:7-8`.
   **Automatic stop:** No. This is a real multi-resource TEST environment-safety
   failure, but its demonstrated impact remains contained and recoverable rather
   than critical.
6. **Execution is not bounded at the orchestrator.**
   **Severity:** `medium`.
   **Realistic impact:** An external check or specified SSM poll can block
   indefinitely; the orchestrator has no forced child shutdown and may never
   write final evidence. This can stall qualification and require operator
   intervention. Actual unsafe overlap, persistent residue, or production
   unavailability is not demonstrated.
   **Evidence:** `scripts/path-release-qualify.js:308-343`;
   `scripts/r1-intake-completion-test-smoke.js:313-335`;
   `scripts/cfa-signing-test-smoke.js:103-119`;
   `scripts/applicant-scope-guard-test-smoke.js:389-412`;
   `scripts/path-test-runtime-postflight.js:109-144`;
   `scripts/two-step-review-test-smoke.js:1522-1549`;
   `docs/planning/release-qualification-harness-rebuild-plan-2026-08-10.md:89,102-104`.
   **Automatic stop:** No. The confirmed impact is contained harness liveness and
   reliability, not a critical safety event.
7. **Rollback readiness proves only strings, not retained rollback artifacts.**
   **Severity:** `medium`.
   **Realistic impact:** The gate can report rollback readiness from distinct
   nonempty URI strings without proving that usable retained artifacts exist.
   Qualification evidence is therefore materially incomplete. An unusable
   artifact, an actual rollback need, and resulting broad harm were not recorded.
   **Evidence:** `scripts/path-release-qualify.js:274-291`;
   `docs/testing/release-coverage-inventory.json:205-210`.
   **Automatic stop:** No. A critical rollback outcome is a plausible escalation,
   not demonstrated impact in the Sprint `0B` record.
8. **Deployment provenance does not check deployed schema.**
   **Severity:** `medium`.
   **Realistic impact:** Qualification can claim source/schema/release matching
   without inspecting deployed TEST schema; the DEV/current-local migration
   fingerprint cannot substantiate that deployed-schema claim. No actual schema
   drift, workflow failure, or corruption is recorded.
   **Evidence:** `docs/testing/release-coverage-inventory.json:198-203`;
   `scripts/path-release-qualify.js:200-208,257-273`.
   **Automatic stop:** No. Critical corruption or broad failure from schema drift
   remains hypothetical on the existing evidence.
9. **Runtime postflight does not implement its declared recent-error proof.**
   **Severity:** `medium`.
   **Realistic impact:** Runtime postflight can pass without inspecting recent
   application logs/errors, so a declared mandatory assertion has no evidence
   path and active errors could be missed. No actual recent error or affected
   user journey is recorded.
   **Evidence:** `docs/testing/release-coverage-inventory.json:220-226`;
   `scripts/path-test-runtime-postflight.js:167-253`;
   `scripts/path-test-runtime-metrics.js:19-27`.
   **Automatic stop:** No. The demonstrated defect is incomplete release
   evidence, not a critical product incident.
10. **Two deployed checks do not prove declared Cognito zero residue.**
    **Severity:** `medium`.
    **Realistic impact:** CFA deletes without read-back, while applicant-scope can
    downgrade cleanup errors to warnings. Disposable TEST identities can
    therefore remain while qualification appears complete. No actual residue was
    runtime-demonstrated, and the impact is contained to TEST and recoverable by
    identity deletion.
    **Evidence:** `scripts/cfa-signing-test-smoke.js:155-162,292-294`;
    `scripts/applicant-scope-guard-test-smoke.js:348-363,614-619`;
    `docs/testing/release-coverage-inventory.json:244-266`.
    **Automatic stop:** No. This is a contained TEST identity-cleanup and
    environment-hygiene failure, not critical impact.
11. **Applicant-scope leaves a declared remote progress file.**
    **Severity:** `low`.
    **Realistic impact:** The runner leaves a diagnostic `/tmp` progress file with
    no retention or cleanup owner. No storage exhaustion, sensitive-data
    disclosure, or runtime failure is demonstrated.
    **Evidence:** `scripts/applicant-scope-guard-test-smoke.js:366-385,826-833`.
    **Automatic stop:** No. This is narrow filesystem hygiene debt with no
    demonstrated material failure.
12. **Evidence validation does not validate its log evidence or independently
    reconstruct scope.**
    **Severity:** `medium`.
    **Realistic impact:** Validation can accept internally consistent evidence
    without proving that cited log bytes still exist/match or independently
    reconstructing mandatory scope. This materially weakens release assurance,
    but no incorrectly admitted release or resulting product harm is recorded.
    **Evidence:** `src/lib/releaseQualification.js:177-210`;
    `scripts/path-release-qualify.js:328-343,382-404`.
    **Automatic stop:** No. This is a material qualification-integrity weakness,
    not a demonstrated critical security, privacy, data-integrity, or
    environment-safety event.
13. **Current evidence conflates product and harness source identity.**
    **Severity:** `low`.
    **Realistic impact:** Evidence cannot distinguish product, harness, attempt,
    environment, and test-pack changes. This creates reproducibility and future
    change-cost debt, but no bad release or product failure is demonstrated.
    **Evidence:** `scripts/path-release-qualify.js:95-132,229-234,382-404`;
    `docs/planning/release-qualification-harness-rebuild-plan-2026-08-10.md:54-64`.
    **Automatic stop:** No. This is structural evidence-model debt without
    current material failure.

## Suspected Findings

These mechanics are confirmed, but their intended contract or runtime consequence
cannot be established from the permitted evidence. They are not confirmed defects.

- The admin aggregate consumes ignored portal `.env`, local `minio`, and MinIO
  credentials through its launcher-contract test. Candidate hashing excludes
  ignored files, so the inputs are hidden from candidate identity. A clean-clone
  provisioning contract is needed to decide whether this is a defect
  (`tests/localDevLaunchers.test.js:8-35`;
  `scripts/local-dev-launcher.js:27-61`;
  `../ISET-intake/.gitignore:16-21,32-33`;
  `scripts/path-release-qualify.js:102-132`).
- Intacct mock source is read by a mandatory contract check but is not in the DEV
  candidate component set or final stability loop. Its intended promotion
  ownership is unresolved (`scripts/intacct-contract-audit.js:37-79`;
  `scripts/path-release-qualify.js:109-124,210-215,293-304`).
- Ambient `INTERVENTION_ASSESSMENT_WORKFLOW_SMOKE_SCENARIOS` can narrow a mandatory
  browser child's scenarios while the suite inherits the variable and does not
  record it. The variable's current presence and whether full coverage is a strict
  invariant are unresolved (`scripts/release-browser-smoke-suite.js:59-65,151-155`;
  `scripts/intervention-assessment-workflow-browser-smoke.js:88-128,1845-1860`).
- `payment-db-rollback` marks mutation begun after the first successful insert.
  A failure after transaction start but before that flag skips its explicit catch
  rollback. Driver close semantics and actual residue require authoritative
  dependency evidence or controlled execution (`scripts/payments-workflow-smoke.js:341-371,743-827`).
- A two-step local timeout can begin outer Cognito/S3/credential cleanup without
  cancelling a still-running remote command. Actual overlap requires SSM/runtime
  evidence (`scripts/two-step-review-test-smoke.js:1522-1549,1879-1925`).
- R1 can suppress DB/object cleanup for a schema-safety-classified failure after
  fixture work has begun and declares no cleanup-stamp path. The safe recovery
  owner is unresolved (`scripts/r1-intake-completion-test-smoke.js:592-593,704-740`).
- The two-step/R1 "no real email" declarations are not proved by a routing
  assertion in the inspected chain. Runtime worker/config evidence is required
  (`scripts/two-step-review-test-smoke.js:5259-5268,7138-7169`;
  declarations at `docs/testing/release-coverage-inventory.json:228-242`).
- If an expected privacy denial instead mutates state, the denial child records
  failure but does not declare cleanup for every route's possible side effect.
  Route-level effect tracing is required (`scripts/privacy-route-denial-smoke.js:127-165,237-373`).

## Unresolved Questions and Evidence Gaps After Sprint 0B

- Exact CRA, CRACO, ESLint, Puppeteer/Chromium, MySQL-driver, AWS CLI, and SSM
  defaults for network, caching, process inheritance, connection close, and forced
  interruption require authoritative dependency source or controlled
  certification; project wrappers do not prove them.
- Current ignored `.env` contents, ambient variables, effective DB values, AWS
  session/operator identity, browser executable, MinIO inputs, and deployed target
  state were deliberately not inspected. Environment reachability is therefore
  recorded only as source-declared capability, never as current fact.
- Aggregate-wide absence of outbound network/live DB/live AWS access is not
  centrally enforced in inspected source. Proving it requires exhaustive effect
  declarations or authorized isolated tracing.
- Browser screenshot retention ownership and period are undeclared; child JSON and
  screenshots are not individually coupled to qualification evidence.
- Static substring checks cannot prove runtime route authorization or Intacct
  semantics. The AI fixture check proves shape, not guidance accuracy.
- The exact recovery owner after R1 schema-safety cleanup suppression, an
  uncancelled SSM timeout, or a privacy-denial mutation regression is unresolved.
- Sprint `0C` must determine the historical failure classes from retained evidence;
  this sprint did not inspect or classify `r3-r34`.

## Sprint 0B Files Examined

In addition to the Sprint `0A` files, Sprint `0B` examined:

- central control: `src/lib/releaseQualification.js`,
  `scripts/path-release-qualify.js`, `scripts/path-deploy.js`,
  `scripts/lib/releaseAdmission.js`, `docs/AGENTS.md`, package/lock/lint/ignore
  declarations in admin and portal;
- aggregates and representative suites: both `scripts/run-test-all.js` files,
  admin `tests/jest.config.js`, `tests/testAllContract.test.js`,
  `tests/privacyRouteScopeSmoke.test.js`, `tests/fullExpressStack.test.js`,
  `tests/hubRoutesAuthorization.test.js`, `tests/releaseAdmission.test.js`,
  `tests/releaseQualification.test.js`, `tests/localDevLaunchers.test.js`,
  `scripts/local-dev-launcher.js`, representative admin schema/atomicity suites,
  and representative portal intake/full-stack/S3 suites;
- DEV runners: `scripts/privacy-route-scope-smoke.js`,
  `scripts/real-mysql-release-contract.js`,
  `scripts/lib/live-mysql-schema-guard.js`, `scripts/path-schema-migrate.js`,
  `src/lib/sharedSchemaMigrationRunner.js`, admin/portal schema contract sources,
  `scripts/release-build-contract.js`, both build-info writers,
  `scripts/release-browser-smoke-suite.js`, all 13 browser child scripts,
  `scripts/privacy-erm-smoke.js`, `scripts/payments-workflow-smoke.js`,
  `scripts/intacct-contract-audit.js`, its manifest, and
  `scripts/admin-ai-eval-fixtures-check.js`;
- TEST runners: `scripts/path-test-runtime-postflight.js`,
  `scripts/path-test-runtime-metrics.js`, `scripts/path-test-migration-ledger.js`,
  `scripts/path-maintenance-fallback.js`,
  `scripts/two-step-review-test-smoke.js`,
  `scripts/r1-intake-completion-test-smoke.js`,
  `scripts/cfa-signing-test-smoke.js`,
  `scripts/cfa-signing-schema-preflight.js`,
  `scripts/lib/test-instance-aws-identity.js`,
  `scripts/applicant-scope-guard-test-smoke.js`,
  `scripts/privacy-route-denial-smoke.js`, and portal
  `scripts/cfa-signing-smoke.js`.

## Deviations and Failures

There were no unexplained workflow failures because no workflow was executed. One
read-only source lookup initially used a nonexistent `scripts/build-test.js` path;
the package alias directly identified the actual `scripts/write-build-info.js`
runner, and inspection continued there. This was a bounded source-navigation
correction, not a retry of an operation or a change in scope.

## Final Worktree State

After the Sprint `0B` documentation update, admin remains on
`main...origin/main` with the pre-existing modified `docs/AGENTS.md`,
`docs/ops/deployments/release-qualification-runbook.md`, and
`docs/planning/README.md`, plus the pre-existing untracked current-state audit and
controlling-plan files. Sprint `0B` and its bounded severity correction changed
only those two authorized untracked planning files. Portal and shared remain
clean on `main...origin/main`. Intacct
mock was already established in Sprint `0A` as a non-Git directory through one
failed read-only status attempt and the qualifier's explicit non-Git branch; that
command was not repeated (`scripts/path-release-qualify.js:109-124`). No
pre-existing user change was reverted or overwritten outside the two authorized
planning documents.

## Sprint 0B Completion Decision

Sprint `0B` is complete. The requested dependency, effect, environment, cleanup,
test-level, and coupling map is recorded with exact source references. Phase 0
remains incomplete. No component disposition, historical failure classification,
architecture, interface, or repair is authorized by this decision.

The Sprint `0B` governance gap is corrected: all 13 confirmed findings now have
an evidence-supported severity, realistic impact, exact evidence, automatic-stop
decision, and reason. None is critical, so the controlling plan's automatic-stop
rule is not triggered. Sprint `0C` has not begun.

That approval condition was satisfied when Bill separately authorized Sprint
`0C`. The result of that bounded sprint follows.

## Sprint 0C Outcome

Sprint `0C` is complete. Read-only inspection classified 56 identifiable failed
qualification gates across the retained `r3-r34` history:

| Primary classification | Failed gates |
| --- | ---: |
| `product` | 7 |
| `harness` | 34 |
| `environment` | 0 |
| `infrastructure` | 0 |
| `unclassified` | 15 |
| **Total** | **56** |

The count uses one outer qualification check as its unit. Where `r18` has no
surviving full TEST JSON, each of its two independently retained targeted runner
attempts contributes its named causal check once. A child assertion or the
derivative `remote runner completed without crashing` result is otherwise
recorded as causal evidence but is not counted again. Interrupted runs,
narrative-only local audits, and revisions with no named failed check are
recorded separately rather than assigned a synthetic gate classification.

No workflow was executed, no environment was accessed, and no application,
harness, test, schema, configuration, or environment state was changed. The
Sprint `0C` result is historical classification only; it does not establish the
current status of any old product defect and does not authorize repair.

## Sprint 0C Method and Classification Basis

The classification terms are the controlling plan's exact classes
(`release-qualification-harness-rebuild-plan-2026-08-10.md:54-76`). A failed
outer check is `unclassified` when its retained roll-up combines independently
evidenced product and harness causes or when the evidence cannot distinguish
them. This prevents a real product defect inside a mixed result from turning the
whole check into a guessed product classification.

The following safe-action key applies to each classified failed gate below:

- **P - product:** freeze the candidate and evidence; handle the product defect
  only through separately authorized work, then obtain focused contract proof
  before another qualification attempt.
- **H - harness:** retain the same product candidate and environment identity;
  version and certify the harness-only correction at the failing component
  boundary before another whole qualification. Do not redeploy solely for it.
- **E - environment:** stop and re-prove the target's identity, availability, and
  configuration before a new attempt against the same candidate.
- **I - infrastructure:** stop and prove the independent service/transport fault
  and recovery before a new attempt against the same candidate.
- **U - unclassified:** mandatory classification stop; preserve source state and
  obtain the missing child output, identity, or contract evidence before any
  patch or rerun.

These are the safe actions the retained evidence required at the time, not repair
recommendations for current code (`release-qualification-harness-rebuild-plan-2026-08-10.md:66-76,95-108`).

## Evidence Coverage and Identity Gaps

Read-only local enumeration found 45 complete relevant qualification JSONs in
`tmp/release-qualification/{dev,test}`: 27 DEV and 18 TEST. Their 551 recorded
sibling log references are present and match the SHA-256 values recorded in the
JSONs. There are 21 successful retained TEST deployment manifests through `r31`
and planned/successful emergency PROD manifests for `r34`. This proves retained
file consistency, not completeness of the historical record.

The complete JSONs record `releaseId`, `generatedAt`, `evidenceId`, inventory and
schema hashes, stage, required check IDs, and combined admin/portal/shared Git
heads, tree fingerprints, and dirty flags (`scripts/path-release-qualify.js:382-404`).
They do not record separate `productCandidateId`, `harnessVersion`, `attemptId`,
`environmentIdentity`, or `testPackVersions`. Inventory SHA is only a partial
harness/test-pack identity; the repository fingerprints conflate shipped product,
harness, tests, documentation, and evidence-handling source. TEST deployment
manifests add account/profile/region and exact deployed source, and some child
artifacts add AWS, instance, database, and fixture identities, but no central
artifact binds all five required identities (`release-qualification-harness-rebuild-plan-2026-08-10.md:54-64`).

The failed commands are defined by the retained coverage contract:

- DEV `admin-aggregate` and portal `portal-aggregate` run their repository
  `npm test`; `admin-browser-suite` runs
  `node scripts/release-browser-smoke-suite.js --json`; source stability is an
  internal post-check (`docs/testing/release-coverage-inventory.json:71-92,158-164`).
- TEST two-step, intake, CFA, applicant-scope, and privacy checks run the named
  deployed runners with `nwac-test`, `ca-central-1`, and JSON output
  (`docs/testing/release-coverage-inventory.json:228-266`). Runtime, payment, and
  maintenance checks run the three declared `path-test-runtime-postflight.js`
  modes (`docs/testing/release-coverage-inventory.json:220-226,268-282`).

Every row below lists abbreviated repository heads as `admin/portal/shared`; the
referenced qualification JSON contains the exact full heads, tree fingerprints,
dirty flags, inventory/schema hashes, timestamps, and evidence ID. Unless a row
says otherwise, the next safe action is the action keyed to its primary class.

## Attempts r3-r10

| Attempt and retained identity | Retained outcome and failed-gate classification | Deterministic basis and exact evidence | What changed next |
| --- | --- | --- | --- |
| `r3`; `e13c684c/9961ffb2/55bc26b2`; DEV `1456c477`, TEST `755eea56` | DEV `GO`; TEST `NO-GO`: `test-two-step-role-journeys` **harness (H)**; `test-intake-completion` **product (P)**; `test-cfa-signing` **harness (H)** | Two-step assumed instance-profile identity although the env-loaded actor was `SES_backend` (`tmp/release-qualification/test/20260806-assessment-correction-hotfix-r3.json.logs/test-two-step-role-journeys.log:3-8`). Intake PDFs lacked required SHA metadata; CFA fixture used `case.caseId` rather than product `case.id` (`docs/meta/changelog.md:41`; `tmp/release-qualification/test/20260806-assessment-correction-hotfix-r3.json.logs/test-intake-completion.log:1-5`; `tmp/release-qualification/test/20260806-assessment-correction-hotfix-r3.json.logs/test-cfa-signing.log:1-8`). | `r4` changed product and harness. |
| `r4`; `b63a96c0/d20b2a73/55bc26b2`; DEV `f3c01195`, TEST `0b18fb91` | DEV `GO`; TEST `NO-GO`: two-step **harness (H)**; CFA **harness (H)** | Fixture chose region `AB` without a compatible budget-pot mapping (`tmp/two-step-review-test-smoke/two-step-1786079568209-9ef2867636-journey.json:1`); CFA fixture omitted submission/application lineage (`docs/meta/changelog.md:40`; `tmp/release-qualification/test/20260807-assessment-correction-hotfix-r4.json.logs/test-cfa-signing.log:1-8`). Fixture relationships must be proved as one compatible set (`docs/AGENTS.md:7-10`). | `r5` changed harness plus other product source. |
| `r5`; `08aa4254/6796c2fd/55bc26b2`; DEV `ac5b73f0` | DEV `NO-GO`: `portal-aggregate` **harness (H)**; no TEST | A test using Jest globals was run by the portal Node aggregate (`tmp/release-qualification/dev/20260807-assessment-correction-hotfix-r5.json.logs/portal-aggregate.log:302-323`; `docs/meta/changelog.md:39`). | `r6` changed harness/tests/docs only, but received a new release ID. |
| `r6`; `3cfb06ec/2c66ca7d/55bc26b2`; DEV `6b37a978`, TEST `f1eecb4a` | DEV `GO`; TEST `NO-GO`: two-step **unclassified (U)**; CFA **product (P)** | The same two-step roll-up contained five product notification failures and a harness-created invalid Decision Maker payload, so one primary cause is not supportable (`tmp/two-step-review-test-smoke/two-step-1786084518937-1ef41a7816-journey.json:1`; `docs/meta/changelog.md:38`). CFA signing expected a `Buffer` but Puppeteer returned `Uint8Array` (`docs/meta/changelog.md:38`; `tmp/release-qualification/test/20260807-assessment-correction-hotfix-r6.json.logs/test-cfa-signing.log:1-8`). | `r7` changed product and harness. |
| `r7`; `d7965f9e/f55a0158/9dcad8ad`; DEV `d8ff784b` | DEV `NO-GO`: `admin-aggregate` **harness (H)**; no TEST | Static test retained a stale 31-loop literal (`tmp/release-qualification/dev/20260807-assessment-correction-hotfix-r7.json.logs/admin-aggregate.log:7219-7226,14048-14058`; `docs/meta/changelog.md:37`). | `r8` changed harness/tests/docs only, but received a new release ID. |
| `r8`; `2dc7227e/74f62425/9dcad8ad`; DEV `b72a24a9`, TEST `57ddac26` | DEV `GO`; TEST `NO-GO`: two-step **unclassified (U)**; CFA **product (P)** | The two-step roll-up combined product exact-application notification metadata failures with missing harness tutorial/conflict prerequisites (`tmp/two-step-review-test-smoke/two-step-1786097131956-6ec6312e57-journey.json:1`; `docs/meta/changelog.md:36`). CFA closed Chromium before its returned PDF promise settled (`docs/meta/changelog.md:36`; `tmp/release-qualification/test/20260807-assessment-correction-hotfix-r8.json.logs/test-cfa-signing.log:1-8`). | `r9` changed product and harness. |
| `r9`; `e182b212/32f178bb/d4beffa6`; DEV `4ba03b25`, TEST `a3ef21a9` | DEV `GO`; TEST `NO-GO`: two-step **product (P)**; CFA **harness (H)** | Returned assessment conflict declaration was rejected as locked (`tmp/two-step-review-test-smoke/two-step-1786100235982-c368cf3904-journey.json:1`). CFA schema guard used ambiguous unqualified `id` (`tmp/release-qualification/test/20260807-assessment-correction-hotfix-r9.json.logs/test-cfa-signing.log:1,6-12`; `docs/AGENTS.md:11-14`). | `r10` changed product and harness. |
| `r10`; `9d26b9ff/d816d734/d4beffa6`; DEV `34cc0e38`, TEST `ce956e5c` | DEV `GO`; TEST `NO-GO`: two-step **product (P)**; CFA **harness (H)** | Concurrent identical signing returned a generic 500 to the follower after the winner committed (`tmp/two-step-review-test-smoke/two-step-1786102490710-27cac4fcaa-journey.json:1`). CFA mislabeled a changed-signer negative case as idempotent replay (`docs/meta/changelog.md:33`; `tmp/release-qualification/test/20260807-assessment-correction-hotfix-r10--2026-08-07T11-34-12-529Z.json.logs/test-cfa-signing.log:1-8`). | `r11` changed product and harness. |

The five generic intake/CFA logs in `r3`, `r4`, `r6`, and `r8` do not themselves
retain the decisive inner exception. Their classifications require both the
contemporaneous causal record in `docs/meta/changelog.md:36-41` and the exact
subsequent product or runner correction. Without those verified contracts, those
checks would be `unclassified`.

## Attempts r11-r21

| Attempt and retained identity | Retained outcome and failed-gate classification | Deterministic basis and exact evidence | What changed next |
| --- | --- | --- | --- |
| `r11`; `fa72c86e/b20887df/d4beffa6`; DEV `71bc17ce`, TEST `bbb568c9` | DEV `GO`; TEST `NO-GO`: two-step **product (P)** | A durably signed request reloaded as editable instead of `Submitted` (`tmp/release-qualification/test/20260807-assessment-correction-hotfix-r11--2026-08-07T12-19-45-823Z.json.logs/test-two-step-role-journeys.log:1-14`; `docs/meta/changelog.md:32`). | `r12` changed product and harness. |
| `r12`; `bade8ffa/f4098066/d4beffa6`; DEV `000778eb`, TEST `35aa918a` | DEV `GO`; TEST `NO-GO`: two-step **unclassified (U)** | One roll-up combined product null signed-message lineage and missing recipient rows with the harness's page-global `Next` navigation (`tmp/release-qualification/test/20260807-assessment-correction-hotfix-r12.json.logs/test-two-step-role-journeys.log:11`; `docs/meta/changelog.md:31`; selector contract `docs/AGENTS.md:86`). | `r13` changed product and harness. |
| `r13`; `d32038fd/c8882cf2/0d06680b`; DEV `fad17fc9`, TEST `392dfffc` | DEV `GO`; TEST `NO-GO`: two-step **harness (H)** | Runner expected unformatted `1640.50` while retained UI evidence was `1,640.50`, then mistook sidebar text for navigation completion (`tmp/release-qualification/test/20260807-assessment-correction-hotfix-r13.json.logs/test-two-step-role-journeys.log:11`; `docs/meta/changelog.md:30`). | `r14` changed harness and product-owned observability. |
| `r14`; `e650179c/c8882cf2/0d06680b`, admin dirty; DEV `dcc94abc` | First DEV interrupted; restarted DEV `GO`; later TEST admission rejected after clean-source restoration; no completed failed-gate artifact | The retained DEV artifact itself proves `gitDirty=true`; the successful TEST manifest consumed that dirty evidence. The precise first interruption and TEST rejection check/output are missing (`tmp/release-qualification/dev/20260807-assessment-correction-hotfix-r14.json:1`; `tmp/path-deploy/test/20260807-assessment-correction-hotfix-r14--2026-08-07T14-18-15-509Z.json:4,61,95-97`; `docs/meta/changelog.md:29`). The narrative events are historical **environment** interpretations, not counted gates. | `r15` changed cleanliness/evidence identity; shipped-behaviour effect is unresolved because the dirty bytes were not preserved. |
| `r15`; `ee988e47/c8882cf2/0d06680b`; DEV `1d1a1a40`, TEST `cb95cf64` | DEV `GO`; TEST `NO-GO`: two-step **unclassified (U)** | One roll-up combined a harness comma-format comparison defect with a product legacy-EI validation trap (`tmp/release-qualification/test/20260807-assessment-correction-hotfix-r15.json.logs/test-two-step-role-journeys.log:11`; `docs/meta/changelog.md:27`). | `r16` changed product and harness. |
| `r16`; `cb1a3243/c8882cf2/0d06680b`; DEV `f7f52d01`, TEST `b7afc3e3` | DEV `GO`; TEST `NO-GO`: two-step **product (P)** | Save Progress returned `409 review_workflow_not_ready_for_nwac` because the frontend resent legacy Decision Maker context (`tmp/release-qualification/test/20260807-assessment-correction-hotfix-r16.json.logs/test-two-step-role-journeys.log:11`; `docs/meta/changelog.md:26`). | `r17` changed product and harness. |
| `r17`; no machine identity | Local audit rejected candidate before deployment; no named qualification gate | The retained narrative lists three product-contract blockers but no command, artifact, evidence ID, fingerprint, environment, or test-pack identity (`docs/meta/changelog.md:25`). They are reasonable historical product interpretations, not machine-backed gate classifications. | `r18` changed product and harness. |
| `r18`; `43364752/c8882cf2/0d06680b`; DEV `ad19de33`; no final TEST JSON | DEV `GO`, successful TEST deploy; two retained targeted failures: exact-resubmit assertion **harness (H)** and stale pre-navigation concurrency snapshot **harness (H)** | Failed artifacts are `tmp/two-step-review-test-smoke/two-step-1786127310167-84cdac14ef.json:1` and `two-step-1786128182002-993fbbcccf-journey.json:1`. The later `two-step-1786128748799-61d4d58ce0-journey.json:1` has 126 PASS checks and zero cleanup residue. An earlier premature-`Next` driver failure is narrative-only (`docs/meta/changelog.md:24`). | The two targeted attempts changed harness logic against the same deployed candidate; `r19` then changed harness/tests/docs only. |
| `r19`; `830875e4/c8882cf2/0d06680b`; DEV `a8e3ced9`, TEST `350cc9c0` | DEV and TEST `GO`; no failed gate | Exact admin diff `43364752..830875e4` contains only docs, the two-step runner, and its test; portal/shared are unchanged. Nevertheless a new release ID, TEST deployment/qualification, and PROD deployment were created (`tmp/release-qualification/test/20260807-assessment-correction-hotfix-r19.json:1`). | `r20` source/attempt delta cannot be reconstructed from accessible machine evidence. |
| `r20`; machine identities and `/tmp/iset-r20-candidate` absent | Retained summary describes seven harness/tooling defect categories. Rerun 3: 16 pass and `admin-browser-suite` **harness (H)**; separate import incident is harness, possible DEV read unresolved | Rerun-3 evidence ID `592122f7` and the two wrong-creator scenario causes are retained only in `docs/testing/rm-two-step-review-assurance-2026-08-09.md:168-178`. Exact earlier attempt/check mapping and artifacts are absent. Narrative categories are not added to the gate count. | `r21` is documented as an exact-creator fixture-only correction. |
| `r21`; documented `ee5f1441/c8882cf2/942c4323`; evidence `cb194817` | Documented DEV `GO`/validator `VALID`, 17 pass; no TEST; no failed gate | The assurance record supplies the result and identity, but its referenced JSON and isolated directory are absent (`docs/testing/rm-two-step-review-assurance-2026-08-09.md:65-103,168-174`). | New release ID for a harness-only fixture correction; the split between `r21` and `r22` product/harness changes is unresolved. |

## Attempts r22-r34

| Attempt and retained identity | Retained outcome and failed-gate classification | Deterministic basis and exact evidence | What changed next |
| --- | --- | --- | --- |
| `r22`; `37666939/c8882cf2/0d06680b`, all dirty; DEV `a908db3a` | DEV `NO-GO`: `admin-browser-suite` **unclassified (U)**; source stability **unclassified (U)** | Six browser scenarios failed with 404/no-call, missing-widget, or timeout evidence while source also drifted; the retained source-stability error gives no changed-state fingerprint or cause (`tmp/release-qualification/dev/20260809-two-step-review-assurance-r22-local-hardening.json.logs/admin-browser-suite.log:3603-3757`; `tmp/release-qualification/dev/20260809-two-step-review-assurance-r22-local-hardening.json:3000-3009,3075-3095`). | `r23` kept the same heads but changed the dirty admin tree fingerprint; exact changed bytes are absent. |
| `r23`; same heads, changed admin tree; DEV `90ad34ef` | DEV `GO`; no failed gate; local combined-tree proof only | JSON proves a new dirty-tree fingerprint (`tmp/release-qualification/dev/20260809-two-step-review-assurance-r23-local-hardening--2026-08-09T21-55-32-965Z.json:3-9,2798-2816,3089`); assurance limits it to local proof (`docs/testing/rm-two-step-review-assurance-2026-08-09.md:105-130`). | `r24` is a clean committed freeze with a changed inventory; conflated identity prevents an exact product/harness/test-pack split. |
| `r24`; `62b9efb3/0778b1b7/f81519d7`; DEV `cb010dc9`, TEST `f3e13bd4` | DEV `GO`; TEST `NO-GO`: runtime, payment, maintenance **harness (H)**; two-step **harness (H)**; intake, CFA, applicant, privacy, and source stability **unclassified (U)** | Three postflight modes lacked packaged `/opt/nwac/admin-dashboard/scripts/path-test-runtime-metrics.js`; two-step fixture omitted its EI prerequisite. The other four remote logs contain only generic failure/preflight output, and source stability retains only drift (`tmp/release-qualification/test/20260809-two-step-review-assurance-r24.json:235-386,389-434`; exact logs `test-runtime-postflight.log:1-15`, `test-payment-rollback.log:1-15`, `test-maintenance-cleanup.log:1-15`, `test-two-step-role-journeys.log:1-20`, `test-intake-completion.log:1-5`, `test-cfa-signing.log:1-9`, `test-applicant-scope-browser.log:1-7`, and `test-live-privacy-denials.log:1-7` under the adjacent `.json.logs` directory; `docs/testing/rm-two-step-review-assurance-2026-08-09.md:132-136`). | `r25` changed only deploy harness code and a harness test, then redeployed TEST. |
| `r25`; `6458235b/0778b1b7/f81519d7`; DEV `984a15ec`, TEST `69c23f85` | DEV `GO`; TEST `NO-GO`: runtime, payment, two-step **harness (H)**; intake, CFA, applicant, privacy **unclassified (U)** | Runtime/payment wrapper could not parse truncated migration-ledger JSON; two-step retained the EI fixture defect. Four remote logs remain generic (`tmp/release-qualification/test/20260809-two-step-review-assurance-r25.json:2879-3006,3038-3069`; exact logs `test-runtime-postflight.log:1`, `test-payment-rollback.log:1`, `test-two-step-role-journeys.log:1-20`, `test-intake-completion.log:1-5`, `test-cfa-signing.log:1-9`, `test-applicant-scope-browser.log:1-7`, and `test-live-privacy-denials.log:1-7` under the adjacent `.json.logs` directory; `docs/testing/rm-two-step-review-assurance-2026-08-09.md:132-136`). | `r26` changed acceptance runners/adapters/tests only, then redeployed TEST. |
| `r26`; `03352683/0778b1b7/f81519d7`; DEV `68a97f3b`, TEST `fb303758` | DEV `GO`; TEST `NO-GO`: two-step, intake, CFA, applicant, privacy all **harness (H)** | Exact causes are EI fixture omission; oversized intake result marker; wrong CFA identity comparison; and applicant/privacy invalid SQL alias plus unbounded close (`tmp/release-qualification/test/20260809-two-step-review-assurance-r26.json:2895-2972`; `docs/testing/rm-two-step-review-assurance-2026-08-09.md:132-136`). | `r27` evidence is absent. Across evidenced `r26-r28`, only docs/inventory/runners/tests changed. |
| `r27`; no retained attempt identity or artifact | No classifiable outcome or failed gate | An intermediate commit exists, but mapping it to `r27` would be inference. | Unknown; no synthetic classification is assigned. |
| `r28`; `388cdd7f/71826af2/f81519d7`; DEV `9c8151bf`, TEST `29c88525` | DEV `GO`; TEST `NO-GO`: two-step, applicant, privacy all **harness (H)** | Two-step used stale UI text; applicant/privacy rejected a live-DDL-proven nullable enum `NULL` before fixture insertion (`tmp/release-qualification/test/20260809-two-step-review-assurance-r28.json:256-331`; `docs/testing/rm-two-step-review-assurance-2026-08-09.md:138`; selector contract `docs/AGENTS.md:82,86`). | `r29` changed only docs, two-step harness, and its test, then redeployed TEST. |
| `r29`; `b07c679e/71826af2/f81519d7`; DEV `9103eea4`; no final TEST JSON | DEV `GO`; successful TEST deploy; two-step **harness (H)**; applicant/incomplete qualifier **harness (H)** | Two-step read exact evidence from the wrong nested path. Applicant assertions completed, but whitespace-sensitive cleanup missed the application, the FK blocked client deletion, rollback occurred, close was skipped, and outer polling hung until cancellation (`tmp/release-qualification/test/20260809-two-step-review-assurance-r29.json.logs/test-two-step-role-journeys.log:11`; `tmp/release-qualification/test/20260809-two-step-review-assurance-r29.json.logs/test-applicant-scope-browser.log:1-9`; `docs/testing/rm-two-step-review-assurance-2026-08-09.md:140`). | `r30` made harness/evidence/cleanup and guarded recovery changes, then redeployed TEST. |
| `r30`; `0556e5e7/71826af2/f81519d7`; DEV `08f777bd`, TEST `1f489360` | DEV `GO`; TEST `NO-GO`: two-step **harness (H)**; privacy **harness (H)** | Two-step still read the wrong nested evidence path despite 128 product assertions and zero residue; privacy passed 26 denials and cleanup but its 24,586-byte JSON exceeded the SSM 24KB boundary and was truncated (`docs/testing/rm-two-step-review-assurance-2026-08-09.md:142`; `tmp/release-qualification/test/20260809-two-step-review-assurance-r30.json.logs/test-two-step-role-journeys.log:11`; `tmp/release-qualification/test/20260809-two-step-review-assurance-r30.json.logs/test-live-privacy-denials.log:9-10`). | `r31` changed applicant/two-step runners and harness tests only, then redeployed TEST. |
| `r31`; `9269d92b/71826af2/f81519d7`; DEV `fca25690`, TEST `0034ec76` | DEV `GO`; TEST `NO-GO`: two-step **harness (H)** | Complete product packet and 45 zero-residue checks were present, but `JSON.stringify` treated equal JSON with different property insertion order as unequal (`tmp/release-qualification/test/20260809-two-step-review-assurance-r31.json.logs/test-two-step-role-journeys.log:11`; `docs/testing/rm-two-step-review-assurance-2026-08-09.md:144`; stable-comparison rule `release-qualification-harness-rebuild-plan-2026-08-10.md:95-108`). | `r32` changed only docs, two-step harness, and its test; new release ID, no deployment. |
| `r32`; `a450bde5/71826af2/f81519d7`; DEV `e2d6b409` | DEV `NO-GO`: `admin-browser-suite` **harness (H)** | A normal rerender reset the wizard before the harness clicked a final action it had found in the prior render (`tmp/release-qualification/dev/20260809-two-step-review-assurance-r32.json.logs/admin-browser-suite.log:3971-4255`; `docs/testing/rm-two-step-review-assurance-2026-08-09.md:146`; `docs/AGENTS.md:86`). | `r33` changed only docs/browser harness/test; new release ID, no deployment. |
| `r33`; `e52f6ba7/71826af2/f81519d7`; DEV `c9e44e59` | DEV `NO-GO`: `admin-browser-suite` **harness (H)** | The child proved persistent `Submitted`/`rm_review` state but waited 45 seconds for an expired toast (`tmp/release-qualification/dev/20260810-two-step-review-assurance-r33.json.logs/admin-browser-suite.log:2839-3126`; `docs/testing/rm-two-step-review-assurance-2026-08-09.md:148`). | `r34` changed harness/operations controls only. |
| `r34`; PROD manifest `4a57c839/71826af2/f81519d7`; no exact-source DEV/TEST qualifier | No new failed gate can be classified | Planned and successful PROD manifests deliberately consumed the `r31` `NO-GO` evidence under `EMERGENCY-AUTHORIZED` and record decision/check/source/release mismatches (`tmp/path-deploy/prod/20260810-two-step-review-assurance-r34--2026-08-10T04-37-12-310Z.json:3-11,50-67,78-95`; `docs/testing/rm-two-step-review-assurance-2026-08-09.md:150`). This is an explicit governance decision, not a relabelled `GO`; exact `r34` qualification coverage is absent. | End of retained range. |

## Consolidated Failure-History Taxonomy

| Slice | `product` | `harness` | `environment` | `infrastructure` | `unclassified` | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `r3-r10` | 5 | 8 | 0 | 0 | 2 | 15 |
| `r11-r21` | 2 | 4 | 0 | 0 | 2 | 8 |
| `r22-r34` | 0 | 22 | 0 | 0 | 11 | 33 |
| **Total** | **7** | **34** | **0** | **0** | **15** | **56** |

Recurring, evidenced patterns are:

- **Fixture/schema/identity adapters:** wrong AWS actor, incompatible relational
  references, omitted lineage/EI prerequisites, invented payload fields, invalid
  SQL alias, and nullable-enum rejection (`r3-r4`, `r6`, `r9`, `r24-r28`).
- **Evidence transport/parsing:** missing deployed module, truncated migration
  ledger, oversized SSM markers, missing child output, and absent final artifacts
  (`r24-r26`, `r29-r31`).
- **Brittle assertions/selectors/timing:** global `Next`, formatted-money literal,
  stale copy, wrong nested evidence path, serialization order, rerender race, and
  transient toast (`r12-r13`, `r15`, `r18`, `r28-r33`).
- **Cleanup/process control:** unbounded remote close/poll and a post-mutation
  cleanup miss at `r29`; later `r30` recovery evidence records six database
  counters at zero and old Cognito names absent (`docs/testing/rm-two-step-review-assurance-2026-08-09.md:140-142`).
- **Opaque combined results:** 15 gates remain `unclassified`, concentrated in
  mixed product/harness roll-ups (`r6`, `r8`, `r12`, `r15`) and missing child or
  source-drift evidence (`r22`, `r24`, `r25`).

Confirmed patch-and-rerun sequences include `r5-r6`, `r7-r8`, `r12-r13`, the
targeted `r18` attempts, `r20-r21`, and `r24-r33`. Exact Git diffs show that
`r18-r19` changed only docs/two-step harness/tests. From committed `r24` through
`r34`, admin changes were confined to docs, inventory, scripts, tests, and deploy
controls; portal changed only `scripts/cfa-signing-smoke.js`; shared did not
change. Nevertheless `r19`, `r25`, `r26`, `r28`, `r29`, `r30`, and `r31` each
caused an additional TEST deployment under a new candidate/release identity.
`r32-r33` received new release IDs, and `r34` became a PROD deployment. This is
direct evidence of product/harness identity conflation, not evidence that every
deployment had the same operational effect (`release-qualification-harness-rebuild-plan-2026-08-10.md:54-64`; deploy manifests under `tmp/path-deploy/{test,prod}`).

The seven additional successful TEST deployments are recorded exactly at:

- `tmp/path-deploy/test/20260807-assessment-correction-hotfix-r19--2026-08-07T20-13-07-080Z.json:3-4`;
- `tmp/path-deploy/test/20260809-two-step-review-assurance-r25--2026-08-09T23-02-20-676Z.json:3-4`;
- `tmp/path-deploy/test/20260809-two-step-review-assurance-r26--2026-08-09T23-37-25-522Z.json:3-4`;
- `tmp/path-deploy/test/20260809-two-step-review-assurance-r28--2026-08-10T00-47-43-736Z.json:3-4`;
- `tmp/path-deploy/test/20260809-two-step-review-assurance-r29--2026-08-10T01-18-23-873Z.json:3-4`;
- `tmp/path-deploy/test/20260809-two-step-review-assurance-r30--2026-08-10T02-46-24-374Z.json:3-4`; and
- `tmp/path-deploy/test/20260809-two-step-review-assurance-r31--2026-08-10T03-24-21-698Z.json:3-4`.

The retained history should have forced a classification or design-review pause:

- at `r6`, `r8`, `r12`, and `r15`, where an outer gate combined product and
  harness causes;
- at `r14`, after interruption and then dirty-source DEV evidence;
- after the second targeted `r18` harness failure, before more tactical changes;
- during `r20`, once multiple unrelated harness defects accumulated without
  preserved per-attempt identities;
- at `r22`, with unstable source and an opaque browser failure;
- at `r24` and `r25`, with respectively five and four unclassified gates;
- at `r29`, immediately after fixture mutation, cleanup failure, skipped close,
  and unbounded polling, pending recovery proof; and
- after `r31`, where complete product/cleanup evidence and a JSON-order-only
  failure supported a harness-version change against the same product candidate,
  not further candidate/deployment churn.

These mandatory historical stops arise from insufficient classification or
non-convergent tactical work. They are distinct from the plan's automatic stop
for a current confirmed **critical** security, privacy, data-integrity, or
environment-safety finding.

## Sprint 0C Confirmed Findings

The project scale is at `docs/planning/engineering-audit-register.md:55-65`.
Severity describes the demonstrated historical impact, not current-open status.

| Confirmed historical finding | Severity and realistic impact | Exact evidence and affected invariant | Automatic stop |
| --- | --- | --- | --- |
| Seven named product gates violated core intake, signing, correction, or signed-state contracts (`r3`, `r6`, `r8-r11`, `r16`) | **High.** At the time, deployed TEST evidence showed core workflow failure or incorrect durable/user-visible behavior. Later source changed, so this does not prove a current defect. | Attempt tables; detailed journey artifacts; `docs/meta/changelog.md:26,32-33,36,38,41`. Invariant: verified product contract must determine the result. | **No.** High, not critical; no retained evidence of broad disclosure, widespread/irreversible corruption, complete PROD unavailability, or immediate unsafe financial/security action. |
| Mandatory packs produced 34 primary harness failures | **Medium.** False `NO-GO` results delayed release, repeated fixtures, and drove tactical harness changes despite no demonstrated product breach in those gates. | Attempt tables; causal assurance record `docs/testing/rm-two-step-review-assurance-2026-08-09.md:132-148`. Invariant: mandatory packs require certified deterministic evidence (`release-qualification-harness-rebuild-plan-2026-08-10.md:78-108`). | **No.** Contained, recoverable reliability/test debt; not critical. |
| Fifteen primary gates are not deterministically classifiable, and `r20/r21/r27/r29/r34` have material missing qualification evidence | **Medium.** Root cause, reproducibility, and safe rerun authority cannot be reconstructed; these conditions required a stop. | Attempt/gap tables; generic `r22/r24/r25` logs; `docs/testing/rm-two-step-review-assurance-2026-08-09.md:168-178`; retained directories. Invariant: every failure has one evidence-backed class and durable identities (`release-qualification-harness-rebuild-plan-2026-08-10.md:54-76,95-108`). | **No.** Evidence/governance failure with no demonstrated critical impact. |
| Harness-only changes were repeatedly assigned new product-candidate/release identities | **Medium.** At least seven additional TEST deployments occurred (`r19`, `r25`, `r26`, `r28-r31`), with more candidate churn through `r34`, increasing release exposure and obscuring what was actually being retested. | Exact commit diffs and the seven exact successful-manifest references immediately above; `r34` PROD manifest `tmp/path-deploy/prod/20260810-two-step-review-assurance-r34--2026-08-10T04-37-12-310Z.json:3-11,50-67,78-95`. Invariant: separate product, harness, and attempt identities (`release-qualification-harness-rebuild-plan-2026-08-10.md:54-64`). | **No.** Avoidable deployment and provenance risk, but no retained critical outcome. |
| `r24` TEST prerequisites failed without preventing later fixture-bearing checks | **Medium.** Stateful TEST checks ran after runtime postflight failure. This increased mutation/cleanup exposure, but retained evidence does not demonstrate persistent residue, PROD effect, or corruption. | Execution order and outcomes: `tmp/release-qualification/test/20260809-two-step-review-assurance-r24.json:235-386`; exact failed runtime and later fixture logs are listed in the `r24` attempt row. Invariant: failed prerequisite must block dependent mutation (`docs/AGENTS.md:7-8`; `release-qualification-harness-rebuild-plan-2026-08-10.md:102-105`). | **No.** Real environment-safety control defect, but contained/recoverable impact, not critical. |
| `r29` cleanup/process control failed after TEST fixture mutation | **Medium.** Synthetic TEST identity/residue state became temporarily uncertain and the SSM/outer poll hung until cancellation; guarded `r30` recovery later proved six DB counters zero and old Cognito names absent. | `tmp/release-qualification/test/20260809-two-step-review-assurance-r29.json.logs/test-applicant-scope-browser.log:1-9`; `docs/testing/rm-two-step-review-assurance-2026-08-09.md:140-142`. Invariant: bounded shutdown and independently proved zero residue (`release-qualification-harness-rebuild-plan-2026-08-10.md:95-105`). | **No.** Later recovery proved containment; no broad or irreversible damage. |
| `r14` accepted and deployed dirty DEV evidence | **Medium.** TEST received a non-reproducible candidate; no `r14` fixture run or PROD consequence is retained. | `tmp/release-qualification/dev/20260807-assessment-correction-hotfix-r14.json:1`; `tmp/path-deploy/test/20260807-assessment-correction-hotfix-r14--2026-08-07T14-18-15-509Z.json:4,61,95-97`; `docs/meta/changelog.md:29`. Invariant: immutable clean candidate identity (`release-qualification-harness-rebuild-plan-2026-08-10.md:54-64`). | **No.** Reproducibility/environment-safety risk without critical demonstrated impact. |
| Human summaries report the final `r18` artifact as 96/96 although it contains 126 PASS checks | **Low.** The numeric evidence summary is unreliable, but the raw pass outcome and zero-residue result agree. | `tmp/two-step-review-test-smoke/two-step-1786128748799-61d4d58ce0-journey.json:1`; `docs/meta/changelog.md:24`; `docs/planning/rm-two-step-review-workflow.md:21`. Invariant: summary must match retained artifact. | **No.** Narrow reporting defect. |
| An `r20` module import may have performed an unguarded DEV read | **Low.** A local read may have completed; no output, mutation, disclosure, TEST, or PROD effect is proved. The side effect remains unclassified. | `docs/testing/rm-two-step-review-assurance-2026-08-09.md:178`. Invariant: imports must be effect-free and environment access explicit. | **No.** Impact is unproved and limited; not critical. |

No Sprint `0C` confirmed finding is critical. The controlling plan's automatic
stop rule is therefore not triggered (`release-qualification-harness-rebuild-plan-2026-08-10.md:313-324`).

## Suspected or Unconfirmed Historical Interpretations

- The exact product/harness causes of the `r22` browser scenarios and the
  `r22/r24` source drift remain unresolved.
- The `r17` product blockers and seven `r20` harness categories are supported by
  contemporaneous summaries but lack the underlying per-attempt machine records.
- The `r14` first interruption and later source-mismatch rejection are reasonably
  described as environment events, but their precise failed checks are absent.
- No retained evidence supports a product defect for `r22-r34`. That does not
  prove product correctness; it means the failed gates in that slice are harness
  or unclassified.
- `r34` passed independent pre-qualification/deploy controls under an explicit
  emergency path, but no exact-source `r34` DEV/TEST qualification exists. It is
  not a TEST `GO` by inference.

## Contradictions, Missing Evidence, and Gaps

- The same final `r18` artifact is summarized as 96/96 in two documents but
  directly contains 126 PASS checks.
- The assurance document says every `r20` `NO-GO` artifact was retained unchanged
  (`docs/testing/rm-two-step-review-assurance-2026-08-09.md:172`), but neither
  those artifacts nor `/tmp/iset-r20-candidate` is accessible. The referenced
  `r21` JSON is also absent.
- `r14` first-run and TEST-rejection artifacts, the early `r18` premature-`Next`
  artifact, all `r27` evidence, the final `r29` TEST JSON/later logs, and exact
  `r34` qualification evidence are absent.
- `docs/meta/changelog.md:35` says the `r9` CFA failure stopped before fixture
  reads, but the retained stack places it inside `captureIdempotencyState` after
  the signing path. Cleanup/residue for that attempt is unresolved.
- Read-only enumeration found 59 current JSON files under
  `tmp/two-step-review-test-smoke`, whereas Sprint `0A` recorded 58. This is an
  inventory-count discrepancy, not a silent Sprint `0A` correction; the retained
  history includes a nonstandard `r18` JSON name without the usual `-journey`
  suffix.
- Current ignored environment values and current TEST/PROD state were deliberately
  not inspected. Historical artifacts prove only the identities they recorded.

Resolving these gaps would require the missing retained artifacts or a separately
authorized evidence-recovery sprint. Current environment execution cannot
recreate historical identity or missing bytes and was not attempted.

## Sprint 0C Files Examined

Sprint `0C` inspected only retained repository material, principally:

- all relevant JSONs and sibling logs under `tmp/release-qualification/{dev,test}`;
- targeted journey artifacts under `tmp/two-step-review-test-smoke`;
- TEST/PROD manifests under `tmp/path-deploy/{test,prod}`;
- `docs/meta/changelog.md`, `docs/testing/rm-two-step-review-assurance-2026-08-09.md`,
  `docs/planning/rm-two-step-review-workflow.md`, `docs/AGENTS.md`, and the
  controlling plan;
- `docs/testing/release-coverage-inventory.json`, the qualifier evidence emitter,
  and exact read-only Git history/diffs for the candidate transitions; and
- the product or harness source at the recorded historical commits only where a
  generic log required the verified contract/correction to support classification.

Only this audit artifact and the controlling plan were changed. No retained
evidence, source, runner, test, schema, configuration, or environment was changed.

## Sprint 0C Deviations and Operational Failures

No product or qualification workflow was executed and there was no unexplained
operational failure. The permitted read-only work encountered two explained tool
or filesystem conditions: `jq` was unavailable, so read-only JSON enumeration
used Node; and a broad `/tmp` name search met expected permission-denied entries
in system-private directories. During documentation verification, two local
search/orchestration commands had quoting or syntax errors and one documentation
patch found stale context; none changed a file, and each was corrected after
reading the exact local context. None changed evidence or scope. The absent `r20`
directory and artifacts were recorded as historical evidence gaps.

## Sprint 0C Final Worktree State

Admin remains on `main...origin/main` with the pre-existing modified
`docs/AGENTS.md`, `docs/ops/deployments/release-qualification-runbook.md`, and
`docs/planning/README.md`, plus the pre-existing untracked current-state audit
and controlling-plan files. Sprint `0C` changed only those two authorized
untracked planning files. Portal and shared remain clean on
`main...origin/main`. Intacct mock remains the non-Git directory established in
Sprint `0A`; its failed read-only Git status was not repeated. No pre-existing
user change was reverted or overwritten outside the two authorized planning
documents.

## Sprint 0C Completion Decision

Sprint `0C` is complete. The retained `r3-r34` history is classified to the limit
supported by its evidence, with unclassified results preserved rather than
guessed. Phase 0 remains incomplete. No component has been classified as retain,
repair, wrap, replace, or retire, and no architecture or repair has been proposed.

The exact approval required for proposed next work is: **Bill explicitly
authorizes Sprint `0D` of Phase 0 to perform only the retain/repair/wrap/replace/
retire assessment and Phase 0 synthesis, under a newly stated scope and effects
boundary.** Sprint `0D` must not begin automatically.

That approval condition was satisfied when Bill separately authorized Sprint
`0D`. The result of that bounded sprint follows.

## Sprint 0D Outcome

Sprint `0D` is complete. It assigns exactly one evidence-supported primary
disposition to 88 unique material component units:

| Disposition | Components |
| --- | ---: |
| `retain` | 25 |
| `repair` | 33 |
| `wrap` | 20 |
| `replace` | 10 |
| `retire` | 0 |
| **Total** | **88** |

`Replace` is a future migration disposition, not authorization to remove or
disable the current component. No immediate retirement is supportable because
the existing release gate remains authoritative until mapped replacements are
certified and promoted (`release-qualification-harness-rebuild-plan-2026-08-10.md:25-27,286-305`).

The count treats a separately invoked mode or named browser child as one unit.
Grouped rows name every counted unit. A file can contain more than one material
mechanism where the evidence supports different dispositions; a wrapper and its
native assertion engine are separated only where the trusted capability and the
unsafe execution boundary are independently evidenced. Overlapping build-wrapper
and documentation entries were counted once.

In the matrices below, **independent** means the primary disposition does not
depend on an unresolved fact. **Conditional** means the disposition is supported,
but the named proof or decision is still required before implementation or
promotion. No disposition changes the current gate or authorizes repair.

## Control-Plane Disposition Matrix

This matrix covers 26 control-plane units: 5 retain, 11 repair, 1 wrap, 9
replace, and 0 retire.

| ID | Component; owner/domain; current purpose | Evidence | Disposition and confidence | Trusted behavior and coverage to preserve | Limitations and unresolved dependency | Future decision or proof required |
| --- | --- | --- | --- | --- | --- | --- |
| CP01 | Qualifier/postflight CLI surfaces; admin control plane; stable operator entry points | `package.json:143-144`; `scripts/path-release-qualify.js:30-53,434-465`; inventory at this audit `:31-41` | `retain`, high | Explicit `plan/run/validate`, stage, release, evidence arguments, and exit status | Conditional: implementation behind the surface is separately replaced; exact option compatibility is undecided | Phase 1 records the compatibility boundary; later certification proves the chosen surface |
| CP02 | Coverage inventory; admin; repository/check/domain/operation/effect map | `docs/testing/release-coverage-inventory.json:1-63,285-446`; this audit `:23-29,281,285-288` | `repair`, high | Machine-readable ownership, dependency knowledge, and fail-closed unmapped inputs | Conditional: all domain checks are already mandatory; effect/cleanup fields are prose; maturity, prerequisites, identities, and certification are absent; Intacct/shared/portal-smoke ownership is unresolved (`:173-183,572-575`) | Ownership review plus deliberate selection, omission, and unknown-input cases |
| CP03 | Domain, operation, and check-selection primitives; admin library | `src/lib/releaseQualification.js:92-149`; `tests/releaseQualification.test.js:127-144` | `retain`, high | Deterministic matching, recursive dependency expansion, stable sorting, and ordered deduplication | Independent: current policy data makes selection ineffective, but does not invalidate the pure primitive | Positive, omission, dependency, and unknown-input cases against the future authority |
| CP04 | Inventory and command-contract validation; admin | `src/lib/releaseQualification.js:31-90`; `scripts/path-release-qualify.js:237-255`; this audit `:298` | `repair`, high | Unknown repository/check, bad regex, cycle, and unmapped-change rejection | Conditional: only direct `node *.js` references are checked; npm/npx/transitive command closure is unresolved | Malformed inventory, nested-alias, missing-runner, and dependency-cycle negatives |
| CP05 | Canonical JSON and file hashing primitives; admin | `src/lib/releaseQualification.js:7-29`; `scripts/lib/releaseAdmission.js:7-41`; plan `:95-108` | `retain`, high | Key-order-independent JSON hashing and path-plus-byte file hashing | Conditional: callers define scope; deploy has duplicate fingerprint logic; symlink/missing-file semantics are unresolved | Reordered JSON, corruption, missing-file, and symlink vectors |
| CP06 | Current candidate/source identity construction; admin qualifier | `scripts/path-release-qualify.js:95-166,177-234,382-404`; this audit `:759-768,867-876`; plan `:54-64` | `replace`, high | Exact Git heads, tree fingerprints, dirty flags, and migration-byte hash | Conditional: product, harness, tests, and docs are conflated; attempt/environment/pack identities are absent; authoritative shipped-product file sets are unresolved | A harness-only change must leave product identity unchanged while changing harness/attempt identity |
| CP07 | Candidate source-stability check; admin qualifier | `scripts/path-release-qualify.js:293-304`; this audit `:314,813,922` | `repair`, high | End-of-run re-fingerprinting and drift rejection | Conditional: final position is convention, failure names only repositories, and clean-tree policy needs decision | Deliberate mid-run mutation, dirty-source, and detailed-drift evidence cases |
| CP08 | Central qualification sequencing/orchestration; admin qualifier | `scripts/path-release-qualify.js:352-405`; this audit `:277,281-283,342-345,458-469` | `replace`, high | Deterministic decision and blocking of failed/unavailable checks | Conditional: no prerequisite graph, failure class, cleanup owner, or interruption record; safe continuation of independent read-only checks needs definition | Prerequisite, mixed-failure, cleanup, and forced-interruption negatives |
| CP09 | Central local child-process executor; admin qualifier | `scripts/path-release-qualify.js:308-343`; this audit `:282,470-485` | `replace`, high | Explicit cwd/command, timing, exit code, and log reference | Conditional: synchronous ambient execution, no abort/signal/process-group termination, 64 MiB buffer, flattened output; cross-platform termination semantics unresolved | Timeout, cancellation, output-overflow, and child-tree termination proof |
| CP10 | Qualification evidence model and final writer; admin qualifier | `scripts/path-release-qualify.js:346-405`; this audit `:132-134,388,759-768` | `replace`, high | Timestamps, expiry, stage, candidate facts, checks, blockers, and deterministic evidence ID | Conditional: no formal schema, separate identities, environment, class, cleanup, or linked child evidence; no final record on hang | Malformed, partial, interrupted, and identity-drift evidence cases |
| CP11 | Qualification evidence validator; admin library/CLI | `src/lib/releaseQualification.js:165-210`; this audit `:375-382,537-548` | `replace`, high | Checksum, stage, `GO`, expiry, inventory/schema, and source matching | Conditional: trusts evidence-declared scope and never verifies logs; future evidence authority is unresolved | Omitted mandatory check, altered log, altered component scope, and stale evidence negatives |
| CP12 | Per-command log capture and evidence handoff; admin qualifier | `scripts/path-release-qualify.js:328-343,382-404`; this audit `:366-367,752-755` | `repair`, high | Separately inspectable path/hash/status diagnostics; all 551 inspected references matched | Conditional: validator ignores hashes, streams are flattened, and child JSON is unlinked; retention/size policy unresolved | Missing, tampered, truncated, oversized, and structured-child cases |
| CP13 | DEV-evidence inheritance and TEST input admission; admin qualifier | `scripts/path-release-qualify.js:184-234`; this audit `:279,368-370` | `repair`, high | Required DEV `GO`, release/source revalidation, inherited domains and operations | Conditional: deployment manifest is checked only later and consolidated environment identity is absent | Stale DEV, wrong release/source/manifest, and failed-prerequisite cases |
| CP14 | Deploy admission; admin `path-deploy` | `scripts/path-deploy.js:2038-2108,2339-2348`; this audit `:280,369-371` | `repair`, high | Admission before deployment mutation; normal fail-closed stage/GO/expiry/release/operation/source checks; explicit emergency provenance | Conditional: consumes deficient validation/identity; migration-period evidence policy unresolved | Normal/emergency negative matrices before any cutover |
| CP15 | Deployment manifest and incremental step journal; admin deploy domain | `scripts/path-deploy.js:502-546,2328-2435`; this audit `:136-138` | `repair`, high | Running/success/failed steps, timing, errors, repo, qualification, and artifact references | Conditional: mutable ignored local file, no independently validated schema/checksum, non-atomic writes; durable retention unresolved | Interruption, partial-write, tamper, and final-status cases |
| CP16 | TEST deployment-provenance internal check; admin qualifier | `scripts/path-release-qualify.js:257-273`; this audit `:349,496-505` | `repair`, high | Manifest status, release, DEV evidence ID, and exact repository comparison | Conditional: no deployed schema or artifact-content proof; deployed-schema authority unresolved | Deliberate source, schema, evidence-ID, and artifact mismatch cases |
| CP17 | TEST rollback-readiness internal check; admin qualifier | `scripts/path-release-qualify.js:274-291`; this audit `:350,486-495` | `replace`, high | Candidate/prior artifact references | Independent: nonempty distinct URI strings cannot prove existence, checksum, access, version, or recoverability | Missing object, wrong checksum, inaccessible version, and failed-recovery negatives |
| CP18 | In-package `.path-release-provenance.json`; admin deploy/runtime | `scripts/path-deploy.js:867-882`; `scripts/path-test-runtime-postflight.js:155-175`; this audit `:139` | `repair`, high | Component/release/source self-identification inside packages | Conditional: no artifact digest or separate identities; runtime ignores marker environment/evidence ID; partial deployment contract unresolved | Wrong component/release/source, package tamper, and untouched-component cases |
| CP19 | Build manifest, immutable-artifact record, and release-descriptor primitives; admin deployment domain | `scripts/lib/releaseAdmission.js:5-86,106-139`; `scripts/write-build-manifest.js:3-14` | `retain`, high | Deterministic bundle hash/count, target/release/Git/dirty validation, content-addressed keys, complete descriptor | Conditional: primitives do not prove deployed existence/recoverability; consumer coverage unresolved | Direct tamper, incomplete descriptor, and mismatched build-info cases |
| CP20 | Two-step detailed-evidence pointer/download transport; admin deployed-test domain | `scripts/two-step-review-test-smoke.js:1552-1608,1799-1819,2228-2273`; this audit `:373,791-818` | `wrap`, medium-high | Exact key/version/status/bytes/SHA-256/JSON and pointer-artifact agreement; complete child assertions/cleanup | Conditional: bespoke, parent-unlinked, and coupled to uncancelled remote execution; generic transport contract unresolved | Corrupt, truncated, wrong-key, missing-pointer, and disconnected-parent cases |
| CP21 | Generic child JSON/stdout/SSM evidence transport; admin TEST wrappers | This audit `:366-373,828-835,849-865`; `r30` truncation at `:834` | `replace`, high | All native child assertions, identities, and cleanup results | Independent: generic/missing output left gates unclassified and SSM truncation lost otherwise successful evidence; other transport limits remain to catalogue | Over-24-KiB, missing, truncated, corrupt, and late-result cases |
| CP22 | Operational evidence retention under ignored `tmp/`; admin | Runbook `:47-59`; `.gitignore:52-53`; this audit `:752-757,944-968` | `replace`, high | Linked DEV/TEST evidence, logs, manifests, and detailed artifacts through observation | Conditional: material history is absent; durable owner/location/period unresolved | Retrieval after interruption, workspace cleanup, and retention expiry |
| CP23 | Admin build/generated-file restoration mechanism; admin | `scripts/release-build-contract.js:34-65,83-89`; `scripts/release-browser-smoke-suite.js:132-177`; this audit `:307,390-391` | `retain`, high, narrow | Byte snapshots, `finally` restoration, and temporary-output removal for declared admin files | Conditional: does not endorse unbounded child execution; undeclared generated outputs unresolved | Forced build/browser failure plus byte-for-byte residue proof |
| CP24 | Portal build/deploy-preflight restoration mechanism; admin wrapper and portal writer | `scripts/release-build-contract.js:43-50,67-88`; `../ISET-intake/scripts/write-build-info.js:8-12,99-118`; finding at this audit `:422-433` | `repair`, high | Isolated portal output and current `buildInfo.js` restoration | Conditional: `publicBuildInfo.js` is also written but unowned; other generated outputs unresolved | Separately authorized repair, then forced-failure clean-worktree proof |
| CP25 | Authoritative release-qualification runbook; admin documentation contract | Runbook `:3-38,40-80,151-170,245-300`; plan `:25-27`; this audit `:458-516` | `repair`, high | Explicit `GO/NO-GO`, no silent waiver, candidate exactness, approval, and external-effect boundaries | Conditional: complete blocker aggregation conflicts with fixture fail-close; provenance/rollback/recent-error claims exceed code; current/advisory wording unresolved | Reviewed source-to-runbook trace for every mandatory claim after separately authorized implementation decisions |
| CP26 | Remote SSM polling, timeout, and cancellation family; admin TEST wrappers | `scripts/two-step-review-test-smoke.js:1522-1549`; `scripts/r1-intake-completion-test-smoke.js:313-335`; `scripts/cfa-signing-test-smoke.js:103-119`; `scripts/applicant-scope-guard-test-smoke.js:389-412`; `scripts/path-test-runtime-postflight.js:109-144`; this audit `:470-485,585-590,921` | `replace`, high | Command/instance identity and remote status evidence | Conditional: waits differ, some are unbounded, no remote cancellation, and cleanup can overlap live work; terminal/cancellation semantics unresolved | Forced timeout must prove remote termination before cleanup or rerun |

## Runner and Native-Capability Disposition Matrix

This matrix covers 52 additional explicitly named units after the two build
wrappers already counted as CP23/CP24 are removed: 13 retain, 19 repair, 19 wrap,
1 replace, and 0 retire. Grouped rows count every named member in parentheses.

| ID | Component(s) and count; owner/domain; current purpose | Evidence | Disposition and confidence | Trusted behavior and coverage to preserve | Limitations and unresolved dependency | Future decision or proof required |
| --- | --- | --- | --- | --- | --- | --- |
| RN01 | Admin aggregate shell (1); admin; sequence frontend then backend suites | `scripts/run-test-all.js:9-38`; `tests/testAllContract.test.js:11-20`; this audit `:299,389` | `wrap`, high | Ordering, nonzero propagation, and both native suites | Conditional: mixed levels, ambient environment, opaque output, no aggregate timeout/residue | Direct-result parity, known-bad phase, interruption, and residue proof |
| RN02 | Portal aggregate shell (1); portal; sequence CRACO then discovered backend suites | `../ISET-intake/scripts/run-test-all.js:10-59`; this audit `:300,389` | `wrap`, high | Frontend/backend discovery, order, and nonzero propagation | Conditional: same mixed-effect/lifecycle gaps as admin | Direct-result parity and interruption/residue certification |
| RN03 | Admin React-Scripts and Jest native runners (2); admin product assertions | `scripts/run-test-all.js:9-38`; `tests/jest.config.js:3-14`; this audit `:299` | `retain`, medium | Existing frontend, backend, authorization, composition, and contract assertions | Conditional: suite authority/effects vary; one suite leaves temp residue (`:434-444`) | Pack-level contracts, effects, known-good/bad, and teardown certification |
| RN04 | Portal CRACO and native `node:test` runners (2); portal assertions | `../ISET-intake/scripts/run-test-all.js:10-59`; this audit `:300` | `retain`, medium | Frontend, auth, notification, route, signing, and composition assertions | Conditional: per-suite effects/cleanup and exhaustive network prohibition unresolved | Pack contracts plus good/bad, teardown, and effect proof |
| RN05 | Admin and portal ESLint (2); frontend static analysis | `package.json:94`; `../ISET-intake/package.json:61`; this audit `:301-302` | `retain`, high | Deterministic current `src` checks | Conditional: server/scripts/tests are outside roots; cache/defaults unresolved | Deliberate lint failure and explicit scope decision |
| RN06 | Privacy route source tripwire (1); cross-app privacy contract | `scripts/privacy-route-scope-smoke.js:11-158,882-930`; this audit `:303,614-615` | `retain`, medium | Required/forbidden route and privacy-source tripwires, including deliberate-removal tests | Independent: substring evidence cannot prove runtime authorization; authority must remain narrow | Known-bad source cases and explicit non-runtime status |
| RN07 | Intacct source audit (1); admin/mock integration contract | `scripts/intacct-contract-audit.js:6-13,37-92`; fidelity manifest; this audit `:312,572-575` | `retain`, medium | Deterministic PATH/mock literal drift detection | Conditional: external semantics and ordinary mock candidate ownership unresolved | Deliberate drift proof plus ownership decision; never treat as Sage certification |
| RN08 | AI fixture-shape checker (1); admin AI testing | `scripts/admin-ai-eval-fixtures-check.js:6-90`; this audit `:313,615` | `retain`, medium | Fixture schema, unique ID, source, anchor, forbidden-pattern, and status checks | Independent: does not prove guidance/model accuracy | Known-bad shape cases and continued narrow authority |
| RN09 | Canonical live-MySQL schema guard (1); shared DB-safety capability | `scripts/lib/live-mysql-schema-guard.js:1001-1067`; this audit `:304-306,310-311`; `docs/AGENTS.md:7-22` | `retain`, high | Exact identity/DDL and per-statement identifier admission | Conditional: driver interruption/defaults unresolved | Known-bad schema/alias and forced-interruption certification |
| RN10 | Real-MySQL schema-preflight mode (1); DEV integration | `scripts/real-mysql-release-contract.js:102-154,619-651,708-735`; this audit `:304` | `wrap`, high | Exact DEV identity/DDL with zero ordinary statements | Conditional: no timeout/cancellation | Wrong target/schema and interruption/connection-close cases |
| RN11 | Schema-plan DEV chain (1); admin/shared migration integration | `scripts/path-schema-migrate.js:161-249,404-417,672-721`; `src/lib/sharedSchemaMigrationRunner.js:106-274`; this audit `:305` | `wrap`, high | Canonical checksums, ledger, pending-plan semantics, and no migration writes | Conditional: text output omits structured identity; driver defaults unresolved | Structured identity parity, drift/bad-ledger, and interruption proof |
| RN12 | Full real-MySQL transactional contract (1); DEV integration | `scripts/real-mysql-release-contract.js:258-741`; this audit `:306,392` | `wrap`, high | Runtime assertions, guarded transaction, rollback, and eight residue checks | Conditional: no overall timeout; mutation-state interruption boundaries need proof | Known-bad and forced-interrupt zero-residue certification |
| RN13 | Privacy-ERM DB smoke (1); DEV relational/privacy integration | `scripts/privacy-erm-smoke.js:283-617`; this audit `:310` | `wrap`, high | Exact-target guarded read-only relational/privacy counts | Conditional: no timeout/cancellation | Known-bad relational case and bounded interruption |
| RN14 | Payments workflow smoke (1); DEV/TEST payment fixture capability | `scripts/payments-workflow-smoke.js:38-71,214-264,743-827,1484-1604`; findings at this audit `:411-421,581-584` | `repair`, high | Payment/evidence/communication/follow-up assertions, rollback/residue, and no provider/API/email | Conditional: DEV check authorizes TEST; environment precedence and pre-first-insert rollback remain unresolved | Separate repair authorization, exact DEV binding, rollback-from-transaction-start, and forced-interruption residue proof |
| RN15 | Admin and portal build-info writers (2); build provenance inputs | `scripts/write-build-info.js:199-208,258-286`; `../ISET-intake/scripts/write-build-info.js:64-118` | `retain`, medium-high | Deterministic release/build metadata generation | Conditional: callers own restoration; Git/release-note inputs define bytes | Deterministic-byte and caller-restoration proof |
| RN16 | Browser parent `release-browser-smoke-suite` (1); local-system orchestration | `scripts/release-browser-smoke-suite.js:9-28,59-80,105-186`; this audit `:309,372,388-391,445-457` | `repair`, high | Isolated build/loopback server, admin metadata restoration, deterministic child order/status | Conditional: no child timeout/process-group kill, flat child evidence, unlinked screenshots, unrecorded ambient selector | Hung/known-bad child and forced-interruption cleanup/evidence proof |
| RN17 | Contained browser children (6): app-shell navigation, home overdue queue, manual intake, application assessment workflow, intervention posting context, intervention assessment recall | This audit `:326,329-330,335-337`; child source ranges recorded there | `wrap`, medium | Native UI/state/request assertions for all six surfaces; bounded page waits and `finally` closes | Conditional: synthetic APIs; selector/persistent-state authority and screenshot role uncertified | Repeated known-good/bad and interruption certification against verified product state |
| RN18 | Browser children lacking general exceptional shutdown (6): ESDC queue, case assignment, manage components, modify component, application overview/docs, application workspace | This audit `:327-334`; confirmed finding `:445-457` | `repair`, high | All six surface and request-payload assertion sets | Independent: exception can leave Chromium; screenshot retention is undeclared | Separate repair, then forced-exception zero-process-residue proof |
| RN19 | Intervention-assessment workflow browser child (1); proposal/review/resubmit/sign-off coverage | `scripts/intervention-assessment-workflow-browser-smoke.js:88-128,590-856,1383-1864`; this audit `:338,576-580,836-837` | `repair`, high | Exact owner/role/return/resubmit/sign-off/follow-up and persistent-state checks | Independent: ambient narrowing, rerender race, and transient-toast wait are evidenced | Record full scenario enumeration; use product-owned persistent transitions; repeat good/bad cases |
| RN20 | `path-deploy smoke --env test` target-health runner (1); TEST AWS control plane | `scripts/path-deploy.js:52-64,293-311,413-423,645-660,1940-1979,2439-2487`; this audit `:351` | `wrap`, high | Explicit TEST account/profile/region and every registered admin/portal target's health | Conditional: AWS children are unbounded | Wrong-account, unhealthy-target, and timeout cases |
| RN21 | `path-test-runtime-postflight` full, payment, and maintenance modes (3); TEST deployed checks | `scripts/path-test-runtime-postflight.js:6-183,185-288`; this audit `:352,358-359,470-516,828-829` | `repair`, high | STS/ASG/SSM, readiness, provenance, PM2/env/schema/migration/metrics/maintenance, and payment-child assertions | Independent defects: no declared recent-error proof, historical missing helper/truncated parser, no remote cancellation; “cleanup” mode only inspects | Separate repair; dependency/output/recent-error/mode/timeout/cancellation certification |
| RN22 | Postflight native helper trio (3): migration ledger, runtime metrics, maintenance-fallback status | This audit `:352,359`; exact helper source references in the TEST check map | `wrap`, medium-high | Guarded schema/ledger/worker metrics and ALB forward/no-warning proof | Conditional: deployed packaging and SSM size; maintenance tool also has mutating modes | Read-only identity, known-bad, output-size, and packaging proof |
| RN23 | Main two-step journey/orchestrator (1), excluding cleanup-stamp mode; deployed cross-domain acceptance | `scripts/two-step-review-test-smoke.js:18-37,1108-1925,2228-2416,2632-2895,3754-3844,7383-8305`; this audit `:828-835,849-902,917` | `replace`, high | Every verified role/owner/stage/prerequisite/decision/item/PDF/notification/concurrency/idempotency assertion, exact target/DDL, and residue check | Independent: one monolith owns AWS/Cognito/DB/S3/HTTP/browser/fixtures/evidence/cleanup and repeatedly failed across unrelated boundaries; email suppression and timeout overlap remain unresolved | Map every assertion to a contract and prove retained coverage, deliberate bad cases, interruption, and cleanup before retiring implementation |
| RN24 | Two-step `--cleanup-stamp`/zero-residue recovery mode (1); TEST recovery | `scripts/two-step-review-test-smoke.js:963-1020,7383-8305`; this audit `:353,393,817,862` | `wrap`, medium | Re-resolved relationship cleanup, DB/object/Cognito/temp removal, and counters | Conditional: possible overlap with uncancelled remote work (`:585-587`) | Prove cancellation synchronization and repeated cleanup of deliberate interrupted fixtures |
| RN25 | R1 intake-completion TEST runner (1); deployed portal completion | `scripts/r1-intake-completion-test-smoke.js:11-84,217-385,399-875,1106-1346`; this audit `:354,588-590,830` | `repair`, high | Exact identity/schema, suppressed user, completion/replay/idempotency, and DB/object/event/notification/Cognito cleanup | Independent defects: unbounded SSM, output-boundary history, cleanup suppression after mutation, no recovery mode | Separate repair; deliberate pre/post-mutation failures, cancellation, recovery, and zero residue |
| RN26 | TEST instance AWS-identity helper (1); deployed identity proof | `scripts/lib/test-instance-aws-identity.js:5-42`; this audit `:355`; `docs/AGENTS.md:7-8` | `retain`, high, narrow | Marked JSON and exact account/ARN/user-id rejection | Conditional: identity is point-in-time; callers loading env must re-prove afterward | Wrong-account, malformed/truncated, and caller-sequence cases |
| RN27 | CFA schema preflight (1); TEST DB metadata guard | `scripts/cfa-signing-schema-preflight.js:8-25,73-114`; portal import at `../ISET-intake/scripts/cfa-signing-smoke.js:24-31`; this audit `:355` | `repair`, high | Exact DB identity/full DDL/absence assertions, zero ordinary statements, `finally` close | Independent: imports the two-step monolith for a guard, creating side-effect/package/layout coupling | Side-effect-free isolated dependency plus bad-schema proof |
| RN28 | CFA outer TEST wrapper (1); identity/Cognito/remote orchestration | `scripts/cfa-signing-test-smoke.js:103-162,175-294`; this audit `:517-528` | `repair`, high | Operator, instance, portal-context identity, preflight before Cognito, suppressed disposable identity | Independent: unbounded SSM/fetch and Cognito deletion without read-back | Timeout/cancel, deletion-absence, and deliberate cleanup-failure cases |
| RN29 | Portal CFA deployed child (1); signing product assertions | `../ISET-intake/scripts/cfa-signing-smoke.js:24-31,252-428,515-680`; this audit `:355`; historical `r3/r9/r10/r26` rows | `repair`, medium-high | Signing/PDF/object/event/idempotent retry plus DB/object residue checks | Conditional: relative admin/two-step import and prior fixture/SQL/assertion defects; current certification absent | Exact package/import, known-good/bad, interruption, and residue proof |
| RN30 | Applicant-scope outer browser and privacy modes (2); deployed ownership/privacy fixtures | `scripts/applicant-scope-guard-test-smoke.js:12-120,266-412,434-833,845-1184,1305-1778`; this audit `:517-535,833-834` | `repair`, high | Exact identity/schema, wrong-owner browser/API and privacy setup, mandatory DB cleanup/residue | Independent: Cognito warnings/no absence proof, unowned progress file, unbounded SSM, historical cleanup/hang/oversize failures | Fail-closed identity cleanup, bounded transport/cancel, artifact ownership, and recovery cases |
| RN31 | Privacy-denial child (1); real-token authorization checks | `scripts/privacy-route-denial-smoke.js:79-166,185-373,500-586`; this audit `:357,595-597,834` | `repair`, medium-high | Twenty-six real-token denials and secret-excluding compact result | Conditional: mutation-capable denial regression may leave effects; child is unbounded | Per-route effects/cleanup, allowed/denied known cases, and timeout/cancel proof |
| RN32 | Shared `applicationAssessmentReviewState.test.js` (1); pure shared state assertions | `../shared/applicationAssessmentReviewState.test.js:1-40`; this audit `:173-176,239-240` | `wrap`, low | Stage normalization and review-state assertions | Conditional: no current runner, owner, or qualification intent | Ownership decision plus direct known-good/bad execution before authority |
| RN33 | Portal `smoke:portal:workflow` (1); unselected portal workflow capability | `../ISET-intake/package.json:73`; this audit `:181-183` | `wrap`, low | Potential distinct portal workflow coverage must not be silently lost | Conditional: source/effects/overlap and intended status unresolved | Source/effect/coverage map and certification determine continued use |

## Documentation and Contract Disposition Matrix

The coverage inventory and release runbook are already counted as CP02 and CP25.
The remaining 10 documentation/contract units are 7 retain, 3 repair, 0 wrap, 0
replace, and 0 retire.

| ID | Component; current purpose | Evidence | Disposition and confidence | Trusted authority to preserve | Limitations and unresolved dependency | Future decision or proof required |
| --- | --- | --- | --- | --- | --- | --- |
| DC01 | `docs/AGENTS.md`; canonical safety and operating contract | `docs/AGENTS.md:7-29,42-50,64-65,81-86` | `retain`, high | SQL/schema, fixture, AWS identity, browser, and working-practice invariants that directly address evidenced failures | Independent: documentation is guidance, not deployed proof (`docs/AGENTS.md:46`) | Phase 1 traces every relevant constraint; later adapters prove it mechanically |
| DC02 | Rebuild controlling plan; programme and promotion authority | `release-qualification-harness-rebuild-plan-2026-08-10.md:9-27,54-108` | `retain`, high | Deterministic/LLM authority boundary, separate identities, failure classes, pack contract, certification, sprint control | Independent: Phase 1 may refine design only through recorded approval | Bill reviews Phase 0 before separately authorizing Phase 1 |
| DC03 | Phase 0 current-state audit; durable evidence baseline | This audit `:21-166,272-393,695-968` | `retain`, high | Inventory, dependency/effect map, historical taxonomy, dispositions, gaps, and source limits | Independent: it is not current environment proof | Phase 1 uses it as baseline and records any directly evidenced correction |
| DC04 | `docs/testing/README.md`; testing-doc authority boundary | `docs/testing/README.md:7-11` | `retain`, high | Manual/UAT docs do not replace automated or environment proof; pointers to machine controls | Independent: later pointer edits are routine maintenance | Keep pointers aligned after approved migration decisions |
| DC05 | Intacct fidelity manifest; narrow PATH/mock source contract | `docs/data/integrations/intacct-interface-fidelity-manifest.json:2-5,44-208`; this audit `:614-615` | `retain`, medium | Declared local contract and explicit disclaimer that it is not Sage certification | Conditional: static literals cannot prove external semantics | Ownership decision and approved official/sandbox evidence for external certification |
| DC06 | Admin AI evaluation fixture corpus; high-risk prompt/anchor data | `docs/testing/admin-ai-chatbot-eval-fixtures.json:1-220`; this audit `:313,614-615` | `retain`, medium | Prompt IDs, sources, expected anchors, forbidden patterns, and status | Independent: current checker proves shape, not model/guidance accuracy | Preserve as advisory input; separately certify any behavior-evaluation pack |
| DC07 | Engineering severity contract; demonstrated-impact scale | `docs/planning/engineering-audit-register.md:55-66`; this audit `:400-409,911-927` | `retain`, high | Critical/high/medium/low thresholds and evidence-strength separation | Independent: no Sprint 0D evidence changes existing severity | Continue applying without inflating priority or hypothetical impact |
| DC08 | Two-step assurance record; contemporaneous release history | `docs/testing/rm-two-step-review-assurance-2026-08-09.md:132-178`; contradiction at this audit `:948-951` | `repair`, high | Causal history, candidate controls, and acknowledged reliability residuals | Independent: it says missing `r20` artifacts were retained; missing bytes cannot be reconstructed | Separately authorized documentation correction must preserve the gap explicitly |
| DC09 | RM two-step workflow history; product workflow invariants | `docs/planning/rm-two-step-review-workflow.md:21,25,27,257`; contradiction at this audit `:923,946-947` | `repair`, high | Product-owned workflow, lineage, role, and correction invariants | Independent: its `r18` 96/96 summary conflicts with 126 raw PASS checks | Correct only the evidenced historical count; preserve product-contract content |
| DC10 | Changelog qualification history; release chronology | `docs/meta/changelog.md:24,35`; this audit `:946-957` | `repair`, high | Chronology and contemporaneous product/harness cause records | Independent: repeats the `r18` count error and conflicts with retained `r9` stack timing | Correct evidenced statements without inventing missing history |

## Disposition Totals and Check-by-Check Summary

| Matrix lane | `retain` | `repair` | `wrap` | `replace` | `retire` | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Control plane | 5 | 11 | 1 | 9 | 0 | 26 |
| Runners and native capabilities | 13 | 19 | 19 | 1 | 0 | 52 |
| Documentation and contracts | 7 | 3 | 0 | 0 | 0 | 10 |
| **Total** | **25** | **33** | **20** | **10** | **0** | **88** |

The following is the requested check-by-check view. It maps each of the 28 unique
inventory check IDs to the primary disposition of its execution boundary; it does
not add another component to the totals. Exact check declarations are at
`docs/testing/release-coverage-inventory.json:64-283`, and the full dependency and
effect evidence is at this audit `:290-360`.

| Check | Primary disposition | Matrix component and evidence-supported conclusion |
| --- | --- | --- |
| `inventory-contract` | `repair` | CP04; preserve fail-closed inventory checks, add transitive command closure |
| `admin-aggregate` | `wrap` | RN01; keep both native suites behind controlled execution |
| `portal-aggregate` | `wrap` | RN02; keep frontend/backend discovery behind controlled execution |
| `admin-lint` | `retain` | RN05; useful static check with an explicit future scope decision |
| `portal-lint` | `retain` | RN05; same disposition and limitation |
| `privacy-route-static` | `retain` | RN06; retain as a narrow source tripwire, never runtime proof |
| `real-mysql-schema-preflight` | `wrap` | RN10; preserve exact metadata-only identity/DDL proof |
| `schema-plan-dev` | `wrap` | RN11; preserve canonical migration/ledger planning with structured evidence |
| `real-mysql-contract` | `wrap` | RN12; preserve guarded transaction and residue assertions |
| `admin-build` | `retain` | CP23; narrow restoration mechanism is trustworthy; process execution remains separate |
| `portal-build` | `repair` | CP24; restore every transitive generated file |
| `admin-browser-suite` | `repair` | RN16; preserve build/server/child coverage, bound and link children |
| `privacy-erm-db` | `wrap` | RN13; preserve exact-target read-only relational checks |
| `payment-db-rollback` | `repair` | RN14; bind strictly to DEV and prove rollback from transaction start |
| `intacct-local-contract` | `retain` | RN07; retain narrow local drift detection, not Sage certification |
| `ai-guidance-contract` | `retain` | RN08; retain fixture-shape authority only |
| `candidate-source-stability` | `repair` | CP07; preserve before/after drift detection with clean policy and detailed evidence |
| `test-deployment-provenance` | `repair` | CP16; add deployed schema and artifact-content proof |
| `test-rollback-readiness` | `replace` | CP17; URI strings cannot establish recoverability |
| `test-target-health` | `wrap` | RN20; preserve explicit account and registered-target health proof |
| `test-runtime-postflight` | `repair` | RN21; implement declared proof and bounded/cancellable evidence |
| `test-two-step-role-journeys` | `replace` | RN23; preserve every mapped assertion and cleanup requirement outside the monolith |
| `test-intake-completion` | `repair` | RN25; add bounded execution and independent recovery after mutation |
| `test-cfa-signing` | `repair` | RN27-RN29; preserve preflight and product assertions while removing unsafe coupling and cleanup gaps |
| `test-applicant-scope-browser` | `repair` | RN30; make identity cleanup, transport, cancellation, and progress artifacts fail closed |
| `test-live-privacy-denials` | `repair` | RN30-RN31; preserve real-token denials with route-effect cleanup and bounded execution |
| `test-payment-rollback` | `repair` | RN21; preserve the native payment assertions after postflight-mode repair |
| `test-maintenance-cleanup` | `repair` | RN21; make its inspection-only meaning and evidence exact |

## Final Phase 0 Synthesis

### Current-State Component and Dependency Summary

The current release gate is an admin-owned, sequential qualifier with 28 unique
declared checks. All 17 DEV checks and all 12 TEST checks are marked mandatory,
so the inventory's domain selection currently cannot reduce the executed set
(`docs/testing/release-coverage-inventory.json:28-60,64-283`;
`src/lib/releaseQualification.js:92-149`; this audit `:21-166,272-360`). The gate
invokes native capabilities owned by admin, portal, shared, and the Intacct mock
contract, while the qualifier owns the final decision and flat evidence record
(`scripts/path-release-qualify.js:308-405`; this audit `:159-187,362-393`).

The native capabilities span static checks, unit/component tests, local builds
and browser systems, DEV database integrations, and deployed TEST acceptance
packs. Their prerequisites, effects, timeouts, shutdown, recovery, and residue
proof remain runner-specific rather than centrally enforced (this audit
`:290-393`). The current central sequence has no prerequisite graph or common
lifecycle contract, so a failed prerequisite can be recorded without preventing
a later stateful runner (`scripts/path-release-qualify.js:352-405`; confirmed
finding 5 at this audit `:458-469`).

The 88-unit matrix therefore distinguishes useful product assertions and narrow
primitives from unsafe or incomplete execution boundaries. It supports 25
retains, 33 repairs, 20 wraps, and 10 replacements. It supports no immediate
retirement while the legacy gate remains authoritative
(`release-qualification-harness-rebuild-plan-2026-08-10.md:25-27,286-305`).

### Failure-History Conclusions

The retained `r3-r34` history contains 56 identifiable failed qualification
gates: 7 `product`, 34 `harness`, 15 `unclassified`, and none deterministically
classified as `environment` or `infrastructure` (this audit `:695-907`). The 34
harness failures demonstrate repeated weaknesses in fixtures, adapters,
selectors, evidence transport, parsing, process control, and cleanup. They do
not support replacing every native assertion engine. That evidence is why the
matrix retains or wraps narrow capabilities while replacing the shared
foundations and the main two-step monolith (CP06, CP08-CP11, CP17, CP21-CP22,
CP26, and RN23).

At least seven transitions treated harness, test-pack, documentation, or
operations-only source changes as new release candidates or deployments even
though product runtime source was unchanged. The exact sequences and Git/deploy
evidence are recorded at this audit `:867-876`. This is direct evidence that
product candidate, harness version, attempt, environment, and test-pack identity
must remain separate (`release-qualification-harness-rebuild-plan-2026-08-10.md:54-64`).

### Trusted and Reusable Assets

The following assets are supported for preservation. Retention does not make a
pack mandatory or certify its current execution boundary.

- Native React/Jest/CRACO/`node:test` assertions and exit semantics, lint rules,
  narrow privacy/Intacct/AI tripwires, and the named browser product-surface
  assertion sets (RN03-RN08 and RN17-RN19; source references in the matrices).
- The canonical live-MySQL guard and the metadata-first, per-statement identifier
  rule (`scripts/lib/live-mysql-schema-guard.js:1001-1067`;
  `docs/AGENTS.md:7-22`), plus the exact schema-preflight, schema-plan,
  transactional, relational, and residue assertions behind controlled execution
  (RN10-RN13).
- Deterministic selection, canonical hashing, evidence-ID and hashed-log
  primitives, subject to the stronger scope and validation requirements in
  CP03-CP05 and CP12 (`src/lib/releaseQualification.js:7-29,92-149`;
  `scripts/path-release-qualify.js:328-343`).
- Build manifests, immutable bundle records, release descriptors, packaged
  provenance facts, and the DEV-to-TEST-to-PROD admission relationship, subject
  to deployed-schema and rollback-usability proof (CP13-CP19;
  `scripts/lib/releaseAdmission.js:5-139`).
- The narrow TEST AWS-identity helper and all native deployed acceptance
  assertions (`scripts/lib/test-instance-aws-identity.js:5-42`; RN25-RN31).
- The complete two-step product assertion set, detailed hash-linked artifacts,
  and relationship-re-resolving cleanup-stamp capability, even though the main
  monolithic implementation is replaced (CP20 and RN23-RN24).
- The coverage inventory's domain/check knowledge, Intacct fidelity manifest,
  AI evaluation corpus, safety contract, severity scale, and verified historical
  record, with the repairs identified in CP02, CP25, and DC08-DC10.

### Duplicated or Conflicting Machinery

- Domain expansion and `alwaysRequired` duplicate one another in the current
  policy, making impact selection operationally inert
  (`docs/testing/release-coverage-inventory.json:28-60`;
  `src/lib/releaseQualification.js:92-149`).
- Qualifier and deploy compute repository fingerprints independently, with
  different missing-file and symlink behavior
  (`src/lib/releaseQualification.js:19-28`;
  `scripts/path-release-qualify.js:102-132`; `scripts/path-deploy.js:440-462`).
- Qualification uses canonical JSON hashing while deploy preflight and release
  descriptors hash insertion-order JSON
  (`src/lib/releaseQualification.js:7-16,165-168`;
  `scripts/path-deploy.js:2170-2185`;
  `scripts/lib/releaseAdmission.js:117-130`). The retained `r31` order-only
  comparison failure is the same evidenced risk class (this audit `:835`).
- Admin/portal aggregate tests, lint, and privacy checks run during qualification
  and again during deployment preflight without a shared attempt result
  (`docs/testing/release-coverage-inventory.json:28-60`;
  `scripts/lib/releaseAdmission.js:89-103`).
- Three checks invoke modes of one postflight composite and repeat AWS, instance,
  migration, and runtime prerequisites; the maintenance mode inspects status but
  is named as cleanup (`scripts/path-test-runtime-postflight.js:6-288`; this audit
  `:352,358-359`).
- Two-step, R1 intake, CFA, applicant-scope, and postflight wrappers each implement
  distinct SSM polling and output conventions; none owns reliable remote
  cancellation (CP21 and CP26).
- CFA preflight and the deployed portal CFA child import a guard from the large
  admin two-step runner, coupling repository layout and unrelated orchestration
  (`scripts/cfa-signing-schema-preflight.js:8-25`;
  `../ISET-intake/scripts/cfa-signing-smoke.js:24-31`).
- The applicant-scope outer wrapper services two separate acceptance packs, while
  browser child JSON and screenshots are flattened or left outside the parent
  evidence relationship (RN16 and RN30; this audit `:366-373,388-393`).
- The runbook's complete-blocker instruction conflicts with the safety rule that
  a failed prerequisite must stop dependent fixture effects
  (`docs/ops/deployments/release-qualification-runbook.md:151-170`;
  `docs/AGENTS.md:7-10`; this audit `:458-469`).

### Hidden Assumptions and Unsafe Couplings

The present machinery inherits ambient process environment and has no central
effect enforcement (`scripts/path-release-qualify.js:308-326`). The DEV payment
check's runner authorizes an exact TEST database as well as DEV
(`scripts/payments-workflow-smoke.js:38-71,214-264,1594-1603`), and local launcher
tests depend on ignored portal `.env`, MinIO binary, and credential inputs that
source-stability fingerprints exclude (this audit `:411-421,608-613`). One
browser child can narrow scenarios through an inherited environment selector
without the parent recording the effective pack (`scripts/release-browser-smoke-suite.js:59-65,151-155`;
`scripts/intervention-assessment-workflow-browser-smoke.js:88-128,1845-1860`).

Deployed checks assume fixed TEST account, region, ASG, pools, buckets, database
engine/host/principal, repository layout, and packaged helper presence. They also
assume bounded SSM output and polling behavior that the retained history disproves
(this audit `:340-360,366-382,828-835`). Relative cross-repository imports,
fixture-email suppression that is not proved end to end, exceptional browser
shutdown gaps, and runner-specific cleanup/recovery further couple product
assertions to local infrastructure conventions (this audit `:384-393,445-457,517-535,585-597`).
The source gate also cannot substitute for deployed schema proof, and ordinary
Intacct mock source ownership remains unresolved (this audit `:496-505,572-575`).

### Architectural Constraints

These are constraints established by the audit, not a target architecture:

- Preserve deterministic, machine-verifiable `GO/NO-GO` decisions and keep
  product candidate, harness version, attempt, environment, and test-pack
  identities distinct.
- Prove every prerequisite and exact environment identity after environment
  loading and before any dependent effect; a failed prerequisite must prevent
  fixture creation or mutation.
- Bound, cancel, and terminate local and remote work. Do not begin cleanup or a
  rerun until termination is proved.
- Give every stateful pack independent cleanup/recovery and explicit zero-residue
  evidence, including partial and forced-interruption paths.
- Structurally validate and hash-link every plan, result, child artifact, log,
  cleanup record, and final decision; preserve diagnostic partial evidence on
  interruption.
- Assign exactly one evidence-backed failure class. Unsupported attribution
  remains `unclassified` and requires a stop, not a tactical patch.
- Make cross-repository packages, ambient inputs, infrastructure expectations,
  effects, and cleanup owners explicit and versioned.
- Prove deployed artifact provenance, live schema, and rollback artifact
  existence, integrity, accessibility, and usability rather than inferring them
  from source or nonempty strings.
- Use product-owned persistent state and stable selectors. Do not depend on JSON
  property order, substring-only parsing, global UI text, transient toasts,
  guessed SQL, or implicit AWS identity.
- Certify a pack's contracts, deliberate bad cases, cleanup, and interruption
  behavior before making it mandatory. Keep the current gate authoritative while
  any replacement is advisory.

These constraints are grounded in the controlling plan
`release-qualification-harness-rebuild-plan-2026-08-10.md:54-108,170-192,253-266`
and the confirmed audit findings at this audit `:395-557,840-927`.

## Unresolved Questions and Evidence Gaps After Sprint 0D

- Dependency and third-party defaults, ignored and ambient environment inputs,
  exhaustive aggregate network isolation, screenshot ownership/retention, and
  forced-close behavior remain unproved (this audit `:168-200,599-617`).
- Ownership and intended qualification status remain unresolved for shared's
  native test, portal's standalone workflow smoke, ordinary Intacct mock changes,
  and the unexplained cleanup SQL (`:173-187,559-617`).
- No-real-email proof, payment rollback before the first insert, two-step timeout
  overlap, R1 recovery ownership, and privacy mutation cleanup remain unresolved
  (`:581-597`).
- Historical evidence remains missing or incomplete for parts of `r14`,
  `r17-r18`, `r20-r21`, `r27`, `r29`, and `r34`; `r22`, `r24`, and `r25` also
  retain opaque failed gates (`:750-768,787-839,929-968`). Read-only current source
  inspection cannot reconstruct those bytes or deterministically reclassify them.

Resolving these gaps would require separately authorized source mapping,
controlled negative/interruption certification, durable historical evidence, or
environment proof as appropriate. Sprint `0D` performed none of those actions.

## Confirmed Findings Awaiting Separate Authorization

Sprint `0D` changes no recorded severity. Sprint `0B` has 13 confirmed findings:
0 critical, 0 high, 8 medium, and 5 low (this audit `:395-557`). Sprint `0C` has
9 confirmed historical findings: 1 high, 6 medium, and 2 low (`:909-927`). None
triggers the controlling plan's automatic stop because no confirmed finding is
critical for security, privacy, data integrity, or environment safety.

The current medium findings include the DEV payment runner's TEST authorization,
failed TEST prerequisites not blocking later fixtures, unbounded local/remote
execution, inadequate rollback-readiness proof, absent deployed-schema proof,
missing postflight recent-error proof, incomplete Cognito residue proof, and
evidence validation that trusts its own declared scope. The five current low
findings cover portal generated-file restoration, admin-suite temp residue,
browser exceptional shutdown, applicant progress-file ownership, and conflated
identity. Exact evidence, impact, invariant, and stop decisions remain at this
audit `:395-557`.

The historical high finding groups seven product failures. It does not prove that
a corresponding product defect remains open in current source or any environment;
that status would require separately authorized current evidence. Historical
harness, evidence, identity, cleanup, and documentation findings remain recorded
at this audit `:909-927`. Their matrix dispositions do not authorize repair.

## Phase 1 Risks

- Designing around the most recent incident instead of the full dependency and
  failure map could reproduce a narrow, brittle harness.
- Wrapping unsafe lifecycle behavior without changing it could make defects look
  certified while retaining their effects and cleanup gaps.
- Replacing orchestration without mapping native assertions could lose valuable
  product coverage.
- An incomplete dependency model could omit prerequisites or execute expensive
  TEST effects twice during an advisory migration.
- The authoritative gate and an advisory successor could drift in coverage,
  identity, or evidence interpretation.
- Treating Phase 1 design as implicit repair would bypass the separate approval,
  negative-test, and certification controls established by the plan.

These are planning risks, not findings that authorize implementation.

## Phase 0 Deliverable Assessment

| Required Phase 0 deliverable | Evidence | Assessment |
| --- | --- | --- |
| Current-state component and dependency map | Sprint `0A` inventory at `:21-166`; Sprint `0B` maps at `:272-393` | Complete within the permitted source evidence |
| Check-by-check classification matrix | CP01-CP26, RN01-RN33, DC01-DC10, and the 28-check summary above | Complete: 88 unique units, each assigned exactly once |
| Failure-history taxonomy | Sprint `0C` at `:695-968` | Complete to retained-evidence limits; unsupported cases remain `unclassified` |
| Trusted/reusable asset list | Final synthesis above | Complete without granting certification or mandatory status |
| Architectural constraints and unresolved questions | Final synthesis and Sprint `0B` gaps | Complete as constraints and evidence gaps, not a target design |
| Updated plan checkpoint | Controlling plan checkpoint and Sprint Ledger | Complete |

All analytical deliverables required by Phase 0 are complete. The Phase 0 exit
gate is not self-executing: Bill must review this audit and explicitly authorize
Phase 1 (`release-qualification-harness-rebuild-plan-2026-08-10.md:116-135`).

## Sprint 0D Files Examined

Sprint `0D` used the completed `0A-0C` audit as its evidence baseline and checked
the controlling plan, `docs/AGENTS.md`, coverage inventory, qualifier, admission,
deploy, evidence, process, build, browser, database, TEST-runner, and cleanup
sources cited in the matrices. It also inspected the release runbook,
`docs/testing/README.md`, Intacct fidelity manifest, AI evaluation corpus,
engineering severity register, two-step assurance/workflow history, changelog,
and the cited portal/shared sources. No current environment state was inspected.

Only this audit artifact and the controlling plan were changed. No application,
harness, test, schema, configuration, retained evidence, or environment file was
changed.

## Sprint 0D Deviations and Operational Failures

No product or qualification workflow was executed and there was no unexplained
operational failure. Two broad local reads exceeded their display budget and
were replaced by narrower reads of the same permitted source. One delegated
read-only `rg` source-navigation command had a shell-quoting error and was
immediately corrected. The first read-only final-consistency parser command also
had a shell-quoting error; its corrected invocation completed successfully. A
later read-only section-anchor search also allowed a backticked pattern to expand
in the shell and returned noisy, truncated display output. These three explained
source-navigation/parser errors produced no write or operational effect. No
product or harness failure was patched or rerun.

## Sprint 0D Final Worktree State

Admin remains on `main...origin/main` with the pre-existing modified
`docs/AGENTS.md`, `docs/ops/deployments/release-qualification-runbook.md`, and
`docs/planning/README.md`, plus the pre-existing untracked current-state audit
and controlling-plan files. Sprint `0D` changed only those two authorized
untracked planning files. Portal and shared remain clean on
`main...origin/main`. Intacct mock remains the non-Git directory established in
Sprint `0A`; its failed read-only Git status was not repeated. No pre-existing
user change was reverted or overwritten outside the two authorized planning
documents.

## Sprint 0D Completion Decision

Sprint `0D` is complete, and all Phase 0 analytical deliverables are complete
pending Bill's review. No component was retired, no current gate was changed,
no repair or target architecture was designed or implemented, and Phase 1 has
not begun.

The exact approval required for proposed next work is: **Bill reviews and accepts
the completed Phase 0 audit and explicitly authorizes Phase 1, Target Architecture
and Migration Design, under a newly stated read-only, no-implementation, and
no-environment-access scope.** Any intervening repair or evidence-recovery work
instead requires a separate prompt naming the exact finding or component and its
permitted effects; it would not authorize Phase 1.
