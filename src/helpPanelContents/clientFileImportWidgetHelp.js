import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const ClientFileImportWidgetHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Expected file format</strong>
      <p>
        Upload one spreadsheet with a recognizable header row. The importer maps the standard client-profile columns
        for name, date of birth when known, contact details, address, Indigenous identity, and SIN, and it can skip
        leading guidance rows before the first real participant row.
      </p>
    </Box>
    <Box>
      <strong>First data row</strong>
      <p>
        Leave <em>First data row</em> blank to auto-detect the first participant row, or set it explicitly when the
        sheet includes extra instruction rows between the headers and the actual data.
      </p>
    </Box>
    <Box>
      <strong>Matching rules</strong>
      <p>
        PATH tries to match an existing client by raw SIN first, then by prior case or submission SIN, then by email,
        then by name and date of birth when DOB is available, with a stricter name-only fallback when it is not. Rows
        that match multiple clients or multiple existing cases are blocked for review instead of importing silently.
      </p>
    </Box>
    <Box>
      <strong>Commit behavior</strong>
      <p>
        Ready rows either create a new client and case, create a case for an existing client, or update the single
        existing case already linked to that client.
      </p>
    </Box>
  </SpaceBetween>
);

ClientFileImportWidgetHelp.aiContext =
  "Guide staff through the client batch import widget. Explain upload constraints, matching precedence, blocked-row review, and what happens when commit runs.";

export default ClientFileImportWidgetHelp;
