# PROD Repair Notification Log

Purpose: track live PROD data repairs whose affected staff or business owners may need to be informed later.
Audience: operations, product, support, and future AI-assisted maintenance threads.
Last Updated: 2026-08-05

Use this log for repairs that may be externally invisible to staff but should be available for later owner communication. Keep entries concise, evidence-based, and linked to the exact scripts or reports where possible. Do not use this file as approval to mutate PROD; follow the PROD repair rules in `docs/ops/agent-operational-access.md`.

## 2026-08-05 - Feedback #178 approved assessment correction recovery

Status: PROD guarded recovery applied and independently verified; owner follow-up drafted but not sent. Report `#178` remains `in_progress` until the normal correction and renewed-decision workflow is complete.

Reason: Kayla Gladue's application assessment had reached final approval before a funding-amount correction was identified. The preferred management workflow is for the Regional Manager to return the assessment to its submitter so the return reason, correction, resubmission, Regional Manager review, and renewed Decision Maker decision remain in PATH's audit history. The final-decision state has no supported return transition, so the System Administrator exceptional recovery path was required.

Repair applied:

- Restored application `61` / review workflow `17` to `pending_approval / pending_decision` and `rm_review`, preserving all nine prior workflow events and adding a System Administrator recovery event and internal case note.
- Cleared the selected application's active decision/decision-letter context so the earlier approval is not presented as current.
- Archived draft action plan `166`; cancelled generated interventions `351-353`; withdrew unsigned, unsent CFA version `37`; archived its generated document `9195`; and removed the untouched `needs_review / pending` ESDC seed.
- Preflight and transactional guards proved there were no related intervention proposals, intervention-document links, payments, finance transactions, or CFA signing requests.
- Moved feedback `#178` from `triaging` to `in_progress` with status history and a recovery note. The report is intentionally still open.

Evidence:

- Preview, lock, apply, independent verification, unlock, and recovery artifacts are `sql/ops/prod-feedback-178-assessment-correction-*-20260805.*`.
- Application lock command `6e329a44-fb84-4976-bbc5-01c7e4b0efbc` acquired the exact record lock; unlock command `3f15a9d9-ac87-413e-a621-8e1ec62f707b` released it after verification.
- Aurora snapshot `path-prod-feedback-178-recovery-20260805-1606` reached `available` before apply.
- Apply SSM command `406dc222-15b2-4788-9836-1ead3733cb97` completed successfully.
- Independent verification SSM command `d70cb67b-98df-4fad-9d8c-272ed2434968` confirmed the expected application/workflow states, cleared decision markers, preserved workflow history, withdrawn generated artifacts, removed ESDC seed, case audit rows, and feedback history/note.

Notification note:

- Danielle Burdett, Derry Yellowfly, and Madison Coppola need the workflow handoff. Derry's next action is `Return to Coordinator`; Danielle then corrects and resubmits; Derry reviews/submits for final decision; Madison records the renewed decision. The earlier draft plan, interventions, and CFA must not be used; PATH will generate replacement drafts from the renewed approval.

## 2026-07-28 - Regional Snapshot action-plan provenance follow-up

Status: PROD guarded data repair applied and refreshed report verified.

Reason: the FY 2026-27 Regional Snapshot still showed 11 `indirect application lineage`
warnings across five historical action plans. Four plans had exactly one same-case application
retained by their proposal and/or ESDC submission records. Action plan `15` was excluded because
it mixes Kaitlyn Kitson's historical intervention with later renewal work and cannot safely be
linked wholesale to the renewal application.

Repair applied:

- Linked action plan `27` / case `90` to application `8`.
- Linked archived auto-assessment plan `29` / case `131` to application `52`.
- Linked archived auto-assessment plan `32` / case `127` to application `48`.
- Linked closed manual-backload plan `53` / case `94` to application `12`.
- Inserted four `data_repair` case events under repair id
  `prod-regional-snapshot-lineage-backfill-20260728`.
- Changed no intervention, proposal, funding, status, document, assessment, application, or case
  value. Action plan `15` remains null pending a proper historical/renewal split.

Evidence:

- Preview artifact:
  `sql/ops/prod-regional-snapshot-lineage-backfill-preview-20260728.sql`; clean preview SSM
  command `82e518bb-b81d-4efa-9735-00bf149cf40a` confirmed four targets, four matching
  same-case applications, no conflicts, and no existing repair events.
- Apply artifact:
  `sql/ops/prod-regional-snapshot-lineage-backfill-apply-20260728.sql`; SSM command
  `0cc2a736-6652-41a4-9822-f3751a4758fc` updated four plans and inserted four audit events.
- Independent verification command `67b232cf-9064-4aa0-8798-e53655c9932b` confirmed all four
  exact links, four audit events, zero cross-case links, and action plan `15` still null.
- Emergency rollback artifact:
  `sql/ops/prod-regional-snapshot-lineage-backfill-rollback-20260728.sql`.
- A fresh manual-adjusted export reduced data-quality rows from 13 to 4 while leaving all report
  counts and funding totals unchanged. The four remaining rows are two genuinely missing
  application links on BC interventions `11` and `37`, plus two indirect links on Kaitlyn's
  mixed-plan interventions `219` and `290`.

Notification note:

- No staff action is required. This repair restored internal provenance used by reporting and did
  not change business outcomes or funding.

## 2026-07-27 - Solana Henderson Case 41 fiscal-period repair

Status: PROD guarded data repair applied; database integrity and financial rollups verified.
Amanda has not yet re-opened the repaired case in the deployed UI during this thread.

Reason: Funding agreement `16535866` spans January 5 through June 19, 2026 and crosses
fiscal year-end. Repeated partial handling left the January and April periods under one active
plan, created a second draft plan with the wrong EI classification, left the April intervention
in progress under the January plan with no amount, and retained an orphaned returned-revision
workflow and generated assessment PDF after the revision itself was deleted.

Repair applied:

- Closed action plan `23` on March 31 with Amanda's confirmed result `Returned to school`;
  result and future education remain code `8` (college / CEGEP / non-university diploma).
- Preserved January-March intervention `32` as completed with actual `$900.00`, removed
  April-June revision cost/date contamination from its metadata, and preserved its posted
  historical finance transaction `12`.
- Activated April 1 renewal action plan `143`, corrected it from EI Active Claim to
  `EI Reach Back`, and retained agreement `16535866` and BC EI pot `2000000000086`.
- Moved April-June intervention `311` to plan `143`; completed it June 19 with outcome
  `Complete`, actual/planned historical amount `$3,077.21`, internal posting context, and the
  evidence-backed `$2,177.21` residence plus `$900.00` living-allowance cost lines.
- Created posted historical finance transaction `15` and independent ILMP submission `394`;
  both plan submissions are intentionally `needs_review / pending` so the next ESDC validation
  recomputes from the corrected plan boundaries.
- Archived orphaned review workflow `40` as withdrawn and archived generated document `7312`.
  The workflow events, Decision Maker change-request note, and document object remain preserved
  as audit history.
- Corrected Case `41` rollups to one closed plan, one active plan, zero open interventions, and
  two completed interventions. Case status remains active.

Evidence:

- Preview:
  `sql/ops/prod-solana-case41-fiscal-split-preview-20260727.sql`; initial READY command
  `8c9a1c0c-3672-4034-b813-798e3727f875`.
- Restore point:
  `path-prod-solana-case41-pre-repair-20260727182903`, available at
  `2026-07-27 18:31:48 UTC`.
- The first apply command `451df5d8-763b-43e6-beaf-e9347da21fb8` stopped on an audit-table
  collation comparison before any business update. Verification command
  `23a273d8-86a9-4206-8d68-7687a56a9194` confirmed zero audit rows and unchanged plans,
  interventions, workflow, document, finance, and ILMP state.
- While the restore point was being created, unrelated finance transaction `14` added
  `$7,150.00` under a different case/pot and correctly made preview command
  `a2a039f9-3a1e-4ef4-8de1-60573fe923f3` return BLOCKED. Reconciliation command
  `a028bfb1-1070-4b69-9b8e-bf587cf79f36` proved the independent transaction and exact root
  rollup; no Solana row had changed.
- Final READY preview command:
  `706fa436-7a42-4718-9501-5a8eb4b53b26`.
- Apply artifact:
  `sql/ops/prod-solana-case41-fiscal-split-apply-20260727.sql`; SSM command
  `7c552a3e-a33d-4cad-a74e-0d6c274b71e4` committed repair id
  `prod-solana-case41-fiscal-split-20260727`, created finance transaction `15`, created ILMP
  submission `394`, and returned `repair_postflight=PASS`.
- Independent verification command `c553df9e-6ad1-4c18-985e-cf58926385e5` confirmed exact
  plan/intervention/proposal relationships, cost-line total `$3,077.21`, Case 41 intervention
  actuals equal posted finance total `$3,977.21`, all three pot rollups equal their posted
  transaction subtrees, zero active deleted-revision documents, one active/one closed plan,
  15 complete before/after audit snapshots, case event `266`, and no leftover repair procedure.
- Emergency rollback artifact:
  `sql/ops/prod-solana-case41-fiscal-split-rollback-20260727.sql`.

Notification note:

- Do not tell Amanda only that the database was changed. Ask her to reopen Solana's case and
  confirm she sees the January-March plan closed, the April renewal active, and the April-June
  intervention completed at `$3,077.21`. The database repair is verified, but that deployed
  user journey was not authenticated and reproduced by Codex in this thread.

## 2026-07-27 - Historical auto-assessment application-provenance backfill

Status: PROD guarded data repair applied; reporting hardening remains pending DEV completion.

Reason: Regional Snapshot verification found that 14 historical application-derived action plans
had null `application_id` provenance. The plans and their 44 interventions existed normally in
case files, but application-scoped reporting silently excluded them.

Repair applied:

- Restored `iset_case_action_plan.application_id` on 14 auto-assessment plans using exact stored
  `proposedInterventionId` matches to one same-case application assessment.
- Restored three null intervention-proposal application links and two null ESDC participant
  submission application links belonging to those plans.
- Inserted 14 `data_repair` case events. No intervention, funding, status, document, application,
  assessment, or case facts changed.
- A follow-up restored two historical denied-reporting plan links from their unique same-case ESDC
  participant submissions and inserted two additional audit events.

Evidence:

- Preview artifact:
  `sql/ops/prod-auto-assessment-lineage-backfill-preview-20260727.sql`; SSM command
  `c0bc7559-fc16-4881-af52-adafd211cbf1`.
- Apply artifact:
  `sql/ops/prod-auto-assessment-lineage-backfill-apply-20260727.sql`; SSM command
  `e879b57f-562d-4ff5-ab74-d1aea514556e`; exact updates were 14 plans, three proposals, two ESDC
  submissions, and 14 audit events.
- Postflight commands `b8dee464-ce87-4f9f-a6f2-00d13bad0931` and
  `0005b3cd-0420-4d0e-8da5-86b4e90b9f3f` confirmed all 17 current auto-assessment plans are
  linked, covering 53 interventions, with zero dependent proposal/ESDC conflicts.
- Emergency rollback artifact:
  `sql/ops/prod-auto-assessment-lineage-backfill-rollback-20260727.sql`.
- Denied-reporting preview/apply/rollback artifacts:
  `sql/ops/prod-denied-reporting-lineage-backfill-preview-20260727.sql`,
  `sql/ops/prod-denied-reporting-lineage-backfill-apply-20260727.sql`, and
  `sql/ops/prod-denied-reporting-lineage-backfill-rollback-20260727.sql`. Preview SSM command
  `e339af10-886b-44d9-8fc9-1c94bc89632c`, apply command
  `2bddf5cb-2fa9-4da8-9f17-3f94146bbb79`, and verification command
  `8fb77d6c-861a-434f-bb58-5c314a574170` confirmed two exact updates and two audit events.

Notification note:

- This was a relational provenance repair with no change to approved business facts. Reporting
  reviewers may need to know that regenerated figures now include approved interventions that
  were already visible in the affected case files.

## 2026-07-27 - Feedback #166 Financial Overview recovery and v2 withdrawal

Status: PROD record repair applied; prevention fix remains pending release.

Reason: Application Assessment resubmission archived Case `172`'s signed Financial Overview v1 as a side effect of replacing legacy assessment-generated documents. The signed July 6 v1 was restored. Emilie later confirmed that the new v2 request sent to Susa was unnecessary because the signed v1 had been found, while the separate Rent Assist supporting documentation is still required.

Repair applied:

- Restored signed Financial Overview v1 document `5539` to active status.
- Withdrew Financial Overview version `18`, cancelled signing request `136`, archived unsigned v2 documents `7687` and `7688`, withdrew message `1924` from both mailboxes, redacted its send event, and cancelled automatic reminders `190` and `191`.
- Left application `103` in `docs_requested` state because the Rent Assist supporting-document request remains outstanding.
- Left feedback report `#166` `in_progress` pending prevention deployment and targeted live verification.

Evidence:

- Restore artifact: `sql/ops/prod-feedback-166-restore-signed-financial-overview-20260727.sql`; SQL-over-SSM command `e3f65102-4aa8-4d94-a430-0960ea7374f3`.
- Withdrawal artifact: `sql/ops/prod-feedback-166-withdraw-financial-overview-v2-20260727.sql`; SQL-over-SSM command `67905274-29bd-40de-9898-0d0a586fdae2`.
- Post-repair verification confirmed document `5539` active, version `18` withdrawn, request `136` cancelled, v2 documents archived, both message copies deleted, reminders cancelled, and application `103` still requesting documents.

Notification note:

- Emilie provided the business direction for this repair. Ardell will tell Susa that she does not need to re-sign the Financial Overview but must still provide the Rent Assist agreement/supporting documentation.

## 2026-07-10 - Feedback #35 systemic intake-completion prevention

Status: PROD portal prevention release complete; external owner communication explicitly parked.

Reason: Historical feedback `#35` proved one submitted application had a blank main consent signature. The original file-level response was completed and the report was closed, but the server still lacked a full published-workflow completion guard and used split core commits.

Release and evidence:

- Portal-only release `20260710-r1-intake-completion-prod` deployed from clean commit `1b4734b7f3001db6255fc7bff4a39c1cbb54f540`; no historical application/submission repair, schema, data/runtime/workflow promotion, admin/shared artifact, or synthetic PROD submission was included.
- Source SSM `5c64b682-60cc-4439-82aa-ef2ec9b67eb3` confirmed the production build, completion router, published-workflow validator call, single-transaction markers, syntax, local health, and online processes.
- Read-only postflight SQL `b43bda4e-2582-4055-bc70-5a8ef0911178` found zero orphan submissions, duplicate links, or active/non-terminal ownership conflicts. The sole raw mismatch is the documented terminal archived duplicate from the May account merge, with its old user suspended and explicit merge marker present.
- Feedback SQL artifacts `sql/ops/prod-feedback-35-r1-prerelease-20260710.sql` and `sql/ops/prod-feedback-35-r1-closeout-20260710.sql` ran through SSM commands `139f3a6c-18ed-491b-80f4-a10e8f60a96e` and `b6a216bc-2601-49d4-b635-de1c3185721a`. Report `#35` remains closed with its existing closed status history and current internal release evidence.

Notification note:

- No external owner message is required. The original applicant/file response was completed in April, the current release is systemic prevention with no new action for the reporter, and no live applicant flow was generated for PROD testing. Reopen communication only if a legitimate future submission exposes a regression.

## 2026-07-08 - BC historic backload finance-reporting date repair

Status: PROD targeted data repair applied; followed by global sweep; business-owner explanation may be needed for Shelley/reporting reviewers.

Reason: BC Regional Snapshot / Financial Reports showed 13 historic/manual-backloaded interventions in FY 2026/27 because the report fell back to PATH entry date (`created_at`) when `reviewed_at` was blank. Bill confirmed the reporting rule: Financial Reports are approval-date based, and for historic/manual backloaded interventions PATH should infer the historic approval date from `iset_case_intervention.start_date`.

Repair applied:

- Updated `reviewed_at` on 13 BC manual-backloaded funded interventions to the intervention `start_date` at midnight.
- Left `created_at` unchanged as the PATH entry/audit date.
- Inserted 13 `data_repair` case events with repair id `prod-bc-backload-intervention-reporting-date-repair-20260708`.

Evidence:

- SQL artifact: `sql/ops/prod-bc-backload-intervention-reporting-date-repair-20260708.sql`.
- Apply SSM command `0768b005-11a4-479e-bcc3-eaf5bbc4297d`: expected rows `13`, updated rows `13`, audit events inserted `13`.
- Post-repair FY 2026/27 BC verification: funded interventions `4`, funded clients `4`, CRF `$8,116.00`, EI `$15,936.38`, total `$24,052.38`.
- Remaining FY 2026/27 BC funded rows after repair: Cellicia Wallace intervention `220` `$1,046.10`, Kaitlyn Kitson intervention `219` `$4,885.00`, Katrina Woodgate intervention `21` `$10,005.28`, Sarah Froese intervention `11` `$8,116.00`.
- Global follow-up sweep SQL artifact: `sql/ops/prod-global-backload-intervention-reporting-date-repair-20260708.sql`.
- Global sweep SSM command `3ea4e437-696c-4e37-b2b5-d09a1dc6c48f`: updated all 31 remaining manual-backloaded interventions with `start_date` present and blank `reviewed_at`, and inserted 31 additional audit events. Region summary: AB `4` / `$18,879.70`, BC `2` / `$0.00`, NB `3` / `$8,900.00`, NS `2` / `$26,747.00`, PE `1` / `$13,949.00`, SK `17` / `$89,102.35`, Unknown `2` / `$0.00`.
- Global verification SSM command `9ac4a122-7112-4878-88ef-ca705655e326`: zero remaining manual-backload interventions with `start_date` and blank `reviewed_at`; BC FY 2026/27 remained at funded interventions `4`, funded clients `4`, total `$24,052.38`.

Notification note:

- Suggested explanation: PATH corrected the reporting dates on historical backloaded BC interventions so the FY 2026/27 approved-funding report no longer treats the April 2026 PATH data-entry date as the approval date. The entry/audit dates were preserved.

## 2026-07-07/08 - Feedback #157 EI status correction and product fix

Status: PROD targeted data repair applied; product fix deployed; feedback report resolved.

Reason: feedback report `#157` from Emilie Marion (`emarion@nwac.ca`) reported that an already-submitted Application Assessment had the wrong EI status and could not be corrected safely through the UI.

Affected records:

| Item | Value |
| --- | --- |
| Feedback report | `#157` |
| Case | `109` / `ISET-20260418-D6CEEE` |
| Application | `27` |
| Assessment row | `30` |
| Original EI status | `EI Active Claim` |
| Correct EI status | `EI Reach Back` |

Repair and release:

- Guarded PROD repair changed only the assessment EI eligibility value from `EI Active Claim` to `EI Reach Back` after confirming the case had zero action-plan/intervention dependencies.
- The repair bumped application row version to `32` and added case event `199` for audit.
- Release `20260708-admin-user-ei-notification-fix` then deployed the product fix that keeps the existing EI dropdown editable for Regional Manager, NWAC Administrator, and System Administrator users after submission while the application is not final/locked, and blocks the correction once dependent action-plan/intervention work exists.
- Feedback report `#157` moved to `resolved` after DEV Cognito/browser smoke, TEST deploy/source/smoke, PROD deploy/source/smoke, and deployed marker checks passed.

Evidence:

- Data correction SQL: `sql/ops/prod-feedback-157-ei-status-correction-20260707.sql`.
- Data correction SSM command `ac4549e1-f9c9-43d2-a552-27b2b61d025a`.
- DEV smoke: `npm run smoke:application-assessment:ei-correction:dev` passed with disposable DEV Cognito/DB fixture cleanup counts at zero.
- TEST deployed-source command `87e733cd-c2cc-44c6-9883-94326353c8a4` confirmed release id, suppressed Cognito create marker, EI dependency guard, and shared applicant-name resolver.
- PROD ASG refresh `c5c6503c-1fef-4301-a6cf-89710b6e52b5` completed on replacement instance `i-02150848df7b6aca7`; final smoke returned `200` for all three public health endpoints.
- PROD deployed-source command `71540db2-8328-4071-ab6f-13c8263ad243` confirmed release ids in admin/portal, `MessageAction: 'SUPPRESS'`, `ei_eligibility_dependency_blocked`, and shared `GENERIC_APPLICANT_NAME_VALUES`.
- Feedback closeout SQL: `sql/ops/prod-feedback-157-resolved-after-release-20260708.sql`; SQL-over-SSM command `a4372be3-1a30-474f-b083-474d098950c8`.

Notification note:

- Suggested reporter message: PATH corrected the EI status on the affected file and has now released the dashboard fix that allows authorized managers/admins to correct EI status after submission when doing so will not invalidate dependent casework. The report is resolved.

## 2026-07-06 - Application 11 assessment decision-context repair

Status: PROD targeted data repair applied; no owner notification sent yet.

Reason: application `11` / case `93` / `ISET-20260410-EC36E2` had stale scoped decision-letter context showing `assessment_nwac_review_status='approve'` even though the authoritative application and assessment records resolve to a denial. The application was already `completed` / `closed` / `denied`, the assessment was `no_recommend` with `nwac_review='agree'`, and the denial letter had already been sent.

Repair applied:

- Updated only `iset_case.case_context_json` for case `93`, path `$.applicationDecisionLetters."11".assessment_nwac_review_status`, from `approve` to `reject`.
- Left the application row, assessment row, document records, signing request context, and sent denial-letter evidence untouched.
- Guarded the update against the expected case/application/assessment state and against any active `application_assessment` workflow.

Evidence:

- Preview script: `sql/ops/prod-application-11-assessment-context-repair-preview-20260706.sql`.
- Apply script: `sql/ops/prod-application-11-assessment-context-repair-apply-20260706.sql`.
- Preview SSM command `d2ba4182-36c2-4bd5-80f4-0487049da940`: candidate row showed stale status `approve`, no blockers, and projected post-repair status `reject`.
- Apply SSM command `44075235-a61f-49ed-95f4-a7d3b23a4882`: updated one case context row and verified post-repair status `reject`.
- Target verification SSM command `e72e71a0-55ce-413e-9900-a55ea320d0c1`: application `11` remained completed/closed/denied and assessment `no_recommend` / `agree`; scoped status is now `reject`.
- Broader mismatch audit SSM command `beba8099-304a-4838-b7f4-3f34da74ea6f`: zero remaining decision/context mismatches.

Notification note:

- No staff-facing action is expected from this repair unless a report owner asks why application `11` showed an inconsistent historic decision-letter status. Suggested explanation: PATH corrected a stale internal decision-letter context value so it now matches the already-sent denial outcome; no application decision, sent document, or applicant-facing record was changed.

## 2026-07-05 - Feedback #154 wrong-recipient secure-message containment

Status: PROD containment applied; product fix deployed; reporter follow-up sent; privacy/business follow-up pending.

Reason: feedback report `#154` (`Deleted secure message`) described a Regional Manager sending a secure message to the wrong participant and deleting it immediately from her own view. Live triage confirmed the delete action only removed the sender mailbox copy; the recipient copy remained in the participant inbox and had been read. The current code can also expose master `messages.subject` / `messages.body` in staff case-thread views, so mailbox-only hiding was not sufficient.

Affected records and owners:

| Item | Value |
| --- | --- |
| Feedback report | `#154` |
| Message | `1128` |
| Case | `129` / `ISET-20260429-AF259F` |
| Sender | Emilie Marion (`emarion@nwac.ca`), Regional Manager |
| Wrong recipient | Molly Hink (`molly.hink@hotmail.com`) |
| Event | `7ec162a2-5624-4cc3-b942-248c5177e518` |

Repair applied:

- Replaced the live message subject/body with a neutral withdrawal notice and marked the master message `deleted=1`, `status='archived'`.
- Moved both sender and recipient `message_item` rows to `folder='deleted'` while preserving the rows and timestamps for audit evidence.
- Redacted the central `staff_secure_message_sent` event subject to `[withdrawn] Message withdrawn`.
- Added a PROD feedback note to report `#154`; the report remains `in_progress` pending privacy/business follow-up and a product fix for true recall/delete-for-everyone plus stronger recipient confirmation.
- Follow-up code now prepared in DEV: staff compose locks the case-derived recipient display and requires recipient/case confirmation, local Deleted Items wording no longer implies recall, and plain staff-to-applicant messages can be explicitly withdrawn with audit-preserving redaction. Messages with linked files or forms still fail closed pending a reviewed artifact-aware repair path.

Evidence:

- Preview script: `sql/ops/prod-feedback-154-secure-message-containment-preview-20260705.sql`.
- Apply script: `sql/ops/prod-feedback-154-secure-message-containment-apply-20260705.sql`.
- Preview SSM command `76528c5b-b886-4735-8c5a-5f829c1f2ad9`: message, mailbox, related-count, and event guards all returned `ready`; related attachment, signing-request, and internal-notification counts were all `0`.
- Apply SSM command `d290da6c-2078-4e92-96d3-9163f05e9b68`: all guards returned ready; live message `1128` now has subject `Message withdrawn` and neutral body text; sender and recipient mailbox rows are deleted; event subject is redacted; feedback note was inserted.

Notification note:

- Suggested reporter message: PATH removed the mistakenly sent secure message content from the live application, replaced it with a neutral withdrawal notice, and confirmed there were no attachments or signing requests linked to it. The system record has been preserved for audit purposes. Because the message had already reached the recipient's inbox and was marked read before containment, PATH cannot say it was unseen; this should be handled as a privacy/business follow-up separately from the technical containment.
- Bill sent Emilie Marion a concise follow-up on 2026-07-05 confirming the secure-message fixes are live in Production, the original message remains contained, PATH now has clearer send confirmation and a proper withdrawal option, and staff should confirm the next genuine applicant secure-message email subject shows the applicant name rather than portal email address.

## 2026-07-05 - Two-step review intervention packet repair

Status: PROD data repair and prevention deploy applied; owner notification sent.

Reason: workflow-first two-step review audit found two intervention proposal workflows with generated packet PDFs that were not linked through `iset_document_intervention`, plus one proposal compatibility row whose `submitted_at` had drifted to the final approval time.

Affected records and owners:

| Workflow | Case | Proposal | Intervention | Current stage | Primary owner to inform | Other owner/context |
| --- | --- | --- | --- | --- | --- | --- |
| `12` | `CASE-2026-0000044` | `332` | `219` | `nwac_review` | Amanda Curtis (`acurtis@nwac.ca`), Regional Manager, submitter/RM/case owner | No final Decision Maker yet |
| `13` | `CASE-2026-0000050` | `339` | `220` | `final_decision_recorded` | Amanda Curtis (`acurtis@nwac.ca`), Regional Manager, submitter/RM/case owner | Madison Coppola (`mcoppola@nwac.ca`), NWAC Administrator/Decision Maker |

Repair applied:

- Inserted five missing intervention-document links for active generated PDFs:
  `5087 -> 219`, `5089 -> 219`, `5112 -> 220`, `5113 -> 220`, `5142 -> 220`.
- Reset proposal `339` `submitted_at` from `2026-06-30 19:21:05` to the authoritative workflow submit time `2026-06-30 18:29:16`; `reviewed_at` remains `2026-06-30 19:21:05`.

Evidence:

- Preview scripts: `sql/ops/prod-two-step-review-document-link-repair-preview-20260705.sql` and `sql/ops/prod-two-step-review-proposal-timestamp-repair-preview-20260705.sql`.
- Apply scripts: `sql/ops/prod-two-step-review-document-link-repair-apply-20260705.sql` and `sql/ops/prod-two-step-review-proposal-timestamp-repair-apply-20260705.sql`.
- Document-link apply SSM command `459edc15-812d-4a90-9678-017aa8b69c8e`: guard found `5/5` ready rows and inserted `5` links at DB time `2026-07-05 11:12:29`.
- Timestamp apply SSM command `8e1ecbb5-94e7-4d50-9bd4-f84b61ff8eaa`: updated `1` proposal row and verified `submitted_delta_seconds = 0`.
- Post-repair systemic audit SSM command `c6ee10df-3f48-4c5e-b226-0707d4b65180`: no workflow/status, missing packet document, or proposal timestamp mismatch rows returned.
- Prevention release `20260705-two-step-review-prevention` deployed to PROD on 2026-07-05 as admin-only with no DB mutation. ASG refresh `56e2371d-7fce-4f78-8d7c-257272bfa177` replaced the admin host with `i-0307e0c730b98a7bc`; deployed-source SSM command `a1129867-9c9e-42cd-89ef-4635fdf12824` confirmed release id and both prevention markers.
- Post-deploy systemic audit SSM command `7405d66e-0bf6-4076-808d-114b562715e7`: returned only runtime flag and workflow stage-count sections, with no known mismatch rows.
- Feedback reconciliation SQL `sql/ops/prod-feedback-149-resolved-two-step-prevention-20260705.sql` ran through SSM command `84b08c90-55c2-499e-8691-a1692fb1e674` and moved report `#149` (`Pending Decision - Kitson/Wallace`) from `triaging` to `resolved` with an internal note tying Madison's report to the repaired Kitson/Wallace records and the deployed prevention release.

Prevention status:

- Prevention code is deployed to PROD release `20260705-two-step-review-prevention`. Generated intervention assessment PDFs now pass intervention ids into the document-store helper, and proposal compatibility syncing preserves original submitted timestamps across final-decision updates.

Notification note:

- Suggested owner message later: PATH found and repaired two intervention review packet records where the generated PDFs existed but were not attached to the intervention-specific document view; one related submitted timestamp was also corrected to the original submit-for-review time. Madison's report `#149` has been marked resolved because Kitson is correctly at Decision Maker review, Wallace is final-approved, and the prevention release is live. No staff action is expected unless they still see a missing packet/document or a current Decision Maker action blocked on the affected case.
- Bill sent Madison Coppola a concise owner update on 2026-07-05 confirming the Pending Decision issue was fixed, affected records were repaired, the prevention fix is live, and the post-deploy Production audit found no remaining two-step review mismatches.
