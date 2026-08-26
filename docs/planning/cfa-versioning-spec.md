## Purpose
Define how Client Funding Agreements (CFAs) are versioned, generated, sent, and audited when interventions are approved or changed for an existing client.

## Audience
Product owner, case management leads, and engineers implementing CFA generation and secure messaging workflows.

## Last Updated
2026-08-25

## Summary
Treat every client-facing CFA as an immutable version in a single case/template series. Each approval moment (new interventions or edits to existing interventions) creates the next draft CFA version, using the latest signed case-series version as its read-only supersession/redline baseline. Exact application and Action Plan ownership belongs to the version, not the series.

## Decision Record
- Decision: Use one CFA series per case/template (not per application or funding stream).
- Rationale: Clients experience one agreement, interventions can mix EI/CRF, a single baseline simplifies redlines, and reporting can still break out by stream using line-item attributes.
- Revisit if: Policy requires separate EI vs CRF client agreements, or agreement text diverges materially by stream.
- Template scope: Keep series scoped by template key (not funding stream) to allow future splits without a migration.

## Goals
- Maintain a clear audit trail of what was agreed, when, and by whom.
- Support multiple approval moments without overwriting past agreements.
- Provide clean and redline copies for participant review.
- Keep secure messaging as the delivery channel for CFA documents.

## Non-Goals
- Replacing the secure messaging flow.
- Building a separate amendment-only data model.
- Changing how interventions are approved in the case workspace.
- Adding new UI panels inside Secure Messaging.

## Core Concepts
- CFA series: one per case/template (optionally per funding stream only if policy later requires).
- CFA version: immutable snapshot of the agreement at a point in time.
- Only the latest signed version is considered "in force."
- Draft/sent versions are proposed, not binding.

## Data Model (Proposed)
### cfa_series
- id (PK)
- case_id (FK to iset_case)
- template_key (e.g., ISET_CFA_STANDARD; allows future splits without stream hard-coding)
- created_at, created_by_staff_profile_id

### cfa_version
- id (PK)
- series_id (FK to cfa_series)
- application_id (nullable FK to iset_application; typed owner for new application-backed versions)
- action_plan_id (nullable FK to iset_case_action_plan; exact plan provenance for new plan-based versions)
- version_number (1, 2, 3...)
- status (draft, sent, signed, withdrawn)
- supersedes_version_id (nullable FK to cfa_version)
- change_reason (NEW_INTERVENTION_APPROVED, INTERVENTION_CHANGED, CORRECTION_AFTER_SEND, ADMIN_REISSUE)
- change_summary (short human-readable reason shown in the UI)
- created_at, created_by_staff_profile_id
- sent_at, sent_by_staff_profile_id
- signed_at, signed_by_participant_id
- effective_date (date the agreement takes effect)
- snapshot_schema_version
- snapshot_hash (hash of canonicalized snapshot JSON)
- rendered_template_version
- metadata_json (snapshot of agreement data)

Historical versions may retain `NULL` typed ownership. For those rows only, immutable snapshot lineage remains the compatibility source. A populated typed owner is authoritative and snapshot data may not contradict it. The nullable version fields do not change the one-series-per-case decision.

### cfa_version_documents
- id (PK)
- cfa_version_id (FK)
- document_type (clean, redline)
- document_id (FK to existing document storage)
- created_at

## Snapshot Contents (metadata_json)
Store a full snapshot of the agreement data needed to render the CFA without re-querying live data:
- interventions: array of intervention line items (id, code, label, start_date, end_date, total_cost, funding_stream, delivery partner, notes)
- plan summary (action plan id, plan title, funding stream)
- client identity fields needed for the CFA (name, case number)
- totals by funding stream (if needed)

## Versioning Rules

Object-store versioning is an environment capability, not a prerequisite for participant signing. A request-specific conditional key is always SHA-256 and length verified. If S3 returns a `VersionId`, rollback compensation deletes only that exact version. If no `VersionId` exists, PATH retains the checksum-verified object after database rollback and reuses it on the next claim; key-only deletion after transaction locks are released is prohibited because it can race a retry. Uncertain commits and unconfirmed rollbacks retain the artifact in either mode.
- New intervention approval OR edit to existing intervention -> create a new draft CFA version.
- If a draft exists when a new change occurs:
  - Create a new draft version and mark the previous draft as withdrawn.
- Once sent, the document is frozen. Further changes create a new draft version.
- Only signed versions are effective; draft/sent versions are proposed.

## Redline Generation
- Compare latest signed version vs new draft version.
- Use stable ordering to avoid diff noise (start date, then code/label).
- Identify:
  - Added: in draft, not in signed.
  - Removed: in signed, not in draft.
  - Modified: same id, different fields.
- Render line-level strike/insert (simple, readable). Field-level diff can be added later if needed.

## Secure Messaging Flow
No new panel is added in Secure Messaging. CFA files are generated into Supporting Documents, and staff attach the latest CFA using the existing attachment picker in Secure Messaging. Versions remain discoverable in Supporting Documents with clear naming.

For approved intervention proposals and approved intervention revisions, the client approval/funding revision letter signing request is rendered from the reviewed secure-message letter body. Do not reuse the application assessment decision-letter draft for these intervention-level sends, because that draft can describe the original application approval while the intervention revision/CFA packet contains changed amounts.

When the secure-message send path needs a funding-agreement signing request and no draft CFA exists, intervention-scoped sends must first create the missing draft from the selected intervention's action plan. This covers reopened/current amendments on records originally entered through historical/manual backload, while preserving the rule that ordinary manual-backload edit/close operations stay silent and do not create CFA side effects.

## Trigger Points
- Approval of new intervention(s) for an existing client.
- Edits to approved/planned interventions that change agreed terms (dates, costs, scope).

## Permissions
- Only roles with approval/plan-edit rights can generate or send CFA versions.
- Participant signatures recorded by portal or document workflow; admin UI reads the result.

## Implementation Phases
1) Data model + API list/create endpoints for CFA versions.
2) PDF rendering for clean CFA.
3) Redline rendering (diff against latest signed).
4) Ensure CFA documents are stored and surfaced in Supporting Documents with consistent naming.
5) Signature capture and status progression.

## Open Questions
None. Label in outbound docs: "CFA vN".

## Related Financial Overview Signature Pattern
- DEV now mirrors the CFA signing pattern for Financial Overview signature requests. The secure-message attachment workflow is `Financial Overview` (`workflow_id=52`, `workflow_type='consent-cm-prefill'`, `document_type='financial_overview'`).
- Financial Overview versions are case scoped in `funding_overview_series` / `funding_overview_version`, with clean/redline documents linked through `funding_overview_version_documents`.
- The snapshot is a complete financial overview built from original application answers plus current Case Workspace Participant Details updates. Case-context values from Participant Details override the original application answers in the next snapshot. Secure-message sends can now be prefilled from those values or sent blank; the applicant completes/edits only the participant-facing monthly income/expense fields plus the "other income/source" and "other expenses/list" text fields in the public portal, then signs the income/expense attestation. PATH does not ask the applicant for staff/program context such as supports requested, top-up amount, childcare funding status, transportation category/mileage, or student loan/grant details in this signing form. On submission, PATH writes the submitted income/expense values back to the case Participant Details layer (`iset_case.case_context_json.applicationAnswers` plus convenience fields), updates the `funding_overview_version` snapshot, and generates the signed official Financial Overview PDF. The original application payload remains immutable.
- New Financial Overview versions record nullable typed `application_id`. Application-backed sends withdraw/cancel only unsigned versions belonging to that exact application; unrelated applicationless or sibling history remains untouched and cannot veto the send. Signed versions remain immutable history, while the series, numbering, and read-only latest-signed redline baseline remain case scoped.

### Assessment-resubmission preservation contract

- Scope: Application Assessment submission/resubmission and Financial Overview supporting-document lifecycle. CFA, intervention, payment, notification, queue, and permission behavior are out of scope.
- Roles: the rule is actor-independent. ISET Coordinator, Regional Manager, NWAC Administrator/Decision Maker, and System Administrator actions must produce the same document-preservation result.
- State authority: `funding_overview_series` / `funding_overview_version` own the version lifecycle; `funding_overview_version_documents` owns version-to-document lineage; `signing_request` owns pending/viewed/signed request state.
- Assessment submission may continue replacing the legacy unversioned assessment-generated `financial_overview` snapshot when no version-managed Financial Overview exists.
- Once a case has any version-managed Financial Overview, assessment submission must automatically preserve it and must not generate a competing legacy overview.
- Any Financial Overview document linked through `funding_overview_version_documents`, carrying `metadata.funding_overview_version_id`, or linked to a signing request is protected from the legacy category-wide archive operation.
- Signed versions remain immutable history. A later version supersedes the prior signed version through the explicit Financial Overview workflow, not as a side effect of assessment submission.
- No notification, queue, editability, schema, or runtime-configuration change is part of this repair.
- PROD feedback `#166` is the tracked live item. Document `5539` was restored on 2026-07-27. After Emilie confirmed that the signed v1 is authoritative, the unnecessary v2 version `18`, signing request `136`, message `1924`, documents `7687`/`7688`, and related reminders were withdrawn or archived. Application `103` remains in `docs_requested` because Rent Assist supporting documentation is still required. The report remains `in_progress` pending deployed prevention and targeted live UI confirmation.
- Release acceptance must prove: signed/version-managed document remains active after assessment resubmission; a legacy unversioned overview remains replaceable; application-form replacement behavior is unchanged; transaction fixtures leave zero residue.
