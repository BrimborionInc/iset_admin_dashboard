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

// Keep this help in sync with validation panel capabilities (unified schema vNext)
const ModifyIntakeStepHelp = () => (
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

      <Section header="5. Validation (Unified Schema)">
        <p>Each component's <code>validation</code> object now follows the unified vNext schema:</p>
        <Code>{`validation: {
  required: boolean,
  requiredMessage: { en: string, fr: string },
  rules: [
    {
      id: string,
      type: 'predicate'|'atLeastOne'|'range'|'length'|'pattern'|'compare',
      trigger: string[],            // e.g. ['submit'] or ['change','submit']
      severity: 'error'|'warn',
      block: boolean,               // if true and severity==='error' stops navigation
      message: { en: string, fr: string },
      // type-specific fields (see below)
    }
  ]
}`}</Code>
        <p><strong>Required</strong>: Basic presence check. For radios we also evaluate on change (more component types will adopt live checking). Use the bilingual <code>requiredMessage</code> to tailor guidance.</p>
        <p><strong>Rule Types</strong>:</p>
        <ul>
          <li><strong>predicate</strong>: Raw json-logic expression describing an invalid state (<em>true = fail</em>).</li>
          <li><strong>atLeastOne</strong>: Ensure one of a list of related component names is populated (<code>fields: string[]</code>).</li>
          <li><strong>range</strong>: Numeric boundaries (<code>min</code>, <code>max</code>; inclusive).</li>
          <li><strong>length</strong>: String length constraints (<code>minLength</code>, <code>maxLength</code>).</li>
          <li><strong>pattern</strong>: Regex validation (<code>pattern</code>, optional <code>flags</code>).</li>
          <li><strong>compare</strong>: Cross-field relational check (<code>left</code>, <code>op</code>, <code>right</code>) where operands are field names or literals.</li>
        </ul>
        <p><strong>Triggers</strong>: <code>submit</code> always fires during navigation attempts. Add <code>change</code> for instant feedback (currently most effective for radios, expanding soon).</p>
        <p><strong>Severity & Blocking</strong>: <code>severity</code> differentiates between hard errors and advisory warnings. A failing rule with <code>severity='error'</code> and <code>block=true</code> prevents continuing. Warnings are informational (runtime UI differentiation pending).</p>
        <p><strong>Migration Notes</strong>: Legacy fields (<code>errorMessage</code>, ad-hoc <code>pattern</code>, <code>minLength</code>) are auto-transformed into this schema on load; editing always persists the unified shape.</p>
        <p><strong>Authoring Tips</strong>:</p>
        <ul>
          <li>Prefer purpose-built rule types (range/length/pattern) over equivalent predicate logic for readability.</li>
          <li>Keep messages user-focused: actionable, concise, and bilingual.</li>
          <li>Reserve <code>block=false</code> for guidance rules that shouldn't halt progress (e.g., soft formatting hints).</li>
          <li>Group related fields via <code>atLeastOne</code> instead of multiple predicates.</li>
        </ul>
      </Section>

      <Section header="6. JSON Logic Fundamentals (Predicate Rules)">
        <p>Only <strong>predicate</strong> rules require raw json-logic. A predicate is <em>true when invalid</em>.</p>
        <Code>{`{
  "==": [ { "var": "email" }, "" ]
}`}</Code>
        <p><strong>Common Operators</strong>: <code>==</code>, <code>!=</code>, <code>!</code>, <code>&gt;</code>, <code>&gt;=</code>, <code>&lt;</code>, <code>&lt;=</code>, <code>and</code>, <code>or</code>, <code>in</code>.</p>
        <p><strong>Field Reference</strong>: <code>{`{ "var": "componentName" }`}</code> where <em>componentName</em> is the component's name.</p>
        <p><strong>Empty / Missing</strong> examples:</p>
        <Code>{`// Equals empty string
{ "==": [ { "var": "my-input" }, "" ] }

// Missing/undefined (negation)
{ "!": { "var": "my-input" } }`}</Code>
      </Section>

      <Section header="7. Examples (Unified Types)">
        <p><strong>A. Range: Age must be 18–64</strong></p>
        <Code>{`type: 'range', min: 18, max: 64`}</Code>
        <p><strong>B. Length: Postal code length exactly 6 (no space)</strong></p>
        <Code>{`type: 'length', minLength: 6, maxLength: 6`}</Code>
        <p><strong>C. Pattern: Canadian postal code (loose)</strong></p>
        <Code>{`type: 'pattern', pattern: '^[A-Za-z]\\d[A-Za-z][ ]?\\d[A-Za-z]\\d$'`}</Code>
        <p><strong>D. Compare: Confirm email matches</strong></p>
        <Code>{`type: 'compare', left: 'email', op: '==', right: 'confirm-email'`}</Code>
        <p><strong>E. AtLeastOne: Provide phone or email</strong></p>
        <Code>{`type: 'atLeastOne', fields: ['mobile-phone','email']`}</Code>
        <p><strong>F. Predicate: Disallow value 'other'</strong></p>
        <Code>{`type: 'predicate', when: { "==": [ { "var": "some-radio" }, "other" ] }`}</Code>
      </Section>

      <Section header="8. Error & Warning Message Crafting">
        <ul>
          <li>Lead with the action: "Enter", "Select", "Provide".</li>
          <li>Explain the rule if non-obvious (e.g., formatting or range).</li>
          <li>Keep warnings constructive ("We recommend...").</li>
          <li>Maintain EN/FR equivalence.</li>
        </ul>
      </Section>

      <Section header="9. Rule Ordering Strategy">
        <p>Order: presence → simple field constraints → cross-field comparisons → business predicates. First blocking error stops later rule evaluation for that component.</p>
      </Section>

      <Section header="10. Troubleshooting">
        <ul>
          <li><strong>Rule not firing?</strong> Confirm component <code>name</code> matches references (or fields array).</li>
          <li><strong>Regex failing?</strong> Escape backslashes: <code>\\d</code>, not <code>\d</code>.</li>
          <li><strong>Legacy fields showing?</strong> Save & re-open; migration runs on load.</li>
          <li><strong>Live change feedback missing?</strong> Only some components currently evaluate on <code>change</code>.</li>
        </ul>
      </Section>

      <Section header="11. Roadmap (Next Phases)">
        <ul>
          <li>Runtime warnings UI (non-blocking banner & inline styling).</li>
          <li>Rule drag reordering.</li>
          <li>Expression builder (visual predicate composition).</li>
          <li>AI rule suggestions & message refinement.</li>
          <li>Step & workflow-level validation layers.</li>
        </ul>
        <StatusIndicator type="in-progress">Validation vNext</StatusIndicator>
      </Section>
    </SpaceBetween>
  </div>
);

export default ModifyIntakeStepHelp;
