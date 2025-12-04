import React from "react";

const PortfolioCasesTableHelp = () => (
  <div>
    <p>
      The cases table lists every ISET case you can access. Use the search, filters, and column preferences
      to focus on a subset, then select a row to open the detailed case workspace.
    </p>

    <h3>Columns</h3>
    <ul>
      <li><strong>Client</strong>: primary client name; click to open the case workspace.</li>
      <li><strong>Owner</strong>: assigned case manager.</li>
      <li><strong>Agreement #</strong>: CRF/EI identifier that links finance and intervention records.</li>
      <li><strong>Interventions</strong>: open vs total interventions for the current action plan.</li>
      <li><strong>Finance Status</strong>: badges highlighting mapping gaps or overspends.</li>
      <li><strong>FY Actuals / Variance</strong>: current-year spend amounts so finance staff can triage quickly.</li>
    </ul>

    <h3>Tips</h3>
    <ul>
      <li>Filters persist per user in session storage, so you can return to the same queue during the day.</li>
      <li>Use the finance overview widget to filter by agreement and focus on cases that exceed allocation.</li>
      <li>Once a case is ready to close, validate it in the workspace—the ready-to-close state will appear here automatically.</li>
    </ul>
  </div>
);

PortfolioCasesTableHelp.aiContext = `You are helping an NWAC case manager using the ISET Portfolio dashboard. The cases table lists clients with owner, agreement number, intervention counts, finance status, fiscal actuals, and variance. Selecting a row opens the case workspace.`;

export default PortfolioCasesTableHelp;
