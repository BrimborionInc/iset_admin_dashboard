import React from 'react';

const ApplicationAssessmentHelp = () => (
  <div>
    <h2>Coordinator assessment workflow</h2>
    <p>
      Use this form to document your review of the applicant&apos;s request, confirm eligibility, and capture your
      funding recommendation. Required fields must be completed before you can submit the assessment or move the case to
      NWAC review.
    </p>

    <h3>Before you start</h3>
    <ul>
      <li>Review the <strong>ISET Application Form</strong> widget to gather the applicant&apos;s background, requested
        supports, and prior funding history.</li>
      <li>Check <strong>Supporting Documents</strong> to ensure the evidence needed for eligibility has been uploaded.</li>
      <li>Confirm the case status and stage in <strong>Application Overview</strong>; if the case is already pending
        approval or closed you may have limited edit access.</li>
    </ul>

    <h3>Completing the form</h3>
    <ol>
      <li>Update the <strong>assessment overview</strong> section with a concise summary of the client&apos;s situation and
        employment goals.</li>
      <li>Record <strong>barriers</strong>, <strong>priorities</strong>, and <strong>other funding</strong> to help justify
        the recommendation.</li>
      <li>Use the <strong>Intervention Details</strong> area to document timelines, training providers, and estimated
        costs (ITP or wage subsidy breakdowns).</li>
      <li>Select a <strong>recommendation</strong> and provide a detailed justification. This text appears in the case
        record and downstream notifications.</li>
      <li>Click <em>Save</em> to keep a draft without changing the case stage, or <em>Submit</em> to mark the
        assessment as ready for NWAC review.</li>
    </ol>

    <h3>Outcome notice</h3>
    <p>
      Once the assessment is submitted, the NWAC section unlocks so reviewers can record the final funding decision and
      assurance outcome. Approved or rejected decisions will automatically update the case status and emit events for the
      audit log.
    </p>

    <h3>Need to revise?</h3>
    <p>
      If adjustments are required after submission, choose <em>Edit</em>. The form will re-open in editable mode while
      preserving historical data in the backend. Remember to re-submit or save once revisions are complete.
    </p>
  </div>
);

ApplicationAssessmentHelp.aiContext = `
You are assisting a coordinator who is filling out the Application Assessment widget inside the case dashboard.
Guide them through completing eligibility fields, documenting barriers, updating intervention details, saving drafts,
submitting assessments, and preparing for NWAC review. Focus on the workflow in this widget and reference the related
widgets (Application Overview, ISET Application Form, Supporting Documents) when helpful.
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
Approve/Reject action is taken. Highlight that the case status and audit log update automatically.
`;

export default ApplicationAssessmentHelp;
