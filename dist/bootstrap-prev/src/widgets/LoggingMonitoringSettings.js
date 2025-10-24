import React, { useState } from 'react';
import { StatusIndicator, Hotspot, Toggle, ButtonDropdown, SpaceBetween, Header, Box, Link, Select, KeyValuePairs, Button } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import EncryptionSettingsHelp from '../helpPanelContents/encryptionSettingsHelp';

const LoggingMonitoringSettings = ({ initialSettings, toggleHelpPanel }) => {
    const [settings, setSettings] = useState(initialSettings);
    const [isChanged, setIsChanged] = useState(false);

    const handleToggleChange = (key) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            [key]: !prevSettings[key],
        }));
        setIsChanged(true);
        console.log(`${key} updated:`, !settings[key]);
    };

    const handleSelectChange = (key, selectedOption) => {
        setSettings((prevSettings) => ({
            ...prevSettings,
            [key]: selectedOption,
        }));
        setIsChanged(true);
        console.log(`${key} updated:`, selectedOption);
    };

    const handleSave = () => {
        // Save logic here
        setIsChanged(false);
        console.log('Settings saved:', settings);
    };

    const handleCancel = () => {
        setSettings(initialSettings);
        setIsChanged(false);
        console.log('Changes canceled');
    };

    return (
        <BoardItem
            i18nStrings={{
                dragHandleAriaLabel: "Drag handle",
                resizeHandleAriaLabel: "Resize handle"
            }}
            settings={
                <ButtonDropdown
                    items={[
                        {
                            id: "preferences",
                            text: "Preferences"
                        },
                        { id: "remove", text: "Remove" }
                    ]}
                    ariaLabel="Board item settings"
                    variant="icon"
                />
            }
            header={
                <Header
                    description="Manage logging and monitoring settings"
                    actions={
                        <SpaceBetween direction="horizontal" size="s">
                            <Hotspot hotspotId="save-button-hotspot" direction="top">
                                <Button variant="primary" onClick={handleSave} disabled={!isChanged}>Save</Button>
                            </Hotspot>
                            <Hotspot hotspotId="cancel-button-hotspot" direction="top">
                                <Button variant="link" onClick={handleCancel}>Cancel</Button>
                            </Hotspot>
                        </SpaceBetween>
                    }
                    info={<Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp />, "Logging and Monitoring Settings Help")}>Info</Link>}
                >
                    Logging and Monitoring
                </Header>
            }
        >
            <KeyValuePairs
                columns={3}
                items={[
                    { label: "Centralized Logging via AWS CloudWatch & CloudTrail", value: <Toggle checked={settings.centralizedLogging} onChange={() => handleToggleChange('centralizedLogging')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='centralizedLogging' />, "Centralized Logging Help")}>Info</Link> },
                    { label: "Real-Time Anomaly Detection via AWS GuardDuty", value: <Toggle checked={settings.anomalyDetection} onChange={() => handleToggleChange('anomalyDetection')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='anomalyDetection' />, "Anomaly Detection Help")}>Info</Link> },
                    { label: "Incident Alerting via SNS Notifications", value: <Toggle checked={settings.incidentAlerting} onChange={() => handleToggleChange('incidentAlerting')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='incidentAlerting' />, "Incident Alerting Help")}>Info</Link> },
                    { label: "Log Retention Policy", value: <Select selectedOption={settings.logRetentionPolicy} onChange={({ detail }) => handleSelectChange('logRetentionPolicy', detail.selectedOption)} options={[{ label: '3 months', value: '3m' }, { label: '6 months', value: '6m' }, { label: '12 months', value: '12m' }, { label: 'Custom', value: 'custom' }]} placeholder="Select Retention" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='logRetention' />, "Log Retention Policy Help")}>Info</Link> },
                    { label: "Log Access Restrictions (IAM Role-Based)", value: <Toggle checked={settings.logAccessRestrictions} onChange={() => handleToggleChange('logAccessRestrictions')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='logAccessRestrictions' />, "Log Access Restrictions Help")}>Info</Link> },
                    { label: "User Activity Audit Logs (View/Modify/Delete Actions)", value: <Toggle checked={settings.userActivityAuditLogs} onChange={() => handleToggleChange('userActivityAuditLogs')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='userActivityAuditLogs' />, "User Activity Audit Logs Help")}>Info</Link> },
                    { label: "Automated Log Archival & Secure Storage in S3", value: <Toggle checked={settings.automatedLogArchival} onChange={() => handleToggleChange('automatedLogArchival')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='automatedLogArchival' />, "Automated Log Archival Help")}>Info</Link> },
                    { label: "SIEM Integration for Advanced Threat Detection", value: <Toggle checked={settings.siemIntegration} onChange={() => handleToggleChange('siemIntegration')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='siemIntegration' />, "SIEM Integration Help")}>Info</Link> },
                ]}
            />
        </BoardItem>
    );
};

export default LoggingMonitoringSettings;
