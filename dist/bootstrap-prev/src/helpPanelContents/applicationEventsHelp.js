import React from 'react';

const ApplicationEventsHelp = () => (
  <div>
    <h2>Case activity timeline</h2>
    <p>
      The events feed records every key action on the application—from submissions and status changes to review
      outcomes. Use it to retrace who did what and when.
    </p>

    <h3>Highlights</h3>
    <ul>
      <li>
        <strong>Chronological audit:</strong> Each row stamps the date, event type, and message describing what
        happened.
      </li>
      <li>
        <strong>Actor visibility:</strong> See which staff member or applicant triggered the change so you know who
        to contact with questions.
      </li>
      <li>
        <strong>Smart labelling:</strong> Status updates and assignment changes are translated into plain language
        for quick scanning.
      </li>
    </ul>

    <h3>Working with the table</h3>
    <ul>
      <li>Use the search box to filter for keywords such as “approved” or a specific team member.</li>
      <li>Sort the Date/Time column to review the most recent activity or replay events in order.</li>
      <li>Pinned alerts from other widgets (like assessments) also appear here so you do not miss follow-up items.</li>
    </ul>

    <h3>Operational tips</h3>
    <ul>
      <li>Review events before contacting an applicant to ensure you understand the latest communication.</li>
      <li>When notes reference a change, confirm it appears here—if not, refresh to pull the latest log.</li>
      <li>Use the timeline during audits to demonstrate when decisions were recorded and by whom.</li>
    </ul>
  </div>
);

ApplicationEventsHelp.aiContext = `
You are assisting an ISET program user reviewing the Events widget. Explain how to interpret event messages, filter the
list, and confirm who performed each action. Focus on operational awareness and audit readiness.
`;

export default ApplicationEventsHelp;
