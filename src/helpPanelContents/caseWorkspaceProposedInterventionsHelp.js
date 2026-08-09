import React from "react";

const CaseWorkspaceProposedInterventionsHelp = () => (
  <div>
    <p>
      Use this workflow to propose a new intervention or a change to an approved intervention. The
      request moves through Regional Manager review before a Decision Maker records the final outcome.
    </p>

    <h3>Prepare the request</h3>
    <ul>
      <li>Link the request to the correct Action Plan and the participant&apos;s employment goal.</li>
      <li>Record realistic dates, supports, expected outcomes, and a clear rationale.</li>
      <li>Make every cost line understandable and tied to the intervention or a barrier it addresses.</li>
      <li>Record each outside funder as confirmed, pending, denied, or unknown, and state what NWAC will cover.</li>
      <li>Capture payee details when known. Student Loan Repayment lines need the provider or servicer and account number for the lender letter.</li>
      <li>Keep the proposal, documents, dates, and amounts consistent.</li>
    </ul>

    <h3>Two-step review</h3>
    <ol>
      <li><strong>Submit for review</strong> sends the read-only request to the Regional Manager&apos;s <strong>Pending Review</strong> queue.</li>
      <li>The Regional Manager returns it to the recorded submitter with a required note or selects <strong>Submit for final decision</strong>.</li>
      <li>The Decision Maker approves, denies, or requests changes from <strong>Pending Decision</strong>.</li>
      <li>A Decision Maker request goes back to the Regional Manager first. The Regional Manager then selects <strong>Forward changes to submitter</strong> with a note.</li>
      <li>The original submitter corrects and resubmits. The request must pass Regional Manager review again before returning for final decision.</li>
    </ol>
    <p>
      The proposal body is read-only while it is with either reviewer. Only the recorded submitter
      edits returned work. Regional Managers review and sign off; they do not record final decisions.
    </p>

    <h3>EI status and funding stream</h3>
    <ul>
      <li>The submitter may send a new proposal or change to Regional Manager review before the final EI result is recorded.</li>
      <li>The Decision Maker cannot approve until the EI status is selected or confirmed.</li>
      <li><strong>CRF</strong> requires a CRF Action Plan funding stream. <strong>EI Active Claim</strong> and <strong>EI Reach Back</strong> require an EI stream.</li>
      <li>A revision may prefill EI from the same parent Action Plan. The Decision Maker must still check that it is current and correct.</li>
      <li>PATH blocks approval when the verified EI result and Action Plan funding stream do not match. Resolve the facts or funding setup; do not change EI merely to fit a budget pot.</li>
      <li>The EI document upload is separate from the required status. Follow the signed-consent, verification, and document-retention requirements even when the upload control is labelled optional.</li>
    </ul>

    <h3>After the final decision</h3>
    <ul>
      <li>Approval or denial is recorded before any client letter is prepared or sent.</li>
      <li>An approval with funded cost lines sends the client approval letter with the exact Action Plan&apos;s Client Funding Agreement and EFT/Wire Transfer form.</li>
      <li>An approved intervention change uses the appropriate revised CFA, including a red-line agreement where required.</li>
      <li>A zero-funding approval sends no CFA package. A denial or request for changes does not start CFA signing.</li>
      <li>The participant signs the CFA in the public portal. CFA signing is post-approval document work, not another review decision.</li>
      <li>Use the Interventions table or <strong>Start new proposal</strong> when you are ready to begin separate work.</li>
    </ul>
  </div>
);

CaseWorkspaceProposedInterventionsHelp.aiContext = `You are assisting PATH staff using the Proposed Interventions widget in Case Workspace. Give role-aware, practical guidance for new intervention proposals and intervention changes.

Preparation guidance:
- Tie the intervention to the employment goal and correct Action Plan; capture rationale, dates, supports, outcomes, cost lines, other funding, and payee details.
- Student Loan Repayment lines need the provider/servicer and account number so PATH can prepare the lender letter.

Two-step review rules:
- Submit for review sends the read-only request to Regional Manager Pending Review.
- The Regional Manager returns it to the recorded submitter with a required note or submits it for final decision. Regional Managers do not record final decisions.
- The Decision Maker approves, denies, or requests changes from Pending Decision.
- Decision Maker-requested changes return to the Regional Manager first. The RM forwards them with a note to the original submitter, who corrects and resubmits through RM review again.
- Only the recorded submitter edits returned work; the packet remains read-only at RM review, final-decision review, and returned-to-RM.

EI rules:
- Do not tell users EI verification must be completed before submitting a proposal for RM review. The live flow permits review submission first, but final approval is blocked until EI status is selected or confirmed.
- CRF maps to the CRF Action Plan stream; EI Active Claim and EI Reach Back map to EI. A revision may prefill from the same parent Action Plan, but the Decision Maker must verify it.
- PATH blocks approval if EI status and Action Plan funding stream conflict. Never advise changing verified EI merely to fit a budget pot.
- The decision-screen EI upload is separate from the mandatory status. Even if the upload control says Optional, remind staff to follow signed-consent, verification, and evidence-retention requirements.

CFA rules:
- The Decision Maker records final approval before letter or CFA follow-up.
    - When funded cost lines exist, Send client approval letter includes the exact Action Plan's Client Funding Agreement and EFT/Wire Transfer form. A revision uses the applicable revised/red-line CFA.
- Zero-funding approvals have no CFA package; denials and requested changes do not start CFA signing.
- CFA signing is participant post-approval document work, not an additional approval stage and not a review-queue status.

Keep language user-facing and do not describe implementation details.`;

export default CaseWorkspaceProposedInterventionsHelp;
