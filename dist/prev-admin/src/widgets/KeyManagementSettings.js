import React, { useState } from 'react';
import { StatusIndicator, Hotspot, Toggle, ButtonDropdown, SpaceBetween, Header, Box, Link, Select, KeyValuePairs, Button } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import EncryptionSettingsHelp from '../helpPanelContents/encryptionSettingsHelp';

const KeyManagementSettings = ({ initialSettings, toggleHelpPanel }) => {
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
                    description="Manage key management settings"
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
                    info={<Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp />, "Key Management Settings Help")}>Info</Link>}
                >
                    Key Management Settings
                </Header>
            }
        >
            <KeyValuePairs
                columns={3}
                items={[
                    { label: "Key Rotation Interval", value: <Select selectedOption={settings.keyRotationInterval} onChange={({ detail }) => handleSelectChange('keyRotationInterval', detail.selectedOption)} options={[{ label: '6 months', value: '6m' }, { label: '12 months', value: '12m' }, { label: '24 months', value: '24m' }]} placeholder="Select Interval" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='keyRotation' />, "Key Rotation Interval Help")}>Info</Link> },
                    { label: "Automatic Key Expiry and Replacement", value: <Toggle checked={settings.automaticKeyExpiry} onChange={() => handleToggleChange('automaticKeyExpiry')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='keyExpiry' />, "Automatic Key Expiry Help")}>Info</Link> },
                    { label: "Key Access Restriction (RBAC)", value: <Toggle checked={settings.keyAccessRestriction} onChange={() => handleToggleChange('keyAccessRestriction')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='keyAccess' />, "Key Access Restriction Help")}>Info</Link> },
                    { label: "Audit Logging for Key Usage", value: <Toggle checked={settings.auditLogging} onChange={() => handleToggleChange('auditLogging')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='auditLogging' />, "Audit Logging Help")}>Info</Link> },
                    { label: "Revocation & Key Replacement Policy", value: <Select selectedOption={settings.revocationPolicy} onChange={({ detail }) => handleSelectChange('revocationPolicy', detail.selectedOption)} options={[{ label: 'Manual', value: 'manual' }, { label: 'Automatic', value: 'automatic' }]} placeholder="Select Policy" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='revocationPolicy' />, "Revocation Policy Help")}>Info</Link> },
                ]}
            />
        </BoardItem>
    );
};

export default KeyManagementSettings;
