import React, { useEffect, useState } from 'react';
import Button from "@cloudscape-design/components/button";
import Toggle from "@cloudscape-design/components/toggle";
import Select from "@cloudscape-design/components/select";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Box from "@cloudscape-design/components/box";
import styles from './DemoNavigation.module.css';
import { apiFetch } from '../auth/apiClient';

// Canonical simulated roles aligned with backend Cognito groups & middleware
const roleOptions = [
  { label: 'Signed Out', value: '__signed_out__' },
  { label: 'System Administrator', value: 'System Administrator' },
  { label: 'Program Administrator', value: 'Program Administrator' },
  { label: 'Regional Coordinator', value: 'Regional Coordinator' },
  { label: 'Application Assessor', value: 'Application Assessor' },
];

const CLEAR_TABLES = [
  'iset_internal_notification_dismissal',
  'iset_internal_notification',
  'iset_case_assessment',
  'iset_case_document',
  'iset_case_note',
  'iset_case_task',
  'iset_event_receipt',
  'iset_event_outbox',
  'iset_event_entry',
  'iset_document',
  'iset_application_draft_dynamic',
  'iset_application_file',
  'iset_application_submission',
  'iset_application_draft',
  'iset_case',
  'iset_application',
];

const renderResultDetails = (details) => {
  if (!details) {
    return null;
  }

  const renderArrayItems = (items, prefix = 'detail') => (
    <ul>
      {items.map((item, index) => {
        const key = `${prefix}-${index}`;
        if (item && typeof item === 'object' && 'table' in item) {
          const statusParts = [];
          if (typeof item.deleted === 'number') {
            statusParts.push(`${item.deleted} deleted`);
          }
          if (item.skipped) {
            statusParts.push('table missing');
          }
          if (item.autoIncrementReset === false && !item.skipped) {
            statusParts.push('auto increment unchanged');
          }
          return (
            <li key={key}>
              <strong>{item.table}</strong>
              {statusParts.length ? ` � ${statusParts.join(', ')}` : null}
            </li>
          );
        }
        if (Array.isArray(item)) {
          return (
            <li key={key}>
              {renderArrayItems(item, key)}
            </li>
          );
        }
        if (item && typeof item === 'object') {
          return <li key={key}>{JSON.stringify(item)}</li>;
        }
        return <li key={key}>{String(item)}</li>;
      })}
    </ul>
  );

  if (typeof details === 'string' || typeof details === 'number') {
    return <Box>{String(details)}</Box>;
  }

  if (Array.isArray(details)) {
    if (!details.length) {
      return null;
    }
    return (
      <Box as="div" margin={{ top: 's' }}>
        {renderArrayItems(details)}
      </Box>
    );
  }

  if (typeof details === 'object') {
    const entries = Object.entries(details);
    if (!entries.length) {
      return null;
    }
    return (
      <Box as="div" margin={{ top: 's' }}>
        <ul>
          {entries.map(([key, value]) => (
            <li key={key}>
              <strong>{key}:</strong>
              {Array.isArray(value) ? (
                renderArrayItems(value, `${key}`)
              ) : (
                <>
                  {' '}
                  {typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}
                </>
              )}
            </li>
          ))}
        </ul>
      </Box>
    );
  }

  return null;
};

const TopHeader = ({ currentLanguage = 'en', onLanguageChange, currentRole, setCurrentRole }) => {
  const [iamOn, setIamOn] = useState(() => sessionStorage.getItem('iamBypass') !== 'off');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmationValue, setConfirmationValue] = useState('');
  const [isClearingTestData, setIsClearingTestData] = useState(false);
  const [clearResult, setClearResult] = useState(null);
  const [isCreatingDummy, setIsCreatingDummy] = useState(false);
  const [dummyResult, setDummyResult] = useState(null);

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

  const handleOpenClearModal = () => {
    setConfirmVisible(true);
  };

  const handleCancelClear = () => {
    if (isClearingTestData) {
      return;
    }
    setConfirmVisible(false);
    setConfirmationValue('');
  };

  const handleConfirmClear = async () => {
    setIsClearingTestData(true);
    try {
      const response = await apiFetch('/api/clear-iset-test-data', { method: 'POST' });
      let body = null;
      try {
        body = await response.json();
      } catch {}

      let message;
      let error;
      let extraDetails = null;

      if (Array.isArray(body)) {
        extraDetails = body;
      } else if (body && typeof body === 'object') {
        const { message: bodyMessage, details, summary, error: bodyError, ...rest } = body;
        message = bodyMessage;
        error = bodyError;
        extraDetails = details || summary || (Object.keys(rest).length ? rest : null);
      }

      if (response.ok) {
        setClearResult({
          type: 'success',
          header: 'ISET test data cleared',
          message: message || 'ISET test data was cleared successfully.',
          details: extraDetails,
        });
      } else {
        setClearResult({
          type: 'error',
          header: 'Failed to clear ISET test data',
          message: error || message || 'The request to clear ISET test data failed.',
          details: extraDetails,
        });
      }
    } catch (err) {
      setClearResult({
        type: 'error',
        header: 'Failed to clear ISET test data',
        message: err?.message || 'The request to clear ISET test data failed.',
      });
    } finally {
      setIsClearingTestData(false);
      setConfirmVisible(false);
      setConfirmationValue('');
    }
  };

  const handleDismissResult = () => {
    setClearResult(null);
  };

  const isConfirmationValid = confirmationValue.trim().toLowerCase() === 'delete';

  const handleCreateDummyDraft = async () => {
    setIsCreatingDummy(true);
    setDummyResult(null);
    try {
      const resp = await apiFetch('/api/create-dummy-draft', { method: 'POST', body: JSON.stringify({}) });
      let json = null; try { json = await resp.json(); } catch {}
      if (resp.ok) {
        setDummyResult({ type: 'success', message: 'Dummy draft created / updated for user 35 (summary-page).', details: json });
      } else {
        setDummyResult({ type: 'error', message: json?.message || 'Failed to create dummy draft', details: json });
      }
    } catch (e) {
      setDummyResult({ type: 'error', message: e.message || 'Failed to create dummy draft' });
    } finally {
      setIsCreatingDummy(false);
    }
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
        <Button variant="primary" onClick={handleOpenClearModal}>
          Clear ISET test data
        </Button>
        <Select
          selectedOption={currentRole}
          onChange={({ detail }) => setCurrentRole(detail.selectedOption)}
          options={roleOptions}
          ariaLabel="Select role"
          selectedAriaLabel="Selected role"
          placeholder="Select role"
          className={styles.roleSelect}
          style={{ minWidth: 200 }}
          disabled={iamOn}
        />
        <Button variant="link" loading={isCreatingDummy} onClick={handleCreateDummyDraft}>Create Dummy Draft</Button>
      </div>

      {confirmVisible && (
        <Modal
          visible={confirmVisible}
          header="Confirm test data deletion"
          closeAriaLabel="Close confirmation dialog"
          onDismiss={() => {
            if (!isClearingTestData) {
              handleCancelClear();
            }
          }}
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="normal" onClick={handleCancelClear} disabled={isClearingTestData}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmClear}
                disabled={!isConfirmationValid || isClearingTestData}
                loading={isClearingTestData}
              >
                Delete test data
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <Box>
              This action will permanently remove test data from the following ISET tables and any related records to maintain referential integrity. Counters and generated identifiers will also be reset.
            </Box>
            <Box as="div">
              <ul>
                {CLEAR_TABLES.map((table) => (
                  <li key={table}>{table}</li>
                ))}
              </ul>
            </Box>
            <FormField label='Type "delete" to confirm'>
              <Input
                autoFocus
                value={confirmationValue}
                onChange={({ detail }) => setConfirmationValue(detail.value)}
                placeholder="delete"
              />
            </FormField>
          </SpaceBetween>
        </Modal>
      )}

      {clearResult && (
        <Modal
          visible={true}
          header={clearResult.header}
          closeAriaLabel="Close status dialog"
          onDismiss={handleDismissResult}
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="primary" onClick={handleDismissResult}>
                Close
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            <Box>{clearResult.message}</Box>
            {renderResultDetails(clearResult.details)}
          </SpaceBetween>
        </Modal>
      )}

      {dummyResult && (
        <Modal
          visible={true}
          header={dummyResult.type === 'success' ? 'Dummy Draft Created' : 'Dummy Draft Error'}
          closeAriaLabel="Close dummy draft status"
          onDismiss={() => setDummyResult(null)}
          footer={<SpaceBetween size="xs" direction="horizontal"><Button variant="primary" onClick={() => setDummyResult(null)}>Close</Button></SpaceBetween>}
        >
          <SpaceBetween size="s">
            <Box>{dummyResult.message}</Box>
            {renderResultDetails(dummyResult.details)}
          </SpaceBetween>
        </Modal>
      )}
    </div>
  );
};

export default TopHeader;


