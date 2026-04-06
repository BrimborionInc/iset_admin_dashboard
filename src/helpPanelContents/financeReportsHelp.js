import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const FinanceReportsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Review the annual ISET Advances and Active Clients report in the Budgets and Finance area,
        with fiscal year, region, and optional carry-over filtering plus Excel export for finance
        users who still rely on workbook-style reporting.
      </p>
    </Box>
    <Box>
      <strong>Current view</strong>
      <p>
        The report shows annual intervention funding by fiscal year and adds payment status on each
        row so staff can see whether related packets are still draft, ready to send, sent to
        finance, or confirmed. An optional carry-over estimate uses payment-line dates first and the
        intervention schedule as a fallback.
      </p>
    </Box>
    <Box>
      <strong>Filters</strong>
      <ul>
        <li>Fiscal year.</li>
        <li>Region (one or more provinces or territories).</li>
        <li>Include carry-over (best-effort estimate).</li>
      </ul>
    </Box>
    <Box>
      <strong>Outputs</strong>
      <ul>
        <li>Summary cards for CRF advances, EI advances, participants, and interventions.</li>
        <li>Region totals table showing CRF, EI, and overall advances.</li>
        <li>Intervention-level detail with funding category amounts, payment status, and optional carry-over notes.</li>
        <li>Excel export with a summary tab plus separate CRF and EI detail tabs.</li>
      </ul>
    </Box>
    <Box>
      <strong>Important note</strong>
      <p>
        This page is an annual funding report with payment follow-up beside each row. It is not a
        full payment-history ledger.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsHelp.aiContext =
  "Explain the Financial Reports page: the annual ISET Advances and Active Clients report, fiscal year and region filters, optional carry-over estimate, intervention-level detail, payment status, and Excel export.";

export default FinanceReportsHelp;
