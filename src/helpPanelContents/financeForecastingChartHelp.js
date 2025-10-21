import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceForecastingChartHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Visualise plan, actuals, and forecast projections to spot deviations early and evaluate scenario overlays.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Switch horizons to review near-term or full fiscal views.</li>
        <li>Toggle actual, baseline, and active scenario lines for quick comparisons.</li>
        <li>Use spikes or gaps to trigger scenario reviews or allocations follow-up.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Forecast data should draw from the forecasting service, while actuals reflect reconciled spend. Scenario overlays adjust dynamically as you edit the active scenario.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceForecastingChartHelp.aiContext =
  "Explain the Forecast vs. budget chart widget: switching horizons, toggling series, and interpreting scenario overlays.";

export default FinanceForecastingChartHelp;

