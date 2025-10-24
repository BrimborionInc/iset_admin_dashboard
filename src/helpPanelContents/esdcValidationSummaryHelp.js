import React from 'react';

const EsdcValidationSummaryHelp = () => (
  <div>
    <p>
      The validation summary aggregates readiness scoring for the selected client. It explains how many mandatory and
      optional fields are satisfied, and tallies warnings or blocking errors that must be resolved before export.
    </p>

    <h3>Scoring</h3>
    <ul>
      <li><strong>Mandatory fields</strong> must all be present and valid for the submission to proceed.</li>
      <li><strong>Optional fields</strong> improve reporting completeness but do not block export.</li>
      <li><strong>Warnings</strong> highlight soft issues (e.g., placeholder addresses) that may require justification.</li>
      <li><strong>Blocking errors</strong> must be cleared prior to generating the payload.</li>
    </ul>

    <h3>Next steps</h3>
    <ul>
      <li>Investigate any warnings with the readiness checklist or by reviewing the underlying application data.</li>
      <li>Use the history widget to confirm who cleared previous issues and when.</li>
      <li>Recalculate once corrections are saved to ensure the readiness score reflects the latest data.</li>
    </ul>
  </div>
);

EsdcValidationSummaryHelp.aiContext = `
Widget help: Summarise ILMP validation counts (mandatory/optional fields, warnings, blocking errors) and readiness score.
`;

export default EsdcValidationSummaryHelp;
