# RM two-step review assurance — 2026-08-09

Purpose: preserve the evidence, findings, release boundary, and remaining verification for the 2026-08-09 review of the Regional Manager two-step review implementation.
Audience: engineering, operations, product, and future short Codex tasks.
Status: exact-source DEV qualification is `GO` and validates for the clean r21 implementation candidate recorded below. The mandatory TEST acceptance runners have since been hardened in the primary checkout and the combined dirty tree has a separate complete r23 DEV `GO` that independently validates. Deployed TEST qualification remains `NO-GO`: r21 does not contain the runner hardening, r23 is not a clean frozen deployment candidate, and no current-candidate TEST fixture, deployment, or PROD change was attempted.

## Conclusion

The original application-assessment correction path is implemented and has faithful local browser coverage, but this assurance review found that intervention proposals and revisions did not yet have equivalent ownership, final-record, transaction, repeat-application, EI, and funding-document controls. Those gaps were corrected in the current candidate rather than being accepted as unrelated backlog.

The local browser qualification now passes all 12 returned-intervention identity scenarios for both a new proposal and a revision. It proves the original Coordinator, a different Coordinator, a different Regional Manager, the Decision Maker, System Administrator support, and the same-person Regional Manager path. The same-person path must edit as the recorded submitter, resubmit into `rm_review`, and then use a separate RM sign-off action; no role shortcut is accepted. The run also proves exactly one correction autosave and that empty reference data does not cause polling loops.

The prevention implementation and the hardened acceptance stack are qualified locally and against the guarded DEV contract, but they must not be described as ready for TEST or PROD. The combined source must first be frozen in clean admin, portal, and shared worktrees under a new release id and produce fresh exact-source DEV `GO` evidence. Bill must then explicitly approve a TEST deployment/rehearsal, and that exact candidate must pass deployed TEST qualification with zero residue. The prior deployed TEST artifact proves release r19, not this candidate.

## Original report and live-record boundary

Read-only PROD evidence was collected without authenticating as the reporter and without changing code or data:

- feedback report `#179` remains `in_progress`, severity `medium`, submitted by Amanda Curtis (staff profile `54`);
- affected record: Case `76` (`CASE-2026-0000076`), Application `123`, review workflow `56`;
- authoritative workflow stage: `returned_to_rm`;
- recorded original submitter and Regional Manager: staff profile `54`;
- Decision Maker: staff profile `51`;
- retained Decision Maker note: `We need household income on the financial overview.`;
- the URL retained with the feedback points to intervention `7` / Action Plan `3`, which opens an approved intervention Pending Completion context, not the returned application assessment.

The correct live next action is therefore the Regional Manager's application-assessment item under **Home → Pending Review**: use **Forward changes to submitter**, edit/resubmit in the submitter capacity, then complete the distinct Regional Manager sign-off after the item returns to `rm_review`.

This evidence does **not** prove that Application 123 has been rechecked through Amanda's authenticated live session. Do not close #179 or tell Amanda that her exact case is fixed until that final recheck is complete.

The reviewed read-only SQL is retained in `sql/ops/prod-feedback-179-assurance-preview-20260809.sql`. Its table and column identifiers were proved from live PROD metadata before execution. It is an evidence artifact, not an apply script.

## Assurance findings incorporated into the candidate

| Contract area | Defect found | Candidate control |
| --- | --- | --- |
| Returned ownership | Intervention bodies were editable by status, so another case-authorized Coordinator/RM could edit and replace the recorded submitter on resubmit | Drafts bind to exact creator; returned packets bind to exact active-workflow submitter; the backend enforces the same rule before mutation and preserves lineage; only System Administrator support has an explicit override |
| Review stages | Generic resubmit could restart final or reviewer-owned workflows | Submission starts/restarts only from initial, withdrawn/recall, or `returned_to_submitter`; reviewer/final stages fail closed |
| Final decisions | Intervention facts/proposal compatibility could commit before role, note, workflow, or budget validation | Role, stage, immutable packet, EI, note, decision/status, and pot checks run before the first write; intervention, proposal, workflow, note, applied revision evidence, and additional materializations share one transaction |
| Multiple proposal items | Additional approved interventions were created through sequential browser requests | The primary approval transaction materializes the complete frozen proposal set; exact source/item keys make subsequent client calls idempotent |
| Final evidence | Final proposal/revision rows could be edited, closed into approval, or deleted; the revision UI deleted the decided revision draft | Final proposal facts are immutable; close requires exact final approval; ordinary delete is limited to creator-owned/withdrawn drafts; applied revision evidence is retained, marked `applied`, excluded from operational lists/actions, and preserved as labelled finance/audit history |
| Repeat applications | Intervention PDF, recall, queue, checklist, workspace plan, CFA, letter, and message paths could inherit the case-primary application | Proposal and Action Plan application lineage must agree, belong to the case, and agree with the workflow; missing/conflicted lineage fails closed; every affected artifact and link uses the exact application |
| PDF signatures/versions | Case-wide or application-wide fallback could mix a prior application's/intervention's signatures or baseline; denials had no final signed packet | Exact review-workflow signature stamps and exact intervention/application document streams are used; final approval and denial packets identify Submitter, Regional Manager, Decision Maker, outcome, dates, and retained notes; request-changes creates no final packet |
| EI evidence | Intervention queue and final-decision paths could reuse case-assessment EI or accept mismatched evidence/funding stream | Queue uses proposal EI (revision-only Action Plan fallback); final decisions validate canonical EI, Action Plan funding alignment, and any supplied document's exact case/application/plan/intervention link |
| CFA/funding forms | Zero-funded approvals could create/supersede CFA versions, and older-application forms could satisfy a newer checklist | Positive funded lines are required for CFA/EFT work; zero-funded approval remains letter-only; checklist and signed counts are exact-application and applied-revision evidence is excluded |
| Approval letters/messages | Legacy approved status or a different selected application could authorize an approval/funding package | An active final workflow is authoritative and is re-locked/rechecked inside the message transaction; intervention/application/plan and funded-line scope must agree |
| Recall | Decision Maker users could enter a technical recall path, while an RM submitter was excluded by the shared role transition | Recall is exact submitter/creator before RM sign-off, supports an RM submitter, denies the Decision Maker, and reserves the explicit override for System Administrator support |
| Browser stability | Empty reference lists refetched continuously and a stale memoized dirty flag repeated identical autosaves on every wizard step | Loaded-empty data is terminal until explicit refresh; dirty state is recomputed after the mutable save baseline advances |

## Verification evidence

Current local evidence:

- frozen-candidate aggregate: `123` suites / `806` tests passed (`83` frontend suites / `412` tests and `40` backend/tooling suites / `394` tests);
- strict live-MySQL guard, release-contract, migration-plan, and payment/privacy preflight suites passed; the finished statements require exact configured/live identity, exact MySQL version, full live object/column/index/constraint proof, proven relationships, quoted live-keyword-proven aliases, and per-statement admission;
- mocked Express route-boundary suite: `5/5` passed outside the filesystem sandbox, proving applied-revision evidence returns `409` before domain writes at edit/close/revise/delete boundaries;
- focused final-packet suites: `4` suites / `75` tests passed for exact application/proposal/revision approve, deny, and request-changes behavior;
- focused recall/edit/delete/stage suites: `5` suites / `58` tests passed;
- live-schema smoke guard: `30/30` passed;
- checklist/CFA/decision-letter focused backend suites: `52/52` passed;
- full returned-intervention Chromium matrix: `12/12` passed;
- focused same-RM proposal/revision Chromium journeys: `2/2` passed;
- syntax, JSON parsing, and `git diff --check` passed; lint completed with zero errors (existing/non-release warnings remain).

Final exact-source DEV qualification:

- frozen candidate: `/tmp/iset-r20-candidate` (the directory name predates the final r21 source freeze);
- release: `20260809-two-step-review-assurance-r21`;
- evidence: `/tmp/iset-r20-candidate/admin-dashboard/tmp/release-qualification/dev/20260809-two-step-review-assurance-r21.json`;
- decision: `GO`; subsequent validator result: `Qualification evidence: VALID`;
- evidence id: `cb1948174a8aeefdbbb92f6d9c30e812a630998c134a21059810351e9e2bdf88`;
- generated: `2026-08-09T18:03:04.888Z`; expires: `2026-08-12T18:03:04.888Z`;
- inventory SHA-256: `e0789173ec4cae08e78dd56b726b6c16d3f84823c1939a877e2efb77ae625869`;
- schema SHA-256: `cd8977cd5383809c21f46810d27cc7f407135660bc46774f793e82a0d568cd3e`;
- declared operations: none.

| Component | Git head | Tree fingerprint | Evidence cleanliness |
| --- | --- | --- | --- |
| admin | `ee5f144156f41ae8fda3b4940fd85ae5f4c8e08a` | `1a78783e4c200640349d636b748816e5c5f3d3aa640ca016d4d68bda30311f56` | `gitDirty=false`; fresh post-validation status clean |
| portal | `c8882cf277671fca665f85a2716541d68e0c83fe` | `62c5db560a2e8f2c2cd2c45133ed184e9727af9371cbe406b46828528c088727` | `gitDirty=false`; fresh post-validation status clean |
| shared | `942c43233c495767b2a66eae541b8f8e403ffa54` | `b6886b9749c870bc1259079e326e3acda1c77bd0dc269d06afe2aa9b858de879` | `gitDirty=false`; fresh post-validation status clean |

All 17 required checks closed as `passed`:

| Required check | Status |
| --- | --- |
| `inventory-contract` | `passed` |
| `admin-aggregate` | `passed` |
| `portal-aggregate` | `passed` |
| `admin-lint` | `passed` |
| `portal-lint` | `passed` |
| `privacy-route-static` | `passed` |
| `real-mysql-schema-preflight` | `passed` |
| `schema-plan-dev` | `passed` |
| `real-mysql-contract` | `passed` |
| `admin-build` | `passed` |
| `portal-build` | `passed` |
| `admin-browser-suite` | `passed` |
| `privacy-erm-db` | `passed` |
| `payment-db-rollback` | `passed` |
| `intacct-local-contract` | `passed` |
| `ai-guidance-contract` | `passed` |
| `candidate-source-stability` | `passed` |

### Acceptance-runner hardening qualification

After the r21 freeze, the mandatory TEST acceptance paths were hardened locally. This work is not present in the frozen r21 directory and has not been deployed. The combined primary-checkout tree received a separate full DEV qualification:

- release: `20260809-two-step-review-assurance-r23-local-hardening`;
- evidence: `tmp/release-qualification/dev/20260809-two-step-review-assurance-r23-local-hardening--2026-08-09T21-55-32-965Z.json`;
- decision: `GO`; subsequent validator result: `valid=true`, zero errors;
- evidence id: `90ad34ef0c1306c4f88f86d7f50f92221819b14e52fc46f9d2b065667a5b083c`;
- generated: `2026-08-09T22:05:45.011Z`; expires: `2026-08-12T22:05:45.011Z`;
- all 17 required checks passed, including both full repository aggregates, both lint/build pairs, guarded real-MySQL contracts, the complete 13-workflow browser aggregate, rollback fixtures, and candidate source stability;
- the formerly failing `rm-submit-draft-new-proposal` and `rm-submit-draft-revision` browser scenarios both passed;
- an additional focused case-assignment rerun and a separate complete 13-workflow browser aggregate passed before the evidence-producing run.

The r23 source fingerprint is exact but intentionally records dirty primary worktrees: admin head `37666939fe2909c1153b7a92a4e3f28f102d303a` / fingerprint `f9e17c6bf9d4133e906db37288cd641722bc368e3cfc031a45e51a3efcd3c160`; portal head `c8882cf277671fca665f85a2716541d68e0c83fe` / fingerprint `966eba5d30f1ace9af9fd701f8f97686fa56f5fc7785fbe402b3fe241a7b73c3`; shared head `0d06680b77e4e42ed71464775982f2012c11385e` / fingerprint `e57efc9703c89c7fb24d90fdf6795d4b6c7b0aeed0e0c07f9fed761628808e5`. Therefore r23 is proof that the local combined tree passes, not authorization to package the dirty checkout or admit r21 to TEST.

The hardened controls now proved locally are:

- exact local operator and remote runner AWS ARN/account checks before Cognito, S3 staging, or fixture effects;
- exact TEST database, host, port, principal, and MySQL-version requirements;
- metadata-only, one-object-at-a-time DDL/column/index/constraint discovery before ordinary SQL;
- canonical finished-statement admission for runtime metrics and migration-ledger reads;
- database preflight before applicant-scope Cognito fixture creation;
- no raw connection transaction methods in the applicant, R1, two-step, or CFA cleanup paths;
- transactional cleanup with guarded current-relationship re-resolution and residue assertions;
- no `--keep-fixture` escape in the applicant-scope acceptance path;
- regression tests proving ordering, identity, guard coverage, transaction controls, and absence of raw TEST SQL transport.

### Deployed r26 TEST result and next-candidate repairs

The clean combined candidate `20260809-two-step-review-assurance-r26` passed all 17 DEV gates under evidence `68a97f3bba7a90fe0d637d7b0cb3e093517ee7d4131df4d0595f7b03aa19e6fe`, deployed to TEST, and then correctly remained `NO-GO` under immutable TEST evidence `fb3037581c4f5a6c1220bce8d065334124a00bc24b5cac72e97a3792b74f4f9d`. Seven of twelve deployed checks passed. The five failed checks exposed independent acceptance-tool defects: the dual-role application fixture omitted its required EI document; the R1 result marker exceeded the bounded SSM output; the CFA launcher compared the environment-loaded portal credential to the EC2 instance role; and the two applicant-scope checks rejected the unquoted `msr` alias before an unbounded connection close obscured timely completion. These failures do not constitute TEST acceptance and do not authorize PROD.

The next candidate repairs the complete causal set without changing product behavior. It uploads exact EI evidence before the dual-role checklist; validates and quotes declared table/output aliases against the live engine keyword metadata; records fixture mutation only after finished-statement admission and immediately before driver dispatch; bounds failed MySQL close and destroys a hung connection while preserving the primary error; compacts the R1 remote marker while retaining identity, DDL hashes, statement digest, workflow results, and cleanup evidence; discovers the portal credential after loading the deployed portal environment; and packages plus inspects the exact CFA support script inside both TEST and PROD portal archives before upload. Six focused suites pass with `55/55` tests. A new release ID, clean source freeze, complete DEV qualification, fresh TEST deployment, and complete deployed acceptance are still required.

Candidate r28 subsequently passed all 17 exact-source DEV gates under evidence `9c8151bf3dcf78ac896f42be9ed2af13cd496014f6c77ea73a7954365373dca9`, deployed successfully to TEST, and remained `NO-GO` under evidence `29c88525a2acd1868cd2d8074208f784c9d9b35bb3b612cd4f0a3766666efa33`. The r26 transport, CFA identity, EI fixture, alias quoting, and bounded-close causes were resolved: intake and CFA passed, and both applicant paths closed their connections cleanly. Three failed gates reduced to two complete causes. The two-step browser path passed 59 checks before its own stale literal expected **Forward changes to Coordinator** although the correct deployed exact-submitter UI showed **Forward changes to submitter** and withheld final-decision escalation. Both applicant modes failed before fixture insertion because the strict enum validator rejected literal `NULL` for the live-DDL-proven nullable `message_item.folder_before_deleted` enum. Both applicant paths proved all six residue counters zero; the two-step path proved every database, Cognito, temporary-object, and fixture-object cleanup without error. The next candidate changes no product behavior: it uses the current submitter-neutral selector and permits enum `NULL` only when `SHOW FULL COLUMNS` proves the exact column nullable.

Prior deployed TEST evidence, retained only as the r19 baseline:

- `tmp/two-step-review-test-smoke/two-step-1786279861994-e5dfca20d8-journey.json`;
- ran 2026-08-09 against TEST account `124355655255`, database `iset_intake`, host `ip-172-16-0-199`, MySQL `8.0.42`;
- `126/126` assertions passed with zero fixture residue.

The expanded candidate live TEST journey, once its runners are admissible, additionally requires:

- proposal and revision wrong-actor PATCH/resubmit denials with byte-for-byte state preservation;
- original-submitters' correction/resubmit paths and the separate same-RM sign-off;
- approved/rejected terminal locks;
- immutable Decision Maker proposal and revision payloads;
- two submitted proposal items materialized atomically with exact application/plan/source keys;
- exact repeat-application checklist, EI, PDFs, queue links, notifications, and funding-document behavior;
- schema preflight before Cognito/S3/database fixture effects and zero database, object-version, and Cognito residue.

## Environment qualification boundary

The exact DEV identity was established through metadata only before any ordinary statement: configured `172.26.176.1` / `root` / `iset_intake` / `3306`; live database `iset_intake`, host `DESKTOP-PDFA51K`, port `3306`, principal `root@172.26.%`, MySQL `8.0.40`. The hardened candidate must reproduce that identity and prove every required live DDL object before any bounded rollback fixture is admitted. A metadata/DDL mismatch is a fail-closed result, not permission to run cleanup or ordinary SQL.

Every whole-qualifier `NO-GO` artifact was retained unchanged. Across that sequence, seven harness/tooling defects were repaired: the missing ignored portal MinIO dependency; stale application-browser `Coordinator` copy; the schema guard misparsing MySQL `FOR UPDATE`; unconditional intervention read-only logic that broke applicationless `manual_backload` editing; a stale static assertion expecting that unconditional read-only behavior; a recall fixture missing the exact application/action-plan/proposal/workflow/submitter lineage; and two RM-draft browser scenarios that still recorded the Coordinator as creator after draft ownership became exact-creator-bound. The database failure occurred after fixture dispatch, so the contract rolled back and ran all guarded cleanup assertions. A separate metadata-first residue audit then proved all ten synthetic fixture scopes were zero without mutation or cleanup. After the parser repair, the exact DEV contract passed all nine behavioral contracts with `62` guarded statements and zero cleanup residue.

The completed r20 rerun-3 artifact remained `NO-GO` with evidence id `592122f7e42d5ce7275d9b7e94627dc5f73a066dd76540435d5617dee3e0b643`: 16 checks passed and the sole blocker was the two stale RM-owned draft scenarios inside `admin-browser-suite`. The exact-creator fixture correction passed the focused compiled intervention workflow, was committed as admin head `ee5f144156f41ae8fda3b4940fd85ae5f4c8e08a`, and was qualified under the new r21 release id rather than reusing r20 for a changed tree. The final r21 artifact above remains the clean implementation baseline; the separate r23 artifact is the controlling local decision for the subsequently hardened combined tree.

No current-candidate TEST operation was attempted. The eight SQL-touching checks identified by the static audit have been repaired and locally regression-tested as summarized above. TEST nevertheless remains `NO-GO` because those repairs are only in an unfrozen dirty tree: first create a clean combined candidate and fresh DEV evidence, then obtain Bill's explicit approval before any TEST deployment, Cognito fixture, S3 staging, SSM runner, or database acceptance action. The four SQL-free provenance, rollback-artifact, target-health, and source-stability checks remain safe in their direct scopes, but they cannot substitute for deployed acceptance of the exact clean candidate.

One tooling incident is retained for transparency: before a `require.main` boundary existed, a local inspection accidentally required the legacy privacy smoke module. The surrounding process threw synchronously and produced no SQL output; the legacy path was read-only and contained no mutation or cleanup operation, so data could not have changed. Because asynchronous connection completion cannot be proved from the retained output, this is conservatively recorded as a possible unguarded DEV read. It did not address TEST or PROD. Both privacy/payment modules now have import-safe boundaries and fake-driver tests proving imports and preflight failures execute no ordinary statement.

## Remaining architectural follow-up

The release candidate closes the concrete role, scope, mutation, and artifact-authorization defects found here. Three broader reliability items remain explicit follow-up rather than hidden assurance claims:

- final PDF/event emission still includes best-effort post-commit work rather than a durable outbox/retry ledger;
- approval follow-up markers written after secure-message commit need a durable, idempotent reconciliation path;
- legacy untagged EI evidence remains compatible, so the server proves exact active document scope but does not require an old document metadata tag to match the newly selected EI label.

These items do not authorize a PROD change in this thread. Carry them into the separate PROD/reliability plan and do not describe them as already solved.
