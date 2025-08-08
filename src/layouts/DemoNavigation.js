import React, { useState } from 'react';
import Button from "@cloudscape-design/components/button";
import Flashbar from "@cloudscape-design/components/flashbar";
import Select from "@cloudscape-design/components/select";
import styles from './DemoNavigation.module.css'; // Import the CSS module

const roleOptions = [
  { label: 'Program Administrator', value: 'Program Administrator' },
  { label: 'Regional Coordinator', value: 'Regional Coordinator' },
  { label: 'PTMA Staff', value: 'PTMA Staff' },
  { label: 'System Administrator', value: 'System Administrator' },
];

const TopHeader = ({ currentLanguage = 'en', onLanguageChange, currentRole, setCurrentRole }) => {
  const [purgeCasesResult, setPurgeCasesResult] = useState(null);
  const [purgeApplicationsResult, setPurgeApplicationsResult] = useState(null);

  const handleClearCases = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/purge-cases`, { method: 'POST' });
      const result = await response.json();
      if (response.ok) {
        setPurgeCasesResult({ type: 'success', content: result.message });
      } else {
        setPurgeCasesResult({ type: 'error', content: result.error || 'Failed to purge cases' });
      }
    } catch (error) {
      setPurgeCasesResult({ type: 'error', content: 'Failed to purge cases' });
    }
  };

  const handleClearApplications = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/purge-applications`, { method: 'POST' });
      const result = await response.json();
      if (response.ok) {
        setPurgeApplicationsResult({ type: 'success', content: result.message });
      } else {
        setPurgeApplicationsResult({ type: 'error', content: result.error || 'Failed to purge applications' });
      }
    } catch (error) {
      setPurgeApplicationsResult({ type: 'error', content: 'Failed to purge applications' });
    }
  };

  const handleDismissPurgeCasesResult = () => {
    setPurgeCasesResult(null);
  };
  const handleDismissPurgeApplicationsResult = () => {
    setPurgeApplicationsResult(null);
  };

  return (
    <div className={styles.demoNavigation}>
      <span>Demo Controls</span>
      <div className={styles.buttonGroup} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button variant="primary" onClick={handleClearCases}>Clear Cases</Button>
        <Button variant="primary" onClick={handleClearApplications}>Clear Applications</Button>
        <Select
          selectedOption={currentRole}
          onChange={({ detail }) => setCurrentRole(detail.selectedOption)}
          options={roleOptions}
          ariaLabel="Select role"
          selectedAriaLabel="Selected role"
          placeholder="Select role"
          className={styles.roleSelect}
          style={{ minWidth: 200 }}
        />
      </div>
      {purgeCasesResult && (
        <Flashbar
          items={[{
            type: purgeCasesResult.type,
            header: purgeCasesResult.type === 'success' ? 'Success' : 'Error',
            content: purgeCasesResult.content,
            dismissible: true,
            onDismiss: handleDismissPurgeCasesResult,
          }]}
        />
      )}
      {purgeApplicationsResult && (
        <Flashbar
          items={[{
            type: purgeApplicationsResult.type,
            header: purgeApplicationsResult.type === 'success' ? 'Success' : 'Error',
            content: purgeApplicationsResult.content,
            dismissible: true,
            onDismiss: handleDismissPurgeApplicationsResult,
          }]}
        />
      )}
    </div>
  );
};

export default TopHeader;
