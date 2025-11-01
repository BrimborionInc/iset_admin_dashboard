import React from 'react';

const CaseCalendarHelp = () => (
  <div>
    <h2>Case calendar</h2>
    <p>
      The case calendar surfaces upcoming and historical reminders, deadlines, and milestones associated
      with the selected case or application. Items can originate from tasks, workflow automation, or manual
      reminders created by the case team.
    </p>
    <h3>How to use</h3>
    <ul>
      <li>Use the view selector to switch between upcoming, past, or all events.</li>
      <li>Filter the list to locate specific reminders by title, type, or owner.</li>
      <li>Future iterations will allow you to add new reminders and acknowledge completed work directly.</li>
    </ul>
    <p>
      While the backend integration is in progress, the widget shows representative sample data so the team
      can validate layout and interactions.
    </p>
  </div>
);

CaseCalendarHelp.aiContext = `
You are assisting with the Case Calendar widget inside the admin Case Workspace or Application Assessment dashboard.
The Widget lists reminders, deadlines, and timeline events for a case/applicant. It can toggle between upcoming and past
items and will later integrate with the reminders/task engine (CR-0013).`;

export default CaseCalendarHelp;
