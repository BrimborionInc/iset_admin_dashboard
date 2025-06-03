import React, { useState } from 'react';
import { StatusIndicator, Hotspot, Toggle, ButtonDropdown, SpaceBetween, Header, Box, Link, Select, KeyValuePairs, Button } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import EncryptionSettingsHelp from '../helpPanelContents/encryptionSettingsHelp';

const IncidentResponseComplianceSettings = ({ initialSettings, toggleHelpPanel }) => {
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
                    description="Manage incident response and compliance settings"
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
                    info={<Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp />, "Incident Response and Compliance Settings Help")}>Info</Link>}
                >
                    Incident Response and Compliance
                </Header>
            }
        >
            <KeyValuePairs
                columns={3}
                items={[
                    { label: "Automated Security Incident Detection & Response", value: <Toggle checked={settings.automatedIncidentDetection} onChange={() => handleToggleChange('automatedIncidentDetection')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='automatedIncidentDetection' />, "Automated Incident Detection Help")}>Info</Link> },
                    { label: "Compromised Key Revocation Policy", value: <Select selectedOption={settings.keyRevocationPolicy} onChange={({ detail }) => handleSelectChange('keyRevocationPolicy', detail.selectedOption)} options={[{ label: 'Automatic', value: 'automatic' }, { label: 'Manual', value: 'manual' }]} placeholder="Select Policy" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='keyRevocationPolicy' />, "Key Revocation Policy Help")}>Info</Link> },
                    { label: "Security Patch Management & Update Policy", value: <Select selectedOption={settings.patchManagementPolicy} onChange={({ detail }) => handleSelectChange('patchManagementPolicy', detail.selectedOption)} options={[{ label: 'Immediate', value: 'immediate' }, { label: 'Scheduled', value: 'scheduled' }, { label: 'Manual', value: 'manual' }]} placeholder="Select Policy" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='patchManagementPolicy' />, "Patch Management Policy Help")}>Info</Link> },
                    { label: "Quarterly Security Audits and Compliance Checks", value: <Toggle checked={settings.quarterlyAudits} onChange={() => handleToggleChange('quarterlyAudits')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='quarterlyAudits' />, "Quarterly Audits Help")}>Info</Link> },
                    { label: "Penetration Testing Frequency", value: <Select selectedOption={settings.penetrationTestingFrequency} onChange={({ detail }) => handleSelectChange('penetrationTestingFrequency', detail.selectedOption)} options={[{ label: 'Monthly', value: 'monthly' }, { label: 'Quarterly', value: 'quarterly' }, { label: 'Annually', value: 'annually' }]} placeholder="Select Frequency" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='penetrationTestingFrequency' />, "Penetration Testing Frequency Help")}>Info</Link> },
                    { label: "CCCS Medium Cloud Compliance Checklist Enforcement", value: <Toggle checked={settings.cccsCompliance} onChange={() => handleToggleChange('cccsCompliance')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='cccsCompliance' />, "CCCS Compliance Help")}>Info</Link> },
                    { label: "ISO 27001 / NIST 800-53 Compliance Reporting", value: <Toggle checked={settings.isoNistCompliance} onChange={() => handleToggleChange('isoNistCompliance')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='isoNistCompliance' />, "ISO/NIST Compliance Help")}>Info</Link> },
                    { label: "Access Control Reviews & Role Audits", value: <Select selectedOption={settings.accessControlReviews} onChange={({ detail }) => handleSelectChange('accessControlReviews', detail.selectedOption)} options={[{ label: 'Monthly', value: 'monthly' }, { label: 'Quarterly', value: 'quarterly' }, { label: 'Annually', value: 'annually' }]} placeholder="Select Frequency" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='accessControlReviews' />, "Access Control Reviews Help")}>Info</Link> },
                ]}
            />
        </BoardItem>
    );
};

export default IncidentResponseComplianceSettings;
