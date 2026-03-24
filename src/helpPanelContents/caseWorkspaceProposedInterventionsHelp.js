import React from "react";

const CaseWorkspaceProposedInterventionsHelp = () => (
  <div>
    <p>
      Use this workflow to propose new interventions for a current PATH participant. Each intervention should be tied to
      the client&apos;s employability goal, have clear start/end dates, and explain how it improves employment outcomes.
    </p>

    <h3>What makes a strong intervention</h3>
    <ul>
      <li>Clear goal: what the client will achieve and how it links to employment.</li>
      <li>Timeframe: realistic start/end dates and key milestones.</li>
      <li>Supports: required training, equipment, childcare, or other supports tied to participation.</li>
      <li>Outcome: expected credential, skill gain, or job pathway.</li>
    </ul>

    <h3>Multiple interventions</h3>
    <ul>
      <li>Each intervention needs its own rationale, timeframe, and expected impact.</li>
      <li>Explain why an additional intervention is required (changed labour market, gaps remaining, new pathway).</li>
    </ul>

    <h3>Funding stream reminders</h3>
    <ul>
      <li>Individual Training Purchase: confirm the institution is recognized and the credential leads to real jobs.</li>
      <li>Targeted Wage Subsidy: collect employer documents and record the wage subsidy math.</li>
      <li>Job Creation Partnership: public/non-profit only and must benefit the community.</li>
      <li>Self-Employment Benefits: include a business plan outline and professional supports.</li>
      <li>Group training: document sponsor capacity and supervision plan.</li>
    </ul>

    <h3>Documentation and compliance</h3>
    <ul>
      <li>Record research that supports the intervention choice (labour demand, credential requirements, wage range).</li>
      <li>Costs must tie directly to the intervention or a barrier the intervention addresses.</li>
      <li>Use the Other funding step to mark whether outside funding exists, list each non-NWAC funder, and state what NWAC will cover.</li>
      <li>Capture payee details while adding/editing cost lines when known; missing payee can be completed later in payment review.</li>
      <li>For Student Loan Repayment lines, enter the loan provider/servicer name and loan account number so the approval-letter pack can generate the lender letter.</li>
      <li>Keep dates, costs, and program details consistent across documents and the case file.</li>
      <li>EI verification is required for approvals; attach the required document before submitting.</li>
    </ul>

    <h3>After final decision</h3>
    <ul>
      <li>Submitted proposals and submitted revisions can still be updated by casework roles if supporting details or cost lines need correction before final approval.</li>
      <li>Only approver roles record the final decision on a submitted proposal or revision.</li>
      <li>When a proposal is approved or rejected, the widget shows a completion note instead of jumping back to Step 1.</li>
      <li>Use the Interventions table or the "Start new proposal" action to begin a new proposal when ready.</li>
    </ul>
  </div>
);

CaseWorkspaceProposedInterventionsHelp.aiContext = `You are assisting PATH case managers using the Proposed Interventions widget in the Case Workspace. Focus on user guidance: define what a good intervention looks like (goal, timeframe, supports, employment outcome), stress that multiple interventions each need their own rationale and expected impact, and reference the PATH training content for funding streams (ITP, TWS, JCP, SEB, group training). Remind users to document research, use the Other funding step to capture involved yes/no/unknown plus each non-NWAC funder and NWAC coverage, capture payee details in cost-line modals when known, enter loan provider plus loan account number for Student Loan Repayment lines, keep dates/costs consistent in the file, and attach EI verification before approval. Explain that submitted proposals and revisions can still be updated by casework roles when content needs correction, but only approver roles record the final decision. Explain that after a final approval/rejection decision the widget shows a completion note (rather than restarting at Step 1), and users can start again from the Interventions table or the "Start new proposal" action. Keep language practical and user-facing, not implementation details.`;

export default CaseWorkspaceProposedInterventionsHelp;
