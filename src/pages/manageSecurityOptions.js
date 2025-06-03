import React, { useState, useEffect } from 'react';
import { ContentLayout, Header } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import EncryptionSettings from '../widgets/EncryptionSettings';
import KeyManagementSettings from '../widgets/KeyManagementSettings'; // Import the new widget
import IdentityAccessManagementSettings from '../widgets/IdentityAccessManagementSettings'; // Import the new widget
import SecureApiAccessSettings from '../widgets/SecureApiAccessSettings'; // Import the new widget
import NetworkSecuritySettings from '../widgets/NetworkSecuritySettings'; // Import the new widget
import ApplicationSecuritySettings from '../widgets/ApplicationSecuritySettings'; // Import the new widget
import LoggingMonitoringSettings from '../widgets/LoggingMonitoringSettings'; // Import the new widget
import DataHandlingRetentionSettings from '../widgets/DataHandlingRetentionSettings'; // Import the new widget
import IncidentResponseComplianceSettings from '../widgets/IncidentResponseComplianceSettings'; // Import the new widget

const ManageSecurityOptions = ({ header, headerInfo, toggleHelpPanel, updateBreadcrumbs }) => {
  const [items, setItems] = useState([
    {
      id: 'encryption-settings',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'Encryption Settings' },
    },
    {
      id: 'key-management-settings',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'Key Management Settings' },
    },
    {
      id: 'identity-access-management-settings',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'Identity and Access Management (IAM)' },
    },
    {
      id: 'secure-api-access-settings',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'Secure API Access' },
    },
    {
      id: 'network-security-settings',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'Network Security' },
    },
    {
      id: 'application-security-settings',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'Application Security Settings' },
    },
    {
      id: 'logging-monitoring-settings',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'Logging and Monitoring' },
    },
    {
      id: 'data-handling-retention-settings',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'Data Handling and Retention' },
    },
    {
      id: 'incident-response-compliance-settings',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'Incident Response and Compliance' },
    },
    // Add more widgets here as needed
  ]);

  useEffect(() => {
    updateBreadcrumbs([
      { text: 'Home', href: '/' },
      { text: 'Security Settings', href: '#' }
    ]);
  }, [updateBreadcrumbs]);

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={headerInfo}>
          {header}
        </Header>
      }
    >
      <Board
        renderItem={(item) => {
          if (item.id === 'encryption-settings') {
            return <EncryptionSettings initialSettings={{
              dataAtRestEncryption: false,
              dataInTransitEncryption: { label: 'TLS 1.2', value: 'tls1.2' },
              perfectForwardSecrecy: false,
              fipsCompliant: false,
              certificatePinning: false,
              kmsKeyUsageLogging: false,
              multiRegionKeyReplication: false,
              envelopeEncryption: false,
              hsmUsage: false,
            }} toggleHelpPanel={toggleHelpPanel} />;
          }
          if (item.id === 'key-management-settings') {
            return <KeyManagementSettings initialSettings={{
              keyRotationInterval: { label: '6 months', value: '6m' },
              automaticKeyExpiry: false,
              keyAccessRestriction: false,
              auditLogging: false,
              revocationPolicy: { label: 'Manual', value: 'manual' },
            }} toggleHelpPanel={toggleHelpPanel} />;
          }
          if (item.id === 'identity-access-management-settings') {
            return <IdentityAccessManagementSettings initialSettings={{
              mfaEnforcement: false,
              sessionTimeoutPolicy: { label: '15 mins', value: '15m' },
              ssoIntegration: false,
              adaptiveAuthentication: false,
              loginRateLimiting: false,
            }} toggleHelpPanel={toggleHelpPanel} />;
          }
          if (item.id === 'secure-api-access-settings') {
            return <SecureApiAccessSettings initialSettings={{
              apiKeyExpiryPolicy: { label: '30 days', value: '30d' },
              oauthEnforcement: false,
              apiRateLimiting: false,
              apiLogging: false,
              restrictedDataFields: false,
              corsPolicy: { label: 'Strict', value: 'strict' },
              jwtTokenExpiry: { label: '15 mins', value: '15m' },
              signedJwtTokens: false,
            }} toggleHelpPanel={toggleHelpPanel} />;
          }
          if (item.id === 'network-security-settings') {
            return <NetworkSecuritySettings initialSettings={{
              denyAllInboundTraffic: false,
              sgNaclPolicyEnforcement: false,
              ddosProtection: false,
              wafRulesCustomization: false,
              intrusionDetection: false,
              automatedResponse: false,
              vpnEnforcement: false,
              encryptedS3Storage: false,
            }} toggleHelpPanel={toggleHelpPanel} />;
          }
          if (item.id === 'application-security-settings') {
            return <ApplicationSecuritySettings initialSettings={{
              cspHeaders: false,
              secureCookies: false,
              csrfProtection: false,
              sqlInjectionPrevention: false,
              xssProtection: false,
              clickjackingProtection: false,
              userActivityLogging: false,
              autoLogout: { label: '15 mins', value: '15m' },
            }} toggleHelpPanel={toggleHelpPanel} />;
          }
          if (item.id === 'logging-monitoring-settings') {
            return <LoggingMonitoringSettings initialSettings={{
              centralizedLogging: false,
              anomalyDetection: false,
              incidentAlerting: false,
              logRetentionPolicy: { label: '3 months', value: '3m' },
              logAccessRestrictions: false,
              userActivityAuditLogs: false,
              automatedLogArchival: false,
              siemIntegration: false,
            }} toggleHelpPanel={toggleHelpPanel} />;
          }
          if (item.id === 'data-handling-retention-settings') {
            return <DataHandlingRetentionSettings initialSettings={{
              dataRetentionPolicy: { label: '3 years', value: '3y' },
              dataMinimization: false,
              automatedDataDeletion: false,
              cryptographicErasure: false,
              anonymization: false,
              legalHoldExemptions: false,
              backupEncryption: false,
              dataIntegrityVerification: false,
            }} toggleHelpPanel={toggleHelpPanel} />;
          }
          if (item.id === 'incident-response-compliance-settings') {
            return <IncidentResponseComplianceSettings initialSettings={{
              automatedIncidentDetection: false,
              keyRevocationPolicy: { label: 'Automatic', value: 'automatic' },
              patchManagementPolicy: { label: 'Immediate', value: 'immediate' },
              quarterlyAudits: false,
              penetrationTestingFrequency: { label: 'Monthly', value: 'monthly' },
              cccsCompliance: false,
              isoNistCompliance: false,
              accessControlReviews: { label: 'Monthly', value: 'monthly' },
            }} toggleHelpPanel={toggleHelpPanel} />;
          }
          return null;
        }}
        items={items}
        onItemsChange={(event) => setItems(event.detail.items)}
        i18nStrings={{
          liveAnnouncementDndStarted: (operationType) =>
            operationType === 'resize' ? 'Resizing' : 'Dragging',
          liveAnnouncementDndItemReordered: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item moved to ${operation.direction === 'horizontal' ? columns : rows}.`;
          },
          liveAnnouncementDndItemResized: (operation) => {
            const columnsConstraint = operation.isMinimalColumnsReached ? ' (minimal)' : '';
            const rowsConstraint = operation.isMinimalRowsReached ? ' (minimal)' : '';
            const sizeAnnouncement = operation.direction === 'horizontal'
              ? `columns ${operation.placement.width}${columnsConstraint}`
              : `rows ${operation.placement.height}${rowsConstraint}`;
            return `Item resized to ${sizeAnnouncement}.`;
          },
          liveAnnouncementDndItemInserted: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item inserted to ${columns}, ${rows}.`;
          },
          liveAnnouncementDndCommitted: (operationType) => `${operationType} committed`,
          liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded`,
          liveAnnouncementItemRemoved: (op) => `Removed item ${op.item.data.title}.`,
          navigationAriaLabel: 'Board navigation',
          navigationAriaDescription: 'Click on non-empty item to move focus over',
          navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty'),
        }}
      />
    </ContentLayout>
  );
};

export default ManageSecurityOptions;
