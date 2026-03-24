import React, { useEffect, useState } from 'react';
import Button from "@cloudscape-design/components/button";
import Select from "@cloudscape-design/components/select";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Textarea from "@cloudscape-design/components/textarea";
import Box from "@cloudscape-design/components/box";
import styles from './DemoNavigation.module.css';
import { apiFetch } from '../auth/apiClient';

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

const TopHeader = ({ currentLanguage = 'en', onLanguageChange }) => {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmationValue, setConfirmationValue] = useState('');
  const [isClearingTestData, setIsClearingTestData] = useState(false);
  const [clearResult, setClearResult] = useState(null);
  const [isCreatingDummy, setIsCreatingDummy] = useState(false);
  const [dummyResult, setDummyResult] = useState(null);
  const [provinceOptions, setProvinceOptions] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [applicantOptions, setApplicantOptions] = useState([]);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(false);
  const [applicantLoadError, setApplicantLoadError] = useState(null);
  const [showAiDummyModal, setShowAiDummyModal] = useState(false);
  const [progressEvents, setProgressEvents] = useState([]);
  const [dummyAdditionalDetails, setDummyAdditionalDetails] = useState('');
  const [showCasePaymentsModal, setShowCasePaymentsModal] = useState(false);
  const [isCreatingCasePayments, setIsCreatingCasePayments] = useState(false);
  const [casePaymentsResult, setCasePaymentsResult] = useState(null);
  const [casePaymentsProgressEvents, setCasePaymentsProgressEvents] = useState([]);
  const [casePaymentsClients, setCasePaymentsClients] = useState('3');
  const [casePaymentsInterventionsPerClient, setCasePaymentsInterventionsPerClient] = useState('2');
  const [casePaymentsInterventionTypes, setCasePaymentsInterventionTypes] = useState('');
  const [casePaymentsAdditionalDetails, setCasePaymentsAdditionalDetails] = useState('');

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

  const loadProvinceOptions = async () => {
    setIsLoadingProvinces(true);
    try {
      const resp = await apiFetch('/api/regions/canada');
      const data = await resp.json().catch(() => []);
      const opts = (Array.isArray(data) ? data : []).map((r) => ({
        label: r.name && r.code ? `${r.name} (${r.code})` : (r.name || r.code),
        value: r.code,
      })).filter((o) => o.value);
      setProvinceOptions(opts);
      if (!selectedProvince && opts.length) setSelectedProvince(opts[0]);
    } catch {
      // fall back to hardcoded list if needed
      const fallback = [
        { label: 'Alberta (AB)', value: 'AB' },
        { label: 'British Columbia (BC)', value: 'BC' },
        { label: 'Manitoba (MB)', value: 'MB' },
        { label: 'New Brunswick (NB)', value: 'NB' },
        { label: 'Newfoundland and Labrador (NL)', value: 'NL' },
        { label: 'Northwest Territories (NT)', value: 'NT' },
        { label: 'Nova Scotia (NS)', value: 'NS' },
        { label: 'Nunavut (NU)', value: 'NU' },
        { label: 'Ontario (ON)', value: 'ON' },
        { label: 'Prince Edward Island (PE)', value: 'PE' },
        { label: 'Quebec (QC)', value: 'QC' },
        { label: 'Saskatchewan (SK)', value: 'SK' },
        { label: 'Yukon (YT)', value: 'YT' },
      ];
      setProvinceOptions(fallback);
      if (!selectedProvince && fallback.length) setSelectedProvince(fallback[0]);
    } finally {
      setIsLoadingProvinces(false);
    }
  };

  const loadApplicantOptions = async () => {
    setIsLoadingApplicants(true);
    setApplicantLoadError(null);
    try {
      const resp = await apiFetch('/api/admin/applicants');
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        setApplicantLoadError(data?.message || 'Failed to load applicant accounts');
        setApplicantOptions([]);
        setSelectedApplicant(null);
        return;
      }
      const users = Array.isArray(data?.users) ? data.users : [];
      const opts = users.map((u) => {
        const dbEmail = (u?.email || '').trim();
        const cognitoUsername = (u?.username || '').trim();
        const email = dbEmail && !/@placeholder\.local$/i.test(dbEmail)
          ? dbEmail
          : (cognitoUsername || dbEmail || '(unknown)');
        return {
          label: email,
          value: String(u.userId),
        };
      }).filter((o) => o.value);
      setApplicantOptions(opts);
      if (!selectedApplicant && opts.length) setSelectedApplicant(opts[0]);
    } catch (err) {
      setApplicantLoadError(err?.message || 'Failed to load applicant accounts');
      setApplicantOptions([]);
      setSelectedApplicant(null);
    } finally {
      setIsLoadingApplicants(false);
    }
  };

  const handleOpenAiDummyModal = () => {
    setShowAiDummyModal(true);
    if (!provinceOptions.length) {
      loadProvinceOptions();
    }
    if (!applicantOptions.length) {
      loadApplicantOptions();
    }
  };

  const handleCreateDummyDraft = async () => {
    setIsCreatingDummy(true);
    setDummyResult(null);
    const provinceValue = selectedProvince?.value || selectedProvince?.code || selectedProvince?.label;
    const userId = selectedApplicant?.value ? Number(selectedApplicant.value) : null;
    const additionalRequestDetails = dummyAdditionalDetails.trim();
    setProgressEvents([]);
    try {
      const payload = { province: provinceValue, userId, stepCursor: 'summary-page' };
      if (additionalRequestDetails) {
        payload.additionalRequestDetails = additionalRequestDetails;
      }
      const resp = await apiFetch('/api/ai/create-dummy-draft?stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok || !resp.body) {
        const json = await resp.json().catch(() => null);
        setDummyResult({ type: 'error', message: json?.message || 'Failed to create dummy draft', details: json });
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt = null;
          try { evt = JSON.parse(line); } catch { continue; }
          if (evt.type === 'plan') {
            const planned = Array.isArray(evt.steps) ? evt.steps : [];
            setProgressEvents(planned.map(step => ({ chunk: step, ok: false, pending: true })));
          } else if (evt.type === 'chunk') {
            setProgressEvents(prev => {
              const existingIdx = prev.findIndex(p => p.chunk === evt.chunk);
              if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = evt;
                return next;
              }
              return [...prev, evt];
            });
          } else if (evt.type === 'done') {
            const json = evt.result || {};
            const actionLabel = json?.action === 'updated' ? 'updated' : 'created';
            const targetUserId = json?.userId ?? 48;
            const applicantName = json?.applicant?.applicantName;
            const province = json?.applicant?.province || json?.validation?.province;
            const indigenous = json?.applicant?.indigenous || json?.applicant?.indigenousIdentity || json?.validation?.indigenous;
            const summary = {
              applicant: {
                applicantName: applicantName || '-',
                province: province || '-',
                indigenousIdentity: indigenous || '-',
              },
            };
            setDummyResult({
              type: 'success',
              message: `Dummy draft ${actionLabel} for user ${targetUserId}.`,
              details: summary,
            });
            setShowAiDummyModal(false);
          } else if (evt.type === 'error') {
            setDummyResult({ type: 'error', message: evt.message || 'Failed to create dummy draft', details: evt.details || evt });
            setShowAiDummyModal(false);
          }
        }
      }
    } catch (e) {
      setDummyResult({ type: 'error', message: e.message || 'Failed to create dummy draft' });
    } finally {
      setIsCreatingDummy(false);
    }
  };

  const handleOpenCasePaymentsModal = () => {
    setShowCasePaymentsModal(true);
    setCasePaymentsProgressEvents([]);
  };

  const parseCasePaymentsInterventionTypes = () => {
    if (!casePaymentsInterventionTypes.trim()) {
      return [];
    }
    return Array.from(
      new Set(
        casePaymentsInterventionTypes
          .split(',')
          .map(token => Number.parseInt(token.trim(), 10))
          .filter(Number.isFinite)
          .filter(code => code > 0)
      )
    );
  };

  const handleCreateDummyCasePayments = async () => {
    setIsCreatingCasePayments(true);
    setCasePaymentsResult(null);
    setCasePaymentsProgressEvents([]);

    const clients = Number.parseInt(casePaymentsClients, 10);
    const interventionsPerClient = Number.parseInt(casePaymentsInterventionsPerClient, 10);
    const payload = {
      clients: Number.isFinite(clients) ? clients : 3,
      interventionsPerClient: Number.isFinite(interventionsPerClient) ? interventionsPerClient : 2,
    };
    const interventionTypes = parseCasePaymentsInterventionTypes();
    if (interventionTypes.length) {
      payload.interventionTypes = interventionTypes;
    }
    if (casePaymentsAdditionalDetails.trim()) {
      payload.additionalRequestDetails = casePaymentsAdditionalDetails.trim();
    }

    try {
      const resp = await apiFetch('/api/ai/create-dummy-case-payments?stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok || !resp.body) {
        const json = await resp.json().catch(() => null);
        setCasePaymentsResult({
          type: 'error',
          message: json?.message || 'Failed to create dummy case/payment data',
          details: json,
        });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt = null;
          try { evt = JSON.parse(line); } catch { continue; }
          if (evt.type === 'plan') {
            const planned = Array.isArray(evt.steps) ? evt.steps : [];
            setCasePaymentsProgressEvents(planned.map(step => ({ chunk: step, ok: false, pending: true })));
          } else if (evt.type === 'chunk') {
            setCasePaymentsProgressEvents(prev => {
              const existingIdx = prev.findIndex(p => p.chunk === evt.chunk);
              if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = evt;
                return next;
              }
              return [...prev, evt];
            });
          } else if (evt.type === 'done') {
            const result = evt.result || {};
            setCasePaymentsResult({
              type: 'success',
              message: 'Dummy case and payment data generated.',
              details: result?.summary || result,
            });
            setShowCasePaymentsModal(false);
          } else if (evt.type === 'error') {
            setCasePaymentsResult({
              type: 'error',
              message: evt.message || 'Failed to create dummy case/payment data',
              details: evt.details || evt,
            });
            setShowCasePaymentsModal(false);
          }
        }
      }
    } catch (err) {
      setCasePaymentsResult({
        type: 'error',
        message: err?.message || 'Failed to create dummy case/payment data',
      });
    } finally {
      setIsCreatingCasePayments(false);
    }
  };

  return (
    <div className={styles.demoNavigation}>
      <span>Demo Controls</span>
      <div className={styles.buttonGroup} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button variant="primary" onClick={handleOpenClearModal}>
          Clear ISET test data
        </Button>
        <Button variant="link" loading={isCreatingDummy} onClick={handleOpenAiDummyModal}>Create Dummy Draft</Button>
        <Button variant="link" loading={isCreatingCasePayments} onClick={handleOpenCasePaymentsModal}>Create Dummy Case Payments</Button>
      </div>

      {showAiDummyModal && (
        <Modal
          visible={showAiDummyModal}
          header="Generate AI dummy draft"
          closeAriaLabel="Close dummy draft options"
          onDismiss={() => { if (!isCreatingDummy) setShowAiDummyModal(false); }}
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={() => setShowAiDummyModal(false)} disabled={isCreatingDummy}>Cancel</Button>
              <Button
                variant="primary"
                loading={isCreatingDummy}
                disabled={isCreatingDummy || isLoadingApplicants || isLoadingProvinces || !selectedApplicant || !selectedProvince}
                onClick={handleCreateDummyDraft}
              >
                Generate draft
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <Box>Select the province or territory for the simulated applicant's address. The AI will auto-generate the rest of the draft.</Box>
            <FormField
              label="Applicant account"
              description="Draft will be inserted/updated for this applicant (must exist in Cognito applicant pool and DB user table)."
              errorText={applicantLoadError || undefined}
            >
              <Select
                loadingText="Loading applicants..."
                statusType={isLoadingApplicants ? 'loading' : 'finished'}
                selectedOption={selectedApplicant}
                onChange={({ detail }) => setSelectedApplicant(detail.selectedOption)}
                options={applicantOptions}
                placeholder="Select applicant"
              />
            </FormField>
            <FormField label="Province / Territory" description="Used for address fields">
              <Select
                loadingText="Loading provinces..."
                statusType={isLoadingProvinces ? 'loading' : 'finished'}
                selectedOption={selectedProvince}
                onChange={({ detail }) => setSelectedProvince(detail.selectedOption)}
                options={provinceOptions}
                placeholder="Select province"
              />
            </FormField>
            <FormField
              label="Additional request details (optional)"
              description="Provide optional guidance for AI-generated applicant profile and draft answers."
            >
              <Textarea
                value={dummyAdditionalDetails}
                onChange={({ detail }) => setDummyAdditionalDetails(detail.value)}
                rows={4}
                placeholder="Optional guidance for this dummy draft"
              />
            </FormField>
            {isCreatingDummy && (
              <Box>
                <strong>Progress:</strong>
                <ul>
                  {(progressEvents.length ? progressEvents : [{ chunk: 'processing', pending: true }]).map(ev => {
                    const status = ev.ok ? 'done' : (ev.pending ? 'pending' : 'error');
                    return (
                      <li key={ev.chunk}>
                        {ev.chunk} — {status}
                        {ev && !ev.ok && !ev.pending && ev.raw ? ' (invalid JSON)' : null}
                      </li>
                    );
                  })}
                </ul>
              </Box>
            )}
          </SpaceBetween>
        </Modal>
      )}

      {showCasePaymentsModal && (
        <Modal
          visible={showCasePaymentsModal}
          header="Generate dummy case payments"
          closeAriaLabel="Close dummy case payment options"
          onDismiss={() => { if (!isCreatingCasePayments) setShowCasePaymentsModal(false); }}
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={() => setShowCasePaymentsModal(false)} disabled={isCreatingCasePayments}>Cancel</Button>
              <Button
                variant="primary"
                loading={isCreatingCasePayments}
                disabled={isCreatingCasePayments}
                onClick={handleCreateDummyCasePayments}
              >
                Generate cases/payments
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <Box>
              Generates synthetic clients, cases, interventions, draft payment packets, payment lines, and evidence docs for payment-flow testing.
            </Box>
            <FormField label="Clients" description="Number of clients to generate (1-20).">
              <Input
                type="number"
                value={casePaymentsClients}
                onChange={({ detail }) => setCasePaymentsClients(detail.value)}
                placeholder="3"
                inputMode="numeric"
              />
            </FormField>
            <FormField label="Interventions per client" description="Number of interventions per client (1-10).">
              <Input
                type="number"
                value={casePaymentsInterventionsPerClient}
                onChange={({ detail }) => setCasePaymentsInterventionsPerClient(detail.value)}
                placeholder="2"
                inputMode="numeric"
              />
            </FormField>
            <FormField
              label="Intervention type codes (optional)"
              description="Comma-separated intervention code values (for example: 12,13,14)."
            >
              <Input
                value={casePaymentsInterventionTypes}
                onChange={({ detail }) => setCasePaymentsInterventionTypes(detail.value)}
                placeholder="12,13,14"
              />
            </FormField>
            <FormField
              label="Additional request details (optional)"
              description="Guidance passed to the generator for profile/intervention context."
            >
              <Textarea
                value={casePaymentsAdditionalDetails}
                onChange={({ detail }) => setCasePaymentsAdditionalDetails(detail.value)}
                rows={4}
                placeholder="Optional guidance for the generated data"
              />
            </FormField>
            {isCreatingCasePayments && (
              <Box>
                <strong>Progress:</strong>
                <ul>
                  {(casePaymentsProgressEvents.length ? casePaymentsProgressEvents : [{ chunk: 'processing', pending: true }]).map(ev => {
                    const status = ev.ok ? 'done' : (ev.pending ? 'pending' : 'error');
                    return (
                      <li key={ev.chunk}>
                        {ev.chunk} — {status}
                      </li>
                    );
                  })}
                </ul>
              </Box>
            )}
          </SpaceBetween>
        </Modal>
      )}

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
              This action will permanently remove ISET test data and related records to maintain referential integrity. Counters and generated identifiers will also be reset.
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
            {dummyResult.type === 'success' ? (
              <>
                <Box>{dummyResult.message}</Box>
                <Box>
                  <div><strong>Applicant:</strong> {dummyResult.details?.applicant?.applicantName || '-'}</div>
                  <div><strong>Province:</strong> {dummyResult.details?.applicant?.province || dummyResult.details?.validation?.province || '-'}</div>
                  <div><strong>Indigenous Identity:</strong> {dummyResult.details?.applicant?.indigenousIdentity || dummyResult.details?.applicant?.indigenous || dummyResult.details?.validation?.indigenous || 'Indigenous'}</div>
                </Box>
              </>
            ) : (
              <>
                <Box>{dummyResult.message}</Box>
                {renderResultDetails(dummyResult.details)}
              </>
            )}
          </SpaceBetween>
        </Modal>
      )}

      {casePaymentsResult && (
        <Modal
          visible={true}
          header={casePaymentsResult.type === 'success' ? 'Dummy Case Payments Created' : 'Dummy Case Payments Error'}
          closeAriaLabel="Close dummy case payments status"
          onDismiss={() => setCasePaymentsResult(null)}
          footer={<SpaceBetween size="xs" direction="horizontal"><Button variant="primary" onClick={() => setCasePaymentsResult(null)}>Close</Button></SpaceBetween>}
        >
          <SpaceBetween size="s">
            <Box>{casePaymentsResult.message}</Box>
            {renderResultDetails(casePaymentsResult.details)}
          </SpaceBetween>
        </Modal>
      )}
    </div>
  );
};

export default TopHeader;


