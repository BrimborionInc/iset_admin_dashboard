import React, { useState } from 'react';
import { StatusIndicator, Hotspot, Toggle, ButtonDropdown, SpaceBetween, Header, Box, Link, Select, KeyValuePairs, Button } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import EncryptionSettingsHelp from '../helpPanelContents/encryptionSettingsHelp';

const SecureApiAccessSettings = ({ initialSettings, toggleHelpPanel }) => {
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
                    description="Manage secure API access settings"
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
                    info={<Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp />, "Secure API Access Settings Help")}>Info</Link>}
                >
                    Secure API Access
                </Header>
            }
        >
            <KeyValuePairs
                columns={3}
                items={[
                    { label: "API Key Expiry Policy", value: <Select selectedOption={settings.apiKeyExpiryPolicy} onChange={({ detail }) => handleSelectChange('apiKeyExpiryPolicy', detail.selectedOption)} options={[{ label: '30 days', value: '30d' }, { label: '60 days', value: '60d' }, { label: '90 days', value: '90d' }, { label: 'Custom', value: 'custom' }]} placeholder="Select Expiry" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='apiKeyExpiry' />, "API Key Expiry Policy Help")}>Info</Link> },
                    { label: "OAuth 2.0 Enforcement for External APIs", value: <Toggle checked={settings.oauthEnforcement} onChange={() => handleToggleChange('oauthEnforcement')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='oauthEnforcement' />, "OAuth 2.0 Enforcement Help")}>Info</Link> },
                    { label: "API Rate Limiting (Throttling Controls)", value: <Toggle checked={settings.apiRateLimiting} onChange={() => handleToggleChange('apiRateLimiting')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='apiRateLimiting' />, "API Rate Limiting Help")}>Info</Link> },
                    { label: "API Logging and Auditing", value: <Toggle checked={settings.apiLogging} onChange={() => handleToggleChange('apiLogging')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='apiLogging' />, "API Logging Help")}>Info</Link> },
                    { label: "Restricted Data Fields in API Responses", value: <Toggle checked={settings.restrictedDataFields} onChange={() => handleToggleChange('restrictedDataFields')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='restrictedDataFields' />, "Restricted Data Fields Help")}>Info</Link> },
                    { label: "Cross-Origin Resource Sharing (CORS) Policy", value: <Select selectedOption={settings.corsPolicy} onChange={({ detail }) => handleSelectChange('corsPolicy', detail.selectedOption)} options={[{ label: 'Strict', value: 'strict' }, { label: 'Relaxed', value: 'relaxed' }, { label: 'Custom', value: 'custom' }]} placeholder="Select Policy" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='corsPolicy' />, "CORS Policy Help")}>Info</Link> },
                    { label: "JWT Token Expiry Time", value: <Select selectedOption={settings.jwtTokenExpiry} onChange={({ detail }) => handleSelectChange('jwtTokenExpiry', detail.selectedOption)} options={[{ label: '15 mins', value: '15m' }, { label: '30 mins', value: '30m' }, { label: '1 hour', value: '1h' }, { label: 'Custom', value: 'custom' }]} placeholder="Select Expiry" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='jwtTokenExpiry' />, "JWT Token Expiry Help")}>Info</Link> },
                    { label: "Use of Signed JWT Tokens", value: <Toggle checked={settings.signedJwtTokens} onChange={() => handleToggleChange('signedJwtTokens')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='signedJwtTokens' />, "Signed JWT Tokens Help")}>Info</Link> },
                ]}
            />
        </BoardItem>
    );
};

export default SecureApiAccessSettings;
