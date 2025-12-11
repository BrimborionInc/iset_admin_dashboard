import React from 'react';

const EsdcOverviewHelp = () => (
  <div>
    <p>
      The overview dashboard provides administrators with a snapshot of ILMP participant readiness and agreement
      reporting progress. Use it to spot bottlenecks quickly and jump into the operational dashboards that need
      attention.
    </p>
    <h3>Key questions it answers</h3>
    <ul>
      <li>How many participants are ready, blocked, or awaiting validation?</li>
      <li>What ESDC submission deadlines are coming up?</li>
      <li>What submission or validation activity occurred recently?</li>
    </ul>
    <h3>Typical workflow</h3>
    <ol>
      <li>Review KPIs to confirm readiness trends.</li>
      <li>Check upcoming deadlines and ensure owners are preparing deliverables.</li>
      <li>Drill into the Participants or Reporting dashboards to resolve issues.</li>
    </ol>
  </div>
);

EsdcOverviewHelp.aiContext = `
ESDC submissions overview dashboard. Audience: Program and System Admins monitoring participant ILMP readiness
and agreement reporting deadlines. Provide high-level status and quick navigation guidance.
`;

export default EsdcOverviewHelp;
