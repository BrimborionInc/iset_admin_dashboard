import React, { useState } from 'react';
import { StatusIndicator, Hotspot, Toggle, ButtonDropdown, SpaceBetween, Header, Box, Link, KeyValuePairs, Button } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import EncryptionSettingsHelp from '../helpPanelContents/encryptionSettingsHelp';

const NetworkSecuritySettings = ({ initialSettings, toggleHelpPanel }) => {
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
                    description="Manage network security settings"
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
                    info={<Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp />, "Network Security Settings Help")}>Info</Link>}
                >
                    Network Security
                </Header>
            }
        >
            <KeyValuePairs
                columns={3}
                items={[
                    { label: "Default Deny-All Inbound Traffic", value: <Toggle checked={settings.denyAllInboundTraffic} onChange={() => handleToggleChange('denyAllInboundTraffic')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='denyAllInboundTraffic' />, "Deny-All Inbound Traffic Help")}>Info</Link> },
                    { label: "Security Group and Network ACLs Policy Enforcement", value: <Toggle checked={settings.sgNaclPolicyEnforcement} onChange={() => handleToggleChange('sgNaclPolicyEnforcement')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='sgNaclPolicyEnforcement' />, "SG and NACL Policy Enforcement Help")}>Info</Link> },
                    { label: "DDoS Protection (AWS Shield Advanced)", value: <Toggle checked={settings.ddosProtection} onChange={() => handleToggleChange('ddosProtection')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='ddosProtection' />, "DDoS Protection Help")}>Info</Link> },
                    { label: "Web Application Firewall (AWS WAF) Rules Customization", value: <Toggle checked={settings.wafRulesCustomization} onChange={() => handleToggleChange('wafRulesCustomization')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='wafRulesCustomization' />, "WAF Rules Customization Help")}>Info</Link> },
                    { label: "Intrusion Detection and Prevention (AWS GuardDuty)", value: <Toggle checked={settings.intrusionDetection} onChange={() => handleToggleChange('intrusionDetection')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='intrusionDetection' />, "Intrusion Detection Help")}>Info</Link> },
                    { label: "Automated Response to Security Anomalies", value: <Toggle checked={settings.automatedResponse} onChange={() => handleToggleChange('automatedResponse')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='automatedResponse' />, "Automated Response Help")}>Info</Link> },
                    { label: "VPN Enforcement for Admin Access", value: <Toggle checked={settings.vpnEnforcement} onChange={() => handleToggleChange('vpnEnforcement')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='vpnEnforcement' />, "VPN Enforcement Help")}>Info</Link> },
                    { label: "Encrypted S3 Bucket Storage Policy", value: <Toggle checked={settings.encryptedS3Storage} onChange={() => handleToggleChange('encryptedS3Storage')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='encryptedS3Storage' />, "Encrypted S3 Storage Help")}>Info</Link> },
                ]}
            />
        </BoardItem>
    );
};

export default NetworkSecuritySettings;
