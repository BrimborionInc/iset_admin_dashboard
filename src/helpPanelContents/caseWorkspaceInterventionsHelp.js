import React from "react";

const CaseWorkspaceInterventionsHelp = () => (
  <div>
    <p>
      Interventions are the actual services, training, or activities the client is participating in.
      Keep them current so the case record, reminders, and reporting all reflect what is really
      happening.
    </p>

    <h3>When updating interventions</h3>
    <ul>
      <li>Keep start and end dates aligned to the client&apos;s real schedule because those dates drive reminders and milestone tracking.</li>
      <li>Record the intervention type, description, and outcome clearly so another staff member can understand what support was provided.</li>
      <li>Assign the correct budget or funding context so finance and casework stay aligned.</li>
      <li>Use notes for delivery details, barriers, employer or training-provider context, and follow-up actions the team should remember.</li>
    </ul>

    <h3>Quality checks</h3>
    <ul>
      <li>Resolve validation warnings promptly because they often mean missing reporting data or inconsistent dates.</li>
      <li>If an intervention is paused, cancelled, or changed, update the status so dashboards and reminders stay accurate.</li>
      <li>Multiple interventions may be appropriate when they support the client&apos;s employment goal, but each one should still be justified and tracked clearly.</li>
      <li>For employer-based interventions such as wage subsidy, make sure required employer information is in the file before treating the intervention as ready to move forward.</li>
      <li>Review completed interventions before closing the related action plan, and make sure any required post-intervention follow-up, including the 12-week follow-up where applicable, is recorded before closing the case.</li>
    </ul>
  </div>
);

CaseWorkspaceInterventionsHelp.aiContext = `You are helping with the Interventions widget on the Case Workspace. Explain interventions as the actual client activities or supports being delivered. Emphasize accurate dates, status, outcome details, and clear linkage to the client's employment goal. Mention that multiple interventions can exist when justified, and remind the user to keep employer or provider requirements and other supporting details documented in the file. When the intervention ends, remind the user to capture the outcome and complete any required post-intervention follow-up, including the 12-week follow-up where applicable, before the case is closed.`;

export default CaseWorkspaceInterventionsHelp;
