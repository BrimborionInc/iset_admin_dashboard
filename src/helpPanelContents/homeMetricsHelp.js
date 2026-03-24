import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeMetricsHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Metrics</Box>
    <Box>
      This widget summarizes configurable application, outcome, case, and funding measures for the selected period.
    </Box>
    <Box>
      Switch between week, month, quarter, and year using the period selector, and use Refresh to pull the latest
      totals.
    </Box>
    <Box>
      Count values are links. Select a count to open the matching records in the Work Queue Items table below.
    </Box>
    <Box>
      The period label below the metric tiles shows the exact date range currently applied. Active cases is a current
      snapshot for your scope, so that list does not change with the period selector.
    </Box>
    <Box>
      Use the widget settings menu to choose which metrics appear, including approved, denied, employed, returned to
      school, active cases, action plans started, new intervention proposals, interventions completed, and funding totals.
    </Box>
  </SpaceBetween>
);

HomeMetricsHelp.aiContext = `
You are assisting with the Metrics widget on the NWAC ISET homepage. Explain how to change the reporting period, refresh data, open Configure metrics, and what the available metric options represent in plain language. Mention that count values open matching records in the Work Queue Items table, while currency totals are informational only.
`;

export default HomeMetricsHelp;
