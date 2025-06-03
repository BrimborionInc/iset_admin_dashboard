import React, { useState } from 'react';
import { StatusIndicator, Hotspot, Toggle, ButtonDropdown, SpaceBetween, Header, Box, Link, Select, KeyValuePairs, Button } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import EncryptionSettingsHelp from '../helpPanelContents/encryptionSettingsHelp';

const DataHandlingRetentionSettings = ({ initialSettings, toggleHelpPanel }) => {
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
                    description="Manage data handling and retention settings"
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
                    info={<Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp />, "Data Handling and Retention Settings Help")}>Info</Link>}
                >
                    Data Handling and Retention
                </Header>
            }
        >
            <KeyValuePairs
                columns={3}
                items={[
                    { label: "Data Retention Policy for Personal Data", value: <Select selectedOption={settings.dataRetentionPolicy} onChange={({ detail }) => handleSelectChange('dataRetentionPolicy', detail.selectedOption)} options={[{ label: '3 years', value: '3y' }, { label: '5 years', value: '5y' }, { label: '7 years', value: '7y' }, { label: 'Custom', value: 'custom' }]} placeholder="Select Retention" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='dataRetention' />, "Data Retention Policy Help")}>Info</Link> },
                    { label: "Data Minimization Strategy (Masking of Unused Fields)", value: <Toggle checked={settings.dataMinimization} onChange={() => handleToggleChange('dataMinimization')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='dataMinimization' />, "Data Minimization Help")}>Info</Link> },
                    { label: "Automated Data Deletion Policy", value: <Toggle checked={settings.automatedDataDeletion} onChange={() => handleToggleChange('automatedDataDeletion')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='automatedDataDeletion' />, "Automated Data Deletion Help")}>Info</Link> },
                    { label: "Cryptographic Erasure for Secure Data Deletion", value: <Toggle checked={settings.cryptographicErasure} onChange={() => handleToggleChange('cryptographicErasure')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='cryptographicErasure' />, "Cryptographic Erasure Help")}>Info</Link> },
                    { label: "Anonymization of Old Data Records", value: <Toggle checked={settings.anonymization} onChange={() => handleToggleChange('anonymization')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='anonymization' />, "Anonymization Help")}>Info</Link> },
                    { label: "Legal Hold Exemptions for Data Purging", value: <Toggle checked={settings.legalHoldExemptions} onChange={() => handleToggleChange('legalHoldExemptions')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='legalHoldExemptions' />, "Legal Hold Exemptions Help")}>Info</Link> },
                    { label: "Backup Encryption and Geographic Redundancy", value: <Toggle checked={settings.backupEncryption} onChange={() => handleToggleChange('backupEncryption')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='backupEncryption' />, "Backup Encryption Help")}>Info</Link> },
                    { label: "Data Integrity Verification (Hash-Based Checks)", value: <Toggle checked={settings.dataIntegrityVerification} onChange={() => handleToggleChange('dataIntegrityVerification')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='dataIntegrityVerification' />, "Data Integrity Verification Help")}>Info</Link> },
                ]}
            />
        </BoardItem>
    );
};

export default DataHandlingRetentionSettings;
