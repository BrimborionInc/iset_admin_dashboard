import React from 'react';

const EsdcOverviewKpiHelp = () => (
  <div>
    <p>
      KPI tiles summarise the submission backlog: ready vs blocked participants, agreement reporting status, and
      overall submission success rate. They surface trends so administrators know whether they are on track for the
      next export window.
    </p>
    <ul>
      <li><strong>Participants ready:</strong> Number of ILMP records with no blocking errors.</li>
      <li><strong>Participants blocked:</strong> Records with at least one validation failure.</li>
      <li><strong>Reporting status:</strong> Current milestone for the next reporting period.</li>
      <li><strong>Success rate:</strong> Accepted vs rejected submissions over the last 30 days.</li>
    </ul>
  </div>
);

EsdcOverviewKpiHelp.aiContext = `
Widget help: Overview KPIs for ESDC submissions. Explain ready vs blocked participant counts,
reporting status, and submission success rate.
`;

export default EsdcOverviewKpiHelp;
