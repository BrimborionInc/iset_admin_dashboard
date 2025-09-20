import React, { useEffect, useState, useMemo } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, Box, Flashbar, Link, ButtonDropdown, SpaceBetween, Textarea, Button, Input, Select, Table } from '@cloudscape-design/components';
import IsetApplicationFormHelpPanelContent from '../helpPanelContents/isetApplicationFormHelpPanelContent';
import { apiFetch } from '../auth/apiClient';

// Format primitive / mixed values for display
function formatValue(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.map(x => formatValue(x)).join(', ') : '—';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

// Section key definitions (labels map to expected answer keys). Only keys present will render.
const SECTION_DEFS = [
  { id: 'metadata', label: 'Metadata', keys: [
    'application-id','submission-id','created-at','updated-at','status','tracking-id','region','program-year'
  ]},
  { id: 'identity', label: 'Identity', keys: [
    'first-name','middle-name','last-name','preferred-name','date-of-birth','sin','gender','indigenous-identity'
  ]},
  { id: 'contact', label: 'Contact', keys: [
    'email','alternate-email','daytime-phone','alternate-phone','preferred-contact-method','address-line-1','address-line-2','city','province','postal-code'
  ]},
  { id: 'family', label: 'Family / Household', keys: [
    'marital-status','number-of-dependent-children','dependent-children','household-size','number-of-adults','childcare-support-needed'
  ]},
  { id: 'eligibility', label: 'Eligibility', keys: [
    'citizenship','residency-status','authorized-to-work','program-interest','training-goal','needs-assessment-completed'
  ]},
  { id: 'employment', label: 'Employment', keys: [
    'current-employment-status','employment-history','unemployment-duration','employer-name','occupation','bil-upload'
  ]},
  { id: 'barriers', label: 'Barriers', keys: [
    'barriers-to-employment','transportation-barrier','childcare-barrier','disability-status','criminal-record'
  ]},
  { id: 'health', label: 'Health / Accessibility', keys: [
    'disability-status','health-conditions','accessibility-needs'
  ]},
  { id: 'financial', label: 'Financial', keys: [
    'annual-income','household-income','income-sources','receives-ei','ei-amount','other-funding-sources'
  ]},
  { id: 'emergency', label: 'Emergency Contact', keys: [
    'emergency-contact-name','emergency-contact-relationship','emergency-contact-phone','emergency-contact-email'
  ]},
  { id: 'signatures', label: 'Signatures / Consent', keys: [
    'applicant-signature','consent-given','signature-date','application-submitted-at'
  ]}
];

const IsetApplicationFormWidget = ({ actions, application_id, toggleHelpPanel }) => {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [flashMessages, setFlashMessages] = useState([]);
  const [caseSummary, setCaseSummary] = useState('');
  const [initialCaseSummary, setInitialCaseSummary] = useState('');
  const [savingCaseSummary, setSavingCaseSummary] = useState(false);
  const [editMode, setEditMode] = useState(true); // always start in edit mode so fields are inputs
  const [answerEdits, setAnswerEdits] = useState({}); // local edits
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [originalAnswersSnapshot, setOriginalAnswersSnapshot] = useState(null); // for undo

  // Load application
  useEffect(() => {
    if (!application_id) return;
    setLoading(true); setLoadError(null);
    apiFetch(`/api/applications/${application_id}`)
      .then(async res => {
        if (res.ok) return res.json();
        let msg = 'Failed to load application';
        try { const body = await res.json(); if (body?.error) msg = body.error; } catch {/* ignore */}
        if (res.status === 404) msg = 'Application not found';
        if (res.status === 401) msg = 'Not authorized to view this application';
        const err = new Error(msg); err.status = res.status; throw err;
      })
      .then(data => {
        let payload = data.payload_json;
        if (payload && typeof payload === 'string') { try { payload = JSON.parse(payload); } catch {/* ignore */} }
        data.__payload = payload || {};
        setApplication(data);
        setCaseSummary(data.case?.case_summary || '');
        setInitialCaseSummary(data.case?.case_summary || '');
      })
      .catch(err => {
        console.error('[IsetApplicationFormWidget] load failed', err);
        setApplication({ __error: true });
        setLoadError(err.message || 'Failed to load application');
      })
      .finally(() => setLoading(false));
  }, [application_id]);

  const { answers, schemaFields } = useMemo(() => {
    if (!application || application.__error) return { answers: {}, schemaFields: {} };
    const p = application.__payload || {};
    const a = p.answers || p.intake_answers || p;
    const sf = p._schema_fields || {};
    return { answers: a, schemaFields: sf };
  }, [application]);

  // Derived combined view (answers + local edits while in edit mode)
  const effectiveAnswers = editMode ? { ...answers, ...answerEdits } : answers;

  const availableSections = useMemo(() => {
    return SECTION_DEFS.map(sec => {
      const items = sec.keys
        .filter(k => Object.prototype.hasOwnProperty.call(effectiveAnswers, k))
        .map(k => {
          const meta = schemaFields[k];
            let label = meta && meta.label ? (typeof meta.label === 'object' ? (meta.label.en || meta.label.fr || k) : meta.label) : k;
            if (!meta) {
              label = k.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            }
            return { key: k, label, value: effectiveAnswers[k], meta };
        });
      return { ...sec, items };
    }).filter(sec => sec.items.length > 0);
  }, [effectiveAnswers]);

  // Collect "other" keys not covered
  const otherSection = useMemo(() => {
    const covered = new Set(SECTION_DEFS.flatMap(s => s.keys));
    const misc = Object.keys(effectiveAnswers || {}).filter(k => !covered.has(k));
    if (!misc.length) return null;
    return {
      id: 'other', label: 'Other Data', items: misc.map(k => {
        const meta = schemaFields[k];
        let label = meta && meta.label ? (typeof meta.label === 'object' ? (meta.label.en || meta.label.fr || k) : meta.label) : k.replace(/-/g,' ');
        return { key: k, label, value: effectiveAnswers[k], meta };
      })
    };
  }, [effectiveAnswers]);

  const dirtyCaseSummary = caseSummary !== initialCaseSummary;

  const saveCaseSummary = () => {
    setSavingCaseSummary(true);
    apiFetch(`/api/applications/${application_id}/ptma-case-summary`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_summary: caseSummary })
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => {
        const newVal = data.case_summary || data.case?.case_summary || caseSummary;
        setInitialCaseSummary(newVal);
        setCaseSummary(newVal);
        setFlashMessages([{ type: 'success', content: 'Case summary saved', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
      })
      .catch(() => setFlashMessages([{ type: 'error', content: 'Failed to save case summary', dismissible: true, onDismiss: () => setFlashMessages([]) }]))
      .finally(() => setSavingCaseSummary(false));
  };

  const cancelCaseSummary = () => {
    setCaseSummary(initialCaseSummary);
  };

  const handleAnswerChange = (key, value) => {
    setOriginalAnswersSnapshot(snap => snap || answers); // capture once
    setAnswerEdits(ed => ({ ...ed, [key]: value }));
  };

  const renderValueEditor = (key, value) => {
    // Simple heuristic: multiline for long strings, boolean toggle via select, else Input
    if (typeof value === 'boolean') {
      return (
        <Select
          selectedOption={{ label: value ? 'Yes' : 'No', value: value ? 'true' : 'false' }}
          onChange={e => handleAnswerChange(key, e.detail.selectedOption.value === 'true')}
          options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]}
        />
      );
    }
    const str = value === null || value === undefined ? '' : String(value);
    if (str.length > 120 || /\n/.test(str)) {
      return <Textarea rows={4} value={str} onChange={e => handleAnswerChange(key, e.detail.value)} />;
    }
    return <Input value={str} onChange={e => handleAnswerChange(key, e.detail.value)} />;
  };

  const renderSection = (section) => {
    const items = section.items.map(item => {
      let displayValue = item.value;
      if (item.meta && Array.isArray(item.meta.options) && item.meta.options.length) {
        const found = item.meta.options.find(o => o && o.value == item.value);
        if (found) {
          if (found.label) {
            if (typeof found.label === 'object') displayValue = found.label.en || found.label.fr || displayValue; else displayValue = found.label;
          }
        }
      }
      return {
        id: item.key,
        field: item.key,
        label: item.label,
        value: displayValue
      };
    });
    if (!items.length) return null;
    return (
      <SpaceBetween key={section.id} size="xs">
        <Box variant="h3">{section.label}</Box>
        <Table
          variant="embedded"
          columnDefinitions={[
            { id: 'label', header: 'Field', cell: item => item.label, sortingField: 'label' },
            { id: 'value', header: 'Value', cell: item => renderValueEditor(item.field, item.value) }
          ]}
          items={items}
          trackBy="id"
          resizableColumns
          stickyHeader
          header={null}
        />
      </SpaceBetween>
    );
  };

  const anyAnswerDirty = useMemo(() => {
    return Object.keys(answerEdits).some(k => answerEdits[k] !== answers[k]);
  }, [answerEdits, answers]);

  const undoEdits = () => {
    if (originalAnswersSnapshot) {
      setAnswerEdits({});
    }
  };

  const saveAnswers = () => {
  if (!anyAnswerDirty) { return; }
    const changed = {};
    for (const [k,v] of Object.entries(answerEdits)) {
      if (v !== answers[k]) changed[k] = v;
    }
    if (!Object.keys(changed).length) { setEditMode(false); return; }
    setSavingAnswers(true);
    apiFetch(`/api/applications/${application_id}/answers`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: changed })
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(resp => {
        // Update local application payload to reflect saved answers
        setApplication(app => {
          if (!app) return app;
            const p = app.__payload || {};
            const base = p.answers || p.intake_answers || p;
            Object.entries(changed).forEach(([k,v]) => { base[k] = v; });
            if (p.answers) p.answers = base; else p.answers = base; // ensure standardized
            return { ...app, __payload: { ...p } };
        });
        setAnswerEdits({});
        setOriginalAnswersSnapshot(null);
        setFlashMessages([{ type: 'success', content: 'Application answers saved', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
      })
      .catch(() => setFlashMessages([{ type: 'error', content: 'Failed to save edits', dismissible: true, onDismiss: () => setFlashMessages([]) }]))
      .finally(() => setSavingAnswers(false));
  };

  if (loading || !application || application.__error) {
    return (
      <BoardItem
        header={<Header info={<Link variant="info" onFollow={() => toggleHelpPanel && toggleHelpPanel(<IsetApplicationFormHelpPanelContent />, 'ISET Application Form Help')}>Info</Link>}>ISET Application Form</Header>}
        i18nStrings={{
          dragHandleAriaLabel: 'Drag handle',
          dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
          resizeHandleAriaLabel: 'Resize handle',
          resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
        }}
        settings={actions && actions.removeItem && (
          <SpaceBetween direction="horizontal" size="xs" />
        )}
      >
        {loading ? 'Loading...' : (loadError || 'Failed to load application')}
      </BoardItem>
    );
  }

  return (
    <BoardItem
      header={<Header info={<Link variant="info" onFollow={() => toggleHelpPanel && toggleHelpPanel(<IsetApplicationFormHelpPanelContent />, 'ISET Application Form Help')}>Info</Link>}>ISET Application Form</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        <SpaceBetween direction="horizontal" size="xs">
          <Button onClick={saveAnswers} disabled={!anyAnswerDirty || savingAnswers} loading={savingAnswers} variant="primary">Save</Button>
          <Button onClick={() => setAnswerEdits({})} disabled={!anyAnswerDirty || savingAnswers}>Cancel</Button>
          <Button onClick={undoEdits} disabled={savingAnswers || !originalAnswersSnapshot}>Undo</Button>
          {actions && actions.removeItem && (
            <ButtonDropdown
              items={[{ id: 'remove', text: 'Remove' }]}
              ariaLabel="Board item settings"
              variant="icon"
              onItemClick={() => actions && actions.removeItem && actions.removeItem()}
            />
          )}
        </SpaceBetween>
      }
    >
      <SpaceBetween size="l">
  {availableSections.map(renderSection)}
  {otherSection && renderSection(otherSection)}
        <SpaceBetween size="xs">
          <Box variant="h3">Case Summary</Box>
          <Textarea rows={5} value={caseSummary} onChange={e => setCaseSummary(e.detail.value)} placeholder="Enter case summary" />
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={saveCaseSummary} disabled={!dirtyCaseSummary} loading={savingCaseSummary}>Save</Button>
            <Button variant="link" disabled={!dirtyCaseSummary || savingCaseSummary} onClick={cancelCaseSummary}>Discard</Button>
          </SpaceBetween>
        </SpaceBetween>
        <Flashbar items={flashMessages} />
      </SpaceBetween>
    </BoardItem>
  );
};

export default IsetApplicationFormWidget;

// This widget renders ISET application answers in grouped read-only sections using the same ColumnLayout/FormField style
// pattern established on the configurationSettings dashboard. Unknown / additional keys are placed into an "Other Data" section.
