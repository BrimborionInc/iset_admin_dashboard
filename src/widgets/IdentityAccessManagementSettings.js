import React, { useState } from 'react';
import { StatusIndicator, Hotspot, Toggle, ButtonDropdown, SpaceBetween, Header, Box, Link, Select, KeyValuePairs, Button } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import EncryptionSettingsHelp from '../helpPanelContents/encryptionSettingsHelp';

const IdentityAccessManagementSettings = ({ initialSettings, toggleHelpPanel }) => {
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
                    description="Manage identity and access management settings"
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
                    info={<Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp />, "Identity and Access Management Settings Help")}>Info</Link>}
                >
                    Identity and Access Management (IAM)
                </Header>
            }
        >
            <KeyValuePairs
                columns={3}
                items={[
                    { label: "Multi-Factor Authentication (MFA) Enforcement", value: <Toggle checked={settings.mfaEnforcement} onChange={() => handleToggleChange('mfaEnforcement')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='mfaEnforcement' />, "MFA Enforcement Help")}>Info</Link> },
                    { label: "User Session Timeout Policy", value: <Select selectedOption={settings.sessionTimeoutPolicy} onChange={({ detail }) => handleSelectChange('sessionTimeoutPolicy', detail.selectedOption)} options={[{ label: '15 mins', value: '15m' }, { label: '30 mins', value: '30m' }, { label: '1 hour', value: '1h' }, { label: 'Custom', value: 'custom' }]} placeholder="Select Timeout" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='sessionTimeout' />, "Session Timeout Policy Help")}>Info</Link> },
                    { label: "SSO & Federated Identity Integration", value: <Toggle checked={settings.ssoIntegration} onChange={() => handleToggleChange('ssoIntegration')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='ssoIntegration' />, "SSO Integration Help")}>Info</Link> },
                    { label: "Adaptive Authentication (Risk-Based MFA Triggers)", value: <Toggle checked={settings.adaptiveAuthentication} onChange={() => handleToggleChange('adaptiveAuthentication')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='adaptiveAuthentication' />, "Adaptive Authentication Help")}>Info</Link> },
                    { label: "Login Rate-Limiting (Brute-Force Protection)", value: <Toggle checked={settings.loginRateLimiting} onChange={() => handleToggleChange('loginRateLimiting')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='loginRateLimiting' />, "Login Rate-Limiting Help")}>Info</Link> },
                ]}
            />
        </BoardItem>
    );
};

export default IdentityAccessManagementSettings;
