import React from "react";

const QueryEditorInputHelp = () => (
  <div>
    <p>Use this widget to run SQL statements against the active environment database.</p>
    <ul>
      <li>Multiple statements are allowed; separate each with a semicolon.</li>
      <li>Results are capped to 100 rows per SELECT for display.</li>
    </ul>
  </div>
);

QueryEditorInputHelp.aiContext =
  "You are assisting a System Administrator using the Query Editor input widget. " +
  "Explain how to run one or more SQL statements separated by semicolons and that results are capped at 100 rows per SELECT.";

export default QueryEditorInputHelp;
