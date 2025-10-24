import React from 'react';

const EsdcSubmissionDashboardHelp = () => (
  <div>
    <p>
      Use this dashboard to prepare Indigenous Labour Market Program (ILMP) client payloads for ESDC submission.
      It gathers validation feedback, payload previews, and export history in one workspace so compliance work
      stays separate from day-to-day case assessment.
    </p>

    <h3>Workflow outline</h3>
    <ol>
      <li>Run the readiness checklist to confirm mandatory fields meet ILMP schema rules.</li>
      <li>Review validation summary and address warnings in the underlying application data.</li>
      <li>Preview the generated XML payload, then download or copy it for transmission.</li>
      <li>Track previous submissions and their outcomes for audit purposes.</li>
    </ol>

    <h3>Responsibilities</h3>
    <ul>
      <li>Program Administrators ensure data corrections are complete before export.</li>
      <li>System Administrators maintain validation rules and transport integrations.</li>
      <li>Submission actions should be logged in the history feed to support audits.</li>
    </ul>

    <h3>Future enhancements</h3>
    <ul>
      <li>Hook the readiness engine into real-time validation services.</li>
      <li>Allow bulk preparation across multiple clients with batching safeguards.</li>
      <li>Integrate with secure transport once ESDC transmission endpoints are finalised.</li>
    </ul>
  </div>
);

EsdcSubmissionDashboardHelp.aiContext = `
Dedicated ESDC submission workspace for ISET. Focus on validating ILMP client schema fields, previewing XML payloads,
and tracking export history. Audience: Program Administrators and System Administrators preparing compliant submissions.
`;

export default EsdcSubmissionDashboardHelp;
