import React from 'react';
import { SpaceBetween } from '@cloudscape-design/components';

const WorkflowPropertiesWidgetHelp = () => (
  <SpaceBetween size="s">
    <p>Edit high‑level attributes of the selected workflow.</p>
    <ul>
      <li><b>Name</b>: Admin display label (not end‑user facing).</li>
      <li><b>Status</b>: draft | active | inactive. Change requires Save.</li>
      <li><b>Publish</b>: Generates an immutable runtime snapshot read by the public portal.</li>
      <li><b>Unsaved</b> badge appears when local edits differ from stored values.</li>
    </ul>
    <p>Creation / Updated timestamps are read‑only audit fields.</p>
  </SpaceBetween>
);

WorkflowPropertiesWidgetHelp.aiContext = 'Workflow Properties widget help: name, status, publish, audit fields.';
export default WorkflowPropertiesWidgetHelp;
