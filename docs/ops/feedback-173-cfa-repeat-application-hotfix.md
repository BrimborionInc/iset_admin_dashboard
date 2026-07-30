# Feedback 173 Repeat-Application CFA Hotfix Contract

Status: release candidate for `20260730-feedback-173-cfa-hotfix`.
Feedback report: `173`.
Incident record: Case `12`, application `95`, assessment `492`, incorrect CFA version `33`.

## Purpose

Prevent an approved repeat application from inheriting an older application-less action plan, and keep the versioned Client Funding Agreement (CFA) lifecycle synchronized when the participant signs.

## Scope

In scope:

- approved application-assessment materialization of an application-linked draft action plan and its approved/planned interventions;
- CFA snapshots generated from that action plan or its selected application assessment;
- creation of the next CFA version for every newly materialized application plan;
- applicant signing completion for a versioned CFA;
- guarded repair of Case `12` / application `95`;
- feedback report `173`.

Out of scope:

- Regional Manager or Decision Maker review ownership and routing;
- approval-letter, Financial Overview, EFT, payment, Finance, ILMP, or notification-policy changes;
- broad historical CFA lifecycle backfill;
- sending the corrected CFA to Allison during automated release smoke.

## Business-State Contract

| State | Authority | Staff/participant behavior | Required artifacts |
| --- | --- | --- | --- |
| Assessment approved | `iset_application_assessment`, `iset_application` | The approval flow materializes at most one current draft plan for that application. A historical or application-less plan does not block it. | Application-linked plan and the assessment's intervention set. |
| CFA draft | `cfa_series`, `cfa_version` | Staff review the next version before sending. Snapshot application lineage comes from the selected plan/application, never another case-level plan. | Version snapshot plus clean PDF linked through `cfa_version_documents`. |
| CFA sent | `cfa_version`, `signing_request` | Only the request's case, application, participant, and CFA version are signable. Withdrawn versions fail closed. | Sent version and scoped signing request. |
| CFA signed | `signing_request`, `iset_document`, `cfa_version_documents`, `cfa_version` | The portal retains one canonical signed document, archives the superseded render, and finalizes the same version as signed. | Signed PDF linked to the matching version, participant ID, and signed timestamp. |

Application-backed plan uniqueness is application-scoped. The application-less case-wide guard remains only for legacy/manual workflows that do not supply an application.

## Roles And Editability

- The existing Decision Maker approval permission remains unchanged.
- Existing authorized case staff can review/send the corrected draft after the repair.
- The participant can sign only a live `sent` request whose case and application match the CFA snapshot and generated document.
- This release adds no new roles, queues, permissions, or notification recipients.

## Case 12 Repair

The guarded repair must:

1. verify the exact PROD environment and pinned case/application/assessment/history/CFA/signing identifiers;
2. preserve historical action plan `36` and interventions `65`, `119`, and `120`;
3. materialize one application-linked draft plan for application `95` with exactly the three approved assessment interventions;
4. generate a corrected draft CFA version from that new plan;
5. withdraw incorrect CFA version `33` while preserving its signed evidence and signature facts;
6. archive the incorrect signed/unsigned CFA documents without deleting them;
7. reopen application `95` to the approved/active follow-up state;
8. leave the corrected CFA as a staff-reviewed draft and send no real participant message automatically.

Rollback is allowed only while the corrected CFA remains draft and has never been sent. It archives/cancels the new repair records, removes only the repair-created unsubmitted/payload-free ESDC readiness seed, and restores the prior signed evidence; it does not delete participant, signing, document, plan, intervention, or CFA audit artifacts.

## Release Acceptance

- Focused admin regressions prove application-scoped plan guards, application-scoped CFA fallback, plan application lineage, and next-version creation.
- Focused portal regressions prove same-case/application signing, stale-withdrawn denial, canonical signed-document linking, superseded-render archival, and signed-version finalization.
- The normal exact-source DEV and deployed TEST qualification gates must be `GO`.
- PROD deployment must use the documented warning/fallback/bootstrap-recovery sequence.
- Post-deploy evidence must prove exact source markers, public/local readiness, the guarded Case `12` repair result, and no automated applicant send.
- Feedback `173` remains `in_progress` until staff review/send the corrected CFA and the resulting live signing/artifact chain is rechecked. It is not resolved merely by deployment.
