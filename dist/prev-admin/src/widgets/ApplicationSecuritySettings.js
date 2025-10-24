import React, { useState } from 'react';
import { StatusIndicator, Hotspot, Toggle, ButtonDropdown, SpaceBetween, Header, Box, Link, Select, KeyValuePairs, Button } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import EncryptionSettingsHelp from '../helpPanelContents/encryptionSettingsHelp';

const ApplicationSecuritySettings = ({ initialSettings, toggleHelpPanel }) => {
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
                    description="Manage application security settings"
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
                    info={<Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp />, "Application Security Settings Help")}>Info</Link>}
                >
                    Application Security Settings
                </Header>
            }
        >
            <KeyValuePairs
                columns={3}
                items={[
                    { label: "Strict Content Security Policy (CSP) Headers", value: <Toggle checked={settings.cspHeaders} onChange={() => handleToggleChange('cspHeaders')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='cspHeaders' />, "CSP Headers Help")}>Info</Link> },
                    { label: "Enforce Secure Cookies (HttpOnly, Secure, SameSite=strict)", value: <Toggle checked={settings.secureCookies} onChange={() => handleToggleChange('secureCookies')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='secureCookies' />, "Secure Cookies Help")}>Info</Link> },
                    { label: "Cross-Site Request Forgery (CSRF) Protection", value: <Toggle checked={settings.csrfProtection} onChange={() => handleToggleChange('csrfProtection')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='csrfProtection' />, "CSRF Protection Help")}>Info</Link> },
                    { label: "SQL Injection Prevention via Prepared Statements", value: <Toggle checked={settings.sqlInjectionPrevention} onChange={() => handleToggleChange('sqlInjectionPrevention')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='sqlInjectionPrevention' />, "SQL Injection Prevention Help")}>Info</Link> },
                    { label: "Cross-Site Scripting (XSS) Protection via Input Sanitization", value: <Toggle checked={settings.xssProtection} onChange={() => handleToggleChange('xssProtection')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='xssProtection' />, "XSS Protection Help")}>Info</Link> },
                    { label: "Clickjacking Protection (X-Frame-Options DENY)", value: <Toggle checked={settings.clickjackingProtection} onChange={() => handleToggleChange('clickjackingProtection')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='clickjackingProtection' />, "Clickjacking Protection Help")}>Info</Link> },
                    { label: "User Activity Logging and Auditing", value: <Toggle checked={settings.userActivityLogging} onChange={() => handleToggleChange('userActivityLogging')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='userActivityLogging' />, "User Activity Logging Help")}>Info</Link> },
                    { label: "Auto-Logout for Idle Users", value: <Select selectedOption={settings.autoLogout} onChange={({ detail }) => handleSelectChange('autoLogout', detail.selectedOption)} options={[{ label: '15 mins', value: '15m' }, { label: '30 mins', value: '30m' }, { label: '1 hour', value: '1h' }, { label: 'Custom', value: 'custom' }]} placeholder="Select Timeout" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='autoLogout' />, "Auto-Logout Help")}>Info</Link> },
                ]}
            />
        </BoardItem>
    );
};

export default ApplicationSecuritySettings;
