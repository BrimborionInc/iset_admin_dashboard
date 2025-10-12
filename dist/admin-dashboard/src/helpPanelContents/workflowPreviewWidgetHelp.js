import React from 'react';
import { SpaceBetween } from '@cloudscape-design/components';

const WorkflowPreviewWidgetHelp = () => (
  <SpaceBetween size="s">
    <p>Visualize and test the workflow without leaving the admin console.</p>
    <ul>
      <li><b>Graph</b>: Auto‑laid out DAG of steps and conditional edges.</li>
      <li><b>Interactive</b>: Simulates applicant progression; validates rules and branching.</li>
      <li><b>Summary</b>: Shows any summary-list components to review collected answers.</li>
      <li><b>Output JSON</b>: Snapshot of answer object (null = unanswered).</li>
      <li>Language controls let you verify bilingual content fidelity.</li>
    </ul>
    <p>Finish action shows final data; nothing is persisted while previewing.</p>
  </SpaceBetween>
);

WorkflowPreviewWidgetHelp.aiContext = 'Workflow Preview widget help: graph, interactive runner, summary, output JSON.';
export default WorkflowPreviewWidgetHelp;
