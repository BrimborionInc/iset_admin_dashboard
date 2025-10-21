import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceMonitoringHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Monitoring and Evidence is the control centre for sampling, evidence coverage, findings, and remediation activities across the finance programme.
      </p>
    </Box>
    <Box>
      <strong>Concept</strong>
      <p>
        Help finance and compliance teams demonstrate control effectiveness by tracking required evidence, sampling outputs, and follow-up actions tied to ESDC monitoring cycles.
      </p>
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Measure evidence coverage across transactions, highlighting gaps by pot, vendor, or program.</li>
        <li>Generate sampling sets based on capacity-tier parameters and assign review tasks.</li>
        <li>Log monitoring findings, remediation plans, and deadlines with clear ownership.</li>
      </ul>
    </Box>
    <Box>
      <strong>Widgets in this dashboard</strong>
      <ul>
        <li>Evidence coverage dashboard with filters and gap alerts.</li>
        <li>Sampling task board showing status, reviewers, and sampling rationale.</li>
        <li>Findings log capturing severity, owners, due dates, and links to remediation.</li>
        <li>Evidence bundle generator for packaging documents requested by auditors.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies &amp; notes</strong>
      <ul>
        <li>Relies on capacity tier configuration for sampling rates and cadence.</li>
        <li>Integrates with evidence storage to calculate coverage and access artefact metadata.</li>
        <li>Feeds the Financial Reports dashboard so monitoring outcomes are visible before certification.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceMonitoringHelp.aiContext =
  "Explain the Monitoring & Evidence dashboard: tracking evidence coverage, managing sampling tasks, logging findings, and packaging evidence bundles for audits.";

export default FinanceMonitoringHelp;
