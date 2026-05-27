import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const FinanceReportsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What this page helps you answer</strong>
      <p>
        Use this page to review approved ISET advances for a fiscal year: how much CRF/EI funding has
        been approved, which funded clients and interventions make up the totals, how the funding is
        distributed by region, and what payment follow-up is recorded in PATH.
      </p>
    </Box>
    <Box>
      <strong>Set the scope first</strong>
      <ul>
        <li>Fiscal year is based on the intervention approval date.</li>
        <li>Region is the participant&apos;s home province or territory.</li>
        <li>The default row scope is funded interventions only, so zero-dollar approved interventions stay out of the advances totals.</li>
      </ul>
    </Box>
    <Box>
      <strong>Read the report in order</strong>
      <ul>
        <li>Use Report summary for the current total advances, CRF/EI split, funded clients, and funded interventions.</li>
        <li>Use Region summary to compare the same visible rows by participant home region.</li>
        <li>Use Intervention detail to inspect the participant, intervention, approved funding, category allocations, and PATH payment follow-up behind a number.</li>
        <li>Export to Excel after the fiscal year, region, row scope, and table search match the workbook you need.</li>
      </ul>
    </Box>
    <Box>
      <strong>Payment follow-up</strong>
      <p>
        Payment status is PATH follow-up information beside the approved funding. It helps staff see
        whether payment packets are draft, ready, sent, need follow-up, or have a recorded paid or
        confirmed state. Sage remains the financial system of record.
      </p>
    </Box>
    <Box>
      <strong>Carry-over</strong>
      <p>
        Leave carry-over off for the standard approved-funding report. Turn it on when you need a
        planning estimate for activity that crosses a fiscal-year boundary; PATH uses dated payment
        lines when available and falls back to the intervention schedule when dated lines are missing.
      </p>
    </Box>
    <Box>
      <strong>If something looks off</strong>
      <p>
        Check the fiscal year, region, row scope, table search, intervention approval date, funding
        source, approved amount, and whether the row is zero-dollar before investigating the case file
        or payment packet history.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsHelp.aiContext =
  "Explain the ISET Advances and Active Clients report as an approved-funding review job aid. Say it is the annual approved-funding report for funded CRF/EI interventions by approval date, with funded client counts, regional totals, intervention detail, optional carry-over estimates, PATH payment follow-up status, and Excel export. Emphasize that fiscal year means approval date, region means participant home province/territory, the default detail scope hides zero-dollar approved interventions, summary totals follow the visible rows, and payment status or recorded paid/confirmed values are PATH-side operational follow-up records, not Sage authority. Use staff and program-side wording for PATH activity.";

export const FinanceReportsSetupHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Fiscal year</strong>
      <p>
        Fiscal year selects interventions approved in that year. It does not use payment date,
        intervention start date, or intervention end date for the standard report totals.
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
        Leave carry-over off for the standard approved-funding view. Include it only when you need to
        estimate activity across fiscal years using payment-line dates or, when those are missing, the
        intervention schedule.
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
  "Explain the Financial Reports setup controls: fiscal year selects interventions approved in that year, region uses participant home province/territory, carry-over is optional and adds a best-effort cross-fiscal estimate, Reset Filters restores the default view, and Export to Excel creates the current workbook view.";

export const FinanceReportsSummaryHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What the cards show</strong>
      <p>
        The summary cards are calculated from the current visible rows after fiscal year, region, row
        scope, and table search are applied. Total advances is the CRF and EI approved funding
        combined.
      </p>
    </Box>
    <Box>
      <strong>Funded clients and interventions</strong>
      <p>
        Funded clients counts unique participants in the current visible rows. Funded interventions
        counts the funded rows in the default view; if you switch to all approved rows, the card shows
        approved interventions instead.
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
  "Explain the Financial Reports summary cards: total approved advances, CRF advances, EI advances, funded clients as unique participants in the visible rows, and intervention count. Mention that fiscal year, region, the Intervention detail row-scope selector, and table search narrow these visible totals, and that the intervention card changes to approved interventions when all approved rows are selected.";

export const FinanceReportsCarryOverHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What carry-over estimates</strong>
      <p>
        Carry-over estimates how approved intervention activity falls around the selected fiscal year
        when a payment schedule or intervention period crosses a year boundary. It does not change the
        approval-year totals in the standard report.
      </p>
    </Box>
    <Box>
      <strong>How to read it</strong>
      <ul>
        <li><strong>From prior FY:</strong> activity approved before the selected fiscal year but estimated in this year.</li>
        <li><strong>To next FY:</strong> approved activity in the selected fiscal year that appears scheduled beyond year-end.</li>
        <li><strong>Selected FY estimate:</strong> the estimated amount that belongs in the selected fiscal year.</li>
      </ul>
    </Box>
    <Box>
      <strong>Confidence level</strong>
      <p>
        Dated payment lines are used first and are assigned to the fiscal year of the line date. When
        dated lines are not available, PATH uses the intervention schedule or intervention dates, so
        the result should be treated as an estimate.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsCarryOverHelp.aiContext =
  "Explain carry-over in the annual advances report: it is a best-effort estimate for cross-fiscal intervention activity, using payment-line dates first and intervention schedule/dates as fallback. Dated payment lines are assigned to the fiscal year of the line date, not prorated across the intervention. Define carry-in from prior FY, carry-out to next FY, and selected-FY estimate. Warn that it is not a Sage ledger.";

export const FinanceReportsRegionSummaryHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Region summary groups the current report totals by participant home province or territory so
        staff can compare regional CRF, EI, and total advances.
      </p>
    </Box>
    <Box>
      <strong>Counts</strong>
      <p>
        Participants are unique people in that region. Interventions are the visible intervention rows
        contributing to the regional total.
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
        payment status. Use the table preferences gear to choose columns. Summary cards and Excel
        export use the same visible detail rows.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsDetailHelp.aiContext =
  "Explain the Financial Reports intervention detail table: one row per approved CRF/EI intervention, participant link opens Case Workspace, the row-scope selector defaults to funded interventions only but can include all approved interventions, the table preferences gear chooses visible columns, all columns are sortable/resizable, category columns are reporting allocations of the approved amount, payment status is PATH operational follow-up rather than Sage authority, and text search controls the visible rows and export detail.";

export default FinanceReportsHelp;
