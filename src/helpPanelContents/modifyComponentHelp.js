import React from 'react';
import { Alert, SpaceBetween, Box, ExpandableSection, StatusIndicator } from '@cloudscape-design/components';

const Section = ({ header, children, variant = 'container', defaultExpanded }) => (
  <ExpandableSection headerText={header} variant={variant} defaultExpanded={defaultExpanded}>
    <SpaceBetween size="s">{children}</SpaceBetween>
  </ExpandableSection>
);

const Code = ({ children }) => (
  <Box as="pre" fontSize="body-s" padding="s" backgroundColor="background-code-editor" style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{children}</Box>
);

const ModifyComponentHelp = () => (
  <div>
    <SpaceBetween direction="vertical" size="l">
      <Alert type="info" header="Modify Intake Step Help">
        Use this workspace to build a single intake step. Drag components from the Library, reorder them in the Working Area, edit text inline, and refine structured settings & validation in the right-hand panel. Save to persist; Copy to clone; Delete to remove the step.
      </Alert>

      <Section header="1. Layout Overview" defaultExpanded>
        <p><strong>Library (left)</strong>: Add new components (radios, inputs, checkboxes, text blocks, etc.).</p>
        <p><strong>Working Area (centre)</strong>: Live GOV.UK preview with inline text editing (labels, legends, hints, option text). Drag the handle (⠿) to reorder. Click a card to select.</p>
        <p><strong>Properties & Validation (right)</strong>: Precise configuration (classes, attributes, options, validation rules, translations).</p>
        <p><strong>Toolbar (top)</strong>: Undo / Redo, Save, Save as New, Delete, Cancel navigation.</p>
      </Section>

      <Section header="2. Adding & Editing Components">
        <p>Click a Library item to append it, or drag it into position. Newly added choice components (radios/checkboxes) get sane defaults (Yes / No) to reduce friction.</p>
        <p>Inline edit: select a component then click directly on highlighted dashed areas (legend, label, hint, option labels). Press Enter to commit (Shift+Enter for newline where allowed).</p>
        <p>Structured edits: use the Component Properties table (hover tooltips for guidance). Fields with curated values (classes, autocomplete, inputmode, etc.) offer a picker plus custom override.</p>
      </Section>

      <Section header="3. Managing Options (Radios / Checkboxes)">
        <p><strong>Source Modes</strong>:</p>
        <ul>
          <li><strong>Static</strong>: Manually maintain the option list.</li>
          <li><strong>Dynamic</strong>: Options fetched at runtime from an endpoint (list stays empty; endpoint stored).</li>
          <li><strong>Snapshot</strong>: Fetch once now; result becomes an editable static list.</li>
        </ul>
        <p>Duplicate value and empty label checks surface as red badges. Ensure each option has a stable value (used in json-logic & submission payload).</p>
      </Section>

      <Section header="4. Page (Step) Properties">
        <p>Edit Step <strong>Name</strong> & <strong>Status</strong> (Active / Inactive). Inactive may hide from production flows depending on consuming logic.</p>
      </Section>

      <Section header="5. Validation (Beta)">
        <p>Each component may declare a <code>validation</code> object containing:</p>
        <ul>
          <li><strong>required</strong>: Boolean. Checked on submit (radios also on change; more types coming).</li>
          <li><strong>errorMessage</strong>: Base bilingual message used when required fails (unless a rule supplies one).</li>
          <li><strong>rules</strong>: Array of predicate rules: <code>{'{'} id, trigger[], kind:'predicate', when, message{'{'}en,fr{'}'}, severity:'error'|'warn', block {'}'} </code>.</li>
        </ul>
        <p><strong>Triggers</strong>:</p>
        <ul>
          <li><strong>submit</strong>: Evaluated during attempt to proceed.</li>
          <li><strong>change</strong>: Live feedback (current implementation: radios).</li>
        </ul>
        <p><strong>Blocking</strong>: A failing rule with <code>block=true</code> & severity error prevents navigation. Non-blocking errors / warnings can surface guidance (UI distinction in roadmap).</p>
        <p><strong>AI Generate Messages</strong>: Seeds base bilingual required messages heuristically based on component type and label/legend.</p>
      </Section>

      <Section header="6. JSON Logic Fundamentals">
        <p>Rules use <a href="https://jsonlogic.com" target="_blank" rel="noreferrer">json-logic</a>. A rule is considered a failure when its expression evaluates <em>true</em> (i.e., the predicate describes the invalid state). Keep expressions small & composable.</p>
        <p>Basic shape:</p>
        <Code>{`{\n  "==": [ { "var": "fieldName" }, "expectedValue" ]\n}`}</Code>
        <p><strong>Common Operators</strong>: <code>==</code>, <code>!=</code>, <code>!</code>, <code>&gt;</code>, <code>&gt;=</code>, <code>&lt;</code>, <code>&lt;=</code>, <code>and</code>, <code>or</code>, <code>in</code>.</p>
        <p><strong>Field Reference</strong>: <code>{`{ "var": "componentName" }`}</code> where <em>componentName</em> is the component's name prop (auto-generated but editable).</p>
        <p><strong>Empty / Missing</strong> patterns:</p>
        <Code>{`// Equals empty string\n{ "==": [ { "var": "my-input" }, "" ] }\n\n// Missing/undefined (negation)\n{ "!": { "var": "my-input" } }`}</Code>
      </Section>

      <Section header="7. JSON Logic Examples">
        <p><strong>A. Require radio selection (explicit rule; required flag preferred)</strong></p>
        <Code>{`{ "==": [ { "var": "eligibility-radio" }, "" ] }`}</Code>
        <p><strong>B. Disallow a specific radio value (e.g., 'false')</strong></p>
        <Code>{`{ "==": [ { "var": "eligibility-radio" }, "false" ] }`}</Code>
        <p><strong>C. Conditional requirement: If child = true, children-count must be filled</strong></p>
        <Code>{`{\n  "and": [\n    { "==": [ { "var": "has-dependent-children" }, "true" ] },\n    { "==": [ { "var": "number-of-children" }, "" ] }\n  ]\n}`}</Code>
        <p><strong>D. Age must be ≥ 18 (numeric coercion via + 0)</strong></p>
        <Code>{`{ "<": [ { "+": [ { "var": "age" }, 0 ] }, 18 ] }`}</Code>
        <p><strong>E. Province not in whitelist (invalid if outside set)</strong></p>
        <Code>{`{ "!": { "in": [ { "var": "province" }, ["ON","QC","BC"] ] } }`}</Code>
        <p><strong>F. Checkbox group missing required 'other'</strong></p>
        <Code>{`{ "!": { "in": [ "other", { "var": "support-types" } ] } }`}</Code>
        <p><strong>G. Email confirmation mismatch</strong></p>
        <Code>{`{ "!=": [ { "var": "email" }, { "var": "confirm-email" } ] }`}</Code>
        <p><strong>H. Both mutually exclusive flags selected</strong></p>
        <Code>{`{ "and": [\n  { "!=": [ { "var": "benefit-a" }, "" ] },\n  { "!=": [ { "var": "benefit-b" }, "" ] }\n] }`}</Code>
      </Section>

      <Section header="8. Error Message Crafting">
        <ul>
          <li>Lead with action: "Select an option", "Enter your postal code".</li>
          <li>Avoid technical jargon; users should not see internal field names.</li>
          <li>Maintain bilingual parity; keep EN/FR updated together.</li>
          <li>Be specific for predicate logic ("You must be 18 or older").</li>
        </ul>
      </Section>

      <Section header="9. Rule Ordering Strategy">
        <p>Place simpler presence checks first, then business logic, then cross-field consistency. First blocking error halts navigation; later rules are skipped once blocked.</p>
      </Section>

      <Section header="10. Troubleshooting">
        <ul>
          <li><strong>Rule not firing?</strong> Confirm the component <code>name</code> matches the <code>var</code> reference.</li>
          <li><strong>JSON not updating?</strong> The editor only commits valid JSON—validate externally if needed.</li>
          <li><strong>Live validation missing?</strong> Only radios currently trigger change-based evaluation.</li>
          <li><strong>Duplicate options?</strong> Resolve red badge warnings by making values unique.</li>
        </ul>
        <p>For complex expressions, stage interim rules to validate sub-parts.</p>
      </Section>

      <Section header="11. Roadmap (Planned Enhancements)">
        <ul>
          <li>On-change validation for inputs & checkbox groups.</li>
          <li>Visual differentiation for warnings.</li>
          <li>Rule reordering UI (drag).</li>
          <li>Expression builder (no raw JSON needed).</li>
          <li>AI rule suggestion & pattern templates.</li>
        </ul>
        <StatusIndicator type="in-progress">Validation Beta</StatusIndicator>
      </Section>
    </SpaceBetween>
  </div>
);

export default ModifyComponentHelp;
