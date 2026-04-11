import React from 'react';

export default function SlaWidgetHelp() {
  return (
    <div>
      <h1>Workflow Timing Targets</h1>
      <p>
        Use this panel to define the turnaround expectations for each stage of the ISET application lifecycle.
        Targets drive dashboard widgets, overdue alerts, and downstream reporting once persisted to the platform.
      </p>
      <h2>What You Can Configure</h2>
      <ul>
        <li><strong>Stage definitions:</strong> Assignment, EI Status Verification, Assessment, Program decision, and document-request reminder/closure windows.</li>
        <li><strong>Target durations:</strong> Hour-based budgets that feed due, overdue, and timeline calculations.</li>
        <li><strong>Status-based routing:</strong> Assigned files with no EI eligibility recorded now use the EI Status Verification target before they move into the Assessment target.</li>
      </ul>
      <p>
        Current implementation note: application due and overdue badges still use the existing submission-based milestone model.
        The active timing stage is chosen from application status, assignment state, and whether <code>assessment_esdc_eligibility</code> has been recorded.
      </p>
    </div>
  );
}

SlaWidgetHelp.aiContext = 'Widget help: define and publish workflow timing targets for each application stage.';
