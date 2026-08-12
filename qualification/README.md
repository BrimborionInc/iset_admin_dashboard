# Release Qualification Kernel

This private package is the isolated implementation area for the future release
qualification harness. Sprints 2A through 2E contain only the six evidence schemas,
canonical JSON and hashing, identity primitives, strict validation, semantic
plan admission, deterministic synthetic MC2 selection, scoped lifecycle state,
append-only in-process event evidence, bounded synthetic process control,
pure-local kernel composition, independent evidence validation, a thin private
CLI, and focused tests.

Sprint 3A adds the first advisory, read-only native pack:
`ai-guidance-contract`. The unchanged
`../scripts/admin-ai-eval-fixtures-check.js` remains the sole semantic authority.
The qualification bridge validates exact source and fixture digests, runs it
through the bounded process controller, retains native exit/output facts, and
compares the native exit result with the exact direct package command without
parsing its human-readable output. The pack remains `advisory`; neither its
registry nor its comparison record has selection or release authority.

Sprint 3B adds only `privacy-route-static`. The unchanged
`../scripts/privacy-route-scope-smoke.js` remains semantic authority for its 71
declared static tripwires, and the unchanged focused
`../tests/privacyRouteScopeSmoke.test.js` remains authority for the four
recorded guard-removal mutations and route-registration boundary. The pack
binds the exact admin and portal source bytes, package lock, Jest entry/config,
package aliases and synthetic interruption fixture. It is source-tripwire
evidence only: it does not prove runtime authorization behavior, enter MC2
release selection, or grant release authority.

Sprint 3C historically certified `intacct-local-contract` as local
source-drift evidence only. Bill later determined that the sibling simulator is
not part of live PATH and approved removal of this pack from the active Phase 3
PATH set. The unchanged local audit, inactive pack manifest, synthetic fixtures,
simulator and retained Sprint 3C evidence remain available to their local-tool
owner, but the validator, bridge, CLI, registry, role bindings and Phase 3 exit
cohort do not admit or run them. `test:3c` now proves that retained-but-inactive
boundary without invoking the audit. None of this is Sage, deployed-service or
release certification, and the current authoritative gate is unchanged.

Sprint 3D adds only `admin-lint`. The unchanged admin `lint` package script,
resolved ESLint entry, `.eslintrc.cjs`, package lock, and installed
ESLint/config/plugin package bytes remain native authority. The pack binds a
deterministic aggregate over exactly `src/**/*.{js,jsx}` and does not extend
lint coverage to server, scripts, tests, or any file outside `src`. Both native
paths use `--quiet --no-cache`; the qualification-owned negative also uses
`--no-ignore` solely so ESLint evaluates that out-of-product-scope fixture.
Neither path permits `--fix`, creates a cache, or grants release authority.

Sprint 3E adds only `portal-lint`. The portal-owned `lint` package script,
package-level `eslintConfig`, resolved ESLint runtime, dependency lock, and
installed ESLint/config/plugin bytes remain native authority. The pack binds a
deterministic aggregate over exactly the portal `src/**/*.{js,jsx}` scope. The
qualification-owned negative explicitly loads the portal `package.json`
configuration with `--no-eslintrc`, so it cannot inherit admin configuration.
Portal server, auth, notifications, routes, tests, scripts, and files outside
`src` remain outside this advisory pack.

The current schema graph is `1.0.0-draft.2` for qualification plan and final
evidence, and `1.0.0-draft.1` for execution event, check result, failure, and
cleanup result. Selection origins are limited to `mandatory-core`,
`impacted-domain`, `dependency`, `explicit-suite`, `scheduled-full`, and
`release-operation`.

Run the Sprint 2A tests from the admin repository root:

```sh
npm --prefix qualification run test:2a
```

Run the Sprint 2B through 2E tests or the complete package suite with:

```sh
npm --prefix qualification run test:2b
npm --prefix qualification run test:2c
npm --prefix qualification run test:2d
npm --prefix qualification run test:2e
npm --prefix qualification run test:3a
npm --prefix qualification run test:3b
npm --prefix qualification run test:3c
npm --prefix qualification run test:3d
npm --prefix qualification run test:3e
npm --prefix qualification test
```

The Sprint 3A direct-command controls are:

```sh
npm run ai:eval:check
npm run ai:eval:check -- qualification/test/fixtures/packs/admin-ai-guidance-contract.invalid.json
```

The second command must exit `1` because its qualification-owned fixture
deliberately repeats an ID. Certification requires ten frozen-identity advisory
known-good attempts, five additional direct/advisory matches, that deliberate
failure in both paths, fail-closed disagreement evidence, and one bounded forced
interruption with whole-process-tree termination proof.

The Sprint 3B direct-command controls are:

```sh
npm run smoke:privacy-routes -- --json
npm run test:backend -- --runTestsByPath tests/privacyRouteScopeSmoke.test.js --no-cache
```

The first must return `ok: true` for all 71 declared static checks. The focused
Jest command must pass all three native tests, including every existing
guard-removal mutation. Sprint 3B certification requires ten frozen-identity
advisory passes, five additional direct/advisory matches, strict source/lock/
runner/registry/role bindings, disagreement and command-substitution rejection,
one forced interruption, no input-byte drift, and `releaseAuthority: none`.

The Sprint 3C direct known-good control is:

```sh
npm run audit:intacct-contract
```

The deliberate negative uses the same native script copied into the bridge's
attempt-owned mirror; no product or mock source is edited. Certification
requires ten frozen-identity advisory passes, five direct/advisory matches,
missing-marker failure with advisory-warning separation, strict manifest/path/
digest and non-Git mock binding, malformed/disagreement rejection, forced
termination, mirror zero-residue proof, and `releaseAuthority: none`.

The Sprint 3D direct controls are:

```sh
npm run lint -- --quiet --no-cache
node node_modules/eslint/bin/eslint.js --config .eslintrc.cjs --ext .js,.jsx --quiet --no-cache --no-ignore qualification/test/fixtures/packs/admin-lint.invalid.js
```

The first preserves the native package script and exact `src` scope. The
second must exit `1` for the qualification fixture's native `no-undef` error.
Certification requires ten frozen-identity advisory passes, five additional
direct/advisory matches, strict config/lock/binary/dependency/source-scope drift
rejection, cache/fix and scope-substitution rejection, malformed and
disagreement evidence, bounded forced termination, unchanged source/cache
state, identity separation, and `releaseAuthority: none`.

The Sprint 3E direct controls run from the portal repository root:

```sh
npm run lint -- --quiet --no-cache
node node_modules/eslint/bin/eslint.js --no-eslintrc --config package.json --ext .js,.jsx --quiet --no-cache --no-ignore ../admin-dashboard/qualification/test/fixtures/packs/portal-lint.invalid.js
```

The first preserves the portal-owned package script and current `src` scope.
The second must exit `1` for the qualification fixture's portal-configured
native `no-undef` error. Certification requires the same ten-run, five-pair,
negative, identity, interruption, disagreement, source/cache-preservation, and
no-release-authority proofs as the admin lint pack, plus rejection of admin
binary/config fallback, wrong portal cwd, wrong repository/lock, and
cross-repository identity conflation.

Sprint 2B selection consumes only explicit content-addressed synthetic policy,
registry, identity, target, capability, change, operation, suite, schedule, and
exclusion inputs. It rejects unknown scope, stale authority, missing or cyclic
dependencies, unavailable requirements, invalid exclusions, unsafe stateful
cleanup declarations, and any plan that differs from independently reconstructed
selection. It does not execute a selected check.

Sprint 2C binds the complete selected-check set before an attempt opens and
models prerequisite, check, timeout/cancellation, cleanup, residue,
finalization, validation, and advisory states without performing any operation.
Its event emitter accepts only lifecycle records, explicit timestamps, and
synthetic mutation markers; produces immutable schema-valid predecessor-chained
events; treats exact replay as idempotent; quarantines stale, conflicting, or
out-of-order evidence; and emits deterministic event and artifact graph hashes.
It has no clock, child-process, filesystem-write, adapter, environment, or
independent-final-validator capability.

Sprint 2D admits only an exact Node executable, content-digested script,
complete argument vector, canonical working directory, and explicit environment
allowlist. It captures bounded stdout and stderr separately, accepts only
versioned JSON-line protocol frames, enforces startup, execution, idle,
shutdown, termination, and total-attempt bounds, and coordinates idempotent
cancellation through graceful then forced Linux process-group termination.
Missing, corrupt, stale, conflicting, duplicate, or oversized output fails
closed. No implicit retry is available; redispatch requires a new command
instance and retry policy remains outside this slice.

The only executable fixtures admitted by Sprint 2D tests are the seven files in
`test/fixtures/commands/`. They have no PATH product, network, cloud, database,
browser, server, deployment, TEST, or PROD dependency.

Sprint 2E composes only the already admitted synthetic plan, selection,
lifecycle, evidence, and process-control services. It validates the complete
selected execution set and declared effects before dispatch, prevents failed
prerequisites or dependencies from dispatching a check, records process results
as content-addressed attachments, coordinates declared synthetic cleanup only
after proved termination, requires an independent residue decision, and emits a
schema-valid advisory final artifact. It does not classify product behavior or
grant release authority.

`src/evidence-validator.js` does not import the kernel or event emitter. It
strictly validates schema and digest bytes, reconstructs plan selection,
identity lineage, event ordering, selected results, failures, cleanup and
attachments, and returns a separate report whose `releaseAuthority` is always
`none`. Schema validity, qualification validity, producer advisory status, and
release admission remain distinct. `bin/rq-kernel.js` accepts strict JSON only
on stdin for `plan`, `run`, and `validate`; its serializable `run` boundary is
restricted to read-only synthetic executions, while stateful cleanup proof is
exercised through the direct in-process kernel contract.

This package must not import or execute PATH application code, release checks,
databases, AWS, browsers, HTTP services, builds, deployments, TEST, or PROD.
The approved architecture remains normative; this file cannot broaden scope.

## Sprint 3H Source State

Sprint `3H` adds a separate advisory source-state boundary without changing the
certified five-pack native registry or bridge. It inventories exact tracked and
explicitly admitted qualification-owned untracked bytes from admin, portal and
shared according to `registries/phase3-source-roles.registry.json`. Product,
harness and test-pack role material produce separate digests; dependency,
migration and generated roles contribute only to the product candidate. Global
repository HEAD and tree values remain provenance facts and cannot by
themselves conflate those identities.

The standalone controls are:

```sh
node qualification/bin/rq-source-state.js inventory --registry qualification/registries/phase3-source-roles.registry.json
node qualification/bin/rq-source-state.js verify --registry qualification/registries/phase3-source-roles.registry.json --baseline <content-addressed-baseline-ref>
node --test qualification/test/source-inventory-and-stability.test.js
```

Inventory rejects unmapped or unadmitted untracked paths, missing files,
symlinks, path escapes, stale registries, conflicting Git identities and partial
or interrupted collection. The protected production-feedback filename pattern
is excluded before byte access and from every identity/index/status digest. A
stability result is advisory evidence only, reports exact changed paths and
affected identities, and has `releaseAuthority: none`. It does not invoke the
current qualification gate, promote a pack, close RN02/RN04, or perform the
separately authorized Phase 3 exit cohort.

Sprints 3A through 3D are certification lanes, not MC2 release selection. The Phase 2
selector continues to admit only mandatory qualification packs; the Phase 3
registry explicitly says `advisory-certification-only`. No selector, kernel,
evidence schema, current release gate, or deploy-admission path changed.
