import React from 'react';

const ApplicationAssessmentHelp = () => (
  <div>
    <h2>Coordinator assessment workflow</h2>
    <p>
      Use this form to document the coordinator&apos;s review, confirm eligibility, and capture the funding recommendation.
      Required fields must be completed before you can submit for NWAC review. Editing requires an assessment lock; if
      the case is approved/rejected or locked by another user, editing is blocked.
    </p>

    <h3>Before you start</h3>
    <ul>
      <li>Review the <strong>ISET Application Form</strong> widget to gather the applicant&apos;s background, requested
        supports, and prior funding history.</li>
      <li>Check <strong>Supporting Documents</strong> for mandatory evidence from the training module: Status/Treaty card or two Nation letters plus self-declaration, two IDs, acceptance letter, fee statement, band denial (if applicable), and income/expense proofs for living allowance.</li>
      <li>Confirm the case status in <strong>Application Overview</strong>; if it is pending approval, approved, rejected, or locked by another user you may have limited edit access.</li>
    </ul>

    <h3>Completing the form</h3>
    <ol>
      <li>Open <em>Edit</em>, confirm to acquire the lock, then populate the <strong>assessment overview</strong> and <strong>employment goals</strong> with a concise summary of the client situation.</li>
      <li>Record <strong>barriers</strong>, <strong>local priorities</strong>, and <strong>other funding</strong> (band try-first rule, EI/CRF stream, other sponsors) to justify need.</li>
      <li>Use <strong>Intervention Details</strong> to capture timelines, provider, program name, NOC code/version (if required), childcare needs, and cost breakdowns (ITP and/or Targeted Wage Subsidy fields).</li>
      <li>Select a <strong>recommendation</strong> (fund / do not fund / alternative) and provide a detailed justification; this text is carried to the case record and outcome review.</li>
      <li>Click <em>Save</em> to keep a draft without status change, or <em>Submit</em> to move the case to <strong>pending approval</strong> for NWAC review. Save/Submit will release your lock.</li>
    </ol>

    <h3>Outcome notice</h3>
    <p>
      Once the assessment is submitted, the NWAC section unlocks so reviewers can record the funding decision and
      assurance outcome. Approved outcomes set application status to Approved/Initiated; rejected outcomes set it to
      Rejected/Archived and require a denial reason. Audit events and status updates fire automatically.
    </p>

    <h3>Need to revise?</h3>
    <p>
      If adjustments are required after submission and policy allows, choose <em>Edit</em> to re-open the form (lock
      required). Save or re-submit to persist changes; edits are blocked once a final decision exists unless privileges
      permit reopening.
    </p>

    <h3>Compliance reminders (from training)</h3>
    <ul>
      <li>Contact new applicants within five days and make up to three attempts for missing information before closing for non-response; log outreach in Case Notes.</li>
      <li>Pending means: documents complete, case manager recommendation captured, NWAC decision pending, Funding Agreement not yet signed—use status and notes to explain why a case remains pending.</li>
      <li>Band/First Nation funding letters must be requested first; denials must be on letterhead and match the ask.</li>
      <li>All applications (funded or not) must remain recorded for ARMS/audit; avoid untracked closures.</li>
    </ul>
  </div>
);

ApplicationAssessmentHelp.aiContext = `
You are assisting a coordinator filling out the Application Assessment widget. Key behaviors and constraints:
- Edit requires acquiring an assessment lock; editing is blocked if the case is approved/rejected or held by another user.
- Sections: overview/employment goals, barriers and local priorities, previous ISET, other funding (band try-first, EI/CRF stream, other sponsors), ESDC eligibility, intervention details (provider, dates, program name, NOC + version as needed, childcare need/funding), costs (ITP and/or wage breakdowns), recommendation and justification.
- Save keeps a draft without changing status; Submit moves the case to pending approval for NWAC review. Both persist to the case record and may release the lock.
- Evidence expectations from the training module: Status/Treaty card or two Nation letters plus self-declaration; two IDs; acceptance letter; statement of fees; band denial (if applicable); income/expense proofs for living allowance; attendance reports monthly during training.
- Timelines and pending definition from training: contact applicants within five days and make up to three attempts for missing info; “pending” covers cases waiting on docs, case manager recommendation, NWAC decision, or Funding Agreement. Note this in status explanations and Case Notes.
- All applications (funded or not) must stay recorded for audit/ARMS; avoid untracked closures. Reference related widgets for context: Application Overview (status/owner), ISET Application Form (applicant data/version history), Supporting Documents (evidence), Notes and Tasks (audit trail), Secure Messaging (doc requests).
`;

export const NwacAssessmentHelp = () => (
  <div>
    <h2>NWAC outcome notice</h2>
    <p>
      This panel appears once the coordinator submits the assessment. Use it to record the NWAC funding decision and the
      assurance outcome before finalising the case.
    </p>
    <ol>
      <li>Select <strong>Approve</strong> or <strong>Reject</strong> under Funding Decision. Approval clears any existing
        denial reason.</li>
      <li>Choose the <strong>Assessment Assurance</strong> response that best reflects your review of the coordinator&apos;s
        recommendation.</li>
      <li>If rejecting, provide a detailed <strong>Reason for Denial</strong> to surface the rationale in downstream
        communications and logs.</li>
      <li>Click <em>Approve/Reject</em> to save the outcome, mark the case status, emit audit events, and unlock next
        steps for notifications.</li>
    </ol>
    <p>
      Edits are locked once a final decision exists. Reopen the assessment only when policy permits and be sure to
      capture a new case note documenting any change.
    </p>
  </div>
);

NwacAssessmentHelp.aiContext = `
You are assisting an NWAC reviewer who is completing the outcome notice at the end of the Application Assessment widget.
Explain how to record the funding decision, assurance outcome, and rejection reasons, and what happens when the
Approve/Reject action is taken. Approved sets application status to Approved/Initiated; rejected sets it to Rejected/Archived
and requires a denial reason. Editing is disabled after final decision unless policy allows reopening. Status and audit log
update automatically.
`;

export default ApplicationAssessmentHelp;
