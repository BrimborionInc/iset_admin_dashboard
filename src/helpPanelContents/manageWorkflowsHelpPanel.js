import React from 'react';
import { SpaceBetween, Box } from '@cloudscape-design/components';

const ManageWorkflowsHelpPanel = () => {
  return (
    <SpaceBetween size="s">
      <p>
        Use this dashboard to assemble, inspect, and publish end‑to‑end application workflows.
        A workflow is an ordered set of intake steps plus routing logic that controls progression
        and branching. Draft workflows are editable; publishing freezes a snapshot used by the
        public portal runtime.
      </p>
      <Box>
        <h3>Widgets</h3>
        <ul>
          <li><strong>Workflow Library</strong>: Browse, filter, create, modify, or delete workflows.</li>
          <li><strong>Workflow Properties</strong>: Edit name & lifecycle status; view audit timestamps.</li>
          <li><strong>Workflow Preview</strong>: Visual graph layout, interactive step runner, summary and output JSON.</li>
          <li><strong>Runtime Schema</strong>: Generated read‑only schema (steps + components) used by the portal.</li>
        </ul>
      </Box>
      <Box>
        <h3>Statuses</h3>
        <ul>
          <li><b>draft</b>: Safe to change; not yet active for applicants.</li>
          <li><b>active</b>: Preferred version in production (avoid destructive edits).</li>
          <li><b>inactive</b>: Retained for history; not used for new sessions.</li>
        </ul>
      </Box>
      <Box>
        <h3>Common Tasks</h3>
        <ul>
          <li>Create a draft in Library &rarr; add steps (Modify) &rarr; validate with Interactive preview &rarr; Publish.</li>
          <li>Use the Runtime Schema to verify storage keys and branching before rollout.</li>
          <li>Copy Output JSON (Preview) when filing support tickets about data capture.</li>
        </ul>
      </Box>
      <Box>
        <h3>Branching & Routing</h3>
        <p>
          Conditional routes are resolved in order. Default routes apply if no condition matches.
          Ensure every terminal step leads somewhere or marks the logical end (Finish in preview).
        </p>
      </Box>
      <Box>
        <h3>Publishing Guidance</h3>
        <ul>
          <li>Always sanity‑check bilingual text in Preview (EN/FR) before publish.</li>
          <li>Publishing persists a versioned snapshot; further edits require a new publish.</li>
          <li>After publish, confirm the public portal picks up the expected schema version.</li>
        </ul>
      </Box>
      <Box fontSize="body-s" color="text-status-inactive">
        Need more? See internal authoring docs or contact the platform team.
      </Box>
    </SpaceBetween>
  );
};

ManageWorkflowsHelpPanel.aiContext = 'Dashboard help: manage workflows (library, properties, preview, runtime schema, publishing).';
export default ManageWorkflowsHelpPanel;
