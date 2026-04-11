import React from 'react';

const ApplicationOverviewHelp = () => (
  <div>
    <h2>Application overview at a glance</h2>
    <p>
      This widget summarizes the most important details about the application and where it sits in the workflow.
      Use it to confirm status, ownership, timeline status, and key identifiers before diving into the other widgets.
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
        <strong>Confirm ownership:</strong> See the assigned staff member and any active locks.
        Use quick actions to assign or reassign when permitted.
      </li>
      <li>
        <strong>Track timing:</strong> Timeline status, received date, and last updated timestamps help you prioritize
        and confirm data freshness.
      </li>
      <li>
        <strong>Monitor checklist status:</strong> The document checklist summary shows whether required items are
        complete or still missing.
      </li>
      <li>
        <strong>Watch ILMP reporting status:</strong> Eligibility-denied records now show an ESDC reporting status here,
        including blocking issues that must be fixed in Application Workspace before the record can enter the reporting queue.
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
      <li>If a field or detail is missing, open the ISET Application Form widget to review the full submission.</li>
      <li>Denied-ineligible ILMP issues do not belong to normal casework queues; use the ESDC reporting status panel to see whether the record is blocked, pending, or ready.</li>
      <li>Use this widget to orient yourself quickly, but do the real review in the form, documents, notes, messaging, and assessment widgets.</li>
    </ul>
  </div>
);

ApplicationOverviewHelp.aiContext = `
You are assisting an ISET program coordinator using the Application Overview widget. Explain the status badge and
selector, timeline status, assignment and escalation quick actions, document checklist summary, the ESDC/ILMP reporting status shown for denied-ineligible records, and where to confirm identifiers and contact details.
Keep guidance operational and aligned with the visible controls. Treat this widget as the first orientation point in the file, not as a substitute for reviewing the underlying application, documents, notes, and assessment.
`;

export default ApplicationOverviewHelp;
