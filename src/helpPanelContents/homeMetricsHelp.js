import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeMetricsHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Metrics</Box>
    <Box>
      This widget summarizes new applications, decisions made, active cases, funds committed, and funds spent for the
      selected period.
    </Box>
    <Box>
      Switch between week, month, quarter, and year using the period selector, and use Refresh to pull the latest
      totals.
    </Box>
    <Box>
      The period label under the header shows the exact date range currently applied.
    </Box>
  </SpaceBetween>
);

HomeMetricsHelp.aiContext = `
You are assisting with the Metrics widget on the NWAC ISET homepage. Explain how to change the reporting period, refresh data, and what each metric represents (including funds committed and funds spent).
`;

export default HomeMetricsHelp;
