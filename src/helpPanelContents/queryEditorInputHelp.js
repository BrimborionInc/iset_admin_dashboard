import React from "react";

const QueryEditorInputHelp = () => (
  <div>
    <p>Use this widget to paste, type, or load SQL statements for the active environment database.</p>
    <ul>
      <li>Multiple statements are allowed; separate each with a semicolon.</li>
      <li>Results are capped to 100 rows per SELECT for display.</li>
      <li>Uploading a `.sql` or `.txt` file loads its contents into the editor for review before you run it.</li>
      <li>SQL file uploads are limited to 900 KB so the request stays within the server's 1 MB JSON limit.</li>
    </ul>
  </div>
);

QueryEditorInputHelp.aiContext =
  "You are assisting a System Administrator using the Query Editor input widget. " +
  "Explain how to run one or more SQL statements separated by semicolons, that results are capped at 100 rows per SELECT, " +
  "and that uploaded .sql files are loaded into the editor before execution with a 900 KB upload limit.";

export default QueryEditorInputHelp;
