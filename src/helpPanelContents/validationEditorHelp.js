import React from 'react';
import { Header, Box, SpaceBetween, ExpandableSection, StatusIndicator, Link } from '@cloudscape-design/components';

const codeStyle = { fontFamily: 'monospace', background: '#f5f5f5', padding: '2px 4px', borderRadius: 4 };
const BlockCode = ({ children }) => (
  <Box as="pre" fontSize="body-s" padding="s" backgroundColor="#f5f5f5" borderRadius="s" overflow="auto">{children}</Box>
);

const ValidationEditorHelp = () => (
  <SpaceBetween size="l">
    <Header variant="h2">Validation (Beta)</Header>
    <Box variant="p">Define field-level rules that run on value change or step submit. Rules can show messages and optionally block navigation.</Box>

    <ExpandableSection headerText="1. Required vs Predicate Rules" variant="container" defaultExpanded>
      <SpaceBetween size="s">
        <Box variant="p"><strong>Required</strong>: if empty on submit, shows the base error message.</Box>
        <Box variant="p"><strong>Predicate rules</strong> use <Link external href="https://jsonlogic.com">json-logic</Link>. If the expression returns truthy, the rule fires.</Box>
      </SpaceBetween>
    </ExpandableSection>

    <ExpandableSection headerText="2. Triggers" variant="container" defaultExpanded>
      <Box variant="p">Use <code style={codeStyle}>change</code> for live feedback, <code style={codeStyle}>submit</code> for end-of-step checks. You can select both.</Box>
    </ExpandableSection>

    <ExpandableSection headerText="3. json-logic Primer" variant="container" defaultExpanded>
      <SpaceBetween size="s">
        <Box variant="p">Equality: <code style={codeStyle}>{'{ "==": [ { "var": "age" }, 18 ] }'}</code></Box>
        <Box variant="p">Field access: <code style={codeStyle}>{'{ "var": "fieldName" }'}</code></Box>
        <Box variant="p">Operators: <code style={codeStyle}>==</code>, <code style={codeStyle}>&gt;</code>, <code style={codeStyle}>&lt;=</code>, <code style={codeStyle}>and</code>, <code style={codeStyle}>or</code>, <code style={codeStyle}>!</code></Box>
        <BlockCode>{`Radio equality\n{ "==": [ { "var": "eligibility" }, "no" ] }\n\nNumeric range 16-65\n{ "and": [ { ">=": [ { "var": "age" }, 16 ] }, { "<=": [ { "var": "age" }, 65 ] } ] }\n\nRequire email when contactMethod == 'email' and email empty\n{ "and": [ { "==": [ { "var": "contactMethod" }, "email" ] }, { "!": [ { "var": "email" } ] } ] }`}</BlockCode>
      </SpaceBetween>
    </ExpandableSection>

    <ExpandableSection headerText="4. Blocking vs Non-Blocking" variant="container">
      <Box variant="p">"Block on fail" prevents navigation; warnings (non-blocking) still display but allow progress.</Box>
    </ExpandableSection>

    <ExpandableSection headerText="5. Message Strategy" variant="container">
      <SpaceBetween size="s">
        <Box variant="p">Be concise and action-oriented ("Enter your age" not "Age invalid").</Box>
        <Box variant="p">Provide EN + FR. FR falls back to EN if empty.</Box>
        <Box variant="p">Ordering matters: first blocking rule that fires stops later blocking rules.</Box>
      </SpaceBetween>
    </ExpandableSection>

    <ExpandableSection headerText="6. Troubleshooting" variant="container">
      <SpaceBetween size="s">
        <Box variant="p">Rule not firing? Verify var names match component storage keys.</Box>
        <Box variant="p">Too many live errors? Move rules to submit trigger.</Box>
        <Box variant="p">Complex cross-field business logic may migrate server-side later.</Box>
      </SpaceBetween>
    </ExpandableSection>

    <StatusIndicator type="info">Beta: schema format may evolve.</StatusIndicator>
  </SpaceBetween>
);

// Optional global registration (if app expects mapping by id)
if (typeof window !== 'undefined') {
  window.__helpPanelContent = window.__helpPanelContent || {};
  window.__helpPanelContent.validationEditorHelp = ValidationEditorHelp;
}

export default ValidationEditorHelp;
