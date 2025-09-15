import React from 'react';
import { Alert, Box, SpaceBetween } from '@cloudscape-design/components';

const UploadConfigDashboardHelp = ({ section }) => {
  const commonIntro = (
    <>
      <p>This panel provides guidance for managing the centralized File Upload configuration. Policy changes are validated, persisted, and audited. Infrastructure values are immutable (environment-driven) and displayed read-only.</p>
      <Alert type="info" header="Auditing">
        Every successful policy update inserts an audit record with changed field summary and actor identity (if available from the auth context).
      </Alert>
    </>
  );
  switch(section) {
    case 'policy':
      return (
        <div>
          <h1>Upload Policy</h1>
          {commonIntro}
          <SpaceBetween size="s">
            <Box>Controls enablement, file size caps, multipart threshold, allowed MIME allowlist, and scan requirement flag.</Box>
            <ul>
              <li><strong>Enabled:</strong> Master on/off switch gating all presign + finalize operations.</li>
              <li><strong>Max Size (MB):</strong> Hard per-object cap; validation occurs at presign.</li>
              <li><strong>Multipart Threshold (MB):</strong> Boundary after which S3 multipart strategy should be used.</li>
              <li><strong>Allowed MIME Types:</strong> Strict allowlist enforced both at presign and finalize phases.</li>
              <li><strong>Scan Required:</strong> Advisory flag indicating downstream usage should wait for AV clearance.</li>
            </ul>
            <Alert header="Guardrails" type="info">Warnings surface when threshold ≥ max size or size exceeds recommended performance envelope (&gt;200MB).</Alert>
          </SpaceBetween>
        </div>
      );
    case 'retention':
      return (
        <div>
          <h1>Retention</h1>
          {commonIntro}
          <p>Defines retention horizon for lifecycle cleanup logic. Low values (&lt;7 days) risk premature deletion; very high values (&gt;365 days) may raise storage cost concerns.</p>
        </div>
      );
    case 'scanning':
      return (
        <div>
          <h1>Scanning</h1>
          {commonIntro}
          <p>Placeholder for future Antivirus integration. Current toggle records intent so workflows can branch or block pending scan clearance.</p>
        </div>
      );
    case 'infra':
      return (
        <div>
          <h1>Infrastructure</h1>
          {commonIntro}
          <p>Read-only environment-sourced parameters (driver mode, bucket, endpoint, region, path style, prefix, and maximum env cap). To change these, update deployment environment variables and redeploy.</p>
        </div>
      );
    case 'audit':
      return (
        <div>
          <h1>Audit History</h1>
          {commonIntro}
          <p>Shows recent configuration edits (latest 20) with actor, timestamp, and compressed diff summary. Use this for change tracking and incident response.</p>
        </div>
      );
    default:
      return (
        <div>
          <h1>File Upload Configuration Overview</h1>
          {commonIntro}
          <p>Select a widget in the board to view detailed help.</p>
        </div>
      );
  }
};

UploadConfigDashboardHelp.aiContext = 'Centralized dashboard for managing file upload policy (size caps, MIME allowlist, retention, scanning flag) with audit visibility and immutable infra metadata.';
export default UploadConfigDashboardHelp;
