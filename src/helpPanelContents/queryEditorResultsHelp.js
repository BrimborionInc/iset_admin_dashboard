import React from "react";

const QueryEditorResultsHelp = () => (
  <div>
    <p>This widget displays the output of the most recent query.</p>
    <ul>
      <li>Table tab: SELECT results (up to 100 rows).</li>
      <li>JSON tab: structured results payload.</li>
      <li>CSV tab: results mapped into CSV for copy/paste.</li>
      <li>Write statements show rows affected and status in JSON/CSV views.</li>
      <li>If multiple statements run, use the statement selector to switch result sets.</li>
      <li>Errors are displayed verbatim for troubleshooting.</li>
    </ul>
  </div>
);

QueryEditorResultsHelp.aiContext =
  "You are assisting a System Administrator reading Query Editor results. " +
  "Explain the Table, JSON, and CSV tabs, the statement selector for multiple statements, and how write results and errors are presented.";

export default QueryEditorResultsHelp;
