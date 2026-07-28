# Regional Snapshot Reporting

Purpose: schema note for the Board-style regional snapshot report planned under `Reporting`.

## Primary table

- `iset_regional_snapshot_report`

One row represents one saved regional snapshot for a single reporting window.

## Grain

- One row per `region_id + period_type + period_start + period_end`
- `period_type` is one of `month`, `quarter`, or `year`

## What is stored here

This table is intended to store the manual and report-specific inputs that are not yet available from PATH as live operational data.

Current saved fields:
- regional manager name
- regional coordinator name
- operating costs amount
- compliance flag
- comments / recommendations
- optional `manual_inputs_json` for future low-risk extensions

## Current live metric basis

- Region filtering uses participant home province / territory, matching Financial Reports rather than case portfolio assignment.
- Current deployed behavior assigns applications and approved funding to periods using the intervention/payment-schedule rules documented below. Application received date is only the fallback when no intervention date can be derived.
- Client Activity outcome rows partition the same reporting-period application population and therefore reconcile to Applications Received.
- Section C allocates positive approved funding occurrences by due date, deduplicates Funded Clients by participant and period, and derives the client average from the displayed CRF/EI totals.
- The manually entered, application-less historical population remains outside the automated calculation and is incorporated only by an explicit offline manual-adjustment overlay.

## Agreed Section B Client Activity requirements (2026-07-27)

Agreed business rule for the target report:

- `Applications Received` remains an application count; it is not limited to funded interventions or funded applications.
- In these reporting requirements, “payment” means an approved funding line and its payment-due schedule. It does not mean payment-package generation, reconciliation, or an actual disbursement.
- The client's controlling principle for assigning a funded application to reporting periods is the due-date schedule of approved funding lines rather than the actual posted payment date. Actual payment timing is considered less reliable because operational delays can move it.
- An application counts once in each reporting period containing a qualifying approved funding-line occurrence due in that period, even when multiple qualifying funding lines/interventions occur in the same period.
- An application may therefore count in more than one fiscal year. Example: funded Career Investigation activity this fiscal year and funded Diploma tuition activity next fiscal year makes the application count once in each fiscal year.
- A funded intervention without payment lines falls back to the funded intervention's start date.
- Resolve reporting dates independently for each intervention, then union and deduplicate the resulting reporting periods at application level.
- For each funded intervention, use the due dates of its approved one-time or recurring funding lines, falling back to the intervention start date when it has no approved funding lines.
- For each unfunded intervention, use its intervention start date. Funding added to a different intervention does not erase the reporting period contributed by the unfunded intervention.
- Multiple unfunded interventions starting in different reporting periods make the application count once in each of those periods.
- Use the application received date (`iset_application_submission.submitted_at`) only when the application has no interventions from which a reporting date can be derived.
- Intervention duration and end date do not create additional reporting-period membership. Example: an application approved last fiscal year for a 12-month degree that started last fiscal year and continues into this fiscal year, with its only tuition payment scheduled at the course start, counts last fiscal year only. It does not count again merely because the course remains active this fiscal year.
- Recurring funded payment schedules are different from intervention duration. A recurring payment line spanning fiscal years makes the application count once in each fiscal year containing a scheduled recurrence, even when the recurring schedule is stored within one intervention/payment line.
- The same recurrence rule applies to monthly, quarterly, and annual snapshots: an application counts once in every selected period containing at least one scheduled recurrence, regardless of how many recurrences fall within that period.
- NWAC intends to require future recurring funding approvals to stop at fiscal year-end and require the participant to reapply for the next fiscal year. Existing PATH data can still contain fiscal-year-spanning recurring payment lines, so the report must continue to handle that edge case rather than assuming the future policy has already normalized the data.
- These decisions currently define application-period counting. Treatment of the corresponding amounts in the report's Funding section remains to be discussed separately.
- When qualifying funded activity is later added, the application can move out of its received-date period and/or into one or more funded-activity periods. This reclassification is intentional.
- The Client Activity outcome rows must partition the same application-period population: `Approved Applications`, `Denied / Ineligible / Withdrawn / NC`, and `Pending / No Decision` are mutually exclusive, and their sum must equal `Applications Received` for every report period.
- An approved new-intervention proposal makes its linked application an `Approved Application`
  for Regional Snapshot reporting. It does not create a second synthetic application or add one
  count per proposal: the linked application remains deduplicated once per reporting period.
  This reporting classification applies even when the application's current operational workflow
  state is `docs_requested / awaiting_applicant`.
- Approved intervention revisions do not create another application count. Their current amended
  dates and funding schedule update the period membership and Section C facts of the existing
  linked application under the amendment rules below.
- Reporting-period membership is independent of application decision timing. Within every period to which an application belongs, classify it using its current/latest outcome; a later decision may move it between Client Activity outcome rows but does not itself move it between reporting periods.
- A withdrawn application belongs in `Denied / Ineligible / Withdrawn / NC` even when it was previously approved. Withdrawal changes the current outcome bucket in every reporting period containing the application; it does not erase the application from `Applications Received`.
- The explicit withdrawn/denied rule takes precedence over an earlier approved new-intervention
  proposal; approval inference must not move a currently withdrawn or denied application back
  into the approved bucket.
- Include dated intervention proposals even when they are later denied, withdrawn, cancelled, or never activated. Intervention outcome/delivery status does not determine application-period membership; the report is driven by the intervention dates and recorded funding schedule facts while preserving the reconciled application count.
- Use the current amended intervention and payment-schedule facts. An amendment that adds funding, changes scheduled payment/recurrence dates, or changes an intervention start date can add, remove, or move the application between reporting periods.
- This requirement applies to both the PATH Regional Snapshot dashboard and its Excel export.

This behavior was deployed to TEST and PROD in release
`20260727-regional-snapshot-financial-overview` on 2026-07-27.

Open requirements that must be resolved before implementation:

- none currently recorded for the `Applications Received` period-assignment rule.

`snapshot_status` (`draft` / `final`) is an existing internal field exposed in the PATH snapshot
editor, but it is not shown in the Excel export and currently does not freeze live calculated
metrics. No client requirement to introduce frozen report versions has been established in this
discussion; keep that separate from the application-counting rules unless the reporting workflow
later identifies a need for issued-version retention.

## Agreed Section C Funding requirements (2026-07-27)

Agreed starting definition:

- `Funded Clients` means unique clients with at least one qualifying approved funding-line occurrence due in the selected reporting period.
- Client clarification recorded 2026-07-27: an original `draft` intervention with positive
  scheduled funding counts as approved funding for Regional Snapshot purposes. In PATH this
  normally represents approved funding that has not yet been activated; activation does not
  control this report.
- Read-only PROD verification found exactly two current `draft` interventions with positive
  funding:
  - Intervention `36`, application `8` (approved/completed), is an original draft rather than a
    revision. It contains $8,783 in positive lines and starts 2026-09-01. Under the clarification,
    it should count for Alberta in FY 2026-27.
  - Intervention `290`, application `88` (no decision / `docs_requested`), is a draft revision of
    in-progress intervention `219`. Its $4,885 schedule was cloned from the source intervention.
    Counting every draft indiscriminately would count a pending amendment alongside the currently
    operative intervention and duplicate funding.
- Confirmed boundary: count positive funding on an original draft intervention, but do not count
  a draft revision identified by proposal `source_intervention_id` until the revision becomes
  operative. This prevents pending cloned amendments from being counted alongside their current
  source interventions without making activation a reporting requirement.
- Only positive approved funding qualifies. A zero-dollar or negative funding line contributes neither a funded client nor a CRF/EI amount; an invalid negative approved-funding value should be emitted as a data-quality issue.
- Section C is client-centric: deduplicate a client to one `Funded Clients` count per reporting period across all of their applications, interventions, and qualifying funding occurrences, while summing every qualifying occurrence into the CRF/EI amount rows.
- Intervention duration does not make a client funded in every period through which the intervention runs.
- Allocate each approved funding-line occurrence only to the reporting period containing its payment due date.
- Example: a 12-month Diploma spanning two fiscal years, with the full tuition payment scheduled at the intervention start in the first fiscal year, contributes one funded client and the full tuition amount to the first fiscal year only.
- Recurring approved funding is allocated by its due-date occurrences. If monthly Living Allowance funding continues into the second fiscal year, the client counts as funded in that second fiscal year and only the Living Allowance occurrences due in that fiscal year contribute to its funding amounts. The up-front tuition remains wholly in the first fiscal year.
- Apply the same scheduled-occurrence allocation at monthly, quarterly, and annual report granularity.
- The `CRF Funding ($)` and `EI Funding ($)` rows both use this approved-funding due-date occurrence allocation rule.
- `Client Average Amount Funded` is `(CRF Funding + EI Funding) / Funded Clients` for the selected reporting period. It must be derived from the displayed Section C figures so the section reconciles internally.
- When `Funded Clients` is zero, `Client Average Amount Funded` is undefined and should display as blank / `—`, not `$0.00`.
- Exceptional fallback: when an intervention has a positive approved/budgeted amount but no usable approved funding lines, allocate the full amount to the intervention start date and count the client in that period. Surface the missing funding lines as a data-quality condition rather than omitting the approved funding.
- General missing-schedule fallback: when a positive approved funding line has no usable due date, allocate it to the intervention start date and emit a data-quality issue. If neither a usable funding due date nor intervention start date exists, emit an unresolved data-quality issue rather than inventing a reporting period.
- Apply that fallback principle consistently to analogous incomplete scheduling records without reopening each variation as a separate business question: preserve defensible approved funding/counts using the nearest authoritative intervention date, make the assumption visible, and escalate only when the rule cannot determine a defensible period or amount.
- Use the current approved funding schedule. If a correction or amendment removes, cancels, changes the amount of, or reschedules an approved funding line, rerunning affected periods must update `Funded Clients`, CRF/EI amounts, and the client average accordingly. The fact that an earlier version was once approved does not preserve it in the live report.
- If an approved funding occurrence cannot be classified as CRF or EI after checking its funding line, budget pot, and intervention metadata, include the amount in CRF by default so Section C remains complete and internally reconciled, and emit a data-quality issue identifying the fallback.
- Regional Snapshot needs an explicit data-quality issue collection in the API/report payload. Show those issues in the PATH dashboard and include them on the exported all-regions Excel Summary sheet so assumptions such as missing funding lines or defaulted CRF classification are visible rather than silent.
- Dashboard presentation: show a compact warning/count with an expandable issue table rather than mixing warnings into the report totals.
- Excel presentation: add a separate `Data Quality Issues` table below the regional totals on the all-regions Summary sheet.
- Issue rows should be actionable without unnecessarily exposing participant names: include region, application/case reference, intervention reference, issue type, reporting effect/fallback applied, and a concise remediation message.

### Temporary manual-participant boundary

- The reconciled review population is 32 manually entered intervention rows covering 30 clients.
- Exclude that application-less manual population from the new automated Section B and Section C calculations for now.
- This is a deliberate temporary reporting boundary, not evidence that the records are irrelevant. The client has now supplied the FY 2026-27 payout information needed for the offline overlay.
- Incorporate that population only through the explicit offline manual-adjustment overlay documented below. The live dashboard does not currently apply this overlay.
- Do not infer application attribution or scheduled funding for these records from case proximity, dates, or unrelated applications on the same case.
- The client supplied information for all 30 named clients across 2026-07-27 and 2026-07-28.
  The reconciled source is preserved locally as
  `docs/data/temp/regional-snapshot-manual-source-complete-2026-07-28.json`.
- For this one-off manual adjustment only, the leading transaction date controls when a note also
  names a different service month. For example, `May 8: Apr. LA` is assigned to May 2026.
  This does not replace the automated report's general scheduled-due-date rule.
- A supplied positive FY 2026-27 payout makes the manual agreement count as one application, one
  approved application, and one funded client. Multiple payouts for the same manual agreement
  do not add multiple counts. An existing funded-client count is also deduplicated.
- A distinct current-fiscal application already in PATH remains in its current outcome bucket.
  Therefore Ashlee Barner, Erica Christian, and Mya Somerville each retain their separate
  withdrawn application while receiving one manual approved-application adjustment; Joanna
  Nevers retains her separate pending application while receiving one manual approved adjustment.
- Kaitlyn Kitson's current linked application and $4,885 May-June intervention are already in the
  automated report. Her May 4 payment for the April living allowance is the remaining $2,000
  from the historical agreement, so the overlay adds $2,000 EI but no further application,
  approval, or funded-client count.
- Joanna Nevers' $500 immunization approval falls within the Apr.-Jun. 2026 renewal and is
  distinct from the dated $100 internet payout, so her manual funding adjustment is $600 EI.
- The complete interpreted overlay is
  `docs/data/temp/regional-snapshot-manual-adjustments-complete-2026-07-28.json`. It applies
  funding adjustments for 19 clients, records 11 no-payout clients as zero adjustments, and has
  no outstanding clients. Funding is assigned to CRF or EI from the matching PATH intervention
  funding source.
- The complete overlay adds 18 applications, 18 approved applications, 18 funded clients,
  $19,744.27 CRF, and $51,502.63 EI. Kaitlyn Kitson is the one positive-funding adjustment that
  adds funding only because her application, approval, and funded-client count already exist in
  the automated report.
- The nine records completed on 2026-07-28 add five applications/approvals/funded clients:
  Chrystal Loucks ($2,000 CRF), Jaida Duclos ($5,381.15 CRF), Shalaine Mezzo ($6,400 EI),
  Allison Moores ($2,000 EI), and Candace Stone ($4,000 EI). Madison Lightning-Swampy,
  Madison Bouvier-Morin, Tanisha Gardypie, and Glennis Tony have no FY 2026-27 payouts and
  therefore add no manual counts.

This behavior was deployed to TEST and PROD in release
`20260727-regional-snapshot-financial-overview` on 2026-07-27.

Current PROD data reality verified 2026-07-27:

- The operative reporting source is the intervention's embedded `metadata_json.costLines` approved funding schedule and its due-date/recurrence rules.
- Payment-package generation, reconciliation, `payment_packet`, `payment_packet_line`, and actual paid dates are outside this reporting definition. PROD currently has no physical payment packets or payment-packet lines, which is expected because that workflow is not in widespread NWAC use.
- Of 52 interventions with a positive `approved_amount`, `budget_amount`, or `intervention_cost`, 51 have at least one embedded cost line. One `manual_backload` intervention has a positive amount but an empty cost-line array.
- The workflow/data model therefore does permit a positive approved/budgeted intervention without usable approved funding lines. Section C needs an explicit fallback rule for that case.

## Implementation and release status (2026-07-28)

- The deployed implementation replaces the separate submission-date Client Activity query and approval-date Financial Reports reuse with one shared Regional Snapshot calculation path.
- Application-backed interventions and standalone proposals contribute their scheduled approved-funding occurrence dates or intervention start dates to application-period membership. Application received date is used only when the application has no dated intervention/proposal.
- Application-less manual interventions are excluded from both automated sections. No case-proximity or single-application inference is used.
- Section C expands embedded approved cost-line recurrence schedules, allocates each positive occurrence to its due-date period, deduplicates clients, and derives the client average from displayed CRF + EI totals.
- The API payload now includes `dataQualityIssues` and a calculation note identifying the temporary manual-record exclusion. The dashboard shows an expandable warning table when issues exist. The all-regions Excel Summary always includes a Data Quality Issues table, including an explicit no-issues row when none apply.
- `scripts/generate-regional-snapshot-from-prod.js` executes the pending calculation code against a read-only, narrowly scoped PROD extraction and generates the same workbook shape without deploying code or changing PROD data.
- The generator accepts `--manual-adjustments PATH` for an explicit local overlay. The partial
  overlay adds 13 applications, 13 approved applications, 13 funded clients, $12,363.12 CRF,
  and $39,102.63 EI. It preserves every automated outcome count and exposes the two Alberta and
  seven Saskatchewan outstanding clients as workbook data-quality disclosures.
- Generated pre-deployment workbook:
  `docs/data/temp/regional-snapshot-all-regions-fy-2026-27-new-rules-2026-07-27.xlsx`
- One-off contribution-audit workbook:
  `docs/data/temp/regional-snapshot-approved-applications-funded-clients-fy-2026-27.xlsx`.
  It has one tab per province/territory with separate, reconciling Approved Applications and
  unique Funded Clients tables. The supporting detail is opt-in for the offline generator and is
  not exposed by the normal Regional Snapshot API response.
- `scripts/generate-regional-snapshot-audit-from-prod.js` accepts `--snapshot`,
  `--manual-adjustments`, and `--output` so a helper workbook can be generated against the same
  manual-adjusted report. It adds explicit manual application/client rows, merges funding-only
  adjustments such as Kaitlyn Kitson's into the existing automated row, and fails if the helper
  does not reconcile to the supplied report workbook province by province.
- The generated workbook excludes the incomplete manual population. After the guarded 2026-07-27
  PROD action-plan provenance backfills, archived-record correction, confirmed original-draft
  rule, and approved-new-proposal classification described below, the current read-only PROD
  extraction gives automated FY 2026-27 totals of 189 applications received (19 approved,
  84 denied/ineligible/withdrawn/NC, 86 pending), 19 funded clients, $132,051.50 CRF, and
  $74,423.39 EI. British Columbia now reconciles at 21 applications: 2 approved, 13
  denied/ineligible/withdrawn/NC, and 6 pending; Kaitlyn Kitson's linked application is one of
  the two approved applications and one of the two funded clients.
- The historical partial-adjustment workbook is
  `docs/data/temp/regional-snapshot-all-regions-fy-2026-27-partial-manual-adjustments-2026-07-27.xlsx`.
  Its current totals are 202 applications received (32 approved,
  84 denied/ineligible/withdrawn/NC, 86 pending), 32 funded clients, $144,414.62 CRF, and
  $113,526.02 EI. The nine outstanding clients remain excluded.
- The complete-adjustment workbook generated from a fresh read-only PROD extraction on
  2026-07-28 is
  `docs/data/temp/regional-snapshot-all-regions-fy-2026-27-complete-manual-adjustments-2026-07-28.xlsx`.
  It reports 211 applications received (37 approved, 84 denied/ineligible/withdrawn/NC,
  90 pending), 37 funded clients, $151,795.77 CRF, and $125,926.02 EI. The increase of four
  pending applications relative to the previous day's workbook comes from new live PATH data,
  not from the manual overlay.
- A broader read-only PROD integrity sweep is implemented in
  `scripts/audit-regional-snapshot-prod-data.js`; its sensitive local result is
  `docs/data/temp/regional-snapshot-integrity-audit-2026-07-27.json`. The current sweep covered
  190 applications and 275 interventions. The remaining report-relevant source conditions are:
  two unclassified manual-era interventions without authoritative application lineage; three
  active interventions whose header amount differs from approved cost lines by cents; three
  active approved funding schedules attached to withdrawn applications; and one positive
  approved intervention without funding lines, to which the agreed start-date fallback applies.
  The report includes the current positive approved schedules on withdrawn applications under
  the Section C golden rule and flags the application/funding contradiction for correction.
- The sweep also found historical plans whose action-plan link is absent but whose proposal,
  plan-level proposal, and/or ESDC application provenance agree. The DEV calculation may use
  those agreeing sources and emits an `indirect_application_lineage` issue; conflicting sources
  fail closed and emit `conflicting_application_lineage`. It never infers from a case's nearest,
  primary, or only application.
- Archived action plans/interventions are never funding-eligible, even if their retained
  compatibility proposal still says `approved`. Their recorded intervention/proposal dates
  remain available for Section B period membership as required. This correction removed one
  archived Ontario intervention from FY 2026-27 Section C, reducing Ontario by one funded client
  and $8,015.74 CRF.
- Original draft interventions with positive scheduled funding are funding-eligible because
  activation does not control Regional Snapshot. Draft revisions remain excluded until operative
  so a cloned amendment is not counted alongside its source intervention. This adds Leah Plaited
  Hair's $8,783 CRF and one funded client to Alberta for FY 2026-27; Alberta now has seven approved
  applications and seven funded clients.
- Verified BC inconsistency, application `88` / intervention `219`: the intervention proposal
  completed Regional Manager and final-decision review and was approved on 2026-07-06 at
  13:31 UTC. A document request about 40 minutes later set the application workflow state to
  `docs_requested / awaiting_applicant`; the application has no durable `decision_outcome`.
  PATH's intervention-approval path neither requires nor updates an approved application outcome,
  so the source model can contain an approved/in-progress funded intervention attached to an
  application whose operational state looks pending. The deployed Regional Snapshot classifier
  resolves this reporting gap by treating an authoritative approved new-intervention proposal as
  approval of its linked application, while preserving explicit withdrawn or denied outcomes.
  Kaitlyn Kitson's application and $4,885 approved schedule therefore reconcile in the approved
  application and funded-client rows.
- Focused calculation/export tests, the complete admin aggregate test command, lint, syntax checks, workbook ZIP integrity, and a normal optimized frontend build passed. The build retains the repository's pre-existing hook-warning baseline; strict `CI=true` compilation continues to reject those unrelated existing warnings.
- Release `20260727-regional-snapshot-financial-overview` deployed exact admin commit `a0455e1`
  to TEST and PROD on 2026-07-27. The offline manual-adjustment artifacts do not modify live PATH
  data and are not applied by the live dashboard.

## Historical action-plan provenance repair (PROD, 2026-07-27)

- Regional Snapshot verification exposed 14 historical `auto_assessment` action plans whose
  `application_id` provenance was null. They covered 44 interventions and had been created before
  the prospective provenance fix released in July 2026.
- Every plan had exactly one deterministic application match: every intervention's stored
  `metadata_json.proposedInterventionId` matched an ID in one application assessment's
  `proposed_interventions` on the same case. No case-primary or single-application inference was
  used.
- Guarded PROD repair
  `sql/ops/prod-auto-assessment-lineage-backfill-apply-20260727.sql` restored the 14 action-plan
  links, three null intervention-proposal application links, and two null ESDC participant
  submission application links. It inserted 14 `data_repair` case events. It did not change any
  intervention, funding, status, document, application, assessment, or case value.
- The read-only preview was SSM command `c0bc7559-fc16-4881-af52-adafd211cbf1`; guarded apply was
  `e879b57f-562d-4ff5-ab74-d1aea514556e`; post-repair verification commands
  `b8dee464-ce87-4f9f-a6f2-00d13bad0931` and `0005b3cd-0420-4d0e-8da5-86b4e90b9f3f` confirmed all
  17 current auto-assessment plans now retain application provenance, covering 53 interventions,
  with zero proposal or ESDC lineage conflicts.
- The exact emergency restore artifact is
  `sql/ops/prod-auto-assessment-lineage-backfill-rollback-20260727.sql`. It is guarded for the
  immediate post-repair state and must not be used after new dependent activity without a fresh
  review.
- A follow-up audit found two historical `denied_reporting` plans, `55` and `57`, with the same
  missing provenance. Each plan's unique same-case ESDC participant submission retained the exact
  application link (`43` and `69`). Preview command `e339af10-886b-44d9-8fc9-1c94bc89632c` and
  guarded apply command `2bddf5cb-2fa9-4da8-9f17-3f94146bbb79` restored those two plan links and
  inserted two audit events; verification command `8fb77d6c-861a-434f-bb58-5c314a574170`
  confirmed no remaining unlinked `auto_assessment`, `denied_reporting`, or
  `withdrawn_reporting` plans.
- The DEV reporting path no longer treats every missing application link as a manual record.
  Explicit `manual_backload` / existing-entry records remain excluded as agreed. Any other
  unlinked intervention is excluded with a visible `missing_application_lineage` data-quality
  issue and remediation guidance, preventing another silent understatement.
- Alberta now reports 7 approved applications, 6 funded clients, $1,500.00 CRF, and $47,949.94 EI.
  Samantha Rodrigue contributes the $1,500.00 CRF living allowance and Sarah Calliou contributes
  $4,000.00 EI; both were previously omitted because their historical action plans lacked
  application provenance.

### Follow-up provenance repair (PROD, 2026-07-28)

- A fresh report exposed 11 `indirect_application_lineage` rows across five remaining historical
  action plans. Four plans had one exact same-case application retained by proposal and/or ESDC
  submission records.
- Guarded repair `sql/ops/prod-regional-snapshot-lineage-backfill-apply-20260728.sql` linked
  plans `27 -> application 8`, `29 -> 52`, `32 -> 48`, and `53 -> 12`, and inserted four
  `data_repair` case events. No intervention, funding, outcome, status, proposal, assessment,
  application, or case value changed.
- Clean preview SSM command `82e518bb-b81d-4efa-9735-00bf149cf40a`, apply command
  `0cc2a736-6652-41a4-9822-f3751a4758fc`, and independent verification command
  `67b232cf-9064-4aa0-8798-e53655c9932b` proved the exact links, four audit events, and zero
  cross-case relationships.
- Action plan `15` remains deliberately unlinked. It contains Kaitlyn Kitson's historical
  2025 intervention and later FY 2026-27 renewal work; assigning the whole plan to application
  `88` would incorrectly attach the historical intervention to the renewal. It requires a
  separate split/re-home repair.
- The refreshed manual-adjusted workbook has four data-quality rows instead of 13, with all
  application counts, funded-client counts, and CRF/EI totals unchanged. The remaining rows are
  two genuinely missing BC application links (interventions `11` and `37`) and the two indirect
  links on Kaitlyn's mixed-plan interventions `219` and `290`.

## What is not stored here

This table should not become a duplicate store for operational PATH data that can be calculated live, such as:
- applications received
- funded
- denied / ineligible / withdrawn
- pending decision
- intervention-derived funding totals where live logic exists
- coordinator salary totals derived from `finance_regional_salary_entry`

Those values should be calculated by the reporting layer and merged with the saved snapshot inputs at read time.

## Metadata

- `snapshot_status` supports `draft` and `final`
- `created_by_staff_profile_id` and `updated_by_staff_profile_id` track authoring context
- `created_at` and `updated_at` track row timestamps
