import React from 'react';

const JobBankSearchHelp = () => (
  <div>
    <p>
      This page embeds external Job Bank content provided by the Government of Canada.
      Results, filters, and matching behavior are controlled by Job Bank and may change
      without notice.
    </p>

    <h3>How to use this page</h3>
    <ul>
      <li>Enter a job title or keyword in the first field.</li>
      <li>Enter location in the second field, then run the search.</li>
      <li>Refine further using filters inside the embedded Job Bank results.</li>
      <li>Use “Open results in new tab” if you need more space while updating PATH.</li>
    </ul>

    <h3>Location tips for better matches</h3>
    <ul>
      <li>Include a province or territory code whenever possible.</li>
      <li>Preferred formats: <code>City (PR)</code> or <code>City PR</code> (for example, <code>Ottawa (ON)</code>).</li>
      <li>If you only enter a city name (for example, <code>Ottawa</code>), Job Bank may broaden to various locations.</li>
    </ul>

    <h3>Important notes</h3>
    <ul>
      <li>This is an external site in an embedded frame; PATH cannot edit or control its internal content.</li>
      <li>If the frame fails to load, open the same query in a new tab and continue your assessment in PATH.</li>
    </ul>
  </div>
);

JobBankSearchHelp.aiContext = `
Job Bank Search page help for PATH staff. Clarify that content is external Government of Canada Job Bank content.
Provide practical search guidance: include province code in location (City (PR) or City PR), then refine with in-frame filters.
`;

export default JobBankSearchHelp;
