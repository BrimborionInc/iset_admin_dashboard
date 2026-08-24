# Proposal Email: Greater Staff Control to Correct PATH Records

Status: Partially approved; minor reviewer edits and dependency-free accidental reversals confirmed
Prepared: 2026-07-31
Revised: 2026-08-18

## Workstream status

Bill relayed the client response on 2026-08-18: allow reviewers to make the minor assessment corrections described in section 1. This approves tracked, non-substantive reviewer edits while preserving the originally submitted wording. It does not authorize a reviewer to change eligibility, requested or approved funding, costs, supporting-document requirements, applicant-provided facts, the recommendation, evidence, or anything requiring new information or professional judgement; those changes still use the return-to-submitter path. The remaining correction and reversal proposals below are not approved by this response and retain their policy gates.

The evidence-based workflow review on 2026-08-18 also confirmed the section 2 boundary: an authorized reviewer may reverse their own accidental workflow decision when no consequential action has relied on it, provided they give a reason and PATH preserves the original decision and full history. Once a letter, signature, payment, reporting submission, or other downstream action exists, reversal requires separate authorization and explicit recovery of those dependencies. The same dependency-free, audit-preserving principle permits retraction rather than deletion of an erroneous historical entry. Whether a validly closed service episode should ever reopen because circumstances later change remains unsettled.

The consequential-reversal authority was then settled as follows. Another NWAC Administrator acting as a Decision Maker must confirm the reversal and dependency-recovery plan; the person authorized for the replacement outcome records the new decision. The existing high-value rule remains intact, so Shelley Stacey must record an approval of `$20,000` or more even when another NWAC Administrator confirmed the reversal. Finance, reporting, signing, and communication owners confirm or perform recovery in their own domains but do not acquire program-decision authority. A System Administrator may execute a necessary technical recovery but is not the business authorizer.

The same role principle exposes a current inconsistency in section 3: PATH's controlled closed-plan reopen is currently System-Administrator-only even though reopening for business reasons is an operational decision. Wherever policy permits a reopen, an authorized Regional Manager or NWAC Administrator must be able to initiate it under the same reason, conflict, dependency, reporting-reset, and audit safeguards; System Administration must not be the mandatory business intermediary. The separate question of when to reopen the old service episode rather than create a new one remains unresolved.

NWAC management direction confirmed by Bill on 2026-08-05: when an error found after assessment submission requires the assessment or approved funding amounts to change, the preferred correction is for the Regional Manager to return the assessment to the submitter. That path must preserve the return reason, submitter edit, resubmission, and renewed review/decision history. If the assessment's current state has no supported return transition, a System Administrator may exceptionally change status or directly repair the record, but that is a technical recovery path rather than the target business workflow and is disfavoured because it does not produce the normal business audit trail. A missing post-decision return transition is therefore a workflow gap; it is not justification for direct coordinator editing of finally decided assessments.

Recent feedback work provides implementation evidence for this proposal, but only a few narrow controls are already delivered:

| Related feedback | Proposal area | Current position |
| --- | --- | --- |
| `#157` | Limited post-submission corrections | A dependency-gated EI-status correction control is deployed and the report is resolved. This is one delivered example, not a general post-submission edit framework. |
| `#154` | Communication mistakes | Plain staff-to-applicant messages now have recipient safeguards and an audit-preserving withdrawal path; the report is resolved. Messages with linked files or signing requests remain outside the simple withdrawal path. |
| `#166` | Document withdrawal/restoration | The signed Financial Overview was recovered and preservation guards were deployed; the report is resolved. This was a targeted recovery/prevention fix, not general document-correction authority. |
| `#168` and `#170` | Returned assessment editing | The exact workflow submitter can edit an assessment returned to them even when they also hold the Regional Manager role. Release `20260801-returned-assessment-edit` passed the complete TEST acceptance gate, was deployed to PROD on 2026-08-02, and both reports are resolved. This supports the existing return-to-submitter workflow; it does not let a reviewer directly make minor edits. |
| `#169` and `#172` | Accidental workflow decisions | The two accidental denials were repaired and the reports are resolved. PATH still lacks a staff self-service decision-reversal control. |
| `#175` | Incorrect historical entries | The dependency-free accidental manual-backload entry was removed and the report is resolved. PATH still lacks an audit-preserving staff retraction control for this class of mistake. |
| `#165` | Action-plan corrections | The affected record was repaired and the report is resolved. The repair is evidence for the need; it did not add general self-service action-plan correction controls. |
| `#173` | Generated-document/workflow correction | The targeted repair and prevention work are complete, but the corrected CFA draft still requires staff review and sending. This does not add general correction authority. |
| `#178` | Post-decision assessment/funding correction | A guarded System Administrator recovery restored the affected approved assessment to Regional Manager review and withdrew its unsigned generated plan/CFA artifacts. Derry must now use the normal Return to Coordinator action, after which Danielle can correct/resubmit and Madison can record the renewed decision. The report remains in progress, and the exceptional repair does not add a general post-decision return or staff correction control. |

Next gate: turn the approved minor-edit and reversal policies into an explicit implementation matrix, while separately resolving the remaining correction proposals and exact dependency-recovery operations. Only approved controls should be designed and scheduled for implementation.

The proposal sent for review follows.

**Subject: Proposal: Controlled Corrections and Reversals in PATH**

Hi Émilie, Madison and Shelley,

Following Émilie’s suggestion about allowing reviewers to make minor edits to assessments, I have considered how we could give Regional Managers and NWAC Administrators greater ability to correct records and recover from common mistakes across PATH.

My overall recommendation is that PATH should allow authorized staff to correct routine errors themselves, while retaining stronger controls where a change could affect eligibility, funding, documents, reporting or communication with a participant.

The aim would not be to remove the current workflows. Returning work to a Coordinator would remain the correct approach where more information, supporting documentation or substantive reconsideration is required. The proposed change is to avoid unnecessary back-and-forth or technical intervention where the responsible manager can safely make or authorize the correction.

I suggest organizing these abilities into three levels:

1. **Routine corrections** that an authorized Regional Manager or NWAC Administrator can make directly.
2. **Controlled reversals** that require a reason and additional checks before PATH allows them.
3. **High-impact corrections** that continue to require escalation because other records or communications have already relied on the original action.

The detailed proposals are below.

## 1. Minor assessment edits during review

Regional Managers and NWAC Administrators reviewing an assessment could make minor corrections without returning it to the Coordinator.

This could include:

- spelling, grammar and wording;
- improving the clarity of a written explanation;
- correcting an obvious typographical error; and
- other changes that do not alter the substance of the assessment.

PATH would record the reviewer’s change and retain the originally submitted wording.

The assessment would still be returned to the Coordinator where a change affects eligibility, requested funding, costs, supporting-document requirements, applicant-provided information, the recommendation, or anything requiring additional information or professional judgement from the Coordinator.

## 2. Correcting an accidental workflow decision

Authorized staff could correct an approval, denial or request-for-changes action selected by mistake.

For example, if a reviewer selects **Deny funding** when they intended to select **Request changes**, PATH could allow the decision to be corrected and return the assessment to the appropriate review stage.

The correction would require a reason. The original action would remain in the history rather than disappearing.

PATH could allow a straightforward reversal where no decision letter, signed agreement, payment, reporting submission or other consequential action has followed. If the decision has already been communicated or relied upon, the correction would move into the high-impact category and require additional authorization.

## 3. Correcting action plans and interventions

Regional Managers could be allowed to correct an action plan or intervention entered incorrectly, provided that later activity does not depend on it.

This could include:

- correcting an incomplete historical entry;
- retracting an historical intervention entered in error;
- correcting limited details that do not change an approved funding decision; and
- reopening a closed action plan or intervention where circumstances have changed and an amendment is required.

Where an entry was created in error, it should be marked as retracted rather than permanently erased. PATH would keep the original entry in the history while removing it from current operational work.

Changes affecting approved funding, payments, participant reporting or signed agreements would require stronger authorization or escalation.

## 4. Limited corrections after submission

Regional Managers could be allowed to correct an agreed set of structured information after an assessment has been submitted. EI status is one example, but the same principle may apply to other factual fields.

The correction could proceed while the information has not yet been used in an active action plan, intervention, payment or reporting submission. Once another part of the process depends on it, PATH would either block the correction or require a more formal review.

This would avoid staff having to reassign a file or ask for technical assistance simply to correct information they are otherwise authorized to manage.

## 5. Withdrawing and replacing documents

Authorized staff could have clearer controls to:

- withdraw or supersede an incorrect document;
- cancel an outstanding unsigned request;
- restore a valid document archived by mistake; and
- issue a corrected version.

The original document would remain in the history, clearly marked as withdrawn or superseded. Signed documents and documents already used for payments or reporting would receive stronger protection.

## 6. Correcting communication mistakes

If a message is sent in error, authorized staff should be able to withdraw it from PATH as quickly as possible. PATH would make clear that withdrawal cannot guarantee recall if the recipient has already read the message or received an email notification.

Because this can involve privacy concerns, the withdrawal and its reason would be retained in a restricted audit history, with an escalation process where information has already been disclosed.

## Proposed safeguards

I recommend applying the following safeguards across all correction and reversal actions:

- access based on the staff member’s role and responsibility for the file;
- a reason for material corrections and all reversals;
- preservation of the original information;
- a clear record of who changed what, when and why;
- automatic checks for related approvals, documents, payments and reporting activity;
- clear notification to other staff where a correction changes their next action; and
- escalation where a correction has consequences that PATH cannot safely reverse automatically.

## Recommended first phase

I recommend beginning with:

1. minor assessment edits during review;
2. correction of an accidental approval, denial or request-for-changes action;
3. correction or retraction of dependency-free historical entries; and
4. Regional Manager access to the existing controlled process for reopening a closed action plan or intervention.

These changes would address the most common operational difficulties while keeping the initial policy boundary manageable. We could then review how the controls are being used before extending them to documents, communications and other post-submission corrections.

The main policy decisions for NWAC are:

- which roles should receive each ability;
- where to draw the line between a minor correction and a substantive change;
- which reversals should require confirmation by a second person; and
- which consequences should make a correction ineligible for staff self-service.

If NWAC agrees with this direction, I can turn it into a more detailed permissions and workflow proposal for review before any changes are made to PATH.

B.
