import React from "react";

const QueryEditorHelp = () => (
  <div>
    <p>
      The Query Editor dashboard is a configuration workspace for running SQL statements and creating server-side SQL
      export files against the active environment database.
    </p>

    <h3>What belongs here</h3>
    <ul>
      <li>Operational SQL statements for diagnostics or updates.</li>
      <li>Workbench-style server export of a selected database and table subset into one self-contained `.sql` file.</li>
      <li>Results review for SELECT queries and status output for writes.</li>
      <li>Environment awareness to confirm where the SQL or export will run.</li>
    </ul>

    <h3>Current status</h3>
    <p>
      This dashboard is intended for System Administrators. The SQL Editor tab supports multiple semicolon-delimited
      statements per request, and the Server Export tab can write a self-contained dump file directly on the admin
      server using the selected database, table list, and output path.
    </p>
  </div>
);

QueryEditorHelp.aiContext =
  "You are assisting a System Administrator using the Query Editor configuration dashboard. " +
  "Explain how to run one or more SQL statements, load uploaded .sql files into the editor before execution, " +
  "use the Server Export tab to create a self-contained dump file for selected tables, and confirm the active environment.";

export default QueryEditorHelp;
