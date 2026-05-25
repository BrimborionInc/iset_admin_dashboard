import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const FinanceReportsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What this report is for</strong>
      <p>
        Use this page to review the annual ISET Advances and Active Clients report before sharing or
        reconciling the workbook. It brings the active client count, approved CRF/EI advances, regional
        totals, and intervention-level detail into one finance review view.
      </p>
    </Box>
    <Box>
      <strong>What is counted</strong>
      <p>
        The report counts approved CRF and EI intervention funding for the selected fiscal year. Each
        detail row is one intervention, and the active client count deduplicates participants across
        those rows. Region is based on the participant&apos;s home province or territory.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Select the fiscal year and any provinces or territories you need to review.</li>
        <li>Check the summary cards first, then use Region summary to compare totals by geography.</li>
        <li>Use Intervention detail to inspect the people, interventions, category amounts, and payment follow-up status behind the totals.</li>
        <li>Export to Excel when you need the workbook-style package for finance review or reconciliation.</li>
      </ul>
    </Box>
    <Box>
      <strong>Payment status</strong>
      <p>
        Payment status is PATH follow-up information beside the approved funding. It helps staff see
        whether payment packets are draft, ready, sent, need follow-up, or have a recorded paid or
        confirmed state. Sage remains the financial system of record.
      </p>
    </Box>
    <Box>
      <strong>Carry-over</strong>
      <p>
        Turn on carry-over when you need an estimate for interventions or payment activity that crosses
        fiscal years. Treat it as a planning and reconciliation aid, not as an accounting ledger.
      </p>
    </Box>
    <Box>
      <strong>If something looks off</strong>
      <p>
        Start by checking the fiscal year, region filter, intervention approved date, intervention
        status, funding source or budget pot, and whether payment follow-up was recorded in PATH.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsHelp.aiContext =
  "Explain the ISET Advances and Active Clients report for finance users. Say it is the annual approved-funding report for CRF/EI interventions, with active client counts, regional totals, intervention detail, optional carry-over estimates, PATH payment follow-up status, and Excel export. Clarify that payment status and recorded paid/confirmed values are PATH-side operational follow-up records, not Sage authority.";

export const FinanceReportsSetupHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Report setup</strong>
      <p>
        Choose the fiscal year and provinces or territories you want to review. PATH then loads
        approved CRF/EI intervention funding for that scope.
      </p>
    </Box>
    <Box>
      <strong>Region filter</strong>
      <p>
        Region means the participant&apos;s home province or territory. Select none to review all regions,
        or select one or more regions for a regional workbook.
      </p>
    </Box>
    <Box>
      <strong>Carry-over</strong>
      <p>
        Include carry-over only when you need a cross-fiscal estimate. The estimate uses payment-line
        dates when PATH has them, otherwise it falls back to the intervention schedule or dates.
      </p>
    </Box>
    <Box>
      <strong>Export</strong>
      <p>
        Export to Excel creates a summary sheet plus separate CRF and EI detail sheets from the
        currently selected report view.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsSetupHelp.aiContext =
  "Explain the Financial Reports setup controls: fiscal year selects interventions approved in that year, region uses participant home province/territory, carry-over adds a best-effort cross-fiscal estimate, Reset Filters restores the default view, and Export to Excel creates the current workbook view.";

export const FinanceReportsSummaryHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What the cards show</strong>
      <p>
        The summary cards show approved advances for the current fiscal year and region selection.
        Total advances is the CRF and EI approved funding combined.
      </p>
    </Box>
    <Box>
      <strong>Active clients and interventions</strong>
      <p>
        Active clients counts unique participants in the current result set. Interventions counts the
        approved intervention rows that make up the report.
      </p>
    </Box>
    <Box>
      <strong>Table search</strong>
      <p>
        The Intervention detail row-scope selector and table search both update these cards so the
        on-screen totals and exported workbook stay aligned with the visible rows.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsSummaryHelp.aiContext =
  "Explain the Financial Reports summary cards: total approved advances, CRF advances, EI advances, active clients as unique participants, and intervention count. Mention that the Intervention detail row-scope selector and table search narrow these visible totals.";

export const FinanceReportsCarryOverHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What carry-over estimates</strong>
      <p>
        Carry-over estimates how much approved intervention activity belongs inside, before, or after
        the selected fiscal year when the intervention or payment schedule crosses a year boundary.
      </p>
    </Box>
    <Box>
      <strong>How to read it</strong>
      <ul>
        <li><strong>From prior FY:</strong> activity approved before the selected fiscal year but estimated in this year.</li>
        <li><strong>To next FY:</strong> approved activity in the selected fiscal year that appears scheduled beyond year-end.</li>
        <li><strong>Current FY estimate:</strong> the estimated amount that belongs in the selected fiscal year.</li>
      </ul>
    </Box>
    <Box>
      <strong>Confidence level</strong>
      <p>
        Payment-line dates are the best source. When they are not available, PATH uses the intervention
        schedule or intervention dates, so the result should be treated as an estimate.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsCarryOverHelp.aiContext =
  "Explain carry-over in the annual finance report: it is a best-effort estimate for cross-fiscal intervention activity, using payment-line dates first and intervention schedule/dates as fallback. Define carry-in from prior FY, carry-out to next FY, and current FY estimate. Warn that it is not a Sage ledger.";

export const FinanceReportsRegionSummaryHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Region summary groups the current report totals by participant home province or territory so
        finance reviewers can compare regional CRF, EI, and total advances.
      </p>
    </Box>
    <Box>
      <strong>Counts</strong>
      <p>
        Participants are unique people in that region. Interventions are the approved intervention
        rows contributing to the regional total.
      </p>
    </Box>
    <Box>
      <strong>Unspecified</strong>
      <p>
        Unspecified means PATH could not resolve a home province or territory from the participant&apos;s
        application or client address.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsRegionSummaryHelp.aiContext =
  "Explain the Region summary table: it groups approved CRF/EI advances by participant home province or territory, counts unique participants and intervention rows, and uses Unspecified when the home region cannot be resolved.";

export const FinanceReportsDetailHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What each row means</strong>
      <p>
        Each row is one approved CRF or EI intervention. The participant link opens the case workspace
        so staff can review the file behind the report row.
      </p>
    </Box>
    <Box>
      <strong>Funding columns</strong>
      <p>
        Tuition, books/materials, living, childcare, wage/project, and other columns are reporting
        allocations from the approved intervention funding. Total advances is the approved amount for
        that intervention.
      </p>
    </Box>
    <Box>
      <strong>Payment status</strong>
      <p>
        Payment status shows PATH payment packet and follow-up state beside the approved funding. It
        supports operational follow-up and does not replace Sage/AP confirmation.
      </p>
    </Box>
    <Box>
      <strong>Search and export</strong>
      <p>
        The row-scope selector defaults to funded interventions, hiding zero-dollar approved work such
        as counselling unless you choose all approved interventions. The table search narrows the
        visible rows by participant, case, intervention, institution, program, region, budget pot, or
        payment status. Use the table preferences gear to choose columns. Excel export uses the same
        visible detail rows.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsDetailHelp.aiContext =
  "Explain the Financial Reports intervention detail table: one row per approved CRF/EI intervention, participant link opens Case Workspace, the row-scope selector defaults to funded interventions only but can include all approved interventions, the table preferences gear chooses visible columns, all columns are sortable/resizable, category columns are reporting allocations of the approved amount, payment status is PATH operational follow-up rather than Sage authority, and text search controls the visible rows and export detail.";

export default FinanceReportsHelp;
