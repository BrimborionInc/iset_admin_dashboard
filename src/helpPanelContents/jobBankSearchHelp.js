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
      <li>Use the <code>Find a Job</code> tab for the original Job Bank posting search flow.</li>
      <li>Use the <code>Explore a Profession</code> tab to search PATH&apos;s 2021 NOC reference data, then open the matching Job Bank profession summary in the embedded frame.</li>
      <li>In the profession tab, select a profession suggestion when possible for the most reliable match.</li>
      <li>Location is optional in the profession tab; leave it blank to open the Canada-wide summary.</li>
      <li>Refine further using filters or navigation inside the embedded Job Bank page.</li>
      <li>Use “Open results in new tab” if you need more space while updating PATH.</li>
    </ul>

    <h3>Location tips</h3>
    <ul>
      <li>Include a province or territory code whenever possible.</li>
      <li>Preferred formats: <code>City (PR)</code> or <code>City PR</code> (for example, <code>Ottawa (ON)</code>).</li>
      <li>If you only enter a city name (for example, <code>Ottawa</code>), Job Bank may broaden to various locations.</li>
    </ul>

    <h3>Important notes</h3>
    <ul>
      <li>This is an external site in an embedded frame; PATH cannot edit or control its internal content.</li>
      <li>The profession tab resolves the selected PATH NOC title to Job Bank&apos;s own occupation identifier before loading the summary page.</li>
      <li>If the frame fails to load, open the same query in a new tab and continue your assessment in PATH.</li>
    </ul>
  </div>
);

JobBankSearchHelp.aiContext = `
Job Bank Search page help for PATH staff. Clarify that content is external Government of Canada Job Bank content.
Explain that the page now has two tabs: Find a Job and Explore a Profession.
Call out that Explore a Profession uses PATH's 2021 NOC reference suggestions plus a resolver step to reach the matching Job Bank profession summary page.
Provide practical location guidance: include province code in location (City (PR) or City PR), then refine with in-frame filters.
`;

export default JobBankSearchHelp;
