import React from "react";

const QueryEditorInputHelp = () => (
  <div>
    <p>Use this widget to run SQL text or create a server-side SQL export for the active environment database.</p>
    <ul>
      <li>`SQL Editor`: run multiple statements separated by semicolons.</li>
      <li>`SQL Editor`: uploading a `.sql` or `.txt` file loads its contents into the editor for review before you run it.</li>
      <li>`SQL Editor`: results are capped to 100 rows per SELECT for display.</li>
      <li>`Server Export`: select one database, choose the base tables to include, and write a self-contained `.sql` file directly on the admin server.</li>
      <li>The export mode is fixed to `Dump Structure and Data`, `Export to a Self-Contained File`, and `Include Create Schema`.</li>
    </ul>
  </div>
);

QueryEditorInputHelp.aiContext =
  "You are assisting a System Administrator using the Query Editor input widget. " +
  "Explain the SQL Editor and Server Export tabs, how uploaded .sql files are loaded into the editor before execution, " +
  "that query results are capped at 100 rows per SELECT, and that server export writes a self-contained dump file for selected tables.";

export default QueryEditorInputHelp;
