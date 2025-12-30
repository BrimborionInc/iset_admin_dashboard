import React from 'react';

const CaseCalendarHelp = () => (
  <div>
    <h2>Case calendar</h2>
    <p>
      Stay on top of deadlines, reminders, and milestones for this case. The calendar highlights dates with activity,
      while the list view provides filtering and sorting when you need detail.
    </p>

    <h3>What appears here?</h3>
    <ul>
      <li>Intervention or action plan start and end dates when they exist.</li>
      <li>Reminders logged from case notes (follow-up dates) or other automation.</li>
      <li>Upcoming tasks assigned to the case, plus recent items for quick review.</li>
    </ul>

    <h3>Tips</h3>
    <ul>
      <li>Click a date to view the events in the right-hand panel and see next steps or owners.</li>
      <li>Use <em>List view</em> to filter by title, category, or severity when the month view gets busy.</li>
      <li>Color badges indicate urgency: <em>Overdue</em>, <em>Due soon</em>, and <em>On track</em>.</li>
      <li>If the calendar looks empty, confirm reminders exist or use demo mode to view sample events.</li>
    </ul>
  </div>
);

CaseCalendarHelp.aiContext = `
You are assisting with the Case Calendar widget. It shows reminders and key dates from action plans, interventions, and follow-up tasks. Explain the calendar vs. list views, color coding, and how to drill into events or acknowledge reminders.`;

export default CaseCalendarHelp;
