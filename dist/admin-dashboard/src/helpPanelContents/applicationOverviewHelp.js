import React from 'react';

const ApplicationOverviewHelp = () => (
  <div>
    <h2>Application overview at a glance</h2>
    <p>
      This card summarises the most important details about the applicant and where the case sits in the
      workflow. Use it to confirm ownership, stage, and contact information before diving into the other
      widgets.
    </p>

    <h3>What you can do here</h3>
    <ul>
      <li>
        <strong>Check status and stage:</strong> The coloured badge reflects the current case status. If your
        permissions allow, use the status selector to move the file to the next milestone.
      </li>
      <li>
        <strong>Validate identifiers:</strong> Quickly find the reference number, tracking ID, and submission
        timestamps that applicants may quote.
      </li>
      <li>
        <strong>Confirm ownership:</strong> See who is assigned to the case, the corresponding PTMA, and contact
        details for the applicant.
      </li>
      <li>
        <strong>Spot freshness:</strong> Received and last-updated dates help you decide whether a refresh is
        needed before taking action.
      </li>
    </ul>

    <h3>Tips</h3>
    <ul>
      <li>Changes made here update the case immediately for everyone viewing the dashboard.</li>
      <li>
        When reassigning a case elsewhere, update the status so downstream automations send the correct
        notifications.
      </li>
      <li>
        If a field looks empty, open the ISET Application Form widget to review the full submission for that
        information.
      </li>
    </ul>
  </div>
);

ApplicationOverviewHelp.aiContext = `
You are assisting an ISET program coordinator who is looking at the Application Overview widget. Explain what the
status badge and selector do, how to confirm applicant/contact details, and when to refresh or escalate. Focus on
practical operational guidance, not developer implementation details.
`;

export default ApplicationOverviewHelp;
