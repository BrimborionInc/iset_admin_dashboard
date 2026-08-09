# Two-Step Review: Upward Approval and Downward Changes

Status: Live staff guide for application assessments, new intervention proposals, and intervention changes.
Last Updated: 2026-08-08

## Purpose

PATH uses two separate review levels before a final program decision is recorded:

1. a **Regional Manager review**; then
2. a **Decision Maker final decision**.

This guide explains who owns the work at each stage, how an item moves upward for approval or downward for changes, where Employment Insurance (EI) checks fit, and when a Client Funding Agreement (CFA) is created and signed.

## Roles

| Role | Main responsibility |
| --- | --- |
| **Submitter** | Completes the assessment or proposal and submits it for review. Usually this is an ISET Coordinator. A Regional Manager may also be the submitter for their own draft work. |
| **Regional Manager** | Performs the first review, returns incomplete work, or signs it off and submits it for final decision. A Regional Manager does not record the final approval or denial. |
| **Decision Maker** | Records the final approval, denial, or request for changes. In PATH this is the NWAC Administrator system role. |
| **System Administrator** | Provides technical support. This is not a normal business-review role and should not be used to bypass the workflow. |

## The Complete Flow

```text
Submitter prepares item
        |
        | Submit for review
        v
Regional Manager — Pending Review
        |                         |
        | Return to submitter     | Submit for final decision
        v                         v
Submitter corrects          Decision Maker — Pending Decision
and resubmits                     |          |              |
        |                          | Approve  | Deny         | Request changes
        +--------------------------+          |              v
                                               Final      Regional Manager
                                               outcome    reviews request
                                                             |
                                                             | Forward changes
                                                             v
                                                        Original submitter
                                                        corrects and resubmits
```

The central rule is simple: **work goes up one level at a time and comes down one level at a time**. The submitter cannot send directly to the Decision Maker, and a Decision Maker's requested changes do not go directly to the submitter.

## Moving Up for Approval

### 1. Submitter to Regional Manager

The submitter selects **Submit for review**. PATH then:

- makes the submitted assessment or proposal read-only;
- places it in the Regional Manager's **Pending Review** queue; and
- preserves who submitted it, because only that submitter can edit it if it is returned.

Where PATH shows a **Recall** action, it is available only while the item is still with the Regional Manager and before Regional Manager sign-off. Recall availability varies by request type and submitter role. Once an item has been submitted for final decision, any correction must come back through the review workflow.

### 2. Regional Manager to Decision Maker

The Regional Manager opens the item from **Pending Review**, reviews the complete packet, and chooses:

- **Return to Coordinator** or **Return to submitter** when changes are required. A clear return note is required.
- **Submit for final decision** when the packet is ready. The Regional Manager may add a review note, and PATH records the sign-off.

The Regional Manager reviews the submitted facts but does not directly rewrite the submitted assessment or proposal. Reviewer-only controls, such as the application assessment's EI status and verification upload, remain separate from editing the submitted packet.

### 3. Decision Maker records the final decision

The Decision Maker opens the item from **Pending Decision**. The decision screen shows the submitter's recommendation and rationale together with the Regional Manager sign-off and note.

The Decision Maker chooses:

- **Approve**;
- **Deny**; or
- **Request changes**.

A denial or request for changes requires a note. Funding approvals of **$20,000 or more** can be approved only by Shelley Stacey. Other Decision Makers may still deny the request or request changes.

## Moving Down for Changes

There are two different downward paths. They should not be confused.

### Regional Manager requests changes

The Regional Manager selects **Return to Coordinator** or **Return to submitter** and explains what must change. PATH returns the item directly to the original submitter.

The original submitter:

1. reads the return note;
2. edits the returned item;
3. saves any required evidence or corrections; and
4. selects **Resubmit for review**.

The item returns to the Regional Manager's **Pending Review** queue. It does not skip directly to the Decision Maker.

### Decision Maker requests changes

The Decision Maker's **Request changes** action sends the item back to the Regional Manager first. At this stage the packet remains read-only.

The Regional Manager:

1. reviews the Decision Maker's note;
2. adds any useful Regional Manager context; and
3. selects **Forward changes to Coordinator** or **Forward changes to submitter**.

The original submitter then sees both notes, makes the correction, and resubmits. The corrected item must pass Regional Manager review again before returning to the Decision Maker.

If the Regional Manager was also the original submitter, the item returns to that person in their **submitter** capacity. They edit and resubmit it, then complete the Regional Manager sign-off as a separate workflow action.

### Reopened items that already had a final decision

An exceptionally reopened, finally decided application assessment must first be returned to its original submitter for a real correction. PATH blocks the Regional Manager from simply sending the unchanged assessment upward for another final decision. After the submitter corrects and resubmits it, the normal Regional Manager and Decision Maker stages apply again.

## Editing and Notes Rules

- A draft is editable by its submitter.
- A submitted packet is read-only while it is with the Regional Manager or Decision Maker.
- An item returned by the Regional Manager or forwarded down after a Decision Maker request is editable only by the recorded original submitter.
- A different Regional Manager cannot take over the returned submitter's editing rights merely because they can see the case.
- A return note is required when the Regional Manager sends work back.
- A Decision Maker note is required for denial or requested changes.
- A Regional Manager forwarding note is required when passing Decision Maker changes to the submitter.
- Review and decision notes are retained in the workflow record and are also made available in the case audit context, including Notes and Tasks where applicable.

## EI Status and Verification Rules

EI eligibility and review ownership are separate. An EI status does not decide whether an item belongs in **Pending Review** or **Pending Decision**; the current review stage does that.

PATH uses three EI status choices:

| EI status | Funding stream used by PATH |
| --- | --- |
| **CRF** | CRF |
| **EI Active Claim** | EI |
| **EI Reach Back** | EI |

Select the status from the verified result. Do not infer it from the participant's circumstances or choose a status merely to match an available budget pot.

### Before verification

Program guidance requires a signed **Client Consent for EI Verification** before an EI verification request is made. The consent and verification evidence should remain on the client file so the funding-stream decision is auditable.

### Application assessments

- An EI status is required before the assessment can move forward for review.
- ISET Coordinators can see the status but cannot set it in the Application Assessment. Authorized staff—Regional Managers, Decision Makers, or System Administrators—set the status and upload the verification report.
- During Regional Manager review, the assessment body remains read-only, but the Regional Manager may still complete or correct the EI status and upload verification evidence.
- When a returned assessment keeps the already accepted EI status unchanged, PATH preserves that status and does not demand a newly retrofitted verification document solely because another part of the assessment was returned.
- If the EI status is changed during a returned correction, supporting EI verification evidence must be present before the changed status can be saved.

### New intervention proposals and intervention changes

- The submitter may submit a new intervention proposal or change for Regional Manager review before the final EI result is recorded.
- The Decision Maker cannot **approve** it until the EI status is selected or confirmed.
- For a revision, PATH may prefill a blank EI value from the same parent Action Plan. The Decision Maker must still check that the value is current and correct.
- The EI result determines the required Action Plan funding stream: CRF maps to CRF; both EI statuses map to EI.
- PATH blocks approval when the selected EI status and the Action Plan funding stream do not match. Correct the EI result or the Action Plan funding setup based on the verified facts; do not force one to match the other without evidence.
- The intervention decision screen treats the EI verification-document upload separately from the required status. Even where the upload control is shown as optional, staff must still follow the consent, verification, and document-retention requirements for the file.

## Client Funding Agreement Rules

The **Client Funding Agreement (CFA) is post-approval work**. It is not the Regional Manager sign-off, it is not the Decision Maker's approval, and it does not control which review queue owns the item.

### When PATH creates or sends a CFA

- The Decision Maker must first record an approval.
- If the approved application or intervention contains funded cost lines, the client approval-letter send includes the applicable CFA and EFT/Wire Transfer form for the participant to complete.
- If the approval contains no funded cost lines, PATH sends the approval letter without a CFA or funding forms.
- A denied item or an item returned for changes does not start CFA signing.

### Which CFA is used

- The CFA must belong to the exact approved application, Action Plan, interventions, and version being sent.
- A repeat application must use its own application-linked Action Plan and CFA. An older application or historical plan must not supply the new application's agreement.
- An approved intervention change creates the appropriate new or revised CFA version. The participant receives the revised agreement, including the red-line version where the workflow requires it.
- Never reuse an older signed CFA to complete a newer application or intervention change.

### After the CFA is sent

- The participant reviews and signs the CFA through the public portal.
- PATH keeps the signing request, secure message, application, agreement version, and signed document linked together.
- Where the application approval checklist requires funding forms, the application is not complete until the required CFA and related forms are submitted and the checklist is complete.
- CFA signing is its own document process. It must not move an assessment between Regional Manager and Decision Maker queues or overwrite a returned-for-changes stage.

## Queue and Action Quick Reference

| What the user sees | Who acts next | Main action |
| --- | --- | --- |
| Draft or returned work in the workspace | Original submitter | Edit, save, then **Submit/Resubmit for review** |
| **Pending Review** | Regional Manager | **Return to submitter** or **Submit for final decision** |
| **Pending Decision** | Decision Maker | **Approve**, **Deny**, or **Request changes** |
| Decision Maker changes returned to **Pending Review** | Regional Manager | **Forward changes to submitter** |
| Final approval recorded | Post-decision follow-up owner | Prepare/send approval letter and, when funded, the CFA and funding forms |

## Common Mistakes to Avoid

- Do not treat **Pending Review** as final approval authority for the Regional Manager.
- Do not send Decision Maker changes directly to the submitter; they return through the Regional Manager.
- Do not edit the packet while it is under review. Return it to the recorded submitter.
- Do not confuse EI status with review status. EI controls funding-stream eligibility; the review stage controls ownership and queues.
- Do not select an EI status simply to fit the Action Plan's existing budget stream.
- Do not prepare or send a CFA before final approval.
- Do not attach an older application's CFA to a repeat application.
- Do not mark funded approval follow-up complete until the required forms and signatures are complete.

## If Someone Is Away

PATH does not currently provide automatic vacation or delegate routing. Another Regional Manager with the correct regional access may complete Regional Manager review. If the returned item belongs to an unavailable original submitter, ask a System Administrator for assistance rather than informally editing under another person's workflow ownership.

## Final Records

Final assessment and proposal records preserve the submitter evidence, Regional Manager review/sign-off, and Decision Maker decision/sign-off. The CFA and signed funding forms are separate post-approval documents linked to the exact approved application or intervention version.
