import React, { useEffect, useState } from 'react';
import Button from "@cloudscape-design/components/button";
import Toggle from "@cloudscape-design/components/toggle";
import Flashbar from "@cloudscape-design/components/flashbar";
import Select from "@cloudscape-design/components/select";
import styles from './DemoNavigation.module.css'; // Import the CSS module
import { apiFetch } from '../auth/apiClient';

// Canonical simulated roles aligned with backend Cognito groups & middleware
const roleOptions = [
  { label: 'Signed Out', value: '__signed_out__' },
  { label: 'System Administrator', value: 'System Administrator' },
  { label: 'Program Administrator', value: 'Program Administrator' },
  { label: 'Regional Coordinator', value: 'Regional Coordinator' },
  { label: 'Application Assessor', value: 'Application Assessor' },
];

const TopHeader = ({ currentLanguage = 'en', onLanguageChange, currentRole, setCurrentRole }) => {
  const [purgeCasesResult, setPurgeCasesResult] = useState(null);
  const [purgeApplicationsResult, setPurgeApplicationsResult] = useState(null);
  const [iamOn, setIamOn] = useState(() => sessionStorage.getItem('iamBypass') !== 'off');

  // Persist IAM toggle and apply dev-bypass token defaults
  useEffect(() => {
    const previous = sessionStorage.getItem('iamBypass');
    sessionStorage.setItem('iamBypass', iamOn ? 'on' : 'off');
    if (!sessionStorage.getItem('devBypassToken')) {
      sessionStorage.setItem('devBypassToken', 'local-dev-secret');
    }
    const wasOff = previous === 'off';
    // If we are turning IAM ON (moving from bypass to real auth), clear simulated role/email
    if (iamOn && wasOff) {
      try {
        sessionStorage.removeItem('simulateSignedOut');
        sessionStorage.removeItem('currentRole');
        // Fire event so TopNavigation recomputes and shows real signed-in state or Sign in
        window.dispatchEvent(new CustomEvent('auth:session-changed', { detail: { session: null, action: 'iam-toggle-on' } }));
      } catch {}
    } else if (!iamOn && previous === 'on') {
      // Turning IAM OFF, restore a default role if none selected yet
      if (!sessionStorage.getItem('currentRole')) {
        const defaultRole = { label: 'Program Administrator', value: 'Program Administrator' };
        try {
          sessionStorage.setItem('currentRole', JSON.stringify(defaultRole));
        } catch {}
      }
      window.dispatchEvent(new CustomEvent('auth:session-changed', { detail: { session: null, action: 'iam-toggle-off' } }));
    }
  }, [iamOn]);

  // Initialize from simulateSignedOut flag
  useEffect(() => {
    const sim = sessionStorage.getItem('simulateSignedOut') === 'true';
    if (sim && (!currentRole || currentRole.value !== '__signed_out__')) {
      setCurrentRole({ label: 'Signed Out', value: '__signed_out__' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist currentRole for apiClient and simulation
  useEffect(() => {
    try {
      if (currentRole?.value === '__signed_out__') {
        sessionStorage.setItem('simulateSignedOut', 'true');
        sessionStorage.removeItem('currentRole');
      } else if (currentRole) {
        sessionStorage.setItem('simulateSignedOut', 'false');
        sessionStorage.setItem('currentRole', JSON.stringify(currentRole));
      }
      // Notify UI to re-evaluate auth-aware UI
      window.dispatchEvent(new CustomEvent('auth:session-changed', { detail: { session: null, action: 'simulate' } }));
    } catch {}
  }, [currentRole]);

  const handleClearCases = async () => {
    try {
    const response = await apiFetch('/api/purge-cases', { method: 'POST' });
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
    const response = await apiFetch('/api/purge-applications', { method: 'POST' });
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
        <Toggle
          checked={iamOn}
          onChange={({ detail }) => setIamOn(detail.checked)}
        >
          IAM {iamOn ? '(On)' : '(Off)'}
        </Toggle>
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
          disabled={iamOn} // Disable RBAC simulation when IAM is ON
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
