import React, { useState } from 'react';
import { StatusIndicator , Hotspot, Toggle, ButtonDropdown, SpaceBetween, Header, Link, Select, KeyValuePairs, Button } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import EncryptionSettingsHelp from '../helpPanelContents/encryptionSettingsHelp';

const EncryptionSettings = ({ initialSettings, toggleHelpPanel }) => {
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
          description="Manage encryption settings"
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
          info={<Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp />, "Encryption Settings Help")}>Info</Link>}
        >
          Encryption Settings
        </Header>
      }
    >
      <KeyValuePairs
        columns={3}
        items={[
          {
            type: "group",
            title: "Data at Rest",
            items: [
              { label: "AES-256 Encryption", value: <Toggle checked={settings.dataAtRestEncryption} onChange={() => handleToggleChange('dataAtRestEncryption')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='aes256' />, "AES-256 Encryption Help")}>Info</Link> },
              { label: "Envelope Encryption", value: <Toggle checked={settings.envelopeEncryption} onChange={() => handleToggleChange('envelopeEncryption')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='envelope' />, "Envelope Encryption Help")}>Info</Link> },
              {
                label: "FIPS 140-2 Compliance",
                value: (
                  <StatusIndicator type={settings.fipsCompliant ? "success" : "warning"}>
                    {settings.fipsCompliant ? "Compliant" : "Non-Compliant"}
                  </StatusIndicator>
                ),
                info: (
                  <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='fips' />, "FIPS 140-2 Compliance Help")}>
                    Info
                  </Link>
                ),
              }
            ]
          },
          {
            type: "group",
            title: "Data in Transit",
            items: [
              { label: "TLS Version", value: <Select selectedOption={settings.dataInTransitEncryption} onChange={({ detail }) => handleSelectChange('dataInTransitEncryption', detail.selectedOption)} options={[{ label: 'TLS 1.2', value: 'tls1.2' }, { label: 'TLS 1.3', value: 'tls1.3' }]} placeholder="Select TLS Version" />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='tls' />, "TLS Version Help")}>Info</Link> },
              { label: "Perfect Forward Secrecy", value: <Toggle checked={settings.perfectForwardSecrecy} onChange={() => handleToggleChange('perfectForwardSecrecy')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='pfs' />, "Perfect Forward Secrecy Help")}>Info</Link> },
            ]
          },
          {
            type: "group",
            title: "Other Settings",
            items: [
              { label: "Certificate Pinning", value: <Toggle checked={settings.certificatePinning} onChange={() => handleToggleChange('certificatePinning')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='certpinning' />, "Certificate Pinning Help")}>Info</Link> },
              { label: "Multi-Region Key Replication", value: <Toggle checked={settings.multiRegionKeyReplication} onChange={() => handleToggleChange('multiRegionKeyReplication')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='multiregion' />, "Multi-Region Key Replication Help")}>Info</Link> },
              { label: "AWS KMS Logging", value: <Toggle checked={settings.kmsKeyUsageLogging} onChange={() => handleToggleChange('kmsKeyUsageLogging')} />, info: <Link variant="info" onFollow={() => toggleHelpPanel(<EncryptionSettingsHelp section='kmslogging' />, "AWS KMS Logging Help")}>Info</Link> },
            ]
          }
        ]}
      />
    </BoardItem>
  );
};

export default EncryptionSettings;
