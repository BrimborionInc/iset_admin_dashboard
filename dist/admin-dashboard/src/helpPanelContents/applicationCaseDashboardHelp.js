import React from 'react';

const ApplicationCaseDashboardHelp = () => (
  <div>
    <h2>ISET Application Assessment workspace</h2>
    <p>
      This dashboard brings together every tool required to progress an application from intake to final decision.
      Use the widgets in the board to review the applicant dossier, complete the assessment, capture supporting
      artefacts, and communicate with the applicant or other team members.
    </p>

    <h3>Key widgets on the page</h3>
    <ul>
      <li>
        <strong>Application Overview</strong> – surface-level case data including tracking identifiers, status, stage,
        ownership, and quick links for reassignment or refresh.
      </li>
      <li>
        <strong>ISET Application Form</strong> – the full submission from the applicant with editable sections for
        corrections and version history.
      </li>
      <li>
        <strong>Application Assessment</strong> – the coordinator assessment workflow where funding recommendations and
        outcome notices are recorded.
      </li>
      <li>
        <strong>Supporting Documents</strong> – uploaded verifications such as ID, acceptance letters, or pay stubs.
      </li>
      <li>
        <strong>Secure Messaging</strong> &amp; <strong>Case Notes</strong> – collaboration tools for internal comments and
        secure conversations with the applicant.
      </li>
      <li>
        <strong>Application Events</strong> – chronological event log showing submissions, status changes, and review
        milestones.
      </li>
    </ul>

    <h3>Typical review flow</h3>
    <ol>
      <li>Start with <em>Application Overview</em> to confirm the case owner, stage, and any outstanding alerts.</li>
      <li>Open the <em>ISET Application Form</em> to verify the data provided during intake and capture corrections if
        needed (toggle edit mode to publish updates).</li>
      <li>Work through the <em>Application Assessment</em> widget, ensuring all required sections are completed before
        submitting for NWAC review.</li>
      <li>Attach or review <em>Supporting Documents</em> to confirm eligibility evidence.</li>
      <li>Use <em>Secure Messaging</em> to request clarifications from the applicant or <em>Case Notes</em> to log
        internal context.</li>
      <li>After finalising the outcome notice, monitor downstream automations in the <em>Application Events</em> log.</li>
    </ol>

    <h3>Tips</h3>
    <ul>
      <li>The board layout is currently fixed; widgets can be resized but not removed.</li>
      <li>Refreshing the page will re-fetch the latest case data while preserving cached values during the session.</li>
      <li>Each widget provides its own Info link with deeper guidance when you need process-specific help.</li>
    </ul>
  </div>
);

ApplicationCaseDashboardHelp.aiContext = `You are assisting an NWAC case coordinator while they work in the "ISET Application Assessment" dashboard. The board contains widgets for Application Overview (case summary), ISET Application Form (editable intake submission), Application Assessment (decision workflow), Supporting Documents, Secure Messaging, Case Notes, and Application Events (timeline).

When the coordinator needs to correct applicant data, direct them to open the ISET Application Form widget, press **Edit**, confirm the modal, adjust the required fields, then choose **Save**. Saving creates a new version that can be reviewed under **View versions**; the original submission stays available. Editing is disabled once the case status is Approved or Rejected.

Remind them to document any coordinator-made edits in Case Notes and, when the applicant must be notified, send a Secure Message from the same workspace. After updates, they can refresh Application Overview or Application Events to confirm the change propagated.`;

export default ApplicationCaseDashboardHelp;
