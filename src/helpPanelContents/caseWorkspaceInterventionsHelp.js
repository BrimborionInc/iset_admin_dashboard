import React from "react";

const CaseWorkspaceInterventionsHelp = () => (
  <div>
    <p>
      Interventions capture the detailed activities required by the ILMP schema, including codes, dates, outcomes, costs,
      and budget-pots. They drive both compliance and finance exports.
    </p>

    <h3>Implementation notes</h3>
    <ul>
      <li>Provide editors for ILMP 1.4 fields: code, description, start/end, duration, outcome, notes.</li>
      <li>Map each intervention to a budget pot; support multi-pot splits in future iterations.</li>
      <li>Surface validation badges when finance or ILMP rules fail so coordinators can resolve issues early.</li>
    </ul>
  </div>
);

CaseWorkspaceInterventionsHelp.aiContext = `You are helping with the Interventions widget on the Case Dashboard. It edits interventions for the selected action plan including ILMP fields, budget pot mappings, and compliance indicators.`;

export default CaseWorkspaceInterventionsHelp;
