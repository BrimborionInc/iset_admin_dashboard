import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const FinanceOverviewKpiHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        This widget gives leadership a live snapshot of overall financial health across the active ISET agreement,
        highlighting budget burn, administrative allowance usage, evidence coverage, and forecast variance.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>
          Review the <em>Total budget</em> tile for current spend, remaining balance, and burn-rate progress.
        </li>
        <li>
          Monitor <em>Admin flat-rate usage</em> to ensure the negotiated allowance stays within the configured cap.
        </li>
        <li>
          Track <em>Evidence coverage</em> to identify transactions missing supporting documents before monitoring
          engagements.
        </li>
        <li>
          Use <em>Forecast variance</em> to understand projected year-end position and whether reallocations are needed.
        </li>
      </ul>
    </Box>
    <Box>
      <strong>Data sources &amp; telemetry</strong>
      <ul>
        <li>Budget and spend metrics pull from the finance ledger and budget service.</li>
        <li>Admin allowance logic applies the flat-rate rules configured in Finance Settings and records any overrides.</li>
        <li>Evidence coverage uses the monitoring service to flag items lacking attachments.</li>
        <li>Forecasts originate from the scenario engine and should emit telemetry with <code>agreement_id</code> and <code>report_id</code>.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Configure badge thresholds (green / yellow / red) in Finance Settings so the colour coding reflects organisational tolerance.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceOverviewKpiHelp.aiContext =
  "Explain the finance overview KPI tiles: budget burn, admin flat-rate usage, evidence coverage, and forecast variance, including how leaders interpret the metrics and act on them.";

export default FinanceOverviewKpiHelp;
