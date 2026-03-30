import React from 'react';

const JobBankSearchHelp = () => (
  <div>
    <p>
      This page links staff into external Job Bank content provided by the Government of Canada.
      PATH can still build the right Job Bank search or profession-summary URL, but Job Bank now
      blocks embedded framing, so the results must open in a separate browser tab.
    </p>

    <h3>How to use this page</h3>
    <ul>
      <li>Use the <code>Find a Job</code> tab for the original Job Bank posting search flow.</li>
      <li>Use the <code>Explore a Profession</code> tab to search PATH&apos;s 2021 NOC reference data, then open the matching Job Bank profession summary page in a new tab.</li>
      <li>In the profession tab, select a profession suggestion when possible for the most reliable match.</li>
      <li>Location is optional in the profession tab; leave it blank to open the Canada-wide summary.</li>
      <li>Use <code>Open current Job Bank page</code> or <code>Open results in new tab</code> to launch the current Job Bank destination.</li>
      <li>Refine further using filters or navigation on the Job Bank page itself after it opens.</li>
    </ul>

    <h3>Location tips</h3>
    <ul>
      <li>Include a province or territory code whenever possible.</li>
      <li>Preferred formats: <code>City (PR)</code> or <code>City PR</code> (for example, <code>Ottawa (ON)</code>).</li>
      <li>If you only enter a city name (for example, <code>Ottawa</code>), Job Bank may broaden to various locations.</li>
    </ul>

    <h3>Important notes</h3>
    <ul>
      <li>This is still an external site; PATH cannot edit or control Job Bank&apos;s internal content.</li>
      <li>The profession tab resolves the selected PATH NOC title to Job Bank&apos;s own occupation identifier before building the summary-page URL.</li>
      <li>As of 2026-03-30, Job Bank responses send a same-origin frame policy, so browsers refuse to display them inside PATH.</li>
    </ul>
  </div>
);

JobBankSearchHelp.aiContext = `
Job Bank Search page help for PATH staff. Clarify that content is external Government of Canada Job Bank content.
Explain that the page now has two tabs: Find a Job and Explore a Profession.
Call out that Explore a Profession uses PATH's 2021 NOC reference suggestions plus a resolver step to reach the matching Job Bank profession summary page.
Explain that Job Bank currently blocks embedded framing, so PATH now prepares the destination URL and staff continue on Job Bank in a separate tab.
Provide practical location guidance: include province code in location (City (PR) or City PR), then refine with Job Bank filters after the new tab opens.
`;

export default JobBankSearchHelp;
