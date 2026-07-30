# Feedback 173 Repeat-Application CFA Hotfix Contract

Status: deployed to PROD on 2026-07-30; guarded Case `12` repair complete; staff review/send and participant re-sign verification remain open.
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

## 2026-07-30 Release And Repair Evidence

- Exact-source DEV qualification returned `GO` for all 16 checks under evidence `0d623b236dfa5bc4b0a7ff1aaadb14344b740f06f9c9098ebef08948dd34e325`.
- Deployed TEST acceptance returned `GO` for all 11 checks under evidence `4da552600b2793af476c25a402b0c7ab940d1280d2c9ba11b47e1797f13ed304`.
- PROD release `20260730-feedback-173-cfa-hotfix` deployed admin `4ac74022c1e7da08c771eb66a14c98ba6cdd3d7f`, portal `5afed494fd06808c2a3d009e92ba389cd3218fcc`, and shared `e8dc303d8ecc057e52509b00854106f230823d96`. No schema migration, workflow/config promotion, or general data sync ran.
- Staff received the full ten-minute close warning before all three live PATH hosts moved behind the ALB maintenance response. Snapshot `path-prod-feedback-173-case12-20260730t1510` reached `AVAILABLE` before the repair.
- ASG refresh `3793b3c8-c754-4f77-bda3-af3211e86641` completed successfully on replacement `i-09fe637ba5dd582e7`. Deployed provenance matched the qualified source, Node was `20.20.2`, and both PM2 processes were online with zero restarts.
- Guarded read-only preview command `8238a53b-1fe2-464f-acb2-3cba653384d1` matched the pinned live record set. Apply command `86444c5b-d712-47e2-ab16-39e872b5f78b` created application plan `149`, interventions `323`, `324`, and `325`, and corrected draft CFA version `34`.
- Independent read-only command `c6fd457b-af5f-4c38-80a9-28bcdbf9b9dd` confirmed application `95` is approved/active, plan `149` is application-linked and draft, its three interventions are approved/planned, CFA v2 is draft with active clean/redline documents `8674`/`8675`, and incorrect v1 remains withdrawn with its signature facts preserved and documents `8452`/`8527` archived.
- Feedback command `962142fd-22d6-44c1-94d3-8436b1e81a15` moved report `173` from `submitted` to `in_progress` and recorded that automation sent no applicant message.
- Final checks returned `200` for all three public `/readyz` URLs, both ALB targets were healthy, the ASG refresh was 100% successful, and process command `5dbef4f9-f8ab-475e-9511-32931b9f9c1f` reconfirmed local readiness and zero restarts. The first smoke during listener-rule propagation saw one transient maintenance `503`; direct recheck and both subsequent full smokes returned `200`.
- ALB rules are back on normal forwarding. Maintenance-clear SQL command `534c2e6c-d214-41ff-bb3c-c876d68f7d47` confirmed zero active service-announcement rows.
- PROD deployment manifest: `/home/bill/ISET/hotfix-173/admin-dashboard/tmp/path-deploy/prod/20260730-feedback-173-cfa-hotfix--2026-07-30T15-26-36-289Z.json`.
- Do not close report `173` yet. Authorized staff must review CFA v2, send it through the normal workflow, and verify the resulting participant signing and canonical signed-document linkage.
