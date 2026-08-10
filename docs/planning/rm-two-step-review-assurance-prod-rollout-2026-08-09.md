# RM two-step review assurance — future PROD rollout plan

Purpose: carry the DEV-qualified 2026-08-09 assurance candidate into a separate, bounded future TEST/PROD release thread without relying on this large investigation thread.
Status: deployed to PROD on 2026-08-10 as `20260810-two-step-review-assurance-r34` through Bill's explicit app-only emergency authorization after the qualification harness repeatedly failed to produce usable admission despite product evidence. Exact deployed sources were admin `4a57c839b83c2c63ee504e9a0b3df10b16be904a`, portal `71826af205c101f99dea35571a0181fe9496b250`, and shared `f81519d74ab0553b19713cff33961386dd0887da`. The preserved r31 TEST decision remains `NO-GO` and was recorded, not falsified, as evidence `0034ec76c243a8b0805cdd6163a02512518668cbaa9a843823efc50e9dfaf4ed` under `EMERGENCY-AUTHORIZED`. The pre-qualification production procedure passed clean-source admission, both production builds, admin/portal aggregates, lint, privacy smoke, immutable packaging, ASG refresh, exact provenance, target health, and all three public readiness checks. No schema, data, runtime configuration, Case 76/Application 123, or feedback `#179` mutation ran. Manifest: `tmp/path-deploy/prod/20260810-two-step-review-assurance-r34--2026-08-10T04-37-12-310Z.json`.

## Intended release boundary

Clean implementation-baseline release id: `20260809-two-step-review-assurance-r21`.

Local combined-tree qualification id: `20260809-two-step-review-assurance-r23-local-hardening`. This is not the future deployment release id because its evidence records dirty primary worktrees.

Prior deployed TEST candidate: `20260809-two-step-review-assurance-r26`. Its DEV evidence is `GO` (`68a97f3bba7a90fe0d637d7b0cb3e093517ee7d4131df4d0595f7b03aa19e6fe`); its TEST evidence is immutable `NO-GO` (`fb3037581c4f5a6c1220bce8d065334124a00bc24b5cac72e97a3792b74f4f9d`). Do not reuse r26 for the repaired tree.

Most recent deployed TEST candidate: `20260809-two-step-review-assurance-r28`. Its DEV evidence is `GO` (`9c8151bf3dcf78ac896f42be9ed2af13cd496014f6c77ea73a7954365373dca9`); its TEST evidence is immutable `NO-GO` (`29c88525a2acd1868cd2d8074208f784c9d9b35bb3b612cd4f0a3766666efa33`). Do not reuse r28 for the repaired tree. The TEST admin console remains normally forwarded and healthy; portal-only idle protection was restored after the failed gate. PROD remains untouched.

Expected scope:

- admin application code and compiled frontend;
- coupled shared notification catalogue/dispatcher copy;
- portal artifact only because the deployed shared runtime imports the portal mailer and the TEST/PROD packaging path must remain coherent;
- no schema migration;
- no dataset or arbitrary SQL apply;
- no runtime-config/feature-flag promotion;
- no PROD Case 76/Application 123 mutation;
- no feedback `#179` status change until the authenticated live recheck is complete.

The r21 implementation baseline is frozen in clean isolated admin, portal, and shared source trees under `/tmp/iset-r20-candidate`; the directory name predates the final r21 freeze. Do not modify or rebuild it after `GO`. It must not be deployed for the future TEST rehearsal because it does not contain the acceptance-runner hardening. Do not package the dirty primary checkout either. Create a new clean combined candidate containing the reviewed implementation plus runner-hardening changes, without unrelated dirty help, AI, generated-build, or documentation work, and qualify it under a new release id.

Controlling DEV evidence:

- evidence path: `/tmp/iset-r20-candidate/admin-dashboard/tmp/release-qualification/dev/20260809-two-step-review-assurance-r21.json`;
- decision/validation: `GO` / `Qualification evidence: VALID`;
- evidence id: `cb1948174a8aeefdbbb92f6d9c30e812a630998c134a21059810351e9e2bdf88`;
- generated: `2026-08-09T18:03:04.888Z`; expires: `2026-08-12T18:03:04.888Z`;
- admin: `ee5f144156f41ae8fda3b4940fd85ae5f4c8e08a`, fingerprint `1a78783e4c200640349d636b748816e5c5f3d3aa640ca016d4d68bda30311f56`, clean;
- portal: `c8882cf277671fca665f85a2716541d68e0c83fe`, fingerprint `62c5db560a2e8f2c2cd2c45133ed184e9727af9371cbe406b46828528c088727`, clean;
- shared: `942c43233c495767b2a66eae541b8f8e403ffa54`, fingerprint `b6886b9749c870bc1259079e326e3acda1c77bd0dc269d06afe2aa9b858de879`, clean;
- schema SHA-256: `cd8977cd5383809c21f46810d27cc7f407135660bc46774f793e82a0d568cd3e`; no declared data/config operation.

DEV evidence expires after 72 hours. If the TEST-runner hardening is not completed before this validity window closes, or if any source/inventory/schema fingerprint changes, generate and validate fresh exact-source DEV evidence before requesting a TEST rehearsal.

Local runner-hardening evidence:

- evidence path: `tmp/release-qualification/dev/20260809-two-step-review-assurance-r23-local-hardening--2026-08-09T21-55-32-965Z.json`;
- decision/validation: `GO` / `valid=true`, zero errors;
- evidence id: `90ad34ef0c1306c4f88f86d7f50f92221819b14e52fc46f9d2b065667a5b083c`;
- generated: `2026-08-09T22:05:45.011Z`; expires: `2026-08-12T22:05:45.011Z`;
- all 17 required DEV checks passed, including the complete browser aggregate and candidate source stability;
- r23 records dirty admin, portal, and shared trees and is therefore local proof only, not TEST admission evidence.

## Required TEST evidence before PROD approval is requested

0. **Complete locally, not yet frozen or deployed:** the mandatory TEST SQL-touching runners now replace unguarded runtime metrics/remote migration probes, place applicant-scope preflight before Cognito effects, enforce strict live metadata and finished-statement guards in the two-step/R1/CFA paths, prove exact local/remote AWS and database identities, and use guarded transactional cleanup with current relationship re-resolution. The r23 full DEV qualification and independent validator passed. Preserve this work in a clean combined candidate and rerun full DEV qualification before requesting TEST.
1. **Complete for the frozen r21 candidate:** exact-source DEV release qualification is `GO` and validates; all 17 required checks passed, including both aggregates, lint, builds, privacy/security and guarded real-MySQL gates, the compiled browser suite, rollback fixtures, and source stability.
2. **Still required:** freeze the reviewed r21 implementation plus r23 runner hardening in clean admin, portal, and shared worktrees under a new release id; produce and validate fresh full DEV `GO` evidence for that exact source.
3. After Bill's explicit approval, the new clean candidate is deployed to TEST account `124355655255` using the all-surface Test and Training maintenance sequence.
4. Deployed-source provenance matches the DEV-qualified candidate.
5. The expanded live two-step smoke completes with current live-schema proof, all assertions passing, and zero Cognito/database/S3 object-version residue.
6. Targeted TEST evidence proves:
   - Case/Application repeat-scope isolation;
   - original versus different submitter identities for proposal and revision;
   - same-person RM correction, resubmit, separate sign-off, and Decision Maker handoff;
   - atomic two-item proposal materialization;
   - terminal-row locks and retained revision evidence;
   - zero-funded letter-only behavior and no CFA version/supersession write;
   - exact final-workflow authorization for letters and funding forms;
   - no reference polling loop or duplicate correction autosaves.
7. TEST maintenance warning is cleared, admin routing is normal and healthy, and the TEST public portal returns to its normal idle-protection fallback.

## Proposed PROD deployment checklist

This section is not execution authorization. In the new thread, obtain Bill's explicit PROD approval after presenting current TEST `GO` evidence and the exact clean refs.

1. Re-prove the PROD AWS identity with the explicit approved profile and account `468278742295`.
2. Run the PROD deploy plan from the clean candidate with `--skip-schema --skip-data` and the exact release id/TEST qualification evidence.
3. Confirm the plan includes admin + portal + shared artifacts only and has no schema, dataset, runtime-config, or SQL operation.
4. Set an all-surface in-app warning, wait through the stated warning window, then enable the all-surface ALB maintenance fallback before process replacement.
5. Deploy the immutable artifacts. Keep fallback active while the replacement is not locally healthy. If ASG health admission requires normal forwarding, verify local admin/portal readiness first, then clear fallback so ELB can evaluate it.
6. Run normal-routing admin, staff portal, and public portal readiness smoke; verify exact release/source markers and shared runtime markers.
7. Re-run targeted read-only two-step checks. Do not manipulate a staff member's live workflow merely to prove deployment.
8. Clear the in-app warning only after normal-routing smoke and provenance checks pass; verify no maintenance announcement remains.
9. Record manifest, artifact hashes, ASG/instance/SSM identifiers, health evidence, and rollback readiness in the deployment notes.

The exact TEST deploy orchestrator with `--skip-schema --skip-data` is SQL-free in its own scope, but that does not waive the unsafe mandatory postflight and acceptance checks. A partial deploy/health result is not release evidence.

## Rollback

Current known live prevention baseline:

- admin: `830875e475b1d278e726b8b7499e32acb0ad633b`;
- portal: `c8882cf` (expand and re-prove the exact deployed commit in the rollout thread);
- shared: `0d06680b77e4e42ed71464775982f2012c11385e`.

Before deployment, prove the exact currently installed refs and retain immutable rollback artifacts. If application health or the targeted workflow smoke fails, restore the previous admin/portal/shared artifacts under maintenance fallback, prove local and normal-routing health, and leave feedback #179 open with a factual internal note. Because this release has no schema/data operation, rollback must not run a database restore or copy environment data.

## Case 76 / Application 123 follow-up

The code rollout and Amanda's existing record are separate work items. After the release is healthy:

- ask Amanda to open the Application 123 item from **Pending Review** in her normal live PATH session;
- verify the exact sequence: `returned_to_rm` → **Forward changes to submitter** → edit/resubmit → `rm_review` → separate RM sign-off → `nwac_review`;
- preserve the Decision Maker's household-income note and all existing audit evidence;
- update feedback #179 only after that authenticated journey has been observed or Amanda confirms the expected controls and state;
- if it still fails, capture the exact screen/request/error before proposing any data repair.

No PROD data repair is currently planned. If a later investigation proves one is necessary, create separate live-DDL-proven preview/apply/recovery SQL under `sql/ops/`, obtain explicit authorization, and do not improvise it in the rollout thread.

## Reliability follow-up for a later task

Plan separately from the future clean combined release:

- a durable outbox/retry/reconciliation ledger for post-commit final PDFs and workflow/domain events;
- idempotent reconciliation for approval-letter/funding follow-up markers after secure-message commit;
- an explicit migration/compatibility decision for legacy EI verification documents without canonical EI metadata tags.
