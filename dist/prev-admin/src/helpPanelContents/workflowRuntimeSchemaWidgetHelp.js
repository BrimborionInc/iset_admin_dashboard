import React from 'react';
import { SpaceBetween } from '@cloudscape-design/components';

const WorkflowRuntimeSchemaWidgetHelp = () => (
  <SpaceBetween size="s">
    <p>Generated schema (steps + components) that the public portal consumes at runtime.</p>
    <ul>
      <li>List view: step order, component counts, and next links. Expand a step for component detail.</li>
      <li>JSON view: exact object returned by the preview endpoint (copy for debugging).</li>
      <li>Regenerate by reselecting the workflow or after publishing updates.</li>
      <li>Use to confirm storageKey uniqueness and branching correctness.</li>
    </ul>
  </SpaceBetween>
);

WorkflowRuntimeSchemaWidgetHelp.aiContext = 'Runtime Schema widget help: generated schema list and JSON export.';
export default WorkflowRuntimeSchemaWidgetHelp;
