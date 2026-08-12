# PATH Release Qualification Harness Target Architecture

Status: Sprints `1A` through `1G` architecture design are complete; ownership
option O1, retention direction R4, and mandatory-core option MC2 are approved.
Phase 1 is analytically complete, while architecture acceptance, the R4
operating choices, and exact Phase 2 file-scope authorization remain reserved
for Bill. No implementation or migration has begun.

Date: 2026-08-10

Controlling plan:
[release-qualification-harness-rebuild-plan-2026-08-10.md](./release-qualification-harness-rebuild-plan-2026-08-10.md)

Accepted evidence baseline:
[release-qualification-harness-current-state-audit-2026-08-10.md](./release-qualification-harness-current-state-audit-2026-08-10.md)

## Sprint 1A Boundary and Outcome

Sprint `1A` establishes the Phase 1 charter, evidence-derived invariants,
conceptual boundaries, decision framework, advisory sprint sequence, and
completion map. It deliberately does not select implementation-level APIs,
finalize schemas or interfaces, choose Phase 2 files, repair Phase 0 findings,
or authorize any executable or environment work.

The accepted Phase 0 baseline found 88 material component units: 25 `retain`,
33 `repair`, 20 `wrap`, 10 `replace`, and none immediately safe to retire. It
also found 56 identifiable historical failed gates: 7 `product`, 34 `harness`,
15 `unclassified`, and none deterministically `environment` or
`infrastructure` (`release-qualification-harness-current-state-audit-2026-08-10.md:1027-1197,695-907`).
Those findings support selective preservation of native capabilities and
replacement of unsafe common foundations; they do not support a universal
monolithic simulation or wholesale replacement of product assertions.

No genuinely ambiguous cross-system decision prevents this bounded foundation.
Open choices are registered for later evidence-led sprints and, where they alter
governance, cost, repository authority, selection policy, or promotion risk,
Bill's explicit approval.

## Architecture Charter

### Purpose

Create a dependable release-qualification system that determines whether an
exact product candidate is fit for a declared target and scope, produces
complete reproducible evidence, and prevents unsafe continuation after failed
prerequisites. The system must make existing product assertions easier to run,
attribute, and trust without turning all testing into one cross-domain workflow.

### Scope

Phase 1 designs, but does not implement:

- a minimal deterministic orchestration kernel;
- explicit identity, authority, environment-effect, and cleanup boundaries;
- versioned plan, event, result, failure, cleanup, and final-evidence drafts;
- adapter and modular test-pack contracts;
- deterministic selection and pack-maturity rules;
- evidence validation, retention, release-admission, and provenance boundaries;
- an advisory migration and rollback path that preserves the current gate; and
- repository ownership, Phase 2 acceptance criteria, and the exact Phase 2 file
  scope to be presented for Bill's approval.

This scope follows the controlling Phase 1 definition
(`release-qualification-harness-rebuild-plan-2026-08-10.md:144-166`).

### Non-Goals

Phase 1 does not:

- implement or repair the harness, product, tests, schemas, configuration, or
  environments;
- migrate, promote, disable, or retire a current check;
- certify a runner, adapter, pack, environment, or release candidate;
- run a test, build, browser, service, SQL/database, AWS, deployment, fixture,
  TEST, or PROD operation;
- reconstruct missing historical evidence or infer current environment state;
- make the advisory replacement authoritative; or
- choose Phase 2 implementation files before the completed architecture is
  reviewed as one system.

### Controlling Strategy and Authority Boundary

The controlling strategy is a hybrid model with a strict authority boundary:

| Actor or mechanism | May do | Must not do | Authority source |
| --- | --- | --- | --- |
| Deterministic harness | Validate inputs; bind identities; select checks; enforce prerequisites/effects; execute through adapters; record events/results/cleanup; validate evidence; produce advisory `GO`/`NO-GO` | Guess contracts, silently reinterpret native results, use an LLM judgment as a gate, or continue dependent effects after failed prerequisites | Controlling plan `:9-20,54-108`; audit `:1199-1370` |
| Native runner or product assertion engine | Decide its declared product assertions and return attributable structured or bounded native evidence | Decide overall release admission, environment safety, pack selection, or cleanup outside its declared scope | Audit RN03-RN33 at `:1092-1132` |
| LLM-assisted analysis | Map dependencies, propose packs and negative cases, cluster evidenced causes, explain results, and recommend a failure class or design option | Execute release authority, invent missing evidence, silently repair a failure, or convert a recommendation into `GO`/`NO-GO` | Controlling plan `:9-28,65-76`; audit `:840-968` |
| Bill | Approve sprint boundaries, governance choices, completed architecture, exact Phase 2 scope, later promotion, and any environment effects | Grant implicit authority through an advisory sprint list or document alone | Controlling plan `:22-48,164-166` |
| Current release gate | Remain the release-admission authority during migration | Be displaced by advisory output before mapped certification and explicit cutover approval | Controlling plan `:25-27,286-305`; audit `:1027-1055` |

The future kernel is an orchestrator of modular packs, not one universal
simulated user journey. Test depth grows through unit, component/contract,
integration, local system, deployed end-to-end, and smoke layers
(`release-qualification-harness-rebuild-plan-2026-08-10.md:9-20`).

### Advisory Migration Requirement

The replacement must initially operate in advisory mode beside the existing
gate. A harness-only change creates a new `harnessVersion` and `attemptId`, not a
new product candidate or deployment. Disagreement requires evidence-led
classification; it does not automatically change either system. Packs become
mandatory individually only after mapped coverage, applicable certification,
an observation period, and explicit approval. Legacy behavior remains available
for rollback until the agreed cutover observation period ends
(`release-qualification-harness-rebuild-plan-2026-08-10.md:22-28,275-305`;
audit `:867-876,1416-1431`).

### Safety, Reproducibility, and Evidence Principles

1. Fail closed before effects. A prerequisite failure cannot authorize a fixture,
   ordinary database operation, remote mutation, or dependent check.
2. Identify before acting. Candidate, harness, attempt, environment, and pack
   identities are exact, separate, immutable within an attempt, and recorded.
3. Bound every execution. Timeout must lead to proved local and remote
   termination before cleanup, retry, or another attempt.
4. Own the whole fixture lifecycle. Stateful packs declare effects, mutation
   boundary, cleanup owner, recovery path, and independent residue proof.
5. Preserve attributable evidence. Plans, events, native outputs, results,
   failures, cleanup, and final decisions are structurally validated and
   hash-linked, including partial/interrupted attempts.
6. Classify from contracts. Every failed check has exactly one evidenced primary
   class; insufficient evidence is `unclassified` and stops tactical work.
7. Compare structures, not presentation accidents. JSON property order,
   substrings, global UI text, transient toasts, guessed SQL, and implicit cloud
   identity are not authoritative proof.
8. Keep capability and execution separate. A useful native test may be retained
   even when its current wrapper, transport, fixture, or orchestration is unsafe.
9. Promote evidence, not optimism. A single pass or a real defect discovery does
   not make a pack mandatory.
10. Keep the design minimal. A component belongs in the common kernel only when
    it is domain-neutral and required to enforce a common invariant.

## Evidence-Derived Invariants

`Mandatory` means Phase 1 may choose a mechanism but may not weaken the stated
outcome without changing the controlling strategy and obtaining Bill's explicit
approval. `Preference` guides design where the evidence supports direction but
does not determine one implementation. `Unresolved` records a missing fact and
forbids invention; it is not permission to omit the concern.

### Mandatory Constraints

| ID | Invariant | Exact evidence | Design consequence |
| --- | --- | --- | --- |
| M01 | Deterministic code owns execution, validation, cleanup, provenance, and all release decisions; LLM output is advisory | Plan `:9-20,65-76`; audit `:695-749` | No LLM call or prose interpretation may be on the decision path |
| M02 | `productCandidateId`, `harnessVersion`, `attemptId`, `environmentIdentity`, and `testPackVersions` are separate | Plan `:54-64`; audit `:750-768,867-876` | Each evidence layer binds all applicable identities without conflating them |
| M03 | A harness-only change must not create a product candidate or require product redeployment | Plan `:22-28,54-64`; audit `:867-876,914-918` | Product and harness fingerprint sets need distinct ownership and change rules |
| M04 | All prerequisites and the exact target are proved before dependent effects; a failed preflight blocks later fixture work | `docs/AGENTS.md:5-22`; audit `:458-469` | The execution model needs explicit dependencies and an effect-admission boundary |
| M05 | Environment identity is proved after the same environment-loading sequence used by the action | `docs/AGENTS.md:7-10,24-29`; audit `:411-421,517-528` | Ambient or earlier identity proof cannot authorize a later adapter action |
| M06 | SQL uses exact live target/DDL proof and per-statement identifier admission; pre-mutation preflight failure closes without cleanup SQL | `docs/AGENTS.md:1-22`; audit `:304-311,581-584` | Database design must separate metadata proof, statement admission, mutation, rollback, and residue phases |
| M07 | Local and remote work is bounded and cancellable; cleanup/retry waits for proved termination | Audit `:470-485,585-590,921`; CP09/CP26 at `:1066-1086` | A local timeout without remote cancellation is not a completed attempt |
| M08 | Every stateful pack owns cleanup/recovery and independently proves zero residue, including interruption paths | Audit `:384-393,434-457,517-535,585-597,919-921` | Cleanup status is first-class evidence and cannot be inferred from a runner exit |
| M09 | Every plan, event, result, child artifact, log, cleanup record, and final decision is schema-valid and hash-linked; partial evidence survives interruption | Audit `:362-382,537-548,752-768,828-835`; CP10-CP12 at `:1067-1069` | Evidence validation reconstructs required scope rather than trusting self-declaration |
| M10 | Each failed check has exactly one deterministic primary class; insufficient evidence is `unclassified` and forces a stop | Plan `:65-76`; audit `:722-749,840-907` | Failure schema and decision logic must record contract, basis, and next safe action |
| M11 | Cross-repository packages, ambient inputs, infrastructure capabilities, effects, and cleanup owners are explicit and versioned | Audit `:599-617,1248-1317`; CP02/CP04/CP06 at `:1062-1066` | No relative layout, ignored file, environment variable, or deployed helper is an invisible prerequisite |
| M12 | Deployed provenance, live schema, and rollback artifacts are proved for content, identity, availability, and usability | Audit `:486-505`; CP16-CP19 at `:1074-1077` | Source fingerprints and nonempty artifact strings cannot establish deployed or recovery truth |
| M13 | Structural comparison is canonical; property order and substring-only evidence are forbidden as authoritative decisions | Plan `:95-105`; audit `:835,1268-1276`; CP05 at `:1063` | JSON and evidence canonicalization is one explicit architecture decision |
| M14 | Browser assertions use product-owned boundaries, persistent state, and explicit transitions rather than global text or transient toasts | `docs/AGENTS.md:81-86`; audit `:836-837`; RN16-RN19 at `:1115-1118` | Selector and proof authority belongs in the pack contract and product surface |
| M15 | TEST/PROD AWS work uses explicit profile/account/resource proof; no implicit profile or remembered resource identity | `docs/AGENTS.md:24-29`; audit `:340-360,517-528` | AWS identity and capability admission precede every remote operation |
| M16 | Native product assertions remain distinct from orchestration and overall release authority | Audit `:1027-1055,1092-1132`; 34 harness failures versus 7 product failures at `:840-907` | Wrapping or replacing execution must preserve mapped native coverage |
| M17 | Packs declare level, contract, prerequisites, effects, cleanup, negative cases, and maturity before promotion | Plan `:77-108`; audit `:1320-1370` | `mandatory` is a reviewed maturity state, never a default or one-pass result |
| M18 | The new system remains advisory until dual-run evidence and explicit promotion; the existing gate remains authoritative | Plan `:25-27,275-305`; audit `:1027-1055,1416-1431` | No Phase 1 artifact changes release admission or retires legacy machinery |
| M19 | Selection is deterministic, dependency-expanded, keeps explicit/scheduled full regression, and fails closed on unknown scope | Plan `:238-250`; audit `:281-288,1199-1218` | Selection policy must prove both required inclusion and justified omission |
| M20 | Evidence retention is durable enough to diagnose interruption and reproduce admission decisions | Audit `:752-757,944-968`; CP22 at `:1080` | Ignored local `tmp/` storage cannot be the sole authority |
| M21 | Phase 1 cannot silently repair Phase 0 findings or change the controlling testing strategy | Plan `:22-48,144-166`; audit `:1392-1431` | Findings and design decisions stay separate; implementation requires a later authorization |

### Preferences and Unresolved Evidence

| ID | Type | Direction or gap | Exact evidence | Required treatment |
| --- | --- | --- | --- | --- |
| P01 | Preference | Keep the common kernel minimal and domain-neutral | Plan `:144-153`; audit `:1027-1055` | Put product semantics, fixtures, and native assertions in packs or adapters, not the kernel |
| P02 | Preference | Preserve the current operator CLI surface where it does not weaken invariants | CP01 at audit `:1062`; Phase 0 disposition total at `:1153-1160` | Decide compatibility deliberately in Phase 1; do not preserve unsafe internals for CLI convenience |
| P03 | Preference pending approval | Use ten clean fast-local runs and three expensive TEST attempts as the starting certification thresholds | Plan `:106-108` | Sprint `1F` must justify retention or revision; a revision requires Bill's approval |
| P04 | Preference | Continue independent read-only diagnostics after a failure only when no dependent effect can occur | Audit `:458-469`; runbook conflict at `:1309-1313` | Sprint `1C` must define safe continuation separately from prerequisite failure |
| U01 | Unresolved | Dependency defaults, ambient/ignored inputs, aggregate network isolation, screenshot retention, and forced-close behavior are not fully proved | Audit `:1372-1381` | Interfaces must expose them; later authorized certification supplies facts |
| U02 | Unresolved | Ownership/status of shared's native test, portal workflow smoke, ordinary Intacct mock changes, and unexplained cleanup SQL | Audit `:1377-1381`; RN32-RN33 at `:1131-1132` | Do not assign mandatory coverage or execution ownership without a later decision/evidence |
| U03 | Unresolved | No-real-email proof, payment early rollback, two-step timeout overlap, R1 recovery, and privacy mutation cleanup | Audit `:1382-1385` | Preserve these as pack/adaptor obligations; do not claim current capability |
| U04 | Unresolved | Historical evidence is missing or opaque for portions of `r14`, `r17-r18`, `r20-r21`, `r22`, `r24-r25`, `r27`, `r29`, and `r34` | Audit `:750-768,787-839,929-968` | Do not reconstruct history or use it to select an implementation option |

## Conceptual System Boundaries

### Logical Authority Flow

The conceptual flow is:

`candidate definition` -> `deterministic plan` -> `kernel` -> `adapter` ->
`test pack` -> `native runner` -> `structured evidence` -> `independent
validation` -> `advisory decision`.

Environment capability admission sits between the kernel and every effectful
adapter. Cleanup and residue proof close the attempt before final evidence.
During migration, existing release admission consumes only the authoritative
legacy evidence; advisory evidence can be compared but cannot promote a release.

This is a boundary model, not an implementation graph or API design.

### Responsibility Boundaries

| Boundary | Responsible for | Must not own |
| --- | --- | --- |
| Candidate-definition boundary | Exact shipped-product repositories, dependencies, migrations, dirty/source facts, and immutable `productCandidateId` | Harness, docs, test-only changes, attempt state, or environment state |
| Harness-definition boundary | Kernel, adapters, evidence definitions, manifests, selection policy, and exact `harnessVersion` | Product-candidate identity or runtime environment identity |
| Planning boundary | Validate declared change/operation scope; expand dependencies; select mandatory, impacted, scheduled, and requested packs; bind pack versions | Execute commands, infer missing ownership, or suppress unknown scope |
| Orchestration kernel | Enforce plan and identity consistency; dependency/effect admission; deterministic scheduling; bounded lifecycle; event/result collection; classification plumbing; final advisory decision | Product assertions, SQL knowledge, cloud resource discovery, browser selectors, fixture semantics, or release cutover |
| Adapter | Prove one capability/environment boundary; translate kernel lifecycle into bounded local/build/HTTP/browser/DB/AWS/remote operations; return structured status and raw evidence | Select packs, reinterpret native product results, hide ambient inputs, or own unrelated domain fixtures |
| Test pack | Declare domain, level, contract, prerequisites, identities, effects, fixtures, native command, persistent assertions, cleanup/residue, negative cases, and maturity | Overall `GO`/`NO-GO`, undeclared cross-domain behavior, implicit environment discovery, or generic process control |
| Native runner | Execute its product assertion contract and produce attributable native output/result | Overall selection, environment admission, global cleanup, evidence retention, or release admission |
| Environment-effect boundary | Prove target identity/capability immediately before action and admit only declared effects | Treat source/config memory as environment proof or permit effects after failed preflight |
| Cleanup/recovery boundary | Know whether mutation began; wait for termination; rollback/clean owned effects; independently prove residue; report incomplete cleanup | Run ordinary cleanup after pre-mutation schema failure or declare success from absence of an exception |
| Evidence writer/store | Persist immutable, versioned, hash-linked plan/events/results/failures/cleanup/final evidence, including partial attempts | Decide semantic success or accept unverifiable self-declared scope |
| Evidence validator | Independently reconstruct required scope and identity; validate schema, hashes, completeness, classifications, cleanup, expiry, and authority | Trust the final document's own required-check list or modify evidence |
| Release admission | Accept evidence only from the currently authorized gate and enforce approved stage/candidate/environment/operation rules | Promote advisory evidence, waive blockers silently, or infer rollback/provenance capability |
| LLM analysis boundary | Explain and cluster evidence, propose options and negative cases, identify `unclassified` gaps | Execute, mutate, decide admission, or fill missing evidence with inference |

### Identity Separation

| Identity | Conceptual meaning | Change trigger | Must bind to |
| --- | --- | --- | --- |
| `productCandidateId` | Immutable shipped product, dependency, and migration content proposed for release | Any included shipped-product byte or declared dependency/migration change | Exact admin/portal/shared/product components; bundle and deployment provenance |
| `harnessVersion` | Immutable qualification kernel, adapter, schema, manifest, selection, and pack-definition content | Any runner, fixture, assertion, selector, parser, cleanup, transport, evidence, or policy change | Plans, attempts, validators, and pack versions |
| `attemptId` | One execution of one plan against one candidate and target | Every invocation, including an exact rerun | Start/end events, child commands, results, cleanup, and final evidence |
| `environmentIdentity` | Target identity and capability proof applicable to the action | Target/config/credential/capability change or new proof window | Every effectful adapter result and deployed assertion |
| `testPackVersions` | Exact selected pack definitions and native assertion contracts | Pack content or authoritative contract change | Plan selection, result, maturity, and coverage map |

The exact fingerprint composition and ownership remain Sprint `1B` decisions.

### Environment Effect and Cleanup Boundary

Every stateful execution must conceptually distinguish:

1. declared prerequisites and effects;
2. environment and identity proof after effective configuration loading;
3. schema/capability-only preflight;
4. effect admission;
5. mutation-start evidence;
6. product assertion execution;
7. proved termination or cancellation;
8. owned cleanup or rollback;
9. independent residue verification; and
10. final result and evidence closure.

A failure before step 4 closes without fixture cleanup or any other ordinary
effect. A failure after step 5 requires termination, recovery, and explicit
residue status. Unknown mutation state cannot be reported as clean. The detailed
state model is reserved for Sprint `1C`; schema fields and interfaces are
reserved for later sprints.

## Decision Framework

### Decision Method

Every Phase 1 decision record must contain:

1. the invariant and Phase 0 evidence it addresses;
2. the options genuinely supported by that evidence;
3. safety, diagnostic, complexity, compatibility, operating-cost, and migration
   tradeoffs;
4. the selected option or an explicit `deferred` state;
5. rejected options and the deterministic reason;
6. negative, interruption, and no-loss verification required later;
7. the owner and downstream sprints affected; and
8. whether Bill's approval is required before the choice is incorporated.

Evidence strength is ordered: verified source/retained machine evidence,
authoritative project contract, current documentation, historical narrative,
then inference. A weaker source cannot overrule a stronger one. Missing evidence
produces `deferred` or `unresolved`, not a guessed decision.

Bill's explicit approval is required when a decision changes the controlling
strategy, release authority, promotion/certification standard, environment
effects, cross-repository ownership, durable operating cost/retention policy,
or exact Phase 2 file scope. Codex owns technical recommendations within those
boundaries and must present evidence and tradeoffs rather than ask Bill to choose
implementation details.

### Initial Decision Register

| ID | Decision to make | Evidence | Options and material tradeoff | Decision criteria | Status / approval / sprint |
| --- | --- | --- | --- | --- | --- |
| D01 | Exact fingerprint composition for the five identities | Plan `:54-64`; audit `:750-768,867-876` | Repository trees, shipped-artifact manifests, or composed component digests differ in reproducibility and shipped-content fidelity | Harness-only changes never alter product ID; every artifact is reproducible and independently checkable | Conceptually decided in `1B`; common references and canonical encoding drafted in `1D`; exact executable manifests remain Phase 2 scope |
| D02 | Repository and document authority for kernel, adapters, packs, schemas, and manifests | Audit CP02/CP06 and RN32-RN33 at `:1062-1066,1131-1132` | Admin-owned, shared package, or dedicated harness ownership trade simplicity against cross-repo coupling and release independence | Clear owner, no circular imports, harness changes isolated from product candidate | O1 bounded admin ownership approved by Bill for `1C`; exact ownership/file scope remains `1G` |
| D03 | Authority chain between planner, kernel, validator, advisory result, and legacy admission | Plan `:22-28`; audit `:1027-1055` | One process, separated validators, or separately invoked admission differ in independent verification and complexity | Validator reconstructs scope; advisory evidence cannot self-promote | Producer/validator/consumer authority decided in `1B`; validation sequence and evidence bindings drafted in `1D`; migration authority remains `1G` |
| D04 | Kernel execution/state model and safe continuation after a failure | Audit `:458-485`; runbook conflict recorded at audit `:1309-1313` | Strict fail-fast, effect-aware dependency stop with independent diagnostics, or full aggregation | No dependent effect after failed prerequisite; attributable blockers; minimal scheduler complexity | Conceptually decided in `1C`: stable serial topological execution, effect-aware dependency blocking, and only independent declared read-only continuation |
| D05 | Local process timeout, cancellation, process-tree termination, and output capture | Audit `:470-485`; CP09 at `:1066` | Platform process groups, job objects/process supervisors, or constrained child abstractions differ in portability and certainty | Proved termination, bounded output, signal record, partial evidence | Lifecycle decided in `1C`; conceptual process/build contract and required whole-tree proof decided in `1E`; platform implementation remains later scope |
| D06 | Remote execution, transport, cancellation, and late-result handling | Audit `:366-382,585-590,828-835`; CP21/CP26 at `:1079,1084` | Bounded command output, durable object result, or managed job protocol trade simplicity against size and cancellation guarantees | No truncation; remote termination before cleanup; hash-linked result; late results quarantined | Conceptual endpoint/principal/command/framing/idempotency/cancellation contract decided in `1E`; migration remains `1G` |
| D07 | Canonical evidence model, validation independence, and hash graph | Audit `:362-382,537-548`; CP05/CP10-CP12 at `:1063,1067-1069` | Single envelope, linked typed documents, or event-sourced bundle trade compactness against partial-evidence durability | Six required schemas, structural comparison, independently reconstructed scope, tamper detection | Drafted in `1D`: six linked immutable documents, `RQ-C14N-1`, SHA-256 hash graph, and independent reconstruction; executable definitions remain later scope |
| D08 | Durable evidence location, retention period, access, and cleanup ownership | Audit `:752-757,944-968`; CP22 at `:1080` | Repository artifact, object storage, CI artifact, or hybrid trade access, durability, privacy, and cost | Survives workspace cleanup/interruption; immutable; least privilege; stated retention | Bill approved R4 immutable content-addressed storage plus searchable catalog and local cache; backend, durations, access/hold/deletion authority, ownership, and cost remain `1G` |
| D09 | Failure-class derivation and authority | Plan `:65-76`; audit `:722-749,840-907` | Kernel rule set, adapter evidence codes, or pack-declared mappings differ in domain knowledge and central consistency | Exactly one evidenced class; contract and next safe action recorded; `unclassified` stops | Coordination decided in `1C`; the one-class, sufficiency, contributing-condition, and mandatory-stop fields are drafted in `1D` |
| D10 | Cleanup, recovery, and residue state model | Audit `:384-393,517-535,585-597,919-921` | Pack-owned, adapter-owned, or coordinated responsibilities differ by effect boundary | Mutation boundary known; cleanup after termination; independent residue proof; recoverable interruption | Lifecycle coordination decided in `1C`; common adapter, fixture, cleanup, and independent-residue obligations decided in `1E`; pack ownership detail remains `1F` |
| D11 | Adapter boundary and capability model | Audit `:290-393,1248-1317`; 20 `wrap` components at `:1153-1160` | Capability-specific adapters or runner-specific wrappers trade reuse against hidden semantics | Explicit inputs/effects; no product semantics in kernel; no ambient prerequisites | Decided in `1E`: common contract plus closed versioned capability/effect vocabulary and capability-specific safety contracts; executable APIs remain later scope |
| D12 | SQL safety architecture | `docs/AGENTS.md:1-22`; audit `:304-311,581-584` | Structured statement declarations plus verified metadata guard; exact parser/tool choice remains open | One-object DDL proof, per-statement admission, no guessed identifiers, correct pre/post-mutation behavior | Safety sequence and grammar-aware/structured admission requirement decided in `1E`; implementation library and environment certification remain later scope |
| D13 | AWS identity and environment-capability architecture | `docs/AGENTS.md:24-29`; audit `:340-360,517-528` | Adapter-issued identity proof, capability token, or bound execution context differ in lifetime and coupling | Proof after effective env load; explicit account/profile/resource; no ambient credential authority | Explicit post-load identity, operation allowlists, permission-denial evidence, and no-workaround rule decided in `1E`; IAM changes require separate authority |
| D14 | Browser selector, persistent-state, and screenshot-evidence contract | `docs/AGENTS.md:81-86`; audit `:366-373,836-837` | Product-owned test IDs/active state, scoped semantic selectors, or explicit APIs trade product changes against stability | Product boundary, durable transition proof, linked screenshots, no toast/global-text authority | Mechanical contract decided in `1E`; pack semantic ownership and any product-facing selector additions remain `1F`/later approved implementation |
| D15 | Fixture lifecycle and no-real-external-effect contract | Audit `:384-393,581-597,1288-1317` | Transaction-only, owned resource ledger, or pack-specific recovery trade generality against exact ownership | Preflight first; suppression proved end to end; recoverable cleanup and residue | Common fixture identity/resource-ledger/interruption/zero-residue contract decided in `1E`; domain fixture definitions and certification remain `1F` |
| D16 | Pack manifest/interface, native authority, maturity, and certification thresholds | Plan `:77-108`; audit `:1092-1132,1320-1370` | Uniform normative manifest with capability extensions versus unbounded per-pack declarations; retain or revise 10/3 thresholds | No-loss coverage, deliberate negatives, interruption, cleanup, cost-proportionate repeatability | Decided in `1F`: uniform normative pack contract, four maturity levels, separate operating status, independent certification, and unchanged 10/3 minimum baseline; promotion/cutover remains `1G` |
| D17 | Deterministic selection policy and mandatory core | Plan `:238-250`; audit `:281-288,1199-1218` | Control/provenance core plus operation gates and impacted packs, always-full, or core plus every native aggregate | Unknown scope fails closed; representative inclusion/omission proof; full regression available | MC2 approved by Bill before `1G`: deterministic control/provenance core, operation-triggered safety gates, dependency-expanded impacted packs, and explicit/scheduled full regression |
| D18 | Advisory dual-run, disagreement, rollback, and admission transition | Plan `:275-305`; audit `:867-876,1416-1431` | Shadow-only, dual-required, or staged pack promotion differ in release friction and safety | Existing authority preserved; no double effects; disagreement classified; reversible cutover | Designed in `1G`: legacy authority throughout advisory operation, pack-by-pack promotion cohorts, immutable disagreement records, and version rollback; Bill must approve migration transitions and any later admission change |
| D19 | Exact Phase 2 acceptance criteria and implementation file scope | Plan `:168-192`; audit `:1433-1446` | Minimal new isolated foundation versus reuse of selected retained primitives | Pure-local scope, synthetic fixtures only, negative/interruption coverage, no PATH runtime imports | Proposed in `1G` as an isolated `qualification/` package plus documentation updates; no file exists or is authorized until Bill approves the exact scope |

No option in this register is selected merely because it is listed. Charter-fixed
outcomes come from the controlling plan; all other rows remain open until their
assigned sprint records the evidence-led decision.

## Proposed Phase 1 Sprint Breakdown

This sequence is advisory. Each sprint needs a new prompt from Bill. Documenting
the sprint does not authorize it. Unless Bill states a narrower or different
boundary, every Phase 1 sprint remains documentation-only design: it may inspect
committed source and accepted evidence, and may update only expressly named
planning/design artifacts. It may not change executable code, tests, schemas,
configuration, or environments; run workflows/tests/builds; use SQL/database,
AWS, browsers, HTTP services, deployments, or fixtures; access TEST/PROD; repair
findings; or begin the following sprint.

### Sprint 1A - Charter and Decision Framework

- **Objective:** establish the Phase 1 charter, mandatory invariants, conceptual
  boundaries, decision framework, sprint sequence, and completion map.
- **Permitted effects:** read-only source/evidence review; create this document;
  update the controlling checkpoint and ledger.
- **Prohibited effects:** all executable, configuration, environment, repair,
  detailed-schema/interface/API, implementation-file, and later-sprint work.
- **Deliverables:** this Sprint `1A` foundation and its plan checkpoint.
- **Verification:** trace each mandatory constraint to Phase 0 evidence; map all
  Phase 1 deliverables to a proposed sprint; confirm no option was silently
  finalized.
- **Stopping point:** charter and advisory sequence recorded; no detailed
  architecture begun.
- **Dependencies:** accepted Phase 0 audit and Bill's explicit Phase 1/Sprint
  `1A` authorization.
- **Approval to begin:** satisfied by Bill's 2026-08-10 prompt.

### Sprint 1B - Identity, Authority, and Ownership Model

- **Objective:** decide the conceptual five-identity model, authority chain,
  candidate/harness fingerprint boundaries, and repository ownership model.
- **Permitted effects:** read-only source/evidence review and updates only to the
  architecture document and controlling plan unless Bill names another design
  artifact.
- **Prohibited effects:** global Phase 1 prohibitions; no schema drafts,
  interface contracts, implementation APIs/files, or migration execution.
- **Deliverables:** identity definitions/composition rules, provenance and
  authority graph, ownership options/decision, unresolved ownership register,
  and no-product-redeploy examples for harness-only changes.
- **Verification:** trace every identity to retained `r3-r34` gaps and the 88-unit
  ownership matrix; walk one product-only, harness-only, mixed, and exact-rerun
  case on paper.
- **Stopping point:** conceptual identity/authority/ownership decision recorded;
  no evidence schemas or kernel lifecycle selected.
- **Dependencies:** Sprint `1A`; decisions D01-D03.
- **Exact approval required:** **Bill explicitly authorizes Sprint `1B` of Phase
  1 to define the identity, authority, and repository ownership model under a
  newly stated documentation-only, no-implementation, and no-environment-access
  scope.**

### Sprint 1C - Minimal Kernel and Lifecycle Design

- **Objective:** define the smallest domain-neutral kernel responsibilities,
  execution states, prerequisite/effect admission, safe continuation, process
  lifecycle, cleanup coordination, and failure-class decision boundary.
- **Permitted effects:** documentation-only analysis and expressly authorized
  architecture/plan edits.
- **Prohibited effects:** global Phase 1 prohibitions; no final schemas,
  adapter/test-pack interfaces, executable state machine, or process experiments.
- **Deliverables:** conceptual state/lifecycle model, dependency/effect rules,
  termination-before-cleanup rule, classification authority, kernel exclusions,
  and negative/interruption scenario catalogue.
- **Verification:** paper-walk the failed-prerequisite/later-fixture case, local
  timeout, remote timeout, output truncation, cleanup failure, source drift, and
  `unclassified` stop without adding domain semantics to the kernel.
- **Stopping point:** kernel and lifecycle decisions complete at design level;
  no JSON schema or adapter API drafted.
- **Dependencies:** Sprint `1B`; decisions D04-D05, D09-D10.
- **Exact approval required:** **Bill explicitly authorizes Sprint `1C` of Phase
  1 to design only the minimal kernel and lifecycle model under the continuing
  documentation-only and no-environment boundary.**

### Sprint 1D - Evidence, Validation, and Retention Drafts

- **Objective:** draft the versioned evidence family and decide canonicalization,
  hash linkage, independent validation, partial evidence, and durable retention.
- **Permitted effects:** documentation-only schema drafts and architecture/plan
  updates expressly named by Bill.
- **Prohibited effects:** global Phase 1 prohibitions; schemas remain
  non-executable drafts and cannot be wired into current admission.
- **Deliverables:** draft plan, execution-event, check-result, failure, cleanup,
  and final-evidence schemas; evidence-link graph; validation rules; corruption,
  interruption, and retention cases; retention options/recommendation.
- **Verification:** static example review for valid, malformed, missing,
  truncated, corrupted, reordered, interrupted, stale, and identity-mismatched
  evidence; trace validator scope independently from producer claims.
- **Stopping point:** draft evidence contracts and open retention decision
  recorded; no adapter or pack interface finalized.
- **Dependencies:** Sprints `1B-1C`; decisions D07-D09.
- **Exact approval required:** **Bill explicitly authorizes Sprint `1D` of Phase
  1 to produce documentation-only versioned evidence-schema drafts and the
  validation/retention design, with no executable schema or environment work.**

### Sprint 1E - Adapter and Safety-Decision Contracts

- **Objective:** define conceptual adapter contracts and resolve the Phase 1 SQL,
  JSON comparison, process-control, browser-selector, fixture-lifecycle,
  AWS-identity, environment-capability, and remote-transport decisions.
- **Permitted effects:** documentation-only architecture decisions and
  expressly named design artifacts.
- **Prohibited effects:** global Phase 1 prohibitions; no adapter code, SQL,
  browser/AWS/remote trials, current-runner repair, or check migration.
- **Deliverables:** adapter responsibility matrix, capability/effect declarations,
  lifecycle/error obligations, domain-safety decision records, and certification
  obligations for local process/build/HTTP/browser/DB/AWS/remote boundaries.
- **Verification:** map every `wrap`/adapter-relevant `repair` or `replace`
  component to one boundary; paper-walk wrong target, preflight failure, timeout,
  forced interruption, output overflow, cleanup failure, and zero-residue proof.
- **Stopping point:** conceptual adapters and safety decisions complete; no
  implementation API or migrated pack.
- **Dependencies:** Sprints `1B-1D`; decisions D05-D06 and D11-D15.
- **Exact approval required:** **Bill explicitly authorizes Sprint `1E` of Phase
  1 to define documentation-only adapter contracts and domain-safety decisions,
  with no implementation, environment access, or runner repair.**

### Sprint 1F - Test-Pack, Selection, and Certification Policy

- **Objective:** define the modular pack contract, native-runner authority,
  deterministic selection policy, maturity states, certification rules, and
  no-loss coverage governance.
- **Permitted effects:** documentation-only policy/interface design and
  expressly named architecture/plan artifacts.
- **Prohibited effects:** global Phase 1 prohibitions; no pack implementation,
  check migration, test execution, or promotion to mandatory.
- **Deliverables:** conceptual pack interface/manifest, mandatory-core and
  dependency-selection options/recommendation, explicit/scheduled full-regression
  rules, maturity transitions, certification thresholds, coverage ownership, and
  deliberate inclusion/omission cases.
- **Verification:** trace all 28 current checks and 88 material units to preserved
  coverage or an explicit future decision; paper-test unknown files, dependency
  cycles, unrelated domains, requested suites, and full regression.
- **Stopping point:** selection and pack policy ready for Bill's governance
  decision; nothing is migrated or promoted.
- **Dependencies:** Sprints `1B-1E`; decisions D14-D17.
- **Exact approval required:** **Bill explicitly authorizes Sprint `1F` of Phase
  1 to define the documentation-only pack, selection, maturity, and certification
  policy and to present certification/selection choices for Bill's decision.**

### Sprint 1G - Advisory Migration, Rollback, and Phase 2 Approval Package

- **Objective:** integrate the approved Phase 1 decisions into the completed
  architecture, advisory migration/rollback design, repository/file ownership,
  Phase 2 acceptance criteria, and exact proposed Phase 2 file scope.
- **Permitted effects:** documentation-only consolidation and expressly
  authorized architecture/plan/design artifacts.
- **Prohibited effects:** global Phase 1 prohibitions; no Phase 2 files may be
  created or changed, no current admission may consume advisory evidence, and no
  migration/cutover may begin.
- **Deliverables:** completed architecture and decision register, migration
  stages, dual-run disagreement procedure, rollback/observation design, evidence
  authority transition, final repository ownership, Phase 2 acceptance matrix,
  exact proposed Phase 2 file list, and unresolved-risk register.
- **Verification:** trace every Phase 1 deliverable and mandatory invariant;
  reconcile every Phase 0 disposition; paper-walk advisory disagreement,
  harness-only change, rollback, partial evidence, and failed cutover; confirm
  Phase 2 stays pure local and synthetic.
- **Stopping point:** Phase 1 completion recommendation recorded and presented to
  Bill; no Phase 2 implementation begins.
- **Dependencies:** Sprints `1B-1F`; decisions D02-D03, D08, and D16-D19.
- **Exact approval required:** **Bill explicitly authorizes Sprint `1G` of Phase
  1 to complete only the advisory migration, rollback, ownership, acceptance,
  and exact Phase 2 scope package under a documentation-only boundary.** Phase 2
  would still require a later, separate approval after Bill reviews Phase 1.

## Phase 1 Completion Map

| Required Phase 1 deliverable | Foundation established in `1A` | Completing sprint(s) | Completion proof |
| --- | --- | --- | --- |
| Minimal orchestration-kernel design | Kernel is domain-neutral and excludes product/environment semantics | `1C`, integrated `1G` | Responsibilities, lifecycle, exclusions, negative/interruption cases trace to M01-M10 |
| Versioned plan, execution-event, check-result, failure, cleanup, and final-evidence schema drafts | Six-document family and evidence principles identified | `1D`, integrated `1G` | Each draft versioned, linked, identity-bound, statically reviewed against corrupt/partial cases |
| Adapter and test-pack interface contracts | Conceptual responsibility boundaries established | Adapters `1E`; packs `1F`; integrated `1G` | Every Phase 0 component maps to one owned boundary without coverage loss or circular authority |
| Deterministic selection rules | Mandatory inclusion/omission invariants established | `1F`, integrated `1G` | Core/impacted/scheduled/requested rules and unknown-scope negatives approved |
| Advisory migration and rollback design | Current-gate authority and advisory-only requirement fixed | `1G` | Dual-run, disagreement, rollback, observation, promotion, and authority-transition rules approved |
| Repository and file ownership | Ownership is an explicit decision, not inferred from current layout | Conceptual `1B`; exact ownership/file scope `1G` | No circular imports; harness-only changes isolated; Bill approves cross-repo choice and file scope |
| SQL safety decision | M04-M06 bind live proof and effect ordering | `1E`, integrated `1G` | Decision follows `docs/AGENTS.md`, rejects guessed identifiers, and defines interruption/residue obligations |
| JSON comparison decision | M09/M13 require canonical structural comparison | `1D`, integrated `1G` | Canonicalization and hash rules reject reorder-only differences as product failures |
| Process-control decision | M07 establishes bounded termination before cleanup | `1C/1E`, integrated `1G` | Local/remote timeout, cancel, child-tree termination, late result, and partial evidence addressed |
| Browser-selector decision | M14 defines product-owned/persistent proof | `1E/1F`, integrated `1G` | Selector/state/screenshot authority excludes global text and transient toasts |
| Fixture-lifecycle decision | M04/M08 define preflight, mutation, cleanup, residue | `1C/1E/1F`, integrated `1G` | Ownership and recovery are explicit for every stateful pack class |
| AWS-identity decision | M05/M15 require post-load explicit identity | `1E`, integrated `1G` | Account/profile/resource/capability proof is bound to each remote action |
| Remote-transport decision | M07/M09 require bounded, complete, cancellable evidence | `1E`, integrated `1G` | Oversize, truncation, timeout, cancellation, cleanup overlap, and late results are addressed |
| Acceptance criteria and exact Phase 2 file-scope approval | Phase 2 remains pure local, synthetic, and separately authorized | `1G` | Acceptance matrix and exact files are reviewed and explicitly approved by Bill |

Phase 1 is complete only when every row is complete, all mandatory invariants are
traced, the open decision register is closed or explicitly deferred with a
blocking reason, and Bill approves the architecture and exact Phase 2 file scope
(`release-qualification-harness-rebuild-plan-2026-08-10.md:144-166`).

## Unresolved Questions Requiring Bill's Decision

No question below blocks Sprint `1A`; each is reserved for its evidence-bearing
sprint. Codex must make a technical recommendation before asking Bill to decide.

| Question | Why Bill must decide | Decision point |
| --- | --- | --- |
| Are the Sprint `1G` R4 operating recommendations approved: AWS S3 Object Lock durable originals, a rebuildable DynamoDB metadata catalog, separate KMS/access/audit roles, proposed retention periods, and Platform Operations ownership? | Bill approved R4's direction but provider, durations, access/hold/deletion authority, operator, DR and cost are operating-risk decisions | Bill decision before Phase 2; D08 |
| Is the completed Phase 1 architecture, including the advisory disagreement/emergency policy, accepted? | Acceptance closes the design gate but does not authorize migration, admission changes, or environment work | Bill decision before Phase 2; D18 |
| Is the exact isolated `qualification/` Phase 2 scope approved? | The controlling plan requires exact file-scope approval and Phase 2 has a separate effects boundary | Bill decision and separate Phase 2 authorization; D19 |

Technical evidence gaps U01-U04 do not become business questions merely because
they are unresolved. Later design must expose them; later authorized
certification or environment work must supply the missing facts.

## Sprint 1A Files, Effects, and Verification

Examined:

- `docs/AGENTS.md`;
- `docs/planning/release-qualification-harness-rebuild-plan-2026-08-10.md`;
- `docs/planning/release-qualification-harness-current-state-audit-2026-08-10.md`;
- the exact source references already verified and accepted in the Phase 0 audit.

Changed only:

- this target-architecture document; and
- the controlling plan's checkpoint and Sprint Ledger.

Verification is limited to read-only documentation consistency: required
sections, invariant/decision/sprint identifiers, Phase 1 deliverable coverage,
scope language, references, formatting, and worktree state. No executable or
environment verification is authorized by Sprint `1A`.

One broad initial read of `docs/AGENTS.md` and one combined follow-up read exceeded
the tool's display budget. The relevant governance and documentation sections
were reread in narrower ranges. This was a source-display limitation, not an
unexplained operational failure, and caused no write or environment effect.

Final worktree state: admin remains on `main...origin/main` with the pre-existing
modified `docs/AGENTS.md`,
`docs/ops/deployments/release-qualification-runbook.md`, and
`docs/planning/README.md`; the pre-existing untracked Phase 0 audit and
controlling-plan files remain untracked; and this new target-architecture file is
untracked. Portal and shared remain clean on `main...origin/main`. Intacct mock
remains the non-Git directory established in Phase 0 and was not re-probed. No
pre-existing user change was reverted or overwritten.

## Sprint 1A Completion Decision

Sprint `1A` is complete. This document and the controlling checkpoint passed the
permitted read-only consistency review. The sprint establishes a meaningful
architecture foundation but does not complete Phase 1.

The exact approval required for proposed next work is: **Bill explicitly
authorizes Sprint `1B` of Phase 1 to define the identity, authority, and
repository ownership model under a newly stated documentation-only,
no-implementation, and no-environment-access scope.**

No other Phase 1 sprint, repair, implementation, migration, environment access,
or Phase 2 work is authorized by this document.

That authorization condition was satisfied when Bill separately authorized
Sprint `1B`. The result of that bounded sprint follows.

## Sprint 1B Outcome

Sprint `1B` defines a conceptual and field-level identity model, a deterministic
authority matrix, and the required evidence lineage without drafting the Sprint
`1D` JSON schemas or the Sprint `1C` lifecycle. The model is independent of
physical repository choice: explicit role manifests determine what contributes
to product, harness, and pack identities, so co-location cannot silently
conflate them.

The sprint recommends a bounded admin-owned qualification control plane with
native product tests retained in their owning repositories and explicit
cross-repository harness-role declarations. A dedicated harness repository is a
credible, materially different alternative. Because Sprint `1A` reserved
cross-repository ownership for Bill, the recommendation is not the controlling
choice until Bill approves it. No other Sprint `1B` conclusion depends on that
choice.

## Identity Model

### Common Identity Rules

The five required identities are deterministic references to canonical
manifests, except `attemptId`, which is an opaque unique execution identifier.
This section names conceptual fields and sources; it does not define serialized
JSON shapes.

Every content-derived identity conceptually carries:

- a stable identity kind and identity-definition version;
- a declared canonicalization and digest algorithm;
- the aggregate digest;
- references to the canonical component or pack manifests from which it was
  calculated; and
- producer and independent-validation evidence.

Role manifests classify inputs by what they affect, not merely by repository or
directory. The minimum roles are `product`, `harness`, `test-pack`, and
`generated-evidence`; one file or dependency may explicitly have more than one
role. An overlapping role legitimately changes more than one identity. An
unmapped, ambiguously mapped, missing, or conflicting input fails candidate or
harness definition; it is never silently assigned by file location. This
corrects the current whole-tree conflation proved at audit `:750-768,867-876`
while preserving canonical file hashing from CP05 at audit `:1063`.

Secrets and raw credentials are never identity inputs or evidence. Environment
identity uses non-secret identifiers, effective-configuration digests, and
provider proof references sufficient to establish the target and capability.

### `productCandidateId`

| Property | Definition |
| --- | --- |
| Meaning | The immutable behavior-bearing product content proposed for release, independent of qualification machinery, release label, attempt, and target environment |
| Source inputs | A stable sorted map of product components; each component's role-filtered shipped source digest; production dependency closure and integrity digests; applicable migration-content digest; declared build/runtime inputs; component relationship and identity-definition version |
| Producer | Deterministic candidate-definition step operating from reviewed role manifests and exact repository/source state |
| Independent validator | Candidate validator recomputes the component set, role-filtered digests, dependency closures, migration set, and aggregate digest from authoritative manifests and source |
| Immutability boundary | Frozen when a plan is accepted; any included product, dependency, migration, or candidate-definition input change creates a different ID and invalidates the plan |
| Lifecycle | Defined before planning; bound to the plan; copied unchanged into the attempt, events, results, cleanup, final evidence, deployment provenance, and release admission |
| Consumers | Planner, source-stability validator, build/provenance validation, advisory comparator, evidence validator, deploy admission, and later rollback/recovery proof |

Cross-repository representation is a canonical map keyed by stable component ID,
not a concatenated repository string. Each component record identifies its
repository authority, source revision where available, role-manifest version,
role-filtered content digest, production dependency closure digest, migration
digest if applicable, and dirty-source policy result. The aggregate candidate ID
is derived from the sorted component records. Adding, removing, or reclassifying
a component changes the candidate-definition input and therefore produces a new
candidate ID even when product bytes happen to match.

The following alter `productCandidateId`:

- shipped admin, portal, shared, Intacct, or later component runtime source;
- production/runtime dependencies or their resolved integrity values;
- migration files that are part of the candidate's deployable schema behavior;
- committed generated runtime code or other generated content treated as a
  product source input; and
- a role-manifest or identity-definition change that changes the product input
  set or its interpretation.

The following do not alter it unless the same change also affects shipped
product behavior:

- tests, expectations, fixtures, selectors, parsers, cleanup, transports,
  evidence definitions, adapters, pack manifests, and qualification docs;
- qualification-only scripts placed in a product repository;
- attempt/release labels and reruns;
- target environment state or configuration; and
- deterministic build metadata generated from an unchanged candidate.

Build outputs and generated deployment artifacts do not silently redefine the
source candidate. Their content digests and generating-input references bind
them to `productCandidateId` through build, provenance, and deployment evidence.
If identical candidate inputs produce unexpected different behavior-bearing
bytes, validation reports a conflict; it does not mint a new candidate after the
fact. This preserves the useful bundle and descriptor primitives at audit
`:1077` while addressing their incomplete consumer proof at `:486-505`.

### `harnessVersion`

| Property | Definition |
| --- | --- |
| Meaning | The immutable qualification-system definition used to plan, execute, interpret, validate, and compare one attempt |
| Source inputs | Role-filtered kernel, planner, adapters, evidence definitions, validators, fingerprint rules, coverage/selection manifests, test-pack registry, runner bindings, fixtures, assertions, selectors, parsers, cleanup/recovery rules, transports, qualification-only generated inputs, and harness dependency closure |
| Producer | Deterministic harness-definition step using the reviewed harness and pack-role manifests across every contributing repository |
| Independent validator | Harness validator reconstructs all contributing component/pack digests and the aggregate from authoritative manifests and exact source |
| Immutability boundary | Frozen before plan acceptance; any contributing byte, dependency, manifest meaning, or identity rule change creates a new version and invalidates an unstarted plan |
| Lifecycle | Defined before planning; bound to plan and attempt; referenced by all events/results/cleanup/final evidence and advisory comparisons; never changed within an attempt |
| Consumers | Planner, kernel, adapters, pack loader, evidence writer/validator, advisory comparator, certification records, and later release-admission migration logic |

Every change named by the controlling plan as a test expectation, fixture,
selector, parser, cleanup rule, transport, or evidence definition changes
`harnessVersion` (`release-qualification-harness-rebuild-plan-2026-08-10.md:54-64`).
Kernel, adapter, validator, identity, selection-policy, and qualification
manifest changes do the same. A product repository may contain harness-role
files; those contribute to `harnessVersion` but not `productCandidateId` unless
explicitly assigned both roles.

`harnessVersion` contains the selected pack registry and exact available pack
versions, but selection of a different unchanged subset for a particular attempt
does not by itself create a different harness version. Changing the selection
algorithm or registry does.

### `attemptId`

| Property | Definition |
| --- | --- |
| Meaning | One unique execution of one accepted plan under one harness version against one product candidate and requested target |
| Source inputs | A newly allocated opaque unique value plus immutable lineage to the accepted plan digest, candidate, harness, requested scope/target, and optional prior-attempt reference |
| Producer | Deterministic orchestration authority allocates it exactly once after plan acceptance and before any execution event |
| Independent validator | Evidence validator proves uniqueness within the evidence authority, one plan binding, and consistent use on every descendant record |
| Immutability boundary | Never reused or reassigned; a restart, retry, resumed execution that cannot prove continuity, or exact rerun receives a new attempt ID |
| Lifecycle | Allocated before first event; remains open, terminal, interrupted, or incomplete; is never converted into another attempt by rewriting evidence |
| Consumers | Kernel, adapters, packs, native-result wrappers, event/result/failure/cleanup writers, validators, advisory comparator, and admission-consumption record |

An exact rerun keeps the same candidate, harness, and pack versions when their
inputs are unchanged, but always receives a new `attemptId` and fresh required
environment proof. A `rerunOf` or equivalent lineage reference may relate
attempts conceptually, but it cannot make the later attempt a continuation or
replace the earlier evidence. Exact field encoding is reserved for Sprint `1D`.

### `environmentIdentity`

| Property | Definition |
| --- | --- |
| Meaning | The exact effective target and capability state proved for the actions in an attempt, never merely the name `DEV`, `TEST`, or `PROD` |
| Source inputs | Target class/name; provider account, region, principal and resource identifiers where applicable; host/service/runtime identity; effective non-secret configuration digest; tool/runtime capability versions; database host/database/user and schema/DDL proof digests where applicable; proof time and provider/raw-evidence hashes |
| Producer | The applicable environment/capability adapter obtains proof after the same configuration-loading sequence used by the action |
| Independent validator | Environment-identity validator checks target policy, proof freshness, capability completeness, raw-evidence hashes, and consistency before effect admission |
| Immutability boundary | Bound per proved target/capability snapshot; changed effective configuration, principal, resource, schema/capability state, or target creates a different identity; the attempt cannot silently replace one identity with another after effects begin |
| Lifecycle | Fresh proof is required at the applicable prerequisite boundary; identical freshly proved facts may yield the same identity value but a new proof record; stale proof cannot authorize an effect |
| Consumers | Prerequisite/effect admission, adapters, packs, results, cleanup/residue proof, final evidence, advisory comparison, and future environment-aware admission |

Environment identity is capability-aware. A local static check need not claim a
database or AWS identity it does not use. A deployed stateful pack must bind all
applicable target, cloud, host, database, browser/runtime, object-store, and
identity capabilities without exposing secrets. The exact aggregation and
freshness fields remain Sprint `1D` schema and Sprint `1E` adapter decisions.

Version-controlled runtime defaults classified as shipped product input change
`productCandidateId`; harness configuration changes `harnessVersion`; effective
target configuration changes `environmentIdentity`. A single file can therefore
change more than one identity only when its explicit roles justify that result.

### `testPackVersions`

| Property | Definition |
| --- | --- |
| Meaning | The exact immutable versions of the selected modular test packs, represented as a stable map from pack ID to pack-version digest |
| Source inputs | Pack manifest and authoritative contract reference; native runner binding; product surfaces; level; prerequisites/capabilities; pack-owned assertions, expectations, fixtures, selectors, parsers, cleanup/residue rules; adapter contract requirements; pack dependencies and pack-owned dependency closure |
| Producer | Deterministic pack-definition step under the pack's declared owner; the planner selects only validated versions from the harness registry |
| Independent validator | Pack validator recomputes each selected pack digest and verifies registry, dependency, native-binding, and harness compatibility |
| Immutability boundary | A pack definition or owned input change creates a new version; versions never mutate; a plan freezes the selected map |
| Lifecycle | Available versions belong to a harness definition; selected versions bind to the plan, attempt, pack events/results/failures/cleanup, final evidence, comparison, maturity, and certification records |
| Consumers | Planner, kernel, adapters, native-result wrapper, evidence validator, advisory comparison, coverage map, and later promotion/admission policy |

Changing a pack-owned test expectation, fixture, selector, parser, cleanup rule,
or native binding changes that pack's version and the aggregate
`harnessVersion`. A generic adapter implementation change changes
`harnessVersion`; it changes a pack version only when the pack contract or
declared adapter requirement also changes. Selecting a different set of
unchanged packs changes the plan's selected map and produces a new attempt, but
does not rewrite the individual pack versions.

### Identity Failure Rules

| Condition | Required deterministic response |
| --- | --- |
| Required identity or contributing manifest is missing | Reject the candidate, harness, or plan before execution; do not infer from path, Git head, release label, or prior evidence |
| File/dependency has no role or conflicting role declarations | Fail definition as ambiguous; record the path/coordinate and manifest authorities in conflict |
| Candidate or harness input changes after plan acceptance | Mark the plan stale and reject execution, or interrupt an active attempt under the Sprint `1C` lifecycle; never update the bound identity in place |
| Child event/result/cleanup carries a different candidate, harness, attempt, environment, or selected pack version | Reject the child evidence and prevent final `GO`; preserve both conflicting values and their sources |
| Environment proof is missing, expired, incomplete, or conflicts with the requested target | Fail prerequisite admission; authorize no dependent effect |
| Selected pack is missing, stale, incompatible, or its digest differs | Reject plan or pack execution; do not substitute another version |
| Build/deployment artifact claims the candidate but its content/provenance does not validate | Reject artifact/admission; do not mint or relabel a candidate |
| Same `attemptId` appears with a different plan or identity tuple | Treat as evidence corruption/replay conflict and reject every conflicting chain |
| Prior evidence is outside its validity window or no longer matches independently recomputed authority | Reject as stale; validation does not refresh or rewrite it |

The later deterministic failure class for an identity failure is reserved for
Sprint `1C`; Sprint `1B` establishes only that it fails closed and remains fully
evidenced.

## Change-to-Identity Decision Table

Legend: `change` means the identity definition/digest must change. `new run`
means a new `attemptId` is allocated if qualification is executed after the
change. `same` means the identity remains unchanged when all other inputs remain
stable. `conditional` means the explicit role or effective target impact decides;
ambiguity fails closed. For `testPackVersions`, `pack change` means the affected
pack version changes; `set change` means selected-map membership changes while
individual version values remain immutable.

| Representative change | `productCandidateId` | `harnessVersion` | `attemptId` | `environmentIdentity` | `testPackVersions` | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| Shipped admin, portal, shared, or other product runtime source | change | same unless dual-role | new run | same | same unless contract/assertion also changes | Behavior-bearing product bytes changed |
| Production/runtime dependency resolution or integrity value | change | conditional if also harness dependency | new run | same | conditional if pack-owned dependency | Product dependency closure is candidate input |
| Test-only or harness-only dependency | same | change | new run | same | pack change when pack-owned | Non-shipped qualification capability changed |
| Lockfile containing both product and harness dependency changes | change for changed product closure | change for changed harness closure | new run | same | pack change for affected pack closure | Role-normalized closures, not raw repository location, determine impact |
| Product migration SQL or migration ordering/content | change | same unless guard/expectation changes | new run | same until applied | same unless migration pack changes | Candidate schema behavior changed |
| Applied migration/ledger/schema state in a target | same | same | new run | change | same | Target capability changed, not source candidate |
| Committed generated runtime source | change | conditional if generator/test role also changes | new run | same | conditional | It is shipped product input |
| Deterministically rebuilt artifact with identical bytes and provenance | same | same | new run only if qualification reruns | same | same | Artifact evidence changes; source identities do not |
| Artifact bytes differ under identical candidate/harness inputs | same pending conflict | same pending conflict | new run | conditional | same | Treat as provenance/build conflict, not an automatic new identity |
| Native product test expectation | same | change | new run | same | pack change | Product assertion changed, product runtime did not |
| Acceptance fixture or fixture relationship rule | same | change | new run | same | pack change | Fixture is harness/pack behavior |
| Browser selector or persistent-state assertion | same unless product DOM contract also changed | change | new run | same | pack change | Selector/assertion changes qualification behavior |
| Pack-specific parser | same | change | new run | same | pack change | Pack evidence interpretation changed |
| Generic evidence parser/validator | same | change | new run | same | same unless pack contract changes | Common harness authority changed |
| Cleanup, recovery, or residue rule | same | change | new run | same | pack change when pack-owned | Safety behavior changed |
| Generic local/remote transport implementation | same | change | new run | same unless capability proof changes | same unless pack requirement changes | Common execution/evidence transport changed |
| Evidence schema, canonicalization, or hash rule | same | change | new run | same | same unless pack result contract changes | Evidence authority changed |
| Coverage inventory, selection algorithm, or pack registry | same | change | new run | same | set/pack change only where definitions change | Harness planning authority changed |
| Adapter implementation with unchanged adapter contract | same | change | new run | same | same | Harness capability implementation changed |
| Adapter contract or required capability declaration | same | change | new run | same until proved target differs | pack change for affected declarations | Harness and dependent pack contract changed |
| Identity/role manifest changes product input membership | change | change | new run | same | conditional | Candidate definition and harness authority changed even if bytes match |
| Version-controlled shipped runtime default | change | same unless dual-role | new run | changes when effective target changes | same | Source behavior and potentially target configuration changed |
| Harness configuration default | same | change | new run | changes only when effective target proof changes | conditional | Harness definition changed; effective state is separately proved |
| Environment configuration, principal, resource, runtime, or DB schema state | same | same | new run | change | same | Exact target/capability changed |
| Secret rotation with same proved principal/capabilities | same | same | new run | same value with fresh proof, or change if effective identity differs | same | Secret bytes are excluded; effective non-secret identity governs |
| Exact rerun with unchanged inputs | same | same | new run | freshly proved; value may remain same | same selected map | An attempt is never reused |
| Different requested subset of unchanged packs | same | same | new run | freshly proved as applicable | set change; version values same | Selection belongs to the plan/attempt, not pack definition |
| Release label or operator description only | same | same | new run if executed | same | same | Human label is lineage metadata, not content identity |
| Documentation-only change outside authoritative harness/product manifests | same | same | new run only if executed | same | same | Non-authoritative prose is not behavior-bearing input |
| Authoritative product contract documentation used by a pack | same | change | new run | same | pack change | Pack expectation authority changed, not shipped runtime |
| Deploy-admission or advisory-comparison logic | same | change | new run | same | same | Qualification/release-control behavior changed |

## Authority Model

### Authority Principles

- Producer and validator roles are logically independent even when later
  implementation places them in one repository. A producer cannot make its own
  output authoritative merely by embedding expected scope or a checksum.
- Independent validation means deterministic reconstruction from a different
  authority input or raw proof, not merely re-reading the producer's conclusion.
- Native product assertions retain semantic authority for their declared
  contract. The kernel may record status but cannot reinterpret a product
  assertion to obtain `GO`.
- During advisory migration, the new system may produce an advisory final
  decision. Only the existing approved admission path owns release authority
  until explicit cutover.
- An LLM recommendation is a separately attributable note. It cannot populate or
  override an authoritative decision field.

### Producer, Validator, and Consumer Authority Matrix

| Activity | Producer | Independent validator required | Consumer / decision authority | Deterministic authority | Prohibited authority |
| --- | --- | --- | --- | --- | --- |
| Candidate definition | Candidate-definition authority computes component manifests and `productCandidateId` | Yes: recompute component roles, digests, dependency/migration inputs, and aggregate | Planner, provenance, validator, admission | Reviewed role manifests and exact source bytes | Git head, repo path, release label, or producer declaration alone |
| Harness definition | Harness-definition authority computes `harnessVersion` and available pack registry | Yes: recompute every harness/pack contribution and aggregate | Planner, kernel, pack loader, evidence validator | Reviewed harness/pack manifests and exact bytes | Whole product-repository tree or self-reported version alone |
| Plan acceptance | Planner produces a canonical proposed plan bound to identity manifests and requested scope | Yes: plan validator reconstructs identities, permitted target, selection authority, dependencies, and required capabilities | Kernel may accept only a validated immutable plan | Validated candidate/harness/pack identities and deterministic policy | Operator prose, LLM recommendation, stale evidence, or plan's own claimed required set |
| Check selection | Deterministic selector produces selected pack/check set | Yes: plan validator recomputes from authoritative change/operation scope, policy, dependencies, and explicit request | Accepted plan | Approved policy and fail-closed mapping | Pack runner, LLM, or current result history changing selection ad hoc |
| Prerequisite admission | Kernel coordinates declared prerequisites; adapters produce raw capability proofs | Yes: identity/capability validators verify each proof and dependency before effect admission | Effectful adapter or pack | Validated plan plus fresh prerequisite proofs | A prior pass, environment name, source config, or continued loop after failure |
| Execution | Kernel issues work only through the declared adapter; adapter produces lifecycle events | Yes for identity, command binding, event linkage, termination, and result completeness; semantic assertions remain native | Pack/native runner for assertions; kernel for orchestration status | Accepted plan, adapter contract, and event evidence | Adapter selecting undeclared work; kernel inventing product semantics |
| Environment proof | Capability adapter obtains target/provider/runtime/DB proof after effective configuration loading | Yes: environment validator checks target policy, freshness, hashes, and required capabilities | Prerequisite/effect admission, pack, cleanup, final validator | Raw provider/metadata proof plus declared target policy | Environment name, ambient variable, remembered profile/resource, or stale proof |
| Product assertions | Native runner produces result under a versioned pack contract | Yes for identity/pack binding, raw-result hash, completeness, and contract version; not by reinterpreting semantics | Pack result then final advisory decision | Native assertion engine and verified authoritative product contract | Kernel, adapter, evidence validator, or LLM overriding a failing assertion |
| Failure classification | Deterministic classifier produces one primary class from verified contract and structured failure evidence | Yes: failure validator proves basis, permitted class, relevant identities, and absence/presence of required evidence | Final advisory evidence and operator diagnosis | Approved classification rules plus attributable evidence | LLM guess, most recent patch, generic exit code, or narrative alone |
| Cancellation | Kernel owns cancellation request; adapter owns local/remote termination action and terminal evidence | Yes: terminal-state validator proves the target process/job stopped before cleanup | Cleanup admission and final evidence | Bounded lifecycle and raw terminal proof | Local timeout alone, process exit assumption, or cleanup while remote work may continue |
| Cleanup and residue proof | Declared pack/adapter cleanup owner executes recovery; independent residue checker produces residue evidence | Yes: cleanup validator checks mutation boundary, termination, owned effects, and residue assertions | Final evidence and later retry admission | Verified cleanup actions plus independent residue proof | Successful function return, stale ID list, warnings-as-success, or missing counters |
| Evidence writing | Evidence writer persists identity-bound plan, events, results, failures, cleanup, and final record | Yes: evidence validator recomputes scope, identities, hashes, completeness, and decision | Advisory comparison; later admission only after cutover | Canonical source documents and immutable referenced bytes | Writer's self-declared scope or checksum without reconstruction |
| Advisory comparison | Comparison authority relates one advisory attempt to the exact authoritative legacy candidate/attempt | Yes: comparison validator checks both evidence chains and records disagreement basis | Design/promotion decision log; Bill review | Valid evidence from both systems and explicit matching identities | Changing either result, creating a product candidate, or authorizing release |
| Advisory final `GO`/`NO-GO` | Deterministic advisory decision function evaluates selected terminal results, blockers, identity validity, and cleanup completeness | Yes: final evidence validator reconstructs the decision | Comparison/promotion process only | Approved advisory decision rule | Release admission during migration or LLM waiver |
| Release admission and authoritative `GO`/`NO-GO` | Existing gate/admission remains producer during migration; future authority changes only after approved cutover | Yes under the current admission contract and later migration design | Deployment/release operator | Currently approved gate and explicit emergency governance | Advisory evidence, health check, partial evidence, or silent waiver |
| LLM recommendation | LLM may produce a non-authoritative recommendation with cited evidence | Not an authoritative producer; deterministic validators may verify cited artifacts separately | Human/design diagnosis only | None for execution or release decisions | Selecting, executing, classifying without deterministic basis, cleaning, validating, or admitting |

Independent validation is therefore required at every trust transition: candidate
definition, harness definition, plan acceptance/selection, environment and
prerequisite proof, command/event/result binding, failure classification,
termination, cleanup/residue, final evidence, advisory comparison, and release
admission. Native semantic assertions are not duplicated by the harness; their
identity, completeness, and evidence binding are independently validated.

## Evidence-Lineage Model

### Required Chain

1. **Product definition:** authoritative role manifests and exact component,
   dependency, and migration inputs produce a validated `productCandidateId`.
2. **Harness definition:** authoritative harness/pack manifests and exact
   qualification inputs produce a validated `harnessVersion` and available pack
   versions.
3. **Plan:** a canonical plan binds the candidate, harness, requested scope,
   target class, deterministic selection-policy version, selected
   `testPackVersions`, dependencies, prerequisites, and permitted effects. Its
   canonical digest is a lineage reference, not a sixth identity.
4. **Attempt:** the kernel allocates one `attemptId` and binds it permanently to
   the validated plan digest and five-identity tuple.
5. **Environment proof:** applicable adapters produce fresh raw proofs; validators
   establish `environmentIdentity` and capability records before dependent
   effects.
6. **Execution events:** every start, progress boundary, cancellation request,
   terminal state, and artifact handoff binds the plan digest, attempt,
   candidate, harness, environment proof, pack version, parent event, and
   attributable command/action digest where applicable.
7. **Check result:** each selected check/pack produces exactly one terminal or
   explicitly incomplete result binding its native output/evidence hashes,
   assertion contract, execution events, identities, failure reference, and
   cleanup requirement.
8. **Failure:** each failed check has exactly one primary classification record
   containing the verified contract, evidence basis, identities, failed phase,
   and next safe action. Insufficient basis remains `unclassified`.
9. **Cleanup:** every mutation-capable result links mutation-boundary evidence,
   proved termination, cleanup/recovery actions, and independent residue proof;
   unknown or incomplete residue remains explicit.
10. **Final evidence:** the final advisory record commits to the validated plan,
    identity tuple, complete selected set, event/result/failure/cleanup graph,
    blockers, completeness state, and deterministic decision.
11. **Validation and comparison:** an independent validator reconstructs scope
    and verifies every link before comparison. Advisory comparison relates the
    new attempt only to legacy evidence for the same product/target scope that
    can be proved, without rewriting either chain.

### Linkage Invariants

| ID | Required invariant |
| --- | --- |
| L01 | Every descendant record binds exactly one `attemptId` and the same accepted plan digest |
| L02 | Candidate and harness identities on every child exactly match the plan; no child may upgrade them |
| L03 | A pack event/result binds the exact selected pack ID/version; unselected or substituted packs are invalid |
| L04 | Every effect binds a fresh applicable environment proof that precedes it in the same attempt |
| L05 | Every artifact/log/native output is content-hashed and linked from its producing event/result |
| L06 | Event parentage and per-producer ordering are deterministic enough to detect missing, duplicate, late, or conflicting events; exact sequence fields remain Sprint `1D` |
| L07 | Every selected check has one terminal result or one explicit incomplete/cancelled/unavailable result; omission is never success |
| L08 | Every failed result links exactly one primary failure record; additional observations cannot compete as another primary class |
| L09 | Every mutation-capable check links cleanup applicability and residue state, including `not-started`, `clean`, `residue-found`, `cleanup-failed`, or `unknown` concepts; exact enum/schema is deferred |
| L10 | Cleanup cannot precede proved execution termination and cannot use a different environment identity without an explicit validated recovery relationship |
| L11 | Final `GO` requires complete valid identity, result, artifact, failure, and cleanup lineage for the accepted plan |
| L12 | An interrupted/incomplete attempt preserves the last trustworthy event, mutation state, cancellation/termination evidence, cleanup/residue state, and missing evidence; it can never be `GO` |
| L13 | Evidence hashes and identity references are immutable; correction creates a new artifact/attempt lineage rather than overwriting accepted bytes |
| L14 | Release admission records which exact evidence was consumed; revalidation or replay cannot present it as a different attempt or candidate |

### Completeness Requirements

| Evidence layer | Minimum conceptual completeness |
| --- | --- |
| Product/harness definition | All required role manifests, component/dependency/migration or harness/pack inputs, canonical digests, and independent validation result |
| Plan | Five applicable identities or selected pack-version map, requested scope/target, policy version, complete selected/dependency/prerequisite/effect declarations, and canonical digest |
| Attempt/events | Unique attempt binding, start evidence, every admitted action boundary, artifact hashes, cancellation/termination evidence where applicable, and explicit last known state |
| Check result | Selected ID/version, native contract and evidence, terminal/incomplete status, assertion outcome, failure link if failed, cleanup applicability, and exact identity tuple |
| Failure | One primary class, deterministic basis, contract/evidence references, failed phase/action, known effects, and next safe action |
| Cleanup | Mutation state, termination proof, owned effects, cleanup/recovery actions, independent residue result, and unresolved residue |
| Final evidence | Reconstructed selected set, every required child link, identity validation, completeness/blocker list, expiry/validity facts, and reproducible advisory decision |

### Conflict, Replay, and Stale-Evidence Handling

- Identical repeated delivery of the same content hash is idempotent evidence
  transport, not a new event or attempt.
- The same record identity with different bytes, the same `attemptId` with a
  different plan, or a child with a conflicting identity is corruption/conflict;
  both variants are preserved and the chain is rejected.
- A rerun always allocates a new `attemptId`. It may reference a prior attempt but
  cannot replace or complete it.
- Revalidating the same final evidence is a read-only validation replay. It does
  not refresh expiry, environment proof, candidate source, or admission rights.
- Evidence is stale when its declared validity has expired, current authoritative
  candidate/harness/pack inputs no longer match the required comparison, target
  proof is outside its approved freshness/capability window, or release/admission
  scope differs. Validators reject rather than rewrite it.
- Late remote results after cancellation are retained as conflicting/late
  evidence and cannot retroactively convert cleanup or final status. Detailed
  lifecycle treatment remains Sprint `1C`.

### Independent Scope Reconstruction

The evidence validator must obtain trusted candidate, harness, pack-registry,
selection-policy, requested change/operation, target-policy, and admission inputs
from their authorities. It then independently recomputes:

- the five identity bindings and plan digest;
- required component and pack scope;
- dependency expansion and prerequisites;
- expected check/result and cleanup obligations;
- artifact/log hashes and parent relationships;
- failure-class completeness;
- freshness and environment applicability; and
- the advisory final decision.

It must not use the final evidence's own `requiredChecks`, component list,
decision, or cleanup claim as the authority for what should exist. This directly
addresses the current validator's self-declared-scope weakness at audit
`:375-382,537-548` and `src/lib/releaseQualification.js:165-210`.

When evidence is incomplete, the retained chain must state what is present, what
is missing, the last proved execution and mutation states, whether termination
was proved, cleanup/residue status, the resulting blocker, and the next safe
action. If even that record cannot be finalized, the immutable partial events
remain authoritative evidence of an incomplete attempt. Retention location and
full JSON encodings remain Sprint `1D`.

## Repository and File-Ownership Model

### Evidence-Supported Options

| Option | Product-candidate fingerprint effect | Cross-repository versioning and dependency direction | Ownership clarity and migration safety | Rollback and maintenance burden | Assessment |
| --- | --- | --- | --- | --- | --- |
| O1: bounded admin-owned control plane; product-native tests remain in product repos; role manifests include any cross-repo harness assets | Requires role-filtered admin/product manifests, but cleanly excludes admin harness-only changes from candidate identity | One harness authority composes pack assets across repos; dependency direction is admin harness -> declared native runners, never product runtime -> harness | Reuses retained admin CLI/admission/provenance ownership and minimizes migration movement; explicit pack owners remain visible | Lowest new operational surface; rollback to current admin gate is direct; role-manifest discipline is essential | **Approved by Bill as the controlling ownership model** |
| O2: new dedicated harness repository; product-native tests remain in product repos | Strong physical product/harness separation, though product-role manifests are still required for cross-repo candidate composition | New repository/version/distribution must coordinate exact product pack bindings and existing admin admission | Clear central harness ownership but creates a new release, access, packaging, and migration boundary before the kernel is certified | Higher setup, CI, dependency, deployment-tool, and rollback burden; potentially cleaner long term | Credible material alternative; choose only if organizational isolation justifies added complexity |
| O3: put common harness utilities in the existing `shared` product-runtime repository | Changes to harness utilities risk changing a shipped shared-product candidate or require complex dual-role filtering | Admin and portal already consume shared runtime code, inviting product -> harness dependency or coupled release | Blurs runtime and qualification authority and repeats the identity-conflation problem in a central dependency | High coordination and candidate ambiguity | Rejected |
| O4: distribute kernel, schemas, adapters, validators, and packs among each product repo | Every harness change risks product-repo source churn unless all repos maintain precise role partitions | Duplicates common authority and encourages incompatible evidence/process implementations | Recreates the five ad hoc transport/polling families and cross-repo imports found in Phase 0 | Highest drift, rollback, and maintenance burden | Rejected |

O1 and O2 can both satisfy the identity and authority model. Their difference is
organizational and operational, not a safety loophole. The evidence favors O1
for the first advisory implementation because Phase 0 retained the admin CLI,
canonical hashing primitives, build/descriptor primitives, and deploy admission
while rejecting the current identity/orchestration internals (audit CP01,
CP05-CP06, CP08-CP11, and CP14-CP19 at `:1062-1077`). O1 achieves identity
separation through explicit roles without first creating a new repository and
distribution path. O2 remains reasonable if Bill values physical administrative
isolation enough to accept that additional programme scope.

### Recommended Allocation Under O1

No exact future path or Phase 2 file is selected here.

| Capability | Recommended owner | Identity and dependency rule |
| --- | --- | --- |
| Orchestration kernel and planner | Admin repository, in a bounded qualification-owned area | Harness role only; no PATH application imports; included in `harnessVersion`, excluded from product candidate |
| Evidence schema drafts and later definitions | Same admin qualification authority | Harness role; versioned independently; producer and validator must remain logically separate |
| Local/build/HTTP/browser/DB/AWS/remote adapters | Admin qualification authority | Harness role; depend on declared capability contracts, not product internals; exact interfaces remain `1E` |
| Domain test-pack manifests, fixtures, parsers, cleanup, and bindings | Admin qualification registry by default, with an explicit domain owner; cross-repo pack assets allowed only through role manifests | Pack role plus harness aggregate; never product role unless the same file is genuinely shipped runtime |
| Native product tests and product assertion engines | Owning product repository: admin, portal, shared, or later declared component | Test-pack/harness role when not shipped; product runtime must not import the harness control plane |
| Shared identity, canonicalization, and fingerprint utilities | Admin qualification authority, internally reusable but not placed in the existing product-runtime `shared` repo | One harness dependency direction; retained CP05 behavior may be reused after later proof |
| Product migration records | Owning product/schema repository | Migration content is product role and changes `productCandidateId`; harness migration checks/guards are harness role; applied ledger/schema is environment evidence |
| Evidence validator and advisory comparator | Admin qualification authority, separate logical modules from producers | Harness role; validator reconstructs authority and cannot share mutable producer state |
| Existing deploy-admission logic | Admin repository remains authoritative during migration | Current behavior remains outside advisory authority; future changes count in `harnessVersion` and require Sprint `1G` migration approval |
| Generated build/provenance artifacts | Produced by declared build/deploy authority, outside source-role manifests | Content hashes bind artifact to candidate/harness/attempt; generated bytes do not silently change source identities |
| Generated and retained qualification evidence | Generated outside product source/candidate inputs; logical owner is qualification evidence authority | Never included in product/harness source fingerprints; durable physical store/retention remains D08/Sprint `1D` |
| Intacct mock and currently unowned shared/portal checks | Ownership remains explicitly unresolved | Cannot become mandatory or be silently assigned until U02 is resolved with evidence |

### Bill Ownership Decision Record

Before Sprint `1C`, Bill was asked to choose the controlling repository model:

- **Approve O1 (recommended):** keep the future control plane, schemas, adapters,
  fingerprint utilities, validation, and pack registry in a bounded admin-owned
  qualification area; keep native product assertions in their owning repos; use
  explicit cross-repository role manifests so harness-only files never alter the
  product candidate.
- **Direct O2 instead:** establish a dedicated harness repository as the target
  owner, accepting a larger ownership/distribution/migration design before Phase
  2 scope can be approved.

O3 and O4 are rejected by the accepted evidence and should not be reopened
without new evidence. Bill subsequently approved O1 exactly as recommended; O1
is therefore the controlling ownership model and O2 is not selected.

## Sprint 1B Decision and Verification Record

| ID | Evidence / invariant | Chosen rule or recommendation | Rejected alternative | Tradeoff / unresolved point | Later verification required |
| --- | --- | --- | --- | --- | --- |
| 1B-D01 | Plan `:54-64`; M02-M03; audit `:750-768,867-876` | Use explicit role manifests and canonical composed digests; allow justified multi-role inputs | Whole-repository fingerprints as identity | Role maintenance adds governance but prevents conflation | Sprint `1D` schema examples; Phase 2 changed-file/role negatives |
| 1B-D02 | CP05-CP06 at audit `:1063-1066` | Represent the candidate as a sorted map of component product digests, dependency closures, and migration digests | Git head or concatenated tree hash alone | Requires definition version and component registry | Sprint `1D` encoding; Phase 2 reproducibility and reordered-component tests |
| 1B-D03 | Plan `:54-64`; M03 | Harness definition includes common machinery and exact pack registry; harness-only changes leave product ID unchanged | Release ID as candidate/harness identity | Aggregate changes frequently by design; that must not trigger redeploy | Phase 2 harness-only source-change certification |
| 1B-D04 | M02; audit `:750-768` | Allocate a new opaque `attemptId` for every execution/rerun and preserve prior chains | Reusing release ID, timestamp filename, or previous attempt | Requires durable uniqueness authority, exact store deferred | Sprint `1D` replay/conflict cases; Phase 2 uniqueness tests |
| 1B-D05 | M05/M15; audit `:340-360,411-421,517-528` | Environment identity is a fresh capability-aware non-secret proof after effective config loading | Environment name, source `.env`, instance role assumption, or remembered resource | Same stable facts may have repeated proof records; freshness policy open | Sprint `1D` fields/freshness; `1E` adapter proof contract |
| 1B-D06 | M16-M17; audit RN03-RN33 `:1092-1132` | Version each pack from contract, native binding, pack-owned inputs/effects/cleanup, and bind selected map to plan | One global test-suite version or implicit current files | Cross-repo pack assets require explicit owner and role | Sprint `1F` pack contract; no-loss coverage mapping |
| 1B-D07 | M09/M13; audit `:362-382,537-548` | Reject missing, stale, ambiguous, conflicting, substituted, or replay-corrupt identities; never rewrite lineage | Best-effort defaults or producer self-validation | Exact failure class and serialized failure fields deferred | `1C` classification/lifecycle; `1D` negative evidence cases |
| 1B-D08 | M01/M09; current validator source `src/lib/releaseQualification.js:165-210` | Require independent reconstruction at every trust transition | Validator trusting evidence's own required set/checksum | More validation work, but removes self-authorizing evidence | `1D` validation design; Phase 2 omitted-scope/tamper tests |
| 1B-D09 | M07-M10; audit `:366-382,585-590,828-835` | Bind candidate/harness/plan/attempt/environment/pack through events, results, failures, cleanup, and final evidence; incomplete attempts remain explicit | Flat logs, final-only JSON, or missing record on hang | More linked artifacts; retention policy still open | `1C` lifecycle; `1D` six schema drafts and partial-evidence cases |
| 1B-D10 | CP01/CP14-CP19 at audit `:1062,1072-1077`; M18 | Keep current admission authoritative and new comparison advisory | New evidence self-promoting because validator passes | Dual authority must be explicit until Sprint `1G` | `1G` migration/disagreement/rollback design |
| 1B-D11 | CP01/CP05 retained, CP06/CP08-CP11 replaced at audit `:1062-1069`; D02 | O1 bounded admin ownership with product-native assertions co-located and role-manifested; approved by Bill | O3 shared-runtime ownership; O4 distributed common authority; O2 not selected | Role-manifest discipline is required; exact future paths remain open | `1G` exact ownership/file scope and dependency audit |
| 1B-D12 | M20; audit `:752-757,944-968` | Keep generated/retained evidence outside all source identity inputs | Ignored local `tmp/` as sole durable authority or checked-in evidence affecting candidate | Physical store, access, privacy, and retention remain open | Sprint `1D` retention decision package |

Sprint `1B` introduced no new confirmed or suspected product/harness defect and
changed no Phase 0 severity or automatic-stop decision. Open technical facts U01-
U04 remain unresolved; repository ownership O1 versus O2 is the only current Bill
decision.

## Sprint 1B Files, Effects, and Verification

Examined:

- `docs/AGENTS.md`;
- the controlling plan's identity, authority, Phase 1, checkpoint, and ledger
  sections;
- the accepted Phase 0 audit's current identity/evidence, handoff, historical
  conflation, control-plane disposition, and synthesis sections;
- the Sprint `1A` charter, invariants, boundaries, decisions, Sprint `1B`
  proposal, and completion map; and
- read-only source for current canonical hashing, candidate collection, evidence
  writing/validation, immutable artifact records, deployment provenance, and
  deploy admission at `src/lib/releaseQualification.js:1-29,92-149,165-210`,
  `scripts/path-release-qualify.js:95-166,177-234,346-405`,
  `scripts/lib/releaseAdmission.js:1-139`, and
  `scripts/path-deploy.js:440-546,867-882,2038-2108`.

Changed only:

- this target-architecture document; and
- the controlling plan's checkpoint and Sprint Ledger.

Verification is read-only documentation consistency only: identity and
change-table coverage, authority-row completeness, lineage invariants,
decision-record traceability, ownership-option comparison, reserved-decision
wording, scope boundaries, formatting, and final worktree state. No executable or
environment verification is authorized.

No unexplained failure, blocker, or course correction occurred. One combined
read of several accepted baseline ranges exceeded the display budget; the
required identity and authority evidence was already available in the separately
bounded source reads and accepted audit. It caused no write or operational
effect.

Final worktree state: admin remains on `main...origin/main` with the pre-existing
modified `docs/AGENTS.md`,
`docs/ops/deployments/release-qualification-runbook.md`, and
`docs/planning/README.md`, plus the pre-existing untracked Phase 0 audit,
controlling plan, and target-architecture files. Sprint `1B` changed only the
target-architecture and controlling-plan files. Portal and shared remain clean
on `main...origin/main`. Intacct mock remains the non-Git directory established
in Phase 0 and was not re-probed. No pre-existing user change was reverted or
overwritten.

## Sprint 1B Completion Decision

Sprint `1B` is complete at the documentation-architecture level. The identity,
authority, lineage, and ownership option models are defined without designing
the Sprint `1C` lifecycle, Sprint `1D` schemas, Sprint `1E` interfaces, Sprint
`1F` selection/certification policy, or any implementation.

Before Sprint `1C`, Bill must first decide the controlling repository model. The
exact recommended decision and approval is: **Bill approves ownership option O1,
the bounded admin-owned qualification control plane with native product tests in
their owning repositories and explicit cross-repository role manifests, and
explicitly authorizes Sprint `1C` of Phase 1 to design only the minimal kernel and
lifecycle model under a documentation-only, no-implementation, and
no-environment-access scope.**

If Bill selects O2 instead, the next prompt must say so explicitly and authorize
only the corresponding ownership update before or as part of a newly bounded
Sprint `1C`. Sprint `1C` has not begun.

Bill subsequently approved O1 exactly as recommended and separately authorized
Sprint `1C`. O2 is not selected. The result of Sprint `1C` follows.

## Sprint 1C Outcome

Sprint `1C` defines the smallest domain-neutral kernel and its complete
deterministic lifecycle from invocation through independently validated advisory
evidence. It resolves the conceptual execution-order, prerequisite/effect,
process-control, cancellation, failure, cleanup, and finalization decisions while
leaving serialized evidence fields to Sprint `1D`, adapter mechanisms to Sprint
`1E`, selection policy to Sprint `1F`, and migration/cutover to Sprint `1G`.

The approved O1 ownership model remains unchanged: the kernel belongs to the
bounded admin-owned qualification control plane; native assertions remain with
their product owners; cross-repository role manifests define identity; and
product runtime must not import harness code. No Sprint `1C` decision conflicts
with the accepted strategy, identity, authority, lineage, or ownership model.

## Minimal Deterministic Orchestration Kernel

### Responsibilities Owned by the Kernel

| Responsibility | Minimal deterministic ownership | Required handoff or evidence |
| --- | --- | --- |
| Invocation admission | Accept an explicit invocation request and record its source, requested target/scope, cancellation channel, and plan reference | Invocation receipt or pre-attempt rejection evidence |
| Plan loading and acceptance | Load one immutable plan candidate, require supported definition/version, and submit it to independent validation | Canonical plan bytes/digest and validator result |
| Identity/version binding | Bind the validated `productCandidateId`, `harnessVersion`, selected `testPackVersions`, requested target, and later one new `attemptId` | Identity-manifest and validation references established in Sprint `1B` |
| Deterministic selection | Apply the externally approved selection policy to authoritative inputs and record every inclusion reason | Selected check/pack instances and policy/input digests; policy content remains Sprint `1F` |
| Dependency validation and ordering | Reject unknown nodes/cycles and produce one stable topological total order for the minimal kernel | Ordered graph, dependency reasons, and blocked-node relationships |
| Prerequisite admission | Evaluate declared static and runtime prerequisites, require applicable environment/capability proof, and issue no effect admission until all applicable prerequisites pass | Per-prerequisite result and effect-admission decision |
| Bounded dispatch | Dispatch one admitted check at a time through its declared adapter with exact command, working-directory, environment, timeout, effect, and cleanup declarations | Dispatch/start/terminal events and adapter identity |
| Event collection | Append identity-bound lifecycle, output, artifact, cancellation, termination, cleanup, and residue events | Ordered immutable event references; exact schema remains Sprint `1D` |
| Timeout and cancellation coordination | Monitor all declared deadlines, accept user/system cancellation, request graceful shutdown, require forced process-tree termination when needed, and prove termination | Cancellation cause, request, grace/force actions, terminal proof, or termination failure |
| Result/failure/cleanup collection | Collect native result, structured failure basis, cleanup state, and independent residue proof without changing their domain meaning | Versioned pack/native/adapter references and hashes |
| Deterministic final assembly | Assemble the final advisory evidence as a pure function of the accepted plan and immutable collected records | Final evidence or explicit partial/finalization-failure evidence |
| Independent validation handoff | Submit final evidence and authoritative reconstruction inputs to the independent validator | Validation accepted/rejected record and later advisory availability |

The minimal Phase 2 kernel executes the validated topological order serially.
Serial execution is a deliberate complexity limit, not a permanent ban on
parallelism. Later concurrency would require a separate architecture decision,
resource/effect conflict proof, and certification without changing evidence
semantics. It is not part of Phase 2.

### Responsibilities Explicitly Excluded

The kernel must not:

- know or reinterpret product workflows, business rules, roles, statuses,
  database relationships, UI meaning, or expected product values;
- decide native domain assertions or turn a failing assertion into a pass;
- define fixture meaning, choose environment-owned fixture relationships, or
  invent cleanup identifiers;
- implement SQL, AWS, browser, HTTP, build, database, object-store, identity, or
  remote-transport behavior;
- load undeclared ambient environment or discover capabilities outside an
  adapter/environment-proof boundary;
- define the detailed mandatory-core, impacted-domain, requested-suite, or
  scheduled-regression policy;
- own adapter- or pack-specific retry, fallback, recovery, or compatibility
  behavior;
- produce authoritative release admission or displace the current gate during
  advisory migration;
- accept an LLM recommendation as a plan, assertion, classification, cleanup,
  validation, or release decision;
- silently retry, patch, substitute a pack/adapter/version, broaden effects, or
  update identities inside an attempt; or
- retain secrets in commands, events, logs, results, or final evidence.

These exclusions preserve M01, M03, M11, M16, M18, and P01 at this document
`:141-175` and the Phase 0 distinction between trustworthy native assertions and
defective shared execution at audit `:1027-1055,1092-1132`.

## Deterministic Lifecycle State Machine

### State-Machine Rules

The lifecycle is hierarchical: invocation/plan, attempt, check, cleanup/residue,
and evidence-validation scopes have separate states linked by the same accepted
plan and attempt lineage. State names below are conceptual, not Sprint `1D`
schema enums.

Every accepted transition requires the exact current state, one permitted next
state, the bound identities, responsible authority, predecessor evidence, and a
new immutable transition record. An exact duplicate record with the same content
hash is idempotent transport and causes no second transition. Missing,
conflicting, repeated-with-different-bytes, or out-of-order transitions fail
closed, preserve the conflicting evidence, and prevent final `GO`.

Before an attempt opens, invalid input produces terminal pre-attempt rejection
evidence and no effects. After an attempt opens, every failure path converges on
bounded termination where applicable, cleanup/residue handling where applicable,
final evidence assembly, and independent validation. A failure to assemble final
evidence does not erase the immutable partial event chain.

### Invocation and Plan States

| Transition | Required inputs and evidence | Authority | Permitted effects | Prohibited transition/effect | Failure behavior and required partial evidence |
| --- | --- | --- | --- | --- | --- |
| `INVOCATION_RECEIVED` -> `PLAN_LOADED` | Invocation source, requested mode/target/scope, plan reference/bytes, receipt time, cancellation channel | Kernel invocation boundary | Read declared plan bytes only | No identity inference, selection, command, environment access, or attempt allocation | Missing/unreadable/oversized input -> `REJECTED_BEFORE_ATTEMPT`; record invocation facts and load error |
| `PLAN_LOADED` -> `IDENTITIES_BOUND` | Canonical plan digest plus candidate, harness, pack, role-manifest, and requested-target references | Identity/fingerprint services produce; kernel binds only validated references | Read identity manifests/source facts through declared services | No release-label substitution, stale identity reuse, or plan mutation | Missing/ambiguous/conflicting identity -> rejection; record manifest/reference conflict |
| `IDENTITIES_BOUND` -> `PLAN_VALIDATED` | Bound identity tuple, plan definition version, declared checks/packs, prerequisites, effects, cleanup owners, and target | Independent plan validator | Deterministic validation only | No self-validation from the plan's own required set; no adapter dispatch | Invalid definition, identity mismatch, undeclared effect/cleanup, or stale input -> rejection with every validator error |
| `PLAN_VALIDATED` -> `SELECTION_RESOLVED` | Authoritative change/operation/request/schedule inputs, policy version, pack registry | Deterministic selector; kernel records output | Pure selection only | No history-based, LLM, runner, or operator ad hoc inclusion/omission | Unknown/unmapped input or selector conflict -> rejection; record input and missing authority |
| `SELECTION_RESOLVED` -> `DEPENDENCIES_ORDERED` | Complete selected set, dependency graph, prerequisite/effect metadata | Kernel graph validator/orderer | Pure graph validation and stable topological ordering | No unknown ID, missing dependency, cycle, or nondeterministic tie | Unknown/cycle/duplicate/conflict -> rejection with complete offending graph evidence |
| `DEPENDENCIES_ORDERED` -> `ATTEMPT_OPENED` | Accepted immutable plan digest, stable order, five applicable identities, total-attempt budgets, event-store readiness | Kernel allocates one new `attemptId` | Open event stream/evidence workspace only | No command, environment, product, or fixture effect before attempt-open record is durable | Event store unavailable or ID conflict -> rejection; record allocation/storage failure without executing |
| Any valid pre-attempt state -> `REJECTED_BEFORE_ATTEMPT` | Deterministic validation/load/selection/order failure | Owning validator/kernel boundary | Emit rejection evidence only | Cannot open an attempt, retry implicitly, or report advisory `GO` | Preserve last valid state, input digests, errors, and next safe action |

`REJECTED_BEFORE_ATTEMPT` is terminal for that invocation. Corrected input or a
retry is a new invocation; if it reaches execution, it receives a new
`attemptId`.

### Attempt and Prerequisite States

| Transition | Required inputs and evidence | Authority | Permitted effects | Prohibited transition/effect | Failure behavior and required partial evidence |
| --- | --- | --- | --- | --- | --- |
| `ATTEMPT_OPENED` -> `PREREQUISITES_EVALUATING` | Durable attempt-open event, ordered check graph, declared prerequisite/effect/cleanup plan | Kernel coordinator | Metadata/evidence-only prerequisite dispatch through declared adapters | No stateful effect or product command | Internal evaluation error -> attempt blocker; record unevaluated prerequisites |
| `PREREQUISITES_EVALUATING` -> `ENVIRONMENT_PROVING` | Applicable target/capability requirements for the next admitted check | Environment/capability adapter produces raw proof; kernel coordinates | Declared identity/metadata-only proof actions | No ordinary DB read, fixture, object, identity, browser workflow, or mutation | Missing adapter/proof path -> prerequisite failure with no dependent effect |
| `ENVIRONMENT_PROVING` -> `PREREQUISITES_PASSED` | Fresh environment proof, independent validation, static prerequisites, cleanup readiness, and effect declarations all passed | Independent prerequisite/environment validators; kernel records aggregate | Admission token/reference for exactly the declared check/effects | No partial pass, target-name inference, or broad reusable authority beyond proof scope | Any failed/stale/conflicting proof -> `PREREQUISITE_FAILED`; retain raw proof and validation basis |
| `PREREQUISITES_EVALUATING` -> `PREREQUISITES_PASSED` | Check requires no environment capability and all static prerequisites/cleanup declarations pass | Kernel using independent static validator results | Mark check ready only | Cannot treat missing environment declaration as no requirement | Ambiguity -> prerequisite failure, not read-only default |
| Evaluation/proof -> `PREREQUISITE_FAILED` | At least one deterministic failed, missing, stale, or invalid prerequisite | Kernel records validator result; classifier later owns primary class | Block affected check/dependants; continue only independently selected declared read-only diagnostics | No affected check dispatch, no new stateful check anywhere after a failure, no cleanup SQL for a pre-mutation schema failure | Record failed prerequisite, affected closure, blocked checks, zero/known prior effects, and next safe action |
| All ordered nodes terminal/blocked -> `ATTEMPT_FINALIZING` | Each selected node has terminal or explicit blocked/incomplete status and all required cleanup/residue paths are terminal | Kernel finalization coordinator | Evidence assembly only | No new check, prerequisite, effect, cleanup, or retry | Missing terminal state becomes incomplete blocker; preserve last trustworthy records |

Prerequisites are evaluated per ordered check so their freshness and capability
scope remain applicable. The first failed check or prerequisite prevents all new
stateful dispatch for the rest of the attempt. Independent checks may continue
only when they are declared read-only, have no dependency on the failed node or
invalidated capability, and their prerequisites still pass. This is the
effect-aware alternative to both unsafe full aggregation and opaque global
fail-fast; it resolves P04 and the runbook conflict recorded at audit
`:458-469,1309-1313`.

### Check Execution States

| Transition | Required inputs and evidence | Authority | Permitted effects | Prohibited transition/effect | Failure behavior and required partial evidence |
| --- | --- | --- | --- | --- | --- |
| `CHECK_PENDING` -> `CHECK_READY` | Dependencies passed, prerequisites passed, environment proof applicable, command/effects admitted, cleanup/recovery definition validated | Kernel admission | None; readiness record only | Cannot skip a dependency, prerequisite, cleanup obligation, or identity check | Failure routes to blocked/prerequisite-failed evidence |
| `CHECK_PENDING` -> `CHECK_BLOCKED` | Failed dependency, failed prerequisite, prior failure blocks stateful work, cancellation, or total-attempt budget prevents safe start | Kernel | Evidence only | Blocked check cannot dispatch or be reported passed | Record blocking cause, dependency path, effects not started, and cleanup unnecessary |
| `CHECK_READY` -> `CHECK_DISPATCHED` | Exact declared adapter/version, command, cwd, environment allowlist, timeouts, output/result contract, effect admission, and cleanup owner | Kernel dispatches; adapter accepts | Adapter startup only within admitted declaration | No shell/command substitution, undeclared env/cwd/effect, version substitution, or second dispatch | Dispatch rejection/error -> `CHECK_FAILED`; record whether a process ever started |
| `CHECK_DISPATCHED` -> `CHECK_RUNNING` | Adapter process/job identity, startup evidence, ready/running signal before startup timeout | Adapter produces; kernel observes | Declared command/effects may begin only after admission | No effect before running/mutation boundary event; no untracked child | Startup timeout/error -> `CHECK_TIMED_OUT` or `CHECK_FAILED`; retain process identity and output |
| `CHECK_RUNNING` -> `CHECK_COMPLETED` | Process/job terminal success, valid complete native result, output/artifact hashes, and mutation-state evidence | Adapter/native runner produces; kernel collects | No new effect after terminal event | Exit zero without required result cannot complete; late output cannot change status | Missing/corrupt/stale result -> `CHECK_FAILED`; preserve raw terminal/output evidence |
| `CHECK_RUNNING` -> `CHECK_FAILED` | Nonzero exit, valid native failed assertion, invalid result, adapter error, fingerprint drift, or other deterministic failure | Native/adapter evidence; classifier supplies class later | Begin cancellation if still live; then cleanup path | Kernel cannot reinterpret product failure or choose another runner | Record raw cause, contract reference, exit/signal, mutation state, and required cleanup |
| `CHECK_DISPATCHED` or `CHECK_RUNNING` -> `CHECK_TIMED_OUT` | Startup/execution/idle/total deadline event with measured elapsed/last activity | Kernel deadline authority | Issue cancellation request only | Timeout is not termination and cannot enter cleanup directly | Record deadline kind/budget/elapsed/process identity/last event; transition to cancellation |
| `CHECK_DISPATCHED` or `CHECK_RUNNING` -> `CHECK_CANCELLING` | User cancellation, prerequisite invalidation, fingerprint drift, attempt deadline, or timeout | Kernel owns idempotent request; adapter acts | Graceful shutdown then forced process-tree termination within declared bounds | No new command/effect, result substitution, cleanup, or retry | Record cause, requester, target process/job, grace and force deadlines |
| `CHECK_TIMED_OUT` -> `CHECK_CANCELLING` | Timeout record and live/unknown process state | Kernel | Same bounded cancellation sequence | Cannot label timeout as cancelled without terminal proof | Preserve timeout and cancellation linkage |
| `CHECK_CANCELLING` -> `CHECK_CANCELLED` | Raw proof that local/remote process tree/job is terminal plus terminal output boundary | Adapter produces; terminal validator confirms | Cleanup admission may follow | No late result may convert cancelled to completed; no process left unaccounted | Record graceful/forced path, terminal status, mutation state, and late-output marker |
| `CHECK_CANCELLING` -> `TERMINATION_FAILED` | Graceful and forced bounds exhausted or process/job state remains unknown/live | Adapter and terminal validator | Evidence/observation only until supervisory hard bound | No cleanup that could overlap the live work, no new checks/effects, no rerun | Record every termination attempt, last known process state, mutation state, residue `unknown`, and mandatory stop |
| Any terminal check state -> cleanup/residue lifecycle | Terminal/termination evidence plus predeclared cleanup applicability and mutation state | Kernel coordinates declared owner | Only declared cleanup after proved termination | No implicit retry or new product assertion | Missing applicability/mutation evidence makes cleanup/residue incomplete |

`CHECK_FAILED` and `CHECK_COMPLETED` describe execution/native-result outcomes, not
final release authority. A completed state can still require cleanup and residue
proof before the attempt is valid.

### Cleanup and Residue States

| Transition | Required inputs and evidence | Authority | Permitted effects | Prohibited transition/effect | Failure behavior and required partial evidence |
| --- | --- | --- | --- | --- | --- |
| Terminal check -> `CLEANUP_UNNECESSARY` | Declared read-only/no-fixture effect and proof that mutation never began | Kernel validates declaration against events | Evidence only | Cannot infer unnecessary from missing mutation event or runner claim | Ambiguity -> cleanup required/unknown, never clean |
| Terminal check -> `CLEANUP_REQUIRED` | Mutation began/may have begun, fixture/effect declaration requires cleanup, or recovery contract says required | Kernel applies predeclared obligation | Admit only owning cleanup adapter/pack after termination proof | No cleanup before termination; no ad hoc SQL/object/identity action | Missing owner/definition -> `CLEANUP_FAILED` with residue unknown |
| `CLEANUP_REQUIRED` -> `CLEANUP_RUNNING` | Proved execution termination, exact environment/recovery identity, cleanup owner/version, effect inventory/re-resolution contract, cleanup timeout | Owning adapter/pack executes; kernel coordinates | Only declared recovery effects | Cannot use stale relationship inventory, broaden effect set, or switch target silently | Dispatch/start failure -> cleanup failed; retain mutation/effect inventory |
| `CLEANUP_RUNNING` -> `CLEANUP_SUCCEEDED` | Cleanup owner terminal success and complete action evidence | Adapter/pack produces; cleanup validator checks completeness | Begin independent residue proof | Successful return is not zero residue | Missing/corrupt cleanup result -> cleanup failed |
| `CLEANUP_RUNNING` -> `CLEANUP_FAILED` | Nonzero/error/timeout/cancellation/identity drift/incomplete action | Adapter/pack evidence | Attempt safe residue proof if it cannot cause ordinary undeclared effects | No warning downgrade, silent continuation, or second cleanup attempt | Record actions completed/unknown, remaining effects, termination, and recovery next action |
| `CLEANUP_RUNNING` -> `CLEANUP_INTERRUPTED` | User/system interruption or total cleanup deadline | Kernel cancellation plus cleanup adapter termination | Bounded termination and evidence only | No implicit cleanup restart or clean claim | Preserve cleanup process state, completed actions, remaining/unknown effects |
| `CLEANUP_SUCCEEDED` or `CLEANUP_FAILED` -> `RESIDUE_PROVING` | Proved cleanup termination, independent residue verifier, exact environment/fixture relationship proof | Independent residue verifier | Declared read-only/metadata residue proof only | Cleanup implementation cannot be sole verifier; no mutation disguised as proof | Missing verifier/proof -> residue proof failed/unknown |
| `RESIDUE_PROVING` -> `RESIDUE_PROOF_COMPLETED` | Complete independently verified zero-residue or explicit residue-found result | Residue verifier produces; kernel collects | Evidence only | Residue found cannot be normalized to cleanup success | Record counters/resources/proof hashes and clean or residue-found conclusion |
| `RESIDUE_PROVING` -> `RESIDUE_PROOF_FAILED` | Verifier error, timeout, invalid identity/schema/capability, missing/corrupt result, or interruption | Residue verifier/validator | Evidence only | No zero-residue inference or retry in same attempt | Record why residue is unknown, known remaining effects, and next safe action |
| `CLEANUP_UNNECESSARY` -> `RESIDUE_UNNECESSARY` | Read-only/no-mutation proof validated | Kernel | Evidence only | Cannot be used for mutation-capable packs | Bind proof that no effect requiring residue validation began |
| Terminal cleanup/residue state -> `ATTEMPT_FINALIZING` | Every check has cleanup applicability and terminal residue status | Kernel | Evidence assembly only | No new cleanup attempt or effect | Unknown/failed residue becomes blocker and prevents `GO` |

If termination itself fails, mutation cleanup does not run because it could race
the live work. Residue remains `unknown`; final evidence records the mandatory
stop. A later recovery operation is separately authorized work, not an implicit
retry within the attempt.

### Finalization, Validation, and Advisory States

| Transition | Required inputs and evidence | Authority | Permitted effects | Prohibited transition/effect | Failure behavior and required partial evidence |
| --- | --- | --- | --- | --- | --- |
| `ATTEMPT_FINALIZING` -> `FINAL_EVIDENCE_EMITTED` | Accepted plan, full immutable event graph, terminal/blocked results, one failure class per failed check, cleanup/residue states, identity validation, and deterministic blocker calculation | Kernel evidence assembler | Write canonical final evidence only | No new timestamps/facts not already evidenced, no omitted selected check, no repair/retry | Assembly validation error -> finalization failure; partial chain remains |
| `ATTEMPT_FINALIZING` -> `FINALIZATION_INTERRUPTED` | Writer/storage interruption or assembly cannot complete within finalization/attempt bound | Kernel/supervisory evidence boundary | Persist partial/failure marker only | Cannot report advisory result or rerun commands | Preserve plan/attempt, last event, missing records, storage error, and recovery-safe action |
| `FINAL_EVIDENCE_EMITTED` -> `INDEPENDENT_VALIDATION_RUNNING` | Immutable final evidence and authoritative reconstruction inputs | Independent evidence validator | Read-only reconstruction/validation | Kernel cannot validate its own decision into authority | Validator unavailable/timeout -> validation rejected/incomplete, never accepted by default |
| `INDEPENDENT_VALIDATION_RUNNING` -> `VALIDATION_ACCEPTED` | All schemas/identities/scope/hashes/transitions/results/failures/cleanup/decision reconstruct correctly | Independent validator | Emit signed/hashed validation result | Cannot alter producer evidence | Record reconstructed facts and validator identity/version |
| `INDEPENDENT_VALIDATION_RUNNING` -> `VALIDATION_REJECTED` | Any missing, stale, corrupt, conflicting, out-of-order, incomplete, or decision-mismatched evidence | Independent validator | Emit rejection evidence only | No waiver, repair, evidence rewrite, or partial acceptance | Preserve every validation error and affected lineage |
| `VALIDATION_ACCEPTED` -> `ADVISORY_RESULT_AVAILABLE` | Accepted validation plus reconstructed advisory decision | Advisory result boundary | Publish advisory result for comparison only | No release admission or legacy gate mutation | If publication fails, retain accepted validation; no release authority |
| `VALIDATION_REJECTED` -> `ADVISORY_RESULT_AVAILABLE` | Rejection record | Advisory result boundary | Publish `validation-rejected`/non-`GO` advisory outcome | Cannot expose producer's unvalidated `GO` as trusted | Retain rejection and next safe action; exact result encoding remains `1D` |

Final evidence assembly is deterministic and idempotent for the same immutable
attempt inputs. Reassembling evidence after a finalization-only interruption may
reuse the same `attemptId` because no execution, cleanup, or environment action
is retried; it must produce the same bytes/digest from the same records. Any
execution or cleanup retry creates a new `attemptId`.

## Prerequisite and Effect Gating

### Declared Capability Model

The kernel treats effect and capability identifiers as validated opaque tokens;
Sprint `1E` defines their adapter-specific contracts. Each selected check must
arrive with:

- required static prerequisites and dependency nodes;
- required environment/capability proofs and their freshness scope;
- a complete effect set whose registry metadata distinguishes read-only from
  stateful behavior;
- the exact adapter and pack versions permitted to request those effects;
- whether mutation can begin and the event that proves it;
- cleanup owner, cleanup/recovery requirement, residue verifier, and budgets
  known before dispatch; and
- declared shared resources or exclusivity requirements, even though the minimal
  kernel executes serially.

The kernel admits an adapter action only when its requested effect tokens are a
subset of the plan's validated declaration, all prerequisites/capabilities pass,
the identity tuple matches, and cleanup obligations are valid. An adapter/pack
request for an undeclared or more-stateful effect is rejected before action and
recorded as a harness/contract failure subject to the deterministic classifier.

### Gating Rules

1. **Static validation first.** Unknown effect, missing capability, missing
   cleanup owner, invalid dependency, or ambiguous read-only/stateful status
   rejects the plan or prerequisite before dispatch.
2. **Fresh proof before use.** Environment proof is obtained after the adapter's
   effective configuration load and immediately before its admitted scope; stale
   proof never inherits authority from another check or attempt.
3. **All applicable prerequisites pass.** There is no partial admission. A failed
   prerequisite blocks the check and its dependency closure.
4. **No new stateful work after failure.** Once any check fails, times out, is
   cancelled, or becomes unclassified, the kernel starts no further stateful
   check. Only independent declared read-only diagnostics may continue.
5. **Read-only is immutable.** A read-only declaration is an upper bound on
   effects. A runtime request for filesystem, process, build, HTTP server,
   browser mutation, DB ordinary/mutating access, AWS/object/identity mutation,
   or other stateful capability not declared is denied.
6. **Cleanup readiness precedes mutation.** A stateful check cannot dispatch
   until its cleanup owner/recovery rule, mutation boundary, termination
   requirement, residue verifier, and cleanup budget validate.
7. **Effects stay scoped.** Admission is per check, attempt, environment proof,
   adapter/pack version, and declared effect set; it cannot be transferred or
   broadened.
8. **Pre-mutation schema failure closes without cleanup effects.** Database
   metadata failure authorizes only recorded failure/connection close, never
   ordinary cleanup SQL (`docs/AGENTS.md:5-22`).
9. **Termination before recovery.** Cleanup, residue proof that assumes quiescence,
   and rerun require proved local/remote termination.
10. **Everything is evidenced.** Admission, denial, mutation start, cancellation,
    termination, cleanup, and residue states are immutable transition records.

## Deterministic Selection and Ordering Boundary

Sprint `1F` will decide the selection policy. Sprint `1C` fixes only the kernel
boundary that applies a versioned policy deterministically.

### Selection Inputs

- validated `productCandidateId` and role-manifested changed inputs;
- requested operations and target/stage class;
- approved policy and pack-registry versions bound to `harnessVersion`;
- mandatory-core declarations;
- impacted-domain rules and dependency graph;
- explicitly requested suites;
- authenticated scheduled-full-regression trigger, when present;
- available validated pack versions and adapter/capability requirements; and
- explicit full-run override, never an inferred default for unknown scope.

### Selection Outputs

- the exact selected check/pack instance set and version map;
- one or more attributable inclusion reasons for each selection: mandatory core,
  impacted domain, dependency, explicit request, or scheduled/full regression;
- declared prerequisites, effects, cleanup/residue obligations, and target
  capabilities for each instance;
- the complete dependency graph and stable serial topological order;
- any deliberate omissions with the policy rule that permits them; and
- selection-input and output digests for independent plan validation.

The kernel rejects unknown/unmapped changed inputs or operations, unknown check
or pack IDs, absent versions, missing dependencies, duplicate conflicting
definitions, and dependency cycles. It never turns unknown scope into
documentation-only, full run, or no checks by guess. Stable ordering uses the
approved dependency graph and a deterministic ID tie-breaker; exact policy and
mandatory-core membership remain Sprint `1F`.

## Bounded Process-Control Model

### Command Declaration and Admission

Every dispatched unit conceptually declares:

- check/pack, adapter, and native-runner identity/version;
- executable/tool identity and structured argument vector;
- logical working-directory authority and allowed filesystem roots;
- explicit environment allowlist, fixed values, and non-secret credential
  references; undeclared ambient inheritance is prohibited;
- expected startup/running signal, native result, exit semantics, output and
  artifact boundaries;
- prerequisite/capability proofs and admitted effect tokens;
- startup, execution, idle, cancellation, cleanup, finalization, and total-attempt
  budgets applicable to the unit; and
- cleanup owner, mutation boundary, residue verifier, and termination method.

The kernel validates this declaration against the accepted plan. It does not
accept an unparsed shell command as authority, interpolate operator/LLM text into
commands, allow an arbitrary cwd, or silently inherit the parent process
environment. Platform-specific command construction remains an adapter contract
for Sprint `1E`; evidence must retain the resolved executable/arguments and
redacted environment declaration.

### Timeout Model

| Timeout | Starts | Ends | Required response on expiry |
| --- | --- | --- | --- |
| Startup | Dispatch accepted | Running/ready proof | Mark startup timeout; begin cancellation/termination |
| Execution | Running proof | Valid terminal process/job and result boundary | Mark execution timeout; begin cancellation/termination |
| Idle | Last declared output/event/heartbeat | Next valid activity or terminal state | Mark idle timeout; begin cancellation; ordinary silence is not liveness |
| Graceful shutdown | Cancellation delivered | Proved graceful terminal state | Escalate to forced process-tree/job termination |
| Forced termination | Force action begins | Proved terminal tree/job state | Enter `TERMINATION_FAILED` if proof is absent at expiry |
| Cleanup | Cleanup dispatch | Cleanup process terminal and result complete | Cancel/terminate cleanup; mark cleanup failed/interrupted and residue unknown until independently proved |
| Finalization | Final assembly begins | Immutable final evidence persisted | Preserve partial chain and finalization interruption; no advisory trusted result |
| Total attempt | `ATTEMPT_OPENED` | Final evidence and validation handoff complete | Cancel active execution early enough to preserve declared termination, cleanup, residue, and finalization reserves |

Numeric defaults and per-adapter/pack overrides remain Sprint `1E` and `1F`
decisions. The invariant is that the total budget cannot be consumed entirely by
execution: validated nonzero termination, cleanup/residue, and finalization
reserves must remain before a stateful check starts.

### Cancellation and Termination

- Cancellation sources are explicit user request, startup/execution/idle/total
  timeout, prerequisite or identity invalidation, fingerprint drift, kernel
  shutdown, or earlier failure preventing safe continuation.
- A cancellation request is idempotent and records cause, requester, target,
  deadline, and last proved state. It is not a terminal state.
- The adapter first requests declared graceful shutdown, then uses its declared
  forced whole-process-tree or remote-job termination mechanism.
- Cleanup begins only after independent terminal proof. A parent-process exit is
  insufficient when descendants or a remote job may remain.
- Late output/results are retained with their arrival time and marked late. They
  cannot replace the already terminal/cancelled result or change cleanup state.
- If forced termination or remote cancellation cannot be proved, the attempt
  enters `TERMINATION_FAILED`, performs no potentially racing cleanup, records
  residue as unknown, stops new work, and finalizes as non-`GO`/incomplete.
- There is no implicit retry. Any new command execution or cleanup attempt uses a
  new `attemptId`; a finalization-only deterministic reassembly is not execution
  retry.

### Output, Logs, and Results

- `stdout` and `stderr` remain separately attributable and ordered relative to
  their own streams; they are never flattened into an authoritative string.
- Output and artifacts are streamed or chunked to the declared evidence boundary
  so process memory limits do not become silent result limits. Exact storage is
  Sprint `1D`.
- Every limit records configured bytes, captured bytes, the boundary crossed,
  truncation/overflow cause, and hashes for retained bytes/artifacts.
- Exceeding a declared log/result limit is a deterministic failure and triggers
  cancellation when the producer is still live. Truncated diagnostic or result
  evidence can never support `GO` in the minimal kernel.
- Missing expected result, malformed/corrupt bytes, digest mismatch, wrong
  identity/version, duplicate conflicting result, stale result, or result after
  the accepted terminal boundary is rejected and fully recorded.
- An exact duplicate with identical identity and content hash is idempotent
  delivery. It does not create another result or transition.
- Exit zero without the declared complete native result is not success. Nonzero
  exit is not by itself a product classification; the classifier uses the
  verified contract and evidence.

## Failure and Cleanup Coordination

The kernel coordinates but does not supply domain meaning:

1. Native runner, adapter, prerequisite validator, process controller, cleanup
   owner, or evidence validator supplies structured primary-cause candidates and
   supporting evidence.
2. The deterministic classifier applies the approved class rules to the verified
   contract and evidence and returns exactly one of `product`, `harness`,
   `environment`, `infrastructure`, or `unclassified`.
3. The kernel records that class, contract reference, failed phase/action,
   identity tuple, evidence links, known effects, and next safe action. It cannot
   override or guess the class.
4. Insufficient or conflicting basis produces `unclassified`, stops all new work
   except required termination/cleanup and eligible independent read-only
   diagnostics, and cannot be patched/retried in the attempt.
5. Cleanup necessity comes from the accepted pre-dispatch declaration plus
   mutation-state evidence, not the failure class or exit code.
6. The owning adapter/pack performs cleanup only after termination proof and
   under the bound environment/recovery identity.
7. A logically independent verifier establishes zero residue or explicit
   residue/unknown status. Cleanup success alone is insufficient.
8. Cleanup failure, interruption, residue found, or residue proof failure remains
   a final blocker even if the product assertion passed.
9. Execution interruption follows cancellation/termination and then required
   cleanup. Cleanup interruption records incomplete cleanup and residue unknown.
   Finalization interruption preserves the event chain for deterministic
   evidence-only reassembly.
10. Final evidence always distinguishes execution outcome, primary failure,
    termination, cleanup, residue, completeness, validation, and advisory status.

This addresses the central no-timeout/no-final-evidence gap at audit `:384-393`,
the failed-prerequisite continuation finding at `:458-469`, the unbounded
execution finding at `:470-485`, and the historical cleanup/process cluster at
`:849-865,919-921`.

## Kernel Conceptual Interface Boundaries

These are responsibility and information boundaries, not finalized APIs or JSON
schemas.

| Boundary | Kernel input | Kernel output | Independent validation / prohibition |
| --- | --- | --- | --- |
| Identity/fingerprint services | Validated candidate/harness/pack identity references, definition versions, drift checks | Immutable identity binding and drift/cancellation request | Kernel cannot compute from whole trees ad hoc or change identities in place |
| Plan/schema validators | Plan bytes/reference, identity bindings, declared prerequisites/effects/cleanup, target | Accepted immutable plan or pre-attempt rejection | Validator reconstructs authority; exact schema is Sprint `1D` |
| Selector | Authoritative change/operation/request/schedule inputs, policy/registry versions | Selected set, reasons, dependencies, obligations, stable order | Kernel applies but does not define Sprint `1F` policy |
| Adapter | Admitted command/action declaration, identity tuple, environment proof requirement, effect tokens, deadlines, cancellation channel | Lifecycle/output/artifact/result/termination/cleanup events | Adapter cannot broaden effects, select work, or decide overall result; contract remains `1E` |
| Test pack/native runner | Selected pack/version, verified contract/binding, admitted adapter context | Native assertion result, supporting artifacts, failure candidates, mutation/cleanup evidence | Kernel preserves semantic result and cannot reinterpret it; pack interface remains `1E/1F` |
| Event/evidence storage | Append-only identity-bound records and content bytes | Durable references/hashes, conflict/duplicate/storage status, read stream for assembly | Store cannot decide transitions/results; retention/schema remain `1D` |
| Deterministic classifier | Verified contract, primary-cause candidates, execution/environment/result evidence | One primary class, basis, and next safe action | Kernel records only; detailed failure schema remains `1D` |
| Independent evidence validator | Final/partial evidence plus authoritative identity, plan, selection, policy, registry, environment, and artifact inputs | Accepted/rejected validation with reconstructed decision/errors | Producer/kernel cannot self-authorize or modify evidence |
| Advisory comparison | Independently validated advisory evidence and matching authoritative legacy evidence | Attributable comparison/disagreement record | Cannot change either result or authorize release; migration design remains `1G` |
| Deploy admission | No advisory input during current migration except later expressly approved comparison metadata | Current legacy admission remains authoritative | Kernel/advisory `GO` cannot deploy or waive current gate |
| LLM analysis | Read-only evidence references and non-authoritative question | Separate recommendation/narrative | No authoritative field, transition, command, classification, cleanup, validation, or admission input |

## Phase 2 Kernel Acceptance Model

Phase 2 must implement and prove this kernel using synthetic harness-owned
commands, plans, results, fixtures, clocks, stores, and process trees only. It may
not import PATH application code or use MySQL, AWS, browsers, HTTP servers,
builds, existing release checks, TEST, or PROD
(`release-qualification-harness-rebuild-plan-2026-08-10.md:168-192`). Exact
Phase 2 files remain Sprint `1G`.

| Acceptance case | Synthetic setup | Required deterministic proof | Forbidden outcome |
| --- | --- | --- | --- |
| Known-good lifecycle | Valid identities/plan, two dependency-ordered no-effect commands, complete results | Exact states through accepted validation/advisory result; stable order; complete hashes | Missing event, implicit env, cleanup claim, or nondeterministic order |
| Malformed plan | Invalid bytes/version/required conceptual content | Pre-attempt rejection, zero dispatch/effects, complete validator errors | Attempt execution or guessed defaults |
| Unknown check/pack | Valid plan structure references absent registry ID | Selection/plan rejection with unknown ID and zero dispatch | Silent omission or substitution |
| Dependency cycle | Selected synthetic graph contains a cycle | Whole cycle evidence, pre-attempt rejection, stable error | Partial ordering or execution |
| Failed prerequisite | Stateful check depends on deliberate failed capability proof; independent read-only check also selected | Stateful check/dependants blocked with zero effect; eligible read-only check may run; final non-`GO` | Later mutation or full result aggregation that hides prerequisite failure |
| Child nonzero exit | Native child exits nonzero with bounded output | Failed result, one evidenced class/basis, cleanup applicability, final blocker | Product classification from exit code alone or implicit retry |
| Startup timeout | Child never produces running/ready proof | Timeout -> cancel -> graceful/forced termination proof -> required cleanup path | Cleanup before termination or no final evidence |
| Execution timeout | Running child exceeds deadline | Same bounded cancellation/termination chain with elapsed/last-event evidence | Orphan child or pass from late result |
| Idle timeout | Child stays live but produces no required activity/heartbeat | Idle deadline evidence and cancellation | Treating silence as success/liveness |
| User cancellation | Cancellation arrives while child runs | Idempotent request, terminal proof, cancelled result, cleanup/residue and non-`GO` | Lost request, implicit retry, or overwritten prior result |
| Forced process-tree termination | Child ignores graceful shutdown and owns a descendant | Force kills/proves whole tree, records signals/timing, no orphan | Parent-only termination proof |
| Termination failure | Synthetic supervisor cannot prove descendant stopped | `TERMINATION_FAILED`, no racing cleanup/new work, residue unknown, partial/final blocker | Clean claim or rerun in same attempt |
| Missing result | Child exits zero without required structured result | Reject completion; failed/incomplete result and final blocker | Exit zero treated as pass |
| Truncated/overflow result | Result/log exceeds declared bound | Exact limit/captured bytes/truncation evidence, cancellation if live, non-`GO` | Silent truncation or substring parse |
| Corrupted result | Digest/parse/identity content deliberately altered | Conflict/corruption evidence and rejection | Best-effort parse or accepted result |
| Duplicate result | Deliver same result twice, then same identity with different bytes | Identical duplicate idempotent; conflicting duplicate rejects chain | Second transition or last-write-wins |
| Stale result | Valid old result has wrong plan/attempt/version or validity | Reject with exact mismatch; preserve result | Refresh/relabel into current attempt |
| Cleanup required | Synthetic command records mutation and cleanup removes owned marker | Termination, cleanup success, independent zero residue, final completeness | Success based only on cleanup return |
| Cleanup failure | Cleanup exits nonzero or leaves marker | Cleanup failed/residue found or unknown, one blocker, non-`GO` | Warning downgrade or second implicit cleanup |
| Fingerprint drift | Candidate or harness digest changes after attempt opens | Cancellation before next dispatch/effect, drift evidence, cleanup as needed | Updating bound identity or continuing stateful work |
| Interruption during execution | Synthetic supervisor interrupted after mutation marker | Recovered immutable events, cancellation/termination, cleanup/residue where possible, incomplete/non-`GO` | Missing attempt record or automatic execution resume |
| Interruption during cleanup | Cleanup interrupted after partial action | Cleanup interrupted, exact completed/unknown actions, residue proof/unknown, non-`GO` | Clean status or implicit cleanup restart |
| Interruption during finalization | Writer fails after event graph is complete | Partial marker/event chain; evidence-only deterministic reassembly yields identical final bytes | Re-execution, new facts/timestamps, or changed attempt ID for reassembly |
| Prerequisite-triggered cancellation | A previously valid shared prerequisite is invalidated before dispatch/while eligible work runs | Cancel affected live work, block dependants, no new stateful dispatch | Continued mutation under stale authority |
| Deterministic repeated evidence | Assemble and validate the same immutable synthetic attempt repeatedly | Byte-identical final evidence/digest and identical validation outcome | Order-, timing-of-read-, or map-insertion-dependent bytes |

Phase 2 acceptance also requires the controlling exit gate: ten consecutive clean
known-good certification runs, every negative case passing for the intended
reason, focused kernel unit/integration coverage, `git diff --check`, and Bill's
review. Those runs are not authorized or performed in Phase 1.

## Sprint 1C Decision and Verification Record

| ID | Evidence / invariant | Chosen rule | Rejected alternative | Tradeoff / unresolved point | Later verification requirement |
| --- | --- | --- | --- | --- | --- |
| 1C-D01 | P01; audit CP08-CP11 `:1067-1069` | Kernel owns only domain-neutral orchestration/evidence coordination | Universal workflow or kernel product semantics | More explicit pack/adapter boundaries | Phase 2 import/dependency checks and synthetic-only proof |
| 1C-D02 | M07-M10; audit `:384-393` | Hierarchical invocation, attempt, check, cleanup, and validation states with append-only transitions | Final-only status or one flat check state | More state records, but partial attempts become diagnosable | Sprint `1D` schema mapping; Phase 2 transition mutation tests |
| 1C-D03 | M02/M09; Sprint `1B` lineage L01-L14 | Invalid plan/selection rejects before attempt; valid accepted plan gets one new immutable attempt | Allocate/reuse attempt before plan validity or use release ID | Pre-attempt rejection needs its own evidence concept | Sprint `1D` plan/rejection drafts; Phase 2 malformed-plan cases |
| 1C-D04 | P01/P04; audit `:458-485,1309-1313` | Minimal kernel runs stable topological order serially | Immediate parallel scheduler or full aggregate regardless of effects | Slower initially; dramatically simpler lifecycle/cancellation proof | Phase 2 repeat-order proof; any later concurrency requires new decision |
| 1C-D05 | M04/M08; audit finding 5 `:458-469` | After any failure, start no new stateful work; only independent declared read-only diagnostics may continue | Continue all checks or globally stop required cleanup/read-only evidence | Preserves diagnostics while containing effects | Phase 2 failed-prerequisite/read-only-continuation case |
| 1C-D06 | M04-M06/M11 | Treat capabilities/effects as validated opaque tokens with read-only/stateful/cleanup metadata; requested set cannot broaden | Kernel domain-specific effect logic or adapter self-declaration | Registry quality becomes critical; exact vocabulary deferred | Sprint `1E` adapter contracts; Phase 2 undeclared-effect negatives |
| 1C-D07 | M05/M15; audit `:411-421,517-528` | No ambient environment authority; bind fresh proof after effective config loading | Inherit parent environment or reuse earlier identity by name | More explicit configuration/proof plumbing | Sprint `1E` environment adapter; Phase 2 synthetic stale-proof cases |
| 1C-D08 | M07; audit finding 6 `:470-485` | Separate startup, execution, idle, grace, force, cleanup, finalization, and total budgets with cleanup/finalization reserves | One timeout or unbounded waits | More budget coordination; numeric values deferred | Sprint `1E/1F` budgets; Phase 2 deadline cases |
| 1C-D09 | M07/L10 | Cancellation is request -> graceful -> forced whole-tree/job termination -> independent proof; timeout is not terminal | Parent exit/timeout as cancellation success | Platform mechanism remains adapter-specific | Sprint `1E`; Phase 2 descendant and termination-failure cases |
| 1C-D10 | M09/M13; historical transport failures audit `:849-865` | Separate streams, explicit limits, content hashes, no silent truncation; any minimal-kernel truncation blocks `GO` | Flattened output, substring marker, or accept truncated success | May fail noisy commands until durable transport exists | Sprint `1D` evidence fields and `1E` transport; Phase 2 overflow cases |
| 1C-D11 | Plan `:22-28`; Sprint `1B` attempt rule | No implicit retry; execution/cleanup retry gets a new attempt; pure finalization reassembly may reuse attempt | Patch/rerun or hidden retry in same evidence | More attempts, honest lineage | Phase 2 retry rejection and deterministic reassembly |
| 1C-D12 | M10; audit `:722-749,840-907` | Classifier consumes verified causes/contracts; kernel records exactly one class and never invents it | Exit-code mapping, LLM choice, or multiple primary causes | Some failures remain `unclassified` by design | Sprint `1D` failure draft; Phase 2 classification plumbing cases |
| 1C-D13 | M08; audit `:384-393,517-535,585-597` | Cleanup obligation known before dispatch; cleanup after termination; independent residue proof; unknown blocks `GO` | Runner return as cleanup proof or cleanup before termination | Requires separate residue capability | Sprint `1E` ownership contract; Phase 2 cleanup/residue cases |
| 1C-D14 | M09/L12-L13 | Assemble final evidence as a pure deterministic function of immutable records; interruption preserves partial chain | Generate final-only evidence after all commands or inject fresh facts during reassembly | Event store must be durable enough; retention/schema deferred | Sprint `1D`; Phase 2 finalization interruption/repeat proof |
| 1C-D15 | M01/M09; Sprint `1B` authority matrix | Independent validator reconstructs and either accepts or rejects; both yield an attributable advisory availability state, never release authority | Kernel self-validation or validator repair | Separate logic adds work but prevents self-authorizing evidence | Sprint `1D` validator design; Phase 2 tamper/omission cases |
| 1C-D16 | Plan `:168-192`; M18 | Phase 2 proves only pure local synthetic kernel behavior and all listed negatives | Begin with PATH runners, databases, browsers, or TEST | Defers real capability value until foundation is certified | Phase 2 exact scope approval in `1G` and later execution |

No Sprint `1C` decision requires a new Bill architecture choice. Bill's O1
approval resolved the only prior ownership question. Numeric timeout defaults,
adapter termination mechanisms, detailed evidence fields, pack policy, and
migration authority remain correctly deferred to Sprints `1D-1G`; none changes
the accepted strategy at this stage.

## Sprint 1C Files, Effects, and Verification

Examined:

- `docs/AGENTS.md`;
- the controlling plan's strategic, identity, failure, Phase 1, Phase 2,
  checkpoint, and ledger sections;
- the accepted Phase 0 audit's lifecycle/residue map, confirmed prerequisite,
  execution, validation, identity, cleanup and evidence findings, unresolved
  process defaults, historical taxonomy, and control-plane dispositions;
- the accepted target architecture's charter, M01-M21, conceptual boundaries,
  D02/D04/D05/D09/D10, Sprint `1B` authority/evidence-lineage model, and proposed
  Sprint `1C` scope; and
- current source behavior already cited by those baselines, especially
  `scripts/path-release-qualify.js:308-405`,
  `src/lib/releaseQualification.js:122-149,165-210`, and the runner-specific
  lifecycle sources recorded at audit `:384-393,470-485`.

Changed only:

- this target-architecture document; and
- the controlling plan's checkpoint and Sprint Ledger.

Verification is limited to read-only documentation consistency: kernel ownership
and exclusions, all requested lifecycle states, transition requirements and
failure behavior, prerequisite/effect gates, selection boundary, timeout and
cancellation guarantees, cleanup/residue convergence, conceptual interfaces,
Phase 2 acceptance cases, decision traceability, deferral boundaries,
formatting, and final worktree state. No executable or environment verification
is authorized.

One combined read of the accepted lifecycle evidence exceeded the display
budget. The material findings and source references were available in the same
accepted audit plus bounded plan/architecture reads. This was an explained
source-display limitation with no write or operational effect. No unexplained
failure, blocker, strategy conflict, or course correction occurred. One final
read-only heading search contained an unescaped shell backtick, so the shell
reported `1C: command not found` while expanding the search pattern; no workflow
or file-changing command was involved, and a corrected static check completed
without error.

Final worktree state: admin remains on `main...origin/main` with the pre-existing
modified `docs/AGENTS.md`,
`docs/ops/deployments/release-qualification-runbook.md`, and
`docs/planning/README.md`, plus the pre-existing untracked Phase 0 audit,
controlling plan, and target-architecture files. Sprint `1C` changed only the
target-architecture and controlling-plan files. Portal and shared remain clean
on `main...origin/main`. Intacct mock remains the non-Git directory established
in Phase 0 and was not re-probed. No pre-existing user change was reverted or
overwritten.

## Sprint 1C Completion Decision

Sprint `1C` is complete at the documentation-architecture level. It defines the
minimal kernel and complete deterministic execution lifecycle without drafting
detailed schemas, finalizing adapter or pack interfaces/policy, designing
migration/cutover, selecting Phase 2 files, implementing, or repairing anything.

The exact approval required for proposed next work is: **Bill explicitly
authorizes Sprint `1D` of Phase 1 to produce documentation-only versioned plan,
execution-event, check-result, failure, cleanup, and final-evidence schema drafts
and the independent validation/retention design, with no executable schema,
implementation, or environment work.**

Sprint `1D` has not begun.

Bill subsequently authorized Sprint `1D` exactly within that boundary. The
result of Sprint `1D` follows.

## Sprint 1D Outcome

Sprint `1D` defines a documentation-level evidence family consisting of exactly
six schemas, a common immutable envelope, structural and canonical comparison
rules, independent validation, schema evolution, and a durable-retention
recommendation. These are normative architecture drafts, not executable JSON
Schema files, types, validators, storage configuration, or current-admission
changes.

The design does not alter O1, the five identities, the Sprint `1B` authority or
lineage model, or the Sprint `1C` kernel lifecycle. Adapter behavior remains
Sprint `1E`; pack selection and certification policy remain Sprint `1F`;
migration, retention operating approval, and exact Phase 2 scope remain Sprint
`1G`.

## Evidence Schema Conventions

### Draft Family and Normative Language

The six documentation-level schema names and current semantic versions are:

| Schema name | Draft version | Artifact role |
| --- | --- | --- |
| `path.release-qualification.qualification-plan` | `1.0.0-draft.2` | Immutable plan-state snapshot through accepted dependency order or pre-attempt rejection |
| `path.release-qualification.execution-event` | `1.0.0-draft.1` | One append-only attempt/check/cleanup/validation lifecycle observation or transition |
| `path.release-qualification.check-result` | `1.0.0-draft.1` | One selected check's terminal or explicit non-success result |
| `path.release-qualification.failure` | `1.0.0-draft.1` | Exactly one deterministic primary failure classification and its basis |
| `path.release-qualification.cleanup-result` | `1.0.0-draft.1` | Cleanup obligation, actions, independent residue proof, and terminal/partial state |
| `path.release-qualification.final-evidence` | `1.0.0-draft.2` | Deterministic attempt summary and advisory decision submitted to independent validation |

Sprint `1D` initially recorded all six as `1.0.0-draft.1`. The bounded Sprint
`2A` schema-alignment correction superseded plan and final-evidence `draft.1`
with `draft.2`; no certified or release-authoritative evidence used the
superseded versions, and no retained artifact is deleted by this decision.

`MUST`, `MUST NOT`, `REQUIRED`, `FORBIDDEN`, `SHOULD`, and `MAY` are normative
within this design. Field tables use:

- `R`: required and non-null;
- `C`: conditionally required exactly under the stated condition, otherwise
  forbidden unless the row says optional;
- `O`: optional but validated and immutable when present;
- `F`: forbidden for that schema or state; and
- `D`: derived deterministically from other immutable content and stored or
  independently recomputed as stated.

An optional field is absent when unknown or inapplicable. `null`, an empty
string, zero, `unknown`, or a placeholder ID MUST NOT stand in for missing
evidence unless that field's enumeration explicitly makes `unknown` a valid
evidenced state. Every artifact is immutable. Progress creates a new linked
artifact or execution event; no producer edits an earlier artifact in place.

## Common Evidence Envelope

### Normative Fields

| Field | Status and conceptual type | Invariant |
| --- | --- | --- |
| `schemaName` | `R`, exact schema-name string | MUST equal one of the six names above; aliases and inferred names are forbidden |
| `schemaVersion` | `R`, semantic-version string | MUST be an exact supported version; it participates in canonical bytes and `harnessVersion` |
| `artifactId` | `R`, globally unique opaque identifier | Allocated once by the authoritative producer, included in the digest preimage, never reused or inferred from a filename |
| `createdAt` | `R`, canonical UTC timestamp | Records the evidenced creation boundary, not validation/read time; reassembly MUST reuse the original value |
| `producer` | `R`, structured producer identity | Contains `authorityId`, `componentId`, `componentVersion`, and non-secret `producerInstanceId`; producer assertion alone never grants trust |
| `lineageScope` | `R`, `pre-attempt` or `attempt` | Determines whether attempt-bound fields are required; an artifact cannot change scope later |
| `productCandidateId` | `C`, immutable identity reference | Required once candidate identity is bound; a pre-binding rejection MUST omit it and list the gap in body evidence |
| `harnessVersion` | `C`, immutable identity reference | Required once harness identity is bound; missing or conflicting value after binding fails closed |
| `attemptId` | `C`, opaque identifier | Required for every `attempt` artifact; forbidden for `pre-attempt` artifacts and qualification plans |
| `environmentIdentityRef` | `C`, artifact reference | Required when the artifact reports or authorizes an environment/capability-scoped action; forbidden when no such proof is applicable; plans declare requirements instead |
| `testPackVersions` | `C`, canonical map of pack ID to version digest | Required after selection is resolved and for every attempt descendant; absent only in an evidenced pre-selection rejection |
| `parentArtifactRefs` | `R`, ordered array of artifact references | Empty only for a root plan snapshot; each reference carries schema, version, artifact ID, digest algorithm, and digest |
| `relatedArtifactRefs` | `O`, purpose-labelled artifact-reference array | Non-parent relationships such as rerun, validation, comparison, replacement, or redacted derivative; MUST NOT change parentage |
| `contentDigest` | `D/R`, `{algorithm,value}` | Initial algorithm is `sha256`; value hashes canonical artifact bytes with the entire `contentDigest` field omitted |
| `lifecycleState` | `R`, schema-specific enum | MUST be permitted by the owning schema and supported by predecessor evidence; prose status is not authoritative |
| `completeness` | `R`, structured status | Contains `state` = `complete`, `partial`, or `interrupted`; `missingEvidence` references/reason codes; and conditional last-trustworthy event/mutation state |
| `sensitivity` | `R`, `public`, `internal`, `confidential`, or `restricted` | Highest applicable classification across fields and referenced attachments; defaults are forbidden |
| `redaction` | `R`, structured metadata | Contains `state` = `none-required`, `redacted-derivative`, or `redaction-required`; profile/version and original reference are required for a derivative |
| `retentionPolicyRef` | `R`, versioned policy reference | Selects a declared retention class and deletion authority; it does not authorize deletion by itself |

An identity reference contains the identity kind, definition version, digest
algorithm, digest, and manifest references required by Sprint `1B`. It MUST NOT
be only a release label, Git head, environment name, or filename. An artifact
reference contains enough information to locate and independently hash-check the
exact bytes; a path or URL is discovery metadata, never identity.

### Applicability by Schema

| Envelope field | Plan | Event | Check result | Failure | Cleanup result | Final evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Schema, artifact, time, producer, digest, lifecycle, completeness, sensitivity, redaction, retention | `R` | `R` | `R` | `R` | `R` | `R` |
| `productCandidateId` and `harnessVersion` | `C`: required after binding | `R` | `R` | `C`: may be absent only for evidenced pre-binding failure | `R` | `R` |
| `attemptId` | `F` | `R` | `R` | `C`: required for attempt failure, forbidden pre-attempt | `R` | `R` |
| `environmentIdentityRef` | `F`; body declares requirements | `C`: required for environment/effect action | `C`: required when check has such capability | `C`: required when failed phase reached such capability | `C`: required unless cleanup is locally unnecessary with no environment | `C`: body lists every applicable proof; primary reference only when one proof scopes the attempt |
| `testPackVersions` | `C`: required at/after `SELECTION_RESOLVED` | `R` | `R` | `C`: required after selection | `R` | `R` |
| Parent references | `R`; snapshots link predecessor | `R`; first event links accepted plan | `R`; terminal event and plan | `R`; failed result/event or rejected plan | `R`; result/terminal/cleanup events | `R`; accepted plan plus all terminal graph roots |

### Common Immutability and Safety Invariants

1. Required fields are never inferred from ancestors during validation; every
   artifact carries or explicitly references its applicable identity binding.
2. Same `artifactId` plus different canonical bytes is a conflict. Both byte
   variants are retained and every affected chain is rejected.
3. An exact duplicate with the same ID and digest is idempotent delivery, not a
   second event or result.
4. Missing, stale, ambiguous, conflicting, unsupported-version, cross-attempt,
   or cross-candidate references fail closed.
5. Secrets, credentials, authorization headers, tokens, private keys, session
   material, and unrestricted personal data are forbidden in every artifact and
   attachment. Detection is a validation failure, not a reason to rewrite the
   authoritative bytes silently.
6. A redacted view is a new derivative artifact with its own ID/digest and an
   immutable reference to the restricted original. It cannot replace original
   evidence for qualification validation.
7. `createdAt` and other timestamps record observations; sequence and lineage,
   not wall-clock comparison, determine execution order.
8. `completeness.state=complete` is valid only when the owning schema's required
   graph is complete. `partial` and `interrupted` enumerate missing or unknown
   evidence and can never support advisory `GO`.

## Six Documentation-Level Schema Drafts

### 1. Qualification Plan

**Purpose and authority.** The qualification-plan schema records immutable
pre-attempt plan snapshots from loaded input through validated selection and
dependency order. The bounded admin-owned planner/selector is the producer. An
independent plan validator reconstructs identities, scope, selection inputs,
dependencies, prerequisites, effects, capabilities, and budgets. The kernel,
identity services, adapters, packs, final validator, and advisory comparator may
consume an accepted plan; no plan may authorize release or environment effects
by its own existence.

| Field | Status | Contract |
| --- | --- | --- |
| Common envelope | `R/C` | `lineageScope=pre-attempt`; `attemptId` and `environmentIdentityRef` forbidden |
| `invocationRef` | `R` | Immutable request/source reference and digest; operator prose is not scope authority |
| `requestedTarget` | `R` | Structured target class and policy reference; `DEV`, `TEST`, or `PROD` label alone is insufficient |
| `requestedScope` | `R` | Canonical changed-input/operation references, explicit suite requests, and scheduled/full-regression trigger facts |
| `identityBindings` | `C` | Candidate/harness/available-pack registry references required at `IDENTITIES_BOUND` and later |
| `selectionPolicyRef` and `packRegistryRef` | `C` | Required at `PLAN_VALIDATED` and later; exact versions bind to `harnessVersion` |
| `selectedChecks` | `C`, ordered array | Required at `SELECTION_RESOLVED` and later; each entry has stable check-instance ID, check definition/version, pack ID/version, native-contract ref, adapter/capability requirements, and one or more inclusion origins |
| `inclusionOrigins` | `C` per selected check | Allowed values: `mandatory-core`, `impacted-domain`, `dependency`, `explicit-suite`, `scheduled-full`, `release-operation`; policy meaning is controlled by Sprint `1F` and accepted MC2 |
| `scopeResolution` | `R` | Lists every authoritative input as mapped or rejected; an accepted plan requires no unknown/unmapped/ambiguous input |
| `dependencies` | `C`, canonical edge array | Each edge names predecessor, dependant, reason, and prerequisite/effect relationship; unknown nodes and cycles are invalid |
| `executionOrder` | `C`, ordered check-instance IDs | Required only at `DEPENDENCIES_ORDERED`; MUST be a stable serial topological order containing every selected check exactly once |
| `prerequisiteGates` | `C` | Per-check gate IDs, predecessor gates, proof type/freshness, validator, failure/blocking closure, and whether metadata/read-only actions are permitted |
| `environmentRequirements` | `C` | Required capabilities and proof policies, not claimed proof results; exact target/config/provider/DB/AWS requirements stay declarative |
| `declaredEffects` | `C` | Per check, complete opaque effect tokens plus `read-only` or `stateful`, resource scope, mutation boundary, and exclusivity metadata |
| `adapterRequirements` | `C` | Exact adapter contract/version and capability tokens; no implementation command is inferred |
| `commandDeclarationRefs` | `C` | Structured, non-secret command/action declarations approved for dispatch; raw shell text is forbidden as sole authority |
| `budgets` | `C` | Startup, execution, idle, graceful, forced termination, cleanup, finalization, and total-attempt integer durations; total includes protected cleanup/finalization reserves |
| `cancellationPolicyRef` | `C` | Versioned policy defining allowed causes and required termination proof; no implicit retry |
| `cleanupObligations` | `C` | Per mutation-capable check: obligation ID, owner, recovery relationship, termination prerequisite, residue verifier, residue scope, and budget |
| `evidenceContract` | `R` | Exact six schema versions, canonicalization profile, digest algorithm, result/log limits, required attachment classes, and retention policy |
| `validationReportRef` | `O` | Independent report may be related after validation but MUST NOT be inserted into or mutate the plan snapshot it validated |

Allowed `lifecycleState` values are `PLAN_LOADED`, `IDENTITIES_BOUND`,
`PLAN_VALIDATED`, `SELECTION_RESOLVED`, `DEPENDENCIES_ORDERED`, and
`REJECTED_BEFORE_ATTEMPT`. Each later snapshot links its immediate predecessor.
Only a complete, independently validated `DEPENDENCIES_ORDERED` snapshot may be
used to open an attempt. A rejected or partial snapshot records validator error
codes, missing/ambiguous inputs, last valid state, and next safe action through a
failure reference or validation attachment; it contains no attempt ID.

Plan invariants fail closed on unsupported schema/policy/registry version,
missing identity, unknown check, unmapped input, duplicate check instance,
missing dependency, cycle, nondeterministic ordering, undeclared effect,
stateful check without cleanup/residue ownership, impossible timeout reserves,
or any attempt to substitute a pack/adapter version. The schema deliberately
represents selection inputs and outputs but does not define the Sprint `1F`
selection policy.

### 2. Execution Event

**Purpose and authority.** The execution-event schema is the append-only factual
timeline for one attempt. The kernel produces orchestration transitions; an
adapter, pack, native runner, store, or validator supplies attributable observed
facts through the kernel's evidence boundary. The independent event validator
checks producer authority, sequence, transition, command/effect identity,
attachments, and terminal proof. Results, cleanup, final assembly, and validators
may consume events; event prose cannot decide product semantics or release status.

| Field | Status | Contract |
| --- | --- | --- |
| Common envelope | `R/C` | `lineageScope=attempt`; exact accepted plan, identities, attempt, and selected pack map required |
| `planRef` | `R` | Exact complete `DEPENDENCIES_ORDERED` plan artifact and digest |
| `attemptSequence` | `R`, positive integer | Kernel-assigned, strictly increasing, gap-free in a complete attempt; authoritative ordering independent of clocks |
| `producerSequence` | `R`, non-negative integer | Strictly increasing for the producer instance; detects missing/reordered producer observations |
| `eventType` | `R`, enum | `state-transition`, `dispatch`, `process-observation`, `progress`, `output-chunk`, `attachment`, `timeout`, `cancellation-request`, `termination-action`, `mutation-boundary`, `validation-observation`, or `storage-observation` |
| `transition` | `C` | Required for `state-transition`: exact `fromState`, `toState`, triggering evidence refs, and transition-rule version |
| `checkInstanceId`, `packId`, `packVersion` | `C` | Required for check/cleanup-scoped events; MUST match selected plan entry |
| `adapterRef` and `commandDeclarationRef` | `C` | Required for dispatched/local/remote action; command digest, cwd authority, environment allowlist digest, and capability/effect token set bind the observation |
| `occurredAt` | `R` | Producer-observed canonical UTC time; may differ from storage time but cannot establish ordering |
| `recordedAt` | `R` | Evidence boundary receipt time; late arrival is represented, never reordered silently |
| `processOrJobRef` | `C` | Non-secret local process-tree or remote-job identity required after dispatch until terminal proof |
| `effectTokens` | `C` | Required on admitted action/mutation events; MUST be a subset of plan declaration |
| `mutationState` | `C`, enum | `not-started`, `may-have-started`, `started`, or `terminal`; required at mutation, failure, cancellation, termination, and cleanup handoff boundaries |
| `timeout` | `C` | Kind, configured budget, elapsed duration, last activity sequence, and deadline; timeout never asserts termination |
| `cancellation` | `C` | Cause, requester authority, target, requested sequence/time, grace/force deadlines, and linked timeout/prerequisite/drift evidence |
| `termination` | `C` | Action `graceful-request`, `forced-tree-termination`, or `remote-cancel`; terminal proof/result or explicit inability to prove termination |
| `streamRef` | `C` | `stdout` or `stderr`, stream sequence, byte range, raw-byte attachment digest, captured size, and truncation/overflow facts |
| `attachmentRef` | `C` | Media type, raw-byte digest/algorithm, size, sensitivity, retention class, producer, and logical purpose; location is non-authoritative |
| `progress` | `O` | Structured declared milestone/heartbeat ID and bounded data; free text cannot be a prerequisite, result, or liveness proof unless the contract names it |
| `lateOrConflict` | `C` | `late`, `duplicate-identical`, `duplicate-conflicting`, `out-of-order`, or `stale`; original accepted boundary remains unchanged |

The allowed lifecycle states are exactly the Sprint `1C` attempt, check,
cleanup/residue, finalization, validation, and advisory states. A transition MUST
match the prior state and rule; missing, repeated-with-different-bytes,
out-of-order, impossible, or post-terminal transitions are invalid. The first
event is `ATTEMPT_OPENED` and links the accepted plan. A complete attempt has one
gap-free `attemptSequence`; an interrupted attempt may have a final observed
sequence and explicit missing range but never invents absent events.

Start, progress, terminal, cancellation, timeout, graceful/forced termination,
late output, and orphan/unknown-process evidence remain distinct. `stdout` and
`stderr` are separately ordered raw-byte attachments. Truncation records the
configured/captured byte counts and blocks qualification validity; substring
markers and flattened output are forbidden authority.

### 3. Check Result

**Purpose and authority.** The check-result schema records one selected check's
deterministic terminal or explicit non-success outcome. The declared pack/native
runner is authoritative for product assertions; the adapter supplies execution
facts and the kernel wraps without reinterpretation. An independent result
validator checks plan/pack/command/event/evidence bindings and completeness but
does not change native semantics. Final assembly and diagnosis may consume it;
it cannot decide overall qualification or release admission.

| Field | Status | Contract |
| --- | --- | --- |
| Common envelope and `planRef` | `R/C` | Attempt-bound and identity-equal to the accepted plan |
| `checkInstanceId`, `checkDefinitionRef`, `packId`, `packVersion` | `R` | Exactly one selected plan entry and exact pack version |
| `testLevel` | `R`, enum | `unit`, `component-contract`, `integration`, `local-system`, `deployed-end-to-end`, `smoke`, or `unresolved`; MUST match pack contract |
| `nativeRunnerRef` and `nativeContractRefs` | `R` | Exact runner/version and authoritative product-contract references |
| `adapterRef` and `commandDeclarationRef` | `C` | Required when execution used an adapter/command; MUST match dispatch event |
| `eventRange` and `terminalEventRef` | `R` | First/last relevant sequence and exact valid terminal event; omission is not success |
| `status` | `R`, enum | `passed`, `failed`, `timed-out`, `cancelled`, `blocked`, `unavailable`, or `incomplete` |
| `nativeStatus` | `C` | Required when native result exists; preserved value plus contract mapping to deterministic `status` |
| `assertions` | `C`, ordered array | Required for assertion-bearing checks; each has stable assertion ID, `passed`/`failed`/`not-run`, contract ref, and structured expected/observed value or digested attachment ref |
| `expected` and `observed` values | `C` | Schema-typed structural values with units/type/contract; raw serialization order or diagnostic prose cannot establish equality |
| `prerequisiteResultRefs` | `R` | All applicable gate/environment proof results; a blocked result names the failed gate and dependency path |
| `outputRefs` and `attachmentRefs` | `R`, arrays may be empty | Hash-linked logs/native results/screenshots/artifacts, with truncation and sensitivity metadata |
| `executionFacts` | `R` | Exit status/signal or remote terminal code, start/end sequences, timeout/cancel/termination outcomes, and last accepted output boundary |
| `effectsObserved` and `mutationState` | `R` | Declared versus observed effects and final mutation state; undeclared effect is a harness failure |
| `failureRef` | `C` | Required exactly once for `failed`, `timed-out`, `unavailable`, or `incomplete`; forbidden for `passed`; `cancelled` requires it unless solely blocked by another referenced failure |
| `blockingFailureRef` | `C` | Required for `blocked` and permitted for dependent cancellation; does not create a second primary class for this check |
| `cleanupObligationId` and `cleanupResultRef` | `C` | Obligation required for every mutation-capable/may-have-mutated check; terminal cleanup ref may be added only in a later linked result snapshot, never by mutation |
| `resultSummary` | `D` | Structured counts by assertion status and blocker state; independently recomputed, never free-text authority |

`passed` requires a completed execution event, complete valid native result, all
mandatory native assertions passed, no output truncation, no identity drift, and
no undeclared effect. It does not by itself establish cleanup, final `GO`, or
release authority. Exit zero without the required result is `incomplete` or
`failed`, never `passed`. A nonzero exit is not automatically `product`.

Each selected check has exactly one accepted terminal result artifact in final
evidence. Conflicting terminal results reject the chain; an identical duplicate
is idempotent. Missing, stale, wrong-attempt, wrong-pack, late-after-terminal, or
out-of-order evidence is referenced as rejected evidence and cannot change the
accepted result.

### 4. Failure

**Purpose and authority.** The failure schema records exactly one primary class
for one failed result or pre-attempt rejection. The deterministic classifier is
the producer after consuming verified contract and structured evidence. The
independent failure validator recomputes rule applicability, evidence
sufficiency, identity/phase binding, and the one-class constraint. Operators,
final assembly, advisory comparison, and later repair planning may consume it;
an LLM may only provide a separately referenced non-authoritative recommendation.

| Field | Status | Contract |
| --- | --- | --- |
| Common envelope | `R/C` | May be `pre-attempt` without unavailable identities or `attempt` with complete identity tuple |
| `failedPhase` | `R`, lifecycle-state/phase enum | Exact plan, prerequisite, environment, dispatch, execution, timeout, cancellation, termination, result, cleanup, residue, finalization, validation, or storage phase |
| `checkInstanceId` | `C` | Required for a check failure; forbidden for invocation/plan-only failure |
| `commandDeclarationRef` and `adapterRef` | `C` | Required when a command/action had been admitted or attempted |
| `resultRef` or `rejectedPlanRef` | `R` | Exactly one owning failed-result or pre-attempt plan/rejection lineage root |
| `primaryClassification` | `R`, enum | Exactly one of `product`, `harness`, `environment`, `infrastructure`, or `unclassified` |
| `classificationRuleRef` | `R` | Exact deterministic rule set/version and matched rule ID |
| `contractRefs` | `R`, non-empty array | Verified authoritative expectation, adapter, plan, or environment contract supporting the class |
| `supportingEvidenceRefs` | `R`, non-empty unless the missing evidence is itself the basis for `unclassified` | Exact event/result/raw-proof/attachment references and relevant structured fact paths |
| `evidenceSufficiency` | `R`, enum | `sufficient`, `insufficient`, or `conflicting`; non-`unclassified` requires `sufficient`; `insufficient`/`conflicting` requires `unclassified` |
| `deterministicBasis` | `R` | Structured rule inputs and comparisons; narrative may explain but cannot replace them |
| `contributingConditions` | `R`, array may be empty | Separately coded, evidenced conditions that did not determine the primary class; no second primary field allowed |
| `knownEffects` and `mutationState` | `R` | Effects completed, may-have-started, prevented, or unknown at failure boundary |
| `nextSafeAction` | `R` | Structured action code, prerequisite evidence, prohibited continuation, and whether new candidate/version/attempt or separate recovery authorization is required |
| `mandatoryStop` | `D/R`, boolean with reasons | MUST be true for `unclassified`, evidence conflict, termination failure, unknown residue, or another controlling stop invariant |
| `llmRecommendationRef` | `O` | Separate artifact/note reference only; MUST NOT populate classification, sufficiency, basis, or stop fields |

Allowed `nextSafeAction.code` values are `preserve-and-stop`,
`obtain-contract-evidence`, `new-product-candidate`, `new-harness-version`,
`restore-environment-then-new-attempt`, `restore-infrastructure-then-new-attempt`,
`separately-authorized-recovery`, and `no-retry-until-reviewed`. The value records
safe governance, not permission to implement a repair or access an environment.

`unclassified` is mandatory when the verified evidence cannot distinguish the
other four classes. It blocks new stateful work and advisory `GO`. A generic exit
code, last patch, human narrative, or LLM opinion is never deterministic
classification authority. Multiple causal observations remain contributing
conditions; they cannot be encoded as multiple primary classes.

### 5. Cleanup Result

**Purpose and authority.** The cleanup-result schema records one declared cleanup
obligation, the owning cleanup action, and independent residue verification. The
declared adapter/pack cleanup owner produces cleanup action evidence; a logically
independent residue verifier produces residue assertions; the kernel assembles
the linked cleanup result. The independent cleanup validator verifies
termination, target/recovery identity, owned resource scope, actions, and residue
proof. Final assembly and separately authorized recovery may consume it.

| Field | Status | Contract |
| --- | --- | --- |
| Common envelope and `planRef` | `R/C` | Attempt-bound; exact identities and selected pack versions required |
| `cleanupObligationId` | `R` | Exact obligation declared in the accepted plan and check result |
| `checkInstanceId`, `packId`, `packVersion` | `R` | Owner check and exact version; cannot be transferred silently |
| `cleanupOwner` | `R` | Authority, adapter/pack contract, version, and capability/effect tokens |
| `status` | `R`, enum | `unnecessary`, `required`, `started`, `completed`, `failed`, or `interrupted` |
| `cleanupReason` | `R` | Declared fixture/effect, observed mutation, may-have-mutated boundary, recovery requirement, or proved no-effect reason |
| `executionTerminationProofRef` | `C` | Required before `started` unless `unnecessary` proves no process/effect began; parent exit alone is insufficient |
| `environmentOrRecoveryIdentityRef` | `C` | Required for environment-owned resources; any identity difference needs an explicit validated recovery relationship |
| `affectedResources` | `R`, array may be empty only when unnecessary | Opaque resource IDs/digests, resource type, owning effect token, creation/mutation evidence, and sensitivity; no guessed identifiers |
| `declaredResidueScope` | `R` | Complete resource/counter/object/identity/temp/process scope that must be verified |
| `cleanupActionRefs` | `C` | Required once started; exact admitted adapter actions/commands and event ranges, not narrative summaries |
| `cleanupOutcome` | `C` | Terminal process/job facts and structured completed/failed/unknown actions; required for completed/failed/interrupted |
| `residueVerifier` | `C` | Required whenever mutation began or may have begun; logically independent authority and exact proof contract |
| `residueAssertions` | `C` | Stable assertion IDs, resource scope, structured expected zero/absence and observed value, evidence/attachment refs |
| `residueDecision` | `R`, enum | `not-applicable`, `zero-residue`, `residue-found`, or `unknown` |
| `remainingResidue` | `C` | Required for `residue-found` or `unknown`; known resources, unknown scope, safety impact, and escalation reference |
| `interruptionState` | `C` | Exact interrupted phase: execution, termination, cleanup, or residue verification; last trustworthy action/event and unknown effects |
| `escalation` | `C` | Required on failed/interrupted/residue/unknown: mandatory stop, containment facts, and separately authorized next-safe-action reference |

Status snapshots are immutable and link their predecessor. `completed` means the
cleanup action completed; it does not mean residue is zero. Advisory success for
a mutation-capable check requires both completed cleanup where required and
`residueDecision=zero-residue` from the independent verifier. `failed`,
`interrupted`, `residue-found`, or `unknown` blocks `GO`.

If execution termination is not proved, cleanup MUST NOT start because it could
race live work; status records `required` or `interrupted`, residue is `unknown`,
and escalation is mandatory. A pre-mutation schema-preflight failure records
cleanup `unnecessary` only with proof mutation never began; it never authorizes
ordinary cleanup SQL. A later recovery is a new separately authorized attempt,
not an implicit cleanup retry.

### 6. Final Evidence

**Purpose and authority.** The final-evidence schema is the kernel's pure,
deterministic assembly of one attempt's accepted plan and immutable evidence
graph. The kernel evidence assembler is the producer. An independently invoked
evidence validator reconstructs scope, identities, graph, decisions, and
attachments from authoritative inputs. Advisory comparison may consume only a
validated artifact. During migration, deploy admission does not consume it as
release authority.

| Field | Status | Contract |
| --- | --- | --- |
| Common envelope | `R/C` | Attempt-bound; exact candidate, harness, attempt, selected packs, completeness and retention required |
| `planRef` and `planDigest` | `R` | Exact complete accepted plan; digest is independently recomputed |
| `identitySummary` | `R` | Candidate/harness/attempt definitions plus every applicable environment proof and selected pack version; summary is derived from references |
| `requestedScope` and `selectedScope` | `R` | Exact plan references plus derived check/origin/dependency summaries; validator reconstructs them rather than trusting the summary |
| `prerequisiteResults` | `R` | Every declared gate with pass/fail/blocked status, proof refs, environment capability refs, and affected closure |
| `eventGraph` | `R` | Ordered event references from attempt open through finalization boundary, sequence range, missing ranges, late/conflicting quarantine refs, and graph digest |
| `checkResults` | `R` | Exactly one accepted terminal/explicit non-success result per selected check, ordered by plan execution order |
| `failures` | `R` | Exactly the failure records required by non-success results and validation blockers; no orphan or duplicate primary failure |
| `cancellationAndTermination` | `R` | Every timeout/cancel/termination action and whether terminal proof succeeded; empty only when none occurred |
| `cleanupAndResidue` | `R` | Every cleanup obligation/result, independent residue decision, unresolved effect, and escalation |
| `attachmentIndex` | `R` | All required logs, native results, screenshots, bundles, proof artifacts, sizes, media types, digests, sensitivity, retention, and availability status |
| `missingOrPartialEvidence` | `R` | Structured missing/corrupt/stale/conflicting/late/truncated items, last trustworthy state, effect/residue uncertainty, and resulting blockers |
| `blockers` | `R` | Deterministically derived blocker codes and evidence refs; empty only for a complete proposed advisory `GO` |
| `decisionRuleRef` | `R` | Exact advisory rule/version bound to `harnessVersion` |
| `producerAdvisoryStatus` | `D/R`, enum | `GO`, `NO-GO`, or `INCOMPLETE`; `GO` requires complete valid lineage, all required passed results, no blockers, and satisfied cleanup/residue obligations |
| `validationHandoff` | `R` | Exact authoritative reconstruction inputs and expected independent-validator version; contains no self-approval |
| `releaseAuthority` and deployment authorization | `F` | No field may grant, waive, or imply release/deploy authority |

The artifact reconstructs product/harness versions, attempt/environment identity,
requested and selected scope, pack/check versions, prerequisites, full timeline,
every result/failure, cancellation/termination, cleanup/residue, attachments,
missing evidence, and the producer's advisory status. `INCOMPLETE` is mandatory
for interrupted finalization, missing terminal evidence, unknown termination or
residue, unsupported identity, or required truncation.

Independent validation occurs after emission and produces a separate immutable
validation report/reference; it never edits the final artifact. A schema-valid
final artifact may still be qualification-invalid. Even independently validated
advisory `GO` remains non-authoritative during migration and cannot satisfy or
override current deploy admission merely because the artifact exists.

## Canonical JSON Comparison and Hashing

### Structural Equality Versus Canonical Bytes

Semantic structural equality and hash equality answer different questions:

- **Semantic structural equality** compares schema-valid JSON values by their
  declared meaning. Object member order is irrelevant. Arrays are compared in
  order when order is meaningful; set-like arrays are valid only in their
  schema-declared canonical sort order. Expected and observed product values use
  this comparison or a domain contract explicitly referenced by the test pack.
- **Canonical byte equality** applies the `RQ-C14N-1` profile below and then
  compares/hashes the resulting bytes. It establishes immutable artifact
  identity and tamper detection, not product correctness.

Raw `JSON.stringify` output, insertion order, textual substring matching,
pretty-printing, whitespace, or property traversal order MUST NOT decide
semantic equality. This directly prevents the retained JSON-order failure at
audit `:835,849-865` and follows M13.

### `RQ-C14N-1` Profile

1. Input MUST be valid UTF-8 JSON with no byte-order mark. A duplicate object key
   is rejected during raw parsing before an ordinary in-memory JSON object can
   discard it.
2. `schemaName` and exact `schemaVersion` are present in the canonical content
   and therefore participate in every digest.
3. Object keys are valid Unicode scalar sequences, MUST already be Unicode NFC,
   and are serialized in ascending Unicode scalar-value order. Validators reject
   non-NFC input rather than silently changing authoritative bytes.
4. String values also MUST be valid NFC Unicode. Canonical output uses UTF-8,
   escapes only quotation mark, reverse solidus, and required control characters,
   and uses one defined lowercase escape form. Visually similar but different
   scalar sequences are not equal.
5. Canonical numeric values are integers in the inclusive interoperable range
   `-(2^53-1)` through `2^53-1`, serialized in base ten with no leading plus,
   leading zero, decimal point, exponent, or negative zero. Decimal business
   values, arbitrary precision values, and identifiers that look numeric are
   schema-validated canonical strings with an explicit unit/format.
6. `NaN`, positive/negative infinity, comments, undefined values, trailing
   commas, and all other non-standard JSON values are rejected.
7. Boolean values are exactly `true` or `false`. `null` and a missing member are
   distinct; `null` is forbidden unless an individual field explicitly permits
   it. Optional unknown/inapplicable fields are absent.
8. Timestamps use exactly UTC RFC3339 form with milliseconds,
   `YYYY-MM-DDTHH:mm:ss.sssZ`. Offsets, local time, omitted milliseconds, invalid
   dates, and leap-second spellings are rejected. Durations and sequence values
   are integer fields, not timestamps encoded through prose.
9. Arrays preserve declared semantic order. A schema-defined set/map projection
   MUST be sorted by its declared stable key before serialization; the generic
   canonicalizer never guesses that an array is a set or sorts assertion/event
   order.
10. No insignificant whitespace is emitted. Member separators and structural
    tokens have one exact representation.
11. The artifact `contentDigest` is SHA-256 over the complete canonical artifact
    with the entire top-level `contentDigest` member omitted. `artifactId`, schema
    version, identities, timestamps, sensitivity, redaction, and retention fields
    remain in the preimage. The stored digest is lowercase hexadecimal.
12. An attachment digest is SHA-256 over the exact raw external bytes, not a
    decoded/reformatted rendering. Its reference includes byte size, media type,
    digest algorithm/value, sensitivity, retention class, and producer. A path,
    URL, ETag, filename, or screenshot label is never a digest substitute.
13. A logical multi-part artifact lists ordered chunk references and hashes a
    canonical manifest of their raw-byte digests/sizes; concatenation or omitted
    chunks cannot be inferred. Truncation/overflow remains explicit evidence and
    never produces a valid full-result digest.

Canonical comparison is versioned by `canonicalizationProfile=RQ-C14N-1`. A
profile change is a breaking evidence-definition change, changes
`harnessVersion`, and requires the schema-evolution and certification process
below. The initial SHA-256 choice preserves the useful existing hash primitive
identified at audit CP05 `:1063` while fixing the current failure to re-read and
validate referenced log bytes at audit `:375-382,537-548`.

## Independent Validation Design

### Deterministic Validation Sequence

The independent validator receives immutable candidate/harness/pack manifests,
the requested change/operation facts, target policy, selection policy and
registry, the six-schema graph, and referenced attachments from authorities
other than the final producer's summaries. It performs the following ordered
steps and stops qualification acceptance on any error while continuing only
read-only diagnostics that cannot alter the graph:

| Step | Deterministic validation | Failure treatment |
| ---: | --- | --- |
| 1 | Acquire exact bytes and record source/location, size, and acquisition digest without trusting filenames or embedded decisions | Missing/unreadable bytes become explicit incomplete evidence |
| 2 | Parse with duplicate-key detection; reject invalid UTF-8, non-standard JSON, forbidden Unicode/numbers/nulls, or prohibited secret material | Structural rejection; preserve raw digest and parser error location |
| 3 | Require exact supported `schemaName`, `schemaVersion`, and `RQ-C14N-1` profile | Unknown or deprecated-disallowed version fails closed; no best-effort coercion |
| 4 | Validate common envelope and owning field-level schema, conditional requirements, enumerations, forbidden fields, and terminal-state rules | Schema-invalid; no qualification decision from the artifact |
| 5 | Recompute canonical bytes and `contentDigest`; validate every identity/manifest digest from its authoritative inputs | Digest or identity mismatch is corruption/conflict and blocks the chain |
| 6 | Build the artifact graph by ID/digest; verify parentage, attempt/plan/candidate/harness/pack equality, environment applicability, uniqueness, and no cycles | Cross-attempt, stale, duplicate-conflicting, orphan, or cyclic lineage is rejected |
| 7 | Independently reconstruct requested scope and selected checks from authoritative change/operation/request/schedule facts plus exact policy/registry versions | Producer omission/addition or self-declared scope mismatch rejects the plan/final evidence |
| 8 | Validate plan checks, origins, dependency expansion, stable topological order, prerequisite/effect/capability declarations, timeout reserves, and cleanup obligations | Unknown/unmapped input, cycle, undeclared effect, or unsafe obligation fails plan acceptance |
| 9 | Validate gap-free event sequence where complete, producer ordering, legal Sprint `1C` transitions, command/effect binding, deadlines, cancellation, late evidence quarantine, and terminal proof | Missing/impossible/out-of-order transition or unproved termination blocks completion |
| 10 | Require exactly one accepted result per selected check; verify pack/native authority, assertion/result mapping, terminal events, output bounds, attachments, and effects | Missing/conflicting/stale/truncated/wrong-pack result is explicit non-success |
| 11 | Require exactly one primary failure for every result state that needs it; recompute classification rule, contract/evidence basis, sufficiency, contributing-condition separation, and mandatory-stop result | Unsupported class or LLM/narrative-only basis rejects the failure record; insufficient basis becomes `unclassified` |
| 12 | Reconstruct every cleanup obligation from plan/effect/mutation evidence; prove execution termination, cleanup ownership/actions, independent residue assertions, and zero/remaining/unknown residue | Cleanup return alone never passes; failed/interrupted/unknown residue blocks `GO` |
| 13 | Fetch every required attachment and compare raw bytes, size, media type, digest, sensitivity/redaction and retention metadata; identify missing/truncated replacements | Missing/digest-mismatched attachment rejects completeness; a derivative cannot replace restricted original evidence |
| 14 | Check freshness/validity windows, prior consumption, replay relationships, same-ID variants, late results, source/harness drift, and cross-attempt/environment substitution | Stale/replayed/conflicting evidence is quarantined and cannot be relabelled current |
| 15 | Independently recompute completeness, blockers, and advisory status from reconstructed scope and graph; compare with producer summary | Decision mismatch rejects final evidence even if every document is schema-valid |
| 16 | Emit a separate immutable validation report with validator identity/version, exact input graph digest, `accepted` or `rejected`, error list, and reconstructed advisory status | Report never edits producer evidence or grants release authority |

Validation MUST collect all deterministically discoverable structural/graph errors
without executing product or environment work. It MUST NOT fetch a substitute
from an ambient location, repair malformed evidence, refresh stale proof,
reinterpret native assertions, perform cleanup, or ask an LLM to fill a gap.

### Three Separate Decisions

| Decision | Meaning | Who owns it | What it cannot imply |
| --- | --- | --- | --- |
| Schema validity | One artifact conforms to its exact supported field/encoding contract | Independent schema validator | Complete lineage, product pass, cleanup, or `GO` |
| Qualification validity | The independently reconstructed six-schema graph, identities, scope, lifecycle, results, failures, cleanup, attachments, and advisory decision are complete and correct | Independent evidence validator | Release admission or deployment authority during migration |
| Release admission | The currently approved release gate or a later explicitly approved cutover policy authorizes deployment | Current admission authority; future change only through Sprint `1G` approval | That any schema-valid or qualification-valid advisory artifact can self-promote |

The validator does not trust `requiredChecks`, `selectedScope`, cleanup claims, or
the producer's advisory status as authority. This corrects the current validator
behavior documented at audit `:375-382,537-548` and implements Sprint `1B`
independent-scope reconstruction at this document's `:943-968`.

## Schema Evolution and Compatibility

### Version Rules

1. Every schema uses Semantic Versioning and an exact, immutable version string.
   Draft prerelease identifiers are not accepted executable contracts.
2. A **major** change is required for a removed/renamed field, changed required or
   conditional rule, changed field meaning/type, changed canonicalization/hash
   preimage, changed decision/terminal invariant, changed enum value set, or any
   change an old validator could interpret differently.
3. A **minor** change may add an optional field whose absence preserves identical
   validation and decision semantics. Because unknown enum values fail closed,
   adding an enum value is breaking and therefore major unless the owning field
   was expressly defined as an extension namespace with non-authoritative use.
4. A **patch** change may clarify prose, correct examples, or tighten a validator
   bug to the already normative meaning without changing accepted bytes or
   outcomes. If outcomes can change, it is not a patch.
5. Any schema, canonicalization, validation, retention-rule, or compatibility
   implementation change changes `harnessVersion`, even when
   `productCandidateId` remains identical. An affected pack version changes only
   when its own evidence contract/binding changes.

### Producer and Validator Compatibility

- An accepted plan declares the exact version of each of the six schema names,
  the canonicalization profile, digest algorithm, producer versions, and minimum
  independent-validator compatibility set.
- A producer emits only the exact version declared by the plan. It MUST NOT
  negotiate or downgrade after attempt opening.
- A validator maintains an explicit allowlist of exact versions and validates
  according to the artifact's version-specific rules. Unknown versions fail
  closed; validators do not coerce them to the nearest known version.
- Different schema names may have different semantic versions in one declared
  evidence-family tuple. Within one attempt, two artifacts with the same schema
  name MUST use the one exact plan-declared version. Undeclared mixed versions
  reject the attempt.
- A new validator may read an older version only when that version remains
  explicitly supported and its complete rules are retained. An old validator
  never accepts a newer version by ignoring unknown fields.

### Migration, Deprecation, and Certification

- Historical evidence is immutable. A migration creates a new derivative
  artifact with a new ID/digest, names the transformation/version, and links the
  original. It cannot replace original bytes, repair an attempt, refresh
  environment proof, or become release evidence for a different candidate.
- A version is deprecated only through a versioned compatibility policy that
  names producer stop date, validator read period, retention impact, and
  replacement version. Previously accepted evidence remains interpretable for
  its recorded admission decision throughout its approved retention period.
- Before a new version becomes accepted, Phase 2 or the applicable later phase
  must prove canonical example vectors, known-valid and every deliberate invalid
  case, duplicate-key/corruption/stale/cross-attempt cases, old/new validator
  compatibility, deterministic repeated bytes/digests, interruption/partial
  evidence, and no unexpected advisory-decision change.
- Promotion also requires the controlling repeated-run standard and explicit
  review. Merely parsing one example or adding executable schema files cannot
  make a version accepted.
- Rollback selects a previously certified full evidence-family tuple and a new
  `harnessVersion`/attempt. It never emits an older schema version under newer
  semantics or changes an open attempt in place.

## Evidence Retention Decision Package

### Retention Objectives and Classes

Retention must preserve auditability, interrupted-attempt diagnosis, advisory
comparison, deployment provenance, and rollback evidence without making a local
workspace, Git repository, or unlimited sensitive archive authoritative. Every
artifact/attachment selects one versioned retention class; exact durations are
reserved for Bill.

| Retention class | Included evidence | Value and sensitivity treatment |
| --- | --- | --- |
| `release-core` | Accepted/rejected plans, final evidence, validation reports, failures, cleanup/residue, deployment manifests, admission-consumption records | Highest audit/rollback value; immutable durable original plus indexed metadata; least-privilege access |
| `attempt-diagnostic` | Execution events, check results, structured native results, stdout/stderr chunks, remote-command evidence | Needed for classification and replay diagnosis; redact prohibited data at source, restrict access by sensitivity |
| `sensitive-media` | Screenshots, browser traces, PDFs, request/response captures, identity/provider proofs containing personal or operational detail | Separate restricted storage/access log; redacted derivative for routine review; original retained only under approved necessity/duration |
| `build-and-rollback` | Temporary bundles, build outputs, provenance/rollback artifacts | Retain durably only when referenced by deployment/rollback contract; unreferenced temporary copies expire after verified handoff |
| `rejected-or-interrupted` | Malformed/rejected inputs, partial event chains, termination failures, incomplete cleanup/residue, corrupt/conflicting variants | Retain enough exact bytes to diagnose and prove the stop; never discard merely because no final artifact exists |
| `ephemeral-cache` | Local downloads, canonicalization scratch, working bundles, render cache | Non-authoritative and safely recreatable; deleted by local owner only after durable digest-verified handoff or explicit abandonment record |

Deletion and redaction are controlled operations. The retention policy MUST name
the evidence owner, storage owner, access authority, legal/security hold
authority, deletion approver, deletion proof, and relationship between original
and derivative. Expiry never makes stale evidence current and never erases an
admission record's digest/reference.

### Options

| Option | Audit/rollback value | Cost and operations | Sensitivity/immutability/discoverability | Ownership and migration effect | Assessment |
| --- | --- | --- | --- | --- | --- |
| R1: current local/ignored filesystem only | Weak: vulnerable to workspace cleanup, interrupted final writes, and inaccessible historical paths | Lowest immediate cost, highest manual recovery burden | Poor immutability/discoverability/access control; conflicts with audit `:752-757,944-968` | Simple admin locality but no durable authority | Rejected as sole retention |
| R2: commit evidence into product or harness Git repositories | Strong byte history for small text, poor for large/sensitive artifacts | Repository growth, cloning, history-removal and binary burden | Broad replication and difficult privacy deletion; evidence could contaminate source identity without strict roles | Cross-repo coupling and candidate/harness ambiguity | Rejected as primary store |
| R3: provider/CI run artifacts with built-in expiry | Convenient attempt linkage and modest setup | Expiry and access depend on the execution provider; difficult for local/manual attempts | Discoverable per run but not necessarily immutable, searchable across attempts, or durable for rollback | Couples evidence lifetime to CI/provider, while current work is not exclusively CI | Useful cache/handoff, not sole authority |
| R4: immutable content-addressed object storage plus searchable metadata catalog and local ephemeral cache | Strongest complete/partial graph preservation, deduplication, rollback lookup, and admission trace | New storage, index, access, lifecycle, monitoring, and cost ownership | Supports immutability/hold, sensitivity tiers, access logs, redacted derivatives, digest lookup; backend controls must be proved | Fits O1 admin-owned evidence authority without putting evidence in product identity; location remains outside repos | **Recommended architecture** |
| R5: durable object storage without catalog | Strong byte durability, weaker discovery and completeness review | Lower service surface than R4 but high manual lookup/lineage burden | Immutability possible; poor cross-attempt queries and deletion/hold governance | Simpler first step but catalog later risks another migration | Viable constrained alternative, inferior for validator reconstruction and operations |

### Recommendation and Reserved Decision

Adopt R4 as the architecture direction: immutable content-addressed durable
storage for original bytes, a separately queryable metadata catalog keyed by the
five identities/artifact digest, and a local cache that is never authoritative.
The store and catalog remain logically separate from producers; independent
validation re-reads durable bytes and recomputes hashes. Deployment manifests and
admission-consumption records use `release-core`; interrupted/rejected attempts
are retained rather than disappearing because final assembly failed.

This sprint does **not** choose a provider, bucket/service, deployment topology,
encryption/key implementation, numeric duration, cost envelope, detailed access
roles, legal hold period, or deletion schedule. R4 and R5 have materially
different operating cost/discoverability, while duration choices have material
privacy, audit, and cost consequences. Bill must approve the durable backend,
duration by retention class, deletion/hold authority, and operating owner before
Phase 1 completes in Sprint `1G`. That decision does not block documentation-only
Sprint `1E`; rejecting the R4 direction would require a bounded architecture
update before implementation scope is approved.

## Sprint 1D Verification Matrix

### Identity and Lineage Requirements

| ID / accepted requirement | Owning schema or validator rule | Required evidence | Negative case | Later implementation/certification proof |
| --- | --- | --- | --- | --- |
| V01 / common identity rules | Common envelope; validation steps 3-6 | Exact identity-definition versions, manifests, producer and recomputed digests | Missing/unmapped/conflicting role or release-label-only identity | Phase 2 canonical identity fixtures; role-manifest negatives before exact scope approval |
| V02 / `productCandidateId` | Plan, all attempt descendants, final; identity validator | Sorted component/product/dependency/migration manifest refs and aggregate digest | Harness-only byte changes candidate ID or child substitutes candidate | Phase 2 product-only/harness-only/mixed change vectors |
| V03 / `harnessVersion` | Plan, all descendants; identity/schema validator | Kernel/schema/validator/registry/adapter/pack role digests and exact family tuple | Schema/parser/fixture change leaves harness version unchanged | Phase 2 changed-harness negative and stable-product proof |
| V04 / `attemptId` | Event, result, failure, cleanup, final; lineage validator | One post-plan allocated ID and one accepted plan binding | Same ID with different plan, retry, candidate, or environment lineage | Phase 2 uniqueness, replay, retry, and finalization-reassembly cases |
| V05 / `environmentIdentity` | Event/result/failure/cleanup/final conditional refs; capability validator | Fresh applicable raw-proof digest after effective configuration plus policy/freshness | Name-only/stale/wrong-target proof or effect before proof | Phase 2 synthetic proof freshness; Sprint `1E` adapter contract certification |
| V06 / `testPackVersions` | Plan selected map; every descendant; pack validator | Exact selected pack IDs/version digests, registry, native binding, dependency refs | Unselected/substituted/stale pack or same attempt mixed version | Phase 2 pack substitution fixtures; Sprint `1F` pack-policy proof |
| V07 / L01 one attempt and plan | Common parent refs; graph validation step 6 | Same `attemptId` and accepted plan digest on every descendant | Cross-plan child or missing attempt link | Phase 2 cross-attempt/cross-plan rejection |
| V08 / L02 candidate/harness cannot upgrade | Common envelope; identity recomputation step 5 | Exact plan-equal candidate and harness refs | Child carries newer source/harness identity | Phase 2 fingerprint-drift and child-substitution negatives |
| V09 / L03 exact selected pack | Event/result/failure/cleanup; steps 7 and 10 | Selected check instance and pack version on every pack-scoped artifact | Result from available but unselected pack | Phase 2 unknown/unselected pack negative |
| V10 / L04 proof precedes effect | Plan gates; event sequence; steps 8-9 | Environment proof/pass sequence lower than admitted dispatch/mutation sequence | Fixture/mutation event before or after failed proof | Phase 2 failed prerequisite; Sprint `1E` effect-admission proof |
| V11 / L05 every output hash-linked | Event stream/attachment refs, result/final index; steps 5 and 13 | Raw-byte digest, size, media type, producer and producing event/result | Missing log, changed screenshot, path-only artifact, silent truncation | Phase 2 missing/truncated/corrupt attachment vectors |
| V12 / L06 deterministic event ordering | Execution event; step 9 | Gap-free attempt sequence when complete, producer sequence and parent refs | Gap, duplicate conflict, late accepted result, out-of-order transition | Phase 2 sequence mutation and duplicate/late tests |
| V13 / L07 result for every selected check | Plan, check result, final; steps 7 and 10 | Exactly one terminal or explicit non-success result per selected check | Omitted check treated as pass or conflicting terminal results | Phase 2 missing/conflicting result cases |
| V14 / L08 one primary failure | Check result/failure/final; step 11 | Exactly one required failure ref and one primary enum; contributors separate | Two primary classes, no failure, or exit-code-only product class | Phase 2 classification plumbing and multi-cause negatives |
| V15 / L09 cleanup/residue explicit | Plan obligation, result mutation state, cleanup result, final; step 12 | Applicability, cleanup status, verifier, residue decision including unknown | Mutation-capable result omits cleanup or converts unknown to clean | Phase 2 cleanup-required/failure/unknown cases; Sprint `1E` contracts |
| V16 / L10 termination before cleanup | Event and cleanup; steps 9 and 12 | Whole-tree/remote terminal proof sequence precedes cleanup start; validated recovery identity | Parent exits while descendant live; cleanup starts or switches target | Phase 2 forced termination/termination-failure; Sprint `1E` adapter proof |
| V17 / L11 complete lineage for `GO` | Final evidence; steps 6-15 | Complete identities, scope, results, failures, attachments, cleanup and zero residue | Producer emits `GO` with missing log/result or residue unknown | Phase 2 omission/tamper and decision-recomputation cases |
| V18 / L12 interruption remains incomplete | Event, result, cleanup, final completeness | Last trustworthy event/mutation/termination/cleanup state and enumerated missing evidence | Interrupted attempt becomes pass or disappears without final artifact | Phase 2 interruption during execution/cleanup/finalization |
| V19 / L13 immutable correction lineage | Common digest/related refs; steps 5-6 and 14 | Original and derivative IDs/digests plus transformation/replacement relationship | In-place edit, last-write-wins duplicate, redaction replacing original | Phase 2 conflicting duplicate and derivative tests |
| V20 / L14 admission consumption cannot relabel | Final related refs and later admission record; step 14 | Exact evidence digest, candidate, target, attempt and consumption purpose | Replay same evidence as another attempt/candidate or refresh expiry | Sprint `1G` advisory/admission replay and rollback design proof |

### Kernel Lifecycle Requirements

| ID / Sprint 1C requirement | Owning schema or validator rule | Required evidence | Negative case | Later implementation/certification proof |
| --- | --- | --- | --- | --- |
| V21 / invocation and plan load | Qualification plan snapshots; steps 1-4 | `INVOCATION_RECEIVED` source plus `PLAN_LOADED` snapshot or `REJECTED_BEFORE_ATTEMPT` evidence | Malformed/unreadable plan opens attempt or gains defaults | Phase 2 malformed plan and zero-dispatch proof |
| V22 / identities bound and plan validated | Plan; identity/plan validators steps 5 and 8 | `IDENTITIES_BOUND` then `PLAN_VALIDATED`, exact reports/digests | Missing/stale identity or self-validation continues | Phase 2 fingerprint drift and validator-independence fixtures |
| V23 / selection, ordering, attempt open | Plan and first event; steps 7-9 | `SELECTION_RESOLVED`, `DEPENDENCIES_ORDERED`, then durable `ATTEMPT_OPENED` | Unknown check/cycle/nondeterministic order or dispatch before attempt event | Phase 2 unknown-check, dependency-cycle, stable-order tests |
| V24 / prerequisites and environment proof | Plan gates/events/results; steps 8-9 | `PREREQUISITES_EVALUATING`, conditional `ENVIRONMENT_PROVING`, `PREREQUISITES_PASSED` or `PREREQUISITE_FAILED` | Partial pass, name-only target, or later dependent mutation | Phase 2 failed-prerequisite case; Sprint `1E` capability proof |
| V25 / pending, ready, and blocked checks | Plan order, events, results; steps 8-10 | Legal `CHECK_PENDING` -> `CHECK_READY` or `CHECK_BLOCKED`, with cause/closure | Blocked check dispatches or is omitted/reported passed | Phase 2 prerequisite/dependency blocking cases |
| V26 / admitted dispatch and running proof | Plan/event; step 9 | Exact command/adapter/cwd/env/effect refs for `CHECK_DISPATCHED` then process/job proof for `CHECK_RUNNING` | Raw shell/ambient env, undeclared effect, second dispatch, or mutation before running | Phase 2 synthetic dispatch admission; Sprint `1E` adapter contract |
| V27 / completed or failed result | Event and check result; steps 9-11 | `CHECK_COMPLETED` or `CHECK_FAILED`, valid native result, terminal event, mutation state and failure where required | Exit zero without result, exit code auto-classification, or late pass | Phase 2 child-nonzero, missing/corrupt/late-result cases |
| V28 / timeout, cancellation, termination | Events/result/failure; steps 9 and 11 | `CHECK_TIMED_OUT` -> `CHECK_CANCELLING` -> `CHECK_CANCELLED` or `TERMINATION_FAILED`, deadlines/actions/proof | Timeout treated terminal, parent-only kill, cleanup racing live work | Phase 2 startup/execution/idle/cancel/forced-tree/termination-failure cases |
| V29 / cleanup unnecessary | Result and cleanup; step 12 | `CLEANUP_UNNECESSARY` and `RESIDUE_UNNECESSARY` only with proved no mutation/effect | Missing mutation event interpreted as no mutation | Phase 2 declared-read-only versus may-have-mutated negatives |
| V30 / cleanup required lifecycle | Events/cleanup; step 12 | `CLEANUP_REQUIRED`, `CLEANUP_RUNNING`, then `CLEANUP_SUCCEEDED`, `CLEANUP_FAILED`, or `CLEANUP_INTERRUPTED` with owner/actions | Missing owner, undeclared action, warning downgrade, implicit second cleanup | Phase 2 cleanup success/failure/interruption cases; Sprint `1E` ownership |
| V31 / independent residue lifecycle | Cleanup/final; steps 12-13 | `RESIDUE_PROVING` then `RESIDUE_PROOF_COMPLETED` or `RESIDUE_PROOF_FAILED`, structured assertions | Cleanup return alone proves zero or verifier is cleanup producer | Phase 2 residue marker cases; later adapter/pack independence certification |
| V32 / attempt finalization | Event/final; steps 6 and 15 | All nodes terminal/blocked before `ATTEMPT_FINALIZING`; `FINAL_EVIDENCE_EMITTED` or `FINALIZATION_INTERRUPTED` | Final omits selected check or interruption triggers re-execution | Phase 2 finalization interruption and deterministic reassembly |
| V33 / independent validation and advisory | Final plus separate validation report; steps 15-16 | `INDEPENDENT_VALIDATION_RUNNING`, `VALIDATION_ACCEPTED` or `VALIDATION_REJECTED`, then attributable `ADVISORY_RESULT_AVAILABLE` | Kernel self-approves, rejected producer `GO` exposed trusted, or advisory deploys | Phase 2 tamper/omission validation; Sprint `1G` admission isolation |
| V34 / no stateful work after failure | Plan effect declarations, event sequence, final blockers; steps 8-9 | First failure sequence and proof all later dispatched work is eligible independent read-only or cleanup | Later stateful fixture after failed prerequisite | Phase 2 exact historical-pattern negative; Sprint `1E` effect enforcement |
| V35 / effects cannot broaden | Plan/event/result/failure; steps 8-11 | Requested effect set is subset of declared set; actual observed set reconciled | Read-only check requests process/DB/AWS/filesystem mutation | Phase 2 undeclared-effect synthetic adapter case |
| V36 / bounded process and output | Plan budgets, events, result/attachments; steps 8-10 and 13 | Startup/execution/idle/grace/force/cleanup/final/total limits and output byte boundaries | Unbounded wait, exhausted cleanup reserve, flattened/truncated success | Phase 2 deadline and overflow matrix; Sprint `1E` mechanisms |
| V37 / no implicit retry | Attempt/plan lineage and events; steps 6 and 14 | New `attemptId` for execution/cleanup retry; finalization-only reassembly uses identical immutable graph | Hidden second dispatch or cleanup under same attempt | Phase 2 retry rejection and reassembly byte-equality proof |
| V38 / deterministic repeated evidence | All six schemas; canonicalization and steps 5/15 | Same immutable graph yields byte-identical final bytes/digest and decision | Map insertion, clock-at-read, or traversal order changes output | Phase 2 repeated assembly/validation certification |

The matrix owns every Sprint `1B` identity and L01-L14 invariant and every Sprint
`1C` state family, effect/process rule, interruption path, and deterministic
finalization requirement. It does not claim current implementation support.

## Sprint 1D Decision and Verification Record

| ID | Evidence / accepted invariant | Chosen rule | Rejected alternative | Tradeoff / reserved point | Later verification |
| --- | --- | --- | --- | --- | --- |
| 1D-D01 | M09; L01-L14; audit `:362-393` | Exactly six immutable typed schemas share one common envelope and hash-linked graph | One mutable final JSON or one untyped event/log stream | More artifacts and references, but partial attempts survive | Phase 2 graph completeness and interrupted-attempt cases |
| 1D-D02 | Sprint `1C` pre-attempt lifecycle | Plan snapshots are immutable and `attemptId` is forbidden until accepted plan/order opens an attempt | Mutate one plan or allocate attempt before validation | Multiple plan artifacts; honest rejection lineage | Phase 2 malformed/unknown/cycle cases prove zero attempt dispatch |
| 1D-D03 | M02-M03; Sprint `1B` identity model | Applicable five identities are explicit envelope bindings; absence before binding is explicit, never placeholder/null | Derive identities from ancestor path/release label | Redundant fields improve conflict detection | Phase 2 child substitution and harness-only change cases |
| 1D-D04 | M13; r31 history at audit `:835,849-865` | Separate schema-aware structural equality from `RQ-C14N-1` byte hashing | Raw serialization equality or substring matching | Strict canonical subset rejects otherwise parseable JSON | Canonical vectors, reordered-object and substring negatives |
| 1D-D05 | Current SHA-256 primitives/audit CP05 `:1063` | SHA-256 over canonical bytes with `contentDigest` omitted from preimage; external files hash raw bytes | Filename/path/ETag, self-referential digest, or combined flattened output | Algorithm migration needs major/profile change | Phase 2 digest/tamper/chunk tests |
| 1D-D06 | L06; Sprint `1C` serial lifecycle | Kernel assigns a gap-free monotonic attempt sequence; clocks are observations only | Timestamp ordering or per-process order alone | Central sequence is a kernel responsibility | Phase 2 reordered/gap/late event cases |
| 1D-D07 | M16; Sprint `1B` product-assertion authority | Check result preserves native semantic authority; validator checks binding/completeness only | Kernel/validator reinterpret assertions | Native result formats need pack contracts later | Sprint `1E/1F` interfaces; Phase 2 wrapper fixtures |
| 1D-D08 | M10; plan failure classes | Failure record has exactly one primary class, explicit sufficiency and contributors; `unclassified` stops | Multi-class arrays, generic exit-code or LLM authority | More failures remain intentionally unclassified | Phase 2 classification-rule and insufficient-evidence cases |
| 1D-D09 | M08/L09-L10; audit `:384-393,919-921` | Cleanup action and independent residue decision are separate facts; termination precedes cleanup | Cleanup return implies clean or cleanup races live job | Requires independent verifier capability | Phase 2 cleanup/residue/termination cases; Sprint `1E` ownership |
| 1D-D10 | M01/M18; authority matrix | Final evidence carries only producer advisory status; independent validation and release admission remain separate | Schema-valid final artifact self-authorizes | Additional validation artifact/process | Phase 2 decision reconstruction; Sprint `1G` admission separation |
| 1D-D11 | Audit `:375-382,537-548` | Validator independently reconstructs scope and re-reads every required attachment | Trust final's `requiredChecks` and logged hash strings | More authoritative inputs/storage reads | Phase 2 omitted-scope and changed-log cases |
| 1D-D12 | M20; audit `:752-757,944-968` | Recommend R4 durable immutable content store plus catalog and non-authoritative local cache | Local-only, Git-primary, or CI-expiry-only retention | New operating/cost surface; backend/durations reserved for Bill | Sprint `1G` decision and later store certification |
| 1D-D13 | M03 and change table | Every schema/canonicalization/validator/retention-rule change changes `harnessVersion` | Treat schema as external docs that do not version harness | More harness versions, correct identity lineage | Phase 2 version-change vectors |
| 1D-D14 | L13 and retention sensitivity | Redaction creates a linked derivative; original authoritative bytes remain immutable/restricted | Rewrite evidence in place or retain secrets indefinitely | Requires access/hold/deletion governance | Phase 2 derivative integrity; Bill retention decision |
| 1D-D15 | L12 and Sprint `1C` finalization | Partial/interrupted evidence is valid diagnostic evidence but qualification-invalid and never `GO` | Emit nothing until success or synthesize completed final | More partial records, far better diagnosis | Phase 2 execution/cleanup/finalization interruptions |
| 1D-D16 | Sprint `1B` version authority | Exact per-schema versions are plan-bound; unknown/mixed undeclared versions reject; migration creates derivatives | Best-effort forward compatibility or in-place migration | Explicit compatibility maintenance | Phase 2 old/new producer-validator compatibility matrix |

No Sprint `1D` decision changes the accepted identity, authority, O1 ownership,
kernel, lifecycle, testing strategy, or advisory boundary. The remaining Bill
decision is operational: durable backend and ownership, retention durations,
sensitivity/access roles, legal/security hold, deletion authority, and cost. It
must close by Sprint `1G` but does not block Sprint `1E` documentation design.

## Sprint 1D Files, Effects, and Verification

Examined:

- `docs/AGENTS.md` and its documentation, SQL, AWS, browser, and harness-sprint
  boundaries;
- the controlling plan's identity, failure, evidence, Phase 1/Phase 2,
  checkpoint, and Sprint Ledger sections;
- the accepted Phase 0 audit's evidence handoffs, lifecycle/residue ownership,
  validation and identity findings, retained-evidence coverage/gaps, historical
  transport/comparison/cleanup patterns, and control-plane dispositions; and
- the accepted target architecture's M01-M21, D01-D10, five-identity model,
  authority matrix, L01-L14, completeness/conflict/replay rules, O1 ownership,
  Sprint `1C` lifecycle, process/effect/cleanup model, and Phase 2 acceptance
  cases.

Changed only:

- this target-architecture document; and
- the controlling plan's checkpoint and Sprint Ledger.

Verification is documentation-only static review: exactly six named schema
drafts; required/conditional/forbidden/derived envelope fields; requested
field-level contracts and enums; canonicalization edge cases; the ordered
independent-validation sequence; semantic-version/compatibility rules; retention
option comparison; V01-V38 coverage of all accepted identities, L01-L14, and
Sprint `1C` requirements; decision traceability; scope/deferral language;
formatting; and final worktree state. No executable schema, validator, test,
build, qualification, workflow, environment, or storage operation is authorized
or performed.

One combined initial baseline read exceeded the display budget; the relevant
sections were already available through bounded reads and accepted exact
references. The first static assertion script also searched for three required
phrases with lowercase exact matching while the document used sentence-case
headings/wording. The corrected case-insensitive assertion completed without
changing the design. Both were explained read-only verification limitations,
not workflow failures. No unexplained failure, blocker, strategy conflict, or
course correction occurred.

Final worktree state: admin remains on `main...origin/main` with the pre-existing
modified `docs/AGENTS.md`,
`docs/ops/deployments/release-qualification-runbook.md`, and
`docs/planning/README.md`, plus the pre-existing untracked Phase 0 audit,
controlling plan, and target-architecture files. Sprint `1D` changed only the
target-architecture and controlling-plan files. Portal and shared remain clean
on `main...origin/main`. Intacct mock remains the non-Git directory established
in Phase 0 and was not re-probed. No pre-existing user change was reverted or
overwritten.

## Sprint 1D Completion Decision

Sprint `1D` is complete at the documentation-architecture level. The common
envelope, exactly six schema drafts, canonical comparison/hashing, independent
validation, schema evolution, retention decision package, and verification
matrix are complete without executable schema/validator work, adapter or pack
interface finalization, selection policy, migration design, implementation,
repair, storage operation, or environment access.

R4 is the recommended retention direction. The provider/backend, duration by
class, access/hold/deletion authority, operating owner, and cost remain an
explicit Bill decision required by Sprint `1G`; they do not block bounded
documentation-only Sprint `1E`. If Bill rejects R4 as the architecture direction,
the next prompt must authorize a bounded Sprint `1D` correction instead of `1E`.

Otherwise, the exact approval required for proposed next work is: **Bill
explicitly authorizes Sprint `1E` of Phase 1 to define documentation-only adapter
contracts and the SQL, JSON-use, process-control, browser-selector,
fixture-lifecycle, AWS-identity, environment-capability, and remote-transport
safety decisions, with no implementation, environment access, executable
schema/adapter, runner repair, or check migration.**

Sprint `1E` has not begun.

Bill subsequently accepted R4 as the architecture direction and authorized
Sprint `1E` exactly within the documentation-only boundary. The result follows.

## Sprint 1E Outcome

Sprint `1E` defines one common conceptual adapter contract, a closed versioned
capability/effect model, and safety contracts for process/build, filesystem,
local HTTP, browser, database, AWS/environment identity, remote transport, and
fixture/cleanup boundaries. Adapters own mechanics and attributable facts. They
do not own product semantics, check selection, overall failure classification,
release judgment, IAM policy changes, or LLM recommendations.

The design fits O1, R4, the five identities, the Sprint `1C` lifecycle, and the
Sprint `1D` six-schema evidence graph without changing them. It does not define
code-level APIs, executable adapters/schemas, product-pack contracts, selection
or maturity policy, migration, storage operations, or environment behavior.

## Common Adapter Contract

### Definition, Identity, and Authority

Every adapter is an immutable harness component defined by a validated adapter
manifest. The manifest conceptually contains:

- stable `adapterId`, semantic contract version, implementation-content digest,
  dependency-closure digest, and aggregate `adapterVersion`;
- exact `RQ-CAP-1` capabilities, target/environment classes, effect classes, and
  resource boundary forms it supports;
- operation declarations, required prerequisites, environment-proof kinds,
  preparation, timeout/cancellation/termination, cleanup, residue, and evidence
  obligations;
- supported Sprint `1D` evidence-family tuple, canonicalization profile, and
  attachment/output limits; and
- owner, independent validator, compatibility range, certification state, and
  unsupported-operation behavior.

Together these fields define command or operation admission without defining a
code-level API.

The adapter manifest and implementation contribute to `harnessVersion`. The
accepted plan binds the exact adapter version and requested subset of its
capabilities/effects. An adapter instance additionally binds the accepted plan,
`attemptId`, applicable `environmentIdentity`, selected pack/check, admitted
operation, budgets, and evidence stream. Discovery of installed software,
connectivity, credentials, a reachable service, or a resource never adds
authority.

An adapter must never infer authorization merely because credentials or
connectivity exist.

Authority remains separated:

| Authority | Owns | Must not own |
| --- | --- | --- |
| Plan/selection authority | Requested adapter capability, exact effect/resource scope, prerequisites, budgets, cleanup/residue obligations | Implementation details, ambient fallback, runtime effect broadening |
| Independent capability/environment validator | Fresh proof that the declared target and adapter capability are available and policy-compatible | Granting an undeclared effect or inferring authorization from connectivity |
| Kernel | Matching plan to adapter, dispatch admission, lifecycle/cancellation coordination, evidence collection | Product meaning, adapter-specific mechanics, cleanup semantics, release judgment |
| Adapter | Mechanical proof/preparation/execution/termination/cleanup action and factual evidence within admission | Selecting checks, changing plan/identity, interpreting product assertions, silently retrying/falling back |
| Product pack/native runner | Contract-specific inputs, fixtures, selectors, assertions, and semantic result | Expanding adapter effects or overall release admission |
| Independent residue/evidence validators | Termination, residue, identity, lineage, and evidence correctness | Performing cleanup, rewriting evidence, overriding native assertions |

### Common Operation Contract

The following are conceptual operations, not method names or code-level APIs.
Every operation produces Sprint `1D` execution events and either a complete
structured result or explicit partial/failure evidence.

| Operation | Inputs, preconditions, and authority | Permitted effects and evidence outputs | Terminal outcomes, cancellation, cleanup, and fail-closed behavior |
| --- | --- | --- | --- |
| `describe-capabilities` | Exact adapter manifest/version and registry trust; no attempt or environment authority | Read immutable manifest only; emit manifest digest/validation reference | `supported` or `invalid-manifest`; unknown/ambiguous capability rejects before plan acceptance |
| `prove-environment` | Accepted proof request, target/resource policy, effective non-secret configuration, adapter identity; only metadata/identity capabilities admitted | Exact declared identity/metadata reads; raw proof attachments, `environmentIdentityRef`, capability availability and freshness | `proved`, `denied`, `unavailable`, `conflicting`, or `incomplete`; no product/fixture effect, no fallback identity, cancellation closes proof resources |
| `prepare` | Accepted plan/check/adapter tuple, passed prerequisites, fresh environment proof where applicable, budgets, effect and cleanup declarations | Only declared reversible local preparation such as isolated workspace/port lease/session; emit baseline and readiness evidence | `prepared`, `rejected`, `failed`, or `cancelled`; preparation residue is owned even when execution never starts |
| `admit-operation` | Structured operation/command digest, exact inputs, capability/effect/resource tuple, identity, valid preparation, remaining total budget | Validation only; emit admission or denial event and exact rule inputs | `admitted` or `denied`; any unknown, missing, broadened, stale, or mismatched input produces zero execution effect |
| `execute` | One admitted operation, exact adapter/version, effective input/environment allowlist, remaining budgets, cleanup readiness | Only admitted capabilities/effects; emit dispatch/running/mutation/output/result/attachment events | `completed`, `failed`, `timed-out`, `cancelled`, or `termination-failed`; no implicit retry; mutation state and cleanup applicability always recorded |
| `cancel` | Idempotent kernel request naming cause, target process/job/session, grace/force deadlines, last accepted event | Cancellation request only, then adapter-declared graceful action; emit request/ack/late-output facts | Request is not termination; duplicate-identical request is idempotent; failure to acknowledge proceeds to bounded termination |
| `terminate` | Live/unknown operation identity, declared local tree/remote job/session ownership, forced-termination capability and deadline | Only declared termination effect; emit every signal/cancel call and independent terminal/unknown proof | `terminated` or `termination-failed`; cleanup is forbidden until terminal proof; unknown state stops new work and leaves residue unknown |
| `cleanup` | Predeclared obligation/owner, proved execution termination, exact effect ledger, bound environment/recovery identity, cleanup budget | Only declared recovery effects over attempt-owned resources; emit action events and cleanup result | `completed`, `failed`, `interrupted`, or `not-required`; no second implicit cleanup, no target switch, success does not establish zero residue |
| `prove-residue` | Proved cleanup/operation termination, declared residue scope, independent verifier identity/capability, exact environment proof | Declared read-only/metadata proof only; emit structured expected/observed assertions and attachments | `zero-residue`, `residue-found`, or `unknown`; verifier error cannot become clean; mutation disguised as proof is denied |
| `finalize-adapter-evidence` | Immutable operation events/results/failures/cleanup and attachment refs | Canonical evidence assembly only; no environment/process/resource effect | `complete`, `partial`, or `interrupted`; missing/conflicting evidence is retained and blocks adapter success |

For every operation, secret-bearing input is a reference to a separately governed
credential source, never evidence or an identity input. Input validation occurs
before preparation/effect. Cancellation may occur at every nonterminal operation;
the adapter must preserve the last trustworthy state and remaining cleanup
obligation. An unsupported capability, target class, operation, evidence version,
or termination/cleanup mode returns a structured `unsupported` denial with zero
effect. It never invokes a similar operation, alternate adapter, shell fallback,
broader credential, or best-effort interpretation.

### Common Terminal and Evidence Rules

1. Every dispatch names exact admitted capability tokens, effect classes,
   resource boundaries, adapter/pack versions, and environment proof.
2. Actual effects are reconciled with the declaration at mutation and terminal
   boundaries. An observed or requested superset is a fail-closed harness breach.
3. Adapter evidence distinguishes capability unavailable, permission denied,
   operation rejected, action started, partial effect, action terminal,
   termination proved, cleanup complete, and residue proved. These are never
   flattened into one exit string.
4. Timeout is an event, not a terminal outcome. Whole owned process tree, remote
   job, browser, socket, DB transaction/connection, or cloud request state must be
   proved terminal before cleanup that assumes quiescence.
5. An adapter supplies classification inputs and facts. The deterministic
   classifier produces the primary class under Sprint `1D`; adapters never label
   a product failure without a pack's verified contract/assertion evidence.
6. A missing, corrupt, stale, truncated, conflicting, late, wrong-attempt, or
   wrong-environment result remains non-success evidence. Exit zero or cleanup
   return cannot compensate for it.
7. No operation retries implicitly. A new execution or cleanup attempt requires
   a new `attemptId`; protocol duplicate suppression does not authorize replay.

## Capability and Effect Model

### Closed Vocabulary `RQ-CAP-1`

Only the following capability tokens exist in version `RQ-CAP-1`. A plan,
adapter, or pack using another token is invalid until a reviewed vocabulary
version adds it.

| Namespace | Closed capability tokens |
| --- | --- |
| Process | `process.spawn`, `process.observe`, `process.signal`, `process.terminate-tree` |
| Build | `build.generate-metadata`, `build.compile`, `build.package` |
| Filesystem/source | `filesystem.read`, `filesystem.hash`, `filesystem.create`, `filesystem.replace`, `filesystem.delete`, `filesystem.restore` |
| Local/external HTTP | `http.bind-loopback`, `http.probe-loopback`, `http.request-loopback`, `http.request-external` |
| Browser | `browser.launch`, `browser.navigate`, `browser.interact`, `browser.capture`, `browser.network-enforce` |
| Database | `database.identify`, `database.metadata-read`, `database.statement-read`, `database.transaction-write`, `database.rollback`, `database.cleanup`, `database.residue-read` |
| AWS/environment | `aws.identify`, `aws.permission-preflight`, `aws.control-read`, `aws.resource-write`, `aws.identity-manage`, `aws.resource-delete` |
| Remote transport | `remote.connect`, `remote.dispatch`, `remote.collect`, `remote.cancel`, `remote.terminate` |
| Fixture lifecycle | `fixture.create`, `fixture.mutate`, `fixture.cleanup`, `fixture.residue-prove` |

Capability presence says what an adapter implementation can mechanically attempt;
it does not say the plan admitted it, the environment provides it, credentials
permit it, or the operation is safe for the target.

### Effect Classes

| Effect class | Meaning | Minimum admission/cleanup consequence |
| --- | --- | --- |
| `read-only` | Reads metadata/content/state without intentionally changing target or local durable state | Fresh target proof where applicable; no mutation claim; any incidental durable write is undeclared effect |
| `local-write` | Creates/replaces/deletes local files, sockets, processes, build outputs, browser profiles, or cache | Exact allowed root/resource, baseline, owner, restoration/deletion, and local residue proof |
| `external-write` | Changes a remote service, database outside rollback-only scope, object store, HTTP target, or cloud resource | Explicit environment/resource allowlist, mutation event, cleanup/recovery owner, independent residue proof |
| `identity-management` | Creates, changes, authenticates as, or deletes a user/session/principal/credential-bearing identity | Exact pool/directory/account, suppressed/test identity contract, expiry/deletion and independent absence proof |
| `transactional` | Performs mutation within an explicitly owned transaction whose declared outcome is rollback or controlled commit | Transaction/connection owner, autocommit/commit rule, rollback/terminal proof, guarded residue verification |
| `destructive` | Deletes, irreversibly replaces, terminates, or otherwise removes a resource/process/state | Exact attempt ownership or separately reviewed target authority, preview where applicable, no broad pattern, deletion/termination proof and escalation |

Effect classes are labels, not a hierarchy that authorizes substitution. One
operation may require several exact classes, such as a local process with
`local-write` and `destructive` termination, or a fixture with `external-write`,
`identity-management`, and `destructive` cleanup. Possession of a higher-risk
capability never implies lower-risk or adjacent permission.

### Boundary, Proof, Negotiation, and Version Rules

The closed environment-class vocabulary is `local-isolated`, `dev`, `test`, and
`prod`. An adapter manifest declares an exact subset; support for one class never
implies another, and architectural support never authorizes environment access.
Pure source/evidence operations use `local-isolated`; any DEV, TEST, or PROD
operation additionally requires the exact environment proof and separately
authorized effect boundary applicable to that task.

Every effect declaration binds `targetClass`, applicable
`environmentIdentityRef`, resource kind, exact resource ID or admitted selector,
ownership rule, operation, maximum quantity/bytes/time, effect class, and cleanup
obligation. Wildcards, ambient current directories/accounts, provider defaults,
and credentials alone are not boundaries.

A configuration claim says what the caller requested. Capability proof is fresh,
raw, independently validated evidence that the exact adapter/runtime/target can
perform the precise operation class. Permission proof does not replace operation
admission, and successful connectivity does not prove permission.

Negotiation is deterministic intersection only:

1. the accepted plan requests exact capability/effect/resource tuples;
2. the registry proves the exact adapter version declares them;
3. fresh environment proof establishes availability and identity;
4. policy validates that tuple for the requested target; and
5. the kernel admits only the intersection, never a broader or alternate tuple.

Unknown, unmapped, unavailable, expired, denied, ambiguous, or broadened tuples
are rejected before effect. Changing the vocabulary, adapter capability manifest,
effect classification, boundary semantics, proof rule, or negotiation rule
changes `harnessVersion`. It changes a pack version only when the pack's declared
requirements or binding change. It never changes `productCandidateId` unless
shipped product source also changes.

## Process and Build Adapter Contract

### Admission and Preparation

The process/build adapter accepts only a structured declaration containing an
exact executable artifact/path and digest or a registry-approved tool identity,
an ordered argument array, exact working-directory authority, controlled
environment map, source/dependency fingerprints, input/output manifests, result
contract, and all timeout/effect/cleanup obligations.

This is the source and dependency fingerprint binding and pre-existing worktree
preservation boundary for every admitted process/build operation.

- Shell evaluation is disabled. Pipes, redirects, substitutions, wildcard
  expansion, command separators, and environment assignment are not inferred
  from a string. A required script is an explicit fingerprinted executable input
  with declared arguments, not ambient shell text.
- The working directory is an exact canonical allowed root or child path. Current
  shell directory, `PATH` search, user home, temporary-directory defaults, and
  repository sibling layout are not authority.
- Environment variables use a plan-declared allowlist with exact values,
  non-secret digests, or secret references. Undeclared inherited variables are
  removed. `PATH`, locale, timezone, proxy, cache, credential, build mode, and
  scenario selectors are explicit when they can change behavior.
- Executable, lockfile/dependency closure, product/harness input, generated-file
  baseline, and declared source-tree fingerprints are rechecked after preparation
  and before spawn. Drift rejects dispatch.
- Preparation creates an attempt-owned isolated output/temp/cache area and records
  its empty or baseline state. It does not modify a tracked/generated file unless
  that exact write and restoration obligation are declared.

### Execution and Evidence

The adapter records spawn request, resolved executable identity, ordered argv,
cwd, environment-key allowlist/digests, process and process-group/job identity,
start/ready/terminal times and sequences, exit code/signal, resource bounds,
source fingerprint checks, and every declared output.

`stdout`, `stderr`, structured result, logs, build manifests, bundles, and
generated metadata are separate hash-linked attachments. Missing output, wrong
media/format, stale pre-existing output, size overflow, truncation, digest
mismatch, ambiguous multiple candidates, or a result whose embedded identity
does not match the dispatch is non-success. The adapter never selects the newest
file, accepts a substring marker, or treats exit zero as a complete result.

Startup, execution, idle, graceful-shutdown, forced-termination, cleanup, and
total-attempt budgets are separate. The adapter owns the whole process tree or
platform job from spawn. Cancellation requests graceful shutdown, then forced
tree termination within the reserved budget. A parent exit is insufficient;
terminal evidence includes descendant enumeration/job emptiness and closed output
streams. Failure to prove it yields `TERMINATION_FAILED`, prohibits racing cleanup,
and records residue unknown.

### Build Preservation, Restoration, and Residue

Before a build, the adapter records the complete generated-file and output
inventory: existence, type, canonical path, digest, size, mode where relevant,
and whether each entry is pre-existing, tracked, ignored, generated, temporary,
or durable. Build outputs may be written only to declared isolated roots or
declared generated files.

After proved process termination, the owner restores every pre-existing file to
its exact baseline, deletes only attempt-created ephemeral outputs under the
declared root, and preserves/hash-links any R4-bound durable artifact. An
independent filesystem/source verifier then proves:

- every baseline path matches its original type/digest and no declared tracked
  or generated file is missing or changed;
- no undeclared file, process, socket, cache, or temporary output remains inside
  the residue scope; and
- retained bundle/manifest bytes match their evidence digests and are no longer
  dependent on the local cache.

Any missing baseline, untracked generated write, dirty worktree difference,
ambiguous output ownership, failed restoration, process residue, or corrupt
artifact blocks success. This preserves the useful admin build restoration while
closing the portal generated-file gap recorded at audit `:307-309,384-393,422-433`.

## Filesystem and Source-State Adapter Contract

### Roots, Paths, and Declarations

Every operation declares one or more absolute allowed roots and exact paths or a
canonically expanded admission manifest. Relative paths, `..`, empty paths,
device paths, home expansion, implicit current directory, and unexpanded globs
are forbidden authority.

For an existing path, every component and final target is resolved against its
declared root; symlink traversal outside the root is rejected. For a new path,
the existing parent is resolved and proved inside the root before creation. The
implementation must use root-anchored operations that cannot be redirected by a
symlink swap; inability to prove that property is an unsupported capability, not
permission for a path-prefix string check.

The admission record states operation (`read`, `hash`, `create`, `replace`,
`delete`, or `restore`), file type, maximum count/bytes, ownership, expected
precondition, effect class, and retention class. A directory-wide delete,
recursive wildcard, or delete of a pre-existing/unowned path is forbidden unless
separately declared as an exact destructive operation with reviewed ownership.

### Baseline and Artifact Classes

Before any write, the adapter records a baseline of every affected path and the
source/worktree identity: existence, regular/directory/symlink type, digest or
canonical directory manifest, size, relevant mode, Git tracked/ignored/untracked
classification, and clean/dirty policy result.

| Artifact class | Ownership and allowed lifecycle |
| --- | --- |
| Source/pre-existing | Read or explicitly restored only; never deleted/replaced without exact reviewed declaration and byte-preserving recovery |
| Generated | Declared generator/inputs/output path; snapshot/restore when in source tree; digest-linked when retained |
| Temporary | Attempt-owned under isolated root; cleanup mandatory after terminal process/action proof |
| Retained evidence | Immutable digest-linked R4 original or derivative; local copy is cache after verified durable handoff |
| Durable build/rollback | Retained only through declared provenance/rollback contract and R4 reference; local staging is not authority |

Reads and hashes verify stable file identity across open/read where the platform
supports it. A missing, changing, replaced, unreadable, wrong-type, or digest-
mismatched path produces exact partial evidence; it is not retried through an
alternate path.

### Drift, Restoration, Deletion, and Residue

Candidate or harness source drift before dispatch cancels admission. Drift during
an active read-only operation makes its evidence stale. Drift while an adapter
owns local effects triggers bounded cancellation/termination, then restoration
only of the adapter's declared writes; it never overwrites unrelated concurrent
user changes. If ownership cannot distinguish user drift from adapter effects,
restoration stops and reports a conflict requiring review.

Deletion authority is limited to exact attempt-created paths or a separately
validated recovery manifest. Each deletion is evidenced individually. An
independent verifier recomputes the source/worktree fingerprint, baseline file
digests, absence of owned temporary/generated residue, and durable handoff. A
cleanup return or absence from `git status` alone is not residue proof.

## Local HTTP Adapter Contract

### Endpoint, Startup, and Target Identity

Every service declaration binds protocol, exact host/address family, allocated
port, route/method allowlist, startup process declaration, candidate/build digest,
expected service identity challenge, readiness rule, health rule, network policy,
and shutdown owner.

Loopback is the default and is explicit (`127.0.0.1` or `::1` as declared).
Wildcard bind, LAN/public interface, implicit hostname resolution, HTTPS downgrade,
or an external service is forbidden unless the plan declares the corresponding
network/effect capability. A deterministic port allocator owns a lease tied to
the attempt and proves the port was unbound before spawn; finding an existing
listener is a conflict, never evidence that the desired service is ready.

Target identity combines the owned process/job, endpoint, candidate/build
fingerprint, and an adapter-issued per-attempt service challenge or equivalent
product-neutral identity response. A status code from an unrelated/stale process
cannot satisfy it.

### Readiness, Health, Requests, and Evidence

Readiness means the exact declared service can accept the permitted operation.
Health means its declared ongoing dependency/state checks pass. They are separate
bounded predicates with interval, maximum attempts, per-request deadline, total
deadline, acceptable responses, response size, and body schema/digest rules.
Connection refusal, wrong service identity, redirect, TLS/protocol mismatch,
unexpected route, oversized/malformed response, or health failure remains exact
evidence. Polling never continues beyond its budget and never falls back to a
different port or host.

Requests carry declared method, route template and resolved parameters, headers
allowlist/redaction, body digest/media type, expected response contract, and
effect classification. External DNS/network/service access is denied by default;
unexpected outbound connection evidence fails the adapter even if the product
assertion otherwise passes.

### Shutdown and Residue

Cancellation and normal completion request declared graceful server shutdown,
then force the owned process tree if required. Independent terminal proof covers
the process tree, closed listeners for every declared address, released port
lease, completed output streams, and absence of attempt-owned sockets/temp state.
The adapter then performs a bounded socket-release proof showing no service
answers with the attempt identity. A socket still bound, stale process, wrong
responder, or unproved release blocks cleanup and later port reuse.

## Browser Adapter Contract

### Mechanical Boundary and Semantic Authority

The browser adapter provides runtime mechanics and evidence only. The product
pack/native runner owns the workflow, roles, expected state, assertion meaning,
and whether an observed persistent transition satisfies the product contract.
The adapter cannot convert visible text, a screenshot, network success, or DOM
presence into a product pass.

Product packs and native runners retain semantic assertion authority.

Each declaration binds:

- exact browser engine/binary digest or approved distribution identity, version,
  driver/protocol version, launch arguments, headless mode, viewport, locale,
  timezone, clock policy, font/runtime dependencies, and isolated profile root;
- allowed origin(s), page/session identity, authentication identity reference,
  storage/cookie scope, fixture ownership, and external-network allowlist;
- product-owned root boundary and stable selector contract references;
- ordered navigation/action declarations with precondition, target selector,
  uniqueness requirement, expected persistent transition, and deadline; and
- screenshot/trace/console/network evidence, sensitivity/redaction, and R4
  retention class.

### Selectors, State, and Actions

A selector is valid only inside a product-owned boundary and must resolve exactly
as its contract declares. Stable product IDs/state attributes or scoped semantic
selectors are permitted. Page-global text, positional coincidence, body text,
hidden/sidebar copies, and transient toast presence/expiry are forbidden as
authoritative action targets or success conditions.

After navigation, rerender, or asynchronous action, the adapter invalidates prior
element handles and re-resolves the declared selector inside the current product
boundary. A stale page, detached element, zero/multiple matches, boundary change,
unexpected redirect/origin, ambiguous repeated label, lost session, or persistent
state disagreement fails the action with DOM/navigation evidence. It is not
silently retried, clicked through another match, or accepted from an old render.

Persistent-state evidence uses product-owned URL/state attributes, API/state
responses, or other pack-declared durable signals. The pack decides semantics;
the adapter records exact before/action/after evidence and contract references.
This implements the browser rule at `docs/AGENTS.md:81-86` and addresses the
selector/rerender/toast history at audit `:326-338,445-457,836-837`.

### Network, Diagnostics, Cancellation, and Cleanup

The browser network policy denies all undeclared origins and records attempted
violations. Request interception/stubbing is explicit capability/effect evidence;
synthetic/local and deployed sessions cannot be conflated. Unexpected downloads,
popups, service workers, redirects, or external calls are either predeclared and
owned or fail closed.

Screenshots, traces, DOM snapshots, console logs, request/response metadata, and
downloads are hash-linked attachments. Sensitive media uses the R4
`sensitive-media` class; a redacted derivative cannot replace the restricted
original for validation. Screenshots are diagnostic, not semantic authority.

Startup, navigation/action, idle, total browser, graceful close, and forced
process-tree termination are bounded. On any exception/cancellation, all pages,
contexts, browser processes/descendants, profiles, downloads, sockets, and local
fixtures remain under one declared cleanup owner. Independent residue proof checks
processes, profile/temp roots, listeners, and pack-declared fixture effects. A
normal-path `browser.close()` call without exceptional-path proof is insufficient.

## Database Adapter Contract

### Mandatory Eight-Stage Sequence

The database adapter admits no ordinary read, mutation, cleanup, or residue query
until the applicable preceding stages have completed for the exact target and
attempt:

| Stage | Required contract and evidence | Fail-closed boundary |
| ---: | --- | --- |
| 1. Target and identity proof | Effective configuration is loaded, then exact environment class, account/tenant where applicable, host, port, engine/vendor/version, database, schema, authenticated user, connection security, and native identity-proof bytes are captured and independently validated | Mismatch, ambiguity, default target, unproved user, or wrong engine closes the connection; no ordinary statement follows |
| 2. Metadata-only discovery | Native metadata operations discover one object at a time, including exact columns/types/nullability/defaults/collation, indexes, keys, constraints, relationships, enums and applicable functions | No guessed object, alias, relationship, function, enum, or source/migration assertion substitutes for live metadata |
| 3. Structured statement declaration | Pack supplies stable statement ID, exact engine dialect, statement class, finished statement/structured representation digest, typed parameters, object/identifier/function/relationship manifest, expected result/effect, transaction rule, timeout, and evidence contract | Regex, substring fragments, interpolated values, or incomplete object manifest cannot be declared |
| 4. Per-statement admission | Immediately before execution, a grammar-aware parser/AST or structured query representation is checked against the fresh live metadata for every table, column, alias, expression, function, enum, collation, join, subquery, ordering, read and write target | Any unproved identifier/relationship or metadata drift denies that statement and invalidates dependent later stages |
| 5. Declared read-only execution | Only a statement admitted as `metadata` or `read-only` executes with bound parameters, result schema/limits, deadline and cancellation behavior | No mutation, session-setting drift, multi-statement payload, implicit DDL, or undeclared ordinary read |
| 6. Declared transaction/rollback fixture | Mutation requires exact `transactional` capability, autocommit/commit policy, mutation boundary, fixture resource ledger, rollback/cleanup and residue plan established before the first statement | No fixture/user/object effect precedes full schema preflight; rollback-only work cannot commit |
| 7. Forced-failure rollback | Certification mode injects a declared failure after mutation and proves transaction rollback/connection terminal state within bounds | A thrown error or client close alone is not rollback proof; unknown transaction state blocks cleanup/rerun |
| 8. Guarded independent residue verification | After rollback/cleanup and terminal proof, an independent verifier runs separately declared/admitted metadata/read-only assertions over the exact residue scope | Cleanup success cannot prove zero residue; failed preflight never authorizes cleanup SQL |

The architecture requires grammar-aware SQL parsing/AST inspection or structured
statement construction. The implementation/library choice remains later scope.
Regular expressions, string fragments, unstructured substring matching, ORM
models, migrations, docs, remembered names, or trial-error queries are forbidden
identifier admission mechanisms.

### Statement, Parameter, and Transaction Rules

Each statement declaration includes:

- `statementId`, dialect/engine version, class `metadata`, `read-only`,
  `transactional-write`, `cleanup`, or `residue-read`, and exact canonical content
  digest;
- one complete object manifest naming each object and every identifier use by
  select/filter/join/order/group/insert/update/delete/expression/subquery role;
- explicit alias declarations proven valid for the exact engine; native metadata
  labels are preferred and no metadata alias is invented;
- function, operator, enum, collation, constraint, index, relationship and result
  schema requirements;
- positional/named parameter definitions, types, nullability and redacted value
  digests; values use driver binding and never textual interpolation;
- transaction owner, isolation/autocommit/commit/rollback rule, expected affected
  rows/resources, mutation event, deadline/cancel behavior, and cleanup/residue
  obligation; and
- bounded row/byte result contract, structured evidence, sensitivity, and
  attachment digest.

Every column in a multi-object statement, including scalar/correlated subqueries,
is qualified with its live-proven object alias. Environment-owned references are
resolved as one compatible relationship set, not independently selected first
rows. The exact finished statement, not an earlier template, is admitted
immediately before execution.

The adapter owns connection and transaction lifecycle. Timeout/cancellation
first prevents new statements, requests driver/server cancellation where
supported, and proves transaction/connection terminal state. If terminal state
or rollback cannot be proved, no potentially racing cleanup begins; mutation and
residue remain unknown and escalation is mandatory.

### Pre/Post-Mutation Failure and Drift

A failure during identity or metadata preflight, structured admission, or any
stage before the recorded mutation boundary closes resources and records zero
fixture mutation. It authorizes no ordinary cleanup or residue SQL. Only corrected
metadata discovery may occur in a newly authorized attempt.

After mutation begins, failure requires bounded transaction rollback, exact
rollback outcome, separately admitted cleanup only for effects outside the
rolled-back transaction, and independent residue assertions. Schema/identity
proof is bound to every statement admission. Schema-drift rejection is
mandatory: any live schema digest drift before the next statement cancels
admission and follows the correct pre/post-mutation path; the adapter never
refreshes metadata silently and continues.

These rules directly implement `docs/AGENTS.md:1-22` and preserve the canonical
live-schema guard and transaction/residue assertions identified at audit
`:304-311,392-393,581-584,1248-1258` without authorizing current database use.

## AWS and Environment-Identity Adapter Contract

### Exact Identity and Capability Proof

Every AWS/environment operation declares target class, explicit credential
profile/source reference, partition, account, effective principal/role ARN,
region, service, API action, exact resource ARN/identifier or validated scoped
selector, request parameters digest, effect class, idempotency rule, deadlines,
and cleanup/residue owner.

The adapter loads the same effective non-secret environment/configuration used by
the operation and only then obtains fresh identity proof. It records credential
source kind, non-secret source/config digest, issue/expiry facts where available,
identity request/response digest, account, principal, partition, region policy,
and proof freshness. Raw credentials and tokens never enter evidence.

An implicit/default profile, shell credential inheritance, remembered identity,
instance-role assumption, source configuration alone, or a proof obtained before
the effective environment load cannot authorize an operation. A reconnect,
resumed attempt, credential refresh/expiry, role change, or configuration change
requires new proof. The current TEST/PROD explicit-profile/account rules remain
controlling at `docs/AGENTS.md:24-29`.

Capability preflight validates the exact service/action/resource tuple and any
known quota/state prerequisites. Credentials, connectivity, a successful STS
identity call, or broad IAM policy presence are facts, not operation admission.
The plan and target policy supply closed service/action/resource allowlists.
Cross-account, wrong partition, wrong region, wrong principal, expired/near-expiry
credential, unlisted service/action/resource, wildcard broadening, or unavailable
capability is rejected before action.

### Bounded Operation and Evidence

SDK or CLI transport is explicit and fingerprinted, with controlled environment,
connection, request, execution, idle, cancellation and total bounds. Automatic
retry behavior is disabled or exactly plan-declared and visible; a permission
denial is never retried. A mutating delivery is not retried unless a separately
designed idempotency contract proves duplicate safety, and no such retry is
implicit in this architecture.

Evidence records the effective identity, admitted action/resource/effect,
request digest, provider request ID, response/status/error code, service audit or
command ID where available, start/end/timeout/cancel events, idempotency token,
and whether the provider accepted, rejected, partially performed, or left the
operation outcome unknown. Response bodies are bounded, redacted, hash-linked,
and structurally parsed rather than searched for strings.

Cleanup actions are separately admitted API operations with the same fresh
identity/resource proof. Independent residue verification uses read-only provider
evidence and proves exact absence/state; delete success alone is insufficient.
Timeout, connection loss, or cancellation after provider acceptance records
partial/unknown effect and prevents a blind retry or cleanup until operation
state is resolved.

### IAM Permission-Gap and Escalation Contract

When permission is absent or denied, the adapter emits a structured permission-
gap record containing:

- exact denied service/API action and attempted operation declaration digest;
- effective account, partition, region, principal/role and credential-source
  proof reference;
- exact affected resource ARN/identifier or bounded selector and environment;
- provider error/status, request ID, authorization/denial message digest, and
  available audit reference;
- minimum capability required: the exact token and narrow API/resource permission
  the declared operation requires, without proposing broader policy;
- whether the request was rejected before action, accepted, partially effective,
  or has unknown effect, plus cleanup/residue obligations; and
- next decision `separately-authorize-minimum-IAM-change` or
  `reject-operation-design`, the evidence needed to choose, and the prohibition
  on continued execution.

The adapter stops. It does not repeatedly retry, assume another role, use a
default/broader profile, weaken or skip the check, swap resource/region/account,
change IAM, or invent a CLI/SDK workaround. IAM design and modification are
separate infrastructure work requiring explicit authorization, review, and later
identity/capability certification. Sprint `1E` authorizes none.

No IAM change is authorized by this sprint.

This addresses the current fixed/implicit identity and permission assumptions at
audit `:340-360,517-528,599-617,1315-1333` while preserving the narrow verified
identity primitive at audit `:1267-1268`.

## Remote Transport Adapter Contract

### Session and Dispatch Binding

Every remote session declares exact target endpoint/resource, environment proof,
authenticated local and remote principals, transport protocol/version, client
and remote-agent/runtime fingerprints, encryption/authentication policy, admitted
command/request digest, ordered arguments or typed payload, working directory,
controlled environment references, effect tokens, idempotency/replay key, output
contract, deadlines, cancellation endpoint, termination proof, and remote cleanup
owner.

Endpoint discovery may select only from a plan-declared, independently proved
resource set. Hostnames, instance IDs, service names, current ASG membership, or
repository layout are evidence only after exact target validation. The remote
runtime proves the same `attemptId`, candidate/harness/pack/adapter versions,
environment identity, and command digest before accepting work.

Arguments and payloads use an explicit typed encoding with length and digest.
Shell concatenation, quoting guesses, delimiter parsing, ambient remote
environment, and marker extraction from unstructured output are forbidden. A
remote command receives an adapter-issued operation ID/idempotency key; the
remote acceptance ledger or equivalent returns the existing delivery record for
an exact duplicate and rejects same-key/different-content replay.

### Output, Timing, Cancellation, and Network Failure

Output uses framed structured events/results or durable content-addressed
attachments with explicit length, chunk order, digest, media type and terminal
marker inside the protocol. `stdout`/`stderr` remain separate diagnostics. A
provider console/command-output size limit is not the result transport; oversized
evidence is handed to R4 and referenced by digest. Missing/truncated/corrupt/
duplicate-conflicting/stale output is non-success, never a parseable substring.

Connection, authentication, dispatch acknowledgement, startup, execution, idle,
graceful cancellation, forced remote termination, result collection, cleanup and
total deadlines are separate. Local timeout sends the declared remote cancel,
then termination request, and independently proves the remote operation/process
tree terminal. Stopping local polling or closing the client is not cancellation.

Network interruption records the last acknowledged send/receive sequence,
operation acceptance state, remote process/job identity, partial output chunks,
known/may-have effects, and safe next action. There is no silent reconnect,
redispatch, or retry. A later status/collection request may observe the same
operation ID without executing it again. Late output is retained/quarantined and
cannot reverse a terminal/cancelled result or cleanup decision.

Duplicate-delivery handling and replay protection use the exact operation ID,
payload digest, acceptance ledger, and sequence evidence: identical delivery is
idempotent observation, while same-ID/different-content delivery is rejected and
preserved as conflicting evidence.

Remote cleanup is a separately admitted operation after terminal proof and uses
the exact environment/resource/fixture ledger. Independent residue proof covers
remote process/job, temporary files, sessions, objects/identities/data effects,
and result handoff. If remote termination is unproved, cleanup cannot race it and
residue remains unknown. These rules address the duplicated SSM polling,
truncation, unbounded close, and cancellation gaps at audit
`:352-359,366-393,470-485,585-590,828-835,1296-1302`.

## Fixture Lifecycle, Cleanup, and Residue Contract

### Fixture Plan and Ownership

Every fixture-bearing check has one immutable fixture plan whose definition
contributes to its `testPackVersion` and `harnessVersion`. The fixture plan binds:

- stable `fixturePlanId` and version/digest, owning pack/version, exact check
  instance, adapters/capabilities, accepted plan and unique `attemptId`;
- target/environment identity requirements and exact resource scopes, including
  all environment-owned references that must form one compatible relationship
  set;
- fixture type/count/size limits, unique attempt-derived names/keys, creation DAG
  and order, mutation boundaries, persistent-state assertions, and external
  side-effect suppression requirements;
- rollback or cleanup strategy, owner, terminal-proof prerequisite, independently
  owned residue verifier, residue scope/assertions, budgets, and escalation; and
- sensitivity, redaction, R4 evidence/attachment class, and separately authorized
  recovery relationship.

All schema/target/capability prerequisites across every participating adapter
pass before the first fixture effect. A database preflight must therefore finish
before a Cognito identity, object, browser session, ordinary DB read, email/event,
or other external fixture is created. Availability of one adapter does not waive
another prerequisite.

Fixtures are exclusive to one attempt unless a pack contract explicitly declares
an immutable read-only shared resource. Mutable shared, pre-existing-but-unowned,
first-row, current-user, default-bucket/pool, or conventionally named fixtures are
forbidden. Environment-owned references are discovered and validated as one
compatible set; they are never mutated or later deleted as fixture property.

### Creation, Assertion, and Effect Ledger

Creation follows the declared DAG. Before each effect, the adapter revalidates
identity/capability, remaining budget, effect admission and cleanup readiness.
Every accepted/requested/partial mutation appends an exact effect-ledger entry
with resource identity or unresolved operation ID, owner, parent relationship,
adapter event, state, and cleanup/residue obligation.

Persistent-state assertions occur at declared boundaries and are owned by the
pack/native contract. The fixture coordinator records exact structured evidence;
it does not define business success. Suppression of email, payment, notification,
provider, or other real external effect is itself an end-to-end capability and
residue assertion, not an environment variable or mocked-call assumption.

### Interruption, Cleanup, and Zero Residue

The cleanup strategy exists and validates before mutation. It may be:

- transaction rollback for effects fully owned by one proved transaction;
- ordered compensating cleanup for attempt-owned external resources;
- a combination where cross-system effects cannot share one transaction; or
- cleanup unnecessary only with proved no mutation/effect.

On failure/interruption, new fixture creation stops immediately. Each live
process, remote job, DB transaction, browser/session or cloud request is first
cancelled and proved terminal. Cleanup then walks the current effect ledger in
the declared dependency-safe order and, where relationships may have changed,
re-resolves them inside the exact cleanup transaction/action using fresh admitted
proof rather than a stale pre-mutation ID list.

Independent residue verification checks every declared database row/counter,
object/version, identity/session, message/event/notification, HTTP/remote job,
filesystem path, process/socket, browser profile and suppressed external effect
as applicable. Its authority is separate from the cleanup action. The outcomes
are exactly `zero-residue`, `residue-found`, or `unknown`; cleanup completion does
not itself prove zero.

If termination, cleanup, or residue verification is interrupted or cannot be
proved, the attempt remains non-`GO`, preserves partial evidence, records exact
known/unknown resources, and emits `separately-authorized-recovery`. No shared or
unowned resource is deleted speculatively, and no second cleanup runs in the same
attempt. This addresses the runner-specific cleanup, missing recovery, Cognito
absence, progress-file, timeout-overlap and no-real-email gaps at audit
`:384-393,517-535,581-597,919-921,1327-1335,1372-1382`.

## Adapter Failure and Evidence Model

Adapters emit classification inputs, not final classes. The table describes the
facts required before the deterministic classifier may support each non-product
class. If those facts are absent or conflicting, the required class is
`unclassified`. A `product` class additionally requires the product pack's exact
verified contract, native assertion, expected/observed evidence, and valid
adapter mechanics.

| Adapter class | Evidence supporting `harness` | Evidence supporting `environment` | Evidence supporting `infrastructure` | Evidence requiring `unclassified` |
| --- | --- | --- | --- | --- |
| Process/build | Admitted argv/cwd/env was wrong; adapter violated timeout/tree/output/restoration contract; parser accepted corrupt result | Exact declared local tool/runtime/dependency/source prerequisite is missing, stale, dirty, or incompatible under target policy | Proved independent OS/runtime failure such as spawn subsystem or storage failure outside candidate/adapter behavior | Process identity, terminal state, output boundary, source drift owner, or restoration evidence missing/conflicting |
| Filesystem/source | Root/path/symlink guard, baseline, digest, restoration or deletion ownership implementation violated its contract | Declared source/worktree state differs from required clean/exact candidate or required path/capacity is unavailable | Proved independent filesystem/device service failure | Cannot attribute drift to user versus adapter, baseline absent, or path/digest evidence corrupt |
| Local HTTP | Adapter bound wrong endpoint, accepted wrong service/readiness, polled unboundedly, or failed shutdown/socket proof | Declared port/address/runtime/config unavailable or exact service unhealthy for environment reasons | Proved independent OS networking/runtime failure | Listener/process/service identity or shutdown/socket state cannot be reconstructed |
| Browser | Launch/network/selector mechanics, isolation, evidence capture or exceptional cleanup violated declared contract | Required browser/runtime/dependency/origin/session capability unavailable or target redirects/config differs from policy | Proved independent browser-engine/driver/platform crash not caused by product/adapter input | DOM/page/session state, selector matches, network, terminal process or diagnostics insufficient to separate product/harness/runtime |
| Database | Adapter targeted wrong allowed environment, guessed/admitted invalid SQL/identifier, mishandled transaction/rollback, or skipped guard/residue contract | Exact DB/user/schema/DDL/config differs from required target contract or capability is unavailable | Proved independent engine/network/storage failure after correct identity/admission and unrelated to statement/product | Target/DDL/statement/transaction terminal/mutation/residue evidence missing or conflicting |
| AWS/environment | Adapter used implicit/wrong profile, failed post-load identity, broadened action/resource, retried denial, or misparsed provider evidence | Exact target account/region/resource/config/permission differs from required policy, including deterministic access denial with zero/known effect | Proved independent provider/service outage or transport failure after correct identity/admission | Effective principal, request acceptance, partial effect, target, provider response or audit evidence cannot be proved |
| Remote transport | Encoding/framing/parser/idempotency/poll/cancel/termination implementation violated contract or deployed helper/version was wrong | Declared endpoint/agent/runtime/config/capability unavailable or mismatched | Proved independent network/transport/provider outage after correct binding | Delivery acceptance, remote process terminal state, output completeness, duplicate state or effect boundary unknown |
| Fixture/cleanup/residue | Fixture plan/relationship/assertion binding, ownership ledger, suppression, cleanup order or verifier independence was defective | Compatible environment-owned relationship/capability is absent or target state violates fixture prerequisites | Proved independent participating service failure after correct plan and target proof | Mutation, ownership, termination, cleanup or residue scope/status incomplete/conflicting |

An adapter failure record includes exact lifecycle phase, operation/command,
adapter version, target/identity proof, capability/effect tuple, raw error/status,
request/process/job/transaction identifiers, mutation state, evidence sufficiency,
cleanup obligation, and next safe action. Exit codes, HTTP status alone, provider
error prose, screenshots, or LLM narrative cannot establish a class.

## Adapter Certification Matrix

This matrix defines later proof obligations; Sprint `1E` performs none. Exact
repeat counts and pack-promotion policy remain Sprint `1F`, but every adapter
must demonstrate repeated deterministic known-good behavior under the approved
threshold before use.

| Adapter class | Repeated known-good | Deliberate bad input, wrong target/capability, and denied permission | Timeout, cancellation, forced interruption | Cleanup failure and residue detection | Stale/corrupt/unsupported evidence and no unauthorized effect |
| --- | --- | --- | --- | --- | --- |
| Process/build | Same argv/env/source produces stable events/result/artifact digests and clean baseline repeatedly | Reject unknown executable/arg/env/cwd, drifted source, missing tool/capability and OS permission denial before spawn | Hung startup, idle child, descendant ignoring grace, force whole tree, interrupt build/restoration | Deliberate generated-file restoration failure and leftover process/file/cache detected | Reject stale/ambiguous/truncated/corrupt output and unsupported build operation; prove no undeclared command/write |
| Filesystem/source | Repeat exact reads/hashes and isolated create/restore/delete with identical baseline/residue | Reject path escape, symlink swap, undeclared root/write/delete, dirty/drifted source and filesystem permission denial | Interrupt during read/write/restore/delete; bounded cancellation and ownership-safe recovery | Failed restore/delete plus hidden temp/symlink/process residue detected | Reject changed digest/type, duplicate/conflict and unsupported path type; prove unrelated user files untouched |
| Local HTTP | Repeat lease/start/identity/readiness/health/request/shutdown with released port | Reject occupied port, wildcard/wrong host, wrong/stale service, undeclared route/external network and bind denial | Startup/readiness/idle/request timeout, cancel, server ignores grace, forced tree termination | Shutdown failure, still-bound socket, temp/log residue and wrong responder detected | Reject stale response, oversized/corrupt evidence and unsupported protocol; prove no undeclared listener/outbound call |
| Browser | Repeat isolated navigation/action/persistent-state evidence and full cleanup | Reject missing/ambiguous/global selector, wrong origin/session/runtime, missing network capability and launch/file permission denial | Navigation/action/idle timeout, user cancel, engine hang/crash, forced process-tree interruption | Browser/profile/download/socket/fixture cleanup failure and residue detected | Reject stale handle/page, unexpected redirect, corrupt screenshot/result and unsupported action; prove blocked external network/no stray click |
| Database | Repeat target/DDL/admission/read and rollback-only fixture with identical zero residue | Reject wrong DB/user/engine/schema, missing object/identifier/function/enum/relationship, unbound parameter and denied DB permission before ordinary effect | Query/transaction timeout, cancel/connection loss, forced failure after mutation, prove rollback/terminal state | Deliberate rollback/cleanup failure and remaining row/object/transaction residue detected | Reject drifted DDL, stale admission, corrupt result and unsupported statement class; prove zero ordinary SQL after failed preflight and no undeclared commit |
| AWS/environment | Repeat post-load identity, allowed read and controlled idempotent fixture/cleanup where later authorized | Reject default/wrong profile/account/role/region/resource, expired credential, missing capability and exact IAM denial without fallback | SDK/CLI connection/request timeout, cancel before/after provider acceptance, partial operation, forced interruption | Deliberate delete/cleanup denial and remaining object/identity/session/resource detected independently | Reject stale identity, mismatched request ID, corrupt/unsupported response/action; prove no alternate role, broader credential, retry or undeclared API |
| Remote transport | Repeat exact endpoint/principal/runtime dispatch, framed collection, termination and handoff | Reject wrong endpoint/principal/agent/version/command, missing capability, auth/dispatch denial and same-key/different-payload replay | Connection/ack/start/run/idle/collect timeout, local cancel, remote ignores grace, forced remote termination | Remote cleanup failure and process/temp/session/data/object residue detected | Reject truncated/corrupt/duplicate-conflicting/late output and unsupported operation; prove no redispatch/silent retry/undeclared command |
| Fixture/cleanup/residue | Repeat unique attempt fixture DAG, persistent assertions, cleanup and independent zero residue | Reject shared/unowned fixture, incompatible references, wrong target, missing adapter capability and denied create/delete permission | Interrupt before mutation, during creation, after mutation, during cleanup and residue proof | Deliberate cleanup failure and each resource-class residue/unknown escalation detected | Reject stale ledger, corrupt relationship/proof and unsupported resource; prove no effect before all preflights and no real unsuppressed external effect |

Certification evidence must itself satisfy Sprint `1D`: exact identities, plan,
events, results, failures, cleanup, residue, attachments, canonical digests and
independent validation. No adapter becomes trusted from one pass, a mocked happy
path, or discovery of a real product defect.

## Sprint 1E Decision and Verification Record

| ID | Evidence / accepted invariant | Chosen safety rule | Rejected alternative | Tradeoff / unresolved point | Later verification requirement |
| --- | --- | --- | --- | --- | --- |
| 1E-D01 | M01/M11; audit `:290-393,1212-1219` | Common domain-neutral contract; capability-specific adapters own mechanics/facts only | One universal workflow adapter or runner-specific ungoverned wrappers | More explicit manifests/hand-offs | Phase 2 synthetic common contract; later per-adapter certification |
| 1E-D02 | M03/M11; Sprint `1B` identities | Immutable adapter manifest/version contributes to `harnessVersion` and is plan-bound | Discover current adapter/tool at runtime | Version churn is explicit and reproducible | Phase 2 version/substitution cases |
| 1E-D03 | M04-M05; audit `:411-421,517-528,1315-1333` | Closed `RQ-CAP-1` tuple requires plan, adapter, fresh proof and policy intersection | Infer capability/authority from config, credentials, connectivity or adjacent token | More prerequisite evidence | Phase 2 missing/broadened capability; later target proof |
| 1E-D04 | M04/M08 | Six exact effect classes with explicit resource/target limits; no hierarchy implication | Coarse `read/write` boolean or broad credential scope | More declaration detail prevents silent mutation | Phase 2 undeclared effect; later class-specific cases |
| 1E-D05 | M07; audit `:384-393,470-485` | Every adapter supports bounded cancel -> grace -> force -> terminal proof; timeout is not terminal | Parent timeout/exit or best-effort close | Platform mechanisms remain implementation choices | Phase 2 process tree; later browser/DB/AWS/remote cases |
| 1E-D06 | M09; Sprint `1D` event/result model | Separate stdout/stderr/structured result/attachments; missing/truncated/ambiguous output fails | Flattened output, substring marker, newest-file selection | More artifacts and storage | Phase 2 overflow/corrupt/missing evidence |
| 1E-D07 | Audit `:307-309,384-393,422-433` | Build inventory snapshots every written/generated path and independently restores/residue-checks | Rely on build tool cleanup or restore one known file | Complete inventory costs more I/O | Later build success/failure/interruption certification |
| 1E-D08 | Audit `:608-613,1317-1325`; M02/M03 | Root-anchored path/symlink validation, exact baseline and ownership-safe restoration; never overwrite ambiguous user drift | String-prefix root check, cwd/glob authority, blanket reset/delete | Concurrent drift may require manual stop | Phase 2 path/symlink/drift fixtures |
| 1E-D09 | Audit `:309,388-391`; M07 | HTTP target binds owned process, endpoint, build/candidate and attempt challenge; readiness != health | Any 2xx/listener means ready | Requires identity endpoint/challenge mechanics | Later wrong-service/port/shutdown certification |
| 1E-D10 | M14; `docs/AGENTS.md:81-86`; audit `:326-338,836-837` | Browser uses product-owned scoped selectors and persistent state; re-resolves after rerender; screenshots diagnostic | Global text, old handles, transient toast or screenshot as pass | May require future product-owned selector additions | Sprint `1F` pack contracts; later product change approval/certification |
| 1E-D11 | M16 | Browser adapter owns mechanics/network/runtime/cleanup; pack/native runner owns semantic assertion | Adapter interprets workflow success | Stronger separation means richer pack contract | Sprint `1F`; known-good/bad product assertion binding |
| 1E-D12 | `docs/AGENTS.md:1-22`; audit `:304-311,581-584` | Exact eight-stage DB sequence with live identity, one-object metadata, finished statement declaration/admission and guarded residue | Source/migration schema, guessed query, trial/error or preflight-only guard | More metadata/admission work | Later DB adapter schema/drift/rollback certification |
| 1E-D13 | M06/M13 | Require grammar-aware parser/AST or structured statement representation; regex/fragments/substrings forbidden | Ad hoc SQL regex/parser or string identifier list | Implementation library remains unresolved technical choice | Phase 5 library decision and adversarial statement corpus |
| 1E-D14 | `docs/AGENTS.md:7-10`; M04/M08 | Pre-mutation failure closes without cleanup SQL; post-mutation failure proves rollback then independent residue | Always run cleanup or infer rollback from throw/close | Requires exact mutation state | Later forced failure before/after mutation |
| 1E-D15 | `docs/AGENTS.md:24-29`; audit `:340-360,517-528` | AWS identity is explicit and freshly proved after effective config; service/action/resource are allowlisted | Default profile, remembered account/resource, instance-role assumption | More proof per action/resume | Later wrong account/role/region/expiry cases |
| 1E-D16 | Audit `:517-528,599-617` | IAM denial emits minimum-capability decision record and stops; no retry, role swap, weakened check or workaround | Broader credentials, silent assume-role, tactical IAM bypass | May require separate infrastructure authorization | Later AccessDenied/partial-effect certification; Bill approves any IAM work |
| 1E-D17 | Audit `:366-382,828-835,1296-1302` | Remote protocol binds endpoint/principal/runtime/command, framed durable output and replay key | Shell quoting, stdout marker, bounded console output as result | Requires remote agent/protocol capability | Later transport size/replay/corruption certification |
| 1E-D18 | M07/L10 | Local timeout must cancel and prove remote terminal before cleanup; observation reconnect may not redispatch | Stop polling, assume completion, cleanup concurrently | Some failures remain unknown/unclassified | Later remote hang/late-output/termination-failure cases |
| 1E-D19 | M04/M08; audit `:384-393,581-597` | Immutable attempt fixture plan, compatible reference set, ordered effect ledger, suppression proof, predeclared cleanup | Shared/unowned/first-row fixtures or cleanup invented after failure | More pack setup | Sprint `1F` domain fixture contract; later interrupted cases |
| 1E-D20 | L09-L10; audit `:517-535,919-921` | Cleanup action and independent residue verifier remain separate across every adapter | Cleanup return/warning/absence assumption means clean | Additional verifier operations | Phase 2 common cleanup; later adapter-specific residue certification |
| 1E-D21 | M10; Sprint `1D` failure schema | Adapters emit facts for harness/environment/infrastructure/unclassified; product requires pack contract/assertion | Adapter or LLM classifies product from exit/status | Some failures intentionally stop unclassified | Phase 2 classification inputs; Sprint `1F` product binding |
| 1E-D22 | Plan promotion standard; audit `:1320-1370` | Every adapter later proves good/bad/identity/capability/denial/timeout/cancel/interruption/cleanup/residue/evidence/unsupported/no-effect cases | One happy path or defect discovery certifies adapter | Exact repeat counts remain Sprint `1F` | Sprint `1F` thresholds and later phase-specific certification |

No Sprint `1E` decision changes the accepted identity, authority, O1 ownership,
Sprint `1C` lifecycle, Sprint `1D` schema/validation model, or Bill-approved R4
direction. No new architecture conflict requires Bill's decision.

Decisions still reserved for Bill are:

- Sprint `1F` mandatory-core, selection, maturity and repeated-certification
  policy, including the final numeric thresholds;
- any future product-facing stable-selector additions or other shipped product
  contract changes through an expressly approved implementation scope;
- any IAM role/policy/capability change through separately authorized
  infrastructure work after the adapter reports the exact minimum gap; and
- Sprint `1G` R4 backend, retention durations, access/hold/deletion authority,
  operating ownership/cost, migration/admission policy, and exact Phase 2 files.

None of those authorizes current implementation or environment access, and none
blocks completing the Sprint `1E` documentation design.

## Sprint 1E Files, Effects, and Verification

Examined:

- `docs/AGENTS.md` and its SQL/schema, fixture, AWS identity, browser selector,
  documentation, and bounded harness-sprint rules;
- the controlling plan's strategy, identities, failure classes, adapter-related
  Phase 1 deliverables, Phase 2 boundary, checkpoint, and Sprint Ledger;
- the accepted Phase 0 audit's DEV/TEST dependency/effect maps, browser child
  lifecycle, evidence handoffs, confirmed process/build/browser/DB/AWS/remote/
  cleanup findings, component dispositions, duplicated transport, hidden
  assumptions, trusted assets, constraints, and unresolved capability gaps; and
- the accepted target architecture's M01-M21, D05-D15, five identities,
  producer/validator authority, L01-L14, Sprint `1C` lifecycle/effect/process/
  cleanup rules, Sprint `1D` six-schema/canonicalization/validation model, and
  Bill-approved R4 direction.

Changed only:

- this target-architecture document; and
- the controlling plan's checkpoint and Sprint Ledger.

Verification is documentation-only static review: all requested sections; 10
common operations; the closed `RQ-CAP-1` vocabulary; four target classes; six
effect classes; exact process/build/filesystem/HTTP/browser/DB/AWS/remote/fixture
contracts; all eight database stages; IAM denial/escalation fields; eight adapter
failure-evidence rows; eight later-certification rows covering every requested
negative class; 22 sequential decision records; R4/O1/identity/lifecycle/schema
compatibility; scope/deferral language; formatting; and final worktree state.
No executable schema/adapter, test, build, qualification, SQL/database, AWS/IAM,
browser, HTTP, deployment, fixture, storage, TEST, PROD, or other environment
operation was authorized or performed.

One combined initial baseline read exceeded the display budget; bounded reads and
the accepted exact references supplied the required evidence. The first static
coverage pass found eight requested concepts expressed indirectly and a second
found three prohibitions expressed equivalently; wording was made explicit
without changing the architecture. One patch attempt failed its context check
and changed no file. One read-only search repeated the known unescaped-backtick
shell quoting error and reported `1E: command not found`; the corrected search
completed without operational effect. These were explained documentation/tooling
events, not workflow or environment failures. No unexplained failure, blocker,
strategy conflict, or course correction occurred.

Final worktree state: admin remains on `main...origin/main` with the pre-existing
modified `docs/AGENTS.md`,
`docs/ops/deployments/release-qualification-runbook.md`, and
`docs/planning/README.md`, plus the pre-existing untracked Phase 0 audit,
controlling plan, and target-architecture files. Sprint `1E` changed only the
target-architecture and controlling-plan files. Portal and shared remain clean
on `main...origin/main`. Intacct mock remains the non-Git directory established
in Phase 0 and was not re-probed. No pre-existing user change was reverted or
overwritten.

## Sprint 1E Completion Decision

Sprint `1E` is complete at the documentation-architecture level. The common
adapter contract, capability/effect model, adapter-specific safety contracts,
IAM gap/escalation contract, fixture/cleanup/residue model, failure-evidence map,
certification matrix, and decision record are complete without executable API,
schema, adapter, pack policy, selection policy, migration, implementation,
repair, IAM/configuration change, environment access, or check migration.

The exact approval required for proposed next work is: **Bill explicitly
authorizes Sprint `1F` of Phase 1 to define the documentation-only modular
test-pack contract, native-runner authority, deterministic selection policy,
maturity and certification rules, and no-loss coverage governance, with no pack
implementation, test execution, check migration, promotion, environment access,
or later-phase work.**

## Sprint 1F Outcome

Sprint `1F` defines the documentation-level pack, native-runner, maturity,
certification, deterministic-selection, dependency-mapping, and no-loss
governance required by D14-D17. It preserves O1, R4, the five identities, the
independent authority chain, the Sprint `1C` lifecycle, the six Sprint `1D`
evidence artifacts, and the Sprint `1E` adapter/effect contracts. It neither
creates nor promotes a pack and does not make the future system authoritative.

The recommended policy is a small mandatory control/provenance core,
operation-triggered safety packs, and dependency-expanded impacted-domain packs.
Full regression remains explicitly requested, scheduled, or required for a
declared broad change; it is not the default for every candidate. The controlling
certification minimum remains ten consecutive known-good runs plus all deliberate
negative cases and one forced interruption for fast local layers, and three clean
distinct TEST attempts after adapter certification for expensive TEST packs.

## Normative Modular Test-Pack Contract

Every pack has one immutable, canonical, independently validated manifest. A
pack version denotes its semantics and operating obligations, not merely its
display metadata. The manifest is a harness/test-pack role input under O1; its
digest contributes to both `testPackVersions` and `harnessVersion`. It must
contain the following fields at documentation level.

| Contract area | Required declaration and invariant |
| --- | --- |
| Identity | Stable `packId`, semantic `packVersion`, manifest digest/version, purpose, product domain, owning repository, accountable maintainers, escalation owner, and current maturity and operating status. Reuse of a version for changed bytes is forbidden. |
| Level | Exactly one primary level: `unit`, `component-contract` (component/contract), `integration`, `local-system`, `deployed-end-to-end`, or `smoke`; secondary descriptive tags cannot change the primary effect or authority boundary. |
| Contract | Versioned authoritative product/operational contract references, approving owner, and evidence that each reference was verified. A prose claim without a resolvable versioned source is not authority. |
| Coverage | Product surfaces, repositories, components, requirements, assertions, exclusions, and any suspected or unresolved gaps. Product, contract, adapter, pack, and release-admission coverage are distinct. |
| Native binding | Owning repository, exact non-shell command/arguments and working directory, native runner/version, source and dependency fingerprint roles, structured-result contract, expected exit semantics, and native assertion identifiers. |
| Execution | Required adapters and immutable versions, closed capabilities, supported environment classes, prerequisites, declared effects and resource bounds, timeout/cancellation/termination requirements, and unsupported-operation behavior. |
| Inputs | Identity bindings, immutable input/fixture versions, environment requirements, external resources, credential role but never credential material, generated inputs, and attempt-unique namespaces. Ambient inputs are forbidden. |
| Assertions | Expected/observed structured values, persistent product-state evidence where applicable, contract linkage, stable product-owned selectors, and the boundary between native product semantics and adapter mechanics. |
| Lifecycle | Fixture creation order, mutation boundary, cleanup owner, termination-before-cleanup proof, cleanup/recovery operations, declared residue scope, independent residue assertions, and interrupted-path behavior. |
| Evidence | Required events, native result, logs/attachments, failure inputs, cleanup result, residue proof, sensitivity/redaction class, truncation rules, and parent/related artifact links under the Sprint `1D` schemas. |
| Certification | Known-good corpus, every applicable deliberate known-bad case, timeout/cancellation/forced-interruption cases, cleanup/residue cases, required repetitions, last certified version, certification evidence, and invalidation state. |
| Dependencies | Versioned pack-to-pack prerequisites, required or optional relationship, reason, effect ordering, shared-runtime/domain mapping, and cycle prohibition. |

The manifest may add capability-specific sections only from a versioned closed
extension vocabulary. It may not weaken common adapter, identity, evidence,
cleanup, or authority rules. Missing ownership, contract, runner binding,
effects, prerequisites, cleanup, or evidence requirements makes the pack
inadmissible rather than implicitly read-only. This contract implements the
controlling plan at `:77-108` and the audit constraints at
`release-qualification-harness-current-state-audit-2026-08-10.md:1337-1370`.

## Native-Runner Authority

1. A pack binds an exact native runner command to one repository, source and
   dependency fingerprints, verified contract set, assertion IDs, exit model,
   and structured-result contract. Unstructured success text is not a result.
2. The native runner and product-domain owner retain semantic authority for the
   declared product assertions. The kernel, selector, wrapper, adapter,
   validator, and LLM must not reinterpret expected product behavior.
3. The harness captures command identity, effective fingerprints, stdout/stderr
   references, exit/termination evidence, structured result, contract links,
   assertion outcomes, adapters/effects, and cleanup evidence. It checks the
   binding; it does not manufacture a product verdict.
4. Wrapper, adapter, framing, identity, evidence, timeout, cancellation, fixture,
   and cleanup failures remain separately attributable. They cannot be converted
   into `product` merely because the child command failed. A `product` class
   requires the pack's verified contract and deterministic native assertion.
5. A native command's zero exit is insufficient when product candidate,
   harness, attempt, environment, selected scope, evidence, or cleanup/residue
   validation fails. The overall attempt remains rejected.
6. A runner may be **wrapped** when its native assertions are trustworthy but
   process, identity, effect, evidence, or cleanup mechanics need certified
   control. It may be **repaired** only under separately approved implementation
   scope, with a new pack/harness version and complete affected certification.
   It may be **replaced** only after every assertion and lifecycle obligation is
   mapped to certified replacement coverage. A required pack may be temporarily
   **suspended** or **quarantined**, but not silently excluded; if required for
   the selected scope, qualification fails closed.
7. A product-facing selector or assertion change requires approval by the
   product/contract owner, a resolvable contract, exact before/after coverage,
   deliberate negative proof, new pack and harness versions, and recertification.
   It also changes `productCandidateId` when shipped product source or a shipped
   product contract changed. Test convenience is not contract evidence.

These rules preserve the native assets identified at audit `:1199-1247` while
addressing the wrapper/fixture/selector/parser failures at `:840-907` and the
browser-specific persistent-state rule in `docs/AGENTS.md:81-86`.

## Pack Maturity and Operating State

Maturity and operating state are separate. Maturity is one of `experimental`,
`advisory`, `candidate`, or `mandatory`; operating state is one of `active`,
`suspended`, `quarantined`, or `retired`. A historically mandatory version can
therefore be quarantined without being relabelled as uncertified history.

| Maturity | Entry and permitted use | Evidence/effect boundary | Release influence and failure handling | Advancement, regression, and approval |
| --- | --- | --- | --- | --- |
| `experimental` | Registered owner, unique identity, stated purpose and draft contract; design/local synthetic exploration only | No product/deployed effect by default. Any isolated stateful experiment needs separate authorization and certified adapters, but produces no qualification evidence | None; failures are development evidence only | Owner may create/version; advance after complete manifest, verified contract, declared effects/cleanup, initial known-good and bad evidence, and independent manifest validation |
| `advisory` | Complete contract and bindings; all used adapters certified for the declared operation; shadow/advisory use | Schema-valid identity-bound evidence; effects only when separately authorized; incomplete or discrepant evidence stops that advisory attempt | May inform humans but cannot block, clear, or weaken a release | Independent certifier advances only after the full policy below and all thresholds; any incomplete safety contract returns it to `experimental` |
| `candidate` | Full pack certification completed for this exact version; eligible for controlled dual-run observation | Same effect controls as mandatory, but legacy authority remains; every disagreement is retained and classified | No authoritative `GO/NO-GO`; unexplained disagreement is a migration stop | Qualification governance may propose promotion after Sprint `1G` observation/rollback criteria; a semantic or safety change invalidates the version, and a defect suspends/quarantines it |
| `mandatory` | Bill-approved policy includes the certified version or promotion class; migration/admission gate is satisfied | Complete validated evidence, current environment proof, certified adapters, bounded effects, and zero-residue proof where required | Only this maturity may contribute authoritative qualification evidence, and only when independent validation and deploy admission also pass | Promotion requires independent certifier and governance approval; mandatory-core policy requires Bill. Safety, identity, cleanup, or evidence-integrity defect causes immediate suspension/quarantine; removal requires certified no-loss replacement or explicit Bill approval |

A pass count, a genuine product defect found, or elapsed use does not cause
promotion. Suspended/quarantined selected mandatory coverage is a blocker, not a
reason to omit the pack or substitute an uncertified version.

## Certification Policy

Certification is version-specific and independently performed; a pack owner
cannot self-certify. It proves the pack and its bound schemas, kernel path,
adapters, selection/dependency mapping, native result, identity separation, and
cleanup path together. Certification evidence itself uses the six Sprint `1D`
artifacts and R4 direction.

Required proof for every applicable layer is:

- schema-valid, digest-linked, independently reconstructed identity, scope,
  lifecycle, result, failure, cleanup, and final evidence;
- certified kernel lifecycle and each bound adapter/capability before pack-level
  certification;
- a verified known-good product/fixture for positive trials and every deliberate
  product, harness/fixture, environment, infrastructure, malformed evidence,
  timeout, cancellation, forced-interruption, cleanup-failure, and residue case
  applicable to the pack;
- exactly the intended deterministic status, primary class, phase, check,
  command, contract/evidence, cleanup decision, and next safe action for each
  negative case;
- repeated evidence with identical semantic outcomes and canonical bytes after
  permitted timestamp/identifier fields are normalized as specified; and
- separate and reproducible product candidate, harness, attempt, environment,
  and pack identities on every run.

The controlling baseline is **retained unchanged as a minimum**:

- fast local layers require ten consecutive known-good runs, all applicable
  deliberate negative cases, and at least one forced interruption; and
- expensive TEST packs require three clean attempts with distinct `attemptId`s,
  fresh environment proof, and zero residue, after every component adapter is
  already certified.

The Phase 0 record establishes high harness failure frequency but supplies no
evidence that fewer repeats would be safe (`audit:695-927`). Lowering the
threshold would reduce cost while weakening the only proposed repeatability
guard; increasing it would add cost without an evidence-derived number. Thus no
revision is recommended. Counts restart after a pack/harness-affecting change or
an unexplained/unexpected result. A deliberate product failure is not a clean
run, and a real product failure neither certifies nor automatically invalidates
the harness. Trials cannot be cherry-picked or combined across versions,
environments, or unproved candidates.

## Certification Invalidation and Recertification

| Change | Identity effect | Certification and maturity consequence | Minimum recertification scope |
| --- | --- | --- | --- |
| Product assertion | New `packVersion` and `harnessVersion`; `productCandidateId` only if shipped source/contract changes | New version returns to `advisory` if its contract is complete, otherwise `experimental`; old evidence remains historical only | Affected native assertions, all good/bad cases, result/classification binding |
| Authoritative contract | Pack/harness change; product candidate also changes when the contract is shipped product input | Same; mandatory old version suspends if its contract is no longer authoritative | Contract verification, every affected assertion and selection mapping |
| Fixture | Pack/harness change | New version advisory/experimental; safety defect quarantines old active version | Fixture prerequisites, persistent state, failure paths, cleanup/interruption/residue |
| Product-facing selector | Pack/harness change; product candidate changes only for shipped product source | New version advisory/experimental | Owner approval, stable-selector and ambiguity negatives, actions and persistent outcomes |
| Result/evidence parser | `harnessVersion`; affected `packVersion` when pack-specific | Affected certifications invalid; generic parser change can invalidate every consumer | Truncated/corrupt/duplicate/stale/late/conflicting result corpus and affected packs |
| Cleanup rule | Pack/harness change | New version advisory/experimental; confirmed residue gap immediately suspends old version | Every mutation boundary, forced interruption, cleanup failure, independent residue proof |
| Adapter | `harnessVersion`; pack version changes if binding, capability, or obligations change | Adapter certification invalid; every dependent pack loses current certification until compatibility is proved | Full affected adapter matrix, then affected pack integration/repetition |
| Transport | Harness change; pack version if transport requirements/binding change | Remote pack certifications invalid | Size/framing/replay/timeout/cancel/termination/late-result and cleanup cases |
| Evidence schema | `harnessVersion` | Schema/producer/validator path and every affected pack certification invalid | Compatibility, canonical hashes, lineage, negative evidence, mixed-version rejection |
| Pack manifest | Pack/harness change; product candidate changes only if role composition changes product inputs | New version cannot inherit certification | Manifest validation plus every field whose semantics or closure changed |
| Dependency/impact mapping | `harnessVersion`; resulting selected set belongs to a new attempt | Selector certification invalid; affected packs do not necessarily lose native certification, but cannot be selected authoritatively until mapping recertifies | Inclusion, omission, mutation, cycle, shared and unknown-input suite |
| Environment capability requirement | Pack/harness change; runtime proof changes `environmentIdentity` | New pack version uncertified for that class; current attempt must re-prove environment | Capability denial/wrong target and pack execution/cleanup in every supported environment class |
| Native runner version/dependencies | Pack/harness change; product candidate only when shipped product inputs change | Native binding and pack certification invalid | Exact command/fingerprint, full affected assertions and repetition baseline |

Prior evidence remains immutable and valid as a historical statement about its
exact identities; it cannot certify a new version. Promotion and invalidation
records are themselves immutable governance evidence.

## Deterministic Selection Policy

Selection is a pure, versioned, independently reconstructible function. Its
inputs are the accepted product role manifest and change set; release/operation
type; requested target; mandatory-core policy version; impact/dependency and pack
registry versions; pack maturity/status; explicit suite requests; scheduled-full
policy; approved exclusions; adapter/capability availability; and all five
identity inputs. Configuration, working-tree state, or an LLM suggestion outside
these inputs has no authority.

Its output is a canonical selection record containing every selected exact pack
version, one or more origin reasons (`mandatory-core`, `impacted-domain`,
`dependency`, `explicit-suite`, `scheduled-full`, `release-operation`), stable
topological order, prerequisite/effect/adapter/capability/cleanup requirements,
explicit exclusions, unmapped or blocked inputs, full-regression decision, and
selection digest. The final evidence carries enough inputs for the independent
validator to recompute the same record.

The deterministic algorithm boundary is:

1. validate product/harness roles, fingerprints, target/operation, registry and
   policy versions, explicit request, and exclusion authority;
2. add the approved mandatory core;
3. map every changed product/runtime/migration/config/dependency input to its
   owning domains and add their eligible packs;
4. expand the required pack dependency closure and reject unknown IDs, version
   conflicts, missing required edges, and cycles;
5. add explicitly requested suites and any scheduled, release-type, or
   operation-specific full-regression obligation;
6. validate exact maturity/status, environment support, adapter certification,
   capabilities, effects, prerequisites, time limits, and cleanup obligations;
7. apply only valid explicit exclusions, recompute closure, and reject any
   exclusion of mandatory core, required dependency, or operation safety pack;
8. emit the canonical selection or a fail-closed selection failure before an
   attempt and before effects.

Unknown or unmapped runtime source, migration, configuration, generated input,
dependency role, or operation rejects selection. It does not silently select
none and is not cured by labelling an unproved set “full regression.” A known
broad mapping may deliberately require full regression. An unavailable required
adapter/capability, suspended required pack, conflicting version, or dependency
cycle is a blocker; no similar-looking substitute or implicit exclusion is
allowed. An unrelated domain is excluded unless a declared, versioned dependency
or broad-change rule requires it.

An explicit exclusion requires identity, scope, reason, approving authority,
expiry, and evidence impact. It cannot turn missing mandatory evidence into a
pass. An LLM may explain the selected closure or recommend a mapping change but
cannot modify inputs or the output.

## Mandatory-Core Decision Package

The Phase 0 all-checks-always model made every declared DEV and TEST check
mandatory, so domain selection did not change execution (`audit:281-288,
1199-1218`). The retained history then recorded 34 harness failures and repeated
harness-only product-candidate/deployment churn (`audit:849-927`). This supports
neither an empty core nor another universal domain pack.

| Option | Content | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- | --- |
| MC1 all certified packs always | Every native, domain, browser, DB, and TEST pack for every change | Broad incidental signal | Recreates unrelated effects, runtime, false-block and complexity; obscures impact defects | Rejected |
| MC2 small control/provenance core plus conditional operation gates and impacted packs | Universal deterministic control checks; safety packs only when their operation/effect applies; domain packs through impact/dependency closure | Proves the release statement itself while keeping effects relevant and omissions fail-closed | Requires certified mappings and strict unknown-input rejection | **Recommended; Bill approval reserved** |
| MC3 control core plus all native aggregates | MC2 plus admin, portal, shared and future native aggregates for every change | More broad local product signal | Selects unrelated product domains and conflates native availability with universal necessity | Not recommended; native aggregates remain impact-selected unless a declared shared dependency applies |

Under MC2, the universal **mandatory control/provenance core** consists of pack
categories that prove:

- role-manifest and changed-input completeness, with unknown-input rejection;
- all five identities, cross-repository fingerprints, source stability and drift;
- plan/schema/canonical/digest validity and selected-scope/dependency
  reconstruction;
- prerequisite, declared-effect, capability, timeout, cancellation, cleanup and
  residue-obligation completeness before dispatch; and
- final lineage, missing/partial evidence, independent validation, and advisory
  handoff integrity.

The following are **operation-triggered mandatory safety categories**, not
universal core: build readiness for an artifact build; exact environment identity
and capability preflight before environment use; metadata/schema preflight before
database access; deployed provenance, target health, and rollback usability for a
deployment; and cleanup/recovery/residue verification for any stateful effect.
They are mandatory whenever the declared operation requires them.

Native unit/contract aggregates and domain-specific browser, workflow, privacy,
payment, intake, CFA, AI, and Intacct checks are impact/dependency-selected.
Their importance does not make them universally relevant. Exact future pack IDs
and final core manifest bytes belong to implementation planning, not Sprint
`1F`. Bill must approve MC2 before Phase 1 can exit; recording it here does not
authorize selection changes.

## Full-Regression Governance

- **Explicit full:** an authorized operator may request a named, versioned full
  suite; the request, target, effects and selected closure are evidence inputs.
- **Scheduled full:** an approved schedule/policy identifies cadence, scope,
  product baseline, target and effect authorization. A schedule cannot supply
  missing TEST-effect authority.
- **Release/operation full:** versioned policy may require full regression for a
  major or emergency release, shared-runtime or cross-cutting auth/privacy change,
  shared schema/migration, broad dependency-lock closure, registry/policy change,
  or other explicitly mapped global input.
- **Fail-closed full:** a known mapped broad change selects full regression. An
  unknown/unmapped input rejects the plan until mapping is corrected; running
  everything is not proof that the unknown was covered.
- **Expensive TEST:** requires explicit TEST-effect authorization, proved
  environment/capabilities, certified adapters/packs, fixture and cleanup plans,
  and independent validation. Availability is not authorization.
- **Disagreement:** a difference between impacted selection and a full run is
  retained as a mapping/coverage finding with both selection digests. A full-run
  result does not silently rewrite the impact policy, and an impact selection
  cannot discard a full-run failure.

Full regression remains available for breadth and discovery. Its existence does
not justify the time, stateful effects, and unrelated failure surface of every
pack on every candidate.

## Dependency and Impact Mapping

Under O1, the bounded admin qualification area owns the canonical versioned
registry mechanics. Product-domain owners approve mappings for their source,
contracts, selectors, migrations, configuration and native tests; mappings that
cross repositories or shared runtime require every affected owner plus
independent registry validation.

The registry maps canonical role-manifest paths/components and operation types to
product domains, then domains to exact eligible packs. It separately records
pack-to-pack prerequisites, adapter/capability needs, shared-runtime edges,
migration/schema consumers, configuration effects, generated-source provenance,
and dependency-lock closure. It never infers a dependency from a previous run.

- Product-role generated files and lock/dependency changes affect the product
  candidate and all mapped consumers; harness/test-pack generated files affect
  harness/pack identities instead. Ambiguous roles fail closed.
- A migration maps to every declared schema consumer and the applicable database
  safety/full-regression rule. A configuration change is product, harness, or
  environment input according to the accepted role model, never filename alone.
- Mapping/version changes alter `harnessVersion`, invalidate selector
  certification, and require independent review. They do not rewrite historical
  selections.
- Deterministic mutation tests must delete each required edge and prove omission
  is rejected; add an unrelated edge and prove prohibited over-selection is
  detected; introduce an unknown input, bad pack ID, conflict and cycle; and
  exercise shared, migration, generated and dependency-lock cases.

This is the policy boundary required by plan `:238-250`; executable registries
and mutation tests remain later work.

## No-Loss Coverage Governance

Coverage transition is a ledger, not an implication. Each legacy check, child,
native assertion and lifecycle obligation must link to an exact future pack
version, contract/assertion IDs, disposition, certification evidence, maturity,
and eventual cutover approval. `retain` preserves the bounded capability;
`wrap` preserves native assertions behind new mechanics; `repair` preserves
coverage after evidenced correction and recertification; `replace` transfers
every mapped obligation before retirement. No legacy authority is removed until
its replacement is mandatory and independently validated, or Bill explicitly
accepts documented coverage loss. Suspected gaps remain `unmapped` and cannot be
reported as covered.

The following transition matrix covers all 28 current check IDs from audit
`:1162-1198`. Names in the future-obligation column are conceptual coverage
families, not executable manifests or approved implementation names.

| Existing check | Phase 0 disposition | Future pack/coverage obligation and no-loss boundary |
| --- | --- | --- |
| `inventory-contract` | repair | Control/input-registry validation; preserve inventory/schema/runner-reference fail-closed checks and add transitive closure proof |
| `admin-aggregate` | wrap | Admin native unit/component aggregate; preserve frontend and backend native assertion discovery/exit semantics behind controlled execution |
| `portal-aggregate` | wrap | Portal native unit/component aggregate; preserve CRACO and backend `node:test` discovery/exit semantics |
| `admin-lint` | retain | Admin static-quality pack; retain current `src` scope until an explicit owner-approved scope change |
| `portal-lint` | retain | Portal static-quality pack; same explicit-scope obligation |
| `privacy-route-static` | retain | Privacy route source-contract pack; preserve required/forbidden tripwires and keep it explicitly non-runtime proof |
| `real-mysql-schema-preflight` | wrap | DEV database identity/schema prerequisite pack; exact metadata-only identity/DDL and zero ordinary statements |
| `schema-plan-dev` | wrap | Migration-plan/ledger pack; canonical checksums, ledger and pending plan plus structured identity evidence |
| `real-mysql-contract` | wrap | DEV transactional contract pack; guarded runtime assertions, rollback and eight residue checks |
| `admin-build` | retain | Admin build/readiness pack; isolated build, both generated-file restoration and clean source/temp state |
| `portal-build` | repair | Portal build/readiness pack; preserve compile contract and restore every transitive generated file |
| `admin-browser-suite` | repair | Local admin browser parent/collection pack; preserve all 13 attributable children, build/server mechanics, ordered results and artifacts with bounded process cleanup |
| `privacy-erm-db` | wrap | DEV privacy relational pack; exact-target read-only ERM/relationship assertions |
| `payment-db-rollback` | repair | DEV payment transactional pack; preserve payment/workflow assertions, bind DEV only, rollback from transaction start, prove residue |
| `intacct-local-contract` | retain | Intacct source-fidelity pack; retain narrow PATH/mock literal drift detection and do not claim Sage/runtime certification |
| `ai-guidance-contract` | retain | AI fixture-shape pack; retain schema/ID/status shape authority only, not model accuracy |
| `candidate-source-stability` | repair | Mandatory control source-stability pack; before/after role fingerprints, clean/dirty policy, exact drift evidence |
| `test-deployment-provenance` | repair | Operation-triggered TEST provenance pack; exact deployed artifact/schema/content identity, not source-only inference |
| `test-rollback-readiness` | replace | Operation-triggered rollback-usability pack; prove artifact existence, integrity, accessibility and bounded recovery, not URI text |
| `test-target-health` | wrap | Operation-triggered TEST target-health pack; exact account/profile/region and every registered target's identity/health |
| `test-runtime-postflight` | repair | TEST runtime/postflight pack; package/runtime/provenance/migration/metrics/recent-error proof with bounded transport |
| `test-two-step-role-journeys` | replace | Modular two-step domain packs; preserve every mapped role/owner/stage/prerequisite/decision/multi-item/PDF/notification/concurrency/idempotency assertion plus cleanup/recovery and residue coverage |
| `test-intake-completion` | repair | TEST R1 intake pack; exact identities/schema, completion/replay/idempotency and independently recoverable DB/object/event/notification/Cognito cleanup |
| `test-cfa-signing` | repair | TEST CFA pack family; preserve schema preflight and signing/PDF/object/event/retry assertions while removing cross-repo import and cleanup gaps |
| `test-applicant-scope-browser` | repair | TEST applicant-scope pack; preserve wrong-owner API/browser evidence with bounded transport and fail-closed identity/progress/cleanup proof |
| `test-live-privacy-denials` | repair | TEST privacy-denial pack; preserve all real-token route denials and add route-effect cleanup, bounded output/cancellation and residue proof |
| `test-payment-rollback` | repair | TEST payment/postflight pack; preserve native payment assertion binding after postflight transport/mode repair and exact TEST proof |
| `test-maintenance-cleanup` | repair | TEST maintenance-status pack; preserve inspection-only ALB/fallback status meaning, rename/represent it without claiming cleanup execution |

The browser collection additionally tracks every current child independently;
the parent cannot flatten their results. Evidence is audit `:316-338` and the
disposition matrix at `:1092-1106`.

| Existing browser child | Future coverage obligation | Transition rule |
| --- | --- | --- |
| `app-shell-navigation` | Shell/sidebar loopback UI pack | Wrap; retain navigation/stub assertions and existing `finally` shutdown |
| `esdc-participant-queue` | Participant-queue UI pack | Repair exceptional shutdown; preserve prepare/submit payload/state assertions |
| `case-assignment-dashboard` | Case-assignment UI pack | Repair exceptional shutdown; preserve assignment/search/bucket assertions |
| `home-overdue-queue` | Overdue-queue UI pack | Wrap; preserve resolve/reassign assertions and `finally` cleanup |
| `manual-application-intake` | Manual-intake UI pack | Wrap; preserve create-application payload and state assertions |
| `manage-components-dashboard` | Components-dashboard UI pack | Repair exceptional shutdown; preserve preview assertions |
| `modify-component-editor` | Component-editor UI pack | Repair exceptional shutdown; preserve save/render/validation payload assertions |
| `application-overview-docs-requested` | Application-overview documents UI pack | Repair general exceptional shutdown; preserve optimistic-lock/persistent request assertions |
| `application-workspace-dashboard` | Workspace-dashboard UI pack | Repair exceptional shutdown; preserve widget/lock/document/message/note assertions |
| `application-assessment-workflow` | Assessment-workflow UI pack | Wrap; preserve all fourteen role/state journeys and bounded `finally` behavior |
| `intervention-posting-context` | Intervention-posting UI pack | Wrap; preserve PATCH context/state assertions |
| `intervention-assessment-recall` | Intervention-recall UI pack | Wrap; preserve recall request/state assertions |
| `intervention-assessment-workflow` | Intervention assessment/review UI pack | Repair scenario enumeration, persistent-transition assertions and rerender/toast weaknesses; preserve every owner/role/return/resubmit/sign-off/follow-up scenario |

The 28-check and browser-child tables are the product/check coverage view. The
following Phase 0 component-ledger view prevents the other control-plane, native
helper, and documentation units from disappearing. IDs and dispositions refer
to audit `:1020-1160`; grouped IDs preserve every named unit within each row.

| Phase 0 units | Future ownership/coverage obligation |
| --- | --- |
| CP01 | Preserve the qualifier/deploy operator command compatibility boundary while the implementation behind it changes; exact compatibility is decided in migration, not inferred. |
| CP02, CP04 | Repair into O1 role/pack/impact registry and validator coverage, including transitive commands, maturity, effects, identities and unknown/cycle/omission negatives. |
| CP03 | Retain deterministic match, dependency expansion, stable sort and dedup primitives only after future-policy certification. |
| CP05 | Retain canonical JSON/file hashing primitives under `RQ-C14N-1`; certify caller scope, missing files and path/symlink rules. |
| CP06 | Replace conflated candidate identity with the five-identity service while preserving exact Git/tree/dirty/migration facts as typed inputs. |
| CP07 | Repair into the mandatory source-stability control category with detailed before/after role drift evidence. |
| CP08-CP09 | Replace with the minimal kernel and process-control adapter; preserve deterministic blocking, command/cwd/timing/exit/log facts. |
| CP10-CP11 | Replace with the six-schema evidence graph and independent validator; preserve valid current stage/release/check/blocker/expiry facts. |
| CP12-CP13 | Repair log/child linkage and DEV-to-TEST prerequisite admission; preserve separate diagnostics and exact upstream revalidation. |
| CP14-CP15 | Repair deploy admission and deployment manifest/journal under existing authority; migration keeps advisory evidence non-authoritative until cutover approval. |
| CP16-CP18 | Repair deployed provenance/package markers; replace string-only rollback readiness; prove deployed content/schema and usable rollback. |
| CP19 | Retain immutable bundle/descriptor/hash primitives as deployment-artifact coverage, with existence/recoverability certified separately. |
| CP20-CP21 | Preserve the detailed two-step artifact verification while replacing bespoke/generic stdout/SSM transport with the certified remote/evidence boundary. |
| CP22 | Replace ignored-local retention with Bill-approved R4 durable evidence/catalog/cache direction; operations remain `1G`. |
| CP23-CP24 | Retain admin restoration and repair portal restoration as build-adapter obligations, including every generated output and clean-source proof. |
| CP25 | Repair the runbook after approved architecture/migration so every claimed prerequisite, effect, evidence and admission rule matches executable authority. |
| CP26 | Replace hand-rolled SSM polling with certified remote cancellation/termination/late-result mechanics, preserving target/command/status facts. |
| RN01-RN04 | Wrap both aggregate shells and retain all four native React/Jest/CRACO/node-test assertion engines as separately traceable pack bindings. |
| RN05-RN09 | Retain the two linters, privacy tripwire, Intacct source audit, AI shape checker and canonical DB guard with their deliberately narrow authority. |
| RN10-RN14 | Map all DEV schema, migration, transaction, privacy and payment assertions to the corresponding 28-check obligations; wrap or repair lifecycle mechanics exactly as Phase 0 records. |
| RN15 | Retain both build-info writers as build-adapter inputs; callers own generated-file inventory/restoration and deterministic-byte proof. |
| RN16-RN19 | Preserve the parent and all 13 browser child assertion sets through the explicit child ledger above; repair parent/child lifecycle and the seven evidenced child weaknesses before certification. |
| RN20-RN22 | Preserve TEST target-health, all three postflight modes, and the migration-ledger/runtime-metrics/maintenance helper trio as separately attributable operation packs/helpers. |
| RN23-RN24 | Replace the main two-step monolith without assertion loss; separately wrap and preserve its relationship-resolving cleanup-stamp/recovery capability. |
| RN25-RN31 | Preserve R1, TEST identity, CFA preflight/wrapper/portal child, both applicant modes, and privacy-denial assertions under their explicit check rows and adapter/cleanup repairs. |
| RN32-RN33 | Keep the shared state test and portal standalone workflow smoke visible as unresolved wrap candidates; neither has current qualification authority. |
| DC01-DC07 | Retain the canonical agent safety contract, controlling plan, Phase 0 evidence, testing authority boundary, Intacct/AI corpora, and severity scale as versioned contract/governance inputs with their stated limits. |
| DC08-DC10 | Preserve the assurance/workflow/changelog historical contracts but repair only directly evidenced count/timing errors under separate documentation authority; missing history is never reconstructed. |

This component ledger, the 28-check matrix, and the 13-child matrix together
cover the accepted 88-unit inventory without declaring migration complete.

The following suspected/unresolved coverage remains visible and **not covered**:

- shared `applicationAssessmentReviewState.test.js` runner/ownership and the
  portal standalone `smoke:portal:workflow` overlap/intent;
- ordinary Intacct mock candidate ownership and the unexplained cleanup SQL;
- aggregate outbound-network effects, ignored/ambient prerequisites, screenshot
  retention, and third-party forced-close behavior;
- no-real-email proof, payment rollback before first insert, two-step remote
  termination overlap, R1 independent recovery ownership, and privacy mutation
  cleanup.

These gaps are recorded at audit `:1372-1385`. They require separately authorized
mapping or certification evidence and cannot be silently marked retained,
repaired, replaced, mandatory, or complete.

## Selection and Certification Verification Matrix

All proofs below are later deterministic synthetic/local certification unless a
separately authorized TEST row explicitly applies. Sprint `1F` executes none.

| Case | Required deterministic proof | Negative/mutation case | Later acceptance evidence |
| --- | --- | --- | --- |
| Product-domain change | Exact role/path maps to owning domain packs plus core and dependencies | Delete one required mapping edge | Reconstructed selection matches expected closure; omission rejects |
| Shared-runtime change | All declared cross-repository consumers selected | Remove one consumer or add an unrelated consumer | Multi-owner registry approval and exact inclusion/exclusion set |
| Migration/schema change | Schema consumers, DB prerequisite and policy-required full set selected | Unknown table/consumer or missing schema edge | Selection rejection or exact required closure before effects |
| Configuration change | Role decides product, harness, or environment identity and mapped packs | Ambiguous/unknown role | Fail-closed identity/selection evidence |
| Unknown file/operation | No selection is accepted | New unmapped runtime file and unknown operation | `unmapped` failure before attempt/effect; full label cannot bypass |
| Dependency expansion | Stable topological transitive closure | Remove required edge, introduce conflict/cycle | Exact origins/order or deterministic rejection |
| Unrelated-domain exclusion | Only declared dependencies add other domains | Mutation adds spurious edge | Validator detects over-selection and mismatched digest |
| Explicit/scheduled/full | Request/policy identity deterministically adds full suite | Stale request, unauthorized TEST effect, expired exclusion | Request/policy and authorization links; rejection as appropriate |
| Deliberate selector mutations | Every required inclusion and prohibited omission is exercised | Bad pack ID, duplicate/conflicting version, unavailable adapter | Exact selection failure reason and no dispatch |
| Known-good pack | Contract-verified candidate yields expected native result and validated evidence repeatedly | Stale fingerprint or wrong pack version | 10 consecutive local or 3 post-adapter TEST attempts as applicable |
| Deliberate product failure | Native verified assertion fails for intended contract reason | Wrapper also fails or evidence is insufficient | `product` only when product evidence is sufficient; otherwise separate class/stop |
| Harness/fixture failure | Fixture/parser/selector defect is distinguished from product behavior | Omit prerequisite or corrupt fixture/result | `harness`, dependent mutation blocked, required partial evidence |
| Environment failure | Proved target differs from required environment contract | Wrong account/region/host/configuration | `environment`, no unauthorized effect |
| Infrastructure failure | Independent service/runtime/transport fact supports class | Access denial, network/runtime loss, partial operation | `infrastructure` only with sufficient independent facts; otherwise `unclassified` |
| Timeout/cancellation/interruption | Bounds, signals, termination and partial evidence are exact | Ignore graceful stop; force process-tree/remote interruption | Termination proved before cleanup; no orphan/late-result acceptance |
| Cleanup/residue failure | Owning cleanup runs only after termination and residue is independently asserted | Cleanup nonzero, interrupted verification, deliberate residue | Cleanup success is not zero residue; incomplete residue blocks final acceptance |
| Pack promotion | Exact version satisfies all maturity and certification entry rules | Single pass or genuine defect discovery without repetition | Independent promotion record; no release influence before mandatory |
| Certification invalidation | Every listed change creates required identity/version and maturity consequence | Reuse old version/evidence after change | New version rejected until scoped recertification; old evidence remains historical |

## Governance and Authority

| Decision/action | Producer or proposer | Independent validator/approver | Prohibited authority |
| --- | --- | --- | --- |
| Create/version pack | Accountable domain pack maintainer in owning repository/domain | O1 registry validates identity, manifest and ownership | Kernel, selector, LLM, or unrelated repository cannot invent semantic coverage |
| Verify product contract | Product/contract owner with versioned source | Reviewer independent of pack implementation where practical | Pack execution success or historical behavior is not contract proof |
| Certify pack | Qualification certifier using exact versioned corpus | Independent evidence validator; environment/effect authority where applicable | Pack author alone cannot self-certify |
| Promote/downgrade maturity | Pack owner/certifier proposes with evidence | Qualification governance; Bill approves mandatory-core policy and material release authority | Pass count, defect discovery, LLM, or kernel cannot auto-promote |
| Suspend/quarantine | Kernel may fail closed on invalid evidence; owner/certifier records safety event | Qualification governance validates disposition | Suspension cannot be used to omit required coverage and issue `GO` |
| Change impact/dependency mapping | Relevant domain owner; all owners for shared/cross-repo edge | O1 registry review plus independent mutation-test validation | Selector/LLM cannot learn or infer an authoritative edge from history |
| Approve product selector/assertion | Product/contract owner | Independent contract/coverage review and pack recertification | Harness maintainer cannot change semantics for convenience |
| Approve mandatory core | Architecture provides recommendation | **Bill** | Implementation, LLM, selector, or pack owner cannot set release-wide policy |
| Request/schedule full regression | Authorized operator or approved scheduler policy | Plan validator; Bill/authorized operator for TEST effects | Mere suite availability or LLM recommendation is not authority |
| Authorize TEST effects | Bill or separately documented operational authority for the exact attempt/scope | Environment/effect admission and adapter proof | Credentials, connectivity, schedule, or pack maturity do not authorize effects |
| Accept qualification evidence | Independent evidence validator accepts validity; deploy admission applies controlling policy | Existing release/deploy authority during advisory migration | Producer, kernel, pack, schema validity, local cache, or LLM cannot issue release authority |

The LLM may inventory, compare, surface anomalies, draft classifications and
recommend policies. It never owns deterministic selection, certification,
maturity, contract verification, effect authorization, evidence acceptance, or
`GO/NO-GO`.

## Sprint 1F Decision and Verification Record

| ID | Evidence / accepted invariant | Chosen or recommended rule | Rejected alternative | Tradeoff / later verification |
| --- | --- | --- | --- | --- |
| 1F-D01 | Plan `:77-91`; audit `:1199-1247` | One immutable normative pack manifest with closed extensions | Unbounded per-pack prose | More registry discipline; validate required-field and forbidden-ambient negatives |
| 1F-D02 | O1; Sprint `1B` identities | Manifest/runner/dependency bytes contribute to pack and harness identities, never automatically product ID | Single combined release fingerprint | More role manifests; certify role mutations |
| 1F-D03 | Audit `:840-907,1199-1247` | Native runner owns verified product semantics; harness owns mechanics/evidence | Kernel reinterpretation or exit-only pass | Requires structured native results; certify wrapper-vs-product failures |
| 1F-D04 | Audit `:1027-1160` | Wrap/repair/replace preserves assertion-level coverage with exact no-loss ledger | Disposition implies automatic migration | Ledger overhead; cutover proof in `1G`/later phases |
| 1F-D05 | Plan `:77-108` | Four maturity levels plus separate active/suspended/quarantined/retired state | One status conflating certification and operability | Extra state transitions; lifecycle/schema proof later |
| 1F-D06 | Plan `:90-108`; audit `:840-927` | Promotion requires full evidence, not one pass or a found product defect | Trust elapsed use or success count alone | Higher setup cost; negative corpus and independent review |
| 1F-D07 | Plan `:95-108`; audit `:695-927` | Retain 10 local / 3 TEST minimum baseline unchanged | Lower unsupported threshold or raise without evidence | Runtime cost retained; later measured data may support a separately approved revision |
| 1F-D08 | Sprint `1D`/`1E` | Adapter certification precedes dependent pack certification | Certify composite pack and infer adapters | More staged work; deliberate adapter and integration cases |
| 1F-D09 | Plan `:54-64`; Sprint `1B` | Every semantic/fixture/selector/parser/cleanup binding change versions and invalidates exact affected certification | Reuse old evidence across changed bytes | Recertification cost; mutation tests for every change class |
| 1F-D10 | Audit `:281-288,1199-1218` | Pure versioned selection from role/change/policy/registry inputs | Ambient, heuristic or LLM selection | Registry maintenance; independent recomputation proof |
| 1F-D11 | Plan `:238-250` | Unknown/unmapped runtime input rejects; full regression cannot bless unknown coverage | Select none or silently run everything | More stops on registry gaps; unknown mutation test |
| 1F-D12 | Audit `:840-927,1337-1370` | Stable dependency closure; unknown IDs/conflicts/cycles fail before effects | Best-effort ordering or runtime discovery | Less flexibility; topology mutation suite |
| 1F-D13 | Audit `:281-288,1199-1218` | Recommend MC2 small control/provenance core | Preserve all-checks-always MC1 | Mapping quality becomes critical; Bill approval and omission tests required |
| 1F-D14 | Same | Operation safety gates are conditional mandatory, not universal | Run deployment/DB/build packs for unrelated candidates | Lower irrelevant effect/risk; operation-trigger tests |
| 1F-D15 | Audit `:1199-1247` | Native aggregates are impact/dependency-selected | Put every native aggregate in universal core | Avoids unrelated domains; shared-change mapping must be exhaustive |
| 1F-D16 | Plan `:238-250` | Explicit/scheduled/release-type full remains available | No full suite or default full on every attempt | Schedule/governance burden; prove both impacted and full reconstructions |
| 1F-D17 | Plan `:22-28`; audit `:1337-1370` | TEST full/effects need explicit authority and proof | Treat schedule/credentials as authority | Possible scheduling delay; denial/no-effect certification |
| 1F-D18 | O1; audit `:1248-1317` | Central registry mechanics, domain-owned semantics, multi-owner cross-repo edges | Central team guesses domain mapping | Review coordination; cross-repo mutation tests |
| 1F-D19 | Audit `:1027-1198` | Every 28 check IDs and 13 browser children has an explicit obligation | Component summary alone implies coverage | Larger ledger; assertion-level trace in migration |
| 1F-D20 | Audit `:1372-1385` | Unresolved/suspected gaps remain visibly unmapped | Treat adjacent pack as implicit coverage | Blocks premature completeness; later authorized mapping needed |
| 1F-D21 | Sprint `1D` validator | Selection, promotion and invalidation are independently reconstructible evidence | Trust mutable catalog state | More durable records; replay/stale/conflict negatives |
| 1F-D22 | Plan `:22-28,65-76` | LLM is recommendation/explanation only | LLM owns selection/classification/promotion | Less adaptive authority; deterministic outputs remain auditable |

No Sprint `1F` rule changes accepted identity, authority, O1 ownership, R4,
lifecycle, schema, or adapter architecture. D16 is resolved at design level with
the unchanged baseline. D17 has a technical recommendation, but its mandatory-
core policy remains a Bill-reserved release-risk decision.

## Decisions Reserved for Bill

1. **Mandatory-core policy:** approve or reject recommended MC2: universal
   control/provenance categories, operation-triggered safety categories, and
   dependency-expanded impacted-domain packs. This decision is required before
   Phase 1 exits; it does not itself migrate the current gate.
2. **Sprint `1G`:** separately authorize documentation-only integration of the
   advisory migration/rollback, R4 operating decision package, exact Phase 2
   file scope, architecture acceptance, and release-admission transition.

No certification-threshold change is requested: Sprint `1F` recommends and
records the existing 10/3 baseline. R4 provider/durations/access/legal hold/
deletion/operating ownership/cost, migration disagreement/emergency policy, and
Phase 2 file scope remain reserved exactly as before.

## Sprint 1F Files, Effects, and Verification

Examined:

- `docs/AGENTS.md` for SQL/schema, AWS/fixture, selector, documentation, and
  bounded-sprint authority;
- the controlling plan's identities, test-pack contract, promotion baseline,
  Phase 1 deliverables, impact-selection phase, checkpoint, and Sprint Ledger;
- the Phase 0 audit's runner/effect maps, all 28 check dispositions, all 13
  browser children, historical taxonomy, trusted native assets, duplication,
  constraints and unresolved coverage gaps; and
- the accepted target architecture's charter, O1 identity/authority/lineage,
  Sprint `1C` lifecycle, Sprint `1D` evidence/R4, and Sprint `1E` adapter/effect
  contracts.

Changed only:

- this target-architecture document; and
- the controlling plan's checkpoint and Sprint Ledger.

Verification was documentation-only static review of the required manifest
fields; native authority; four maturity levels; promotion/regression/suspension/
removal; unchanged 10/3 thresholds; 13 invalidation classes; deterministic
selection inputs/outputs/failures; three core options; full-regression rules;
mapping ownership and mutation tests; all 88 Phase 0 component units; all 28
checks; all 13 browser children; unresolved gaps; 18 verification cases;
governance authorities; and 22 traced
decisions. No executable manifest, pack, selector, mapping, certification tool,
schema, adapter, product/harness/test/config/IAM change, test/build/workflow,
SQL/database, AWS, browser, HTTP, deployment, fixture, TEST, PROD, or other
environment operation was authorized or performed.

One combined baseline read exceeded the display/context budget and returned no
content; it was replaced by bounded read-only source slices. This was an
explained local display limitation, not an unexplained operational failure. No
strategy conflict, blocker, course correction, or automatic-stop condition
occurred.

Final worktree state: admin remains on `main...origin/main` with the pre-existing
modified `docs/AGENTS.md`,
`docs/ops/deployments/release-qualification-runbook.md`, and
`docs/planning/README.md`, plus the pre-existing untracked Phase 0 audit,
controlling plan, and target-architecture files. Sprint `1F` changed only the
target-architecture and controlling-plan files. Portal and shared remain clean
on `main...origin/main`. Intacct mock remains the non-Git directory established
in Phase 0 and was not re-probed. No pre-existing user change was reverted or
overwritten.

## Sprint 1F Completion Decision

Sprint `1F` is complete at the documentation-architecture level. The modular
pack contract, native-runner authority, maturity/certification and invalidation
policies, deterministic selection boundary, mandatory-core/full-regression
recommendations, dependency governance, no-loss transition ledger, verification
matrix, governance model, and decision record are complete. No pack was created,
executed, migrated, certified, promoted, suspended, or made authoritative.

The exact decision/approval required for proposed next work is: **Bill approves
or rejects mandatory-core recommendation MC2 and, if continuing, explicitly
authorizes Sprint `1G` of Phase 1 for documentation-only architecture integration,
advisory migration/rollback and admission design, the R4 operating decision
package, final acceptance criteria, repository/file ownership, and exact Phase 2
file-scope proposal, with no implementation, migration, workflow, environment
access, or later-phase work.**

## Sprint 1G Outcome

Sprint `1G` integrates the accepted O1, R4 and MC2 decisions with the five
identities, independent authority, lifecycle, six evidence artifacts, adapters,
pack maturity/certification and no-loss ledger. It completes the analytical
architecture for advisory migration, rollback, operations, retention and the
smallest proposed Phase 2 scope. It changes no current authority or executable
system.

MC2 is now accepted exactly as approved by Bill: a universal deterministic
control/provenance core, operation-triggered safety gates, dependency-expanded
impacted-domain packs, and explicitly requested or scheduled full regression.
The current release gate remains the sole admission authority throughout every
advisory phase and until Bill separately approves a future admission change.

## Advisory Migration Strategy

### Preconditions for Advisory Operation

No advisory execution may begin until all conditions applicable to its scope are
proved:

1. Bill has approved the completed Phase 1 architecture and the exact next-phase
   file/effect boundary.
2. The kernel, six executable schema versions, identity/canonicalization rules,
   selector boundary, process control and independent validator have completed
   the Phase 2 certification gate using synthetic assets only.
3. Every adapter and pack to be invoked is certified for the exact version,
   capability, environment class and effect; its owner, contract, direct native
   command, timeout, cleanup and residue obligations are registered.
4. The current gate, deploy admission, release runbook and direct native command
   remain unchanged and available as the comparison authority.
5. Product, harness, attempt, environment and pack identities are reproducible;
   harness-only changes do not alter the candidate.
6. R4 durable originals, catalog, validation read path, sensitivity controls and
   investigation access are operationally approved and certified for the phase's
   evidence class before Phase 9. Earlier purely local certification may retain
   bounded test artifacts under its separately approved test scope.
7. Selection inputs and expected current/advisory scope are frozen before each
   comparison. Unknown scope, missing direct-command contract, unavailable
   certified capability or unresolved residue stops the attempt.

These conditions derive from the plan's advisory requirement at `:22-28`, Phase
2-10 gates at `:168-305`, and the audit's identity/evidence/churn findings at
`release-qualification-harness-current-state-audit-2026-08-10.md:750-768,
849-927,944-968`.

### Ordering and First-Check Criteria

Within the controlling phases, implementation order is: executable schemas and
independent schema validation; identity/canonicalization; synthetic selector and
lifecycle kernel; bounded local process/evidence path; read-only local native
bindings; process/build, HTTP and one browser adapter/pack; database safety;
MC2 mappings and remaining local packs; read-only TEST; one bounded stateful TEST
pack; advisory parallel operation; then controlled promotion.

The first migrated checks must be locally executable, read-only, deterministic,
short-running, independently owned, free of browser/database/AWS/HTTP/deployed
effects, and have a stable direct command plus deliberate known-good and bad
case. Their native runner remains semantic authority. The audit supports source
inventory/validation, lint, static tripwires and native aggregates as the Phase 3
candidate categories, subject to per-pack contract and effect certification
(`audit:1162-1198,1199-1247`). This is a criterion, not a migration selection or
authorization.

### Direct-Command and Dual-Boundary Comparison

- A comparison binds one frozen `productCandidateId`, native command/cwd,
  dependency fingerprint and declared environment to both paths. The direct
  command runs outside the advisory kernel under its existing native contract;
  the advisory path runs through the new kernel. Each receives a distinct
  `attemptId`; neither artifact is relabelled as the other.
- Compare native assertion identifiers/status, exit/termination outcome,
  declared scope, duration bounds and structured evidence. Raw log bytes,
  timestamps and incidental formatting need not be equal; differences are
  interpreted only through accepted structural/canonical rules.
- The current gate continues its normal execution and emits its native evidence.
  Deploy admission consumes only evidence accepted by the current path. Advisory
  output is visibly marked `advisory` and cannot clear, weaken or replace a
  current blocker.
- Read-only direct/advisory commands may run separately against the same frozen
  source when their no-effect declaration is certified. Stateful comparison uses
  different attempt-bound fixtures and separately authorized effects; it never
  shares or races a fixture merely to save time.
- Product, harness and pack changes discovered during comparison require a new
  version/plan/attempt. A disagreement never authorizes either system to rewrite
  the other, patch a fixture, alter a selector, change the candidate, redeploy,
  or rerun tactically.

### Disagreement and Observation Window

Every semantic scope/result/classification/cleanup/admission difference creates
the immutable disagreement record defined below. Until deterministic evidence
establishes a cause, its primary class is `unclassified`, promotion stops, and
the current gate remains authoritative. A correction follows the normal owner,
version, invalidation and recertification route, followed by a new `attemptId`.

Phase 9 observation may open only when all included components are at least
`candidate`, R4 and the comparator are certified, current admission remains
unchanged, all prior cleanup is resolved, and no open unclassified certification
or direct-command disagreement affects the scope. The recommended minimum exit
window is both 30 calendar days and 10 ordinary change candidates, including
every release/operation type proposed for promotion and at least one approved
full regression. Any material harness/pack/selector/adapter/policy change resets
the affected component's observation count; an unexplained disagreement or
cleanup/residue failure pauses the whole affected promotion cohort.

Exit requires complete durable evidence, no unexplained disagreement, all
deterministic differences resolved and recertified, no open residue, stable
selection/evidence, a reviewed rollback exercise, and a written cohort-specific
cutover recommendation. The 30-day/10-candidate operating minimum and cohort are
recommendations requiring Bill's transition approval; recording them creates no
execution authority.

### Promotion and Retirement Prerequisites

Promotion is cohort-based so the control/provenance core, validator and required
operation gates cannot be separated from a domain pack. For each pack:

- exact versions are certified and `mandatory`; assertion/contract/no-loss links
  are complete;
- direct/current/advisory comparison and the observation window have no open
  disagreement or residue;
- deploy admission's new-evidence path has synthetic and shadow validation,
  immutable policy versioning, rejection cases and a proven rollback to the
  prior admission version;
- current evidence remains required during partial promotion. New evidence may
  add a blocker but may not waive a current-gate blocker or supply missing legacy
  authority; and
- Bill explicitly approves the named cohort, admission-policy version, start/end
  of observation and rollback authority.

Legacy machinery may retire only after every assertion, effect and recovery
obligation is mapped to an independently certified mandatory replacement or Bill
explicitly approves documented loss; no current or rollback admission path uses
it; retained evidence remains readable; runbooks/registry are updated; rollback
period closes without unexplained disagreement; and Bill explicitly authorizes
the named files/checks. PROD use remains a separate release decision.

## Phase 2-10 Migration Sequence

The table keeps every controlling phase boundary unchanged. Phase-specific exit
criteria are cumulative with the common promotion baseline. Thus Phase 3's five
identical advisory comparisons do not replace the ten-run certification minimum;
they prove an additional direct-command comparison property.

| Stage | Prerequisites and inputs | Allowed effects and deliverables | Verification | Rollback and stopping point | Exact next authorization |
| --- | --- | --- | --- | --- | --- |
| Phase 2 - pure local kernel | Accepted Phase 1 and exact files; synthetic plans/commands/clocks/temp fixtures only | Writes only harness-owned local test/evidence/temp paths; implement isolated schemas, identities, kernel, process control, events/evidence and validator | All 25 Sprint `1C` cases plus schema negatives, ten clean runs, forced interruption, cleanup, drift, deterministic bytes, focused coverage, `git diff --check` | Quarantine defective `harnessVersion`; remove no legacy authority; stop after Bill reviews Phase 2 evidence | Bill authorizes Phase 3 read-only local check scope/files; no implicit continuation |
| Phase 3 - read-only local checks | Certified Phase 2; exact pack contracts/direct commands; verified no-effect boundary | Wrap/migrate source inventory, native aggregates, lint, static analysis and source stability; no DB/AWS/browser/HTTP/deployed effects | Pack certification baseline plus five consecutive advisory/direct-command matches and deliberate native failure | Disable/quarantine affected advisory pack/version; current gate/direct commands unchanged; stop after review | Bill authorizes the first Phase 4 process/build prompt and exact files/effects |
| Phase 4 - process/build, HTTP, browser | Certified prior layer; separately approved adapter/pack prompt in controlling order | Local process/build and generated restoration, then loopback HTTP, browser mechanics, then one compiled-browser pack; no external service/DB | Each adapter's 10-good/all-bad/interruption certification before next; one browser pack proves stable selector/persistent state/no external network | Quarantine only affected adapter/packs; restore source/process/socket state; current gate unchanged; stop after each of four prompts | Bill authorizes each next Phase 4 substage, then separately Phase 5 DB scope |
| Phase 5 - database adapter/local transaction | Certified kernel/process; exact approved target and live-schema task authorization; accepted statement grammar/tool | Only the exact metadata, read-only, transactional synthetic fixture and cleanup effects authorized per substage | Identity/DDL, per-statement admission, rejection, rollback, forced interruption and independent zero residue | Stop ordinary SQL on any proof failure; close pre-mutation without cleanup SQL; post-mutation guarded recovery; current gate unchanged | Bill authorizes each ordered DB substage and then Phase 6 only after adapter certification |
| Phase 6 - impact selection/pack migration | MC2; certified component adapters; versioned role/impact/dependency registry; no unmapped runtime source | Local registry/pack migration and synthetic selection tests; no new environment effects by selection itself | Inclusion/omission mutations, dependency closure/cycles, unrelated exclusion, explicit/scheduled full, all 88-unit no-loss links | Revert/quarantine mapping/policy version, reject its evidence, leave current all-check gate authoritative | Bill reviews policy evidence and explicitly authorizes read-only Phase 7 TEST scope |
| Phase 7 - read-only TEST control plane | New prompt; explicit TEST account/profile/resources; certified remote/AWS/provenance adapters; no stateful pack | Read only identity, manifest/provenance, rollback-artifact presence, target health and bounded transport; no deploy/SQL/Cognito/S3 fixture mutation | Three repeatable attempts, stale/mismatch/denied/timeout/transport negatives and exact environment/infrastructure classes | Cancel/terminate; no cleanup mutation; quarantine adapter/evidence; current gate/admission unchanged | Bill authorizes exact Phase 8 pack, identities, effects, duration and cleanup |
| Phase 8 - first stateful TEST pack | Certified local domain tests/adapters; exact fixture/resources/preflight/cleanup; explicit TEST effects | One bounded critical domain, one deployed workflow contract, owned fixture and cleanup; never a cross-domain concurrency journey | Three clean attempts, deliberate product and harness-fixture failures, interruption recovery, zero residue | Terminate before cleanup; independent recovery/residue; quarantine pack/adapter; no rerun until residue resolved; current gate unchanged | Bill explicitly authorizes Phase 9 cohort, R4 operation and observation window |
| Phase 9 - advisory parallel operation | Candidate components, certified comparator/R4, no open relevant disagreement/residue, current gate stable | Advisory execution alongside current authority using separate identities/fixtures; immutable comparison log only | Recommended 30 days plus 10 candidates, all proposed operation classes, approved full run, no unexplained disagreement, rollback exercise | Pause affected cohort, quarantine version, current gate continues; no tactical patch/rerun | Bill approves or revises cutover recommendation and authorizes named Phase 10 cohort |
| Phase 10 - controlled promotion/retirement | Bill-approved cohort; mandatory components; certified admission integration/rollback; complete no-loss map | Pack-by-pack admission changes only under separate approval; legacy retirement only after rollback period and named authorization | Dual required evidence during partial promotion, rejection negatives, admission rollback, observation, runbook/registry trace | Restore prior versioned admission policy; current gate supplies sole authority; preserve all evidence and attempts | Bill explicitly authorizes each promotion/retirement and any separate PROD use; Phase 11 remains separate |

The database row restates, but does not authorize, the live-schema requirements
in `docs/AGENTS.md:1-22`. The TEST rows restate, but do not authorize, the
explicit AWS identity requirements at `docs/AGENTS.md:24-29`.

## Advisory Rollback Design

Rollback changes advisory component/admission versions and operating state; it
never rewrites evidence, reuses an `attemptId`, or silently changes the product
candidate. Unless product source actually changed, `productCandidateId` remains
the same and only harness/pack/policy versions and a new attempt change. Every
rollback records trigger, affected versions/attempts/candidates/environments,
authority, last valid version, evidence digests, cleanup/residue state, action,
verification and next safe step.

| Trigger | Immediate containment | Rollback target and proof | Rerun/admission rule |
| --- | --- | --- | --- |
| Defective kernel | Quarantine exact `harnessVersion`; stop its new plans/attempts; reject unfinished/final evidence | Last independently certified kernel/schema/validator set for advisory use, or advisory off; prove no producer/validator mixing | Current gate remains sole authority; any retry is a new attempt after recertification |
| Defective schema or validator | Reject all affected schema/validator versions, including apparently valid final artifacts; preserve bytes | Last compatible certified family only if the whole attempt used it; never in-place convert evidence | No cross-version relabel; regenerate by new attempt only when execution is required; evidence-only deterministic reassembly remains same attempt under Sprint `1C` rules |
| Defective adapter | Suspend adapter and every dependent pack/capability; cancel eligible work and resolve effects | Prior certified adapter only for newly planned advisory attempts after compatibility proof, otherwise disable path | No fallback adapter substitution inside an accepted plan; current gate unchanged |
| Defective pack | Quarantine exact pack version and block every selection requiring it | Prior certified pack only after selector/contract compatibility and policy allow it; preserve failed pack evidence | Required unavailable coverage blocks advisory promotion; new attempt after version selection |
| Incorrect selection/mapping | Reject every artifact using the mapping/policy version; stop affected cohort | Last certified registry/policy or corrected new version; independently reconstruct required and prohibited scope | Never patch the selected list inside an attempt; new plan and `attemptId` |
| Durable store failure | Stop advisory final acceptance; preserve sealed local partial bytes and digests as non-authoritative recovery material | Restore approved immutable store, upload under original artifact digest with interruption provenance, independently read/verify | Local cache/catalog cannot substitute for durable original; current gate only |
| Catalog failure | Stop catalog-dependent lookup/admission but retain immutable originals | Rebuild catalog solely from validated durable manifests; prove record counts/digests/query indexes | Catalog data never establishes validity; no re-execution required if durable graph validates |
| Current/advisory disagreement | Freeze versions/scope/evidence and open disagreement record | No component changes until deterministic classification and owner-approved correction | Current gate decides current release; no tactical patch, redeploy or same-attempt rerun |
| Cleanup/residue failure | Stop affected effects and cohort; prove all execution terminated; escalate resource ledger | Owning pack/adapter recovery and independent residue result; quarantine until zero residue or approved incident disposition | No rerun or new effect in overlapping scope; current gate cannot erase residue blocker |
| Advisory infrastructure outage | Cancel/terminate where possible; record partial operation and availability facts | Restore certified service/version or turn advisory off | Existing gate continues if independently healthy; outage evidence is not a release waiver |
| Partially promoted pack/cohort | Re-enable prior versioned admission policy requiring current evidence alone; quarantine new cohort | Synthetic rollback test plus shadow verification that legacy admission rejects/accepts its known cases exactly as before | Preserve promotion/admission records; new promotion needs new approval/attempt observations |
| Deploy-admission integration failure | Fail closed at admission, then invoke approved prior-policy rollback | Exact prior admission code/config version and its independent certification evidence | No emergency acceptance from advisory output; release proceeds only under unchanged legitimate current authority |

Rollback evidence uses R4 and remains linked even when the advisory system is
disabled. An affected attempt is never deleted to make a later version appear
clean. The Phase 0 harness-only candidate churn and r29 cleanup uncertainty show
why version/attempt separation and residue resolution precede rerun
(`audit:849-927`).

## Disagreement and Decision Log

One immutable `advisory-disagreement` governance record links, without replacing,
the six evidence artifacts. It is created for differing selection, status,
classification, persistent assertion, cleanup, residue, validation or admission
outcomes. Required fields are:

- record ID/version/timestamps/status and producer/independent reviewer;
- `productCandidateId`, both `harnessVersion` values where applicable, current
  and advisory `attemptId`s, exact `environmentIdentity` proofs and
  `testPackVersions`;
- requested scope and independently reconstructed selected scope in both
  systems, with commands/contracts/mapping/policy versions and explicit omissions;
- normalized result/assertion differences, evidence/artifact digests, lifecycle,
  timeout/cancellation/termination and missing/partial/late/conflicting facts;
- exactly one primary class (`product`, `harness`, `environment`,
  `infrastructure`, or `unclassified`), contributing conditions, contract source,
  deterministic basis and evidence-sufficiency state;
- fixture/effect ledger, cleanup state, independent residue result and any
  environment/resource quarantine;
- `current-correct`, `advisory-correct`, `both-correct-different-scope`,
  `both-wrong`, or `unresolved`, but only when evidence supports that conclusion;
- required next safe action, affected versions/certifications/promotion cohort,
  owner, approval and closure evidence; and
- prohibition flags confirming there was no automatic patch, selector/fixture
  mutation, candidate change, redeployment, waiver, implicit retry or reused
  attempt.

Insufficient proof requires `unclassified` plus `unresolved`; it is not a vote
between systems. The release still follows current admission, but the affected
advisory cohort cannot advance. A deterministic current-gate defect is recorded
and handled through separately authorized legacy repair; it does not make the
uncertified advisory result authoritative. A deterministic advisory defect
invalidates the exact version/certification. Every corrected comparison uses a
new version as applicable and always a new `attemptId`.

## Deploy-Admission Boundary and Emergency Options

### Current and Advisory Authority

The current authoritative chain remains the existing qualification evidence
validator and `path-deploy` admission behavior, including its separately recorded
human emergency provenance. Phase 0 CP14 found useful fail-closed release/stage/
source/operation/expiry checks but deficient future identities and evidence
(`audit:1069-1073`). Sprint `1G` neither repairs nor changes it.

The advisory harness produces only independently validated advisory evidence.
Schema validity alone, a `GO` string, a passing native command, a durable object,
a catalog row, a local cache, or an LLM recommendation grants no admission
authority. Advisory evidence must be rejected when any of these applies:

- unsupported schema/policy/component version, invalid canonical digest,
  incomplete lineage or failed independent validation;
- missing, stale, conflicting or ambiguous candidate/harness/attempt/environment/
  pack identity;
- scope cannot be independently reconstructed, an MC2 obligation is missing, an
  unknown input exists, or a required pack/adapter is unavailable or below
  approved maturity;
- prerequisite/effect/environment proof is incomplete, result/failure is absent
  or `unclassified`, or cancellation/termination is unproved;
- required cleanup/residue evidence is missing, interrupted, failed or nonzero;
- artifact is late, replayed, cross-attempt, mutable, catalog-only, cache-only,
  missing from R4, outside retention, or fails attachment integrity; or
- comparison has an unexplained disagreement or the pack/cohort/admission policy
  is suspended, expired, rolled back or not explicitly approved.

Future new-harness admission requires the complete certified control core and
validator, exact mandatory promotion cohort, operation gates, current environment
proof, R4 durable graph, no-loss trace, Phase 9 window, no open disagreement,
shadow and synthetic admission negatives, rollback exercise, versioned admission
policy, reviewed runbook and explicit Bill authorization. Promotion is pack by
pack but current evidence remains required during partial migration. A rollback
returns to the prior policy where current evidence alone is authoritative.

### Emergency-Admission Options

| Option | Boundary and risk | Recommendation |
| --- | --- | --- |
| EA1 abolish every existing emergency path during migration | Strongest formal boundary but silently changes current operations and may remove an established human control without review | Not selected in architecture; would require separate current-admission policy decision |
| EA2 preserve the current emergency path unchanged, with named human authority/reason/mismatch provenance; advisory evidence may inform but never satisfy it alone | Preserves current authority and auditability while preventing advisory bypass; retains existing emergency operational risk | **Recommended for migration**; no new bypass and no change is authorized by this document |
| EA3 allow advisory-only emergency admission before promotion | Lets uncertified or disputed evidence bypass the exact migration proof intended to establish trust | Rejected |

Under EA2, the existing authorized human remains accountable for any current
emergency decision. The independent validator, kernel, LLM and evidence-store
operator cannot exercise it. An emergency never converts advisory evidence to
authoritative, erases disagreement/cleanup blockers, or promotes a pack. Any
future change to emergency admission requires its own policy, implementation,
negative certification and Bill approval.

## R4 Operational-Retention Decision Package

This is a recommendation, not infrastructure authority. It is based on O1, the
existing AWS-oriented operational boundary, immutable/hash-linked evidence, the
loss of retained r3-r34 artifacts, sensitive browser/provider material and the
need to rebuild scope independently (`audit:366-382,752-768,929-968,
1248-1317`). No AWS account, permission, resource, price or current capability
was accessed or assumed.

### Recommended Service and Control Model

| Concern | Recommendation | Rejected/limited alternative and tradeoff |
| --- | --- | --- |
| Durable original | Dedicated AWS S3 bucket per approved environment class, versioning on, default S3 Object Lock **governance** retention, content-addressed keys and checksum metadata | Compliance mode gives stronger immutability but can obstruct lawful deletion/correction for the full term; ordinary versioning alone permits privileged deletion too easily |
| Write-once boundary | Producers may create a previously absent digest key only; bucket policy denies overwrite/delete/retention shortening; conditional catalog write rejects an existing artifact ID with different bytes | Application-only “do not overwrite” is insufficient; filenames/timestamps are not content authority |
| Search catalog | Separate DynamoDB table per environment containing identity/digest/type/status/sensitivity/retention/lineage pointers and query indexes; catalog is rebuildable and never artifact authority | Object tags/listing alone are poor cross-attempt queries; a catalog holding evidence bytes duplicates authority |
| Local cache | Qualification-owned cache outside source fingerprints, digest-verified on read, no admission authority, maximum seven days and deleted after durable handoff | Ignored `tmp/` cannot be the retained record |
| Encryption/key owner | SSE-KMS with a customer-managed key per environment; separate restricted-media key where justified; Security/Platform owns key policy/rotation, not evidence producers | Provider-managed keys reduce operating burden but weaken explicit cross-role key authority/audit separation |
| Environment separation | Separate bucket, catalog table, KMS key, producer/validator roles and key prefixes for local certification, DEV, TEST and any future PROD; no cross-environment write role | One shared bucket/table increases confused-deputy and sensitivity risk; a read-only cross-environment investigation role may be time-bound and audited |
| Audit | CloudTrail management and S3 object-level data events for store access, CloudTrail data events for catalog operations, KMS audit records, immutable audit-log destination and access alerts | Application logs alone cannot prove privileged read/delete/hold activity |
| Backup/DR | Same-residency cross-region replication for `release-core` and held objects before future admission authority; catalog point-in-time recovery and daily export to locked storage; quarterly restore/rebuild exercise | Local backups or catalog-only backup do not preserve authoritative bytes; exact regions/RTO/RPO require operating approval |
| Operating owner | Platform Operations operates storage/catalog/monitoring/backup; Qualification Engineering owns artifact/catalog contracts; Security/Privacy owns access, KMS and holds; Release Management owns admission references | Making the pack/kernel producer also storage, validation, deletion and admission owner breaks independent authority |

Governance-mode bypass is not available to producer, validator, release or normal
operator roles. A separately assumed break-glass deletion role may shorten/bypass
retention only after the approved legal/privacy and Bill decision, with two-person
approval, case/ticket, MFA/session recording where available, CloudTrail evidence,
object-version/digest list and a signed deletion result. No `DeleteObject` marker
or catalog tombstone proves that locked versions were deleted; verification must
list every version and independently prove its state.

The bucket default lock should be the shortest durable class (recommended 90
days). After validation, the retention operator extends the exact object version
to its longer class period before final evidence or admission may reference it.
The validator reads back effective retention and hold state; a catalog label or
requested duration is not proof. A failure to extend the lock rejects the
artifact rather than silently accepting the default.

### Access, Sensitivity, Redaction, and Lifecycle

| Role | Allowed purpose | Explicitly prohibited |
| --- | --- | --- |
| Evidence producer | Write new digest-addressed artifact plus an index-request artifact after local schema/redaction checks | Write the catalog directly, read arbitrary attempts, overwrite, delete, change retention/hold, validate itself, admit release |
| Independent validator | Read exact plan-linked objects/versions, decrypt approved classes, recompute graph and write separate validation artifact | Write/replace originals, alter catalog identity, delete, promote or admit |
| Catalog indexer | Conditionally append/reconcile metadata from validated durable manifests | Treat catalog data as artifact bytes, overwrite conflicts or delete history |
| Release admission reader | Read validated `release-core` final/validation/admission references for an approved policy | Read unrestricted diagnostics/media or accept cache/catalog-only data |
| Investigator | Time-bounded case-scoped read of named attempts/classes with audit | Bulk browsing/export, mutation, hold/deletion or release decision |
| Privacy/legal hold authority | Place/release documented holds under policy and approve redacted derivatives | Change evidence outcome, execute routine deletion alone |
| Lifecycle/deletion operator | Execute approved expiry/deletion manifest and produce proof | Select own deletion scope, bypass hold, alter admission/history |
| Security/Platform key administrator | Operate key policy/rotation, storage guardrails and audit | Read evidence by default, produce/validate evidence, decide release |

Pack/adapter producers must redact before durable upload. Evidence never stores
credentials, access tokens, session cookies, private keys, raw secrets or
unbounded database/client payloads. Metadata uses non-secret identity, resource
ARN/name where necessary, hash/size/status and redaction manifest. Sensitivity is
one of `internal`, `confidential`, or `restricted`; screenshots, browser traces,
PDFs, HTTP bodies and provider/identity proof default to `restricted`. A redacted
derivative links to the original digest and transformation record but never
replaces it.

Recommended lifecycle periods, subject to Bill plus privacy/legal/records review,
are:

| Evidence class | Recommended retention | Rationale and expiry rule |
| --- | --- | --- |
| `release-core` | Seven years from admission decision or candidate abandonment | Preserves plans/final evidence/validation/failures/cleanup/manifests/admission/rollback trace; holds override expiry |
| `attempt-diagnostic` | One year from terminal or interrupted attempt | Supports classification, deterministic comparison and recurring transport diagnosis without indefinite logs |
| `sensitive-media` | 90 days by default; one year when linked to an open finding/disagreement; then delete unless held | Minimizes privacy exposure; redacted structural result remains under its own class |
| `build-and-rollback` | While deployment is active plus one year after supersession, minimum one year; referenced manifest/digest remains `release-core` | Keeps usable rollback bytes through an operating window without retaining every bundle for seven years |
| `rejected-or-interrupted` | One year; cleanup/residue/termination failure retained until incident closure plus two years, or seven years when tied to admission | Failure to finalize is not deletion authority; longer safety evidence supports investigation |
| `ephemeral-cache` | Delete immediately after durable read-back verification; hard maximum seven days | Cache is never authority; failed deletion is local residue evidence |
| Audit/hold/deletion proof | Seven years, or longer active legal/investigation hold | Proves privileged evidence operations independently of deleted content |

Lifecycle transition to lower-cost storage is recommended after 90 days for
eligible nonactive objects, while catalog metadata stays queryable. Content
deduplication, compression before hashing where the artifact contract permits,
multipart-abort lifecycle, per-class size ceilings, monthly storage/request/KMS
budgets, anomaly alerts and pack-level artifact quotas bound cost. Truncation or
quota rejection remains evidence and cannot silently discard a required result.

Legal/investigation hold overrides lifecycle and deletion for exact object
versions plus linked graph. Release requires the same authority that placed the
hold or a documented successor, independent approval and durable proof. Routine
expiry produces a signed deletion manifest, object-version results, catalog
tombstones that retain digest/type/expiry/authority (not sensitive payload), and
independent verification. Exact statutory periods remain external evidence and
must be resolved before implementation; the numbers above are architecture
recommendations, not claims about a current legal obligation.

Before advisory admission can become authoritative, disaster recovery must prove
read-after-write validation, replication/locked-version presence for release
core, catalog point-in-time restore, full catalog rebuild from durable manifests,
key recovery/rotation, loss of a region/catalog/cache, and admission rejection
while authoritative bytes or validation are unavailable. The durable store, not
the catalog, defines recovery truth.

### Bounded Future IAM Decision Package

Names below are proposed role classes and resource placeholders, not claims about
current IAM. Each future implementation prompt must bind exact ARNs, account,
region, conditions and principal after approved environment discovery. Denial
follows the Sprint `1E` permission-gap record; no broader credential or workaround
is permitted.

| Capability/role | Exact future actions | Resource/condition boundary | Environment and need |
| --- | --- | --- | --- |
| Evidence producer | `s3:PutObject`, `s3:AbortMultipartUpload`, `s3:ListMultipartUploadParts`, `s3:GetObjectAttributes`; `kms:GenerateDataKey`, `kms:Encrypt` | Exact environment evidence bucket artifact/index-request prefixes and KMS key; TLS, required KMS key, object-lock/default retention, checksum/digest and no-existing-key; no catalog, read, delete or retention-bypass action | Local-cert/DEV/TEST/future PROD separate roles; implementation and operation |
| Independent validator | `s3:GetObject`, `s3:GetObjectVersion`, `s3:GetObjectAttributes`, prefix-limited `s3:ListBucket`; `kms:Decrypt`, `kms:DescribeKey`; `dynamodb:GetItem`, `dynamodb:Query` | Exact plan-linked bucket versions/catalog indexes and approved sensitivity class; read only | Certification and operation |
| Catalog indexer | `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:GetItem`, `dynamodb:TransactWriteItems`; read durable manifest through validator-class S3/KMS actions | Catalog table/index ARNs; condition expressions require absent/equal immutable identity and allow only derived mutable index state | Implementation, certification and operation |
| Retention/hold operator | `s3:GetObjectRetention`, `s3:PutObjectRetention`, `s3:GetObjectLegalHold`, `s3:PutObjectLegalHold`, version/prefix-limited `s3:ListBucket`; catalog read/update of hold metadata | Named versions under approved case; cannot shorten retention or bypass governance in normal role | Later operation only after Bill/legal approval |
| Break-glass deletion | `s3:BypassGovernanceRetention`, `s3:DeleteObjectVersion`, `s3:DeleteObject`, retention/hold reads, version listing; `dynamodb:UpdateItem` for tombstone | Exact approved deletion manifest, expired/released hold, two-person/MFA session, no wildcard environment role; deny producer/validator assumption | Exceptional later operation only; never Phase 2 implementation/certification |
| Replication/DR | `s3:GetReplicationConfiguration`, `s3:GetObjectVersionForReplication`, `s3:GetObjectVersionTagging`, `s3:GetObjectVersionRetention`, `s3:GetObjectVersionLegalHold`, `s3:ReplicateObject`, `s3:ReplicateTags`; DynamoDB backup/PITR actions `dynamodb:DescribeContinuousBackups`, `dynamodb:UpdateContinuousBackups`, `dynamodb:CreateBackup`, `dynamodb:DescribeBackup`, `dynamodb:RestoreTableFromBackup` | Source/destination evidence buckets in approved residency and exact catalog table/backup ARNs; service-assumable role only | R4 implementation and pre-admission DR certification |
| Audit configuration/reader | `cloudtrail:CreateTrail`, `cloudtrail:UpdateTrail`, `cloudtrail:PutEventSelectors`, `cloudtrail:StartLogging`, `cloudtrail:GetTrailStatus`, `cloudtrail:LookupEvents`; read-only access to exact locked audit destination | Dedicated audit trail/log bucket/KMS key; configuration restricted to Security/Platform, investigator queries case/time scoped | Implementation and later security operation |
| Admission reader | Validator-role reads limited to validated `release-core`; catalog `GetItem`/`Query`; KMS decrypt for nonmedia release core | Exact environment/release/policy references, no diagnostic browse or write | Only Phase 10 implementation/certification after separate approval |

Every row additionally requires a durable IAM decision naming effective principal
ARN, exact account/region/resource ARN, policy/condition digest, approving owner,
purpose (`implementation`, `certification`, or `operation`), expiry/review date,
deliberate denied and allowed case, CloudTrail request/event references, and
whether the denied/allowed call began or left a partial effect. Adapter evidence
records the exact API action/resource and minimum missing capability. A denial
stops that capability; it never triggers retry, another role, broader credentials
or a weakened check.

KMS administration additionally needs a separately reviewed key-administrator
policy (for example `kms:CreateKey`, `kms:CreateAlias`, `kms:PutKeyPolicy`,
`kms:EnableKeyRotation`, `kms:DisableKey`, `kms:ScheduleKeyDeletion` and their
read/describe counterparts) scoped to dedicated evidence keys. Those actions are
infrastructure implementation/operation, never evidence-producer capability;
key deletion must be blocked by retention/hold and recovery policy.

## Operational Ownership and Responsibility Matrix

Roles are organizational responsibilities, not current named people or IAM
principals: **Qualification Engineering** owns O1 harness definitions;
**Product Domain** owns native semantics; **Independent Qualification Validator**
certifies evidence; **Platform Operations** operates shared services;
**Security/Privacy/Records** owns access, keys, holds and privacy policy;
**Release Management** operates admission; **Bill** owns architecture, mandatory
policy, environment effects and transition approvals.

| Capability | Producer/maintainer | Independent validator | Approver | Operator | Escalation authority |
| --- | --- | --- | --- | --- | --- |
| Kernel/lifecycle/process | Qualification Engineering | Independent Qualification Validator | Bill for Phase 2 scope and later material policy | Qualification Engineering for local versions | Qualification lead, then Bill on strategy/safety conflict |
| Identity/fingerprint/canonicalization | Qualification Engineering | Independent validator recomputes from role manifests/source | Architecture owner/Bill for identity-rule change | Qualification Engineering | Release Management for candidate conflict; Bill for policy |
| Six schemas | Qualification Engineering schema owner | Separate validator implementation/certifier | Architecture governance; Bill for breaking authority change | Qualification Engineering version registry | Bill if compatibility changes accepted model |
| Evidence validator | Independent-validation maintainer logically separate from producer | Certification reviewer using independent corpus | Architecture governance | Independent Qualification Validator | Bill for unresolved authority conflict |
| Adapters | Qualification Engineering capability owner | Adapter certifier plus environment owner for target proof | Bill for each effects phase; Platform/Security for capability | Qualification/Platform according to local or environment boundary | Environment incident owner; Bill for unsafe permission gap |
| Pack registry/manifests | Qualification Engineering registry custodian; domain pack owner authors semantics | Registry validator and certification reviewer | Domain owner for contract; Bill for mandatory-core/promotion policy | Qualification Engineering | Cross-repo owners, then Bill on unresolved mapping |
| Native product tests | Owning admin/portal/shared/other Product Domain | Pack certifier verifies exact command/contract | Product/contract owner | Owning repository team | Product engineering owner |
| Domain packs/fixtures/cleanup | Named Product Domain pack owner with Qualification Engineering mechanics | Pack certifier and independent residue verifier | Domain owner; Bill for TEST effects/promotion | Pack/adapter operator under exact attempt authority | Environment incident owner and Bill for residue |
| Dependency/impact mappings | Relevant domain owner; all owners for shared edges | O1 mapping validator and mutation suite | Qualification governance; Bill for MC2/core policy | Qualification Engineering | Bill for unknown/unresolved runtime ownership |
| Certification records | Independent certifier | Evidence validator validates record graph | Qualification governance | R4 evidence operator stores; cannot edit | Bill for promotion dispute |
| Maturity promotion/downgrade | Pack owner/certifier proposes; deterministic failure may trigger suspension | Independent validator | Qualification governance; Bill for mandatory cohorts/retirement | Registry operator applies approved immutable version | Bill |
| Durable evidence/catalog | Producers write; catalog indexer derives | Independent validator reads durable original | Bill approves R4 policy; Security/Records approves access/hold/deletion | Platform Operations | Security incident commander; Bill for availability/admission impact |
| Advisory comparison/log | Qualification comparison service/operator | Independent reviewer verifies both evidence graphs | Migration governance/Bill closes promotion-impacting disagreements | Qualification Engineering/Release operator | Bill for unresolved disagreement |
| Deploy admission | Existing admission producer remains current | Admission validator under current policy | Existing named human authority; Bill approves any future policy | Release Management | Bill; emergency remains existing EA2 only |
| IAM/environment permission | Platform/Security proposes exact least privilege | Security review plus adapter denial/capability evidence | Bill/environment owner under separate infrastructure prompt | Platform Operations | Security incident authority and Bill |
| Incident response | Relevant operator opens incident and preserves evidence | Independent incident/evidence reviewer | Incident commander; Bill for release/harness stop decisions | Platform/Product/Qualification owners by boundary | Bill for critical security/privacy/data/environment safety |
| Cleanup/residue escalation | Owning pack and adapter execute; environment owner contains | Independent residue verifier | Environment owner/Bill for further effects | Authorized environment operator | Incident commander and Bill; no rerun until resolved |
| Architecture/policy changes | Qualification architect recommends with evidence | Cross-domain design review | Bill | Documentation owner records approved decision | Bill; no LLM authority |

Logical O1 code ownership and operational R4 service ownership are deliberately
different. Platform Operations cannot redefine evidence meaning; Qualification
Engineering cannot grant itself storage, deletion, certification or admission
authority.

## Exact Proposed Phase 2 File Scope

The smallest proposed implementation is a private, isolated Node package at
`qualification/`. It uses Node standard library plus a pinned `ajv` dependency
for JSON Schema validation. The existing root `package.json`, application
`src/`, server, scripts, tests and all product repositories stay outside the
Phase 2 change list. Commands use `npm --prefix qualification ...`; no root
script or product dependency is added.

`HV=yes` means the exact file bytes are part of the Phase 2
`harnessVersion`. `HV=no` means non-authoritative documentation/progress only.
Every `qualification/src/` module is prohibited from importing outside the
package except Node built-ins and dependencies declared in its own lockfile.

| Exact proposed path | Purpose and owner | HV | Phase 2 necessity / product isolation | Prohibited dependencies and effects |
| --- | --- | --- | --- | --- |
| `qualification/` | Bounded O1 harness package root; Qualification Engineering | directory role | Physically and manifest-separates harness from shipped application paths | No PATH app imports, root runtime loading, network/environment effects |
| `qualification/package.json` | Private package, Node version/`ajv`, `run`, `validate`, and `test` entry points | yes | Reproducible dependency and direct package commands without root `package.json` | No AWS, MySQL, HTTP, browser, React, app/file dependencies or lifecycle scripts |
| `qualification/package-lock.json` | Exact isolated dependency closure | yes | Reproducible schema-validator bytes and vulnerability review boundary | No file dependencies on admin/portal/shared/Intacct or unpinned git/URL dependencies |
| `qualification/qualification-role-manifest.json` | Declares every Phase 2 file as harness/certification/documentation role and forbids product roots | yes | Makes product/harness composition independently checkable | Cannot assign product role or include external repository/runtime paths |
| `qualification/README.md` | Non-normative local commands, boundaries and artifact locations; Qualification Engineering | no | Human entry point; approved architecture remains normative | Must not define hidden defaults or override schemas/policy |
| `qualification/bin/rq-kernel.js` | Thin CLI for synthetic `plan`, `run`, and `validate` operations | yes | Exercises one admitted public boundary; delegates all logic | No shell composition, ambient env, PATH check IDs or product imports |
| `qualification/src/kernel.js` | Minimal orchestration composition of accepted services/state machine | yes | Implements only Sprint `1C` responsibilities | No product semantics, release judgment, environment adapter, retry or LLM |
| `qualification/src/canonical-json.js` | `RQ-C14N-1` structural equality, canonical bytes and digest | yes | Single canonical/hash authority used independently by producers/validator | No raw serialization-order equality, substring parse or nondeterministic values |
| `qualification/src/identities.js` | Builds/validates synthetic `productCandidateId`, `harnessVersion`, `attemptId`, environment and pack references from role inputs | yes | Proves five-identity separation and drift with synthetic files | No Git/AWS/DB/product discovery in Phase 2; no identity defaults |
| `qualification/src/schema-validator.js` | Loads exact six versions and applies strict Ajv structural validation | yes | Common schema/version rejection without hand-rolled validation | No remote refs, network schema fetch, coercion/default insertion or unknown versions |
| `qualification/src/plan-validator.js` | Applies semantic plan, command, prerequisite/effect/timeout and lineage admission | yes | Separates structural validity from qualification validity | No PATH commands, ambient executable lookup, effect widening or selection guessing |
| `qualification/src/selector.js` | Pure synthetic MC2 boundary, dependency closure/order and unknown/cycle/conflict rejection | yes | Certifies deterministic selection mechanics before Phase 6 product mappings | No real coverage inventory, filesystem heuristics, LLM or current checks |
| `qualification/src/lifecycle.js` | Valid state/transition authority and partial/interruption events | yes | Implements complete Sprint `1C` state machine | No command execution, cleanup semantics, wall-clock globals or out-of-order tolerance |
| `qualification/src/process-control.js` | Direct argv/cwd/env allowlist dispatch, bounds, cancellation and process-tree termination | yes | Proves pure local process safety against synthetic children | No shell, HTTP, browser, AWS, DB, implicit retry, ambient env or external cwd |
| `qualification/src/evidence-emitter.js` | Append-only local events and deterministic six-artifact assembly for synthetic attempts | yes | Exercises incomplete/final evidence and digest graph | No R4/network/catalog, mutable final overwrite or product logs |
| `qualification/src/evidence-validator.js` | Logically independent reconstruction of schema, identities, scope, lifecycle, results, cleanup and digests | yes | Satisfies independent validation boundary without producer state sharing | Cannot import `kernel.js`/`evidence-emitter.js` mutable state or grant release authority |
| `qualification/schemas/qualification-plan.schema.json` | Executable draft-derived plan schema; schema owner | yes | Required schema 1 of 6 | No product fields/defaults or remote schema references |
| `qualification/schemas/execution-event.schema.json` | Executable event schema | yes | Required schema 2 of 6 | Same; no permissive unknown lifecycle values |
| `qualification/schemas/check-result.schema.json` | Executable native/check result schema | yes | Required schema 3 of 6 | No exit-only product interpretation |
| `qualification/schemas/failure.schema.json` | Executable exactly-one-primary-class failure schema | yes | Required schema 4 of 6 | No LLM-only or multiple primary classifications |
| `qualification/schemas/cleanup-result.schema.json` | Executable cleanup/residue schema | yes | Required schema 5 of 6 | Cleanup success cannot imply zero residue |
| `qualification/schemas/final-evidence.schema.json` | Executable reconstructible final graph schema | yes | Required schema 6 of 6 | Schema validity cannot encode release authority |
| `qualification/test/identity-and-schema.test.js` | Identity separation, canonicalization and six-schema positive/negative unit cases | yes | Proves malformed/version/digest/drift behavior | Synthetic files only; no repository/environment probes |
| `qualification/test/plan-and-selection.test.js` | Plan semantics, MC2 synthetic core/impact/dependency/request/full and mutation cases | yes | Proves unknown/cycle/conflict/inclusion/omission determinism | No real PATH registry or current check execution |
| `qualification/test/lifecycle-and-evidence.test.js` | State transitions, interruption/finalization, failure/cleanup and deterministic artifact graph | yes | Covers known-good and partial/duplicate/stale/corrupt evidence | Test-owned temp directories only; no external store |
| `qualification/test/process-control.test.js` | Nonzero, startup/execution/idle timeout, cancellation, signals and process-tree termination | yes | Focused synthetic process certification | May spawn only exact fixture commands below; no shell/network/product command |
| `qualification/test/independent-validation.test.js` | Validator acceptance/rejection independent of producer internals | yes | Proves scope reconstruction, replay/conflict and no admission authority | No mutable producer state import or release/admission code |
| `qualification/test/fixtures/README.md` | Documents that every fixture is synthetic/test-owned | yes | Makes fixture ownership/effect boundary explicit in certification corpus | No environment credentials, endpoints, product IDs or external resources |
| `qualification/test/fixtures/commands/pass.js` | Emits one valid bounded synthetic result and exits zero | yes | Known-good child | No external read/write except declared stdout/result path |
| `qualification/test/fixtures/commands/fail.js` | Emits bounded failure evidence and nonzero exit | yes | Child-failure/classification plumbing | No product assertion or external effect |
| `qualification/test/fixtures/commands/hang.js` | Produces controlled idle/running timeout behavior | yes | Timeout/cancellation proof | No descendants, network or filesystem effect |
| `qualification/test/fixtures/commands/ignore-termination.js` | Ignores graceful termination until forced | yes | Forced-termination proof | No external effect or unbounded descendant |
| `qualification/test/fixtures/commands/spawn-descendant.js` | Owns one synthetic descendant with explicit identity marker | yes | Whole-process-tree termination proof | Child command fixed in fixture; no shell/arbitrary executable |
| `qualification/test/fixtures/commands/write-marker.js` | Creates/removes one attempt-bound marker in supplied temp root | yes | Synthetic mutation, cleanup and residue paths | Canonicalized test temp root only; no source/global temp/external path |
| `qualification/test/fixtures/commands/emit-result.js` | Emits selected valid/missing/truncated/corrupt/duplicate result bytes from fixed modes | yes | Result framing and validator negatives | Fixed enum modes; no arbitrary payload/file/network source |
| `qualification/test/fixtures/candidate/source.txt` | Tiny synthetic candidate input for fingerprint/drift tests | yes | Stable file without importing PATH source | Never replaced with repository/application source |
| `docs/testing/release-qualification-kernel.md` | Non-authoritative Phase 2 operator/certification guide | no | Documents exact local commands, evidence locations and prohibitions | Cannot broaden file/effect scope or claim admission authority |
| Existing target-architecture document | Record implementation/certification outcome only | no | Keeps approved architecture and deviations current | No silent redesign or executable contract change |
| Existing controlling plan | Update checkpoint/Sprint Ledger only | no | Preserves external sprint control | Cannot authorize next phase by being edited |

No other file is proposed. In particular Phase 2 excludes root `package.json` and
lockfile, `src/`, `scripts/`, `tests/`, `isetadminserver.js`, other repositories,
current release evidence/inventory/admission, `.env`, Git hooks/workflows, SQL,
AWS, browser and HTTP code. A Phase 2 prompt that needs another path must stop and
request a file-scope amendment from Bill before editing it.

Directory containers `qualification/bin/`, `qualification/src/`,
`qualification/schemas/`, `qualification/test/`,
`qualification/test/fixtures/`, `qualification/test/fixtures/commands/`, and
`qualification/test/fixtures/candidate/` have no independent bytes or behavior;
they inherit Qualification Engineering ownership and the prohibition boundary
above. Only their exactly listed files are in scope.

## Phase 2 Acceptance and Handoff Package

Phase 2 acceptance is one cumulative gate. It requires:

- strict validation against the exact six approved executable schema versions;
  canonical structural comparison/digests and complete identity/lineage;
- all 25 Sprint `1C` synthetic acceptance cases, including malformed plan,
  unknown check, cycle, failed prerequisite, nonzero child, startup/execution/idle
  timeouts, cancellation, forced whole-process-tree termination, termination
  failure, missing/truncated/corrupt/duplicate/stale result, cleanup success and
  failure, drift, execution/cleanup/finalization interruption and deterministic
  reassembly;
- ten consecutive clean known-good certification runs for one frozen
  `harnessVersion`, every applicable deliberate negative for the intended phase/
  class/reason, and at least one forced interruption;
- bounded startup/execution/idle/cleanup/total times, graceful then forced
  termination, no orphan, no implicit retry, and a new `attemptId` for every run;
- synthetic marker cleanup only after termination, independent zero-residue
  assertion, and correct incomplete/failure behavior when cleanup is interrupted;
- product/harness fingerprint drift rejection, five-identity separation,
  deterministic MC2 synthetic selection and byte-identical semantic evidence;
- focused unit/integration coverage of every Phase 2 module and negative branch,
  package-local command success, `git diff --check`, scope audit proving no
  prohibited import/effect, and preservation/reporting of all pre-existing user
  changes.

Passing Phase 2 makes only the pure local foundation eligible for Bill's Phase 3
review. It does not certify a PATH check, adapter, pack, environment, R4 service,
deploy admission or release decision.

### Proposed First Phase 2 Sprint: 2A

- **Objective:** establish the isolated qualification package and deterministic
  evidence foundation: package/role boundary, six executable schemas,
  `RQ-C14N-1`, five synthetic identities, strict schema-version validation, and
  focused positive/negative tests. Do not yet implement plan semantics,
  selection, lifecycle, process control, evidence assembly or the independent
  final validator.
- **Permitted effects:** create/change only
  `qualification/package.json`, `qualification/package-lock.json`,
  `qualification/qualification-role-manifest.json`, `qualification/README.md`,
  the six listed `qualification/schemas/*.schema.json`,
  `qualification/src/canonical-json.js`, `qualification/src/identities.js`,
  `qualification/src/schema-validator.js`,
  `qualification/test/identity-and-schema.test.js`,
  `qualification/test/fixtures/README.md`,
  `qualification/test/fixtures/candidate/source.txt`,
  `docs/testing/release-qualification-kernel.md`, and the two planning records;
  install only the isolated pinned package dependency; run only focused pure-local
  tests/static checks explicitly authorized in the Phase 2A prompt.
- **Prohibited effects:** every other Phase 2 path/module; root package/lock,
  application/server/scripts/current tests/checks; product repository imports;
  shell-composed arbitrary commands; network during runtime; SQL/database, AWS,
  HTTP server, browser, build, deployment, fixture/environment/TEST/PROD access;
  migration, admission, promotion or repair.
- **Deliverables:** isolated private package and lock, role manifest, six strict
  schema files derived from `1D`, canonical/hash and synthetic identity modules,
  schema validator, deterministic test corpus, operator boundary document and
  updated ledger.
- **Verification:** package-lock/source review, exact schema-draft trace,
  reordered-object equality, duplicate-key/nonstandard-value/version/digest/
  missing-identity/drift negatives, repeat deterministic bytes, focused
  package-local test command, prohibited-import/scope inspection and
  `git diff --check`. The ten-run Phase 2 gate is not claimed from this first
  slice alone.
- **Stopping point:** schema/identity foundation reviewed and its evidence
  recorded; no Sprint 2B module or later phase begins automatically.
- **Exact authorization required:** Bill explicitly approves the completed Phase
  1 architecture and the full proposed Phase 2 scope, then separately authorizes
  **Sprint 2A only** with the exact files/effects/tests above and no environment,
  product-runtime, current-gate or later-sprint work.

This first slice deliberately starts below orchestration complexity. Later Phase
2 prompts may add plan/selection, lifecycle/process, evidence/validator and
full certification in bounded order, each under a new Bill authorization.

## Architecture Consistency Review

| Accepted boundary | Integrated result | Contradiction check/resolution |
| --- | --- | --- |
| O1 ownership | Isolated admin `qualification/`; native product assertions stay in owners; no product imports | Consistent. Platform operation of R4 does not transfer semantic/control-plane ownership |
| R4 direction | Locked content-addressed originals, rebuildable catalog, cache without authority | Consistent. AWS provider/durations/roles are recommendations reserved for Bill, not silently accepted facts |
| MC2 | Universal control/provenance, operation gates, impacted dependency closure, explicit/scheduled full | Consistent. Phase 2 selector uses synthetic registry only; real mappings wait for Phase 6 |
| Five identities | Every comparison/rollback/promotion binds separate candidate/harness/attempt/environment/packs | Consistent. Rollback changes harness/pack/policy and rerun attempt, not candidate without product change |
| Authority model | Current gate remains authoritative; producer, validator, store, admission and human approval remain separate | Consistent. Advisory evidence may add no current authority, even in emergency |
| Kernel lifecycle | Migration invokes the accepted fail-closed lifecycle and termination-before-cleanup | Consistent. Rollback never mutates an in-flight attempt or retries implicitly |
| Six schema drafts | Phase 2 proposes exactly six executable derivatives and rejects unknown/mixed versions | Consistent. Governance disagreement/rollback records link to but do not create a seventh qualification schema |
| Canonical hashing | R4 keys and comparison use canonical digest; structural result, not raw log/order, is compared | Consistent. Catalog/local cache cannot override durable digest |
| Independent validation | Validator reconstructs scope/evidence and admission remains a third decision | Consistent. Same repo is allowed under O1, but mutable producer state/import is prohibited |
| Adapter contracts | Phase 2 has only synthetic process mechanics; real adapters follow Phases 4-8 | Consistent. No environment capability is inferred from a package dependency |
| Pack maturity/certification | Candidate before Phase 9, mandatory before promotion, exact invalidation/recertification | Consistent. Phase 3 five comparison runs are additional to, not a replacement for, ten local certification runs |
| No-loss coverage | Retirement requires the 88-unit/28-check/13-child ledger and mandatory replacements or Bill-approved removal | Consistent. Partial promotion still requires current evidence, so no obligation disappears |
| Migration/rollback | Phase 2-10 boundaries unchanged; version quarantine and current-only rollback always available | Consistent. No double-use of stateful fixtures and no tactical patch/rerun |

Four documentation-level ambiguities are resolved by accepted decisions rather
than new architecture: (1) Phase 3's five comparisons and the 10-run baseline are
cumulative; (2) O1 logical ownership is compatible with independent Platform R4
operation; (3) partial promotion adds new blockers while legacy evidence remains
required, so it cannot weaken admission; and (4) Phase 2 selection is a synthetic
kernel boundary, while authoritative PATH impact mappings remain Phase 6. No
material conflict with O1, R4, MC2 or another accepted model was found.

## Phase 1 Completion Assessment

| Required deliverable | Completion evidence | Assessment |
| --- | --- | --- |
| Approved architecture document | Sprints `1A-1G` integrate charter, decisions, consistency and completion package | Analytically complete; formal Bill acceptance pending |
| Six versioned schema drafts | Sprint `1D` common envelope; plan/final evidence are now `1.0.0-draft.2`, with the other four remaining `1.0.0-draft.1` | Complete at documentation level |
| Interface contracts | Sprint `1C` kernel boundary, `1E` adapters, `1F` packs/native authority | Complete at documentation level |
| Selection rules | MC2 approved; deterministic inputs/closure/failures/full regression in `1F` | Complete at documentation level |
| Advisory migration/rollback | Preconditions, Phase 2-10, comparison, observation, promotion, retirement and rollback above | Complete at documentation level |
| Repository/file ownership | O1 plus responsibility matrix and exact isolated Phase 2 paths | Complete proposal; Bill file-scope approval pending |
| SQL decision | `docs/AGENTS.md` live identity/DDL/per-statement/pre/post-mutation sequence and Sprint `1E` DB adapter | Complete at architecture level |
| JSON decision | `RQ-C14N-1`, structural equality, duplicate/nonstandard rejection and SHA-256 graph | Complete at architecture level |
| Process decision | Bounded startup/execution/idle/cleanup/total, cancellation, process-tree termination and partial evidence | Complete at architecture level |
| Browser decision | Product-owned stable boundary/selectors, persistent state, no global text/toast authority | Complete at architecture level |
| Fixture decision | Preflight, unique ownership, mutation ledger, termination, cleanup and independent zero residue | Complete at architecture level |
| AWS identity decision | Explicit post-load principal/account/region/resource/capability and bounded denial decision | Complete at architecture level; no permissions granted |
| Remote transport decision | Exact target/principal/runtime/command, framed durable result, timeout/cancel/termination/replay | Complete at architecture level |
| Phase 2 acceptance | Cumulative synthetic cases, ten-run gate, interruption/cleanup/drift/determinism/coverage/diff checks | Complete proposal |
| Exact Phase 2 scope | Every proposed `qualification/`/documentation path and exclusion is listed above | Complete proposal; Bill approval pending |

Phase 1 is therefore **analytically complete but has not passed its exit gate**.
Exit requires Bill to accept the architecture, approve or revise the R4 operating
package, approve the exact proposed Phase 2 scope, and then separately authorize
Sprint 2A. Approval does not implement R4, change current admission, migrate a
check, promote a pack, retire legacy machinery or authorize an environment.

## Sprint 1G Decision and Verification Record

| ID | Evidence / accepted decision | Recommendation or rule | Rejected alternative | Tradeoff / later proof / Bill decision |
| --- | --- | --- | --- | --- |
| 1G-D01 | Plan `:22-28,275-305`; D03 | Current gate remains sole authority throughout advisory migration | Advisory output clears or replaces legacy early | Duplicated proof cost; verify admission consumes current evidence only; Bill approves any transition |
| 1G-D02 | O1, R4, MC2; M01-M21 | Advisory entry requires certified exact components, identities, effects, current comparator and durable evidence | Start broad dual runs while foundation is incomplete | Slower start; prove every precondition before Phase 9 |
| 1G-D03 | Audit `:1199-1247`; native authority | First checks are short deterministic read-only local commands with stable direct contracts | Start with cross-domain/stateful journey | Less early business breadth; Phase 3 direct-command certification |
| 1G-D04 | Plan `:54-64`; audit `:867-876` | Direct/current/advisory executions keep separate attempts/evidence but bind one candidate/native contract | Relabel current output as advisory evidence | Extra records; comparison validator proves bindings |
| 1G-D05 | Sprint `1E` fixture/effect contract | Stateful comparison uses separate attempt-owned fixtures/effect authorization | Reuse one fixture between systems | Higher test cost; independent cleanup/residue proof |
| 1G-D06 | Audit `:849-927`; failure classes | Disagreement freezes versions and remains `unclassified` until deterministic proof | Majority vote, LLM choice or tactical patch/rerun | May pause promotion; disagreement corpus certification |
| 1G-D07 | Phase 9 plan gate; 1F baseline | Recommend at least 30 days and 10 ordinary candidates plus all promoted operation types/full run | Unspecified “several” or one clean release | Operating delay; Bill approves/revises exact window before Phase 9 |
| 1G-D08 | MC2 and pack maturity | Promote cohorts containing core/validator/operation gates plus named pack | Globally flip all packs or promote a domain without control core | More admission states; certify each cohort and rollback |
| 1G-D09 | No-loss ledger `1F`; plan Phase 10 | Legacy retirement only after mandatory mapped replacement/removal approval and rollback window | Retire when advisory first passes | Longer duplicate maintenance; Bill approves named retirement |
| 1G-D10 | Plan Phase 3 `:193-205`; 1F 10-run baseline | Five direct comparisons are additional to the ten certification runs | Treat five as revised lower certification threshold | Extra runs; later Phase 3 evidence must show both sets |
| 1G-D11 | Five identities; Sprint `1C` retry rule | Rollback never changes candidate absent product change; every rerun has new attempt | Reuse release/candidate/attempt for harness repair | More IDs; validator rejects reuse/stale evidence |
| 1G-D12 | R4; audit `:752-768,944-968` | Store outage stops advisory final acceptance; catalog rebuilds from originals | Admit from cache/catalog or discard partial evidence | Availability dependency; outage/restore certification |
| 1G-D13 | Audit `:517-535,919-927`; M08 | Cleanup/residue failure pauses effects/cohort and blocks rerun until termination/recovery proof | Warning-only cleanup or immediate rerun | Release delay protects environment; forced-recovery drill |
| 1G-D14 | Audit CP14 `:1069-1073`; current authority | Preserve existing human emergency path EA2 unchanged; advisory alone never authorizes emergency | Remove current path silently or create advisory bypass | Existing emergency risk remains; future policy change needs separate Bill approval |
| 1G-D15 | R4 approved; AWS-oriented evidence constraints | Recommend S3 Object Lock originals + DynamoDB rebuildable index + local cache | Git/local/CI-only retention or catalog as authority | New AWS operation/cost; Bill provider approval and infrastructure certification |
| 1G-D16 | R4 immutability/deletion needs | Governance lock with separate two-person break-glass deletion | Compliance lock for all bytes or normal-role deletion | Governance is less absolute but supports lawful controlled deletion; audit every bypass |
| 1G-D17 | Sensitive evidence audit `:384-393,752-757` | Per-environment KMS/access roles, restricted-media defaults and source redaction | Shared role/key/bucket or post-upload secret cleanup | More key/role operations; Security/Privacy approval and denial tests |
| 1G-D18 | Retention classes `1D`; missing history `:929-968` | Recommend 7y core, 1y diagnostics/rejected, 90d sensitive media, active+1y bundles, 7d cache, extended safety failures | Unlimited retention or immediate expiry | Privacy/cost versus audit; Bill/legal/records approve exact periods |
| 1G-D19 | R4 independence; O1 | Platform operates store, Qualification owns contracts, Security owns access/holds/keys, Release owns admission | One team produces, validates, stores, deletes and admits | Coordination cost; responsibility/incident exercises |
| 1G-D20 | Sprint `1E` IAM denial contract | Exact least-privilege action/resource/role decision; deny and stop when missing | Broader credentials, assume-role fallback or workaround | More IAM prompts; certify denied/partial operations before use |
| 1G-D21 | O1; Phase 2 prohibitions plan `:168-192` | Isolated private admin `qualification/` package with own lock and no root/product imports | Put kernel in `src/`, current scripts or shared runtime | Separate dependency maintenance; import-boundary tests |
| 1G-D22 | Existing `ajv` dependency read at `package.json:27`; no ad hoc parser | Pin Ajv in isolated package for six JSON Schemas | Hand-roll validation or depend on root product package | Small duplicate dependency; lock and schema negative certification |
| 1G-D23 | MC2 Phase 6 versus Phase 2 kernel scope | Phase 2 selector uses only synthetic registry/policy inputs | Import current coverage inventory or pre-implement PATH mappings | Less immediate realism; preserves pure boundary, later mutation proof |
| 1G-D24 | Sprint `1C` acceptance `:1533-1574` | Phase 2 cumulative gate includes all 25 synthetic cases and 10 clean runs | Certify on unit happy path alone | Higher initial test effort; exact evidence and focused coverage |
| 1G-D25 | Short-sprint governance in `docs/AGENTS.md` and controlling plan | First Phase 2 sprint 2A stops at schemas/canonical/identities/strict validation | Implement whole kernel/files in first prompt | Delays runnable orchestration but prevents complexity growth; Bill separately authorizes 2A |
| 1G-D26 | Phase 1 exit plan `:144-166` | Phase 1 is analytically complete but exits only after Bill accepts architecture/R4/file scope | Treat documentation completion as implementation authority | One explicit governance decision remains; no Phase 2 until granted |

Decisions reserved for Bill are: the R4 provider/control/retention/ownership
package (including final IAM and DR implementation scope); the recommended
30-day/10-candidate Phase 9 observation window and each future transition;
architecture acceptance; exact Phase 2 scope; Sprint 2A authorization; every
TEST/environment effect, admission change, promotion/retirement and PROD use.

## Sprint 1G Files, Effects, and Verification

Examined:

- `docs/AGENTS.md` for live-schema, AWS identity, selector, fixture, documentation
  and separately authorized sprint boundaries;
- the controlling plan's strategy, identities, pack certification, Phase 1 exit
  and unchanged Phase 2-10 boundaries;
- the accepted Phase 0 audit's current authority/evidence/cleanup/coupling,
  r3-r34 history, 88-unit dispositions, no-loss obligations, operational
  assumptions and missing retained evidence;
- the accepted target architecture's O1 identities/authority/ownership, Sprint
  `1C` lifecycle/Phase 2 cases, Sprint `1D` schemas/R4, Sprint `1E` adapters/IAM,
  and Sprint `1F` MC2/pack/certification/no-loss design; and
- `package.json:5-62,72-171` solely to bound the proposed isolated package and
  note the existing Ajv choice; it was not changed or executed.

Changed only:

- this target-architecture document; and
- the controlling plan's checkpoint and Sprint Ledger.

Documentation-only verification covered every requested advisory precondition,
comparison boundary, phase 2-10 stage field, 11 rollback triggers, disagreement
field, admission rejection and emergency option, R4 provider/control/access/
duration/DR/cost/redaction/environment concern, seven IAM role classes, 18
operational responsibility rows, 12 rollback triggers, every exact Phase 2 path, cumulative acceptance
and Sprint 2A handoff, 13 consistency boundaries, all Phase 1 deliverables and 26
decisions. No executable file/schema/adapter/pack/selector/validator/kernel,
storage, IAM, CI, admission, current check, product/harness test, configuration,
environment, workflow, test, build, qualification, migration, deployment, SQL/
database, AWS, browser, HTTP, fixture, TEST or PROD operation was authorized or
performed.

No unexplained failure, architecture conflict, automatic-stop condition or
course correction occurred. The accepted Phase 2-10 boundaries were not revised.

Final worktree state: admin remains on `main...origin/main` with the pre-existing
modified `docs/AGENTS.md`,
`docs/ops/deployments/release-qualification-runbook.md`, and
`docs/planning/README.md`; the pre-existing untracked Phase 0 audit, controlling
plan and target-architecture documents; and seven untracked
`sql/ops/prod-feedback-180-181-*20260810.sql` incident/preview/apply/rollback
artifacts that appeared during Sprint `1G` and were neither opened nor changed by
this sprint. Sprint `1G` changed only the target architecture and controlling
plan. Portal and shared remain clean on `main...origin/main`. Intacct mock remains
the non-Git directory established in Phase 0 and was not re-probed. No
pre-existing or concurrent user change was reverted or overwritten.

## Sprint 1G and Phase 1 Completion Decision

Sprint `1G` is complete at the documentation-architecture level. Phase 1 is
analytically complete: every required deliverable has a traced design or exact
proposal, and the consistency review found no material conflict. The Phase 1
exit gate remains pending Bill's formal acceptance and file-scope/operating
decisions.

The exact approval required before any Phase 2 work is: **Bill accepts the
completed Phase 1 architecture; approves or explicitly revises the Sprint `1G`
R4 operating recommendation; approves the exact proposed Phase 2 file scope; and
then separately authorizes Sprint `2A` only to create/change the listed schema,
canonicalization, identity, isolated-package, focused-test and documentation
files and run the expressly approved pure-local verification, with no other
kernel module, PATH product/current-gate work, migration, admission, storage/IAM/
CI change, environment access or later sprint/phase.**

Phase 2 has not begun. No advisory operation, promotion, admission change or
legacy retirement is authorized.

## Sprint 2A Implementation Checkpoint

Bill accepted Phase 1, R4, and the exact Phase 2 file scope, then authorized
Sprint `2A` only. Sprint `2A` implemented the approved evidence foundation in
the private `qualification/` package; it did not implement plan semantics,
selection, lifecycle, process control, evidence assembly, independent final
validation, adapters, packs, migration, or release admission.

The implementation traces to the identity model at `:578-761`, six
documentation-level schema drafts at `:1717-2053`, canonical comparison and
hashing at `:2054-2127`, independent structural validation boundary at
`:2128-2189`, exact proposed Phase 2 scope at `:4393-4458`, and Sprint `2A`
contract at `:4492-4533` as numbered before this checkpoint was appended.

Implemented:

- a private package and exact Ajv `8.17.1` dependency lock;
- an explicit role manifest with PATH product/current-check roots prohibited;
- exactly six executable schemas with plan/final evidence at
  `1.0.0-draft.2` and the other four at `1.0.0-draft.1`, with closed object shapes,
  lifecycle/status conditions, one primary failure class, cleanup/residue
  separation, and no release-admission authority;
- strict UTF-8/JSON parsing with duplicate and NFC-colliding key rejection,
  safe-integer-only values, Unicode-scalar validation, key-order-independent
  canonical bytes, meaningful array order, and SHA-256 digests;
- domain-separated content identities for product candidate, harness,
  environment, and test packs plus UUID attempt identity, canonical manifest
  ordering, digest recomputation, and explicit five-identity binding checks; and
- Ajv structural validation with no coercion, defaults, unknown-field removal,
  remote schema loading, or unknown version acceptance, followed separately by
  artifact-digest and cross-field identity validation.

Focused verification on 2026-08-10 passed `45/45` Node test assertions across
27 top-level tests. It covered all six positive artifacts, per-schema missing
required and unknown-field rejection, forbidden/malformed/conflicting fields,
event/result/failure/cleanup/final-state contradictions, schema version and
digest mismatch, canonical-order equality, a fixed SHA-256 vector, duplicate
and canonically colliding keys, unsupported numbers/values/Unicode, stable and
changing identity vectors, all five identity bindings, and stale identity/pack
material. Four approved JavaScript files passed `node --check`, and all six JSON
schemas compiled through the isolated Ajv registry. The isolated source
and lock were also reviewed; final scope and diff checks are recorded in the
controlling Sprint Ledger.

Course corrections remained local and did not change the architecture:

- the initial offline dependency install stopped with `ENOTCACHED`; the
  separately approved pinned package install then succeeded;
- Ajv's static `strictRequired` and `strictTypes` lints rejected valid
  parent-declared conditional composition, so only those two compile-time lints
  are disabled; runtime `required`, type, keyword, unknown-field, no-coercion,
  no-default, and no-removal validation remains enforced and negatively tested;
- the first fixture exposed short versus fully qualified schema-name drift; all
  artifacts now consistently use `path.release-qualification.*`;
- a final contract-trace review found four drafts were strict but insufficiently
  faithful to the accepted field contracts; check result, failure, cleanup, and
  final evidence were corrected to the approved native-authority, deterministic
  failure, independent residue, and reconstructible-graph models before final
  verification; and
- one synthetic builder was initially placed in an unapproved fixture helper
  path, then moved into the approved test file and the extra file deleted before
  final verification. The final file set matches the exact Sprint `2A` scope;
  and
- one final read-only source-reference `rg` command used an unescaped Markdown
  backtick, so the shell attempted the enclosed token and returned
  `command not found`; the command was corrected with a single-quoted pattern.
  It performed no write and affected no verification result.

No material architecture conflict, unexplained failure, product finding,
automatic-stop condition, environment access, or current-gate effect occurred.
Sprint `2A` is complete. Phase 2 remains incomplete and no later sprint is
authorized by this record.

### Sprint 2A Schema-Alignment Correction

Bill authorized a bounded correction after the Sprint `1F`/MC2 selection-origin
vocabulary was found to supersede the initial Sprint `1D` vocabulary. The
qualification-plan and final-evidence schemas advance to `1.0.0-draft.2` and
accept exactly `mandatory-core`, `impacted-domain`, `dependency`,
`explicit-suite`, `scheduled-full`, and `release-operation`.
`explicit-request` is retained only as a deliberate negative-test input.

Execution event, check result, failure, and cleanup result remain
`1.0.0-draft.1`. Their respective 15, 13, 13, and 14 unique external plan
references all resolve only to shared `$defs` whose definitions are identical
before and after the plan version change. None resolves to `selectedCheck`,
`evidenceContract`, the plan schema version, or another changed fragment.
Retargeting those references therefore changes no resolved keyword, constraint,
or accepted-instance set for the four retained contracts.

The strict registry and plan evidence contract record the mixed version graph.
Focused verification passes 60/60 assertions, including both origin-bearing
contracts, obsolete/unknown/malformed-origin rejection, current/stale/conflicting
version rejection, and all earlier Sprint `2A` canonicalization, digest, schema,
and identity cases. This correction implements no Sprint `2B` plan admission or
selection logic.

Final scoped worktree state: admin remains on `main...origin/main`. The
pre-existing tracked modifications to `docs/AGENTS.md`, the release-
qualification runbook, and `docs/planning/README.md` remain untouched. The
pre-existing untracked Phase 0 audit remains untouched; the pre-existing
untracked controlling plan and target architecture contain only their approved
Sprint `2A` updates. Sprint `2A` adds the untracked exact `qualification/`
package and operator guide. The seven protected concurrent
`sql/ops/prod-feedback-180-181-*20260810.sql` files named by Bill were not
opened, read, edited, deleted, staged, or included in status/diff commands.

The exact next approval is: **Bill authorizes Sprint `2B` only to implement
semantic qualification-plan admission and the pure synthetic MC2 selection and
dependency-ordering boundary in `qualification/src/plan-validator.js`,
`qualification/src/selector.js`, and
`qualification/test/plan-and-selection.test.js`, with only the already approved
package metadata and qualification/planning documentation changed as necessary;
focused pure-local tests/static checks only; and no lifecycle, process control,
command execution, evidence assembly, independent final validator, adapters,
PATH imports/current checks, environments, migration, admission, or later
sprint.**

## Sprint 2B Implementation Checkpoint

Bill separately authorized Sprint `2B` after accepting the completed Sprint
`2A` schema-alignment correction. The private package now implements only the
approved semantic qualification-plan admission and pure synthetic MC2
selection/dependency boundary.

The selector accepts a closed explicit input containing product and harness
identities, available pack identities, target, changed-input references,
operations, suites, scheduled-full trigger, exclusions, capabilities,
selection time, content-addressed policy, and content-addressed registry. Policy
and registry digests are recomputed, and both exact references must be bound
into `harnessVersion`; stale mutation cannot silently change selection.

MC2 selection deterministically adds universal core, impacted packs,
transitive dependencies, explicit suites, scheduled-full packs, and
release-operation packs. It accumulates the canonical origin vocabulary,
applies only current authorized non-mandatory exclusions, validates exact pack
version/maturity/status/target/capabilities/effects/cleanup, rejects missing
dependencies and cycles, and emits stable topological order plus canonical
selection-input and selection-output digests. The registry and policy are
synthetic only; no PATH check, inventory, mapping, source tree, or environment
is imported or inspected.

Plan admission first applies the Sprint `2A` strict structural, version,
content-digest, and identity validation. It then requires a complete
`DEPENDENCIES_ORDERED` plan with predecessor lineage and independently
reconstructs selection. Product/harness/pack identities, authority refs,
target, requested and resolved scope, selected checks, dependencies, execution
order, prerequisites, environment capabilities, effects, adapter requirements,
commands, protected timeout reserves, cancellation, and cleanup obligations
must match exactly. Acceptance emits a deterministic local admission digest; it
does not open an attempt or grant release authority.

Focused Sprint `2B` verification passes 57/57 assertions covering core/impact/
dependency inclusion, unrelated omission, all full-regression origins,
repeatability, valid and conflicting exclusions, unknown scope, missing/cyclic
dependencies, duplicate/stale pack identity, content-addressed registry
mutation, harness binding, target/maturity/status/capability rejection,
stateful cleanup, strict input shape, valid plan admission, and plan mutation
rejection across identity, authority, scope, checks, ordering, capabilities,
effects, cleanup, and budgets. The combined Sprint `2A` and `2B` package suite
passes 117/117 assertions.

One initial focused run failed because the synthetic plan builder shared its
budget object with the independent selector input; the plan-only mutation
therefore changed both sides. Detailed evidence classified this as a test-
fixture aliasing defect, the plan fixture was isolated, and the unchanged
selector/validator then passed. No unexplained second failure, architecture
conflict, external effect, product finding, PATH access, or Sprint `2C` work
occurred.

Sprint `2B` is complete; Phase 2 remains incomplete. The exact next approval is:
**Bill authorizes Sprint `2C` only to implement deterministic lifecycle state
transitions and append-only evidence emission using synthetic in-process events
and cleanup markers in `qualification/src/lifecycle.js`,
`qualification/src/evidence-emitter.js`, and
`qualification/test/lifecycle-and-evidence.test.js`, plus approved package
metadata and qualification documentation; no child process, PATH import/current
check, adapter, environment, evidence-store, independent final validator,
admission change, or later sprint.**

## Sprint 2C Implementation Checkpoint

Bill separately authorized Sprint `2C` after the completed Sprint `2B` semantic
admission and selection slice. The private package now implements only the
approved deterministic lifecycle and append-only synthetic in-process evidence
slice.

`qualification/src/lifecycle.js` binds one valid `attemptId` and the complete
selected-check set before recording begins. It keeps attempt, prerequisite,
check, cleanup, residue, and validation scopes separate while enforcing the
accepted transitions between them. Failed prerequisites cannot admit a ready
check; timeout, cancellation, and termination failure remain distinct; cleanup
cannot begin without terminal execution or when termination is unproved;
cleanup success does not itself establish residue; and finalization requires a
terminal prerequisite/check/cleanup/residue path for every selected check,
except that a termination failure remains an explicit incomplete blocker.
Missing, undeclared, invalid, conflicting-repeat, out-of-order, and post-terminal
state changes fail closed. Validation acceptance/rejection is represented only
as lifecycle state; Sprint `2C` performs no independent validation.

`qualification/src/evidence-emitter.js` accepts only those lifecycle records,
explicit canonical timestamps, exact plan/attempt/producer/check/pack bindings,
and synthetic mutation markers. It emits immutable execution-event
`1.0.0-draft.1` artifacts with gap-free attempt and producer sequences, exact
predecessor links, canonical digests, and schema validation. Exact replay is
idempotent but cannot append unseen evidence. Stale lineage, conflicting bytes,
out-of-order sequence, wrong parentage, and wrong check/pack binding are excluded
from the accepted journal and retained as quarantine references where a valid
artifact reference exists. Event and cross-artifact graph hashes are
deterministic and order-independent where order has no semantic meaning. The
emitter has no clock, child-process, command, filesystem-write, R4 store,
adapter, environment, product, or release-admission hook.

Focused Sprint `2C` verification passes 25/25 assertions covering the complete
synthetic lifecycle paths, failed prerequisites, timeout/cancellation,
termination failure, cleanup success/failure/interruption, residue,
finalization/interruption, selected-check completeness, validation states,
schema-valid append-only events, immutability, repeatability, predecessor
lineage, exact replay, conflict quarantine, missing/out-of-order/stale evidence,
pack bindings, mutation markers, timestamp validation, and deterministic event
and artifact graphs. The cumulative direct Sprint `2A`-`2C` suites pass 142/142
assertions; the package aggregate passes all three files. All package JavaScript
syntax checks, all six schema compilations, dependency resolution, the scoped
no-process/no-environment import check, metadata consistency, and whitespace
checks pass.

The first focused run exposed a schema-invalid synthetic producer version; the
second exposed a negative graph fixture whose proposed byte change was itself
invalid under the cleanup schema. Both were classified as test-fixture defects
from exact schema evidence and corrected only in the authorized test file. No
production behavior was weakened, and no unexplained second failure,
architecture conflict, product finding, child process, PATH import/current
check, adapter, environment, independent final validator, admission change, or
later-sprint work occurred.

Sprint `2C` is complete; Phase 2 remains incomplete. The exact next approval is:
**Bill authorizes Sprint `2D` only to implement bounded pure-local process
control, cancellation, and whole-process-tree termination in
`qualification/src/process-control.js` and
`qualification/test/process-control.test.js`, using only the approved synthetic
fixtures under `qualification/test/fixtures/commands/` (`pass.js`, `fail.js`,
`hang.js`, `ignore-termination.js`, `spawn-descendant.js`, `write-marker.js`, and
`emit-result.js`), plus approved package metadata and qualification
documentation; no shell, PATH product command/check, network, HTTP, browser,
database, AWS, environment, adapter, independent final validator, admission
change, or later sprint.**

## Sprint 2D Implementation Checkpoint

Bill separately authorized Sprint `2D` after the completed Sprint `2C`
lifecycle/evidence slice. The private package now implements only the approved
bounded local process-control slice and the seven exact synthetic command
fixtures.

`qualification/src/process-control.js` requires an explicit policy before it
can dispatch. Admission binds the exact current Node executable, command ID,
real script path and SHA-256 content digest, complete argument vector, real
working directory beneath the package root, explicit environment allowlist,
attempt identity, and unique command-instance identity. It has no executable
lookup, shell, argument expansion, ambient environment inheritance, implicit
retry, product command registry, or adapter hook. Node preload and library
injection variables fail before dispatch. A command-instance replay inside an
attempt is rejected; distinct declared cleanup work can retain the same attempt
identity under a different command-instance identity.

The controller captures stdout and stderr separately with observed/captured
byte counts, SHA-256 digests, truncation facts, and fixed byte ceilings. Stdout
uses strict versioned JSON-line `ready`, `heartbeat`, `progress`, and `result`
frames bound to the attempt. Exit zero is insufficient without exactly one
valid ready frame and a valid passed result. Missing, corrupt, stale,
conflicting duplicate, and oversized results remain explicit failures; exact
duplicate result bytes are idempotent. A native failed result and a nonzero
exit remain facts rather than being reclassified as product behavior.

Startup, execution, idle, graceful-shutdown, forced-termination, and total
budgets are separate. The total budget reserves both termination intervals.
The first cancellation request is authoritative and exact replay is idempotent;
a conflicting request fails closed. The controller owns a detached Linux
process group, requests `SIGTERM`, escalates to `SIGKILL`, retains signal and
exit evidence, and does not report termination proved until the root/streams
are closed and the complete process group is absent. A failed absence proof is
terminal `termination-failed` evidence. Ordinary fast completion uses bounded
absence polling so a transient process-table state cannot discard the result.

The certification corpus is exactly `pass.js`, `fail.js`, `hang.js`,
`ignore-termination.js`, `spawn-descendant.js`, `write-marker.js`, and
`emit-result.js`. The descendant fixture launches only the fixed sibling
termination fixture and waits for its structured ready frame before the parent
announces readiness. The marker fixture may create or remove only one
attempt-bound file beneath a canonical test-owned `rq-process-control-*`
temporary root; the focused test removes that root in `finally`. No fixture has
a PATH product, network, HTTP, browser, database, AWS, deployed-environment, or
release-admission dependency.

Focused Sprint `2D` verification passes 28/28 assertions. It covers exact
admission and environment isolation; native nonzero results; unknown command,
argument, environment, preload-control, cwd, stale digest, and fingerprint
drift rejection; dispatch replay; startup, idle, execution, and total timeout;
idempotent/conflicting cancellation; graceful-to-forced escalation; fixed
descendant termination and independent process-absence proof; failed
termination proof; valid/missing/corrupt/identical-duplicate/conflicting-
duplicate/stale/truncated result frames; and attempt-bound marker cleanup. The
cumulative Sprint `2A`-`2D` package suite passes 170/170 assertions. Package
JavaScript syntax, all six schema compilations through the cumulative suite,
dependency resolution, metadata/version consistency, prohibited-import
boundaries, and whitespace checks pass.

The default command sandbox initially prevented piped child creation while
presenting misleading exit-zero/empty-output child facts. That symptom was
first misattributed to a transient normal-exit process-group state, and bounded
absence polling was added before a direct local probe identified `EPERM` as the
actual cause. The polling remains required by the accepted terminal-proof
contract and passes its focused cases, but the diagnostic sequence was a course
correction. Verification was then run with the narrowly approved process
permission and only the seven synthetic fixtures. One focused case also proved
that the descendant could receive graceful termination before installing its
deliberate signal handler; the fixture was corrected to await the descendant's
structured ready frame. These were classified sandbox and synthetic-fixture
issues, respectively. No test expectation was weakened, no architecture
conflict remains, and no PATH check/import, adapter, network, environment,
independent final validator, CLI, admission change, or later sprint work
occurred.

Sprint `2D` is complete; Phase 2 remains incomplete. The exact next approval is:
**Bill authorizes Sprint `2E` only for the approved pure-local final slice:
`qualification/src/kernel.js`, `qualification/src/evidence-validator.js`,
`qualification/bin/rq-kernel.js`, and
`qualification/test/independent-validation.test.js`, plus approved package
metadata and qualification documentation, to integrate the already completed
synthetic services, independently validate final evidence, exercise the thin
synthetic CLI, and run the cumulative Phase 2 certification gate; no PATH
product command/import, adapter, network, HTTP, browser, database, AWS,
environment, admission change, or later phase.**

## Sprint 2E Implementation Checkpoint

Bill separately authorized Sprint `2E` after the completed Sprint `2D`
process-control slice. This sprint changed only the four approved implementation
and focused-test files, the isolated package metadata/lock, the package operator
README, this architecture checkpoint, and the controlling checkpoint/ledger.

`qualification/src/kernel.js` is a domain-neutral composition boundary over the
already accepted Sprint `2A`-`2D` services. It first admits the immutable plan
against independently reconstructed MC2 selection, then requires the supplied
execution set to match every selected check exactly. Attempt identity, command
reference, prerequisite result, effect tokens, and any stateful cleanup owner,
termination-bound cleanup command, and independent residue verifier are bound
before dispatch. Unknown checks, stale attempts, undeclared effects, incomplete
prerequisite sets, and stateful work without cleanup fail before an effect. A
failed prerequisite or failed selected dependency emits a terminal blocked
result and `NO-GO` evidence without dispatching the child.

Admitted checks run in stable plan order through the bounded Sprint `2D`
controller. The kernel converts explicit lifecycle records to gap-free events,
retains the exact process result as a content-addressed attachment, keeps native
status and product contract references intact, and records any non-success as
`unclassified` with a mandatory stop rather than inventing product semantics.
Read-only checks receive explicit cleanup/residue-unnecessary markers. A
stateful synthetic check cannot clean up until execution termination is proved;
cleanup success remains separate from an independent structured residue
decision. Final evidence binds the five identities, admitted requested and
selected scope, event graph, every result/failure/cleanup artifact, attachment
index, missing evidence, termination, residue, blockers, and a producer
advisory status. The final artifact has no release-admission authority.

`qualification/src/evidence-validator.js` is deliberately independent: it does
not import `kernel.js`, `evidence-emitter.js`, lifecycle state, or mutable
producer state. Starting from serialized bytes/artifacts and the authoritative
selection input, it strictly validates the six schema versions and digests,
detects duplicate artifact/attachment identities, recomputes attachment bytes,
rebuilds plan admission and selected scope, verifies the immediate-predecessor
event chain against its own transition table, requires one attributable result
per selected check, resolves failure and cleanup obligations, checks independent
zero-residue evidence, rebuilds final indexes, and recomputes the advisory
status. Its separate deterministic report distinguishes schema validity from
qualification validity and always states `releaseAuthority: none`. Strict byte
input is checked for duplicate JSON keys before a canonical ordinary-object
normalization needed by AJV's `uniqueItems` implementation; no accepted bytes or
semantics change during that normalization.

`qualification/bin/rq-kernel.js` is a thin strict-JSON stdin/stdout boundary for
`plan`, `run`, and `validate`. It performs no shell composition, executable
lookup, ambient configuration, retry, PATH application import, storage,
environment access, or release admission. `run` constructs only the explicitly
supplied synthetic process policy and is intentionally limited to serializable
read-only executions; the stateful cleanup callback boundary is certified
through the direct in-process kernel interface rather than an unsafe serialized
function or implicit command. This restriction does not alter the accepted
kernel, schema, identity, authority, O1, R4, or MC2 design.

Focused Sprint `2E` verification passes 15/15 tests. It proves ten fresh
known-good attempts with one frozen product candidate, `harnessVersion`, and
pack-version set; unique `attemptId` on every run; schema-valid `GO` evidence;
stateful marker creation, post-termination cleanup, and independent marker-
absence proof; failed-prerequisite `NO-GO` with zero dispatch; byte-identical
final reassembly; schema-invalid digest mutation; stale identity; missing and
duplicate results; corrupt attachments; schema-valid selected-scope and advisory
status conflicts; duplicate-key rejection; and the CLI plan/validation boundary.
The validator rejects every mutation and never grants release authority.

The cumulative Sprint `2A`-`2E` package suite passes 185/185 tests. Across the
five focused suites it covers the complete 25-case Sprint `1C` synthetic model:
malformed plan/evidence; unknown selection/check and dependency cycle; failed
prerequisite; child nonzero; startup/execution/idle/total timeout; user
cancellation and forced process-tree termination; unproved termination;
missing, truncated, corrupt, duplicate and stale results; cleanup success,
failure and interruption markers; residue proof; fingerprint drift;
execution/cleanup/finalization interruption; no implicit retry; five-identity
separation; and deterministic reassembly/validation. The ten-run gate uses new
attempt identities without changing the frozen harness identity. JavaScript
syntax for all four Sprint `2E` files, exact isolated dependency resolution,
package/lock/bin version consistency, local-only imports, the six schemas
through the cumulative suite, and scoped `git diff --check` all pass.

The default command sandbox initially prevented Node's test worker from loading
and returned only a worker-level failure, so the already approved pure-local
test permission was used for the focused and cumulative runs. One attempted
`npm test` filter placed Node flags after the package script's glob and was
rejected before test execution; it was replaced by the exact focused script.
Two read-only source-navigation commands also used unescaped Markdown
backticks in a shell search pattern and were rejected or produced a harmless
command-not-found diagnostic; neither command wrote a file or invoked a
qualification/product workflow.
Implementation tests then identified and corrected a mistaken assumption that
plan admission returns a duplicate plan body, and the strict-parser/AJV object-
prototype boundary described above. A failed-prerequisite integration case also
showed that Sprint `2C`'s optional `artifactGraph()` helper assumes pack fields
that the approved failure schema does not contain. Sprint `2E` therefore leaves
failure artifacts in final evidence and independent validation, while omitting
them only from that optional internal helper call. No earlier file or schema was
changed, no evidence was discarded, no test was weakened, and no material
architecture conflict remains.

Sprint `2E` is complete. The Phase 2 technical exit gate is satisfied: ten
clean frozen-harness runs, every documented synthetic negative-case family,
focused/cumulative coverage, deterministic evidence, cleanup and interruption
proof, import/effect scope checks, and `git diff --check` are green. Phase 2
still requires Bill's explicit review under the controlling exit gate. Passing
this gate certifies no PATH check, adapter, pack, environment, R4 service,
deployment, admission path, or release decision; the current release gate
remains authoritative.

The exact next approval is: **Bill reviews and accepts the completed Phase 2
pure-local implementation and certification evidence, then explicitly
authorizes the exact Phase 3 read-only local-check scope and files under a new
bounded prompt. No Phase 3 work begins automatically.**

## Sprint 3A Implementation Checkpoint

Bill accepted Phase 2 and separately authorized Sprint `3A` for one advisory,
read-only native pack: `ai-guidance-contract`. The approved product inputs were
limited to read-only access to root `package.json`,
`scripts/admin-ai-eval-fixtures-check.js`, and
`docs/testing/admin-ai-chatbot-eval-fixtures.json`. The native checker and its
default fixture were not modified.

The pack manifest and Phase 3 registry bind one owner, component/contract test
level, local target, read-only capability, zero writes/external effects, exact
input hashes, direct commands, time bounds, cleanup-unnecessary decision,
coverage limitations, and certification threshold. The role manifest fails
closed on any unlisted product input. The registry contains one active advisory
pack, says `selectionAuthority: advisory-certification-only`, and says
`releaseAuthority: none`. It is intentionally not supplied to the Phase 2 MC2
selector: that selector continues to admit only mandatory qualification packs,
while Sprint `3A` is a pre-promotion certification lane. No accepted identity,
authority, MC2, kernel, schema, or lifecycle contract changed.

The native read-only bridge verifies the complete bundle before dispatch,
admits only the exact Node executable, bridge bytes, argument profile, root
working directory, empty inherited environment and fixed time/output bounds,
then uses the existing Sprint `2D` process controller. The unchanged native
script remains semantic authority through its exit status. Native stdout and
stderr are bounded and content-addressed evidence but are not parsed, compared
by substring, or reinterpreted by the qualification code. The comparator binds
the same product candidate, environment, pack version, profile and native
command while preserving distinct direct/advisory `harnessVersion` and
`attemptId` values. Any identity, native command, exit or termination mismatch
is a mandatory advisory disagreement; every result has no release authority.

The exact direct known-good command passed and reported 21 fixtures: 11
`verified` and 10 `drafted`. The exact direct deliberate-failure command used
the qualification-owned duplicate-ID fixture, exited `1`, and reported exactly
one native validation error. Focused tests passed 10/10. They prove strict
pack/registry/role and package-alias validation; unknown field, promotion,
stateful effect, stale manifest/script/fixture, undeclared input and registry
scope rejection; ten known-good advisory attempts under one frozen candidate,
advisory harness and pack version with ten distinct attempt IDs; five additional
direct/advisory matches; direct/advisory deliberate-failure parity; stale and
conflicting comparison rejection; bounded forced interruption with whole-group
termination and no late valid result; and explicit identity separation.
Cumulative package verification passed 195/195, preserving all 185 Phase 2
tests.

The default sandbox first returned only a worker-level focused-test failure
because it did not allow the authorized child processes; the suite was rerun
under the bounded approved local-process permission. The first interruption
case ended with the synthetic `hang.js` fixture's documented usage exit because
the bridge omitted its required `idle` and attempt arguments. Evidence showed
exit `64`, no mutation, proved termination and no product execution. The bridge
argument binding was corrected once, and the focused and cumulative suites then
passed. These were explained sandbox and harness-fixture issues, not product
failures or unexplained retries. No material architecture conflict, automatic
stop, or second unexplained failure occurred.

Sprint `3A` is complete. It certifies only pack version `1.0.0` for advisory
use under the exact recorded bytes and does not promote it to candidate or
mandatory. It changes no current qualification gate, deploy admission, release
authority, product source, environment, or legacy machinery. No other check was
onboarded.

The exact next approval is: **Bill reviews and accepts Sprint `3A` advisory
certification, then explicitly authorizes a separately defined Sprint `3B`
with one read-only local check, exact editable files, exact direct and advisory
commands, negative corpus, permitted effects, continuing prohibitions,
verification and stopping point. No new pack, promotion, release-authority
change, or later work begins automatically.**

## Phase 3 Remaining Sprint Breakdown

This section corrects the Phase 3 governance omission identified after Bill
accepted Sprint `3A`. It records the proposed sequence only. It authorizes no
implementation, command, pack, repair, environment access, promotion, or later
phase. Every sprint requires a separate prompt from Bill.

### Controlling Boundary and Sequence

Sprint `3A` is the accepted static component/contract baseline. The remaining
sequence increases one dimension at a time:

| Sprint | One objective | Native check or bounded group | Phase 3 category | Dependency |
| --- | --- | --- | --- | --- |
| `3B` | Certify the narrow privacy route-source tripwire as an advisory read-only pack | `privacy-route-static` | Static analysis | Accepted `3A` bridge/comparator pattern |
| `3C` | Certify the declared PATH/Intacct-mock source contract without implying Sage certification | `intacct-local-contract` | Static analysis and cross-repository source contract | `3B` proves the generalized one-pack bridge |
| `3D` | Certify admin frontend lint with explicit scope and no cache or fix effect | `admin-lint` | Lint | Single-repository native-tool admission from `3B`/`3C` |
| `3E` | Extend the certified lint pattern to the portal repository | `portal-lint` | Lint and cross-repository ownership | `3D` ESLint mechanics certified first |
| `3F` | Wrap and certify the admin native aggregate without losing either native phase | `admin-aggregate` | Unit/component aggregate | Static/lint packs and bounded process mechanics already certified |
| `3G` | Wrap and certify the portal native aggregate without losing discovery or phase ordering | `portal-aggregate` | Unit/component aggregate | `3F` aggregate evidence/lifecycle pattern certified first |
| `3H` | Certify role-aware source inventory plus before/after candidate stability | `candidate-source-inventory` and `candidate-source-stability` | Source inventory and source stability | All preceding pack/input roles are known and versioned |

No aggregate is presumed certifiable. If its declared inputs, local effects,
termination, or residue cannot be proved within its sprint, that sprint stops
with evidence and requires a separately authorized repair. Later sprints do not
silently continue around it. This preserves Phase 0 RN01/RN02 and CP07 findings
at [the current-state audit](./release-qualification-harness-current-state-audit-2026-08-10.md)
`:299-314,389,434-444,1071,1100-1106`.

For `3B` through `3G`, the direct command runs the owning repository's unchanged
native runner. The advisory command runs the same bound native runner through
the qualification bridge and Sprint `2D` process controller. The comparator
checks product candidate, native bytes, working directory, dependency lock,
environment, pack version, native terminal result, output completeness and
termination while preserving distinct direct/advisory `harnessVersion` and
`attemptId` values. Human stdout/stderr remains diagnostic, not reinterpreted
product semantics. `3H` uses Git path enumeration and exact file bytes as native
source authority and does not call the current qualification gate.

Each pack remains `advisory`. Each sprint requires ten frozen-identity local
known-good attempts, every listed negative case, one forced interruption, and
five additional consecutive direct/advisory comparisons unless its bounded
scope explicitly records a stronger requirement. Exact historical evidence
remains valid for its old version but cannot certify changed pack, fixture,
selector, parser, adapter, transport, cleanup, manifest, dependency, or native
runner bytes.

The common proposed editable control files for `3B` through `3G` are exactly:

- `qualification/src/pack-validator.js`
- `qualification/src/native-readonly-bridge.js`
- `qualification/src/advisory-comparator.js`
- `qualification/bin/rq-native-readonly.js`
- `qualification/registries/phase3-read-only.registry.json`
- `qualification/qualification-role-manifest.json`
- `qualification/package.json`
- `qualification/package-lock.json`
- `qualification/README.md`
- `docs/testing/release-qualification-kernel.md`
- this target-architecture checkpoint
- the controlling-plan checkpoint and Sprint Ledger

Those common paths are ceilings, not instructions to change every file. Each
sprint adds only its named pack/test/fixture files below. Product/native inputs
are read-only unless an aggregate sprint stops and Bill later authorizes a
specific repair file in a new prompt.

### Sprint 3B - Privacy Route Static Pack

**Objective:** certify `privacy-route-static` as one narrow advisory source
tripwire while preserving the existing script and its focused Jest mutation
tests as semantic authority.

**Position:** this is the closest successor to `3A`: deterministic, short,
local and read-only, while adding cross-repository source inputs and a native
mutation corpus before lint or aggregate complexity. Phase 0 RN06 supports
retention only as a source tripwire, never runtime authorization proof (audit
`:303,1105,1175`).

**Proposed editable files:** the common Phase 3 files above, plus exactly
`qualification/packs/admin-privacy-route-static.pack.json` and
`qualification/test/admin-privacy-route-static-pack.test.js`. No product or
native test file is editable.

**Read-only inputs:** admin `package.json`,
`scripts/privacy-route-scope-smoke.js`, `src/lib/privacyRouteScopeChecks.js`,
`tests/privacyRouteScopeSmoke.test.js`, `tests/jest.config.js`,
`isetadminserver.js`, `src/widgets/CoordinatorAssessmentWidget.js`, portal
`server.js`, and the installed Node/Jest dependency bytes whose versions and
integrity are fixed by the listed package lock. Every path and dependency is
content-addressed in the pack role manifest.

**Direct commands:** from admin root,
`npm run smoke:privacy-routes -- --json` for the native tripwire and
`npm run test:backend -- --runTestsByPath tests/privacyRouteScopeSmoke.test.js --no-cache`
for the native in-memory deliberate guard-removal corpus.

**Advisory commands:** the exact admitted equivalents
`node qualification/bin/rq-native-readonly.js <attemptId> privacy-route-static known-good`
and
`node qualification/bin/rq-native-readonly.js <attemptId> privacy-route-static mutation-proof`.
The future implementation must replace placeholders with the plan-bound
attempt identity; no ambient argument or glob is allowed.

**Effects:** reads only the named source/config inputs; runs bounded Node/Jest
children with cache disabled; captures logs/results. It may not write product
files, start HTTP services, access a database/AWS/browser/network/deployed
environment, use TEST/PROD, run the current qualification gate, or infer runtime
privacy coverage.

**Verification:** strict pack/registry/role validation; exact alias/script/input
digests; all 71 current native checks; each existing focused guard-removal
mutation detected; ten known-good advisory attempts; five additional direct /
advisory matches; wrong source digest, omitted portal source, changed test
scope, unknown input, native nonzero, output corruption, comparator disagreement,
timeout and forced process-tree interruption; frozen product/harness/environment/
pack identities with distinct attempts; full qualification regression and
whitespace/import-boundary checks.

**Completion and stop:** complete only with zero direct/advisory disagreement,
no unauthorized effect, and pack maturity still `advisory`. Stop after updating
its evidence/checkpoint. Any source-tripwire false authority claim, input drift,
or unexplained mismatch blocks completion; do not patch product guards or start
`3C`.

**Separate approval:** Bill must issue the exact copy-ready `3B` authorization
at the end of this section. Passing `3B` does not authorize `3C`.

### Sprint 3C - Intacct Local Source Contract

**Objective:** certify `intacct-local-contract` as a bounded advisory PATH/mock
source-drift check while explicitly preserving that it is not Sage service or
API certification.

**Position:** it follows the single-repository/cross-source `3B` pattern and is
the first non-Git cross-repository input. It remains ahead of lint and aggregates
because its native command is short and effect-free. Phase 0 RN07 records the
ownership and semantic limit (audit `:312,572-575,1106,1184`).

**Proposed editable files:** the common Phase 3 files, plus exactly
`qualification/packs/intacct-local-contract.pack.json`,
`qualification/test/intacct-local-contract-pack.test.js`, and
`qualification/test/fixtures/packs/intacct-local-contract-invalid/` containing
only an attempt-owned mirror manifest/source corpus for native deliberate drift.

**Read-only inputs:** admin `package.json`,
`scripts/intacct-contract-audit.js`,
`docs/data/integrations/intacct-interface-fidelity-manifest.json`,
`isetadminserver.js`, and `../intacct-mock-service/src/server.js`. The manifest's
exact local-contract path set is resolved and hashed before execution; its
external Sage references remain data, not network authority.

**Direct commands:** `npm run audit:intacct-contract` from admin root for the
current corpus; for the negative corpus, the unchanged native script is copied
byte-for-byte into an attempt-owned mirror and invoked as
`node <attempt-root>/scripts/intacct-contract-audit.js` against a mirror manifest
with one required marker deliberately absent.

**Advisory commands:** `node qualification/bin/rq-native-readonly.js <attemptId> intacct-local-contract known-good`
and the exact `deliberate-drift` profile bound to the attempt-owned mirror.

**Effects:** read-only product/mock source inspection plus bounded writes and
deletion only inside the qualification-owned temporary negative mirror. No
service start, HTTP/network, database, AWS, identity, browser, deployed
environment, ordinary mock mutation, Sage claim, or current-gate execution.

**Verification:** manifest/path/digest and cross-repository identity binding;
ten known-good advisory attempts; five additional direct/advisory matches;
missing marker, missing file, path escape, undeclared mock input, changed
manifest, warning-versus-failure, malformed output and disagreement negatives;
forced interruption and mirror cleanup/residue proof; unchanged product
candidate across harness-only negative fixtures; full package regression.

**Completion and stop:** complete only if current native behavior and mirror
negative behavior agree in both paths, the non-Git mock inputs are explicit,
the temporary mirror has zero residue, and evidence says not Sage certification.
Stop before `3D`; an unresolved ordinary mock ownership question remains visible
and cannot become mandatory coverage.

**Separate approval:** Bill reviews `3B` and explicitly authorizes only the
listed `3C` files, inputs, direct/mirror commands and local effects.

### Sprint 3D - Admin Lint Pack

**Objective:** certify `admin-lint` as a read-only advisory ESLint pack with its
current `src` scope explicit.

**Position:** lint introduces a package binary, dependency/config resolution and
cache-default decision after two direct Node-script packs, but remains simpler
than cross-repository lint or test aggregates. Phase 0 RN05 retains the rules
while recording that server/scripts/tests are outside scope (audit `:301,1104`).

**Proposed editable files:** the common Phase 3 files, plus exactly
`qualification/packs/admin-lint.pack.json`,
`qualification/test/admin-lint-pack.test.js`, and
`qualification/test/fixtures/packs/admin-lint.invalid.js`.

**Read-only inputs:** admin `package.json`, `package-lock.json`,
`.eslintrc.cjs`, the resolved ESLint/plugin package bytes, and the exact
`src/**/*.{js,jsx}` native lint scope. The invalid fixture is qualification-owned
and not added to product lint scope.

**Direct commands:** `npm run lint -- --quiet --no-cache`; the deliberate
negative invokes the same exact resolved ESLint binary and admin configuration
against `qualification/test/fixtures/packs/admin-lint.invalid.js` with
`--no-cache`.

**Advisory commands:** `node qualification/bin/rq-native-readonly.js <attemptId> admin-lint known-good`
and the exact `deliberate-lint-error` profile.

**Effects:** bounded local process and source/config reads only. Cache and
`--fix` are prohibited; no source write, external process lookup, network,
database, AWS, browser, HTTP service, build, environment or current gate.

**Verification:** exact binary/config/dependency/source-scope binding; ten
known-good advisory attempts; five direct/advisory matches; deliberate native
lint error; stale config/lock/binary/source, cache request, `--fix`, scope
omission/addition, malformed output, timeout/interruption and disagreement
negatives; no cache/product residue; identity separation; cumulative regression.

**Completion and stop:** record the precise `src`-only limitation, certify no
write/cache residue and stop. Expanding lint to server/scripts/tests is a new
product-policy decision and cannot occur in `3D`.

**Separate approval:** Bill reviews `3C` and explicitly authorizes only `3D`.

### Sprint 3E - Portal Lint Pack

**Objective:** certify `portal-lint` using the portal-owned ESLint configuration
and dependencies without importing portal runtime code.

**Position:** it reuses certified lint mechanics while adding repository,
dependency-lock and owner separation before portal aggregate complexity.

**Proposed editable files:** the common Phase 3 files, plus exactly
`qualification/packs/portal-lint.pack.json`,
`qualification/test/portal-lint-pack.test.js`, and
`qualification/test/fixtures/packs/portal-lint.invalid.js`.

**Read-only inputs:** portal `package.json`, `package-lock.json`, package-level
`eslintConfig`, resolved ESLint/plugin bytes, and exact portal
`src/**/*.{js,jsx}` scope. Admin role manifests contain only references/digests;
product runtime imports remain prohibited.

**Direct commands:** `npm run lint -- --quiet --no-cache` from portal root; the
negative invokes the portal-resolved ESLint binary/config against the
qualification-owned invalid fixture with `--no-cache`.

**Advisory commands:** `node qualification/bin/rq-native-readonly.js <attemptId> portal-lint known-good`
and the exact `deliberate-lint-error` profile, with portal cwd and lock identity
fixed in the accepted plan.

**Effects:** the same read-only/no-cache boundary as `3D`, restricted to portal
inputs. No cross-repository write, product import, network, server, build,
database, AWS, browser, deployed environment or gate execution.

**Verification:** repeat the `3D` positive/negative/parity/identity/interruption
matrix against portal bytes; additionally reject admin binary/config fallback,
wrong cwd, wrong repository/lock and cross-repository identity conflation;
preserve full cumulative regression.

**Completion and stop:** certify only current portal `src` lint scope, record the
server/auth/notifications/routes exclusion, and stop before `3F`.

**Separate approval:** Bill reviews `3D` and explicitly authorizes only `3E`.

### Sprint 3F - Admin Native Aggregate Pack

**Objective:** wrap and certify `admin-aggregate` while preserving frontend then
backend native phase ordering, assertions and nonzero propagation.

**Position:** Phase 0 classifies the shell `wrap` and its React-Scripts/Jest
assertions `retain`, but proves mixed levels, ambient inputs, opaque combined
output, no aggregate bound/residue and a temp-residue finding. It therefore
follows all simpler admin packs and cannot be treated as a routine unit command
(audit `:299,389,434-444,564,1100-1103`).

**Proposed editable files:** the common Phase 3 files, plus exactly
`qualification/packs/admin-aggregate.pack.json`,
`qualification/test/admin-aggregate-pack.test.js`, and
`qualification/test/fixtures/packs/admin-aggregate-negative/` for an
attempt-owned mirror/sentinel. No existing product/native test is editable in
the initial sprint. If cleanup or ambient-input certification fails, any repair
file requires a new Bill prompt.

**Read-only inputs:** admin package/lock, `scripts/run-test-all.js`,
`tests/jest.config.js`, all discovered frontend/backend test and source inputs,
resolved React-Scripts/Jest bytes, and every test-declared cross-repository or
tool prerequisite. Ignored portal `.env`, MinIO binary/credentials, loopback
ports, system tools and temp roots must be explicitly admitted and redacted or
the sprint stops before the ten-run corpus.

**Direct commands:** `npm test` from admin root. The deliberate phase failures
run the same native aggregate bytes in an attempt-owned local mirror containing
one qualification-owned failing frontend sentinel and, separately, one failing
backend sentinel; no product worktree is changed.

**Advisory commands:** `node qualification/bin/rq-native-readonly.js <attemptId> admin-aggregate known-good`,
`frontend-failure`, and `backend-failure`, each with exact native phase results
retained separately as well as the aggregate result.

**Effects:** local reads, bounded child processes, native test-owned loopback
servers and explicitly declared temporary/cache files only. No external network,
database/SQL, AWS, browser, deployed environment, product/build output,
unowned fixture or current qualification gate. Termination and residue proof
must cover every descendant and declared temp root.

**Verification:** exact discovery/order/nonzero semantics; per-phase structured
evidence; ten clean advisory attempts; five additional direct/advisory matches;
frontend and backend deliberate failures; wrong phase order, missing phase,
ambient variable, hidden prerequisite, external network attempt, output
truncation, temp residue, timeout, cancellation, forced descendant termination
and comparator disagreement; frozen identities; no source/cache/process/socket/
temp residue; full qualification regression.

**Completion and stop:** complete only if all hidden prerequisites are explicit,
the existing residue gap is absent or independently resolved under separate
authority, and both native phases are repeatable without unauthorized effects.
Otherwise record evidence, mark `3F` incomplete, and stop for Bill's bounded
repair decision. Never clean product-owned residue silently or continue to `3G`.

**Separate approval:** Bill reviews `3E` and explicitly authorizes only `3F`,
including the declared local prerequisites and mirror negative corpus. That
approval does not authorize a product/native-test repair.

### Sprint 3G - Portal Native Aggregate Pack

**Objective:** wrap and certify `portal-aggregate` while preserving CRACO
frontend execution, recursive native `node:test` discovery, ordering and nonzero
propagation.

**Position:** it uses the aggregate evidence/lifecycle pattern only after admin
aggregate convergence. Portal discovery and cross-repository shared imports add
a distinct owner and input graph (audit `:300,389,1101,1103`).

**Proposed editable files:** the common Phase 3 files, plus exactly
`qualification/packs/portal-aggregate.pack.json`,
`qualification/test/portal-aggregate-pack.test.js`, and
`qualification/test/fixtures/packs/portal-aggregate-negative/` for
attempt-owned frontend/backend failure sentinels. No portal/native test file is
editable initially.

**Read-only inputs:** portal package/lock, `scripts/run-test-all.js`, CRACO
configuration and resolved binaries, every recursively discovered `.test.js`
below `auth`, `notifications`, and `routes`, their source inputs, and declared
shared/admin references. Discovery output is an identity-bound artifact rather
than an ambient scan.

**Direct commands:** `npm test` from portal root; negative commands run the same
native aggregate bytes in an attempt-owned mirror with separate failing CRACO
and `node:test` sentinels.

**Advisory commands:** `node qualification/bin/rq-native-readonly.js <attemptId> portal-aggregate known-good`,
`frontend-failure`, and `backend-failure`, with exact portal cwd/lock and
discovery artifact.

**Effects:** the same bounded local-only process/temp/loopback boundary as `3F`.
No external network, DB/SQL, AWS, browser, build/deploy output, deployed
environment, product mutation, current gate or unowned cleanup.

**Verification:** ten clean advisory attempts; five additional direct/advisory
matches; both deliberate phase failures; discovery inclusion/omission/order,
wrong cwd/repository/dependency, Jest-versus-`node:test` runner mismatch,
ambient input, output corruption, timeout/cancellation/forced termination,
socket/temp/process residue and disagreement negatives; separate identities and
full cumulative regression.

**Completion and stop:** complete only with an exact stable discovered-test set,
two separately attributable phases, no unauthorized effect/residue and no
direct disagreement. Otherwise stop for a separate repair/ownership decision.
Do not begin `3H` automatically.

**Separate approval:** Bill reviews completed `3F` and explicitly authorizes
only `3G` with the exact portal inputs and effects.

### Sprint 3H - Source Inventory and Stability Pack

**Objective:** certify a role-aware, identity-separated source inventory and a
before/after stability decision without invoking or changing the current
qualification gate.

**Position:** it is last because all Phase 3 pack, native, dependency and
cross-repository roles must be known before an authoritative inventory can be
defined. It replaces conflated candidate construction and repairs the retained
end-of-attempt drift check while preserving canonical file hashing and Git facts
(audit CP05-CP07 at `:1064-1071`, plus `:283,314`).

**Proposed editable files:**

- `qualification/src/source-inventory.js`
- `qualification/src/source-stability.js`
- `qualification/bin/rq-source-state.js`
- `qualification/packs/candidate-source-stability.pack.json`
- `qualification/registries/phase3-source-roles.registry.json`
- `qualification/registries/phase3-read-only.registry.json`
- `qualification/test/source-inventory-and-stability.test.js`
- `qualification/test/fixtures/source-state/` containing synthetic Git/file
  fixtures only
- `qualification/qualification-role-manifest.json`
- `qualification/package.json`
- `qualification/package-lock.json`
- `qualification/README.md`
- `docs/testing/release-qualification-kernel.md`
- this architecture checkpoint and the controlling checkpoint/ledger

**Read-only inputs:** Git HEAD/ref/index metadata for admin, portal and shared;
exact file bytes selected by approved product/harness/test-pack role manifests;
package/dependency locks, migration and generated-artifact role inputs; and the
Phase 3 registry/manifests. Bill-removed Intacct tooling is outside the active
PATH candidate and source-role inventory; it must not be read or guessed as a
repository without separate authorization. Unmapped files fail scope admission.
The seven previously protected
`sql/ops/prod-feedback-180-181-*20260810.sql` files remain excluded from content
reads and cannot enter a candidate without separate Bill authorization.

**Direct commands:** the proposed standalone native-Git boundary
`node qualification/bin/rq-source-state.js inventory --registry qualification/registries/phase3-source-roles.registry.json`
and
`node qualification/bin/rq-source-state.js verify --baseline <content-addressed-baseline-ref>`.
These commands invoke exact Git/file-byte primitives only; they do not invoke
`path-release-qualify`.

**Advisory commands:** the same plan-bound source inventory/stability operations
through the kernel's advisory command declaration, with a new `attemptId` and
the exact baseline artifact reference. Direct and advisory inventories are
structurally compared, not compared by raw JSON insertion order.

**Effects:** Git metadata and declared file-byte reads plus evidence in
qualification-owned temporary storage only. No product/source write, arbitrary
untracked-file content read, SQL/database, AWS, browser, HTTP/network, build,
deployment, environment access, current gate, admission or cleanup of user
files.

**Verification:** tracked/declared file inclusion; product/harness/test-pack,
migration/generated and dependency identity separation; canonical path-plus-byte
hashes; ten stable known-good inventories; five additional direct/advisory
inventory and stability matches; deliberate mid-attempt product, harness and
pack mutations with only the correct identity changing; missing/symlink/path
escape, unknown/unmapped, dirty-role, reordered JSON, stale baseline, conflicting
Git head, protected-path and detailed-drift negatives; forced interruption and
partial-evidence rejection; no late/stale inventory acceptance; full cumulative
Phase 3 regression.

**Completion and stop:** emit exact before/after differences and pass only when
every admitted role is unchanged. Complete Phase 3 technically only after the
consolidated exit gate below; then stop for Bill review. No pack promotion,
deploy admission, legacy retirement or Phase 4 begins.

**Separate approval:** Bill reviews completed `3G-SR1` and explicitly authorizes
only `3H`, including the role registry and explicit protected-path boundary.

### Phase 3 Exit-Gate Map

| Original exit requirement | Required cumulative proof |
| --- | --- |
| Five consecutive identical advisory runs | The accepted active cohort is `ai-guidance-contract`, `privacy-route-static`, `admin-lint`, `portal-lint`, and `admin-aggregate`; each retains its completed 10-run local certification and five direct/advisory matches. Bill removed the Intacct and portal-aggregate proposals from this cohort. After separately authorized `3H` is certified, five consecutive cohort attempts run the complete then-accepted Phase 3 advisory set under frozen product/harness/environment/pack identities and new attempt IDs; selection, native outcomes, evidence graphs and source-stability results must be identical. |
| Deliberate failing-test detection | `3A` duplicate fixture proves native failure; `3B` guard-removal mutations, `3D/3E` lint violations, `3F` separate frontend/backend failure sentinels and `3H` source mutations cover the accepted native/effect boundaries. Retained `3C` and `3G` evidence is historical and not counted as active-cohort certification. A wrapper failure remains separate from a native product/test failure. |
| No disagreement with direct commands | Each pack has five additional paired comparisons against its exact native direct command. Any identity, scope, runner, terminal result, output-completeness, effect, cleanup/residue or source-state disagreement is recorded and blocks the sprint/cohort; neither side is patched automatically. |
| Bill review | Bill separately reviews every sprint before the next authorization, then reviews the complete `3H` cohort evidence and explicitly accepts or rejects Phase 3. Technical completion does not promote a pack, change admission, retire the current gate or authorize Phase 4. |

Phase 3 is incomplete until every row passes. An aggregate repair stop inserts a
separately approved repair/certification sprint; it does not lower the exit
gate or renumber later work silently.

### Copy-Ready Sprint 3B Authorization

```text
The controlling plan is [release-qualification-harness-rebuild-plan-2026-08-10.md](/home/bill/ISET/admin-dashboard/docs/planning/release-qualification-harness-rebuild-plan-2026-08-10.md), and the approved architecture is [release-qualification-harness-target-architecture-2026-08-10.md](/home/bill/ISET/admin-dashboard/docs/planning/release-qualification-harness-target-architecture-2026-08-10.md).

Bill accepts the Phase 3 governance correction and authorizes Sprint `3B` only.

Objective: implement and certify the advisory read-only `privacy-route-static` pack, preserving `scripts/privacy-route-scope-smoke.js` and `tests/privacyRouteScopeSmoke.test.js` as the narrow native semantic and deliberate-mutation authorities. It must remain source-tripwire evidence and must not be represented as runtime authorization proof.

Editable scope is limited exactly to:

- `qualification/src/pack-validator.js`
- `qualification/src/native-readonly-bridge.js`
- `qualification/src/advisory-comparator.js`
- `qualification/bin/rq-native-readonly.js`
- `qualification/packs/admin-privacy-route-static.pack.json`
- `qualification/registries/phase3-read-only.registry.json`
- `qualification/test/admin-privacy-route-static-pack.test.js`
- `qualification/qualification-role-manifest.json`
- `qualification/package.json`
- `qualification/package-lock.json`
- `qualification/README.md`
- `docs/testing/release-qualification-kernel.md`
- the approved architecture checkpoint
- the controlling-plan checkpoint and Sprint Ledger

The only product/native inputs permitted are read-only access to admin `package.json`, `package-lock.json`, `scripts/privacy-route-scope-smoke.js`, `src/lib/privacyRouteScopeChecks.js`, `tests/privacyRouteScopeSmoke.test.js`, `tests/jest.config.js`, `isetadminserver.js`, `src/widgets/CoordinatorAssessmentWidget.js`, portal `server.js`, and the installed Node/Jest dependency bytes whose versions and integrity are fixed by the listed package lock.

Run only the exact direct commands `npm run smoke:privacy-routes -- --json` and `npm run test:backend -- --runTestsByPath tests/privacyRouteScopeSmoke.test.js --no-cache`; their admitted advisory equivalents; the focused and cumulative qualification tests; and syntax, dependency, role/import-boundary, digest and whitespace checks.

Verification must prove strict pack/registry/input identities, all current native route checks, every existing deliberate guard-removal mutation, ten frozen-identity advisory known-good attempts, five additional direct/advisory matches, native nonzero and malformed/stale/omitted-source/disagreement negatives, timeout and forced process-tree interruption, no cache/write/network/service/environment residue, identity separation, and no release authority.

Do not modify product/native source or tests, implement another pack, run the current qualification gate, start HTTP services, access a database/SQL, AWS/IAM, browsers, networks, builds, deployments, TEST or PROD, change release admission, promote a pack, retire machinery, begin Sprint `3C`, or begin Phase 4.

Preserve all pre-existing changes and protected SQL files. On unexplained failure, classify and report evidence before changing anything; two unexplained failures require an immediate design-review stop.

At completion, update only the approved checkpoint/ledger and report the outcome, exact files changed, direct/advisory and regression evidence, deviations, worktree state, Sprint `3B` completion decision, and the exact separate approval required for `3C`. Stop after Sprint `3B`.
```

## Sprint 3B Implementation Checkpoint

Sprint `3B` is complete. The bounded Phase 3 control plane now admits exactly
the accepted `ai-guidance-contract` and `privacy-route-static` advisory packs.
The latter binds the unchanged package aliases, package lock, native smoke,
helper, focused Jest mutation authority, Jest config/entry, admin server,
coordinator widget, portal server and interruption fixture by SHA-256. The
portal path must resolve to the exact sibling `ISET-intake/server.js`; no
unlisted external input is authorized.

The native smoke remains authority for 71 source-marker tripwires. The focused
Jest suite remains authority for its route-registration isolation assertion and
four guard-removal mutations. The bridge selects an exact registered
pack/profile, dispatches the underlying Node/Jest entry through bounded process
control, retains output as diagnostic evidence, and never treats static success
as runtime authorization proof. Direct records are now rejected unless their
command exactly matches the pack-declared package command and working directory.

Certification evidence:

- `npm run smoke:privacy-routes -- --json` returned `ok: true` with 71/71
  declared checks passing;
- the exact focused Jest command passed 3/3 native tests, including every
  recorded guard-removal mutation;
- focused qualification certification passed 9/9 tests: ten frozen-identity
  advisory successes, five additional direct/advisory matches, mutation parity,
  strict input/registry/role/alias/profile/command negatives, disagreement,
  source-byte preservation, identity separation and forced termination;
- cumulative qualification verification passed 204/204 tests, including the
  complete retained Sprint `3A` certification; and
- syntax, dependency-tree, strict bundle/digest, import-boundary and whitespace
  verification passed.

One initial sandboxed focused run produced no nested-child frames because the
tool sandbox suppresses nested child execution. The same authorized local test
was rerun with the sandbox override and exposed one test-only status-vocabulary
mistake (`completed` wrapper status versus `passed` native status); that single
assertion was corrected. No product/native source, environment, release gate,
selector, kernel, schema or admission behavior changed.

`privacy-route-static` remains `advisory`, has `releaseInfluence: none`, and
every registry/comparison artifact has `releaseAuthority: none`. Sprint `3B`
does not authorize `3C`, pack promotion, the current qualification gate, or
Phase 4.

**Exact next approval:** Bill reviews and accepts Sprint `3B`, then explicitly
authorizes Sprint `3C` only to implement and certify the advisory read-only
`intacct-local-contract` pack within the exact files, read-only inputs,
attempt-owned negative mirror, direct/advisory commands, effects, verification
and stopping point documented in the Phase 3 breakdown. No later sprint,
promotion or release-authority change is implied.

## Sprint 3C Implementation Checkpoint

Sprint `3C` is complete. The bounded Phase 3 registry now admits exactly
`ai-guidance-contract`, `privacy-route-static`, and `intacct-local-contract`.
The new pack content-binds the unchanged admin package alias, native audit,
fidelity manifest and admin server plus the exact non-Git sibling
`intacct-mock-service/src/server.js`. The manifest's local source set is proved
before dispatch, and any other sibling-mock path fails closed.

The normal profile reads those exact inputs only. The deliberate-drift profile
copies the native checker byte-for-byte into a qualification-owned temporary
mirror containing three content-addressed synthetic files. Mirror paths are
canonicalized and limited to its declared admin/mock source corpus; missing,
escaped or unlisted sources fail before execution. The mirrored native command
emits one advisory warning and one required-marker failure, then both direct and
advisory paths remove the mirror and prove zero residue. Evidence retains an
abstract attempt-mirror binding rather than a transient host path.

Certification evidence:

- `npm run audit:intacct-contract` passed all 18 declared local checks and
  retained seven explicit Sage-fidelity gaps; its own output states that it is
  a local PATH/mock drift guard, not Sage certification;
- focused Sprint `3C` certification passed 9/9 tests, including ten frozen-
  identity advisory successes, five additional direct/advisory matches,
  deliberate warning/failure parity, manifest/path/digest/input/command and
  disagreement negatives, five-identity separation, forced process-tree
  termination, unchanged source bytes and zero mirror residue;
- the unchanged Sprint `2D` process suite passed 28/28 in isolation, and the
  complete deterministic single-concurrency package regression passed 213/213;
  and
- syntax, dependency-tree, strict three-bundle/digest, package-version,
  import-boundary, temporary-residue and whitespace verification passed.

The authorized scope correction changed only the prior privacy test's brittle
two-pack count into an exact ordered assertion for the three accepted Phase 3
pack IDs; every privacy semantic assertion remains intact. One initial role-map
placement error failed strict bundle validation before native dispatch and was
corrected. The default parallel cumulative run passed 212/213 because an
unchanged process-tree fixture had not emitted its descendant PID before
cancellation; the exact test then passed in isolation and in the complete
single-concurrency run, so no Sprint `2D` file was changed.

`intacct-local-contract` remains `advisory`, has `releaseInfluence: none`, and
the registry/comparison evidence has `releaseAuthority: none`. It does not
certify Sage, a running local mock, a deployed service or any environment.
Sprint `3C` does not authorize `3D`, pack promotion, the current qualification
gate or Phase 4.

**Exact next approval:** Bill reviews and accepts Sprint `3C`, then explicitly
authorizes Sprint `3D` only to implement and certify the advisory read-only
`admin-lint` pack within the exact files, read-only inputs, no-cache/no-fix
direct and advisory commands, effects, verification and stopping point in the
Phase 3 breakdown. No later sprint, promotion or release-authority change is
implied.

## Sprint 3D Implementation Checkpoint

Sprint `3D` is complete. The Phase 3 registry now admits exactly
`ai-guidance-contract`, `privacy-route-static`, `intacct-local-contract`, and
`admin-lint`. The new pack preserves the unchanged root `lint` package script
and installed ESLint entry/configuration as native semantic authority. Its
known-good direct and advisory declarations are exact no-fix/no-cache
invocations of the current native `src` scope.

The pack content-binds root package and lock bytes, `.eslintrc.cjs`, the ESLint
entry, a closed set of 16 installed ESLint/config/plugin package trees, and an
aggregate over all 631 current files matching `src/**/*.{js,jsx}`. The package
aggregator hashes 2,175 owned dependency files without following nested npm
`node_modules` symlinks; the root lock separately binds dependency resolution.
Both aggregates use explicit locale-independent code-unit path ordering.
Scope omission, scope addition, stale config/lock/binary/source/dependency
bytes, cache or fix arguments, broadened effects and pack/role/registry drift
all fail closed before admitted execution.

Certification evidence:

- `npm run lint -- --quiet --no-cache` exited `0` against the unchanged native
  product scope; the native Browserslist output reported that `caniuse-lite`
  data is eight months old, which remains a nonblocking diagnostic rather than
  a reinterpreted lint result;
- the exact resolved ESLint/config command against the qualification-owned
  negative exited `1` for the expected native `no-undef` error;
- focused Sprint `3D` certification passed 10/10 tests, including ten frozen-
  identity advisory successes, five additional direct/advisory matches,
  deliberate failure parity, strict input/scope/command/effect negatives,
  malformed and disagreement evidence, identity separation, source/cache
  preservation and bounded process-tree interruption;
- deterministic single-concurrency cumulative qualification verification
  passed 223/223, preserving all Phase 2 and Sprints `3A-3C` assertions; and
- JavaScript syntax, dependency-tree, exact four-bundle/digest, package/lock
  metadata, role/import boundary, residue and whitespace verification passed.

The qualification-owned negative initially inherited ESLint's ignore boundary
and therefore required explicit `--no-ignore`; this does not change native
product scope. A first raw-fetch fixture was not a reliable error under the
out-of-scope fixture context, so it was replaced with a syntactically valid
native `no-undef` negative. The default tool sandbox also reproduced the
already documented nested-child suppression symptom: static admission passed,
but advisory process evidence had zero ready/result frames and terminated on
startup timeout. Captured evidence classified that as sandbox transport, and
the authorized pure-local certification commands then passed under the bounded
local-process override. These were explained harness/sandbox corrections; no
product source, ESLint config/dependency, native package alias, current release
gate, environment or admission path changed.

`admin-lint` remains `advisory`, has `releaseInfluence: none`, and registry and
comparison evidence retain `releaseAuthority: none`. Coverage is exactly
`src/**/*.{js,jsx}`; server, scripts, tests and other paths remain outside the
native pack. Any expansion is a separately approved product-policy decision.
Sprint `3D` does not authorize `3E`, pack promotion, the current qualification
gate or Phase 4.

**Exact next approval:** Bill reviews and accepts Sprint `3D`, then explicitly
authorizes Sprint `3E` only to implement and certify the advisory read-only
`portal-lint` pack within the exact common Phase 3 files, portal pack/test/
negative-fixture files, read-only portal package/lock/config/dependency/source
inputs, exact no-cache/no-fix direct and advisory commands, effects,
verification and stopping point in the Phase 3 breakdown. No later sprint,
promotion or release-authority change is implied.

## Sprint 3E Implementation Checkpoint

Sprint `3E` is complete. The Phase 3 registry now admits exactly
`ai-guidance-contract`, `privacy-route-static`, `intacct-local-contract`,
`admin-lint`, and `portal-lint`. The new pack preserves the unchanged
portal-owned `lint` package alias, package-level `eslintConfig`, and installed
ESLint entry/runtime as native semantic authority. The pack remains
`advisory`; registry and comparison evidence retain `releaseAuthority: none`.

The pack content-binds the portal package and lock, ESLint entry, the closed
set of 16 installed ESLint/config/plugin package trees, and the 100 current
files matching portal `src/**/*.{js,jsx}`. The dependency aggregate hashes
2,175 owned files without following nested npm `node_modules` links. Exact
role-manifest paths authorize those portal inputs from the admin-owned control
plane; undeclared sibling paths, admin binary/config fallback, wrong working
directory or repository/lock, and cross-repository identity conflation fail
closed. No portal runtime module is imported.

The direct known-good `npm run lint -- --quiet --no-cache` exited `0` against
the unchanged portal source scope, retaining only the non-semantic eight-month
Browserslist data notice. The exact native negative exited `1` for
`notDeclaredForPortalLintCertification` under `no-undef`. It uses
`--no-eslintrc --config package.json`, so the out-of-repository qualification
fixture loads the portal-owned package configuration and cannot inherit the
admin `.eslintrc.cjs`.

Certification evidence:

- focused Sprint `3E` verification passed 10/10, including ten frozen-identity
  advisory successes, five additional direct/advisory matches, deliberate
  failure parity, strict portal input/scope/command/effect/owner/cwd negatives,
  malformed and disagreement evidence, identity separation, source/cache
  preservation, and bounded process-tree interruption;
- deterministic single-concurrency cumulative qualification verification
  passed 233/233, preserving all Phase 2 and Sprints `3A-3D` assertions; and
- JavaScript syntax, dependency-tree, exact five-bundle/digest, package/lock
  metadata, role/import boundary, portal/admin residue, portal worktree, and
  whitespace verification passed.

Two deterministic pre-execution defects were corrected within scope. The new
test initially contained one missing parenthesis, caught by `node --check`.
The first focused bundle load then rejected an exact role-authorized portal
package path because the legacy resolver special-cased only portal `server.js`;
the resolver now admits any exact `../ISET-intake/` path only after the closed
pack/role allowlist accepts it, while retaining canonical-root containment.
Neither defect dispatched native work or changed portal source, configuration,
dependencies, product behavior, the current gate, or release admission. One
early wrapper wait returned partial TAP output; the authoritative focused run
was completed once and retained as the 10/10 result rather than treating the
partial capture as evidence.

Coverage remains exactly portal `src/**/*.{js,jsx}`. Portal server, auth,
notifications, routes, tests, scripts, and other paths remain outside this
pack. Any expansion is a separately approved product-policy decision. Sprint
`3E` does not authorize `3F`, pack promotion, the current qualification gate,
repair of the aggregate, or Phase 4.

**Exact next approval:** Bill reviews and accepts Sprint `3E`, then explicitly
authorizes Sprint `3F` only to implement and certify the advisory read-only
`admin-aggregate` pack within the exact common Phase 3 files, admin aggregate
pack/test/negative-mirror files, read-only native inputs and prerequisites,
direct and advisory commands, effects, verification and stopping point in the
Phase 3 breakdown. Any prerequisite, ambient-input, cleanup, or residue defect
requires a separate Bill-authorized repair; no continuation, promotion, or
release-authority change is implied.

## Sprint 3F Admission Stop

Sprint `3F` is incomplete and stopped before implementation or native
execution. Its approved completion rule requires every hidden prerequisite to
be explicit and every temporary, cache, process, socket, and other residue
scope to have an independently proved owner before the ten-run corpus.

Current source proves that the backend phase selects every
`tests/**/*.test.js` file (`tests/jest.config.js:3-14`). The selected
`tests/releaseAdmission.test.js` still creates separate
`path-release-admission-*`, `path-archive-preflight-*`, and `path-artifact-*`
OS-temporary trees (`:18-31,94-101,143-179`) and contains no teardown or
removal. Phase 0 finding 3 already rates this confirmed defect `low`: realistic
impact is repeatable local residue and cleanup/disk cost, with no demonstrated
product, deployed-environment, or material-workflow effect (audit `:434-444`).
It does not trigger the plan's critical automatic-stop rule, but it does fail
the stricter Sprint `3F` zero-residue certification gate.

The same backend phase selects `tests/localDevLaunchers.test.js`, which calls
`buildLaunchPlan` and `validateLaunchPlan` (`:8-35`). The launcher reads portal
`.env`, resolves the local MinIO binary, derives MinIO credentials from that
file or inherited environment, and rejects missing binary or credentials
(`scripts/local-dev-launcher.js:18-61`). Portal `.gitignore` excludes `.env`
and `/minio/` (`../ISET-intake/.gitignore:16-21,32-33`). Their current bytes,
values, and presence were deliberately not inspected. The accepted audit
therefore leaves the clean-clone provisioning contract unresolved rather than
calling it a confirmed product defect (audit `:564-570,603-608`). They cannot
be treated as frozen, redacted, content-bound advisory prerequisites under the
current authorization.

The aggregate shell also inherits ambient `process.env` and provides no native
aggregate timeout, cancellation, or residue assertion
(`scripts/run-test-all.js:9-38`; audit `:299,1100-1103`). A future wrapper may
address process ownership only after the prerequisite and native cleanup
boundaries are repaired or explicitly decided; this sprint did not assume that
the wrapper could silently clean native-test residue.

No pack, registry, role manifest, bridge, comparator, CLI, negative mirror,
qualification test, product/native file, or environment was changed. Neither
`npm test` nor a direct, advisory, focused, cumulative, or negative command was
run. No `.env`, MinIO binary, or credential value was opened or recorded, and
no existing residue was enumerated or removed. The five already certified
packs and the authoritative current release gate are unchanged.

**Completion decision:** Sprint `3F` is incomplete. Sprint `3G`, pack
promotion, release-authority changes, the current qualification gate, and Phase
4 remain unauthorized.

**Exact next approval:** Bill explicitly authorizes a bounded Sprint `3F-R1`
only to repair native aggregate certification blockers in
`tests/releaseAdmission.test.js`, `scripts/local-dev-launcher.js`, and
`tests/localDevLaunchers.test.js`, plus focused tests and the existing
qualification planning/checkpoint documents. The repair must assign teardown
and independent zero-residue proof to every created temp tree and make the
launcher contract test use explicit synthetic, non-secret, attempt-owned
prerequisites without changing normal launcher runtime behavior. It must not
read or record portal `.env`/MinIO credentials, start a service, access a
network or environment, modify aggregate ordering or product assertions,
implement the `admin-aggregate` pack, or begin `3G`. After focused cleanup and
prerequisite verification, stop for Bill to decide whether to reauthorize
Sprint `3F`.

## Sprint 3F-R1 Repair Checkpoint

Sprint `3F-R1` completed the two authorized native-test repairs without
implementing or executing the `admin-aggregate` advisory pack.

`tests/releaseAdmission.test.js` now registers each of its three OS-temporary
tree families with an attempt-local owner. Its `afterEach` teardown removes
every registered tree recursively, then performs a separate existence check
and fails if any owned path remains. The release-admission assertions and
aggregate ordering are unchanged.

`scripts/local-dev-launcher.js` now accepts explicit portal-environment,
ambient-environment, platform, and MinIO-binary inputs for contract tests. Its
normal no-argument runtime path is unchanged: it uses the same workspace,
reads the same portal `.env`, falls back to `process.env`, and derives the same
platform-specific MinIO path. `tests/localDevLaunchers.test.js` no longer
depends on that normal path. It creates one attempt-owned synthetic workspace,
three required inert directories, an inert MinIO file marker, explicit
non-secret sentinel values, and an empty ambient environment; teardown removes
the tree and the independent existence check proves zero residue. Described
plans continue to expose only environment-variable names, and the test asserts
that the sentinel values are absent.

Focused verification ran only
`tests/releaseAdmission.test.js`, `tests/localDevLaunchers.test.js`, and
`tests/testAllContract.test.js`: 3/3 suites and 18/18 assertions passed. The
first sandboxed invocation denied the two pre-existing local Node dry-run child
processes with `EPERM`; this was classified as an execution-sandbox limitation
before the identical focused command passed under the bounded local-test
permission. JavaScript syntax checks passed for all three changed source/test
files. No service, network, environment, product aggregate, current
qualification gate, advisory pack, or later sprint ran. No portal `.env`,
MinIO credential, or protected SQL file was read or changed.

**Completion decision:** Sprint `3F-R1` is complete. Sprint `3F` remains
incomplete, and `3G`, promotion, release-authority changes, and Phase 4 remain
unauthorized.

**Exact next approval:** Bill reviews and accepts Sprint `3F-R1`, then
explicitly reauthorizes Sprint `3F` only under its previously approved
objective, corrected editable scope, read-only native inputs and explicit
synthetic prerequisites, direct/advisory commands, effects, verification, and
stopping point. If any remaining prerequisite, ambient-input, cleanup,
process-ownership, or residue certification defect appears, stop without
repair. This approval must not authorize `3G`, promotion, release-authority
changes, or Phase 4.

## Sprint 3F Reauthorized Admission Stop

Bill accepted `3F-R1` and reauthorized `3F`, but the resumed sprint is still
incomplete. It stopped during the single direct known-good admission run,
before any pack, registry, role, bridge, comparator, CLI, negative mirror, or
qualification test was created or changed.

The exact authorized `npm test` command completed successfully: the frontend
phase passed 84 suites and 417 assertions, the backend phase passed 45 suites
and 433 assertions, phase order was frontend then backend, and the aggregate
returned zero. That result is not certifiable advisory evidence because the
backend phase proved a remaining ambient-input dependency. Multiple selected
tests import `isetadminserver.js`; its module initialization resolves the
repository-local `.env` and loads it with `override: true`
(`isetadminserver.js:29480-29498`). The retained command output explicitly
reported the local `.env` path, environment-derived CORS and Cognito values,
and `OpenRouter key detected` rather than the no-key branch. The AI branch is
selected from `OPENROUTER_API_KEY` or `OPENROUTER_KEY`
(`isetadminserver.js:40263-40272`). No credential value was printed or read by
Codex, but the native process consumed the ignored local configuration and its
behavior changed according to credential presence.

The `.env` bytes, variables, credential source, and current values are not an
explicit synthetic prerequisite, content-addressed pack input, redacted
environment identity, or authorized effect. A passing command under those
ambient conditions therefore cannot establish frozen direct/advisory parity,
clean-clone repeatability, or the required external-network prohibition. Per
Bill's explicit stop rule, the sprint did not patch the server, tests, native
runner, or qualification bridge and did not start the ten-run corpus. The
direct run started no deliberately requested service and made no known
database, AWS, deployed-environment, build, or qualification-gate operation;
however, this sprint makes no broader no-network certification claim from the
passing output.

**Completion decision:** Sprint `3F` remains incomplete. The reauthorized
attempt stopped correctly on a confirmed ambient-input certification blocker.
Sprint `3G`, pack promotion, release-authority changes, and Phase 4 remain
unauthorized.

**Exact next approval:** Bill explicitly authorizes a bounded Sprint `3F-R2`
only to remove the admin aggregate test path's ambient repository `.env`
dependency using an explicit synthetic, non-secret, attempt-owned test
configuration while preserving normal server runtime behavior and existing
product assertions. The authorization must name the exact server/test/config
files permitted for repair and allow only focused local verification. It must
not authorize inspection or copying of `.env`, real credentials, external
network access, aggregate-pack implementation, Sprint `3G`, promotion,
release-authority changes, or Phase 4. After the focused repair, stop for Bill
to decide whether to reauthorize Sprint `3F` again.

## Sprint 3F-R2 Repair Checkpoint

Sprint `3F-R2` completed the bounded synthetic-environment repair without
implementing the `admin-aggregate` pack. Filename, Git-tracking and source-
reference inspection found no tracked explicitly non-secret test environment
file or template: `.env` and `.env.test` are ignored; the allowed
`.env.example` name is absent; other test/example/template variants are absent
or ignored; and tracked `ssm-admin-env.json` is neither test-specific nor
identified by source/configuration as a synthetic test template. No ignored or
local environment-file contents were opened.

`src/server/adminEnvironment.js` now preserves the existing DEV repo-local and
PROD repo-local/legacy environment resolution while requiring `NODE_ENV=test`
to bind an absolute regular non-symlink `synthetic.env` inside an owned OS-temp
root. `scripts/run-test-all.js` creates that root with fixed non-secret values,
passes an exact child environment rather than ambient `process.env`, executes
the unchanged frontend-then-backend native phases, and removes and
independently proves absence of the root on success or failure.
`isetadminserver.js` loads the explicit test file with the existing override
semantics and fails closed if it cannot be loaded. The focused
`tests/adminEnvironment.test.js` contract proves DEV/PROD preservation,
test-path rejection, exact child keys, non-secret bytes, and zero residue.

Focused verification passed 2/2 suites and 8/8 assertions. The final exact
`npm test` aggregate passed frontend 84/84 suites and 417/417 assertions, then
backend 46/46 suites and 438/438 assertions in the required order. JavaScript
syntax, diff, whitespace and independent temporary-root absence checks passed.
No `.env` value, credential, protected SQL file, service, network, environment,
current qualification gate, pack implementation, promotion or later sprint was
accessed or changed.

**Completion decision:** Sprint `3F-R2` is complete. This repair changes
product-input bytes content-bound by existing advisory packs, so it does not by
itself re-certify or resume Sprint `3F`.

## Sprint 3F Reauthorization Identity Stop

Bill accepted `3F-R2` and reauthorized Sprint `3F`, but the resumed sprint
stopped before pack, registry, role-manifest, bridge, comparator, CLI, negative-
mirror or qualification-test implementation. The mandatory cumulative
certification prerequisite is currently invalid: both
`privacy-route-static@1.0.0` and `intacct-local-contract@1.0.0` content-bind
`isetadminserver.js` at SHA-256
`df3272bc5f182a7773e4782f274cd8abd1ada71f411a8db00f87e0797330bb34`,
while the accepted `3F-R2` repair produces
`527228e818621cec62cc8fa51dc793a7e85aa49273e881ae683454141759bec9`.

The existing independent pack validator rejected each bundle with
`INPUT_FINGERPRINT_DRIFT` at `isetadminserver.js`
(`qualification/src/pack-validator.js:657-701`). This is expected fail-closed
certification invalidation, not a product or native-assertion failure. The
approved `3F` scope permits cumulative registry assertions in prior pack tests,
but it does not permit editing or versioning
`qualification/packs/admin-privacy-route-static.pack.json` or
`qualification/packs/intacct-local-contract.pack.json`, nor re-running their
required certification corpora. Updating only registry digests or weakening
input validation would violate the accepted identity, lineage and maturity
rules.

No native command, focused/cumulative qualification suite, direct/advisory
comparison, negative profile or aggregate certification corpus was run after
the deterministic pre-dispatch rejection. One read-only shell source-navigation
command used an unescaped backtick and ended with a shell quoting error; it was
classified immediately, had no effect, and the corrected literal search
completed. No implementation or repair file was changed.

**Completion decision:** Sprint `3F` remains incomplete. The stop preserves
the certified fail-closed input boundary. Sprint `3G`, pack promotion, release-
authority changes, the current qualification gate and Phase 4 remain
unauthorized.

**Exact next approval:** Bill explicitly authorizes bounded Sprint `3F-R3`
only to version, rebind and re-certify the affected advisory
`privacy-route-static` and `intacct-local-contract` packs against the accepted
`3F-R2` `isetadminserver.js` bytes. Editable scope must include their two pack
manifests, registry/role metadata and existing focused pack tests plus the
common documentation/checkpoint files; native product source/tests remain
read-only. The work must run each affected pack's existing focused 10-run,
five-pair, deliberate-negative, identity, interruption, residue and cumulative
regression corpus, preserve their semantic and authority limits, and stop for
Bill to decide whether to reauthorize `3F`. It must not implement
`admin-aggregate`, begin `3G`, promote a pack, change release authority, access
an environment or perform Phase 4 work.

## Sprint 3F-R3 Cumulative Certification Stop

Sprint `3F-R3` advanced only `privacy-route-static` and
`intacct-local-contract` from pack version `1.0.0` to `1.0.1`, rebound their
shared `isetadminserver.js` input to the accepted `3F-R2` SHA-256
`527228e818621cec62cc8fa51dc793a7e85aa49273e881ae683454141759bec9`,
and updated their manifest and registry digests. Both focused tests now assert
the exact version and independently recompute that server digest. Their
purposes, native authorities, maturity, release influence, effects, fixtures,
commands, limitations and role paths are unchanged.

The authoritative `privacy-route-static@1.0.1` focused run passed 9/9 tests:
ten frozen-identity advisory runs, five direct/advisory pairs, all 71 native
source checks and guard-removal mutations, command/disagreement negatives,
identity separation and forced termination. The first sandboxed invocation
returned only a top-level Node worker failure, matching the already recorded
nested-child sandbox boundary; the identical bounded local-process invocation
produced the complete passing evidence. `intacct-local-contract@1.0.1` passed
9/9 tests, including its 10/5 corpus, deliberate local-source failure parity,
attempt-mirror zero residue, identity separation and forced termination.

The full cumulative qualification command then stopped clean completion on a
third, deterministic `3F-R2` invalidation. `admin-lint@1.0.0` content-binds the
admin `src/**/*.{js,jsx}` aggregate at
`4bd55e5191e34080c693915d36a17d159414b4cb453726bbca787d004ceeee16`.
The accepted new `src/server/adminEnvironment.js` file changes that exact scope
to `6f461195c5e5aa1ec1779ec075e6e16b07e1917af31c34d802b243705e2dfe64`.
The independent pack validator rejected the stale input with
`INPUT_FINGERPRINT_DRIFT` before the admin-lint certification file dispatched
native work. The cumulative result was 223 passed tests and one file-level
failure; all other executed files, including both `1.0.1` target packs, passed.

`admin-lint` files are outside `3F-R3`'s editable scope. No repair, metadata
change or rerun followed the failure. An initial generic registry patch briefly
matched the `ai-guidance-contract` version field instead of the privacy entry;
the immediate structured inspection found and corrected it before validation
or execution. The final registry keeps `ai-guidance-contract`, `admin-lint` and
`portal-lint` at `1.0.0` and only the two authorized packs at `1.0.1`.

No native product source/test, `admin-aggregate` implementation, environment,
release gate, promotion or later sprint changed or ran.

**Completion decision:** Sprint `3F-R3` is incomplete because the required
cumulative qualification regression is not clean. Its two target packs have
complete passing focused and in-cumulative evidence, but Sprint `3F` must not be
reauthorized while the admin-lint input binding is stale. Sprint `3G`, pack
promotion, release-authority changes and Phase 4 remain unauthorized.

**Exact next approval:** Bill explicitly authorizes bounded Sprint `3F-R4`
only to version, rebind and fully re-certify `admin-lint` against the accepted
post-`3F-R2` `src/**/*.{js,jsx}` scope. Editable scope is limited to
`qualification/packs/admin-lint.pack.json`, the Phase 3 registry,
`qualification/test/admin-lint-pack.test.js`, and approved documentation and
checkpoint files. Native product source/configuration and all other pack
manifests remain read-only. Run the existing admin-lint 10-run, five-pair,
deliberate-negative, identity, interruption and no-residue corpus plus the full
cumulative qualification regression, then stop for Bill to decide whether to
accept `3F-R3`/`3F-R4` and separately reauthorize Sprint `3F`. Do not implement
`admin-aggregate`, begin `3G`, promote a pack, change release authority, access
an environment or perform Phase 4 work.

## Sprint 3F-R4 Repair Checkpoint

Before any edit or native execution, the independent current bundle validator
checked every registered manifest against its current working-tree inputs. The
complete result was: `ai-guidance-contract@1.0.0`,
`privacy-route-static@1.0.1`, `intacct-local-contract@1.0.1`, and
`portal-lint@1.0.0` valid; `admin-lint@1.0.0` alone failed with
`INPUT_FINGERPRINT_DRIFT`. Its exact `src/**/*.{js,jsx}` digest changed from
`4bd55e5191e34080c693915d36a17d159414b4cb453726bbca787d004ceeee16`
to `6f461195c5e5aa1ec1779ec075e6e16b07e1917af31c34d802b243705e2dfe64`
because the accepted `3F-R2` repair added `src/server/adminEnvironment.js`.
No other stale pack remained, so the authorized correction could proceed.

`admin-lint` advances to `1.0.1` and binds that exact post-`3F-R2` source
aggregate. Its manifest digest is
`671e1b970914a6f710d0bd241eb9f37948114f2f268ab67dfb5d4f3e0f24a538`;
the five-pack registry digest is
`fa27720e8d89dccd93f0fdbc8df6745fde412dab71a740956e17f981e5ea5423`.
The focused test now asserts the pack version and independently recomputes the
bound source-scope digest. The native command, package/config/dependency
bindings, deliberate-negative fixture, effects, maturity, limitations and
release-authority boundary are unchanged. A post-edit all-pack validation
again accepted all five exact manifests.

Focused `admin-lint` certification passed 10/10 tests. It included ten
frozen-identity advisory passes with no source/cache residue, five additional
direct/advisory matches, the deliberate native lint failure, malformed and
substituted evidence negatives, forced whole-process-tree interruption and
five-identity separation. Full cumulative qualification then passed 233/233,
including every registered advisory pack and the complete Phase 2 regression
foundation. Static syntax, dependency, strict digest/bundle,
role/import-boundary and whitespace checks passed.

Three local execution mistakes were classified and corrected without changing
scope or product behavior: the first read-only validation wrapper had invalid
JavaScript string syntax and did not execute; the second used the validator's
wrong argument shape and failed uniformly on an undefined synthetic path
before inspecting pack inputs; and an initial generic registry patch matched
the first pack-version field. Structured inspection restored the unaffected
entry and set only `admin-lint` before any validation or native execution.
These were explained local orchestration/editing errors, not unexplained
qualification failures, and no retry weakened an assertion or authority
boundary.

No `admin-aggregate` pack, product/native source, environment, current release
gate, promotion, later sprint or Phase 4 work was implemented or accessed.

**Completion decision:** Sprint `3F-R4` is complete. It closes the cumulative
certification gap left by `3F-R3`; the bounded `3F-R3`/`3F-R4` identity-repair
sequence now has clean focused and cumulative evidence. Sprint `3F` itself has
not resumed and remains incomplete pending Bill's separate decision.

**Exact next approval:** Bill reviews and accepts Sprints `3F-R3` and `3F-R4`,
then explicitly reauthorizes Sprint `3F` only under its previously approved
objective, corrected editable scope, read-only native inputs, certified
`3F-R1` teardown boundary, certified `3F-R2` synthetic environment,
commands, effects, verification requirements and stopping point. If any
remaining prerequisite, ambient-input, cleanup, process-ownership or residue
defect appears, stop without repair. Sprint `3G`, promotion, release-authority
changes, environment access and Phase 4 remain unauthorized.

## Sprint 3F Backend-Negative Certification Stop

Bill accepted `3F-R3`/`3F-R4` and reauthorized Sprint `3F`. The resumed sprint
implemented the bounded advisory `admin-aggregate@1.0.0` pack, six-pack Phase 3
registry and role bindings, native read-only bridge and comparator support,
qualification-owned frontend/backend negative mirrors, aggregate lifecycle
evidence, and focused certification tests. The pack preserves `npm test` and
`scripts/run-test-all.js` as semantic authority, retains frontend-before-
backend order, remains advisory, and has no release authority.

The pre-certification direct `npm test` admission passed frontend 84/84 suites
and 417/417 assertions followed by backend 46/46 suites and 438/438 assertions.
The focused certification then proved the manifest, registry, role, input,
dependency, identity and ambient-input boundaries; ten frozen-identity
advisory passes; five additional direct/advisory matches; the frontend native
failure; malformed/reordered/truncated/conflicting lifecycle evidence
rejection; forced process-tree interruption; and five-identity separation.

Certification stopped on the backend deliberate-negative case. The advisory
command exited `1` and was recorded as failed as expected, but
`advisory.phaseEvidence.valid` was `false` at
`qualification/test/admin-aggregate-pack.test.js:447`. The following exact-
phase, cleanup, residue, direct-result and parity assertions therefore did not
run. The derivation requires the exact backend start/failure markers, their
order and uniqueness, exit `1`, and no signal
(`qualification/src/native-readonly-bridge.js:164-214`), but the failed test
did not durably retain the derived marker indexes/counts or captured stream
bytes. The present evidence cannot determine whether the cause is marker
framing, ordering, truncation, duplication, another process result, or a
different harness condition. It is therefore `unclassified`, not a confirmed
product, prerequisite, ambient-input, cleanup, process-ownership or residue
defect.

No repair or rerun followed. A read-only post-failure check found no
`rq-admin-aggregate-*`, `iset-admin-test-all-*`, or
`iset-release-admission-*` temporary directory, so no local residue was
observed. The cumulative qualification regression was not run because the
focused certification gate was not clean. Sprint `3G`, promotion, release-
authority changes, environment access and Phase 4 did not begin.

**Completion decision:** Sprint `3F` remains incomplete. Its known-good,
paired-parity and frontend-negative cohorts passed, but the backend deliberate-
negative evidence is not certified and its retained evidence is insufficient
for deterministic classification. The fail-closed stop is required.

**Exact next approval:** Bill authorizes bounded Sprint `3F-D1` only to
reproduce the existing `admin-aggregate` backend-failure profile once under
the frozen Sprint `3F` identities, retain its attempt-owned stdout, stderr,
process result and complete derived phase evidence, and independently prove
mirror, synthetic-environment and process residue absence. No implementation,
manifest, registry, native source/test, assertion, parser, timeout or authority
change is authorized. If the retained evidence identifies a repair, stop and
request a separately bounded repair authorization; if it does not, report the
remaining evidence gap. Do not run the known-good cohort, cumulative suite,
another pack, Sprint `3G`, an environment operation or Phase 4 work.

## Sprint 3F-R5 Cumulative Certification Stop

Sprint `3F-D1` proved that the `backend-failure` profile failed in the frontend
phase because its attempt-owned mirror omitted tracked native-test inputs. The
authorized pre-edit closure comparison then found five, rather than the
initial three, direct literal root-relative reads outside the declared mirror
scope: the admin AI fixture, three payment/event migrations, and the payment-
evidence baseline operations SQL. The initial `3F-R5` authorization therefore
stopped without editing. Bill corrected the authorization to the exact five-
file set.

The corrected repair replaces the aggregate collector's single declared
migration with the exact six-file root-input closure: the previously bound
schema-ownership migration plus those five confirmed reads. The collector now
contains 859 files and has product-scope digest
`877c62b04154a566e5043e9f7898e28bd8b1787eadf46829424ffbb51cd1f370`.
`admin-aggregate` advances from `1.0.0` to `1.0.1`, with manifest digest
`496bf8fb9cc669b8a915c196c93abca5b625850f4c1429d23769d2c0aa3dcf71`;
the six-pack registry digest becomes
`b7e73690505d462f158915f1f36f91f44a09926498fd5669d7609be6700ba5a9`.
All other pack versions and manifest digests remain unchanged. The focused
test fixes the exact root-input closure and pack version.

All six current bundles validated before native execution. The separately
authorized backend-negative test passed once with the correct frontend-pass,
backend-fail phase evidence, direct/advisory parity, cleanup and zero residue.
The complete focused Sprint `3F` certification then passed 11/11 tests: ten
frozen advisory runs, five direct/advisory pairs, both deliberate phase
failures, malformed lifecycle evidence, forced process-tree interruption and
five-identity separation. The same aggregate corpus also passed inside the
cumulative run.

The cumulative regression stopped clean certification at 243/244. The existing
`intacct-local-contract` deliberate-drift test expected its attempt-mirror
cleanup evidence to be `completed`, but the advisory result reported
`unnecessary` (`qualification/test/intacct-local-contract-pack.test.js:377-395`).
Current source creates and removes the Intacct mirror
(`qualification/src/native-readonly-bridge.js:265-303,353-367,537-545`) but
selects a required/completed cleanup result only when the declaration has the
aggregate-specific `residueBaseline` field (`:576-590`). Intacct supplies a
`mirror` without that field, so the mirror is removed but its evidence is
misclassified as cleanup unnecessary. No `rq-intacct-*`,
`rq-admin-aggregate-*`, or synthetic-environment temporary root remained.

This is a confirmed shared-harness cleanup-evidence defect outside `3F-R5`'s
editable scope, not a product failure or demonstrated residue. No repair or
rerun followed. The Node cumulative runner continued its already-dispatched
remaining tests and finished with the single failure. One earlier cumulative
command placed `--test-concurrency=1` after the package file glob; Node rejected
that token as a missing filename before running any test. The corrected direct
single-concurrency command produced the reported 243/244 evidence. A generic
registry patch also briefly changed the first pack version; structured
inspection restored it before validation or execution and only the authorized
aggregate entry changed.

**Completion decision:** The `admin-aggregate@1.0.1` input-closure repair and
focused certification are complete, but Sprint `3F` remains incomplete because
the mandatory cumulative regression is not clean. Sprint `3G`, promotion,
release-authority changes, environment access and Phase 4 remain unauthorized.

The previously proposed tactical Sprint `3F-R6` is superseded by the bounded
convergence decision below. It is not authorized.

## Sprint 3F Convergence Review

This was the controlling plan's read-only step-back review. It inspected the
retained `3F-R1` through `3F-R5` and `3F-D1` evidence plus the current declared
pack/bridge contracts. It changed no implementation, test, manifest, registry,
configuration, environment or release authority and ran no qualification or
native command.

### Evidence-chain assessment

| Evidence | What it proved | Convergence meaning |
| --- | --- | --- |
| `3F-R1` | Native temporary-tree ownership and launcher-test prerequisites could be made explicit without changing aggregate semantics. | Isolated native hygiene repair; not evidence against the shared bridge design. |
| `3F-R2` | The aggregate needed an attempt-owned synthetic environment because the direct test path consumed ignored ambient `.env` state. | Isolated prerequisite repair. Its later fingerprint invalidations were correct fail-closed behavior, not random churn. |
| `3F-R3`/`3F-R4` | Privacy, Intacct and admin-lint bindings changed because accepted product-input bytes changed; exact affected packs were found incrementally and recertified. | Identity controls worked, but the staggered discovery showed that the full dependency closure must be calculated before future repair execution. |
| initial `3F`, `3F-D1`, `3F-R5` | The aggregate negative mirror omitted native-test reads; the retained diagnostic made the cause deterministic, and complete enumeration found five rather than the initially assumed three missing files. | Pack-specific input closure converged only after evidence-first diagnosis and complete enumeration. The stop rules worked. |
| `3F-R5` cumulative run | `admin-aggregate@1.0.1` passed its full focused corpus, then the already certified Intacct deliberate-drift case failed because shared bridge evidence contradicted its successful mirror cleanup. | This is the decisive cross-pack regression: aggregate onboarding changed a shared execution/evidence component and invalidated another pack outside the aggregate's focused corpus. |

The remaining observed behavior is narrow: the Intacct mirror is created,
removed, and independently absent, but its cleanup record says `unnecessary`
(`qualification/src/native-readonly-bridge.js:265-303,353-367,537-590`;
`qualification/test/intacct-local-contract-pack.test.js:377-395`). The declared
Intacct contract already requires cleanup and independent zero-residue evidence
(`qualification/src/pack-validator.js:160-169,676-678`;
`qualification/packs/intacct-local-contract.pack.json:181-199`). The bridge
instead decides whether cleanup was required from the presence of the
aggregate-specific `residueBaseline` implementation field. Physical cleanup is
therefore not defective on the retained evidence; the cleanup/evidence
contract is.

The design problem is broader than that one result. One implementation file
dispatches every current pack/profile and emits their shared cleanup evidence
(`qualification/src/native-readonly-bridge.js:21-32,306-435,537-590`). It emits
result version `1.0.0`, while the six active manifests bind the same adapter ID
to successive versions `1.0.0` through `1.5.0`. There is no enforced single
immutable implementation/version boundary: `pack-validator.js` checks only
that the adapter version is syntactically a version
(`qualification/src/pack-validator.js:630-635`). Every pack's certification
identity directly hashes the same bridge file
(`qualification/test/admin-ai-guidance-contract-pack.test.js:129-135`;
`admin-privacy-route-static-pack.test.js:145-151`;
`intacct-local-contract-pack.test.js:156-162`;
`admin-lint-pack.test.js:152-158`; `portal-lint-pack.test.js:153-159`;
`admin-aggregate-pack.test.js:184-190`). A shared change therefore changes the
`harnessVersion` of all six packs even though the manifest adapter-version tags
do not describe that fact consistently.

**Convergence decision:** the immediate Intacct result is behaviorally isolated,
but the current shared bridge design is not converging. Another Intacct-only
conditional would repair the observed assertion while preserving implicit
cleanup inference and an ambiguous adapter-version boundary. That would make
the next pack another opportunity for cross-pack breakage. This is a confirmed
shared-harness design/certification defect, with no demonstrated product
failure, residue, environment-safety event or release-authority effect. The
advisory stop remains mandatory; the critical automatic-stop rule is not
triggered.

### Complete affected set

| Pack version now recorded | Declared adapter binding | Direct behavioral exposure | Certification consequence of a shared correction |
| --- | --- | --- | --- |
| `ai-guidance-contract@1.0.0` | `native-readonly-bridge@1.0.0` | No observed cleanup defect | Rebind as `ai-guidance-contract@1.0.1` to the one corrected adapter version and fully recertify. |
| `privacy-route-static@1.0.1` | `native-readonly-bridge@1.1.0` | No observed cleanup defect | Rebind as `privacy-route-static@1.0.2` and fully recertify. |
| `intacct-local-contract@1.0.1` | `native-readonly-bridge@1.2.0` | Confirmed mirror cleanup-evidence misclassification | Rebind as `intacct-local-contract@1.0.2`; prove the corrected cleanup contract and fully recertify. |
| `admin-lint@1.0.1` | `native-readonly-bridge@1.3.0` | No observed cleanup defect | Rebind as `admin-lint@1.0.2` and fully recertify. |
| `portal-lint@1.0.0` | `native-readonly-bridge@1.4.0` | No observed cleanup defect | Rebind as `portal-lint@1.0.1` and fully recertify. |
| `admin-aggregate@1.0.1` | `native-readonly-bridge@1.5.0` | Its mirror/native-temp cleanup path currently passes because it supplies `residueBaseline` | Rebind as `admin-aggregate@1.0.2` and fully recertify, including both negative mirrors and native-temp residue proof. |

The complete adapter set is the single current `native-readonly-bridge`
implementation and its process-result/cleanup evidence operation. The complete
pack set is all six active Phase 3 pack versions above. Intacct and aggregate
are directly affected at the cleanup-operation boundary; all six are affected
at the immutable adapter binding, `harnessVersion`, and certification boundary.
Under the accepted rules, an adapter change invalidates every dependent pack
until compatibility is proved, and a pack version changes when its exact
adapter binding or operating obligations change (this document
`:2474-2494,2633-2638,3371-3389,3499-3515`). Product source does not change, so
`productCandidateId` must not change. Each rerun requires a new `attemptId`.
Old pack/adapter evidence remains historical only.

The recommended normalized binding is `native-readonly-bridge@2.0.0`: the
current cleanup/effect contract and version boundary change incompatibly, so a
new major adapter version is clearer than reusing any of the six provisional
tags. The six proposed pack versions are exactly the successors in the table.

### Viable approaches

| Approach | Architecture fit | Decision |
| --- | --- | --- |
| Change the cleanup conditional to test for `mirror` as well as `residueBaseline` | Smallest edit, but still infers authority from implementation shape and leaves adapter identity ambiguous. | Rejected. It treats the symptom. |
| Add an Intacct-only `residueBaseline` or cleanup special case | Preserves the aggregate-specific inference and either scans the wrong residue scope or adds another pack branch. | Rejected. It increases the coupling that caused the regression. |
| Split immediately into six independent adapters | Could isolate future changes, but the retained evidence does not justify six process-control implementations and their maintenance burden. | Rejected for this phase as excessive. |
| Keep one bounded native read-only adapter, give every admitted profile an explicit versioned operation declaration for effects, cleanup owner, residue scope and proof, and enforce one immutable adapter version across all consumers | Matches the accepted common-adapter and pack lifecycle contracts, preserves one process-control implementation, makes effect narrowing explicit, and gives invalidation a deterministic boundary. | Recommended. |

No permission, IAM, external environment, credential, or configuration change
by Bill can resolve this issue. The failure is deterministic local harness
logic: a validated cleanup obligation is not carried into the emitted result.
Changing external state would neither alter that branch nor make the evidence
truthful.

### Recommended bounded authorization

CODEX recommends Sprint `3F-C1`, not the tactical `3F-R6` proposal.

**One objective:** normalize the existing Phase 3 native read-only bridge to
one immutable adapter version and an explicit per-profile effect/cleanup/residue
contract, then rebind and recertify exactly the six current advisory packs. Do
not add or migrate another pack.

**Editable ceiling:**

- `qualification/src/native-readonly-bridge.js`
- `qualification/src/pack-validator.js`
- `qualification/src/advisory-comparator.js` only if strict validation of the
  existing cleanup-result shape requires it
- the six current `qualification/packs/*.pack.json` files named in the affected
  set above
- `qualification/registries/phase3-read-only.registry.json`
- the six existing focused `qualification/test/*-pack.test.js` files for those
  packs
- one new focused
  `qualification/test/native-readonly-bridge-lifecycle.test.js`
- `qualification/qualification-role-manifest.json` solely if required to bind
  that new test
- existing qualification operator documentation, this checkpoint, and the
  controlling-plan checkpoint/Sprint Ledger

No native product source/test, package dependency, command, fixture content,
product assertion, product candidate input, environment or release-admission
file is editable.

**Required implementation boundary:** define one current adapter version tied
to the shared implementation; require each profile to declare its permitted
effect subset, cleanup necessity, cleanup owner, residue scope and independent
proof operation before dispatch; validate those declarations against the pack's
declared effect/cleanup ceiling; emit cleanup evidence only from that admitted
operation contract and observed proof; fail closed on missing, broadened or
conflicting declarations. Preserve current native commands, semantic authority,
actual mirror deletion, process-control bounds, maturity and
`releaseAuthority: none`. Advance every pack to the exact successor version in
the affected-set table and bind all six to
`native-readonly-bridge@2.0.0`; do not change `productCandidateId` for this
harness-only correction.

**Permitted effects:** qualification-owned local source/manifest/test changes;
focused synthetic lifecycle tests; the six already approved direct/advisory
local pack corpora; attempt-owned mirrors and declared native temporary roots;
the already certified aggregate loopback-only test behavior; and static,
digest, role/import-boundary and whitespace checks. No external network,
database/SQL, AWS/IAM, browser, build, deployment, TEST, PROD, current gate,
promotion, `3G` or Phase 4 effect is permitted.

**Verification and ordered stop rules:**

1. Before native dispatch, prove one exact adapter version and the six-pack
   invalidation/version graph, and prove there is no seventh consumer.
2. Pass focused synthetic cases for read-only/unnecessary cleanup, mirror
   cleanup success, native-temp cleanup success, cleanup failure, residue
   detection, missing/conflicting declaration, timeout, cancellation and forced
   interruption. Any ambiguity stops before pack execution.
3. Run Intacct deliberate-drift first and require completed cleanup plus an
   independent absent mirror. Then run aggregate frontend/backend negatives and
   require mirror and native-temp zero residue. Any defect stops without repair.
4. Fully recertify all six affected pack versions using their existing ten-run,
   five-pair, deliberate-negative, identity, interruption and residue corpora;
   preserve direct/advisory semantic parity and no release authority.
5. Run the complete cumulative qualification regression and the existing
   syntax, dependency, strict bundle/digest, role/import-boundary, source
   preservation and whitespace checks. Independently prove no declared mirror,
   temp, process or socket residue.

**Stopping point:** Sprint `3F-C1` completes only if the shared adapter contract,
all six exact pack versions, and cumulative regression are clean under one
frozen identity set. Any new missing input, widened invalidation set,
prerequisite, cleanup, residue, process-ownership or architecture defect stops
the sprint without repair or rerun. Report evidence and return to Bill. Sprint
`3G`, promotion, release-authority changes and Phase 4 remain separately
unauthorized.

## Sprint 3F-C1 Transport-Version Stop

Bill authorized `3F-C1`. Pre-dispatch source enumeration proved exactly six
pack consumers of `native-readonly-bridge` and no seventh pack: the six pack
manifests, six `PACK_CONTRACTS`/profile groups, one CLI and their six focused
tests formed the complete graph. No native command ran before that proof.

The bounded implementation now defines adapter `2.0.0`, 19 explicit profile
contracts, per-operation capability/effect narrowing, cleanup owner, residue
scope and proof kind, and separate cleanup/proof operations for attempt mirrors.
The pack validator binds exactly the approved successor versions and adapter
`2.0.0`; all six manifests, the six-pack registry, focused tests and role
manifest were rebound. The comparator now rejects results whose adapter
operation, effects or cleanup evidence conflict with the admitted pack. This is
partial implementation evidence only, not certification.

Before native dispatch, JavaScript syntax passed for all changed source/tests.
The new in-process bridge-lifecycle test passed, including the exact six-pack /
19-profile graph, stale version rejection, broadened/conflicting declaration
rejection, exact cleanup-resource admission, read-only/interruption effects,
mirror cleanup versus independent proof, native-temp proof, cleanup failure and
residue detection. The existing synthetic process-control corpus initially
returned only the previously documented sandbox worker-failure signature; the
same bounded local-process command then passed 28/28, including startup/idle/
execution/total timeouts, cancellation, forced descendant termination and
result-framing negatives. Static bundle validation accepted exactly:

- `ai-guidance-contract@1.0.1`
- `privacy-route-static@1.0.2`
- `intacct-local-contract@1.0.2`
- `admin-lint@1.0.2`
- `portal-lint@1.0.1`
- `admin-aggregate@1.0.2`

All six bind `native-readonly-bridge@2.0.0`.

The first authorized native gate, the Intacct deliberate-drift test, stopped
before cleanup evidence could be admitted. It failed at
`createAdvisoryRecord` with `ADVISORY_EVIDENCE_INVALID: Advisory process lacks
one valid native result` (`qualification/test/intacct-local-contract-pack.test.js:378-395`;
`qualification/src/advisory-comparator.js:96-107`). Source proves the exact
cause without a rerun: `BRIDGE_VERSION` now correctly denotes adapter/result
version `2.0.0` (`qualification/src/native-readonly-bridge.js:22,825-832`), but
the CLI also uses it as the ready/result transport `protocolVersion`
(`qualification/bin/rq-native-readonly.js:8-14,49-57`). The unchanged process
controller accepts only `PROCESS_PROTOCOL_VERSION = 1.0.0` and rejects any
other frame version (`qualification/src/process-control.js:11,346-378`). The
adapter semantic version and transport protocol version were therefore
conflated. That is a deterministic local harness boundary defect, not an
Intacct product failure, native assertion failure, permission issue, cleanup
failure or environment/configuration issue.

The failed attempt left no matching `rq-intacct-*` directory and no matching
native-readonly/Intacct process. No aggregate negative, six-pack corpus,
cumulative qualification or static completion gate ran. Per the authorized
stop rule, the CLI was not repaired and the failed native gate was not rerun.

**Completion decision:** Sprint `3F-C1` is incomplete. Its shared contract and
version graph have passed their pre-native gates, but transport framing blocks
native evidence admission. Sprint `3F` remains incomplete. `3G`, promotion,
release-authority changes, environment access and Phase 4 remain unauthorized.

**Exact next approval:** Bill authorizes bounded Sprint `3F-C1-R1` only to
separate the existing process transport protocol `1.0.0` from adapter/result
version `2.0.0` in `qualification/bin/rq-native-readonly.js`, add the exact
transport/adapter separation assertion to
`qualification/test/native-readonly-bridge-lifecycle.test.js`, and update the
existing checkpoint documents. Preserve both versions, all native commands,
pack/adapter bindings, operation contracts, process-control behavior and release
authority. Run syntax, the in-process lifecycle file and the existing 28-case
synthetic process-control corpus, then use a new `attemptId` to run the Intacct
deliberate-drift gate once and independently prove mirror/process absence. Any
other failure stops without repair or rerun. Do not run aggregate or broader
pack/cumulative certification; after the focused repair, stop for Bill to
decide whether to reauthorize `3F-C1`.

## Sprint 3F-C1-R1 Verification Stop

Bill authorized bounded Sprint `3F-C1-R1`. The CLI now imports the unchanged
process-controller transport constant and emits both `ready` and `result`
frames with `PROCESS_PROTOCOL_VERSION = 1.0.0`. The bridge continues to emit
native-readonly results with `BRIDGE_VERSION = 2.0.0`; no pack manifest,
adapter binding, native command, operation contract, maturity, product identity
or release-authority field changed. The focused lifecycle regression asserts
both exact values, asserts that they are different, proves both CLI frames use
the process protocol, and rejects any remaining use of the adapter version as
the frame protocol.

JavaScript syntax and scoped whitespace checks passed. The in-process
native-readonly lifecycle file passed. The unchanged synthetic process-control
corpus passed 28/28 under its previously established bounded local-process
boundary, including protocol negatives and whole-process-tree termination.

The single authorized Intacct proof did not reach process dispatch. The bounded
diagnostic invocation supplied a fresh raw RFC 4122 UUID where
`runAdvisoryProcess` requires the validated `attemptId` identity primitive, so
`validateAttemptId` rejected it with `ATTEMPT_ID` before the CLI, Intacct native
checker or mirror ran. This is a harness invocation error in the verification
command, not a failure of the repaired transport boundary or the Intacct native
contract. Per the sprint's immediate-stop rule, the invocation was not
corrected or rerun. Independent checks found no `rq-intacct-*` directory and no
native-readonly or Intacct audit process.

**Completion decision:** Sprint `3F-C1-R1` is incomplete. The two authorized
source files contain the bounded version-separation repair and both synthetic
layers pass, but the required fresh-attempt Intacct proof is absent. Sprint
`3F-C1` and Sprint `3F` remain incomplete. No aggregate, other pack, cumulative
qualification, promotion, release-authority, environment, Sprint `3G` or Phase
4 work ran.

**Exact next approval:** Bill authorizes bounded Sprint `3F-C1-R1-V1` only to
construct one new Intacct `attemptId` through the existing `createAttemptId`
primitive, run the existing `deliberate-drift` advisory gate once, assert frame
protocol `1.0.0`, native result version `2.0.0`, expected native failure,
completed cleanup, independent zero-residue proof and
`releaseAuthority: none`, independently prove mirror/process absence, update
only the existing checkpoint documents, and stop. No code change, repair,
rerun after any failure, aggregate, other pack, cumulative qualification,
Sprint `3G`, promotion, environment or Phase 4 work is authorized.

## Sprint 3F Intacct Scope Reconciliation

Bill accepted Sprint `3F-C1-R1` after bounded verification `3F-C1-R1-V1` used
fresh advisory/direct attempt identities and proved the expected Intacct
deliberate-drift failure matched, frame protocol remained `1.0.0`, native result
version remained `2.0.0`, cleanup completed, independent zero residue passed,
and release authority remained `none`. No mirror or process residue remained.

Bill then supplied the controlling product fact that `intacct-mock-service` is
a rudimentary Sage Intacct REST simulation, is not part of the live PATH
solution, and is not expected to become part of it for the foreseeable future.
The following reconciliation is read-only and does not itself change any pack,
gate, test, authority or environment.

### Why it entered qualification

The current gate declares `intacct-local-contract` in the DEV
`alwaysRequired` set and also selects it for the broad `external-integrations`
domain (`docs/testing/release-coverage-inventory.json:28-47,421-432`). The
native command reads one manifest and performs literal-substring checks against
`isetadminserver.js` and the sibling mock; it explicitly labels itself a local
PATH/mock drift guard, not Sage certification
(`scripts/intacct-contract-audit.js:6-13,37-93`; fidelity manifest `:3-5,44-208`).
It was retained in Phase 0 only for that narrow deterministic drift capability,
with mock candidate ownership and external semantics unresolved (Phase 0 audit
`:312,572-575,1106,1184,1377-1379`). Sprint `3C` then implemented that exact
narrow capability as an active advisory pack, not as deployed or release
evidence (this architecture `:5233-5238`; pack manifest `:9-22,48-52,211-216`).

### Dependency determination

- Live PATH contains real Intacct REST configuration, canonical endpoint,
  envelope parsing and submission code. It accepts `INTACCT_MOCK_BASE_URL` and
  localhost only as local compatibility inputs; it does not import the sibling
  simulator (`isetadminserver.js:83374-83414,83440-83517,83930-84035`).
- The simulator is an optional local launcher item, not a required product or
  deployment component (`scripts/local-dev-launcher.js:27-70`). TEST/PROD app
  packaging names only admin, portal and shared
  (`docs/ops/agent-operational-access.md:19-25`).
- The current release qualifier runs the check only because inventory marks it
  mandatory. No later check consumes its result; the qualifier blocks on every
  non-pass uniformly (`src/lib/releaseQualification.js:122-128`;
  `scripts/path-release-qualify.js:218-234,308-382`). DEV candidate identity and
  final source stability cover admin, portal and shared, not the mock
  (`scripts/path-release-qualify.js:144-160,210-215,293-304`).
- Independent live-product assertions remain in the admin aggregate: documented
  success-envelope parsing and fail-closed behavior are tested directly, and
  the payment safety suite checks the PATH sender uses those parsers
  (`src/lib/__tests__/intacctRestEnvelope.test.js:1-46`;
  `src/pages/finance/widgets/__tests__/paymentsWorkflowSafety.test.js:106-132`).
  The launcher contract uses a synthetic directory and does not inspect or run
  actual mock bytes (`tests/localDevLaunchers.test.js:25-68`).

Therefore no live PATH runtime, deployment package or other release-gate
capability depends on `intacct-mock-service` or on the result of
`intacct-local-contract`. The current gate has a configuration dependency on
the check because it is declared mandatory, not a product dependency.

### Options and recommendation

| Option | Assessment |
| --- | --- |
| Keep it as an active advisory certification fixture | Preserves a useful local simulator drift alarm, but continues to bind an undeployed non-Git sibling into PATH harness identities, shared-adapter invalidation, cumulative certification and the Phase 3 exit cohort. This contradicts the controlling product boundary. |
| Mark it explicitly non-blocking while keeping it active | It is already `advisory`, `releaseInfluence: none`, under a registry with `releaseAuthority: none` (`qualification/packs/intacct-local-contract.pack.json:19-22`; registry `:8-10,33-43`). A label change would not remove its certification and exit-gate coupling. |
| Remove it from the active Phase 3 PATH qualification set and retain it as local-development tooling | Aligns qualification with the deployed product boundary, preserves the native audit and historical evidence, and makes any future real Sage contract pack require explicit product scope plus official documentation or sandbox evidence. |

**CODEX recommends the third option.** Do not delete the native script, fidelity
manifest, simulator, inactive pack artifact, fixtures or retained evidence.
Remove only their active advisory-registry, shared-adapter and Phase 3 cohort
authority. The local audit may continue to be invoked deliberately by its
owner outside PATH release qualification. A future PATH Intacct pack should be
newly designed only when real integration qualification is authorized; it must
bind product-owned source/assertions and approved official or Sage-sandbox
evidence rather than treating the simulator as fidelity proof.

### Consequences

- **Phase 0 no-loss:** RN07 remains an accurate historical inventory and the
  native capability is preserved, but its future disposition becomes a
  deliberate Bill-approved removal from PATH qualification rather than
  `retain`. This satisfies the architecture's explicit removal route while
  retaining the live-product aggregate assertions and recording that no Sage
  integration certification currently exists (architecture `:4555-4559`).
- **Sprint `3F-C1`:** the active graph changes from six packs/19 profiles to
  five packs/16 profiles. The completed Intacct transport/cleanup proof remains
  valid historical evidence but is not an exit requirement. Registry, role,
  validator, bridge, CLI and cumulative assertions must fail closed on the new
  exact active set. Because those shared harness inputs change, all five
  remaining packs require frozen-identity recertification before C1 can finish.
- **Phase 3 exit:** Sprint `3C` remains a truthful historical sprint, but the
  final cohort excludes Intacct. Deliberate-failure detection remains covered
  by AI invalid fixtures, privacy mutations, lint errors, aggregate negatives
  and later source-stability mutations. The planned categories of source
  inventory, native aggregates, lint, static analysis and source stability are
  unchanged (`:5233-5238,5668-5679`).
- **Later phases:** do not promote or migrate the Intacct local pack in Phases
  6-10. Preserve an explicit uncovered/disabled real-Sage-integration obligation
  so simulator evidence can never be mistaken for deployed coverage. Any
  future real provider test needs separate effect, environment and provider
  authority.
- **Current authoritative gate:** it remains unchanged and continues to run the
  legacy mandatory check during the advisory rebuild. Removing that blocker
  would change present release authority and requires a separate explicit Bill
  decision; it must not be smuggled into the Phase 3 scope correction.

### Exact next authorization

Bill must first approve the recommended disposition. The copy-ready bounded
authorization is:

> Bill accepts the Sprint `3F` Intacct scope reconciliation and approves removal
> of `intacct-local-contract` from the active Phase 3 PATH qualification set and
> exit cohort. Preserve its native script, fidelity manifest, simulator,
> inactive pack/fixture artifacts and retained evidence as non-authoritative
> local-development material. This approval is the deliberate no-loss removal
> decision; it does not change the current authoritative release gate.
>
> Bill reauthorizes Sprint `3F-C1` only to reduce the exact active graph from six
> packs/19 profiles to five packs/16 profiles; remove Intacct from the active
> registry, role bindings, validator contract, bridge profiles/operations, CLI
> admission and cumulative assertions; retain a non-executing scope assertion
> that the local audit artifacts remain outside active qualification; and fully
> recertify exactly `ai-guidance-contract`, `privacy-route-static`, `admin-lint`,
> `portal-lint` and `admin-aggregate` under one frozen identity set. Editable
> scope is limited to the existing Phase 3 registry, role manifest, package
> metadata, pack validator, native-readonly bridge, CLI, native lifecycle test,
> the six existing Phase 3 focused test files needed for exact-set assertions,
> the five active pack manifests only if digest rebinding requires it, and
> existing qualification/checkpoint documentation. Intacct native source,
> manifest, simulator, inactive pack/fixtures and product assertions are
> read-only and must not run.
>
> Before native dispatch, prove the active graph is exactly five packs/16
> profiles and that no active role, selection or exit requirement references
> Intacct. Then run the existing synthetic lifecycle/process gates, every active
> pack's ten-run/five-pair/negative/identity/interruption/residue corpus,
> cumulative qualification and static checks. Any missing input, unexpected
> consumer, cleanup/residue/process defect or architecture conflict stops without
> repair or rerun. Do not change the current release gate, promote a pack, begin
> Sprint `3G`, access an environment or perform Phase 4 work. Stop after Sprint
> `3F-C1` for Bill's review.

Bill must separately decide later whether to remove the legacy check from the
current authoritative inventory/runbook. That later decision is not a
prerequisite for the advisory five-pack C1 correction, but it is required before
the current gate can cease blocking releases on simulator drift.

## Sprint 3F-C1 Five-Pack Completion Checkpoint

Bill accepted the Intacct scope recommendation and authorized only the recorded
five-pack/16-profile `3F-C1` correction and recertification. The active Phase 3
PATH qualification graph is now exactly `ai-guidance-contract`,
`privacy-route-static`, `admin-lint`, `portal-lint` and `admin-aggregate`.
`intacct-local-contract` has no active registry entry, role input binding,
validator contract, bridge profile/operation or CLI admission. The native audit,
fidelity manifest, simulator, inactive pack/fixtures and retained Sprint 3C/C1
evidence remain present and unchanged as non-authoritative local tooling. A
non-executing certification assertion proves this retained/inactive boundary.

The role manifest advanced from `1.7.0` to `1.8.0` because its exact active
external-input and certification-fixture bindings changed. The five active pack
versions did not change: their commands, product inputs, assertions, adapter
binding, effects, maturity and release authority are unchanged. The registry
and role digests changed, so the advisory harness identity changed while each
`productCandidateId` remained bound only to its existing product inputs. The
bridge/result version remains `2.0.0`; the independent process transport
protocol remains `1.0.0`.

Before native dispatch, strict digest and bundle validation proved five active
packs, 16 profiles, and no active Intacct role, validator, bridge or CLI path.
The non-executing retention test passed 2/2. The lifecycle and process-control
safety gates passed 37/37, including conflicting effect declarations, cleanup
failure, residue detection, all bounded timeout classes, cancellation and forced
descendant termination.

Every active pack then passed its complete existing corpus under frozen
identities:

- AI guidance: 10/10 focused tests;
- privacy route static: 9/9;
- admin lint: 10/10;
- portal lint: 10/10;
- admin aggregate: 11/11, including ten clean advisory aggregates, five exact
  direct/advisory pairs, both phase-specific deliberate failures, corrupt phase
  evidence rejection, interruption and independent zero residue.

The cumulative qualification regression passed 246/246 with no failure,
cancelled, skipped or todo result. It repeated all five pack corpora and the
complete Phase 2 schema, identity, selection, lifecycle, process, kernel and
independent-validation tests. No Intacct native command ran. No new missing
input, prerequisite, cleanup, residue, process-ownership or architecture defect
appeared.

**Completion decision:** Sprint `3F-C1` and Sprint `3F` are complete. All five
packs remain advisory and `releaseAuthority: none`. The current authoritative
gate, including its legacy Intacct configuration, is unchanged. No pack was
promoted, no environment was accessed, and neither Sprint `3G` nor Phase 4
began.

**Exact next approval:** Bill reviews and accepts completed Sprint `3F`, then
separately authorizes Sprint `3G` only under the exact portal-aggregate files,
read-only inputs and certified prerequisites, direct/advisory commands, effects,
verification requirements and stopping point already recorded in the approved
Phase 3 breakdown. Any prerequisite, ambient-input, cleanup, process-ownership
or residue blocker requires a stop without repair. Promotion, current-gate
changes, environment access and Phase 4 remain unauthorized.

## Sprint 3G Editable-Scope Stop

Bill accepted Sprint `3F` and authorized only the recorded Sprint `3G` portal
aggregate scope. The pre-edit admission review proved that scope cannot produce
the required cumulative result. Adding `portal-aggregate` changes the active
graph from five packs/16 profiles to six packs/20 profiles, while six existing
certification files independently assert the exact old graph:

- `qualification/test/native-readonly-bridge-lifecycle.test.js`;
- `qualification/test/admin-privacy-route-static-pack.test.js`;
- `qualification/test/intacct-local-contract-pack.test.js`;
- `qualification/test/admin-lint-pack.test.js`;
- `qualification/test/portal-lint-pack.test.js`;
- `qualification/test/admin-aggregate-pack.test.js`.

None is in the recorded `3G` common-file ceiling or its three named portal-pack
additions. Leaving them unchanged would knowingly fail the mandatory cumulative
regression; bypassing or weakening them would violate the exact-set, no-loss and
fail-closed architecture. No portal/native input defect is being inferred from
this governance issue. The portal package alias and runner remain read-only; the
runner declares CRACO frontend first and recursively sorted `node:test` discovery
under `auth`, `notifications` and `routes`, but no native or advisory command was
executed.

**Complexity assessment:** the portal pack is not a leaf-only addition. Its
recorded design requires shared validator, bridge, CLI, registry and role-manifest
changes, which change `harnessVersion` and require cumulative recertification of
all five existing active packs. That blast radius is explicit and finite for the
six-pack/20-profile Phase 3 graph, but it demonstrates centralized certification
coupling. Sprint `3G` must not disguise that cost as an isolated pack change or
redesign the shared machinery without separate architecture authority.

**Commit-readiness assessment:** before this review, admin `main` and
`origin/main` were already aligned at `5d2ebb6`; portal and shared were also clean
and aligned with their remotes. Qualification programme source, schemas, packs,
tests, fixtures and planning documents are tracked in that admin commit. Root
`.env` and root dependency installation remain ignored; their contents were not
read. The existing commit also tracks 528 files below
`qualification/node_modules/`, despite the package/lock being the intended
dependency authority. Those vendored dependency bytes are a generated/dependency
artifact concern requiring an explicit later keep-or-remove decision, not a
Sprint `3G` repair. The protected SQL set was excluded from status, diff and
content inspection and must remain a separate protected workstream. No other
admin, portal or shared worktree change was present before these two checkpoint
edits.

Creating a commit without changing file bytes does not invalidate the current
Phase 3 pack certifications: their product, harness and pack identities are
content-bound rather than commit-message-bound. A later edit to any bound source,
manifest, registry, role, bridge, validator or dependency material does invalidate
the affected current certification and requires a new attempt. Sprint `3H` must
bind whatever Git HEAD and source-state baseline exists when it is separately
authorized; a commit before that sprint establishes its baseline rather than
retroactively changing retained evidence.

**Completion decision:** Sprint `3G` is incomplete and stopped before
implementation. Only this checkpoint and the controlling checkpoint changed.
No portal pack, fixture, shared harness source, package metadata, native source,
qualification command, environment, promotion, current gate, Sprint `3H` or
Phase 4 work changed or ran.

**Exact next approval:** Bill authorizes bounded Sprint `3G-S1` only to add the
six existing certification files listed above to the Sprint `3G` editable scope,
solely for preserving their existing semantic assertions while updating their
exact active graph from five packs/16 profiles to six packs/20 profiles. Bill
reauthorizes Sprint `3G` under its already recorded objective, common files,
portal pack/test/attempt-owned negative fixture files, read-only portal inputs,
direct/advisory commands, effects, verification and stopping point. Any further
scope, prerequisite, ambient-input, cleanup, process-ownership or residue defect
requires an immediate stop without repair. Sprint `3H`, promotion, current-gate
changes, environments and Phase 4 remain unauthorized.

## Sprint 3G Convergence and Repository Review

Bill confirmed that he created and pushed admin commit `5d2ebb6`; its human
provenance and authorization are therefore resolved. Local Git independently
records full commit `5d2ebb63e2bdc8e196dc9fca19377bda45b0e531`, author and
committer `BrimborionInc <bill@sillery.co.uk>`, subject `Part way through testing
project`, and both `main` and `origin/main` at that object. The remote-tracking
reflog records `update by push`. The commit has no locally recorded cryptographic
signature, so Git metadata alone authenticates neither the person nor the remote
operation; Bill's explicit statement supplies the controlling provenance fact.

### Registration Coupling and Architecture Assessment

Two kinds of coupling must be distinguished.

1. The Phase 3 registry and O1 role manifest must change for any active new pack.
   They are the deterministic authorization, ownership and exact input-set
   records (`qualification/src/pack-validator.js:673-765`; architecture
   `:3371-3397`). Their digests properly change `harnessVersion`.
2. The validator, bridge and CLI must change for `portal-aggregate` only because
   the current implementation embeds a second pack catalog in code. The
   validator hard-codes every pack version, manifest path, command, capability,
   effect, input count and cleanup rule, then requires the registry to equal that
   code-owned list (`qualification/src/pack-validator.js:101-242,563-708`). The
   bridge hard-codes every pack/profile and contains pack-specific dispatch,
   output and phase-evidence branches
   (`qualification/src/native-readonly-bridge.js:22-89,379-498,625-779`). The CLI
   separately hard-codes the pack-to-manifest map
   (`qualification/bin/rq-native-readonly.js:18-47`). This duplication is not a
   requirement of the modular-pack architecture; canonical manifests and an
   independently validated registry are intended to own pack definition and
   membership (`:3371-3397`).

The duplication is avoidable, but removing it now would be a material design and
implementation change rather than a local Sprint `3G` correction. It would not
remove the accepted certification consequence: the registry, role manifest and
control-plane bytes still change `harnessVersion`, and certification counts
restart after a harness-affecting change (`:3490-3519`). Nor may the existing
adapter implementation gain portal operations while continuing to call itself
`native-readonly-bridge@2.0.0`: adapter manifests and implementations are
immutable and plans bind their exact version (`:2474-2497`). If the recorded
shared-adapter route is retained, a successor adapter version, successor bindings
for all five active packs, and full affected certification are mandatory
(`:3507-3513`).

The viable choices are:

- continue under the old six-file correction: rejected, because it would reuse
  changed adapter bytes under `2.0.0`, leave five stale pack bindings, and omit a
  further exact-version assertion;
- first redesign registration/dispatch around independently versioned plug-ins:
  architecturally possible and likely to reduce later code edits, but it changes
  the accepted Phase 3 implementation approach, adds a new abstraction before
  the last aggregate, and still changes the global harness identity and requires
  compatibility/certification proof;
- finish `3G` through one explicitly versioned shared-adapter extension and
  complete recertification: finite, consistent with the recorded Phase 3 design,
  and preferred over an unplanned architecture rewrite. This is CODEX's
  recommendation after repository hygiene, provided the corrected scope is
  separately authorized and any newly discovered closure or safety defect still
  forces a stop.

### Complete Predictable Sprint 3G Scope Corrections

Merely adding the six files named in the earlier stop is insufficient. Before
execution, a corrected `3G` authorization must also include:

- all five active pack manifests, because each currently binds adapter `2.0.0`
  and a changed binding requires a new immutable pack version;
- `qualification/test/admin-ai-guidance-contract-pack.test.js`, because it also
  asserts the exact adapter and pack version even though it does not assert the
  whole registry set;
- the previously named lifecycle, privacy, inactive-Intacct-scope, admin-lint,
  portal-lint and admin-aggregate tests;
- the successor adapter version, registry digests, role-manifest graph, package
  metadata and the already recorded portal pack/test/negative-mirror files; and
- the portal repository environment files actually read by the admitted native
  phases: React Scripts loads `.env.test.local`, `.env.test` and `.env` when
  `NODE_ENV=test` (`../ISET-intake/node_modules/react-scripts/config/env.js:25-49`),
  while the backend server loads `.env` before its app-factory test boundary
  (`../ISET-intake/server.js:4-7,115-120`). `.env`, `.env.test`, `.env.production`
  and `.env.test.template` are tracked in the portal commit; `.env.test.local`
  is absent and must be proved absent or explicitly admitted if it later appears.

Bill explicitly permits those environment files to be read for this work and
does not want secrets migration to block the qualification programme. They may
therefore be treated as sensitive, digest-bound read-only native inputs; their
values must not enter logs, retained evidence or reports. If exact negative-mirror
semantics require local copies, those copies must be attempt-owned, excluded from
evidence, removed, and covered by independent residue proof. Moving residual
secrets to a managed store remains deferred operational work. Local Git also
proves the four tracked files are in the locally recorded `origin/main` tree,
and the files contain non-empty credential-class fields. Current
credential validity, repository visibility and remote rotation state were not
tested, so critical live exposure is unresolved rather than asserted. This is
not made the next sprint and does not change the current release gate.

The portal runner itself recursively discovers and sorts every `.test.js` below
`auth`, `notifications` and `routes`, runs CRACO first, then one native
`node --test` phase, and inherits the spawning process environment
(`../ISET-intake/scripts/run-test-all.js:10-59`). The architecture already
requires the discovered set, resolved dependencies, source inputs, and
shared/admin references to be closed and identity-bound (`:5543-5587`). Those
requirements remain a pre-dispatch enumeration obligation; this review did not
execute the runner or claim that no additional source-closure file can be found.

### Tracked Qualification Dependencies

Commit `5d2ebb6` added all 528 tracked files below
`qualification/node_modules/`; its parent contains none. They occupy about
3.0 MiB in the worktree and 1,239,415 Git blob bytes and contain the installed
Ajv package plus four transitive packages. The immediate mechanical cause is
that root `.gitignore` ignores only `/node_modules`, not nested
`qualification/node_modules/` (`.gitignore:3-6`). Git proves that the files were
added in the commit, but not whether vendoring was intended or which command
staged them.

They were not necessary or authorized by the accepted package scope. The design
specifies `qualification/package.json` and `qualification/package-lock.json` as
the private dependency declaration and exact closure and says no other Phase 2
file was proposed (`:4400-4417,4454-4465`). The lock pins Ajv `8.17.1` and every
transitive integrity (`qualification/package-lock.json:1-73`). Keeping the
installation can make an offline checkout immediately runnable, but duplicates
lock authority, obscures reviews, permits generated npm/platform bytes to drift,
and enlarges supply-chain, licence and security-scanning surface. No specific
vulnerability was established. CODEX recommends removing the 528 paths from
Git tracking and adding an exact nested ignore rule, while keeping the current
working installation non-authoritative and retaining package/lock bytes.

That cleanup does not require or justify history rewriting. It should leave the
five current pack manifests, registry, role manifest, declared product inputs
and dependency lock unchanged, so it should not alter their recorded identities;
this must be recomputed and proved before the cleanup sprint closes. A later
commit containing only this harness-repository hygiene remains a harness-only
repository change and must not become a new product candidate.

### Review Decision and Exact Next Authorization

Sprint `3G` remains incomplete. No implementation, native/advisory command,
certification, environment operation, promotion, release-authority change,
Sprint `3H` or Phase 4 work occurred. The earlier `3G-S1` authorization proposal
is superseded because six added tests would not close the adapter version,
pack-binding and native-input graph.

**CODEX recommendation:** perform the independent dependency-tree hygiene sprint
first, then return for a corrected, separately authorized `3G` using the finite
shared-adapter/version/rebind scope above. Do not combine repository cleanup and
portal aggregate implementation in one sprint.

**Exact next approval:** Bill authorizes bounded Sprint `3G-H1` only. Its sole
objective is to remove the 528 generated `qualification/node_modules/**` paths
from Git tracking and add `qualification/node_modules/` to root `.gitignore`
without changing installed dependency bytes, `qualification/package.json`,
`qualification/package-lock.json`, any qualification source/schema/manifest/
registry/role/test file, product source, or retained evidence. Editable scope is
limited to `.gitignore`, the Git index entries for
`qualification/node_modules/**`, and the existing architecture and controlling
checkpoints. Permitted effects are the exact ignore edit, index-only untracking,
and pure-local read/static verification. Verify zero tracked nested dependency
files, positive ignore matching, unchanged package/lock and installed Ajv bytes,
unchanged active pack/registry/role digests and identities, the five pure-local
Phase 2 focused suites, JavaScript syntax/import boundaries, and
`git diff --check`. Do not install dependencies, use a network, run a native
Phase 3 pack or current gate, alter Git history, commit or push, inspect protected
SQL, access an environment, implement `3G`, begin `3H`, promote a pack, change
release authority, or perform Phase 4 work. Any dependency, identity or scope
drift requires an immediate stop. Stop after `3G-H1` so Bill can separately
decide whether to authorize the corrected Sprint `3G` scope.

## Sprint 3G-H1 Completion Checkpoint

Bill confirmed the provenance of commit `5d2ebb6` and authorized only the
dependency-tree hygiene sprint above. Root `.gitignore` now excludes exactly
`/qualification/node_modules/`. Git's index contains exactly 528 staged
deletions below that directory and no staged path outside it; the tracked count
therefore changed from 528 to zero. `git rm --cached` preserved the working
installation: it still contains 528 regular files and no symlinks.

The installed-tree canonical tar digest remained
`9d01642766ae9d57006649afb294839e982027756e8e814260a2ecf3c5181976`.
`qualification/package.json` remained
`87c639b5795c66c00ff0d70e3a539c68115c5b87286c732a3d91db5553cedbb9`
and `qualification/package-lock.json` remained
`8572e719ef58758cc530e269b0745eee7e485002717eafabadfae5b70210b881`.
The aggregate of every non-installation qualification file remained
`bb79573574ef2298241e4eb3e8b6b9f5df6331be6d59f325d0295da37a7521c4`.
The five active pack manifests plus registry and role-manifest aggregate
remained
`012c43e6daae239e34fac5aa6c717003dc577bfb3ff9e4522b98cd9d1731dc0d`.
No package metadata, lock, implementation, schema, pack, registry, role,
fixture, test, product or identity byte changed.

The unchanged installation resolved Ajv `8.17.1` from
`qualification/node_modules/` and compiled a strict schema successfully. The
five pure-local Phase 2 focused suites passed. `2A`, `2B` and `2C` each passed
their focused wrapper; `2D` passed all 28 process-control cases; and `2E` passed
all 15 integration/independent-validation cases. The first default-sandbox
`2D` invocation produced the already documented nested-child suppression
signature: no inner TAP frames and outer exit `1`. Before rerun, the installed
digest remained exact and an independent process scan found zero synthetic
fixture processes. The identical command then passed 28/28 under the bounded
local-process permission already used for this recorded infrastructure limit.
This was an execution-sandbox classification, not dependency, identity, scope,
or test drift; no repair occurred.

Static verification passed for 40 non-installation qualification JavaScript
files, the source/bin import boundary, Ajv dependency usability, positive ignore
matching, zero tracked nested dependencies, zero synthetic process residue and
`git diff --check`. The initial index-only operation was denied by the workspace's
read-only `.git` sandbox and the identical explicitly authorized escalated
operation succeeded once. No dependency was installed, deleted or changed; no
network, environment, native Phase 3 pack, current gate, protected SQL, Git
history, commit, push, Sprint `3G`, `3H` or Phase 4 operation occurred.

**Completion decision:** Sprint `3G-H1` is complete. The working installation is
usable but non-authoritative and ignored; package/lock remains the dependency
authority. The staged deletions and `.gitignore`/checkpoint edits remain
uncommitted for Bill's review. This hygiene change does not alter a product
candidate, current qualification identity, pack certification or release
authority.

**Exact next approval:** Bill reviews and accepts completed Sprint `3G-H1`, then
separately authorizes corrected Sprint `3G` only. That authorization must retain
the recorded portal-aggregate objective, direct/advisory commands, native
authority, local-only effects and stop rules while explicitly adding the
successor native-readonly adapter version, successor bindings and versions for
all five active pack manifests, their complete recertification, the AI pack
version-assertion test, the six previously identified lifecycle/scope tests, and
the sensitive digest-bound portal environment inputs documented by the
convergence review. Any additional input-closure, prerequisite, cleanup,
process-ownership, residue, identity or architecture defect must stop without
repair. Sprint `3H`, promotion, current-gate changes, environments and Phase 4
remain unauthorized.

## Sprint 3G Source-Baseline Admission Stop

Bill accepted Sprint `3G-H1`, stated that its cleanup had been committed and
pushed, and authorized corrected Sprint `3G`. The mandatory pre-edit source
admission check contradicted that stated baseline in this checkout:

- `HEAD` and the locally recorded `origin/main` both remain
  `5d2ebb63e2bdc8e196dc9fca19377bda45b0e531`;
- the latest local HEAD reflog remains `5d2ebb6 commit: Part way through testing
  project`, and the latest remote-tracking reflog remains `5d2ebb6 update by
  push`;
- all 528 `qualification/node_modules/**` removals remain staged in the index,
  with no staged path outside that prefix;
- `.gitignore` and the two qualification planning/checkpoint documents remain
  modified but unstaged; and
- the installed ignored dependency tree still contains 528 files while the
  index correctly contains zero tracked paths below it.

The working bytes are consistent with the completed hygiene operation, but Git
does not provide the clean committed/pushed source identity Bill described. A
remote commit made from another checkout is possible, but cannot be established
without a separately authorized fetch/reconciliation; it must not be guessed.
Proceeding would bind the successor adapter and six-pack certification to an
ambiguous dirty/index state and would violate the accepted identity and
reproducibility rules (`:3371-3397,3490-3519,5543-5587`).

**Stopping decision:** corrected Sprint `3G` did not begin. No portal environment
file, native source graph, qualification implementation, pack, manifest,
registry, role, fixture or test was read beyond the already authorized governing
admission material or changed. No native, advisory, qualification, network,
environment, AWS, database, email, external-service, commit or push operation
ran. This is a deterministic source-identity prerequisite stop, not a product,
adapter or portal-test failure, and no repair or rerun is authorized.

**Exact next requirement:** Bill must first make this checkout and its locally
recorded `origin/main` agree on one clean committed Sprint `3G-H1` source object,
or separately authorize a bounded source-control reconciliation that preserves
the current bytes and identifies the exact remote commit. Once `git status` is
clean and `HEAD`/the approved source reference identify that exact object, Bill
must again authorize corrected Sprint `3G` under its already recorded complete
scope. Sprint `3H`, promotion, release-authority change, environment access and
Phase 4 remain unauthorized.

## Sprint 3G Corrected Implementation Stop

Bill established the clean source baseline after the prior admission stop. The
mandatory check passed before editing: admin `HEAD` and local `origin/main` were
both `176419dd3cf93d8c6398d49196301b5075d72a09`, and `git status` was clean.

The bounded implementation then advanced the immutable native-readonly adapter
to proposed version `2.1.0`, rebound the five existing active packs, added the
sixth `portal-aggregate` contract, recorded exact product/external/dependency/
discovery scopes, and added attempt-owned temp/mirror, loopback guard, cleanup,
residue and sensitive-output-redaction machinery. The discovered set is 17
frontend and 17 backend test files. Portal `.env.test.local` is absent; `.env`
and `.env.test` are present and bound only by SHA-256. No value is recorded in
documentation or retained output.

Pre-dispatch verification did not converge within the controlling failure
allowance:

1. The synthetic lifecycle plus inactive-Intacct scope invocation returned one
   failed file. A single module-load diagnostic proved the exact cause: the
   lifecycle test's synthetic resource omitted the existing
   `synthetic-interruption-fixture` authority marker, so the new validator
   correctly demanded the portal-native controlled environment. The test-only
   resource was corrected and the same two synthetic files then passed.
2. The next portal manifest/static-only gate ran for approximately 29 seconds
   and exited `1`, but the outer Node test report exposed neither a named
   subtest nor an underlying diagnostic. It is therefore `unclassified`.

The second failure triggered the plan's design-review stop. No portal native
aggregate, deliberate negative, direct/advisory pair, existing-pack
recertification corpus or cumulative qualification suite ran. No portal
environment value was emitted; no network, AWS, database, email, deployed
environment, build, deployment, TEST or PROD operation ran. The partial
implementation remains uncommitted and advisory; all registry and pack
authority fields remain `none`.

**Completion decision:** Sprint `3G` is incomplete. The unclassified failure
must be diagnosed before any repair, rerun of the gate, native dispatch or
certification continuation.

**Exact next authorization:** Bill authorizes bounded read-only Sprint
`3G-D1` only. Using the frozen partial Sprint `3G` working-tree bytes, reproduce
the focused portal manifest/static process failure exactly once with diagnostic
reporting sufficient to expose the pre-subtest load or named-subtest failure;
retain its command, stdout, stderr, exit and duration evidence; and independently
prove absence of `rq-portal-aggregate-*` temporary roots and related processes.
No code, manifest, registry, test, assertion, input, timeout, adapter, pack,
identity, documentation or authority change is authorized. Do not execute the
portal native aggregate, deliberate mirror, another active pack, cumulative
qualification, Sprint `3H` or Phase 4. Any repair or Sprint `3G` continuation
requires a separate later authorization.

## Sprint 3G-D1 Evidence and Design Review

Bill accepted the bounded diagnostic. Under the frozen partial Sprint `3G`
bytes, the one authorized command was:

`node --test --test-name-pattern='pack, six-pack|product, external|validation rejects|registry, role' qualification/test/portal-aggregate-pack.test.js`

It exited `1` after `13.132460664` seconds. Retained stdout is 553 bytes with
SHA-256 `8c542909eb249d86db06be6f813e0e8c1873ceb6887cf3ba8d303f3d37ea2539`;
stderr is empty with SHA-256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
The stdout contains only Node's file-level TAP wrapper at
`portal-aggregate-pack.test.js:1:1`, `ERR_TEST_FAILURE`, exit code `1`, no
signal and no named subtest. Independent before/after checks found no
`rq-portal-aggregate-*` root and no related process. D1 therefore confirms the
pre-subtest boundary but does not classify the terminating cause.

### Complete Load Path

The test first loads Node built-ins and then:

1. `advisory-comparator`, which loads `canonical-json` and `identities`;
2. `identities`, which reuses `canonical-json`;
3. `native-readonly-bridge`, which loads `canonical-json`, `identities`,
   `process-control` and `pack-validator`;
4. `process-control`, which reuses `canonical-json` and `identities`; and
5. the test's direct `pack-validator` import, which reuses the already loaded
   module (`qualification/test/portal-aggregate-pack.test.js:3-50`;
   `qualification/src/advisory-comparator.js:3-4`;
   `qualification/src/native-readonly-bridge.js:3-24`;
   `qualification/src/process-control.js:3-9`;
   `qualification/src/pack-validator.js:3-10`).

Those imported modules perform no file read, spawn, exit or environment access
during module loading. The bridge's only evaluated construction is immutable
profile/operation data through the pure `defineOperationSpec` helper
(`qualification/src/native-readonly-bridge.js:26-122,179-196`). No
`process.exit`, `process.exitCode`, abort or process-level exception handler is
present anywhere in this load graph.

The portal test then performs all fallible work before its first `test(...)` at
line 316:

- `loadBundle()` resolves and strictly parses the pack, registry and role
  manifest, validates them, verifies every declared input and checks the native
  package-script binding (`qualification/test/portal-aggregate-pack.test.js:82-86`;
  `qualification/src/pack-validator.js:974-981,983-1082,1084-1112`);
- input verification computes product, external, discovered-test and full
  installed-dependency scopes. The dependency scope breadth-first discovers
  declared and transitive dependency packages, recursively reads and hashes
  every file below each package, and canonicalizes the resulting material
  (`qualification/src/pack-validator.js:617-742,1000-1028`);
- the test immediately computes those same four scopes again and retains the
  resulting objects, including the complete dependency file graph
  (`qualification/test/portal-aggregate-pack.test.js:86-90`);
- it synchronously reads and hashes the two admitted environment files, package
  and lock files, four qualification sources and qualification lock file, then
  constructs all five identity bindings
  (`qualification/test/portal-aggregate-pack.test.js:91-189`).

Only after that work does the first named subtest register
(`qualification/test/portal-aggregate-pack.test.js:316-358`). Native dispatch
is inside `runDirect` and later asynchronous subtests, while bridge dispatch is
inside callable functions; neither was reachable in D1
(`qualification/test/portal-aggregate-pack.test.js:226-300,450-499`;
`qualification/src/native-readonly-bridge.js:1016-1098`).

### Confirmed Facts and Remaining Hypotheses

Confirmed:

- the failure is before named-subtest registration and before any native or
  advisory dispatch;
- the test has no local catch or diagnostic boundary around its module-scope
  validation, traversal, hashing and identity construction;
- any ordinary filesystem, strict-JSON, fingerprint, scope, canonicalization or
  identity error on that path is an uncaught module-initialization error;
- the installed dependency closure is traversed twice before registration, and
  the second complete result is retained at module scope;
- no explicit exit path exists in the loaded qualification sources; and
- D1 proves exit code `1`, no signal, empty stderr, generic parent TAP, and zero
  portal attempt/process residue. It does not prove which statement terminated.

Evidence-supported but unconfirmed mechanisms are: a synchronous filesystem or
validation exception whose diagnostic was not transported by the Node test-file
worker; resource exhaustion or another fatal runtime condition during the broad
duplicated dependency traversal/canonicalization; or a Node test-file worker and
parent reporting failure that lost or never received the inner diagnostic. A
syntax/module-resolution failure is mechanically possible before registration,
but the present sources exist, the imported shared modules were exercised by the
preceding passing synthetic run, and no syntax/module diagnostic was retained.
There is no evidence for a native portal failure, `.env`-driven external action,
bridge dispatch defect, cleanup defect, or qualification process-controller
failure. A normal top-level throw and a fatal/worker-reporting failure cannot be
distinguished from the retained output alone.

The empty streams are explained at the evidence boundary, not at the root-cause
boundary: the test itself emits nothing before registration and does not catch
module-scope errors; the parent received only an exit status and emitted its own
generic file wrapper. The evidence cannot establish whether the child created a
diagnostic that Node failed to transport or exited without creating one.

### Conclusion and Revised Approach

The confirmed defect is local to the new portal certification test's
initialization structure. The portal-specific collectors live in a shared
validator, but no shared validator defect is proved. The shared bridge and
process controller were not invoked. A Node runner/worker interaction remains a
possible contributing cause, not an evidenced primary defect.

The convergent next step is one test-local simplification, not another adapter,
compatibility layer or diagnostic rerun: register named tests before all
fallible work; build one lazy certification context inside a named setup test;
derive identities from the validated manifest's already verified scope digests;
and remove the redundant retained dependency-closure collection while
preserving exact scope, mutation, authority and native-semantic assertions.
This creates attributable evidence and reduces peak retained work without
changing the pack, registry, adapter, native commands, product inputs, product
candidate, release authority or approved architecture.

**Exact proposed authorization:** Bill authorizes bounded Sprint `3G-R1` only.
Objective: simplify `qualification/test/portal-aggregate-pack.test.js` so every
fallible portal manifest, scope, fingerprint and identity operation occurs
inside a named Node subtest, each complete observed scope is retained no longer
than its proof requires, and the validated manifest digests are reused rather
than retaining a duplicate full dependency closure. Editable files are limited
to `qualification/test/portal-aggregate-pack.test.js`, this architecture
checkpoint and the controlling-plan checkpoint/Sprint Ledger. Preserve every
pack, registry, role-manifest, adapter, native command, input digest, product
assertion, negative profile, identity, timeout, cleanup/residue rule, maturity
and `releaseAuthority: none`. Permitted effects are local source reads,
digest-only reads of the already admitted portal environment inputs, JavaScript
syntax/whitespace checks, and exactly one focused manifest/scope/static Node test
invocation after the edit. Do not execute a portal native command, negative
mirror, advisory process, another pack, cumulative qualification, environment,
network, AWS, database, build, deployment, TEST, PROD, Sprint `3H` or Phase 4.
Verification must prove named-subtest attribution, unchanged manifest/registry/
role and identity inputs, exact scope and stale-scope rejection, no native
dispatch, and zero `rq-portal-aggregate-*` or related process residue. If the
focused invocation again terminates without a named diagnostic, or exposes any
new input, identity, process, cleanup or architecture defect, stop immediately
without repair or rerun. Stop after the focused proof; resuming Sprint `3G`
requires separate approval.

## Sprint 3G-R1 Stopping Checkpoint

Bill accepted the design review and authorized only the recorded test-local
simplification. `qualification/test/portal-aggregate-pack.test.js` now registers
all named tests before calling a lazy certification-context initializer. The
initializer reuses package, lock, environment and four scope digests from the
pack manifest only after `validatePackBundle` has independently recomputed and
accepted every declared input. The test no longer creates or retains a second
complete portal dependency-closure object. The named scope proof retains the
product, external and discovery assertions locally; stale-input verification
retains one source-scope and one environment-fingerprint negative instead of
repeating the complete closure for every scope.

JavaScript syntax and `git diff --check` passed. The one and only authorized
focused invocation was the unchanged D1 command:

`node --test --test-name-pattern='pack, six-pack|product, external|validation rejects|registry, role' qualification/test/portal-aggregate-pack.test.js`

It again exited `1` without a named diagnostic: Node emitted only the generic
file-level `ERR_TEST_FAILURE` wrapper at line `1:1`, with no signal, after
`21.027062028` seconds. No rerun or repair followed. The declared
`rq-portal-aggregate-*` search was empty. The process search returned only the
Codex sandbox wrapper and the checking shell whose own command lines contained
the search terms; no test or portal-attempt process remained.

This result disproves the narrow prediction that moving initialization beneath
a named `test(...)` callback would itself make the terminating condition
attributable. It does not invalidate the simplification: duplicate retained
closure state is removed and the semantic contracts are unchanged. It does mean
that the remaining failure lies within or below the still-required
`validatePackBundle`/full installed-dependency traversal, fatal runtime handling,
or Node test-file worker/reporting boundary. Those alternatives remain
unclassified, and another tactical edit or execution is prohibited by the
controlling convergence rule.

No native portal command, mirror, advisory process, other pack, cumulative
qualification, network, environment service, AWS, database, build, deployment,
TEST, PROD, promotion or authority change ran. The partial Sprint `3G` and
`3G-R1` edits remain uncommitted for the next design decision.

**Completion decision:** Sprint `3G-R1` is incomplete as a resolution and Sprint
`3G` remains incomplete. The authorized focused proof failed at the same opaque
file boundary; no certification work may resume from this checkpoint.

**Exact next approval required:** Bill authorizes bounded read-only Sprint
`3G-DR2` only. Objective: determine, without execution, whether the portal full
installed-dependency byte-closure requirement and its placement inside
`validatePackBundle` are necessary to the accepted identity architecture or are
an overbroad certification implementation, and compare one bounded replacement
fingerprint boundary with retaining that closure outside the Node test-file
worker. Inputs are limited to the frozen partial Sprint `3G`/`3G-R1` sources,
pack/registry/role manifests, package and lock metadata without installed-byte
execution, accepted architecture, and retained D1/R1 output. Only the
architecture and controlling-plan checkpoints may change. Do not run tests,
collectors, native/advisory commands or dependencies; do not read environment
contents, repair code, broaden identities, access environments, resume Sprint
`3G`, or begin `3H`/Phase 4. Stop with one architecture-consistent recommendation
and the exact separately authorized implementation boundary.

## Sprint 3G-DR2 Dependency and Test-Worker Review

Bill accepted the R1 stop and authorized this read-only architecture review. No
test, collector, native/advisory command, dependency, environment value or
external operation was executed.

### Confirmed Boundary

R1 changed when initialization runs, not what the first selected test must do.
The first callback still calls `getCertificationContext`, which calls
`validatePackBundle`; bundle validation still invokes `verifyPackInputs`, and
the portal `native-dependency-scope` still invokes the complete installed-tree
collector before that callback can return
(`qualification/test/portal-aggregate-pack.test.js:93-102,350-352`;
`qualification/src/pack-validator.js:983-1046,1084-1112`). Therefore registering
the test first cannot make a fatal child-process termination inside this work a
completed named result.

The locally installed Node documentation establishes the outer boundary:
`--test-name-pattern` does not change which files execute, every selected test
file executes in a separate child process, a nonzero child exit makes the file a
failed test, and the file otherwise executes as a regular script
(`/usr/share/doc/nodejs/api/test.html:673,763-771`). D1 and R1 both show exactly
that parent fallback: one file-level `ERR_TEST_FAILURE`, exit `1`, no signal and
no child diagnostic. Moving the callback beneath `test(...)` cannot force the
child to transmit an event if the child terminates before it reports the named
result. This explains how the failure remains file-level; it does not identify
why the child exits.

The dependency collector itself is a confirmed identity defect as well as a
resource risk:

1. It seeds from every portal production and development dependency, not the
   packages actually resolved by the two admitted test phases
   (`qualification/src/pack-validator.js:699-708`; portal package dependencies
   at `../ISET-intake/package.json:5-46,101-104`).
2. It deduplicates only by package name and resolves every name at the top-level
   `node_modules/<name>` path (`qualification/src/pack-validator.js:709-731`).
   The accepted lockfile records distinct nested installed package paths and
   versions, for example nested Smithy packages and Babel's nested `debug`, `ms`
   and `semver` (`../ISET-intake/package-lock.json:130-166,2278-2309`). Those
   instances cannot be represented by the collector's one-name/one-root model.
3. For each chosen top-level package it recursively reads every regular file,
   creates a path/digest object for every file, retains all arrays, then
   canonicalizes the complete object (`qualification/src/pack-validator.js:423-453,730-742`).

The result is therefore neither the lockfile's exact installed-path closure nor
the native test phases' exact loaded-module closure. The architecture requires
an exact lockfile/dependency fingerprint and drift check, but does not prescribe
this in-memory representation (`:2640-2666,3371-3404`). The recorded Sprint 3G
input boundary requires the portal package/lock, CRACO configuration, resolved
binaries, discovered tests and declared source inputs (`:5543-5564`). The pack
already binds the complete lockfile, runner, CRACO configuration, CRACO entry
and React Scripts entry separately
(`qualification/packs/portal-aggregate.pack.json:100-135`). Removing the current
collector without a replacement installed-tree proof would nevertheless leave
local transitive-byte drift undetected and is not recommended.

### Facts Versus Hypotheses

Confirmed facts are: the two failures occur while the selected child must pass
through full dependency verification; both produce the documented Node
file-child fallback; the collector materializes all selected file records; its
root-only package-name graph conflicts with nested installed paths in the lock;
ordinary bridge/native/process-controller dispatch has not begun; and no signal,
stderr diagnostic or residue identifies a cause.

Resource exhaustion, a fatal Node/V8 condition, and a Node 18.19.1 test-child
reporting defect remain hypotheses. An ordinary caught test assertion or thrown
validation error is less consistent with the absence of a named failure, but is
not excluded by retained evidence. The 13.132-second D1 and 21.027-second R1
durations do not prove memory exhaustion. No evidence supports a portal product,
native-runner, environment, cleanup or external-service failure.

### Options and Recommendation

**Bounded correction:** replace only the portal installed-dependency collector
with a lock-path-driven, bounded-memory Merkle fingerprint. The lockfile's sorted
`packages` paths define package instances, including nested instances; each
present admitted package tree is walked in stable path order without descending
into a separately listed nested package, and path plus regular-file digest is
fed incrementally into a versioned hash instead of retained in one object.
Symlinks, escapes, missing required instances, unexpected instance roots,
unsupported entries and lock/installed version conflicts fail closed. Optional
absence is governed only by the lock metadata. The result contains the profile,
lock digest, package/file counts and root digest, not every file record. This
preserves exact installed-byte drift detection, corrects nested resolution, and
removes the evidenced peak-retention mechanism without a subprocess, cache,
retry, compatibility layer or weaker identity.

This correction is likely, but not guaranteed, to converge. It directly removes
the only confirmed high-volume/factually incorrect operation on the failing
path. It changes shared validator bytes, the portal pack contract/version,
registry/role digests and `harnessVersion`; consequently the already planned
five active-pack recertification remains required. Its risks are implementation
errors in path/optional/symlink handling and the possibility that the opaque exit
has a different cause. One focused proof is therefore the stopping point.

**Defer `portal-aggregate`:** this is viable and preferable to another repair if
the bounded correction fails. The certified `admin-aggregate` already provides
the Phase 3 unit/component aggregate category (`:5230-5238`), and the unchanged
current gate remains authoritative and continues to own portal aggregate
coverage. Deferral would not retire RN02/RN04 or claim replacement coverage; the
Phase 0 obligation to preserve CRACO and backend `node:test` discovery/exit
semantics remains open (`release-qualification-harness-current-state-audit-2026-08-10.md:1101-1103`;
this architecture `:3685-3690`). It would, however, require Bill to remove this
pack from the active registry and Phase 3 exit cohort, restore the last certified
five-pack control plane, preserve all retained 3G evidence, and explicitly carry
the portal obligation forward. The current Phase 3 contract says every `3B-3H`
pack and complete accepted cohort must pass, so Codex cannot infer that exception
(`:5668-5679`).

CODEX recommends the bounded streaming correction once, followed by its single
focused static/manifest proof. This is not automatic preference for completion:
it is selected because it repairs a confirmed architecture mismatch with less
new machinery than moving the collector outside the Node test child. Moving the
same materialized closure to another process would add transport, timeout,
partial-result and evidence-lineage responsibilities while retaining the wrong
root-only identity model. If the one correction fails or exposes another defect,
the recommendation becomes immediate scope reconciliation and deferral, not
`3G-R3`.

**Exact proposed authorization:** Bill authorizes bounded Sprint `3G-R2` only.
Objective: replace the portal-only installed-dependency collector with the
versioned, lock-path-driven, bounded-memory Merkle fingerprint specified by the
DR2 review, advance and rebind only the changed portal pack contract, and prove
the focused manifest/scope/static boundary once. Editable scope is limited to
`qualification/src/pack-validator.js`,
`qualification/packs/portal-aggregate.pack.json`,
`qualification/registries/phase3-read-only.registry.json`,
`qualification/qualification-role-manifest.json`,
`qualification/test/portal-aggregate-pack.test.js`, existing focused pack tests
only where their exact cumulative registry assertion must reflect the portal
version, and the architecture/controlling checkpoints. Preserve the successor
adapter, all native commands and product assertions, the five existing pack
contracts/versions, product candidate, effects, cleanup/residue rules, maturity
and `releaseAuthority: none`. Permit local source/package/lock/installed-byte
reads, digest-only admitted environment reads, syntax/whitespace checks, and
exactly one focused portal manifest/scope/static Node invocation. Verification
must cover nested lock paths, deterministic ordering, file mutation, missing and
unexpected package instances, symlink/path escape, optional absence, stale lock
and stale installed bytes, bounded result shape, unchanged non-portal pack
contracts, no native/advisory dispatch, and zero portal temp/process residue.
Do not run native portal commands, mirrors, other pack certification, cumulative
qualification, environments, networks, Sprint `3H` or Phase 4. If any focused
case or the sole invocation fails, stop without repair or rerun and request
scope reconciliation to defer `portal-aggregate`. Stop after the focused proof;
resuming full Sprint `3G` requires separate authorization.

## Sprint 3G-R2 Final Corrective Attempt and Scope-Reconciliation Stop

Bill authorized the DR2 lock-path correction as the final corrective attempt for
the current Sprint `3G` approach. The bounded implementation replaced the
portal-only package-name/materialized dependency collector with fingerprint
profile `1.0.0`: npm lock `packages` paths identify all installed instances,
including eight nested instances; one absent optional instance is admitted only
from lock metadata; missing required, unexpected, linked, escaped, unsupported
or version-conflicting instances fail closed; regular files are read in 64 KiB
chunks and fed in stable path order into a versioned root digest. The retained
summary contains only scope, profile, lock digest, package/optional/file/byte
counts and root digest. The current installation produced 2,048 present package
instances, one optional absence, 72,393 files, 426,255,139 bytes and root digest
`6b7ba6ed0ac8d14bbf59d6bd2641ab442d845f066e410f552c9af4d650494118`.
Only the proposed portal pack advanced, from `1.0.0` to `1.0.1`; the other five
pack contracts and versions were not changed by R2.

Two pre-proof metadata derivations exposed one deterministic representation
boundary: the qualification evidence parser correctly rejects non-integer JSON
numbers, while npm lock and installed package manifests legitimately contain
them. R2 therefore uses ordinary JSON parsing only to enumerate npm-owned
metadata; the raw lock and every installed regular file remain byte-digested,
and the qualification evidence parser and canonical-hash rules are unchanged.
This was not a portal/native dispatch or a product failure.

JavaScript syntax and authorized whitespace checks passed. The sole authorized
focused command was:

`node --test --test-name-pattern='pack, six-pack|product, external|validation rejects|registry, role' qualification/test/portal-aggregate-pack.test.js`

It again emitted only Node's file-level subtest failure: exit `1`, no signal, no
named subtest or assertion diagnostic, and duration 33.580 seconds. No native or
advisory portal command, mirror, other pack certification or cumulative suite
ran. Independent post-stop inspection found no `rq-portal-aggregate-*` root and
no related surviving process. The exact cause therefore remains
`unclassified`; R2 disproves the materialized/root-only collector as a
sufficient cause but does not establish a replacement cause. Under the explicit
final-attempt rule, no R3, repair or rerun is permitted.

### Required Phase 3 Scope Reconciliation

CODEX recommends deferring `portal-aggregate` from the active Phase 3 advisory
cohort. This does not retire or weaken the native portal aggregate: the current
authoritative gate remains unchanged and continues to run it. It also does not
claim replacement coverage. Phase 0 obligations RN02/RN04 remain open for CRACO
plus recursive backend `node:test` discovery, ordering and exit propagation.
The certified `admin-aggregate` supplies the Phase 3 unit/component aggregate
category, while later Sprint `3H` and the Phase 3 exit decision remain separately
authorized work.

The reconciliation must first retain a content-addressed record of the partial
3G diff and D1/R1/DR2/R2 command evidence. It must then restore the exact last
certified five-pack control-plane bytes from commit
`176419dd3cf93d8c6398d49196301b5075d72a09`, remove only the unadmitted partial
portal pack/test/negative-fixture artifacts from active code, remove
`portal-aggregate` from the registry and role bindings, and amend the Phase 3
cohort/exit wording to name the accepted five active packs. Reconciliation must
prove exact restored file digests, exact five-pack registry/role/adapter
bindings, current input validity, no portal active binding, unchanged current
gate, retained RN02/RN04, no release authority and a clean static boundary. It
must not recertify, promote or alter the five packs, run native checks, begin
`3H`, or enter Phase 4.

**Exact proposed authorization:** Bill authorizes bounded Sprint `3G-SR1` only.
Objective: retain the content-addressed Sprint `3G` attempt evidence, defer
`portal-aggregate` from the active Phase 3 advisory cohort, restore the exact
certified five-pack control plane from
`176419dd3cf93d8c6398d49196301b5075d72a09`, and record RN02/RN04 as an open
no-loss obligation while leaving the current authoritative gate unchanged.
Editable scope is limited to the currently modified `qualification/` files and
untracked portal pack/test/negative fixtures created by partial Sprint `3G`, an
attempt-owned retained-evidence path under `tmp/release-qualification/`, and the
existing qualification architecture, operator and controlling-plan documents.
Permit only read-only source/digest comparison, content-addressed local evidence
retention, exact restoration/removal of partial 3G bytes, five-pack bundle/input
validation that dispatches no native command, JavaScript syntax, role/import
boundary and whitespace checks, and residue inspection. Prohibit native or
advisory pack execution, recertification, product/native changes, environments,
networks, promotion, release-authority/current-gate changes, Sprint `3H` and
Phase 4. Stop on any mismatch with the certified five-pack baseline or any
evidence loss. Stop after scope reconciliation; Sprint `3H` requires a later
separate approval.

## Sprint 3G-SR1 Scope-Reconciliation Completion

The mandatory pre-restore overlap audit proved that admin `HEAD` and local
`origin/main` both identify certified commit
`176419dd3cf93d8c6398d49196301b5075d72a09`. Every tracked qualification delta
matched the recorded partial `3G` scope: successor adapter/CLI/catalog bytes,
five pack rebindings, six-pack registry/role/package metadata, and exact
cumulative assertions. The only four untracked qualification paths were the
proposed portal pack, its focused test and its two negative sentinels. No
unrelated or user-owned change overlapped the restore set.

Before restoration, SR1 retained the partial qualification state at:

`tmp/release-qualification/phase3/3g-sr1/sha256-816dd809d88844a2645cd9d5eafc2d603df17cf027ecf44b623e40482579c430/`

The set address is the canonical SHA-256 digest of the ordered artifact names
and hashes. Its three addressed artifacts are:

- `attempt-evidence.json`:
  `7a934af0e822028ac8d92f599c0f1352407fb990e6360966c74b248ca83cfe5d`;
- `partial-qualification.patch`:
  `a772fe6cb2056c965843268844cbeb0bb329e59c633f5b960992955b9609e6f2`;
- `untracked-portal-artifacts.tar`:
  `2c0a084c4fe354f28f1804b5d7764554c1b78777219ac0d3ddf32ec6c1f5f6e2`.

The patch preserves all 19 tracked qualification deltas; the deterministic tar
preserves the four untracked portal artifacts; and the attempt record preserves
the D1/R1/R2 terminal evidence, dependency-fingerprint summary, residue result,
authority boundary and RN02/RN04 status. Recomputed artifact hashes matched.
No raw environment value is retained.

SR1 restored these 19 tracked files exactly from the certified commit:

- `qualification/bin/rq-native-readonly.js`, `qualification/package.json`, and
  `qualification/package-lock.json`;
- the five active manifests under `qualification/packs/`;
- `qualification/qualification-role-manifest.json` and
  `qualification/registries/phase3-read-only.registry.json`;
- `qualification/src/native-readonly-bridge.js` and
  `qualification/src/pack-validator.js`; and
- the admin aggregate, AI, admin lint, privacy, retained inactive Intacct,
  native-readonly lifecycle and portal lint focused tests.

The unadmitted portal pack, focused test and two negative sentinel files were
removed from active code only after the content-addressed archive was complete.
`git diff --exit-code <certified-commit> -- qualification` is clean and there is
no untracked qualification path.

Independent non-dispatch bundle/input validation proves the restored identity:
native-readonly adapter `2.0.0`; role manifest `1.8.0`, digest
`230d372eee8eae259342bb60ef1ccf6c3279e4b3d1cdc5b22566b4baf4ad1d84`;
five-pack registry digest
`c9208defdfec9b59e750eaa9a4c8b8bfcc23f4846b8b07c0203574696c8ed6ec`;
and active pack versions AI `1.0.1`, privacy `1.0.2`, admin lint `1.0.2`, portal
lint `1.0.1`, and admin aggregate `1.0.2`. Every bundle is advisory, every pack
and the registry retain release influence/authority `none`, and all current
declared inputs validated. The complete qualification JavaScript syntax scan
passed. No native/advisory command or recertification ran.

The initial `git restore --worktree` operation made no change because the
managed checkout exposes `.git/index.lock` read-only. Read-only `git archive`
extraction then restored the same explicit audited file list without touching
the index or history. This was an explained tooling constraint, not identity or
scope drift.

**Completion decision:** Sprint `3G-SR1` is complete. `portal-aggregate` is not
an active Phase 3 advisory pack. The current authoritative release gate remains
unchanged and continues to own portal aggregate execution. RN02/RN04 remain open
no-loss obligations; no replacement coverage, promotion or retirement is
claimed. Phase 3 remains incomplete and Sprint `3H` has not begun.

**Exact next approval:** Bill reviews and accepts completed Sprint `3G-SR1`,
then explicitly authorizes Sprint `3H` only under the objective, exact files,
read-only Git/file inputs, protected-path boundary, effects, direct/advisory
commands, verification and stopping point recorded in the approved Phase 3
breakdown. Phase 4 and every release-authority change remain unauthorized.
