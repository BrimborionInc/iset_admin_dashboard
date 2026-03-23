import React from "react";

const QueryEditorHelp = () => (
  <div>
    <p>
      The Query Editor dashboard is a configuration workspace for running one or more SQL statements against the
      active environment database.
    </p>

    <h3>What belongs here</h3>
    <ul>
      <li>Operational SQL statements for diagnostics or updates.</li>
      <li>Results review for SELECT queries and status output for writes.</li>
      <li>Environment awareness to confirm where the query will run.</li>
    </ul>

    <h3>Current status</h3>
    <p>
      This dashboard is intended for System Administrators and can run multiple SQL statements per request.
      You can load a `.sql` or `.txt` file into the editor, review the SQL, and then run it through the same Query
      Editor execution flow.
    </p>
  </div>
);

QueryEditorHelp.aiContext =
  "You are assisting a System Administrator using the Query Editor configuration dashboard. " +
  "Explain how to run one or more SQL statements, review results, confirm the active environment, " +
  "and that uploaded .sql files are loaded into the editor before execution.";

export default QueryEditorHelp;
