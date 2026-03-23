import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const ClientFileImportDashboardHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Use this dashboard to backload participant spreadsheets into PATH as client files without creating placeholder
        applications, assessments, or interventions.
      </p>
    </Box>
    <Box>
      <strong>Import flow</strong>
      <p>
        Upload a spreadsheet, review the dry-run summary, then commit only when every row is ready. The dry run shows
        which rows will create a new client file, reuse an existing client, or update an existing case.
      </p>
    </Box>
    <Box>
      <strong>What this dashboard does not do</strong>
      <p>
        This import path does not create applicant logins, historical applications, or case artefacts beyond the core
        client and case profile records.
      </p>
    </Box>
  </SpaceBetween>
);

ClientFileImportDashboardHelp.aiContext =
  "Explain the Client Batch Import dashboard for PATH staff. Focus on dry-run review, duplicate/client matching, and the fact that this path creates or updates client files without fabricating historical applications.";

export default ClientFileImportDashboardHelp;
