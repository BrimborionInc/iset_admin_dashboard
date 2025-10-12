import React from 'react';
import { Alert } from '@cloudscape-design/components';

export default function SlaWidgetHelp() {
  return (
    <div>
      <h1>Service Level Targets</h1>
      <p>
        Use this panel to define the turnaround expectations for each stage of the ISET application lifecycle.
        Targets drive dashboard widgets, overdue alerts, and downstream reporting once persisted to the platform.
      </p>
      <h2>What You Can Configure</h2>
      <ul>
        <li><strong>Stage definitions:</strong> Intake triage, assignment, assessment, and program decision windows.</li>
        <li><strong>Target durations:</strong> Hour-based budgets that feed SLA breach calculations.</li>
        <li><strong>Persona scope:</strong> Which roles are responsible for keeping the SLA on track.</li>
      </ul>
      <Alert type="info" header="Feature under construction">
        Saving and publishing SLA targets will be enabled once the configuration API and persistence schema are finalised.
        In the meantime, use the draft view to agree the desired timings with stakeholders.
      </Alert>
    </div>
  );
}

SlaWidgetHelp.aiContext = 'Widget help: define and publish SLA targets for each application stage.';
