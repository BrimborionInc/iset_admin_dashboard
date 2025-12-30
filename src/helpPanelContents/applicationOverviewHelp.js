import React from 'react';

const ApplicationOverviewHelp = () => (
  <div>
    <h2>Application overview at a glance</h2>
    <p>
      This widget summarizes the most important details about the application and where it sits in the workflow.
      Use it to confirm status, ownership, SLA timing, and key identifiers before diving into the other widgets.
    </p>

    <h3>What you can do here</h3>
    <ul>
      <li>
        <strong>Check status:</strong> The badge shows the current application status. If your role allows, use
        the selector to update status and trigger downstream updates.
      </li>
      <li>
        <strong>Validate identifiers:</strong> Copy the reference number, contact email, or phone details for
        quick confirmation with the applicant.
      </li>
      <li>
        <strong>Confirm ownership:</strong> See the assigned evaluator and PTMA, along with any active locks.
        Use quick actions to assign or reassign when permitted.
      </li>
      <li>
        <strong>Track timing:</strong> SLA status, received date, and last updated timestamps help you prioritize
        and confirm data freshness.
      </li>
      <li>
        <strong>Monitor checklist status:</strong> The document checklist summary shows whether required items are
        complete or still missing.
      </li>
      <li>
        <strong>Act quickly:</strong> The Quick actions menu includes assignment, closure notice, escalation,
        and layout presets for common review flows.
      </li>
    </ul>

    <h3>Tips</h3>
    <ul>
      <li>Status changes are recorded in the Events Timeline, so confirm the update there after saving.</li>
      <li>Escalations block some actions until resolved; respond or resolve before closing or archiving.</li>
      <li>If a field is missing, open the ISET Application Form widget to review the full submission.</li>
    </ul>
  </div>
);

ApplicationOverviewHelp.aiContext = `
You are assisting an ISET program coordinator using the Application Overview widget. Explain the status badge and
selector, SLA timing, assignment and escalation quick actions, document checklist summary, and where to confirm identifiers and contact details.
Keep guidance operational and aligned with the visible controls.
`;

export default ApplicationOverviewHelp;
