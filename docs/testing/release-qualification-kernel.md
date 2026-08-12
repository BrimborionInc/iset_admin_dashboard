# Release Qualification Kernel

## Authority

This is the non-authoritative operator and certification guide for the isolated
`qualification/` package. The approved
[target architecture](../planning/release-qualification-harness-target-architecture-2026-08-10.md)
is normative. This guide cannot broaden its file, effect, identity, evidence, or
release-admission boundaries.

The current release gate remains authoritative. No artifact produced or
validated by this package grants release admission or a `GO` decision.

## Sprint 3A Advisory Pack

Sprint `3A` certifies only `ai-guidance-contract` as an advisory read-only
native pack. Its semantic authority remains the unchanged
`scripts/admin-ai-eval-fixtures-check.js` command. The pack validator binds the
exact root package alias, native script, default fixture, deliberate invalid
fixture, and synthetic interruption fixture by SHA-256 before dispatch. Any
stale, undeclared, broadened, stateful, or conflicting input fails closed.

`rq-native-readonly` invokes the bound native script with an empty inherited
environment through the Sprint `2D` process controller. It captures bounded
stdout and stderr but does not interpret those strings as product semantics.
The native exit status is authoritative. The comparator independently checks
candidate, environment, pack, native-command, profile, exit, and termination
bindings while allowing the direct and advisory harness/attempt identities to
remain distinct. A disagreement is a mandatory advisory stop. Every record
states `releaseAuthority: none`.

The advisory pack deliberately does not enter the mandatory-only MC2 selector.
Its Phase 3 registry is limited to certification, so running it cannot select a
release check, produce `GO`, change deploy admission, or promote the pack.

Run the exact direct controls and focused/cumulative local verification with:

```sh
npm run ai:eval:check
npm run ai:eval:check -- qualification/test/fixtures/packs/admin-ai-guidance-contract.invalid.json
npm --prefix qualification run test:3a
npm --prefix qualification test
```

The invalid-fixture direct command must exit `1`. Sprint `3A` certification is
complete only when the focused suite proves ten advisory known-good attempts
with frozen product/harness/pack identities and distinct attempts; five
additional direct/advisory matches; direct/advisory invalid-fixture parity;
stale and broadened input rejection; comparator disagreement; and bounded
forced interruption with process-group absence proof.

## Sprint 3B Advisory Pack

Sprint `3B` certifies only `privacy-route-static` as an advisory read-only
source-tripwire pack. `scripts/privacy-route-scope-smoke.js` remains semantic
authority for all 71 static checks. `tests/privacyRouteScopeSmoke.test.js`
remains the native authority for route-registration isolation and four focused
guard-removal mutations. Passing either command is not runtime authorization
proof.

The shared bridge admits the exact pack/profile pair and validates both native
package aliases, admin package and lock, native runner/helper/test/config/Jest
entry, admin server and widget, portal server, registry, role manifest and
interruption fixture by SHA-256. The one authorized cross-repository path must
resolve to the exact portal `server.js`; every other unlisted or escaped input
fails closed. The comparator binds the exact direct package command before it
compares native exit status, identity and termination facts.

Run only the direct controls and local package verification:

```sh
npm run smoke:privacy-routes -- --json
npm run test:backend -- --runTestsByPath tests/privacyRouteScopeSmoke.test.js --no-cache
npm --prefix qualification run test:3b
npm --prefix qualification test
```

Certification requires ten frozen-identity advisory native-check passes, five
additional direct/advisory matches, successful native mutation proof, strict
drift/broadening/alias/command/disagreement negatives, distinct candidate,
harness, attempt, environment and pack identities, unchanged source bytes,
bounded forced termination, and no release authority. The pack remains
`advisory`; the current gate remains authoritative.

## Sprint 3C Retained Local Tool

Sprint `3C` historically certified `intacct-local-contract` as advisory local
source-contract evidence. Bill later established that the sibling simulator is
not part of live PATH and approved removal of the pack from the active Phase 3
PATH set and exit cohort. Its native audit, fidelity manifest, simulator,
inactive pack/fixture artifacts and retained evidence remain unchanged as
non-authoritative local-development material.

The current validator, bridge, CLI, registry and role manifest do not admit or
execute the Intacct pack. `npm --prefix qualification run test:3c` is now a
non-executing scope assertion: it proves the local artifacts remain present and
inactive while the active graph contains exactly five packs and 16 profiles.
It does not invoke the local audit. The current authoritative gate remains
unchanged, and neither the retained material nor this guide represents Sage,
deployed-service or release certification.

## Sprint 3D Advisory Pack

Sprint `3D` certifies only `admin-lint` as an advisory read-only pack. The
unchanged root `lint` package script and installed ESLint runtime retain native
semantic authority. The bridge invokes the resolved ESLint entry with the exact
native `src` JavaScript/JSX scope, `--quiet`, and `--no-cache`; `--fix`, cache
creation, shell expansion, and any broader source scope fail admission.

The pack separately binds root package and lock bytes, `.eslintrc.cjs`, the
resolved ESLint entry, 16 installed ESLint/config/plugin package trees, and the
631 current files matching `src/**/*.{js,jsx}`. Nested dependency-install
`node_modules` links are not followed; the root lock binds their resolution.
File entries use explicit locale-independent code-unit ordering before hashing.
Any file omission/addition or byte change alters the applicable aggregate
digest and fails the admitted pack until its identity and certification are
deliberately advanced.

Run the direct controls and focused package verification with:

```sh
npm run lint -- --quiet --no-cache
node node_modules/eslint/bin/eslint.js --config .eslintrc.cjs --ext .js,.jsx --quiet --no-cache --no-ignore qualification/test/fixtures/packs/admin-lint.invalid.js
npm --prefix qualification run test:3d
```

The known-good native command must exit `0`; its current Browserslist freshness
notice is retained as non-semantic diagnostic output. The qualification-owned
negative is outside native product scope and therefore uses `--no-ignore` only
for that file; it must exit `1` for `no-undef`. Certification also requires ten
frozen-identity advisory passes, five direct/advisory matches, stale and
broadened input/command rejection, disagreement evidence, five-identity
separation, bounded whole-tree interruption, unchanged source and cache state,
and no release authority.

The exact native limitation remains visible: server, scripts, tests, and files
outside `src` are not covered. Expanding lint scope is a separate product-policy
decision. `admin-lint` remains advisory, the current gate remains authoritative,
and Sprint `3D` does not authorize promotion or Sprint `3E`.

## Sprint 3E Advisory Pack

Sprint `3E` certifies only `portal-lint` as an advisory read-only pack. The
unchanged portal `lint` package script, package-level `eslintConfig`, installed
ESLint entry, lockfile, and resolved ESLint/config/plugin bytes retain native
semantic authority. The bridge runs from the portal repository root with the
exact native `src` JavaScript/JSX scope, `--quiet`, and `--no-cache`.

The pack separately binds portal package and lock bytes, the package-level
configuration and alias, the ESLint entry, 16 installed lint package trees,
and all 100 current files matching portal `src/**/*.{js,jsx}`. Those package
trees contain 2,175 owned files and exclude nested dependency-install
`node_modules` links; the lockfile binds their resolution. Deterministic
code-unit ordering makes any omission, addition, or byte drift fail admission.

Run the direct controls and focused verification from the appropriate roots:

```sh
# From ../ISET-intake
npm run lint -- --quiet --no-cache
node node_modules/eslint/bin/eslint.js --no-eslintrc --config package.json --ext .js,.jsx --quiet --no-cache --no-ignore ../admin-dashboard/qualification/test/fixtures/packs/portal-lint.invalid.js

# From admin-dashboard
npm --prefix qualification run test:3e
```

The known-good native command must exit `0`. The qualification-owned negative
uses `--no-eslintrc --config package.json` to load the portal-owned
configuration without inheriting admin configuration, and must exit `1` for
`no-undef`. Certification requires ten frozen-identity advisory passes, five
direct/advisory matches, portal package/config/lock/binary/dependency/source
drift rejection, wrong-cwd/repository and admin-fallback rejection, deliberate
failure parity, five-identity separation, bounded whole-tree interruption,
unchanged source/cache state, and no release authority.

The exact native limitation remains visible: portal server, auth,
notifications, routes, tests, scripts, and files outside `src` are not covered.
Expanding scope is a separate product-policy decision. `portal-lint` remains
advisory, the current gate remains authoritative, and Sprint `3E` does not
authorize promotion or Sprint `3F`.

## Sprint 2A Boundary

Sprint `2A` implements only:

- the qualification-plan and final-evidence `1.0.0-draft.2` schemas plus the
  execution-event, check-result, failure, and cleanup-result
  `1.0.0-draft.1` schemas;
- strict `RQ-C14N-1` JSON parsing, canonical bytes, and SHA-256 hashing;
- `productCandidateId`, `harnessVersion`, `attemptId`, `environmentIdentity`,
  and `testPackVersions` primitives;
- strict local schema, version, digest, and identity-binding validation; and
- synthetic package-owned test inputs.

It has no PATH application import, current-check execution, process-control,
lifecycle, selector, adapter, database, AWS, browser, HTTP, build, deployment,
TEST, or PROD capability.

## Local Verification

From the admin repository root:

```sh
npm --prefix qualification run test:2a
```

Sprint `2B` adds pure semantic plan admission and synthetic MC2 selection only.
Run its focused tests or the full package suite with:

```sh
npm --prefix qualification run test:2b
npm --prefix qualification test
```

The selector admits only content-addressed policy and registry inputs bound to
the current `harnessVersion`. It deterministically adds mandatory core,
impact-mapped packs, dependency closure, explicit suites, scheduled full scope,
and release-operation scope; validates maturity, target, capability, effects,
cleanup, exclusions, and pack identities; emits stable topological order and
canonical input/output digests; and fails closed on unknown or conflicting
scope. The semantic plan validator independently recomputes that selection and
requires exact identity, authority, target, requested scope, checks, packs,
dependencies, prerequisites, capabilities, effects, commands, time budgets,
cleanup, lineage, and ordering before accepting a dependency-ordered plan.

Neither Sprint `2B` module owns lifecycle transitions, process execution,
evidence assembly, independent final-evidence validation, release admission, or
any PATH mapping or product assertion.

Sprint `2C` adds only deterministic scoped lifecycle transitions and an
append-only in-process evidence emitter. Run its focused suite with:

```sh
npm --prefix qualification run test:2c
```

The lifecycle binds the complete selected-check set and keeps attempt,
prerequisite, check, cleanup, residue, and validation state separate. It fails
closed on invalid order, omitted or undeclared checks, failed prerequisites,
unproved termination, incomplete cleanup/residue, conflicting repeats, and
post-terminal transitions. Validation states are represented only as lifecycle
facts; no independent validator is implemented.

The emitter requires explicit canonical timestamps and exact attempt, producer,
plan, check, and pack bindings. It creates immutable schema-valid events with a
gap-free attempt sequence and exact predecessor chain. Exact replay is
idempotent; replay cannot append unseen evidence; conflicting, stale, or
out-of-order artifacts are quarantined from the accepted graph. Event and
artifact graph hashes are deterministic. All observations and cleanup markers
are synthetic in-process values: there is no command, clock, environment,
adapter, storage, or product hook.

Sprint `2D` adds bounded local process mechanics for the seven approved
synthetic commands only. Run its focused suite with:

```sh
npm --prefix qualification run test:2d
```

Admission requires the exact current Node executable, an allowlisted command
identifier and content digest, an exact argument vector, a real working
directory under the package root, and explicitly allowlisted environment
values. Shell execution, ambient environment inheritance, Node preload control
variables, argument expansion, command substitution, and implicit retry are
rejected before spawn.

The controller captures stdout and stderr independently with byte counts,
digests, truncation facts, and bounded storage. Stdout protocol evidence is
strict versioned JSON-lines; ready, heartbeat, progress, and result frames bind
to the attempt. Startup, execution, idle, graceful-shutdown,
forced-termination, and total-attempt budgets are separate. Cancellation is
first-request authoritative and idempotent for the same request, then signals
the complete Linux process group with `SIGTERM` and, if needed, `SIGKILL`.
Completion requires the root process and streams to close and the process group
to be absent. Failure to prove absence is terminal `termination-failed`
evidence.

The focused suite uses only `pass.js`, `fail.js`, `hang.js`,
`ignore-termination.js`, `spawn-descendant.js`, `write-marker.js`, and
`emit-result.js`. Marker effects are restricted to one attempt-bound file in a
test-owned temporary root and are removed during the test. Sprint `2D` does not
connect process facts to the lifecycle/evidence emitter, implement an
independent final validator or CLI, run a PATH command, or change release
admission; those boundaries remain outside this sprint.

The focused suite compiles exactly the six local schemas and exercises valid
artifacts plus deliberate required, forbidden, unknown, malformed, conflicting,
version, digest, duplicate-key, unsupported-value, canonical-order, drift, and
identity-separation cases. Test data is limited to
`qualification/test/fixtures/candidate/source.txt` and values constructed in the
approved test file.

The qualification-plan and final-evidence schemas accept only these selection
origins: `mandatory-core`, `impacted-domain`, `dependency`, `explicit-suite`,
`scheduled-full`, and `release-operation`. The obsolete `explicit-request`
value fails closed. The four retained `draft.1` schemas resolve their plan
references only to unchanged shared `$defs`; their accepted-instance sets did
not change when those references were retargeted from plan `draft.1` to
`draft.2`.

The Phase 2 cumulative ten-run, independent-validation, and full integration
gates are not part of Sprint `2D` and are not claimed by a passing command here.

## Failure Boundary

A schema compile error, rejected positive fixture, nondeterministic digest, or
identity conflation is a harness failure and blocks Sprint `2A` completion. Do
not weaken validation, reinterpret product behavior, or reach into PATH source
to make the package pass. An unsupported schema/version, missing identity,
stale digest, malformed artifact, or conflicting binding fails closed with a
structured local error.

An unadmitted executable, script digest, argument, working directory, or
environment key is a pre-dispatch harness rejection. A timeout, cancellation,
nonzero exit, missing/corrupt/stale/conflicting result, output limit, or failed
termination proof remains explicit process evidence; Sprint `2D` does not
reinterpret it as a product failure.

## Sprint 3H Source Inventory and Stability

Sprint `3H` implements the architecture's native-Git source boundary in
`qualification/src/source-inventory.js`, the deterministic before/after
decision in `qualification/src/source-stability.js`, and the standalone CLI in
`qualification/bin/rq-source-state.js`. The versioned role registry covers only
admin, portal and shared. It assigns each admitted path to exactly one of the
product-candidate, harness or test-pack identity domains and records dependency,
migration and generated subroles without including the removed Intacct tooling.

The collector reads Git HEAD/ref/index/status facts and exact admitted file
bytes. It never follows symlinks, accepts an arbitrary untracked path, or reads
the protected `prod-feedback-180-181` SQL files. Those protected filenames are
recognized and excluded before `lstat` or byte access, and are omitted from
index, status and identity hashes. Git HEAD/tree values are retained as
provenance, while canonical role/path/byte material determines the three source
identity digests.

`inventory` emits a strict content-addressed artifact. `verify` requires the
exact admitted baseline ID and registry digest, independently recollects the
current state, and emits detailed repository, file, dirty-role and affected-
identity evidence. Missing, stale, conflicting, interrupted or partial evidence
fails closed. No retry is implicit.

The focused synthetic corpus proves ten frozen known-good inventories, five
direct/advisory pairs, product/harness/pack identity separation, migration/
generated/dependency treatment, deliberate drift, protected-path exclusion,
dirty roles, missing/symlink/escape/unmapped/conflicting inputs, canonical JSON
reordering, stale baselines and forced interruption. The source-state pack is
advisory with no release authority. The certified five-pack native registry and
bridge remain unchanged; portal aggregate stays deferred and RN02/RN04 remain
open under the current authoritative gate.

## Sprint 4A Native Build Preservation

Sprint `4A` keeps `scripts/release-build-contract.js` as the direct native build
wrapper and extracts only its synchronous file-preservation boundary into
`scripts/lib/release-build-preservation.js`. The helper owns a closed declaration
of allowed repository roots, generated files and isolated output roots. It
snapshots exact bytes or absence before dispatch, removes only declared output
roots, restores every generated path after success or failure and returns exact
restoration evidence. Missing, duplicate, escaping, overlapping or undeclared
paths and restoration failures fail closed. It does not spawn a command or
import PATH product or qualification code.

The native command vectors, working directories, environment overlay and exit
behavior are unchanged. The preservation inventory is exactly:

- admin `src/generated/buildInfo.js`;
- admin `src/generated/publicReleaseNotes.js`;
- portal `src/generated/buildInfo.js`;
- portal `src/generated/publicBuildInfo.js`;
- admin `tmp/release-qualification/admin-build-contract`; and
- portal `tmp/release-qualification/portal-build-contract`.

`tests/releaseBuildContract.test.js` uses only attempt-owned OS-temporary admin
and portal roots and injected in-process actions. Its 11 focused cases prove the
exact native declarations, byte and absence restoration after success and child
failure, unrelated-sentinel preservation, both output-root cleanup paths,
declaration rejection, restoration-failure evidence, import boundaries and
independent removal of every synthetic root. Sprint `4A` runs no admin or portal
build and does not read an environment file. Direct build execution and source-
stability proof remain separately authorized Sprint `4B` work.

## Phase 4 Direct Build and Browser Checkpoints

Sprint `4B` completed two direct admin and two direct portal build-preservation
commands from one frozen source state. All four exited successfully, restored
the exact four generated-file byte sequences, removed both isolated output
roots and left no relevant process residue. Local `.env.test` values were used
only by their existing native build commands and no raw value was retained.

Sprint `4C` gives `InterventionModal` one product-owned browser boundary with
stable lifecycle, posting-context, field and action attributes. The existing
posting-context native runner now rejects missing or ambiguous boundaries and
actions and scopes edit, save, reopen and final read-only assertions to that
boundary. Its PATCH and saved/reopened product assertions remain native
authority. The focused source contract passed 16/16 assertions without a build,
server or browser.

Sprint `4D` is not certified. Its first synthetic control invocation passed
7/10 cases but exposed a sandbox loopback-bind denial, lost stdout on an exit-0
synthetic child and inconsistent process-group/per-descendant termination
evidence. No repair or rerun followed and the selected native browser command
did not run. The partial helper and parent must not be treated as authoritative
or used to infer build, browser, network, cleanup or release evidence.

A separately authorized bounded repair now requires terminal stdout/stderr
before result assembly and proves exact PID/start-time process-group members
inactive in addition to group absence. The elevated full synthetic gate passed
10/10. The first exact native selected-child run then exited `1` after its one
internal-posting-context PATCH because the modal boundary remained mounted for
60 seconds after save. Reopen and final-record assertions were not reached;
the child's current `finalRecordReadOnlyVerified` field is not evidence of that
step because it is derived only from the saved-payload count. Exact generated
bytes and source identity were restored, the suite root and loopback socket are
absent, and host-level Node/Chrome residue is zero. No second or third native
run occurred. Sprint `4D` and Phase 4 remain incomplete.

Sprint `4D-R2` proved the failure was in that close predicate, not the product
submit lifecycle: Cloudscape retains the closed modal DOM with `display: none`,
while the parent already sets its modal state to closed before refresh. The
runner now distinguishes a visibly rendered dialog from the one retained hidden
dialog, keeps missing/ambiguous boundaries fail-closed, and sets
`finalRecordReadOnlyVerified` only after the final reopened read-only assertion
completes. The focused lifecycle contract passed 16/16 and the elevated complete
synthetic gate passed 10/10.

Three fresh exact native commands then passed from one frozen source state. Each
selected only `intervention-posting-context`, recorded one internal-context PATCH,
completed the final read-only assertion, emitted no unexpected final PATCH or
browser warning, used loopback only, restored exact generated bytes, removed its
suite root, released its port and left no matching Node/Chrome process. Sprint
`4D` completes at `3/3`; narrowed Phase 4 is complete. Phase 5 remains separately
unauthorized.
