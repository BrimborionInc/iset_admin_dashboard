import React from 'react';

const EsdcUpcomingDeadlinesHelp = () => (
  <div>
    <p>
      Deadlines list upcoming ESDC submission windows (participant exports, quarterly/annual reports, special reviews).
      Each entry highlights the due date, current risk level, and descriptive reminder.
    </p>
    <p>
      Use it during stand-ups or planning meetings to confirm owners are working on their packages and to schedule
      validation activities in advance.
    </p>
  </div>
);

EsdcUpcomingDeadlinesHelp.aiContext = `
Widget help: Upcoming ESDC submission deadlines with due dates and risk indicators.
`;

export default EsdcUpcomingDeadlinesHelp;
