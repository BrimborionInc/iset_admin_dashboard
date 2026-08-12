# PATH Release Qualification Harness Rebuild Plan

Status: proposed controlling plan; no implementation phase is authorized by this document.

Purpose: give Bill an externally managed, phase-gated plan that can be kept in the ChatGPT desktop app and used to issue one bounded Codex task at a time. The plan rebuilds release qualification from a dependable core while preserving useful existing tests and preventing another speculative release loop.

## Strategic Decision

Use a hybrid model with a strict authority boundary:

- LLM reasoning may inspect broadly, map dependencies, identify suspected gaps, cluster confirmed defects, propose tests, and analyze failures.
- Deterministic code owns test execution, evidence validation, cleanup, provenance, and every `GO` / `NO-GO` decision.
- The universal harness is an orchestrator of modular test packs. It is not one universal simulated workflow.
- Verification grows through unit, component/contract, integration, local-system, deployed TEST end-to-end, and post-deploy smoke layers.

## External Control Contract

Bill's ChatGPT desktop plan is the workstream controller. Codex receives one phase prompt at a time.

1. Every Codex prompt begins with the canonical `docs/AGENTS.md` link. Codex re-reads it before responding or acting.
2. A phase prompt authorizes only that phase. Codex must not begin the next phase, deploy, access TEST/PROD, or broaden scope without a new prompt.
3. Codex reports discoveries but does not silently repair adjacent product defects. Confirmed defects enter the findings register for a separately authorized repair tranche.
4. Codex does not respond to an unexplained failure by immediately patching and rerunning. It classifies the failure and returns evidence first.
5. Two unexplained failures in the same phase force a design-review stop. No third tactical attempt is allowed without Bill authorizing a revised approach.
6. A harness-only change creates a new harness version and attempt, not a new product candidate or deployment.
7. During migration, the current release gate remains authoritative. The replacement remains advisory until it completes the promotion criteria below.
8. No phase in this plan authorizes PROD operations. TEST access or mutation appears only in the expressly approved later phases.

## Sprint Governance

The phases below are programme boundaries, not single Codex tasks. Work proceeds through short sprints, each producing one meaningful, reviewable outcome.

- Bill and the ChatGPT desktop conversation steer the course and authorize one sprint at a time.
- Codex owns the detailed progress ledger: completed work, current sprint, evidence, findings, decisions, blockers, and proposed next sprint.
- Before a phase begins, its first sprint defines the proposed sprint breakdown. Later sprints cannot be started merely because they appear in that breakdown.
- Each sprint must state one objective, permitted and prohibited effects, exact deliverables, verification, and a stopping point.
- A local course correction may change implementation detail inside the approved architecture and sprint boundary. It must not silently change the architecture, testing strategy, phase objective, environment effects, or promotion standard.
- A proposed change of approach requires a pause, a comparison with the controlling strategy, a recorded reason, and Bill's approval before implementation.
- When evidence suggests the work is going wrong, assumptions are invalid, or fixes are increasing complexity without converging, Codex must stop, step back, summarize the evidence, and consult Bill. It must not continue through a patch-and-rerun sequence.
- Prefer simplifying, isolating, or removing a faulty design over adding another compatibility layer, exception, parser rule, retry, or cross-domain dependency.
- A sprint closes with a checkpoint update even when it is incomplete or blocked. Codex must never make Bill reconstruct progress from prior chat messages.

Every sprint ledger entry records:

- sprint ID and objective;
- authorized scope and effects;
- files/components examined or changed;
- evidence produced and verification completed;
- suspected and confirmed findings;
- deviations or course corrections;
- completion decision and remaining work;
- recommended next sprint and the explicit approval it requires.

## Separate Identities

Every evidence artifact must distinguish:

- `productCandidateId`: immutable admin, portal, shared, dependency, and migration fingerprints;
- `harnessVersion`: immutable fingerprint of the runner, adapters, schemas, manifests, and test-pack definitions;
- `attemptId`: one execution of one harness version against one product candidate and target;
- `environmentIdentity`: local/DEV/TEST identity proved by the applicable adapter;
- `testPackVersions`: exact versions of the selected packs.

Changing a test expectation, fixture, selector, parser, cleanup rule, transport, or evidence schema changes `harnessVersion`. It does not change `productCandidateId` unless shipped product source also changed.

## Failure Classes

The harness must produce exactly one primary classification for every failed check:

- `product`: deterministic evidence shows the candidate violated a verified contract;
- `harness`: runner, fixture, assertion, selector, evidence, cleanup, or adapter is defective;
- `environment`: the target is unavailable, unhealthy, incorrectly configured, or different from its proved contract;
- `infrastructure`: AWS, network, database engine, object store, browser runtime, or transport failed independently of candidate behavior;
- `unclassified`: evidence is insufficient; this is a mandatory stop, not permission to guess.

The LLM may recommend a classification, but deterministic evidence and the recorded contract must support it.

## Test-Pack Contract

Each modular pack must declare:

- purpose and owning product domain;
- test level: unit, component/contract, integration, local system, deployed end-to-end, or smoke;
- authoritative contract source and evidence that it was verified;
- prerequisites and environment capabilities;
- product surfaces and repositories covered;
- inputs, fixtures, identities, and external effects;
- assertions based on persistent product state rather than transient presentation where possible;
- timeout, cancellation, cleanup, and residue behavior;
- known-good and deliberate known-bad certification cases;
- maturity: `experimental`, `advisory`, `candidate`, or `mandatory`.

No pack can become `mandatory` merely because it passed once or found a real defect.

## Promotion Standard

A new runner, adapter, or pack advances only when all applicable criteria are met:

- schema-valid deterministic evidence;
- repeated identical known-good results;
- every deliberate known-bad case is rejected for the intended reason;
- timeout and forced-interruption behavior is bounded;
- cleanup is either unnecessary or independently proves zero residue;
- a failure identifies its class, phase, command, evidence, and next safe action;
- no reliance on JSON serialization order, unstructured substring matching, global UI text, guessed SQL, implicit AWS identity, or inferred infrastructure capability;
- source, harness, and attempt identities remain separate and reproducible.

Recommended certification baseline for fast local layers: ten consecutive known-good runs, all deliberate negative cases, and one forced interruption. Expensive TEST packs require three clean runs on separate attempts after their component adapters are already certified. These thresholds may be revised only in the architecture phase with a recorded reason.

## Phase Plan

### Phase 0 - Current-State Audit

Mode recommendation: `Ultra`, but read-only and bounded.

Scope:

- inventory the current qualifier, coverage map, deploy admission, evidence validation, and every invoked runner across admin, portal, shared, and Intacct mock;
- map test levels, effects, target dependencies, SQL/AWS/browser usage, cleanup ownership, and coupling between checks;
- trace the r3-r34 failures to product, harness, environment, infrastructure, or unclassified causes;
- identify duplicated machinery, ad hoc parsers, oversized scripts, hidden environment assumptions, and checks that are mandatory regardless of changed domain;
- classify each existing component `retain`, `repair`, `wrap`, `replace`, or `retire` with evidence.

Prohibited: code changes, test changes, SQL, database connections, AWS, browser execution, builds, deployments, fixture creation, and moving to Phase 1.

Deliverables:

- current-state component and dependency map;
- check-by-check classification matrix;
- failure-history taxonomy;
- trusted/reusable asset list;
- architectural constraints and unresolved questions;
- updated plan checkpoint.

Exit gate: Bill reviews the audit and explicitly authorizes Phase 1.

Proposed Phase 0 sprint sequence, subject to separate authorization:

- `0A`: inventory qualification entry points, checks, runners, evidence artifacts, and source ownership;
- `0B`: map dependencies, side effects, environment boundaries, cleanup ownership, and test levels;
- `0C`: classify the r3-r34 failure history from retained evidence;
- `0D`: produce the retain/repair/wrap/replace/retire assessment and Phase 0 synthesis.

### Phase 1 - Target Architecture and Migration Design

Mode recommendation: `Extra High`; use `Ultra` only if the audit exposes a genuinely ambiguous cross-system design decision.

Scope:

- design the minimal orchestration kernel;
- define versioned JSON schemas for plan, execution event, check result, failure, cleanup, and final evidence;
- define adapter and test-pack interfaces without implementing them;
- define selection rules for mandatory core checks, impacted-domain packs, scheduled full regression, and explicitly requested suites;
- design the parallel advisory migration from the existing gate;
- define repository/file ownership and how harness source is kept out of product-candidate identity when it is not shipped;
- write architecture decisions for SQL safety, JSON comparison, process control, browser selectors, fixture lifecycle, AWS identity, and remote transport.

Prohibited: executable harness changes, environment access, and migration of existing checks.

Deliverables:

- approved architecture document;
- versioned schema drafts;
- interface contracts;
- migration sequence and rollback plan;
- acceptance criteria for Phase 2.

Exit gate: Bill approves the architecture and the exact Phase 2 file scope.

### Phase 2 - Pure Local Kernel

Mode recommendation: `High` or `Extra High`.

Scope:

- implement only plan loading, schema validation, deterministic check selection, bounded process execution, log capture, cancellation, failure classification plumbing, and evidence emission;
- use synthetic commands and fixtures owned by the harness tests;
- add kernel unit and integration tests.

Prohibited: PATH application imports, MySQL, AWS, browsers, HTTP servers, builds, existing release checks, TEST, and PROD.

Required negative cases:

- malformed plan and evidence JSON;
- unknown check and dependency cycle;
- child nonzero exit;
- timeout and forced process termination;
- missing/truncated/corrupted result;
- cancellation during execution;
- source or harness fingerprint drift.

Exit gate: ten consecutive clean certification runs, all negative cases passing, `git diff --check`, focused aggregate coverage, and Bill review.

Advisory Phase 2 sprint sequence, subject to separate Bill authorization for
every sprint:

- `2A`: create only the isolated package boundary, six executable schemas,
  canonical JSON/hashing, five identity primitives, strict schema/identity
  validation, synthetic identity fixture, and focused tests;
- `2B`: add semantic plan admission and the synthetic deterministic MC2
  selection/dependency boundary, without PATH mappings or command execution;
- `2C`: add the deterministic lifecycle and append-only evidence emitter using
  synthetic in-process events and cleanup markers, without child processes;
- `2D`: add bounded local process control, cancellation, whole-tree termination,
  and the approved synthetic child-command fixtures, without PATH commands;
- `2E`: add independent final-evidence validation, the thin package CLI, full
  pure-local integration, and the cumulative Phase 2 certification gate.

This breakdown is advisory only. Recording it authorizes none of `2B-2E`, does
not change the Phase 2 exit gate, and does not allow any later sprint to start
automatically.

### Phase 3 - Read-Only Local Checks

Scope:

- migrate or wrap low-risk checks first: source inventory, unit aggregates, lint, static analysis, and source stability;
- keep their native test runners authoritative for product assertions;
- make the new kernel orchestrate and collect evidence without interpreting product semantics;
- compare new advisory results with direct command results.

Prohibited: database, AWS, browser, deployed environment, and stateful fixture checks.

Exit gate: five consecutive identical advisory runs, deliberate failing-test detection, no disagreement with direct commands, and Bill review.

Advisory remainder sequence, recorded after Bill accepted Sprint `3A` and
subject to separate Bill authorization for every sprint:

- `3B`: certify `privacy-route-static` as a narrow advisory source tripwire,
  including its existing in-memory guard-removal mutations, without claiming
  runtime authorization coverage;
- `3C`: certify `intacct-local-contract` against exact admin/mock source inputs
  and a qualification-owned deliberate-drift mirror, without claiming Sage
  service certification;
- `3D`: certify admin `src` ESLint with explicit no-cache/no-fix scope;
- `3E`: extend the certified lint boundary to portal-owned config, lock and
  `src` scope;
- `3F`: wrap and certify the admin frontend/backend aggregate only after every
  ambient input, local effect, descendant and residue owner is explicit;
- `3G`: wrap and certify portal CRACO/`node:test` aggregate discovery and phase
  evidence under the same bounded rules; and
- `3H`: certify role-aware source inventory and before/after source stability
  across the accepted Phase 3 roles without invoking the current qualifier.

The exact file/input/command/effect/negative/parity/identity/interruption/
regression scope and stopping point for each sprint are normative in
[the target architecture](./release-qualification-harness-target-architecture-2026-08-10.md#phase-3-remaining-sprint-breakdown).
An aggregate that cannot prove its known ambient prerequisites or zero residue
stops for a separately authorized repair; later sprints do not continue around
it. Every pack remains advisory. After `3H`, five frozen-identity cohort
attempts must match every direct command with no unexplained disagreement, then
Bill reviews Phase 3. Recording this sequence authorizes none of it.

### Phase 4 - Local Process, Build, HTTP, and Browser Adapters

This phase is issued as separate prompts in this order:

1. process/build isolation and generated-file restoration;
2. local HTTP readiness and shutdown;
3. product-owned browser boundary and persistent-state selectors;
4. one deterministic compiled-browser pack.

Each adapter must complete its own known-good, known-bad, timeout, and interruption certification before the next prompt. Do not migrate the full browser suite in one step.

Exit gate: every adapter certified independently and the one browser pack repeatable without global text selectors, transient toast requirements, external services, or database effects.

### Phase 5 - Database Adapter and Local Transaction Packs

Scope order:

1. metadata-only target identity and one-object-at-a-time DDL discovery;
2. structured statement declarations and per-statement admission;
3. read-only queries;
4. one rollback-only synthetic fixture;
5. forced-failure rollback and zero-residue proof.

Non-negotiable controls:

- follow `docs/AGENTS.md` and `docs/ops/agent-operational-access.md` exactly;
- never guess schema, aliases, functions, enum values, or relationships;
- do not create an ad hoc SQL parser from regular expressions or string fragments;
- preflight precedes every fixture effect;
- a pre-mutation failure closes without cleanup SQL;
- a post-mutation failure rolls back and runs guarded residue assertions.

Exit gate: independently certified adapter, deliberate schema/statement rejection, successful rollback fixture, forced-interruption recovery, zero residue, and Bill review.

### Phase 6 - Change-Impact Selection and Test-Pack Migration

Scope:

- replace the current all-checks-always model with a small mandatory core plus dependency-expanded domain packs;
- migrate reliable existing tests by level and domain;
- keep full regression available as an explicit or scheduled suite;
- prove that representative changes select every required pack and that unknown files/operations fail closed;
- prove that unrelated domains are not selected without a declared dependency.

Exit gate: deliberate selection/omission mutation tests, documented coverage ownership, no unmapped runtime source, and Bill approval of the selection policy.

### Phase 7 - Read-Only TEST Control Plane

Mode recommendation: `Extra High`.

Requires a new prompt with explicit TEST authorization.

Scope:

- prove explicit `nwac-test` profile and account;
- add immutable deployment-manifest validation, provenance comparison, rollback-artifact presence, target health, and bounded remote transport;
- perform no TEST deployment, SQL, Cognito creation, S3 upload, or fixture mutation;
- certify environment and infrastructure failure classification.

Exit gate: three repeatable read-only TEST runs, deliberate stale/mismatched evidence rejection, bounded transport failure, and Bill review.

### Phase 8 - First Stateful TEST Domain Pack

Requires separate approval for the exact identities, relational/object fixtures, external effects, cleanup, maintenance state, and test duration.

Select one bounded critical domain whose local component tests and adapters are already certified. Do not begin with a cross-domain concurrency journey.

Required sequence:

- metadata and environment preflight;
- fixture plan validation;
- fixture creation;
- one deployed workflow contract;
- persistent-state assertions;
- transactional/owned cleanup;
- independent zero-residue verification.

Exit gate: three clean attempts, deliberate product-failure detection in a controlled candidate, deliberate harness-fixture failure classified correctly, interruption recovery, and zero residue.

### Phase 9 - Advisory Parallel Operation

Scope:

- run the new harness alongside the current gate on several ordinary change candidates;
- compare selection, results, duration, diagnostics, and cleanup;
- investigate every disagreement without automatically changing either system;
- maintain a decision log for which system was correct and why.

Exit gate: an agreed observation window, no unexplained disagreement, stable evidence, and a reviewed cutover recommendation.

### Phase 10 - Controlled Promotion and Legacy Retirement

Scope:

- promote certified packs from advisory to mandatory individually;
- update deploy admission to accept the new evidence only after dual-run proof;
- retain rollback to the prior gate during an agreed observation period;
- retire legacy scripts only when their coverage is mapped to certified replacements or deliberately removed with approval;
- update the authoritative runbooks and coverage inventory.

Exit gate: Bill explicitly authorizes cutover. PROD use remains a separate release decision.

### Phase 11 - Deliberate Complexity Growth

After the foundation is authoritative, add broader role journeys, cross-app signing, notifications, concurrency, privacy denials, payments, and recovery scenarios as separate packs. Each follows the same experimental-to-mandatory promotion path. The LLM may propose batches around shared invariants, but no batch bypasses component proof or pack certification.

## Confirmed-Findings Register

During every phase, record potential product weaknesses separately with:

- status: `suspected`, `confirmed`, `rejected`, `deferred`, or `repaired`;
- exact evidence and affected invariant;
- severity and realistic impact;
- related findings that genuinely share a cause;
- recommended unit/integration/system/end-to-end coverage;
- whether repair is required before harness work can safely continue.

Only a confirmed critical security, privacy, data-integrity, or environment-safety issue automatically stops harness work. Other confirmed findings wait for Bill to authorize a coherent product-repair tranche.

## Standard Codex Prompt Preamble

Use this at the start of every phase prompt:

```text
Read and obey [docs/AGENTS.md](/home/bill/ISET/admin-dashboard/docs/AGENTS.md) before addressing this prompt.

The controlling plan is [release-qualification-harness-rebuild-plan-2026-08-10.md](/home/bill/ISET/admin-dashboard/docs/planning/release-qualification-harness-rebuild-plan-2026-08-10.md). Work only on Phase <N>: <name>.

Do not begin a later phase. Do not deploy or access TEST/PROD unless this prompt expressly authorizes that exact operation. Do not repair adjacent product findings; record them separately with evidence. On an unexplained failure, stop, classify it, and report the evidence rather than patching and rerunning. Two unexplained failures end the phase pending design review.

Before acting, restate the phase boundary, permitted effects, prohibited effects, deliverables, and exit gate. Then perform the phase end to end and update the controlling plan checkpoint. Return the outcome, evidence, unresolved risks, and the exact next approval required. Do not continue automatically.
```

## Sprint 0A Codex Prompt

```text
Read and obey [docs/AGENTS.md](/home/bill/ISET/admin-dashboard/docs/AGENTS.md) before addressing this prompt.

Execute only Sprint 0A of Phase 0, Current-State Audit, from [release-qualification-harness-rebuild-plan-2026-08-10.md](/home/bill/ISET/admin-dashboard/docs/planning/release-qualification-harness-rebuild-plan-2026-08-10.md).

This is read-only analysis. Do not change application code, harness code, tests, schemas, configuration, or environments. Do not run SQL, connect to a database, use AWS, launch browsers, run builds, deploy, or create fixtures. Inspect repository source, test definitions, package scripts, retained evidence, and current documentation only.

Produce only the qualification inventory: entry points, checks, invoked runners, evidence artifacts, repository/file ownership, and source references. Do not yet classify components, map runtime dependencies, analyze r3-r34 failures, or propose the target architecture. Update the controlling plan's sprint ledger and the Phase 0 audit artifact, then stop. Do not start Sprint 0B.
```

## Desktop-App Review Checklist After Every Phase

Before issuing the next Codex prompt, confirm:

- Did Codex remain inside the authorized phase and effect boundary?
- Does every claim point to source, test output, or authorized environment evidence?
- Were suspected findings kept separate from confirmed defects?
- Was any failure classified before a change or rerun?
- Did Codex stop after the permitted number of unexplained failures?
- Are product candidate, harness version, and attempt identities still separate?
- Did the phase meet every exit criterion, including negative and interruption tests?
- Is the worktree state explicit, and were pre-existing user changes preserved?
- Did Codex update the checkpoint without marking later phases complete?
- Is the exact next approval stated rather than assumed?
- Did a minor course correction remain local, or did it actually change the agreed approach and therefore require consultation?
- Did Codex stop when complexity increased without clear convergence?

## Current Checkpoint

- Plan created: 2026-08-10.
- Current authorized phase/sprint: none; the corrected Phase 3 exit exercise stopped incomplete on a second deterministic defect in the one-off operator before completing its first pack graph. The authorized residue correction passed, but the operator unconditionally dereferenced the process controller's valid nullable `cancellation` field. No repair or rerun followed. Exactly zero of five required complete cohort attempts exist, so Phase 3 remains incomplete. The certified five-pack and Sprint `3H` source-state contracts, `portal-aggregate` deferral, RN02/RN04, current authoritative gate, maturity and release authority remain unchanged. The controlling step-back rule now requires a separately authorized read-only exit-operator design review before any further execution; Phase 4 remains unauthorized.
- Phase 0 audit artifact: [release-qualification-harness-current-state-audit-2026-08-10.md](./release-qualification-harness-current-state-audit-2026-08-10.md) (`0A` inventory, `0B` dependency/effect map, `0C` retained-history classification, and `0D` component dispositions and synthesis). Bill reviewed and accepted the completed audit and explicitly authorized Phase 1/Sprint `1A`; the Phase 0 exit gate is satisfied.
- Sprint `0B` severity correction: the project severity scale is now applied to all 13 confirmed findings: 0 critical, 0 high, 8 medium, and 5 low. No finding triggers the automatic-stop rule.
- Sprint `0C` taxonomy: 56 identifiable failed qualification gates, counted once at the outer check or, for the two `r18` targeted attempts whose outer artifact is absent, once at the independently retained causal check: 7 `product`, 34 `harness`, 0 `environment`, 0 `infrastructure`, and 15 `unclassified`. Narrative/interrupted events with no named machine check remain separate. No Sprint `0C` finding is critical and no automatic stop applies.
- Sprint `0D` disposition assessment: 88 unique material units, each classified exactly once: 25 `retain`, 33 `repair`, 20 `wrap`, 10 `replace`, and 0 `retire`. The current gate remains authoritative and no disposition authorizes implementation or retirement. Sprint `0D` changed no recorded severity and found no critical automatic-stop condition.
- Sprint `1A` architecture foundation: [release-qualification-harness-target-architecture-2026-08-10.md](./release-qualification-harness-target-architecture-2026-08-10.md) records the charter, 21 mandatory evidence-derived constraints, four preferences, four unresolved evidence groups, conceptual system and authority boundaries, 19 open/fixed decision records, the advisory `1B-1G` sprint sequence, and the Phase 1 completion map. It does not finalize detailed architecture, schemas, interfaces, migration, repository ownership, selection policy, or Phase 2 files. Phase 1 remains incomplete.
- Sprint `1B` identity/authority foundation: the target-architecture document defines the five identity inputs/producers/immutability/lifecycle/consumers, 31 representative change-to-identity cases, deterministic producer/validator/consumer authority, 14 evidence-lineage invariants, completeness/conflict/replay/staleness rules, and four repository-ownership options. Bill approved O1: a bounded admin-owned control plane with product-native tests retained in their owning repositories, explicit cross-repository role manifests, and no product-runtime import of harness code. O2 is not selected.
- Sprint `1C` kernel/lifecycle foundation: the target-architecture document defines the minimal domain-neutral kernel boundary, serial stable topological execution, complete invocation/attempt/check/cleanup/residue/validation lifecycle, fail-closed prerequisite and effect gating, bounded process/cancellation/termination behavior, deterministic failure and cleanup coordination, conceptual interface handoffs, 25 synthetic Phase 2 acceptance cases, and 16 traced decisions. Detailed schemas, adapter/pack interfaces, selection policy, migration/cutover, Phase 2 files, implementation, and repairs remain deferred; Phase 1 remains incomplete.
- Sprint `1D` evidence foundation: the target-architecture document defines a normative common envelope and exactly six `1.0.0-draft.1` field-level schema drafts, `RQ-C14N-1` structural/canonical comparison and SHA-256 linkage, a 16-step independent validation sequence, schema evolution/compatibility rules, 38 identity/lineage/lifecycle verification rows, and 16 traced decisions. Bill accepted R4: immutable content-addressed durable evidence, a searchable catalog, and a non-authoritative local cache. Backend/provider, durations, access/hold/deletion authority, operating owner, and cost remain Bill-reserved by Sprint `1G`.
- Sprint `1E` adapter/safety foundation: the target-architecture document defines one common adapter contract with 10 conceptual operations; closed `RQ-CAP-1` capabilities, four environment classes, and six exact effect classes; process/build, filesystem/source, local HTTP, browser, database, AWS/environment-identity, remote-transport, and fixture/cleanup/residue contracts; the mandatory eight-stage database sequence; the IAM permission-gap stop/escalation record; an eight-row failure-evidence map and eight-row later-certification matrix; and 22 traced decisions. No executable adapter/schema, IAM/configuration change, implementation, repair, workflow, environment operation, or check migration occurred; Phase 1 remains incomplete.
- Sprint `1F` pack/selection/certification foundation: the target-architecture document defines the normative modular pack contract; native product-assertion authority; four maturity levels and separate operating states; the unchanged 10-local/3-TEST certification minimum; 13 change-invalidation classes; deterministic impact/dependency/full-regression selection; three mandatory-core options; mapping ownership/mutation rules; a no-loss ledger covering all 88 Phase 0 units, all 28 checks, and all 13 browser children; an 18-row verification matrix; governance authority; and 22 traced decisions. Bill approved MC2: deterministic control/provenance core, operation-triggered safety gates, dependency-expanded impacted packs, and explicit/scheduled full regression.
- Sprint `1G` architecture integration: the target architecture defines advisory prerequisites/direct comparison, unchanged Phase 2-10 sequence, recommended 30-day/10-candidate observation window, cohort promotion/retirement, 12-trigger rollback, immutable disagreement and deploy-admission/emergency boundaries, an AWS S3 Object Lock/DynamoDB/KMS R4 operating recommendation with proposed retention and bounded IAM decisions, an 18-row responsibility matrix, an isolated exact `qualification/` Phase 2 scope, cumulative Phase 2 acceptance, bounded Sprint `2A`, consistency review, Phase 1 completion assessment, and 26 traced decisions. Bill subsequently accepted Phase 1, R4, and the exact Phase 2 scope. No Phase 1 implementation, migration, storage/IAM/CI/admission change, promotion, retirement, workflow, environment operation, or test occurred.
- Sprint `2A` evidence foundation and bounded schema correction: the private `qualification/` package contains the exact isolated dependency lock/role boundary; qualification-plan and final-evidence `1.0.0-draft.2` contracts; execution-event, check-result, failure, and cleanup-result `1.0.0-draft.1` contracts; strict `RQ-C14N-1` parsing/canonical SHA-256 hashing; the five separated identity primitives; structural/digest/identity validation; inert synthetic candidate bytes; and focused tests. The later Sprint `1F`/MC2 origin vocabulary is canonical and `explicit-request` is rejected. Structural comparison proves the four retained schemas resolve only unchanged plan `$defs`, so their accepted-instance sets do not change. Verification passed 60/60 assertions and strict compilation of all six schemas. The final authorized file set contains no PATH import, current check, process-control/lifecycle/selector/adapter/environment capability, and no environment or product workflow was accessed or executed. The cumulative Phase 2 certification gate is not yet satisfied.
- Sprint `2B` semantic admission and selection: the private package now strictly validates content-addressed synthetic policy/registry inputs bound to `harnessVersion`; deterministically selects MC2 core, impact, dependency, explicit-suite, scheduled-full, and release-operation scope; rejects unknown scope, stale/conflicting identities, dependencies/cycles/exclusions/target/capability/maturity/effect/cleanup defects; emits stable order and selection digests; and independently reconstructs every admitted plan identity, authority, scope, check, pack, dependency, prerequisite, capability, effect, command, budget, cancellation, cleanup, and lineage field. Focused verification passed 57/57 assertions and the combined package suite passed 117/117. No lifecycle, process, command, adapter, evidence assembly, final validator, PATH mapping/check, environment, or later sprint work occurred.
- Sprint `2C` deterministic lifecycle and in-process evidence: the private package binds every selected check to one attempt; enforces scoped prerequisite, check, timeout/cancellation, cleanup, residue, finalization, validation, and advisory transitions; emits immutable schema-valid gap-free predecessor-chained execution events from explicit timestamps and synthetic markers; rejects or quarantines stale/conflicting/out-of-order evidence; and produces deterministic event/artifact graph hashes. Focused verification passed 25/25 assertions and cumulative direct verification passed 142/142. No child process, command, PATH mapping/check, adapter, environment, independent final validator, admission, or later sprint work occurred.
- Sprint `2D` bounded synthetic process control: the private package admits only exact content-digested Node fixture commands, complete argv/cwd/env declarations, and unique command instances; captures bounded structured output; enforces startup/execution/idle/total and shutdown/termination budgets; coordinates idempotent cancellation and graceful-to-forced whole-Linux-process-group termination; rejects replay, drift, malformed/stale/conflicting evidence, and unproved termination; and uses only the seven approved synthetic fixtures. Focused verification passed 28/28 and the cumulative package suite passed 170/170. No PATH mapping/check/import, adapter, network, environment, independent final validator, CLI, admission change, or later sprint work occurred.
- Sprint `2E` pure-local integration and independent validation: the private package now composes already admitted plans, deterministic selection, lifecycle/event emission and bounded synthetic process control; validates the complete execution/effect/prerequisite/cleanup set before dispatch; blocks failed prerequisites and dependencies without dispatch; assembles content-addressed results, failures, cleanup/residue evidence and advisory final evidence; and hands the serialized bundle to a validator that does not import kernel or emitter state. The validator independently checks exact schema/digest bytes, identity/plan lineage, selection, event order, results, failures, cleanup/residue, attachments and advisory status, and always reports `releaseAuthority: none`. The stdin/stdout CLI exposes only strict `plan`, `run`, and `validate`; its serialized `run` operation is limited to read-only synthetic work. Focused verification passed 15/15 and the cumulative package passed 185/185, including ten fresh known-good attempts under one frozen `harnessVersion`, the 25 synthetic Phase 2 case families, a stateful marker cleanup with independent zero-residue proof, deterministic reassembly, schema-valid semantic tampering, and CLI boundaries. Syntax, dependency, metadata, import-boundary and whitespace checks passed. No PATH check/import, adapter, network, HTTP, browser, database, AWS, environment, deployment, admission change, or later-phase work occurred.
- Sprint `3A` first advisory read-only native pack: `qualification/` contains a strict one-pack/one-registry role boundary for `ai-guidance-contract`; exact package-alias, native-script, default-fixture, deliberate-invalid-fixture and interruption-fixture digests; a bounded native read-only bridge; and an identity-aware direct/advisory comparator that treats the unchanged native exit status as semantic authority and never parses its human output. The pack remains `advisory`; its registry has certification-only selection authority and no release authority. Exact direct known-good passed with 21 fixtures, and the deliberate duplicate-ID fixture exited `1` with one native error. Focused verification passed 10/10: ten frozen-identity advisory passes, five additional direct/advisory matches, deliberate failure parity, stale/broadened input and disagreement rejection, forced timeout and process-tree absence, and five-identity separation. Cumulative qualification verification passed 195/195. No selector, kernel, schema, native checker/default fixture, release gate, environment, network, HTTP, browser, database, AWS, deployment, admission, promotion, retirement, or later check changed or ran.
- Phase 3 governance correction: the target architecture now defines the proposed `3B-3H` sequence for privacy static analysis, Intacct source-contract inspection, admin and portal lint, admin and portal native aggregates, and final role-aware source inventory/stability. Every sprint has one objective, exact proposed files/inputs/commands/effects, negative/parity/identity/interruption/regression proof, stop point and separate approval. The original exit gate is mapped to per-pack ten-run certification, five additional paired comparisons, a final five-attempt cohort, deliberate failures, zero disagreement and Bill review. Aggregate non-convergence inserts a separate repair decision; no threshold, maturity, authority or phase boundary changed.
- Sprint `3B` advisory privacy source-tripwire pack: the shared validator/bridge/comparator/CLI now admit exactly the retained `3A` pack and `privacy-route-static`; the new pack content-binds both native aliases, package/lock, runner/helper/focused test/Jest config and entry, admin server/widget, exact portal server, and interruption fixture. The unchanged native smoke passed 71/71 checks and the focused Jest authority passed 3/3 tests including its four guard-removal mutations. Focused certification passed 9/9 and cumulative qualification verification passed 204/204, including ten frozen-identity advisory passes, five direct matches, strict drift/broadening/command/disagreement negatives, unchanged input bytes, identity separation and forced termination. The pack remains advisory source-tripwire evidence with no runtime-authorization or release authority.
- Sprint `3C` advisory Intacct local-source contract pack: the cumulative registry now contains exactly the accepted `3A`, `3B`, and `intacct-local-contract` packs. The new pack binds the unchanged native alias/script/manifest, exact admin server and non-Git sibling mock server, negative mirror corpus and interruption fixture. The direct native audit passed 18/18 declared local checks while retaining seven explicit Sage-fidelity gaps. Focused certification passed 9/9 with ten advisory successes, five direct matches, deliberate warning/failure parity, path/digest/input/disagreement negatives, five-identity separation, forced termination and zero mirror residue. The deterministic cumulative run passed 213/213. The pack remains advisory local source evidence with no Sage, deployed-service, promotion or release authority.
- Sprint `3D` advisory admin lint pack: the cumulative registry now contains exactly four accepted advisory packs. `admin-lint` binds the unchanged native package alias, package/lock, ESLint config/entry, 16 resolved ESLint/config/plugin package trees and all 631 current `src/**/*.{js,jsx}` files; cache, fix and scope broadening fail closed. The direct native lint exited `0` with only its retained Browserslist freshness notice, and the qualification-owned native `no-undef` negative exited `1`. Focused certification passed 10/10 with ten advisory successes, five direct matches, drift/command/scope/disagreement negatives, identity separation, forced termination and no source/cache residue. The deterministic cumulative run passed 223/223. The pack remains advisory with exact `src`-only scope and no promotion or release authority.
- Sprint `3E` advisory portal lint pack: the cumulative registry now contains exactly five accepted advisory packs. `portal-lint` binds the unchanged portal alias and package-level ESLint configuration, portal package/lock/entry, 16 resolved lint package trees and all 100 current portal `src/**/*.{js,jsx}` files. The native lint exited `0`; the qualification-owned negative explicitly loaded portal `package.json` configuration and exited `1` for `no-undef`. Focused certification passed 10/10 and deterministic cumulative verification passed 233/233, including ten frozen advisory runs, five direct matches, portal/admin identity and cwd separation, drift/command/disagreement negatives, forced termination and no source/cache residue. The pack remains advisory with no promotion or release authority.
- Sprint `3F` admin aggregate admission stop: current source still places `tests/releaseAdmission.test.js` inside the backend aggregate and creates three OS-temporary directory trees without teardown. The same aggregate evaluates `tests/localDevLaunchers.test.js`, whose source reads ignored portal `.env`, MinIO binary, and credential inputs before validating the launch plan. Those prerequisites are not content-bound, redacted certification inputs. The approved `3F` completion rule therefore stopped work before pack implementation, registry changes, `npm test`, mirrors, or native dispatch. No product, native test, qualification code, environment, residue, or release authority changed.
- Sprint `3F-R1` native aggregate blocker repair: the three release-admission temporary-tree families and the launcher contract's new synthetic workspace are now attempt-owned, removed in `afterEach`, and independently checked for zero residue. The launcher accepts explicit synthetic portal environment, ambient environment, platform, and MinIO-binary inputs while retaining its unchanged no-argument runtime defaults. Focused verification passed 3/3 suites and 18/18 assertions, including the unchanged aggregate-order contract. One initial `EPERM` was classified as the execution sandbox denying two existing local Node dry-run children; the identical focused command passed under the bounded local-test permission. No pack, native aggregate, service, network, environment, qualification gate, or later sprint ran.
- Sprint `3F` reauthorized admission stop: the single exact `npm test` admission command passed frontend 84/84 suites and 417/417 assertions, then backend 45/45 suites and 433/433 assertions with correct order and zero exit. It also proved that selected backend tests import `isetadminserver.js`, whose initialization reads the repository-local `.env` with override semantics and selected the environment-dependent OpenRouter-key-present branch. The input is neither synthetic nor content-bound/redacted, so the result cannot enter the certification corpus. Per Bill's stop rule, no pack or repair was attempted and no rerun occurred.
- Sprint `3F-R2` synthetic-environment repair: no tracked explicitly non-secret test environment file/template was available, so the exact four-file repair added an attempt-owned `synthetic.env`, exact non-ambient child environment, fail-closed server test binding, success/failure teardown and independent zero-residue proof while preserving DEV/PROD environment resolution and native phase order. Focused verification passed 2/2 suites and 8/8 assertions; final `npm test` passed frontend 84/84 suites and 417/417 assertions plus backend 46/46 suites and 438/438 assertions. Syntax, diff, whitespace and residue checks passed; no ignored environment contents, credential, service, network, environment, gate or later sprint was accessed.
- Sprint `3F` reauthorization identity stop: before implementation, the existing validator rejected `privacy-route-static@1.0.0` and `intacct-local-contract@1.0.0` with `INPUT_FINGERPRINT_DRIFT` because both bind the pre-`3F-R2` `isetadminserver.js` SHA-256 `df3272bc...`, while the accepted repair's bytes hash to `527228e8...`. Their pack manifests and recertification corpora are outside the corrected `3F` editable scope, so cumulative certification cannot pass without violating the accepted invalidation rules. No native/advisory/negative/cumulative command or pack implementation ran.
- Sprint `3F-R3`/`3F-R4` identity-repair sequence: `privacy-route-static` and `intacct-local-contract` remain `1.0.1` against the accepted server bytes. Pre-edit all-pack validation proved those two packs plus `ai-guidance-contract@1.0.0` and `portal-lint@1.0.0` valid, with only `admin-lint@1.0.0` stale. `3F-R4` advances admin lint to `1.0.1`, binds exact source digest `6f4611...`, and preserves its native command, effects, maturity and authority. Focused certification passed 10/10 and full cumulative qualification passed 233/233.
- Sprint `3F` backend-negative certification stop: the bounded `admin-aggregate@1.0.0` advisory implementation passed the direct aggregate admission, ten frozen advisory runs, five additional direct/advisory pairs, frontend deliberate failure, lifecycle-evidence negatives, forced interruption and identity checks. The backend deliberate-negative advisory exited `1` as expected but its derived phase evidence was invalid; the assertion stopped before exact phase, cleanup/residue and parity assertions. The failed test retained neither marker counts nor captured streams, so the cause is `unclassified`. No repair or rerun followed; an independent read-only `/tmp` check found no relevant attempt residue, and the cumulative qualification suite was not run.
- Sprint `3F-D1`/`3F-R5`: the retained diagnostic proved the backend profile stopped in frontend because the mirror omitted native-test inputs. Pre-edit closure enumeration found five missing tracked reads, so the first R5 authorization stopped; the corrected authorization adds exactly those five beside the existing declared migration. `admin-aggregate` advances to `1.0.1` with product-scope digest `877c62...`, manifest digest `496bf8...`, and registry digest `b7e736...`. Its single backend negative and complete focused certification passed 11/11. Cumulative qualification stopped at 243/244 because the shared bridge removes the Intacct deliberate-drift mirror but reports cleanup `unnecessary` rather than `completed`; no relevant residue remained, and no repair/rerun followed.
- Sprint `3F` convergence review: the physical Intacct mirror cleanup is isolated and succeeded, but the shared design is not converging. The bridge infers cleanup authority from the aggregate-only `residueBaseline` implementation field instead of an admitted per-operation cleanup contract; all six packs hash the same bridge while binding the same adapter ID to versions `1.0.0` through `1.5.0`, and the runtime result remains `1.0.0`. The exact behavioral cleanup boundary covers Intacct and aggregate; the immutable adapter/harness certification boundary covers all six active pack versions. No permission, IAM, environment, credential or configuration change can repair this deterministic local evidence defect.
- Sprint `3F-C1-R1` completion: bounded verification `3F-C1-R1-V1` used correctly constructed fresh advisory/direct attempt identities and passed the single Intacct deliberate-drift parity proof. It observed process protocol `1.0.0`, native result `2.0.0`, expected matching native failures, completed cleanup, independent zero residue and `releaseAuthority: none`; no mirror or process residue remained.
- Sprint `3F` Intacct scope reconciliation: Bill's controlling product fact establishes that the rudimentary sibling simulator is not part of live PATH. Source proves the current check is a mandatory inventory-configured PATH/mock substring guard, not Sage certification or a dependency of runtime, deployment, another check or candidate stability. Live-product envelope/sender assertions remain in the admin aggregate. CODEX recommends removing the pack from the active Phase 3 set and retaining its native/local artifacts outside qualification; merely labelling it non-blocking would not remove its active registry, shared-adapter or exit-cohort coupling. No implementation or command ran.
- Next required decision/proposed work: Bill authorizes the exact `3G-S1` scope correction recorded in the architecture to add only the six existing exact-graph certification files, preserve their semantic assertions, and reauthorize `3G` under its existing objective, inputs, commands, effects, verification and stop point. The current authoritative gate remains unchanged.
- Environment operations authorized: none.
- Product or harness implementation authorized: none currently. Sprints `2A` through `3F` have ended. `3G` made no implementation change and remains paused at its governance stop; no scope correction, portal aggregate, current-gate change or later implementation is authorized.
- Existing release gate status: remains authoritative during the advisory rebuild.
- PROD use/cutover authorized: no.

## Sprint Ledger

| Sprint | Status | Outcome/evidence | Next approval |
| --- | --- | --- | --- |
| Plan setup | completed | Controlling plan, external-control contract, sprint governance, and copy-ready Sprint 0A prompt created | Bill authorization for Sprint `0A` |
| `0A` | completed | [Qualification inventory](./release-qualification-harness-current-state-audit-2026-08-10.md) records the entry points, 28 unique declared checks, invoked runners, evidence artifacts, repository/file ownership, source references, and separated suspected findings. No runtime or environment operation was performed. | Bill explicitly authorizes Sprint `0B` under the existing read-only prohibitions |
| `0B` | completed | [Dependency and effect map](./release-qualification-harness-current-state-audit-2026-08-10.md) records all DEV/TEST check levels, transitive runners, process/build/HTTP/browser/SQL-database/AWS/filesystem/network/identity/fixture/deployed boundaries, declared effects, environment proof, timeout/cancellation/cleanup ownership, evidence coupling, confirmed invariant gaps, suspected findings, and evidence gaps. Its governance correction applies the project scale and realistic impact to all 13 confirmed findings: 0 critical, 0 high, 8 medium, and 5 low; no automatic stop applies. No workflow or environment operation was performed. | Bill explicitly authorizes Sprint `0C` to classify only the retained `r3-r34` failure history under the existing read-only and no-environment-access prohibitions |
| `0C` | completed | [Retained-history classification](./release-qualification-harness-current-state-audit-2026-08-10.md) maps every retained `r3-r34` attempt and 56 identifiable failed gates: 7 product, 34 harness, 15 unclassified, and none environment or infrastructure. Each is counted once at the outer check except two independently retained `r18` targeted attempts whose outer artifact is absent. It records identities and gaps, commands/contracts/evidence, later-attempt change type, recurring clusters, harness-only candidate/deployment churn, contradictions, historical stop points, severity, and automatic-stop decisions. No workflow or environment operation was performed. | Bill explicitly authorizes Sprint `0D` to perform only the retain/repair/wrap/replace/retire assessment and Phase 0 synthesis under a newly stated read-only scope and effects boundary |
| `0D` | completed | [Disposition assessment and final Phase 0 synthesis](./release-qualification-harness-current-state-audit-2026-08-10.md) classify 88 unique material units exactly once: 25 retain, 33 repair, 20 wrap, 10 replace, and 0 retire. The audit records check-by-check dispositions, evidence and confidence, trusted assets, duplicated/conflicting machinery, hidden assumptions, constraints, unresolved gaps, findings awaiting separate authority, Phase 1 risks, and the Phase 0 deliverable assessment. No severity changed and no workflow or environment operation was performed. | Bill reviews and accepts the completed Phase 0 audit and explicitly authorizes Phase 1, Target Architecture and Migration Design, under a newly stated read-only, no-implementation, and no-environment-access scope |
| `1A` | completed | [Architecture charter and decision framework](./release-qualification-harness-target-architecture-2026-08-10.md) establish the controlling authority boundary, mandatory evidence-derived invariants, conceptual kernel/adapter/pack/native-runner/evidence/admission boundaries, separate identities, environment-effect and cleanup boundaries, decision method and register, advisory `1B-1G` sprint sequence, and Phase 1 completion map. Detailed schemas/interfaces/APIs, implementation files, migration, repairs, and environment operations remain outside scope. | Bill explicitly authorizes Sprint `1B` of Phase 1 to define the identity, authority, and repository ownership model under a newly stated documentation-only, no-implementation, and no-environment-access scope |
| `1B` | completed | [Identity, authority, evidence-lineage, and repository-ownership model](./release-qualification-harness-target-architecture-2026-08-10.md) defines role-based canonical composition of the five identities, representative change impacts, independent producer/validator/consumer authority, complete and partial evidence lineage, conflict/replay/staleness handling, ownership options, and 12 traced decisions. Bill subsequently approved O1 bounded admin ownership; O2 is not selected. No schema/interface/lifecycle implementation, repair, workflow, or environment operation occurred. | Bill approved O1 and separately authorized Sprint `1C` under a documentation-only, no-implementation, and no-environment-access scope |
| `1C` | completed | [Minimal deterministic kernel and lifecycle design](./release-qualification-harness-target-architecture-2026-08-10.md) defines the kernel ownership/exclusion boundary, serial stable topological execution, complete fail-closed state machine, prerequisite/effect admission, bounded process control and whole-tree/remote termination proof, failure/cleanup/residue coordination, conceptual interfaces, 25 synthetic Phase 2 acceptance cases, and 16 evidence-traced decisions. O1 remains controlling. No detailed schema, finalized adapter/pack interface or selection policy, migration design, implementation, repair, workflow, or environment operation occurred. | Bill explicitly authorizes Sprint `1D` of Phase 1 to produce documentation-only versioned plan, execution-event, check-result, failure, cleanup, and final-evidence schema drafts and the independent validation/retention design, with no executable schema, implementation, or environment work |
| `1D` | completed | [Evidence schemas, canonicalization, validation, evolution, and retention design](./release-qualification-harness-target-architecture-2026-08-10.md) defines the common immutable envelope; exactly six versioned documentation-level schema drafts; structural comparison and `RQ-C14N-1` canonical hashing; independent scope/lineage/result/failure/cleanup/attachment validation; schema compatibility and certification; R4 retention recommendation; and V01-V38 verification coverage. Bill subsequently accepted R4 while reserving its operating decisions to `1G`. No executable schema/validator, adapter/pack contract, selection policy, migration, implementation, repair, workflow, storage, or environment operation occurred. | Bill accepted R4 and separately authorized Sprint `1E` under a documentation-only, no-implementation, no-IAM-change, and no-environment-access scope |
| `1E` | completed | [Common adapter, capability/effect, domain-safety, fixture, failure-evidence, and certification design](./release-qualification-harness-target-architecture-2026-08-10.md) defines the common 10-operation adapter boundary; closed `RQ-CAP-1` and six effect classes; exact process/build, filesystem, local HTTP, browser, database, AWS/environment, remote-transport, and fixture/cleanup/residue contracts; IAM denial escalation; eight adapter failure-evidence rows; eight later-certification rows; and 22 evidence-traced decisions. No executable API/schema/adapter, product/pack policy, IAM/configuration change, migration, implementation, repair, workflow, environment operation, or check migration occurred. | Bill explicitly authorizes Sprint `1F` of Phase 1 to define the documentation-only modular test-pack contract, native-runner authority, deterministic selection policy, maturity/certification rules, and no-loss coverage governance, with no implementation, test execution, environment access, migration, or promotion |
| `1F` | completed | [Modular pack, native-authority, maturity/certification, deterministic-selection, and no-loss governance](./release-qualification-harness-target-architecture-2026-08-10.md) defines the normative pack manifest; native semantic authority; maturity and operating states; unchanged 10-local/3-TEST minimum; invalidation/recertification; impact, dependency and full-regression policy; MC2 mandatory-core recommendation; coverage obligations for all 88 Phase 0 units, all 28 checks, and 13 browser children; selection/certification verification; and governance authority. Bill subsequently approved MC2. No executable artifact, migration, promotion, implementation, workflow, check change, or environment operation occurred. | Bill approved MC2 and separately authorized Sprint `1G` under a documentation-only, no-implementation, no-migration, and no-environment-access scope |
| `1G` | completed | [Advisory migration, rollback, operations, retention, admission, ownership, and exact Phase 2 proposal](./release-qualification-harness-target-architecture-2026-08-10.md) integrates O1/R4/MC2 with direct/dual comparison, unchanged Phase 2-10 boundaries, disagreement and rollback, EA2 current-emergency preservation, R4 provider/retention/IAM recommendations, responsibility ownership, an isolated `qualification/` file list, cumulative Phase 2 acceptance, bounded Sprint `2A`, consistency review and Phase 1 completion assessment. No implementation, migration, executable file, storage/IAM/CI/admission change, promotion, retirement, test, workflow or environment operation occurred. | Bill accepts the Phase 1 architecture, approves/revises R4 operations, approves the exact Phase 2 scope, and separately authorizes Sprint `2A` only under the documented pure-local file/effect/test boundary |
| `2A` | completed | [Pure-local schema and identity foundation plus bounded schema alignment](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-2a-implementation-checkpoint) implements only the private package/lock/role boundary; plan/final-evidence `1.0.0-draft.2`; four retained `1.0.0-draft.1` schemas with unchanged resolved validation; the canonical six-origin MC2 vocabulary; `RQ-C14N-1`/SHA-256; five identity primitives; strict structural/digest/identity validation; synthetic candidate bytes; and focused tests. The focused suite passed 60/60 assertions and strict compilation of all six schemas. No PATH/current-check import or execution, selector/lifecycle/process/adapter work, environment access, or later sprint occurred. | Bill explicitly authorizes Sprint `2B` only for `qualification/src/plan-validator.js`, `qualification/src/selector.js`, and `qualification/test/plan-and-selection.test.js`, plus the already approved metadata/docs if needed, under focused pure-local tests and all existing prohibitions |
| `2B` | completed | [Semantic plan admission and synthetic MC2 selection](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-2b-implementation-checkpoint) implement content-addressed policy/registry and harness binding; deterministic core/impact/dependency/suite/scheduled/operation selection; exclusions, maturity, target, capability, effect and cleanup admission; stable topology/digests; and independent exact plan reconstruction. Focused tests passed 57/57 and the combined package passed 117/117. No lifecycle, process/command, evidence assembly, final validator, PATH mapping/check, environment, or later sprint occurred. | Bill explicitly authorizes Sprint `2C` only for `qualification/src/lifecycle.js`, `qualification/src/evidence-emitter.js`, and `qualification/test/lifecycle-and-evidence.test.js`, plus approved metadata/docs, using synthetic in-process events and cleanup markers only under all existing prohibitions |
| `2C` | completed | [Deterministic lifecycle and append-only in-process evidence](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-2c-implementation-checkpoint) bind the complete selected-check set; enforce scoped prerequisite/check/cancellation/cleanup/residue/finalization transitions; emit immutable schema-valid gap-free predecessor-chained events; quarantine stale/conflicting/out-of-order evidence; and hash deterministic event/artifact graphs. Focused tests passed 25/25 and cumulative direct tests passed 142/142. No child process, command, PATH check/import, adapter, environment, independent final validator, admission, or later sprint occurred. | Bill explicitly authorizes Sprint `2D` only for `qualification/src/process-control.js`, `qualification/test/process-control.test.js`, and the seven approved `qualification/test/fixtures/commands/*.js` files, plus approved metadata/docs, for bounded pure-local process/cancellation/whole-tree-termination proof under all continuing prohibitions |
| `2D` | completed | [Bounded synthetic process control](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-2d-implementation-checkpoint) admits exact Node/script digest/argv/cwd/env declarations; rejects replay, drift and unsafe controls; captures bounded strict protocol evidence; enforces startup/execution/idle/total and shutdown/termination bounds; and proves graceful-to-forced whole-process-group termination using only seven approved synthetic commands. Focused tests passed 28/28 and the cumulative package passed 170/170. No PATH check/import, adapter, network, environment, independent validator, CLI, admission, or later sprint occurred. | Bill explicitly authorizes Sprint `2E` only for `qualification/src/kernel.js`, `qualification/src/evidence-validator.js`, `qualification/bin/rq-kernel.js`, and `qualification/test/independent-validation.test.js`, plus approved metadata/docs, for pure-local integration, independent validation, thin synthetic CLI, and the cumulative Phase 2 certification gate under all continuing prohibitions |
| `2E` | completed | [Pure-local kernel composition and independent validation](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-2e-implementation-checkpoint) compose the accepted plan/selection/lifecycle/process/evidence services; fail closed before undeclared effects and after failed prerequisites; preserve product-semantic neutrality; emit final advisory evidence with content-addressed attachments and independent cleanup residue proof; independently reconstruct schema, identity, lineage, scope, event, result, failure, cleanup and attachment validity; and expose strict stdin/stdout `plan`, read-only synthetic `run`, and `validate` CLI operations with no release authority. Focused tests passed 15/15 and cumulative Phase 2 tests passed 185/185, including ten frozen-harness known-good attempts and all documented synthetic negative-case families. Static and scope checks passed. No PATH check/import, adapter, environment, network, deployment, admission change, or later phase occurred. | Bill reviews and accepts the completed Phase 2 pure-local implementation and certification evidence, then explicitly authorizes the exact Phase 3 read-only local-check scope and files; no Phase 3 continuation is automatic |
| `3A` | completed | [First advisory read-only native pack](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3a-implementation-checkpoint) preserves `scripts/admin-ai-eval-fixtures-check.js` as semantic authority; binds the exact package alias, script, fixtures, maturity, effects and identities; runs through bounded local process control; and compares native exit facts without reinterpreting stdout/stderr. Exact direct known-good and duplicate-ID known-bad behaved as expected. Focused tests passed 10/10 and cumulative tests passed 195/195, including 10 frozen advisory passes, five additional direct matches, deliberate failure parity, drift/authority/disagreement negatives, and forced process-tree termination. The pack remains advisory and the current gate remains authoritative. | Bill reviews and accepts Sprint `3A`, then explicitly authorizes a separately scoped Sprint `3B` with one objective, exact files/check/commands/effects and continuing prohibitions; no continuation or promotion is automatic |
| Phase 3 governance correction | completed | [Proposed Phase 3 remainder](./release-qualification-harness-target-architecture-2026-08-10.md#phase-3-remaining-sprint-breakdown) records separately authorized `3B-3H`: privacy source tripwire, Intacct local source contract, admin lint, portal lint, admin aggregate, portal aggregate, and source inventory/stability. Every sprint defines exact proposed files/inputs/direct-advisory commands/effects, negative/parity/identity/interruption/regression proof and stop point. The original five-run/deliberate-failure/no-disagreement/Bill-review exit is preserved and strengthened by the unchanged 10-run certification baseline plus a final five-attempt cohort. No implementation or check execution occurred. | Bill explicitly authorizes Sprint `3B` only using the copy-ready bounded prompt; no later sprint, repair, promotion or Phase 4 work is automatic |
| `3B` | completed | [Advisory privacy route-source pack](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3b-implementation-checkpoint) preserves the unchanged 71-check smoke and focused guard-removal Jest suite as native authorities; binds exact admin/portal/Jest/package/lock inputs; compares exact direct/advisory results; and retains source-tripwire-only, advisory, no-release-authority boundaries. Both direct commands passed, focused certification passed 9/9, and cumulative qualification verification passed 204/204. One sandbox child-suppression diagnostic required the authorized local-test override; one test-only wrapper/native status assertion was corrected. No product/native source, environment, release gate, promotion or later sprint changed. | Bill reviews and accepts `3B`, then explicitly authorizes Sprint `3C` only within its documented exact files, read-only inputs, temporary negative mirror, commands, effects, verification and stop point; no continuation is automatic |
| `3C` | completed | [Advisory Intacct local-source contract pack](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3c-implementation-checkpoint) preserves `scripts/intacct-contract-audit.js` as semantic authority; binds the exact local manifest, admin server and non-Git sibling mock source; runs a byte-identical native checker only inside an attempt-owned deliberate-drift mirror; and proves warning/failure parity plus zero residue without Sage, deployed-service or release claims. The direct audit passed 18/18 local checks, focused certification passed 9/9, and deterministic cumulative verification passed 213/213. One role-map placement error failed before native dispatch and was corrected; one unchanged process-tree test exposed parallel scheduling pressure, then passed 28/28 alone and in the complete single-concurrency run. No product/native source, environment, service, current gate, promotion or later sprint changed. | Bill reviews and accepts `3C`, then explicitly authorizes Sprint `3D` only within its documented admin-lint files, read-only inputs, exact no-cache/no-fix commands, effects, verification and stop point; no continuation is automatic |
| `3D` | completed | [Advisory admin lint pack](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3d-implementation-checkpoint) preserves the root ESLint package command/config/runtime as semantic authority; binds exact package/lock/config/binary, 16 resolved lint package trees and all 631 current `src` JavaScript/JSX files; rejects cache/fix/scope/effect/identity drift; and proves direct/advisory parity without extending native scope. Direct known-good exited `0`, the native `no-undef` negative exited `1`, focused certification passed 10/10, and deterministic cumulative verification passed 223/223. The qualification negative required explicit `--no-ignore`; the default sandbox's known nested-child suppression was classified from zero-frame startup evidence before the bounded local-process override passed. No product/native source, config/dependency, environment, current gate, promotion or later sprint changed. | Bill reviews and accepts `3D`, then explicitly authorizes Sprint `3E` only within its documented portal-lint files, read-only portal inputs, exact no-cache/no-fix commands, effects, verification and stop point; no continuation is automatic |
| `3E` | completed | [Advisory portal lint pack](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3e-implementation-checkpoint) preserves the portal-owned package alias, package-level ESLint configuration and installed runtime as semantic authority; binds exact portal package/lock/binary, 16 resolved lint package trees and all 100 current portal `src` JavaScript/JSX files; rejects admin fallback, wrong cwd/repository, cache/fix/scope/effect/identity drift; and proves direct/advisory parity without extending native scope. Direct known-good exited `0`, the portal-configured native `no-undef` negative exited `1`, focused certification passed 10/10, and deterministic cumulative verification passed 233/233. One missing test parenthesis and one exact cross-repository admission rule were corrected from deterministic pre-execution failures. No product/native source, config/dependency, environment, current gate, promotion or later sprint changed. | Bill reviews and accepts `3E`, then explicitly authorizes Sprint `3F` only within its documented admin-aggregate files, read-only inputs and prerequisites, exact direct/advisory commands, effects, verification and stop point; no continuation or repair is automatic |
| `3F` | incomplete - transport-version stop | [Sprint `3F-C1`](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3f-c1-transport-version-stop) implemented and passed the pre-native shared-contract gates, then stopped on its first native attempt because adapter `2.0.0` was incorrectly reused as process protocol version instead of the unchanged `1.0.0`. No cleanup or process residue remained; no repair/rerun or broader certification followed. | Bill separately authorizes bounded `3F-C1-R1`; `3G`, promotion, current-gate change and Phase 4 remain unauthorized |
| `3F-R1` | completed | [Native aggregate blocker repair](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3f-r1-repair-checkpoint) gives every release-admission temporary tree and the synthetic launcher workspace explicit teardown ownership plus post-removal zero-residue proof. Launcher contract testing now supplies an inert local binary marker, explicit non-secret values, and an empty ambient environment without changing normal launcher runtime defaults. Focused verification passed 3/3 suites and 18/18 assertions. One sandbox `EPERM` was classified before an identical bounded-permission rerun passed. No pack, aggregate, service, network, environment, current gate, promotion, or later sprint ran. | Bill reviews and accepts `3F-R1`, then explicitly reauthorizes Sprint `3F` only under its previously approved bounded scope and stop rules; Sprint `3G` remains unauthorized |
| `3F-R2` | completed | [Synthetic aggregate environment repair](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3f-r2-repair-checkpoint) creates an exact non-secret attempt-owned test environment, rejects ambient/unowned test configuration, preserves normal DEV/PROD server resolution, and proves cleanup/residue absence on success and failure. Focused tests passed 8/8; final native aggregate passed frontend 84 suites/417 assertions and backend 46 suites/438 assertions in order. No ignored environment bytes, external environment, gate, pack or later sprint was accessed. | Bill reviews and accepts `3F-R2`, then explicitly reauthorizes `3F` under its corrected scope and fail-closed stop rules; no later work is automatic |
| `3F-R3` | completed via bounded R4 closure | [Two-pack rebind and cumulative stop](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3f-r3-cumulative-certification-stop) advanced only privacy and Intacct local-contract packs to `1.0.1`; each passed all 9 focused tests. Its sole cumulative blocker was the separately scoped admin-lint digest, now repaired and proved by `3F-R4`'s 233/233 cumulative result. | Bill reviews and accepts the completed `3F-R3`/`3F-R4` repair sequence, then separately decides whether to reauthorize Sprint `3F`; no continuation is automatic |
| `3F-R4` | completed | [Admin-lint rebind and cumulative repair](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3f-r4-repair-checkpoint) first validated all five packs and proved admin lint was the only stale manifest, then advanced it to `1.0.1` against exact post-R2 source bytes. Focused certification passed 10/10 and cumulative qualification passed 233/233 with no scope, semantic, maturity, authority, environment or later-sprint change. | Bill reviews and accepts `3F-R3`/`3F-R4`, then explicitly reauthorizes Sprint `3F` under the previously approved corrected scope and stop rules; `3G` remains unauthorized |
| `3F-D1` | completed | One retained backend-failure attempt proved the aggregate mirror failed in frontend because tracked root-relative native inputs were absent. Complete phase/process/stream evidence and independent mirror, temp and process residue checks were retained; no implementation changed. | Bill authorized R5 only after a pre-edit complete input-closure comparison |
| `3F-R5` | completed repair; cumulative gate failed | The first authorization stopped when closure enumeration found five missing inputs rather than three. Corrected R5 binds exactly all five, advances only `admin-aggregate` to `1.0.1`, and passes the single backend negative plus 11/11 focused certification. Cumulative qualification finished 243/244 on the separately scoped shared Intacct cleanup-evidence defect, with actual mirror removal and no observed residue. | The read-only convergence review supersedes the tactical `3F-R6` proposal; no continuation is automatic |
| Sprint `3F` convergence review | completed - design stop | [The bounded review](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3f-convergence-review) distinguishes successful physical cleanup from false cleanup evidence, maps the complete affected set to the one shared bridge plus all six active pack versions, identifies inconsistent adapter-version binding and implicit operation cleanup as the convergence failure, rejects tactical special cases, and recommends one explicit per-profile lifecycle boundary. No implementation or command ran. | Bill explicitly authorizes bounded Sprint `3F-C1` using the exact copy-ready scope, effects, verification and stopping point from the review; no later work is automatic |
| `3F-C1` | incomplete - deterministic transport stop | Pre-native proof found exactly six consumers, all six successor bundles valid at adapter `2.0.0`, and passed the new lifecycle contract plus 28/28 synthetic process cases. The first Intacct negative could not admit a result because the CLI emitted frame protocol `2.0.0` while process control requires `1.0.0`. Source deterministically proves the conflation; absence checks found no mirror or process residue. | Bill explicitly authorizes bounded `3F-C1-R1` for the exact CLI/test/document repair and one-attempt Intacct proof; no broader continuation is automatic |
| `3F-C1-R1` | completed via bounded V1 | The CLI emits process protocol `1.0.0` while native results retain adapter/result `2.0.0`; syntax/whitespace, focused lifecycle and 28/28 process-control checks passed. V1 then used fresh attempt identities for one Intacct deliberate-drift parity proof: expected direct/advisory failures matched, cleanup and independent zero residue passed, authority remained none, and absence checks were clean. | Bill's Intacct scope reconciliation supersedes automatic six-pack C1 continuation |
| Sprint `3F` Intacct scope reconciliation | completed - Bill accepted recommendation | [The bounded reconciliation](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3f-intacct-scope-reconciliation) proves the simulator is optional local tooling, the legacy check is mandatory only by inventory configuration, live PATH assertions remain in admin aggregate, and active advisory/nonblocking labels do not remove certification coupling. Bill accepted deliberate removal from the active Phase 3 set while retaining local artifacts and leaving the authoritative gate unchanged. | Completed by the exact five-pack/16-profile `3F-C1` correction and recertification recorded in the next ledger row |
| `3F-C1` five-pack completion | completed | [The completion checkpoint](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3f-c1-five-pack-completion-checkpoint) records Bill's deliberate no-loss removal decision, the exact five-pack/16-profile graph, inactive retained Intacct tooling, adapter/result `2.0.0` and process protocol `1.0.0`, complete synthetic and five-pack recertification, and cumulative 246/246 verification. All five packs remain advisory with `releaseAuthority: none`; the current authoritative gate is unchanged. | Bill reviews and accepts completed Sprint `3F`, then separately authorizes the already-planned Sprint `3G` exact scope; no continuation, promotion, current-gate change or Phase 4 work is automatic |
| `3G` convergence/repository review | completed - `3G` remains unimplemented | [The bounded review](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3g-convergence-and-repository-review) separates architecture-required registry/role/global-identity coupling from avoidable code-owned pack catalogs; proves that the proposed six-test correction omits the successor adapter version, all five active pack rebindings, the AI version assertion and portal environment inputs; recommends the finite recorded shared-adapter route over an unplanned redesign; and proves commit `5d2ebb6` added 528 unnecessary tracked nested dependency files because the root ignore covers only `/node_modules`. Bill-confirmed commit/push provenance is resolved. Environment values were not recorded; secrets migration is deferred. No implementation or command ran. | Bill authorizes bounded `3G-H1` exactly as recorded in the review to untrack only `qualification/node_modules/**`, add the exact ignore rule and prove zero identity/dependency drift; corrected `3G` requires a later separate authorization |
| `3G-H1` | completed | [Dependency-tree hygiene](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3g-h1-completion-checkpoint) adds the exact nested ignore rule and stages removal of exactly 528 generated dependency files from tracking while retaining 528 byte-identical installed files. Package, lock, all non-installation qualification bytes and the active identity aggregate are unchanged; Ajv remains usable. The five pure-local Phase 2 suites, 40-file syntax scan, import boundary, dependency, ignore, residue and whitespace checks passed. One default-sandbox `2D` zero-frame failure matched the accepted nested-child infrastructure signature; zero residue/digest drift was proved before one identical bounded-permission rerun passed 28/28. No install, product/native check, environment, Git-history, commit/push or later work occurred. | Bill reviews and accepts `3G-H1`, then separately authorizes corrected Sprint `3G` with the successor adapter, all five active pack rebindings/recertification, the complete seven-test correction and sensitive digest-bound portal inputs recorded in the architecture; no continuation is automatic |
| `3G` source admission | stopped before implementation | [The source-baseline stop](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3g-source-baseline-admission-stop) records that local `HEAD`/`origin/main` remain `5d2ebb6`, the 528 H1 removals remain staged, and the ignore/checkpoint edits remain unstaged despite the stated committed/pushed baseline. No portal environment input, implementation or qualification command was accessed or changed. | Bill establishes one clean exact H1 commit in this checkout or separately authorizes bounded source-control reconciliation, then explicitly reauthorizes corrected Sprint `3G`; no continuation is automatic |
| `3G` corrected implementation | incomplete - two-failure stop before native dispatch | Source admission passed at clean `176419d`. The bounded implementation created the proposed successor `native-readonly-bridge@2.1.0`, six-pack registry/bindings, portal aggregate scopes/manifest/fixtures/test and sensitive-output redaction, but certification did not begin. The initial synthetic lifecycle run failed because its synthetic resource omitted the forced-interruption authority marker; one diagnostic classified it, the test-only fixture was corrected, and the synthetic lifecycle plus inactive-Intacct scope rerun passed. The next portal manifest/static-only gate exited `1` before exposing a named subtest or diagnostic. Under the controlling two-failure rule it remains unclassified and no portal native/direct/advisory command, five-pack recertification or cumulative regression ran. Partial changes are retained uncommitted for diagnosis; no release authority changed. | Bill authorizes bounded read-only Sprint `3G-D1` only to reproduce the focused portal manifest/static failure once under the frozen partial `3G` bytes, retain complete process output/exit evidence, identify the failing load or subtest without editing, and independently prove zero `rq-portal-aggregate-*` and process residue; any repair or resumed certification requires a later separate authorization |
| `3G-D1` and design review | completed - revised approach awaits approval | D1 retained the exact command, 553-byte stdout, empty stderr, exit `1`, no signal and 13.132-second duration; only Node's file-level TAP wrapper appeared, and independent checks proved no portal temp root/process residue. The read-only design review traces the complete import/load path and proves that the new test validates the bundle, traverses all portal scopes (including the full installed dependency closure), repeats all four collectors, fingerprints inputs and constructs identities before its first named subtest. Native/bridge/process-control dispatch was unreachable. The exact termination remains unclassified; the pre-registration diagnostic and duplicated-retention structure is a confirmed local test defect. | Bill separately authorizes bounded Sprint `3G-R1` using the exact objective, three-file documentation/test scope, effects, one focused proof and immediate stopping rule recorded in the architecture; Sprint `3G` does not resume automatically |
| `3G-R1` | stopped - focused proof repeated opaque failure | The test now registers named tests before lazy certification initialization, reuses validated manifest input digests and no longer retains a duplicate full dependency closure. Syntax and whitespace passed. The sole focused invocation still produced only file-level `ERR_TEST_FAILURE`, exit `1`, no signal and no named diagnostic after 21.027 seconds. No rerun/repair followed; declared temp-root and process-residue checks were clean. The narrow local simplification remains useful but did not classify or resolve the failure. | Bill authorizes bounded read-only `3G-DR2` exactly as recorded in the architecture to decide the dependency-fingerprint/Node-worker boundary before any further implementation or execution; Sprint `3G` remains stopped |
| `3G-DR2` | completed - one bounded correction recommended | The read-only review confirms Node's separate test-file child boundary explains how a fatal callback path can remain file-only, while the cause remains unclassified. The full portal collector is independently defective: it scans all production/development roots, materializes every selected file, deduplicates by package name and cannot represent the lockfile's distinct nested package instances. A lock-path-driven streaming installed-byte fingerprint is architecture-consistent and avoids new process/transport machinery. Deferral is viable because admin aggregate covers the Phase 3 category and the current gate retains portal authority, but requires Bill to amend the explicit cohort and retain RN02/RN04 as an open no-loss obligation. | Bill authorizes bounded `3G-R2` exactly as recorded in the architecture for one correction and one focused proof; any failure stops for portal-pack scope reconciliation rather than another repair |
| `3G-R2` | stopped - final focused proof failed | [The final corrective-attempt checkpoint](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3g-r2-final-corrective-attempt-and-scope-reconciliation-stop) records the versioned lock-path/streaming fingerprint, exact 2,048-present/one-optional-absent/72,393-file boundary and portal-only `1.0.1` binding. Syntax/whitespace passed, but the sole focused invocation again returned only file-level `ERR_TEST_FAILURE`, exit `1`, no signal or named diagnostic after 33.580 seconds. No native/advisory dispatch occurred and temp/process residue was absent. The cause remains unclassified and no further repair/rerun is permitted. | Bill authorizes bounded `3G-SR1` exactly as recorded in the architecture to preserve attempt evidence, restore the certified five-pack control plane, defer portal aggregate from the active advisory cohort and retain RN02/RN04 under the unchanged current gate; `3H` and Phase 4 remain unauthorized |
| `3G-SR1` | completed - five-pack control plane restored | [The scope-reconciliation checkpoint](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3g-sr1-scope-reconciliation-completion) records the pre-restore overlap proof, content-addressed patch/archive/attempt evidence, exact restoration of 19 tracked qualification files, removal of four archived unadmitted portal artifacts, byte equality with certified commit `176419d`, five-pack bundle/input validation, adapter/role/registry identities and unchanged advisory authority. `portal-aggregate` is outside the active Phase 3 cohort; the authoritative gate still owns it and RN02/RN04 remain open. No native/advisory command or recertification ran. | Bill reviews and accepts `3G-SR1`, then separately authorizes Sprint `3H` only under its recorded exact role-registry, protected-path, source-inventory/stability, verification and stopping boundaries; Phase 4 remains unauthorized |
| `3H` | completed - exit cohort not run | [The implementation and certification checkpoint](./release-qualification-harness-target-architecture-2026-08-10.md#sprint-3h-implementation-and-certification-checkpoint) records the separate strict source-role registry, exact Git/file-byte inventory, protected-path pre-read exclusion, product/harness/test-pack identity separation, detailed before/after stability evidence, standalone advisory-only CLI and synthetic fixture corpus. Focused verification passed 8/8 groups; deterministic cumulative qualification passed 254/254 assertions across 161 named subtests. The five-pack native control plane, portal deferral, RN02/RN04, current gate and release authority are unchanged. | Bill reviews and accepts `3H`, then separately authorizes only the bounded five-attempt Phase 3 exit-gate sprint exactly recorded in the architecture; Phase 4 remains unauthorized |
| Phase 3 exit gate | incomplete - explained operator stop | [The exit-gate stop](./release-qualification-harness-target-architecture-2026-08-10.md#phase-3-exit-gate-attempt-stop) records clean-source admission at `80fe3af`, exact five-pack/source-state contract freezing and one authorized command. Attempt `attempt:c625d696-f234-4892-86b8-a2ee21fe810c` stopped after the first AI advisory/direct dispatch because the one-off operator rejected the bridge's certified `no-declared-write-effect` read-only residue value. No comparison artifact, complete cohort attempt, repair or rerun followed; process/temp residue checks were clean. Retained negative, interruption, cleanup and residue certification was reviewed. `portal-aggregate`, RN02/RN04, the current gate and release authority remain unchanged. | Bill separately authorizes only the bounded exit-operator predicate correction and one fresh five-attempt exit execution exactly recorded in the architecture; Phase 4 remains unauthorized |
| Corrected Phase 3 exit gate | incomplete - second operator stop | [The corrected stop](./release-qualification-harness-target-architecture-2026-08-10.md#corrected-phase-3-exit-gate-execution-stop) records the exact two-document checkpoint/push at `f6cc806`, clean frozen admission, the one permitted temporary predicate/baseline correction and one fresh execution. Attempt `attempt:df759c21-6128-4e96-8fbb-5074b59192a2` passed the AI result/comparison/cleanup gate in memory, then the operator dereferenced valid `cancellation: null` during graph projection. Failure evidence is retained; no complete attempt, repair or rerun followed and residue checks were clean. All qualification identities and authority boundaries remain unchanged. | Bill separately authorizes only a bounded read-only exit-operator design review mapping the complete graph projection to authoritative nullable schema/contracts and a synthetic pre-native proof; no further native execution, Phase 4 or authority change is automatic |
| Final Phase 3 exit sprint | completed as governed stop; Phase 3 stopped incomplete | [The final exit stop](./release-qualification-harness-target-architecture-2026-08-10.md#final-phase-3-exit-gate-completion-stop) records clean admission at `be56fc5`, the temporary coordinator's frozen `fa980228...` byte digest and its complete pre-native proof boundary. The sole synthetic command stopped at its first internal read-only Git proof with `spawnSync git EPERM`, before a synthetic case, proof artifact, evidence root, bundle load, native/direct/advisory command or cohort attempt. No escalation, correction or rerun followed. Existing packs, source contracts, portal deferral, RN02/RN04, current gate and authority remain unchanged. | Bill reviews the final stop and either closes the rebuild at Phase 3 as stopped incomplete or makes a separate governance decision about the unmet exit criterion; no further exit execution or Phase 4 work is automatic |
| Elevated unchanged-coordinator exit | completed as deterministic admission stop; Phase 3 incomplete | [The elevated stop](./release-qualification-harness-target-architecture-2026-08-10.md#elevated-unchanged-coordinator-admission-stop) supersedes the earlier EPERM conclusion. External admission proved clean `df8e4d0`; the coordinator remained byte-identical at `fa980228...`; bounded process escalation was granted and its internal Git commands ran. The unchanged coordinator then correctly rejected `df8e4d0` because its immutable admitted baseline is `be56fc5`. No synthetic case, proof artifact, evidence root, bundle load, native/direct/advisory command or cohort attempt ran, and no repair/rerun followed. | Bill must resolve the proved baseline-governance conflict or explicitly change the exit criterion before any further execution; Phase 4 remains unauthorized |
