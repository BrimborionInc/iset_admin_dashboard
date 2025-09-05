import React from 'react';
import { SpaceBetween } from '@cloudscape-design/components';

const WorkflowLibraryWidgetHelp = () => (
  <SpaceBetween size="s">
    <p>Browse and manage stored workflows. Selecting a row loads full workflow details into other widgets.</p>
    <ul>
      <li><b>Create New</b>: Starts a draft workflow (add steps in Modify view).</li>
      <li><b>Modify</b>: Opens detailed editor for steps and routing.</li>
      <li><b>Delete</b>: Permanently removes the workflow (irreversible).</li>
      <li>Filter box narrows by name (client‑side).</li>
    </ul>
    <p>Status column indicates current lifecycle; only <em>draft</em> should be edited.</p>
  </SpaceBetween>
);

WorkflowLibraryWidgetHelp.aiContext = 'Workflow Library widget help: list, filter, create, modify, delete workflows.';
export default WorkflowLibraryWidgetHelp;
