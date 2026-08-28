# PATH Workflow Policy Uncertainty Register

Status: current
Last Updated: 2026-08-28

## Purpose

This is the living register of business-policy and end-to-end process areas that Codex must treat as incomplete when investigating PATH bugs. It exists to prevent a narrow repair for one reporter, role, screen, state, or record from silently changing another supported journey.

The register is deliberately about policy understanding, not merely code coverage. Current code, tests, live data, a reporter's requested outcome, training material, and earlier repairs are evidence, but none is automatically the governing business rule.

“Complete” below means a complete first-pass taxonomy of the policy areas currently visible in PATH documentation and recent bug history. It does not mean every unknown unknown has been found. New investigations must add newly exposed policy gaps instead of forcing them into an existing answer.

## Required Use For Every Bug

Before a fix is designed, record a short bug policy brief covering:

1. the reported journey and every other entry path to the same operation;
2. each affected actor and the capacity in which that person is acting;
3. the exact entity scope: client, case, application, assessment, review workflow, Action Plan, intervention, document/version, message/signing request, payment packet, or reporting record;
4. all relevant lifecycle, review, waiting, delivery, signing, payment, and reporting states;
5. permitted, forbidden, correction, reversal, recall, withdrawal, and retry actions;
6. downstream records, PDFs, messages, signatures, notifications, queues, reporting, finance, and external-system effects;
7. facts confirmed as business policy, facts merely observed in the implementation, assumptions, and unresolved questions;
8. the scenario matrix required to prove that the fix preserves other actors, states, scopes, and entry paths.

Do not ask Bill to confirm a conclusion merely because no policy sentence states it verbatim. Codex should resolve straightforward consequences of established principles, record the reasoning, and continue. Escalate one question at a time only when credible alternatives would materially change behavior, evidence conflicts, an external authority controls the answer, or a high-consequence choice lacks adequate support. An emergency containment must preserve any genuinely unresolved choice and must not become policy by accident.

## Confidence Labels

- `confirmed`: the material question is controlled by a genuinely authoritative source, an explicit evidence-based design decision, or a clear consequence of already established principles with no credible conflicting interpretation. Neither Bill's view nor current code is sufficient by itself.
- `partial`: some rules are confirmed, but important branches or exceptions remain unsettled.
- `unresolved`: no current approved rule controls the decision.
- `external`: PATH must follow an outside authority whose current version or interpretation still needs confirmation.

## Current Uncertainty Register

| ID | Priority | Policy area | What appears established | Weakness requiring explicit confirmation before a broad fix |
| --- | --- | --- | --- | --- |
| `WP-01` | P0 | Authority among overlapping state machines | Application, case, review, document/signing, payment, and reporting states are distinct. The main-sequence stage controls stage-dependent ownership and rules. `Waiting on Applicant` is an application-scoped, derived awaiting condition, not a main-sequence stage, and must not advance, rewind, or replace the review stage. It imposes no restriction itself: only the exact unresolved requirement may block a dependent action. | The core distinction is settled, but the complete precedence and reconciliation contract remains partial. We still need to define how multiple awaiting reasons are represented and cleared, and how they affect presentation, follow-up, SLA clocks, completion, closure, and recovery without becoming a competing stage or blanket lock. |
| `WP-02` | P0 | Actor identity, role, and acting capacity | The original submitter remains part of the historical record, but reassignment transfers ordinary assignee-owned work, including returned correction authority, to the new assignee. An active review and tasks with independently assigned actors retain their owners. A same-person Regional Manager acts as submitter before later acting as reviewer; the Decision Maker role is distinct; System Administrator is technical support. | Reassignment principles are settled, but there is no complete policy for explicit versus inferred acting capacity, temporary coverage, delegation without reassignment, or multiple roles. |
| `WP-03` | P0 | Client, case, application, and episode scope | The target is one client, one long-lived case, and many discrete applications; imported historical files may be application-less. | We do not yet have a complete policy matrix for which facts and artifacts are reusable across applications, which must always be application-specific, how an application on an already active case interacts with current service, or how ambiguous historical provenance should be resolved operationally. |
| `WP-04` | P0 | Role/action/state transition matrix | The two-step review flow and several exact return paths are documented. | PATH lacks one approved matrix covering every role and every create, edit, save, submit, return, recall, withdraw, cancel, reopen, close, approve, deny, request-changes, communicate, and retry action across all supported workflow states. |
| `WP-05` | P0 | Corrections, reversals, and retractions | Authorized reviewers may make tracked, non-substantive assessment corrections during review while preserving the submitted wording. Dependency-free accidental workflow decisions may be reversed, and dependency-free erroneous historical entries retracted rather than deleted, with reason and full audit. Changes to substantive assessment facts return to the submitter. Consequential reversal requires another NWAC Administrator's confirmation, the correctly authorized replacement Decision Maker, and domain-specific dependency recovery; technical support is not the business authorizer. | We do not yet have the complete post-decision recovery matrix, a settled boundary between reopening a validly closed service episode and creating a new episode, or a complete dependency catalogue that removes other corrections from self-service. |
| `WP-06` | P0 | Dependency consequences and authoritative evidence | Final decisions, signed forms, generated packets, applied revisions, and reporting records may be authoritative evidence. Controls must be operation-specific: authorized staff may correct a supporting document's display title and classification without changing its stored file or provenance, organize ordinary evidence within the same authorized client/case scope, and reversibly hide an eligible mistaken staff upload. Supporting-document permanent deletion is not a PATH product action. | There is no complete artifact-by-artifact policy for file replacement, duplicate, withdraw, supersede, or regenerate, nor a complete definition of which downstream dependencies make each ownership-changing operation unsafe. |
| `WP-07` | P0 | Application assessment authorship and editability | Submitted assessment facts remain protected during review, but authorized reviewers may make tracked, non-substantive wording corrections while the original submission remains preserved. The current assignee may edit returned work; final decision belongs to the Decision Maker. | We need explicit policy for collaborative drafting, what Save Progress commits, when an assessment snapshot freezes, what may change on resubmission, and how old validation/evidence requirements apply to returned legacy work. |
| `WP-08` | P0 | Decision and approval policy | Approve, deny, and request changes are materially different outcomes. Current guidance says only the named authorized Decision Maker may approve funding of $20,000 or above. | We do not have a complete approval-authority matrix by amount, funding stream, intervention type, absence/delegation, or reconsideration. Confirmation and recovery rules for high-consequence choices are incomplete. |
| `WP-09` | P0 | Repeat applications and downstream lineage | Application-specific assessment, document, Action Plan, CFA, denial-reporting, and queue lineage must remain exact. | The full repeat-application scenario set is not an approved business contract: concurrent applications, a new application during active service, reuse of current financial/eligibility facts, shared versus new Action Plans, and the effect of one application's denial, withdrawal, or closure on siblings remain only partially specified. |
| `WP-10` | P1 | Intake entry paths and identity resolution | Portal submission, manual intake, and import all resolve client/case scope; registration alone does not create a case; import need not fabricate an application. | Policy equivalence and deliberate differences among portal, manual, and imported entry are incomplete, including duplicate-person handling, applicant-account linking, representative-assisted intake, corrections to submitted applicant facts, and withdrawal/resubmission. |
| `WP-11` | P1 | Eligibility, EI status, and evidence | EI values affect funding and reporting; changed EI values require current evidence, while some unchanged accepted legacy values may be retained. | We need the authoritative decision owner, evidence freshness rules, accepted source types, expiry/reverification, post-submission and post-decision correction rules, and exact consequences for assessment, funding, documents, queues, and ESDC. |
| `WP-12` | P1 | Financial assessment, funding source, and cost changes | Assessment costs, budget pots, EI/CRF classification, other funders, payees, and approved amounts feed several downstream workflows. | There is no complete policy for who may change which financial facts at each stage, which changes require renewed review, how internal/external/PTMA funding is chosen, how partial/multiple funders are represented, or how later cost changes affect agreements, payments, and reporting. |
| `WP-13` | P1 | Action Plans, interventions, proposals, and revisions | Action Plans are case-owned service episodes; proposals/revisions have review state; live interventions have delivery state; historical backloads are deliberately silent. A permitted business reopen belongs to authorized Regional Managers/NWAC Administrators under controlled safeguards, not exclusively to technical System Administration. | The complete rules for creating additional plans, linking them to applications, multiple concurrent plans, amendments versus new interventions, cancellation/suspension/completion, the boundary between reopening an old episode and creating a new one, funding changes, and dependent artifacts are not centrally approved. |
| `WP-14` | P1 | Applicant documents, generated forms, and signing | Version-managed forms, signing requests, messages, documents, and final PDFs require exact lineage and idempotent completion. | Policy is incomplete for when each form is required, who may prefill or alter it, participant name corrections, expiration, cancellation, reissue, supersession, partial signing, changed-payload retry, and whether a corrected decision always requires new applicant-facing artifacts. |
| `WP-15` | P1 | Post-decision communication and completion | Decision state is distinct from letter drafting, sending, funding-form signing, and final application completion. | We need a complete definition of who owns each post-decision task, what constitutes delivery and completion, whether denial and approval have symmetrical requirements, what happens after failed delivery, and which outstanding forms or communications keep an application open. |
| `WP-16` | P1 | Waiting, hold, reminder, and no-response policy | Awaiting applicant, document requests, holds, reminders, and review state should not overwrite one another. | The business clocks, pause/resume rules, reminder cadence, escalation owners, response deadlines, no-response closure rules, and reopening behavior are not captured as one policy across application, signing, messaging, and case workflows. |
| `WP-17` | P1 | Case lifecycle, closure, and reopening | A denied application does not itself deny the case; a new application may reopen a terminal case while preserving historical application evidence. | We lack an approved aggregate closure contract covering sibling applications, Action Plans, interventions, signing requests, payments, reminders, reporting, future service, dormant cases, and the actor authorized to close or reopen each combination. |
| `WP-18` | P1 | Assignment, region, conflict, and access | Access may follow direct assignment, region/portfolio scope, role, object relationship, and conflict declarations; conflicts are case-and-staff scoped. | The complete business matrix for cross-region assignment, temporary coverage, unassigned work, watchers, conflict consequences, reassignment during review, privileged support access, and what remains visible but read-only is not centrally approved. |
| `WP-19` | P1 | Secure messaging and notifications | Message direction, case/application scope, recipient participation, bell alerts, and applicant email notifications are distinct. | We need policy for who may initiate or reply after reassignment, withdrawal/recall, sensitive or signed attachments, staff coverage, watcher notifications, delivery failure handling, applicant communication expectations, and when a message itself changes workflow state. |
| `WP-20` | P1 | Queues, SLA stages, and escalations | Queue membership should be derived from authoritative workflow/entity state rather than stored as a competing status. | There is no complete approved mapping from combined state to each role's queue, next action, SLA clock, overdue treatment, escalation recipient, pause condition, and disappearance/reappearance after reassignment or correction. |
| `WP-21` | P1 | ILMP/ESDC reporting | PATH prepares validated XML for manual external submission; ESDC readiness is a separate workflow and current external rules must be respected. | Source-of-truth precedence, staff confirmation of missing historical facts, correction after export, resubmission, repeat-application attribution, backload timing, funding/status changes, and reconciliation with external acceptance are only partially specified. |
| `WP-22` | P1 | Payments, AP handoff, and Sage boundary | PATH currently owns operational preparation, evidence, handoff, communications, and follow-up; Sage/Finance remains the financial system of record and automated routing is not fully activated. | The approved role matrix, submission/return/cancel/retry lifecycle, approval ceiling, packet splitting, recurring payments, evidence requirements, ambiguous email/provider outcomes, reconciliation ownership, and eventual Sage integration contract remain incomplete business decisions. |
| `WP-23` | P1 | Reporting, metrics, and historical correction | Reports distinguish applications, clients, funding, activity, and period-based outcomes; some outputs are live while others preserve export snapshots. | Definitions are not centrally approved for “application,” “approved,” “funded,” “served,” period attribution, repeat applications, manual backloads, withdrawn/archived items, corrections after publication, and whether each report is live, as-at, or submission-frozen. |
| `WP-24` | P2 | Configuration and policy ownership | Checklists, notifications, workflow authoring, budgets, mappings, timing targets, and runtime flags can change behavior without a code release. | We need to know which settings are business policy, who may authorize changes, which require separation of duties or release/UAT, environment parity expectations, effective dating, and how bug fixes must behave when configuration differs. |
| `WP-25` | P2 | External requirements and policy-source governance | Training material, contribution agreements, ESDC guidance, forms, and client decisions are inputs to PATH behavior. | There is no single approved hierarchy for conflicting sources, effective dates, supersession, jurisdiction/program variation, or who confirms an interpretation before it becomes implemented policy. |
| `WP-26` | P2 | Audit, retention, and support override | Important transitions and corrections preserve history; System Administrator support is not the business actor. | We need a full policy for required audit detail, visibility, retention, redaction, correction reasons, evidence preservation, support-override authorization, second-person review, and when technical repair must trigger participant/staff notification. |

## Decisions

### `WP-01-D1` — Main-sequence stage versus awaiting condition

Status: confirmed principle; implementation and queue/SLA consequences remain partial.

- A main-sequence stage answers where the record is in the governing business sequence, who owns the next staff decision, and which stage-dependent actions are allowed.
- `Waiting on Applicant` is not a main-sequence stage. It is an orthogonal condition caused by one or more unresolved applicant-owned requirements.
- The condition belongs to the exact application and requirement. A case may show a roll-up indicator, but it must not acquire a case-wide `Waiting on Applicant` state merely because one application has an outstanding requirement.
- The condition itself blocks nothing. The exact unresolved requirement may block only an action whose prerequisite it is, such as assessment submission or application completion; it must not overwrite, advance, or rewind the active review stage.
- An awaiting condition does not make the whole record non-actionable and must not automatically remove it from staff work. Applicant-owned and staff-owned actions may be available at the same time.
- Do not reduce the concept to a manually maintained boolean. The robust model is derived from explicit unresolved requirements such as a requested document, signature, clarification, or applicant decision, each with its own lifecycle and evidence of completion.
- If an awaiting condition and the main stage disagree, preserve the main stage and surface the inconsistency for reconciliation; do not infer a stage transition from the flag.
- For every staff action, evaluate the exact prerequisite or dependency. Block only the action or transition that genuinely requires the missing applicant input; leave unrelated work available.

### `WP-02-D1` — Reassignment transfers active returned-work responsibility

Status: confirmed principle.

- Regional Managers already have authority to reassign applications and cases. This existing business action is the mechanism for transferring operational ownership; PATH must not leave the new assignee unable to perform the active returned correction work they have inherited.
- If an application/case is reassigned while its assessment or proposal is returned for correction, responsibility and edit/resubmit authority for that active returned work transfer to the new assignee.
- If reassignment occurs while an assessment or proposal is submitted or under review, the review continues unchanged: reassignment does not withdraw, restart, or transfer the review. If the reviewer later returns the work, correction responsibility and edit/resubmit authority belong to the new assignee.
- Reassignment must not overwrite authorship or review history. The original submitter remains recorded as the actor who made the earlier submission, while the reassignment and new correction owner are separately auditable.
- Ordinary caseworker responsibilities derived from application/case assignment transfer to the new assignee, including follow-ups, reminders, document requests, drafting, and returned corrections.
- Tasks with their own independently assigned actor do not transfer merely because the application/case is reassigned. This includes an active reviewer, Decision Maker, payment follow-up owner, or applicant signer.
- A technical System Administrator override is not a substitute for ordinary reassignment and staff coverage.

### `WP-05-D1` — Reviewers may make non-substantive assessment corrections

Status: confirmed principle; implementation matrix remains to be designed.

- During review, authorized reviewers may directly correct spelling, grammar, wording, clarity, obvious typographical errors, and similar presentation issues that do not change the substance of the assessment.
- PATH must retain the originally submitted wording and record the reviewer, time, and exact change. The correction does not change authorship of the submitted assessment or silently replace its historical snapshot.
- A reviewer must use the return-to-submitter workflow if a change affects or could reasonably alter eligibility, requested or approved funding, costs, supporting-document requirements, applicant-provided facts, evidence, the recommendation, or anything requiring additional information or the caseworker's professional judgement.
- A non-substantive correction does not itself restart or advance the review stage. Existing reviewer and Decision Maker responsibilities remain intact.
- This decision approves only minor reviewer edits. It does not decide the separate proposals for accidental-decision reversal, post-decision correction, historical-entry retraction, or other high-impact recovery.

### `WP-05-D2` — Dependency-free accidental decisions may be reversed

Status: confirmed principle; exact dependency-recovery matrix remains unresolved.

- An authorized reviewer may reverse their own approval, denial, or request-for-changes action when it was selected by mistake and no consequential action has relied on it.
- Reversal requires a reason and preserves the original action, actor, time, replacement action, and reversal actor/time in the audit history. It restores the appropriate prior review stage rather than erasing history.
- A decision letter, applicant communication, signature or agreement, payment activity, reporting submission, generated authoritative artifact, or other downstream reliance removes the reversal from self-service. PATH must then require separate authorization and explicitly recover, supersede, or reconcile each dependency.
- For a consequential reversal, a different NWAC Administrator acting as a Decision Maker confirms the reversal and recovery plan. The person authorized for the replacement outcome then records the corrected decision; approvals of `$20,000` or more remain reserved to Shelley Stacey.
- Finance, reporting, signing, communication, and other downstream owners confirm or perform recovery within their own domains, but do not authorize the program decision. A System Administrator may execute necessary technical recovery but is not a business authorizer.
- A dependency-free historical entry created in error follows the same principle: authorized staff may retract it from current operational use with a reason and full history, but must not delete it as though it never existed.
- This rule does not treat changed circumstances as an accidental decision. Whether a validly closed Action Plan or intervention should reopen later is a separate lifecycle question.

#### 2026-08-19 bug policy brief — Denise Chalifoux accidental denial

- Reported path: a System Administrator manually changed application `31` back to `in_review`, but the authoritative assessment workflow remained `final_decision_recorded`; the original submitter therefore remained read-only.
- Affected actors and ownership: Derry Yellowfly is both assigned Regional Manager and original assessment submitter; Madison Coppola is the preserved accidental-denial actor, not the owner of correction work; System Administration performs only the technical recovery.
- Affected entities and states: application `31`, case `113`, assessment `34`, workflow `59`, the denial-generated plan/interventions/ESDC seed/document, and scoped denial-reporting context. The correction state is `returned_to_submitter`, not ordinary `rm_review`, so correction cannot bypass the submitter.
- Permitted operation: return the assessment to the recorded original submitter, reopen current case/application state, clear current decision fields, and retract dependency-free generated denial artifacts from operational use while appending recovery audit history.
- Forbidden operation: erase the original denial event, silently transfer correction ownership to the Decision Maker, retain a final-denial lock behind an `in_review` label, or withdraw artifacts that have communication, signing, agreement, reporting, payment, finance, proposal, reminder, or other consequential reliance.
- Downstream result and regression scenarios: Derry can edit/save/resubmit; another Regional Manager remains denied; active RM, Decision Maker, and final stages remain read-only; resubmission restarts RM review and clears stale reviewer/decision data; a discovered downstream dependency must fail closed and require its domain owner rather than use this recovery path.

### `WP-09-D1` — Applicationless history cannot veto exact application work

Status: confirmed containment principle; concurrent-application and multiple-Action-Plan policy remains partial.

- A long-lived case may contain applicationless imported/manual history and artifacts from several applications. Their continued presence is not itself an integrity defect.
- When an operation has an exact selected application and, where required, an exact Action Plan, PATH must read and mutate only that operation's ownership lineage. An unrelated applicationless, sibling-application, or sibling-plan record may remain visible history but must not block or be changed by the operation.
- A populated typed owner is authoritative. Legacy embedded metadata is a fallback only when the typed owner is absent; metadata may confirm but may not override a populated typed owner.
- A contradiction in the exact selected version or owner may block that consequential form generation/signing operation. It must not lock the whole case, ordinary messaging, or independent sibling work.
- Case-owned version series and their numbering remain continuous. Version ownership narrows mutation and signing scope without splitting the case history into invented per-application series.
- A missing Action Plan is a workflow prerequisite and multiple eligible plans require explicit selection. Neither condition should be described as general data corruption. This decision does not settle when additional or concurrent plans are permitted.

#### 2026-08-25 bug policy brief — Feedback 196 applicationless CFA veto

- Reported path and actor: a Regional Manager used the approved application's communication step to send its decision/funding package.
- Exact scope and states: case `76`, approved application `123`, application-owned Action Plan `184`, and the new CFA/Financial Overview/message/signing artifacts. Older applicationless Action Plan `3` and sent CFA version `19` are unrelated retained history.
- Failure: a case-wide unsigned-version guard stopped the application-backed send with `cfa_version_application_scope_unknown`, despite the selected application's ownership being known.
- Permitted result: create and send the next case-series version from the exact selected plan, preserve continuous numbering and the read-only latest-signed baseline, and leave unrelated history untouched.
- Forbidden result: infer an owner for the old CFA, cancel or withdraw it as a side effect, reuse it as the new application's draft, split the case series, or block ordinary secure messaging.
- Detailed behavior and the required Regional Manager DEV/TEST scenario matrix are recorded in `docs/ops/feedback-196-applicationless-signing-lineage.md`.

### `WP-13-D1` — Business reopen authority is not technical support authority

Status: confirmed principle; reopen-versus-new-episode boundary remains unresolved.

- If policy permits reopening a closed Action Plan or intervention, an authorized Regional Manager or NWAC Administrator must be able to perform the business action under the applicable reason, conflict, dependency, reporting-reset, and audit safeguards.
- System Administration may support technical recovery but must not be the mandatory business actor merely because the current control was implemented there first.
- This principle does not decide whether changed circumstances should reopen the old service episode or create a new Action Plan/intervention. That choice must preserve service history and reporting meaning.

### `WP-06-D1` — Operation-specific, risk-proportionate controls

Status: confirmed principle; artifact/action matrix remains partial.

- PATH must not use “not explicitly allowed” as the default rule for ordinary business operations within an already authorized record scope.
- Security/privacy access, irreversible or destructive changes, authoritative evidence, ownership, money, final decisions, and external communications justify explicit fail-closed controls.
- Reversible and separable actions should remain available unless the system can identify a concrete dependency or harm. Examples include staff-facing display-title changes, notes, reminders, unrelated uploads, and other work that does not alter protected content, ownership, decision facts, signatures, or external effects.
- A guard must name the exact protected fact and unsafe operation. Unknown provenance or an outstanding applicant task may narrow destructive or dependent actions, but must not become a whole-record lock.
- Queue and UI language must describe the specific outstanding applicant requirement and any affected action; it must not imply that staff are generally unable to work on the record.

### `WP-06-D2` — Supporting-document details remain staff-editable

Status: confirmed principle; destructive-operation policy remains partial.

- Staff who already have access to a document may edit its display title and document classification regardless of whether it arrived through an application, secure message, staff upload, legacy intake, or PATH generation. Classification is staff-maintained operational metadata and may intentionally affect checklist presentation.
- Editing details must not replace or rewrite the stored file, checksum, source, originating message, signing request, uploader, or other provenance facts.
- A source-bound document retains its existing client/case/application ownership. A staff-managed upload may be reorganized only into another target that passes the existing access, ownership, and relationship checks.
- Changing Action Plan or intervention organization remains available for ordinary evidence. It is blocked only when a concrete signing-request, version, or payment dependency makes reassignment unsafe; the title and classification remain editable in that circumstance.
- Invalid or inactive document types, inaccessible targets, client/case/application mismatches, malformed relationships, and concurrent edits continue to fail closed.
- Duplicate and delete are separate, higher-risk operations. This decision does not relax their source/dependency integrity controls; the bounded delete/restore policy is recorded in `WP-06-D3`.

### `WP-06-D3` — Supporting-document Delete is reversible hiding only

Status: confirmed principle; applicant-upload extension confirmed 2026-08-28.

- For an eligible staff upload or applicant-uploaded application-submission document, `Delete` means hide it from normal Supporting Documents lists, checklist matching, and other active-only processes. The database row and stored file remain intact.
- All four PATH roles may use Delete only within their existing object/case scope. Deleting an applicant upload does not rewrite the submitted application or authorize duplication. The normal dependency guards still protect signing-request uploads, signed/generated documents, secure-message attachments, version evidence, payment evidence, legacy/unknown sources, and other authoritative records.
- Delete does not undo a submission, signature, approval, payment, message, or any other business event.
- Only System Administrator can see the Deleted view, open or download a deleted file, and restore it. Restore returns the same document to active use after PATH verifies the stored object still exists and matches the recorded identity information.
- PATH has no permanent-delete UI or API for supporting documents, including manual uploads. Any exceptional physical removal is a separately reviewed database/storage operation outside the product workflow.
- Older rows already carrying `status='deleted'` without lifecycle provenance are not assumed to be user deletions and do not automatically appear in the Deleted view.
- Release gate: newer admin uploads carry verified `path-sha256` object metadata, but older manual-upload objects may not. The feature must not promise reversible deletion for an object that Restore cannot verify. Before rollout, choose and test either a Delete-time object-identity preflight with a plain legacy-file refusal, or a reviewed full-object checksum fallback for metadata-less files.
- Release gate: an assessment or intervention decision must not commit based on a manual document that is archived concurrently. Every decision-time active-document prerequisite must be locked and rechecked within the same transaction that records the decision.
- Release gate: removing a visible payment evidence link must not make a document deletable when a finance transaction still retains that document as evidence. New unlink/packet/line operations can fail closed once normalized transaction history exists. Existing stale history requires an additive normalized finance-transaction/document history table plus a live-schema-guarded inventory and backfill if PATH is to guarantee complete protection.
- A presigned file URL issued before Delete remains usable until its short expiry. Reversible hiding prevents new ordinary-user access; it cannot revoke a URL or downloaded copy already given to an authorized user.

#### 2026-08-18 bug policy brief — secure-message document classification

- Reported path: an ISET Coordinator used Supporting Documents > Edit document details for an incoming secure-message attachment; inline title editing and direct `PUT /api/documents/:id` callers share the same API boundary.
- Affected scope and actors: any authorized staff role managing documents in Application Workspace or Case Workspace; the document may be client-, case-, application-, Action-Plan-, or intervention-organized.
- Permitted operations: title correction, active document-type classification, and safe organization inside the already authorized client/case lineage.
- Forbidden operations: changing source-owned client/case/application provenance or reassigning a document whose signing, version, or payment dependency requires its current attachment.
- Downstream effects: classification may update document checklists and where evidence is displayed; it must not change file bytes, message history, signing/version evidence, payment evidence, or sibling-application ownership.
- Required regression matrix: application submission, secure-message attachment, manual upload, system-generated and unknown sources; title-only, type-only, same-owner organization, cross-owner attempt, signing/version/payment dependency, unauthorized target, stale update, duplicate, and delete.

## Initial Discussion Order

The recommended sequence is:

1. `WP-01` — authority among overlapping state machines;
2. `WP-02` — actor identity and acting capacity;
3. `WP-05` — corrections, reversals, and retractions;
4. `WP-03` / `WP-09` — entity scope and repeat applications;
5. `WP-06` — dependency consequences and authoritative evidence;
6. then the domain-specific areas in dependency order.

This order starts with rules that affect almost every later answer. Each discussion should settle one bounded policy question, record the answer in this register or its canonical domain plan, and identify the scenario tests that future fixes must preserve.

## Current Evidence Base

- `docs/planning/client-case-application-target-model.md`
- `docs/planning/status-architecture-overhaul.md`
- `docs/planning/rm-two-step-review-workflow.md`
- `docs/planning/staff-record-correction-controls-proposal-email.md`
- `docs/ops/deployments/major-workflow-release-management.md`
- `docs/workflows/admin/`
- `docs/training/TRAINING_MODULES_September_2025_extracted.md`
- `../ISET-intake/docs/portal/`
- the live PROD feedback register and its internal investigation notes

These sources establish useful facts and current intent, but this register must remain explicit about where they do not yet form a complete approved business contract.
