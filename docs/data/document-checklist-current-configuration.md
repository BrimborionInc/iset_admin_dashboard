# Document Checklist Current Configuration

Status: maintained runtime configuration snapshot.
Last verified: 2026-05-11 against PROD `iset_runtime_config` via read-only SSM SQL.

Purpose: outline the currently configured PATH document checklist gates and accepted document types. This is a snapshot of runtime configuration, not a requirements proposal.

## Source Of Truth

- Runtime source: `iset_runtime_config`, `scope='checklist'`.
- Application checklist key: `checklist.compliance.iset`.
- Intervention checklist key: `checklist.compliance.iset.intervention`.
- PROD runtime rows verified on 2026-05-11:
  - `checklist.compliance.iset`: `iset-compliance-v1`, version `2026-01-20`, 10 gates, updated `2026-05-06 15:17:10`.
  - `checklist.compliance.iset.intervention`: `iset-intervention-v1`, version `2026-01-20`, 3 gates, updated `2026-05-06 15:17:10`.
- The admin endpoint is `GET /api/config/runtime/checklists`; the applicant checklist endpoint uses `GET /api/applicants/:id/document-checklist`.
- Runtime gate selection uses an explicit `stage` query when supplied, otherwise the first gate whose configured `statusScope` and `statuses` match the current application, case, or intervention status.

Important caveat: configured `required` is the base rule. `isetadminserver.js` still applies conditional logic for known item IDs, including income evidence, expense evidence, medical documentation, acceptance letters, funding package forms, attendance forms, and intervention financial evidence. Preserve behavioral item IDs such as `financial-records` and `financial-evidence`.

## Environment Drift Notes

- PROD has the May 6, 2026 checklist repair: application income/expense evidence uses active `evidence_income` / `evidence_expense` codes with backend-recognized item IDs, and intervention Band/Nation letter requirements accept `band_funding_decision`.
- Local DEV runtime checked on 2026-05-11 still had older rows updated `2026-03-17 12:32:25`, including stale intervention financial evidence and older application submit-assessment IDs. Do not use that local DEV row as the staff-facing current configuration without refreshing it.
- In this checkout, `src/server/config/checklists/iset-compliance.json` and `src/server/config/checklists/iset-intervention.json` are byte-identical and do not match the verified PROD intervention runtime row. If a task relies on fallback seeding or a new environment without runtime rows, align the fallback JSON before relying on it.

## Gate Summary

| Checklist | Gate | Status scope | Matching statuses | Items |
| --- | --- | --- | --- | ---: |
| Application | Gate 1 - Submit Application (`submit_application`) | application | `submitted`, `in_review`, `docs_requested`, `closure_notice`, `pending_approval` | 12 |
| Application | Gate 2 - Start Assessment (`start_assessment`) | application | `submitted`, `in_review`, `docs_requested`, `closure_notice`, `pending_approval` | 3 |
| Application | Gate 3 - Submit Assessment (`submit_assessment`) | application | `submitted`, `in_review`, `docs_requested`, `closure_notice`, `pending_approval` | 3 |
| Application | Gate 4 - Deny (`deny`) | application | `closure_notice` | 0 |
| Application | Gate 5 - Approve (`approve`) | application | `pending_approval`, `decision_ready` | 1 |
| Application | Gate 6 - Approve and Commence (`approve_and_commence`) | application | `decision_ready` | 6 |
| Application | Gate 7 - Propose New Intervention (`propose_new_intervention`) | case | `active`, `dormant`, `ready_to_close` | 0 |
| Application | Gate 8 - Send Payment Packet to Finance (`send_payment_packet_to_finance`) | case | `initiated`, `active`, `dormant`, `ready_to_close` | 7 |
| Application | Gate 9 - Trigger a Recurring Payment (`trigger_recurring_payment`) | case | `initiated`, `active`, `dormant`, `ready_to_close` | 1 |
| Application | On-demand (`on_demand`) | application | `submitted`, `in_review`, `docs_requested`, `closure_notice`, `pending_approval` | 1 |
| Intervention | Needed to Submit Proposal (`submit_proposal`) | intervention | `draft`, `changes_requested` | 4 |
| Intervention | Needed to Enable Funding (`enable_funding`) | intervention | `submitted`, `in_review` | 5 |
| Intervention | Needed to Release Payments (`release_payments`) | intervention | `approved`, `in_progress`, `suspended`, `ready_to_close` | 0 |

## Application Checklist

### Gate 1 - Submit Application

Status scope: application. Matching statuses: `submitted`, `in_review`, `docs_requested`, `closure_notice`, `pending_approval`.

| Item | Required | Accepted document types | Sources | Notes |
| --- | --- | --- | --- | --- |
| Identity document (`identity-document`) | Yes | `identity_document` - Identity document; client | `application_submission`, `manual_upload`, `secure_message_attachment` | Front and back, but a single image of both is OK. |
| Indigenous declaration (`indigenous-declaration`) | Yes | `indigenous_declaration` - Indigenous declaration; client | `application_form` | Auto-generated when the application is submitted. |
| Letter of Reference (`letter-of-reference`) | No | `letter_of_reference` - Letter of Reference; client | `application_submission`, `manual_upload`, `secure_message_attachment` | Alternative to the status/treaty card. If used, two letters of reference are required. |
| Resume (`resume`) | Yes | `resume` - Resume; client | `application_submission`, `manual_upload`, `secure_message_attachment` | One per client, but must be kept up to date. |
| Status or Treaty Card (`status-or-treaty-card`) | No | `status_card` - Status or Treaty Card; client | `application_submission`, `manual_upload`, `secure_message_attachment` | Either the status/treaty card or two letters of reference are required. |
| Band or Nation funding Decision letter (`band-or-nation-funding-decision-letter`) | Yes | `band_funding_confirmation` - Band funding confirmation; application<br>`band_funding_denial` - Band funding denial; application<br>`band_funding_decision` - Band or Nation funding decision letter; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Either a funding approval or denial letter is required. |
| Conflict of Interest Form (`conflict-of-interest-form`) | Yes | `conflict_of_interest` - Conflict of Interest Form; application | `application_form` | Auto-generated when the application is submitted. |
| Letter of Acceptance (`letter-of-acceptance`) | Yes | `acceptance_letter` - Letter of acceptance to program; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Required for applications other than Self-employment Support. |
| Medical documentation (`medical-documentation`) | Yes | `medical_documentation` - Medical documentation; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Conditionally required when disability support is requested. |
| Evidence of Income (`financial-records`) | Yes | `evidence_income` - Income evidence; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Backend-recognized conditional income item ID. |
| Evidence of Expense (`financial-evidence`) | Yes | `evidence_expense` - Expense evidence; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Backend-recognized conditional expense item ID. |
| Student financial assistance statement (`student_financial_assistance_statement`) | Yes | `student_financial_assistance_statement` - Student financial assistance statement; application | `application_form`, `application_submission`, `manual_upload`, `secure_message_attachment`, `system_generated` | Shows current student funding such as a loan, grant, funding summary, or award letter. |

### Gate 2 - Start Assessment

Status scope: application. Matching statuses: `submitted`, `in_review`, `docs_requested`, `closure_notice`, `pending_approval`.

| Item | Required | Accepted document types | Sources | Notes |
| --- | --- | --- | --- | --- |
| EI Consent Form (`ei-consent-form`) | Yes | `ei_consent` - EI Consent Form; application | `application_form` | EI assessment is completed first after conflict-of-interest check and assessment unlock. |
| EI Eligibility Verification (`ei-eligibility-verification`) | Yes | `ei_verification` - EI Eligibility Verification; application | `application_submission`, `manual_upload`, `secure_message_attachment` | EI assessment evidence. |
| Case manager assessment (`case-manager-assessment`) | Yes | `case_assessment` - Case manager assessment; application | `application_form` | Auto-generated PDF of the completed assessment. |

### Gate 3 - Submit Assessment

Status scope: application. Matching statuses: `submitted`, `in_review`, `docs_requested`, `closure_notice`, `pending_approval`.

| Item | Required | Accepted document types | Sources | Notes |
| --- | --- | --- | --- | --- |
| Evidence of Expense (`financial-evidence`) | Yes | `evidence_expense` - Expense evidence; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Checked during assessment for omissions; backend-recognized conditional expense item ID. |
| Evidence of Income (`financial-records`) | Yes | `evidence_income` - Income evidence; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Conditional on declared income; backend-recognized conditional income item ID. |
| Application form (`application-form`) | Yes | `application_form` - Application form; application | `application_form` | Auto-generated PDF when the assessment is submitted. |

### Gate 4 - Deny

Status scope: application. Matching statuses: `closure_notice`.

No checklist items are configured in PROD.

### Gate 5 - Approve

Status scope: application. Matching statuses: `pending_approval`, `decision_ready`.

| Item | Required | Accepted document types | Sources | Notes |
| --- | --- | --- | --- | --- |
| Financial Overview (`financial-overview`) | Yes | `financial_overview` - Financial overview/budget; application | `system_generated` | System-generated from the application form. |

### Gate 6 - Approve and Commence

Status scope: application. Matching statuses: `decision_ready`.

| Item | Required | Accepted document types | Sources | Notes |
| --- | --- | --- | --- | --- |
| Client Funding Agreement (`client-funding-agreement`) | Yes | `funding_agreement` - Funding agreement; application | `system_generated`, `secure_message_attachment`, `manual_upload` | Runtime note is truncated in PROD: "Fuinding agreement signed by the applicant and case ma". |
| Authorisation for release of ISET client information (`authorisation-for-release-of-iset-client-information`) | Yes | `iset_client_info_release` - Authorization for release of ISET client information; client | `system_generated`, `secure_message_attachment`, `manual_upload` |  |
| Client acknowledgement of Funding source (`client-acknowledgement-of-unding-source`) | Yes | `client_acknowledgement` - Client Acknowledgement of Funding Source; application | `system_generated`, `secure_message_attachment`, `manual_upload` | Item ID contains the current runtime typo `unding`. |
| EFT or Wire Transfer Direct Deposit Form (`eft-or-wire-transfer-direct-deposit-form`) | Yes | `EFT_form` - EFT or wire transfer direct deposit form; application | `system_generated`, `secure_message_attachment`, `manual_upload` |  |
| MOU/Co-Funding Agreement Letter (`mou-co-funding-agreement-letter`) | No | `mou_co_funding_agreement_letter` - MOU/Co-funding agreement letter; application | `secure_message_attachment`, `manual_upload` |  |
| Voided Cheque or Equivalent (`voided-cheque-or-equivalent`) | Yes | `voided_cheque` - Voided Cheque; client | `manual_upload`, `secure_message_attachment`, `application_submission` |  |

### Gate 7 - Propose New Intervention

Status scope: case. Matching statuses: `active`, `dormant`, `ready_to_close`.

No checklist items are configured in PROD.

### Gate 8 - Send Payment Packet to Finance

Status scope: case. Matching statuses: `initiated`, `active`, `dormant`, `ready_to_close`.

| Item | Required | Accepted document types | Sources | Notes |
| --- | --- | --- | --- | --- |
| Alternate payee letter (`alternate-payee-letter`) | No | `alternate_payee_letter` - Alternate payee letter; action_plan | `application_submission`, `manual_upload`, `secure_message_attachment` | If needed. |
| Employer duties letter (`employer-duties-letter`) | No | `employer_duties_letter` - Employer duties letter; action_plan | `application_submission`, `manual_upload`, `secure_message_attachment` | If needed for the payment packet line-item category. |
| Employer offer letter after subsidy (`employer-offer-letter-after-subsidy`) | No | `employer_offer_letter_after_subsidy` - Employer offer letter after subsidy; action_plan | `application_submission`, `manual_upload`, `secure_message_attachment` | If needed for the payment packet line-item category. |
| Equipment quote (`equipment-quote`) | No | `equipment_quote` - Equipment quote; action_plan | `application_submission`, `manual_upload`, `secure_message_attachment` | If needed for the payment packet line-item category. |
| Institution letter (`institution-letter`) | No | `institution_letter` - Institution letter; action_plan | `application_submission`, `manual_upload`, `secure_message_attachment` | If needed. |
| Receipt (`receipt`) | No | `receipt` - Receipt; action_plan | `application_submission`, `manual_upload`, `secure_message_attachment` | If needed for the payment packet line-item category. |
| Wage plan / MERCs schedule (`wage-plan-mercs-schedule`) | No | `wage_plan` - Wage plan / MERCs schedule; action_plan | `application_submission`, `manual_upload`, `secure_message_attachment` | If needed for the payment packet line-item category. |

### Gate 9 - Trigger a Recurring Payment

Status scope: case. Matching statuses: `initiated`, `active`, `dormant`, `ready_to_close`.

| Item | Required | Accepted document types | Sources | Notes |
| --- | --- | --- | --- | --- |
| Attendance form (`attendance-form`) | Yes | `attendance_form` - Attendance form; action_plan | `application_submission`, `manual_upload`, `secure_message_attachment` | Monthly. |

### On-demand

Status scope: application. Matching statuses: `submitted`, `in_review`, `docs_requested`, `closure_notice`, `pending_approval`.

| Item | Required | Accepted document types | Sources | Notes |
| --- | --- | --- | --- | --- |
| Media consent (`media-consent`) | No | `media_consent` - Media consent form; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Request only when needed. |

## Intervention Checklist

### Needed to Submit Proposal

Status scope: intervention. Matching statuses: `draft`, `changes_requested`.

| Item | Required | Accepted document types | Sources | Notes |
| --- | --- | --- | --- | --- |
| Band funding confirmation or denial letter (`band-funding-letter`) | Yes, `minCount=1` | `band_funding_confirmation` - Band funding confirmation; application<br>`band_funding_denial` - Band funding denial; application<br>`band_funding_decision` - Band or Nation funding decision letter; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Accepts the merged Band/Nation decision type. |
| Letter of Acceptance, current year/term (`intervention-acceptance-letter`) | Yes | `acceptance_letter` - Letter of acceptance to program; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Runtime condition makes this required only when the intervention metadata includes an institution. |
| ISET Financial Overview, monthly budget (`intervention-financial-overview`) | Yes | `financial_overview` - Financial overview/budget; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Runtime condition makes this required when the intervention has living allowance. |
| Financial Evidence, expenses/supporting (`intervention-financial-evidence`) | Yes, `minCount=1` | `evidence_expense` - Expense evidence; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Runtime condition makes this required when the intervention has living allowance. |

### Needed to Enable Funding

Status scope: intervention. Matching statuses: `submitted`, `in_review`.

| Item | Required | Accepted document types | Sources | Notes |
| --- | --- | --- | --- | --- |
| Band funding confirmation or denial letter (`band-funding-letter`) | Yes, `minCount=1` | `band_funding_confirmation` - Band funding confirmation; application<br>`band_funding_denial` - Band funding denial; application<br>`band_funding_decision` - Band or Nation funding decision letter; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Accepts the merged Band/Nation decision type. |
| Letter of Acceptance, current year/term (`intervention-acceptance-letter`) | Yes | `acceptance_letter` - Letter of acceptance to program; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Runtime condition makes this required only when the intervention metadata includes an institution. |
| ISET Financial Overview, monthly budget (`intervention-financial-overview`) | Yes | `financial_overview` - Financial overview/budget; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Runtime condition makes this required when the intervention has living allowance. |
| Financial Evidence, expenses/supporting (`intervention-financial-evidence`) | Yes, `minCount=1` | `evidence_expense` - Expense evidence; application | `application_submission`, `manual_upload`, `secure_message_attachment` | Runtime condition makes this required when the intervention has living allowance. |
| EI Eligibility Verification (`intervention-ei-verification`) | Yes | `ei_verification` - EI Eligibility Verification; application | `application_submission`, `manual_upload`, `secure_message_attachment` |  |

### Needed to Release Payments

Status scope: intervention. Matching statuses: `approved`, `in_progress`, `suspended`, `ready_to_close`.

No checklist items are configured in PROD.

## Referenced Document Types

All 34 document type codes referenced by the verified PROD checklist rows existed in the PROD `document_type` catalog and were active on 2026-05-11.

| Code | Catalog label | Catalog scope |
| --- | --- | --- |
| `EFT_form` | EFT or wire transfer direct deposit form | application |
| `acceptance_letter` | Letter of acceptance to program | application |
| `alternate_payee_letter` | Alternate payee letter | action_plan |
| `application_form` | Application form | application |
| `attendance_form` | Attendance form | action_plan |
| `band_funding_confirmation` | Band funding confirmation | application |
| `band_funding_decision` | Band or Nation funding decision letter | application |
| `band_funding_denial` | Band funding denial | application |
| `case_assessment` | Case manager assessment | application |
| `client_acknowledgement` | Client Acknowledgement of Funding Source | application |
| `conflict_of_interest` | Conflict of Interest Form | application |
| `ei_consent` | EI Consent Form | application |
| `ei_verification` | EI Eligibility Verification | application |
| `employer_duties_letter` | Employer duties letter | action_plan |
| `employer_offer_letter_after_subsidy` | Employer offer letter after subsidy | action_plan |
| `equipment_quote` | Equipment quote | action_plan |
| `evidence_expense` | Expense evidence | application |
| `evidence_income` | Income evidence | application |
| `financial_overview` | Financial overview/budget | application |
| `funding_agreement` | Funding agreement | application |
| `identity_document` | Identity document | client |
| `indigenous_declaration` | Indigenous declaration | client |
| `institution_letter` | Institution letter | action_plan |
| `iset_client_info_release` | Authorization for release of ISET client information | client |
| `letter_of_reference` | Letter of Reference | client |
| `media_consent` | Media consent form | application |
| `medical_documentation` | Medical documentation | application |
| `mou_co_funding_agreement_letter` | MOU/Co-funding agreement letter | application |
| `receipt` | Receipt | action_plan |
| `resume` | Resume | client |
| `status_card` | Status or Treaty Card | client |
| `student_financial_assistance_statement` | Student financial assistance statement | application |
| `voided_cheque` | Voided Cheque | client |
| `wage_plan` | Wage plan / MERCs schedule | action_plan |
