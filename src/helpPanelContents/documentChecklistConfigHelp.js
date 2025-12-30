import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const DocumentChecklistConfigHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Document Checklists</Box>
    <Box>
      Configure which documents are required at each status gate for applications and
      interventions. Each gate lists the document types and sources that satisfy the
      checklist.
    </Box>
    <Box>
      Saving updates the runtime checklist configuration used by Supporting Documents and
      assessment workflows. Status mappings are shown for reference and are read-only in
      this editor.
    </Box>
  </SpaceBetween>
);

DocumentChecklistConfigHelp.aiContext = `
This widget edits the runtime document checklist configuration (scope: checklist).
Each gate represents a status set and contains checklist items with labels, required flag,
document type codes, sources, optional minCount, and optional notes.
Edits here affect the checklist used in Supporting Documents and assessment flows.
`;

export default DocumentChecklistConfigHelp;
