import React from "react";

const CaseWorkspaceInterventionsHelp = () => (
  <div>
    <p>
      Interventions break the action plan into measurable activities. Each record captures the ILMP details needed for
      reporting and for tracking the client&apos;s progress.
    </p>

    <h3>When updating interventions</h3>
    <ul>
      <li>Keep start and end dates in step with the client&apos;s schedule &mdash; they feed reminders and status badges.</li>
      <li>Record the ILMP intervention code, description, and outcome so exports tell a clear story.</li>
      <li>Assign the correct budget pot to ensure finance totals reconcile with spending.</li>
      <li>Use notes for key delivery partners, barriers, or follow-up actions that the team should remember.</li>
    </ul>

    <h3>Quality checks</h3>
    <ul>
      <li>Resolve validation warnings promptly-they usually indicate missing ILMP data or inconsistent dates.</li>
      <li>If an intervention is paused or cancelled, update the status so dashboards and reminders stay accurate.</li>
      <li>Completed interventions should be reviewed before closing the action plan.</li>
    </ul>
  </div>
);

CaseWorkspaceInterventionsHelp.aiContext = `You are helping with the Interventions widget on the Case Dashboard. It edits interventions for the selected action plan including ILMP fields, budget pot mappings, and compliance indicators.`;

export default CaseWorkspaceInterventionsHelp;
