import React from "react";

const QueryEditorEnvironmentHelp = () => (
  <div>
    <p>
      This widget shows the active runtime environment so operators can confirm where SQL statements and server exports
      will run.
    </p>
    <p>The Query Editor always uses the same backend database connection for the current environment.</p>
  </div>
);

QueryEditorEnvironmentHelp.aiContext =
  "You are assisting a System Administrator verifying the active environment in Query Editor. " +
  "Reinforce that both SQL execution and server export run against the current environment database and cannot be redirected.";

export default QueryEditorEnvironmentHelp;
