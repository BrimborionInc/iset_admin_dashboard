import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  Container,
  ExpandableSection,
  FormField,
  Grid,
  Header,
  Icon,
  Input,
  Link,
  Modal,
  SpaceBetween,
  Table,
  Tabs
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { apiFetch } from '../auth/apiClient';
import ManageTemplatesWidgetHelp from '../helpPanelContents/manageTemplatesWidgetHelp';

const tokenOptions = [
  { label: 'Applicant Name', value: '{applicant_name}' },
  { label: 'Application ID', value: '{application_id}' },
  { label: 'Tracking ID', value: '{tracking_id}' },
  { label: 'Submission Date', value: '{submission_date}' },
  { label: 'Assessor Name', value: '{assessor_name}' },
  { label: 'Portal Dashboard URL', value: '{portal_dashboard_url}' },
  { label: 'Support Email', value: '{support_email}' }
];

const languages = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' }
];

const defaultLocalizedContent = () => ({
  en: { subject: '', textBody: '' },
  fr: { subject: '', textBody: '' }
});

const cloneLocalizedContent = (content = {}) => ({
  en: { ...(content.en || { subject: '', textBody: '' }) },
  fr: { ...(content.fr || { subject: '', textBody: '' }) }
});

const extractJson = (s) => {
  if (!s || typeof s !== 'string') return null;
  try { return JSON.parse(s); } catch (_) {}
  const fenced = s.match(/```json\s*([\s\S]*?)```/i) || s.match(/```\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) {
    try { return JSON.parse(fenced[1]); } catch (_) {}
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = s.slice(start, end + 1);
    try { return JSON.parse(slice); } catch (_) {}
  }
  return null;
};

const STORAGE_KEY = 'manageTemplates.selection.v1';

const safeSessionStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }
    return window.sessionStorage;
  } catch (err) {
    console.warn('[templates] sessionStorage unavailable', err);
    return null;
  }
};

const readStoredSelection = () => {
  try {
    const storage = safeSessionStorage();
    if (!storage) return null;
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[templates] failed to read stored selection', err);
    return null;
  }
};

const writeStoredSelection = (payload) => {
  try {
    const storage = safeSessionStorage();
    if (!storage) return;
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[templates] failed to persist selection', err);
  }
};

const clearStoredSelection = () => {
  try {
    const storage = safeSessionStorage();
    if (!storage) return;
    storage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[templates] failed to clear stored selection', err);
  }
};

const ManageTemplates = ({ actions, dragHandleAriaLabel, i18nStrings, toggleHelpPanel }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [localizedContent, setLocalizedContent] = useState(defaultLocalizedContent());
  const [activeLanguage, setActiveLanguage] = useState('en');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [baselineTemplate, setBaselineTemplate] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [translateModal, setTranslateModal] = useState(null); // { mode: 'missing'|'confirm', fromLang, targetLang, fromLabel, targetLabel, message }
  const [feedbackModal, setFeedbackModal] = useState(null); // { status: 'success'|'error', message: string }
  const textAreaRef = useRef(null);
  const selectionRef = useRef({
    en: { start: 0, end: 0 },
    fr: { start: 0, end: 0 }
  });
  const storedSelectionRef = useRef(readStoredSelection());
  const hasRestoredSelectionRef = useRef(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = () => {
    setLoading(true);
    apiFetch('/api/templates')
      .then((response) => response.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []));
        setLoading(false);
        attemptRestoreSelection();
      })
      .catch((error) => {
        console.error('Error fetching templates:', error);
        setLoading(false);
        attemptRestoreSelection();
      });
  };

  const attemptRestoreSelection = () => {
    if (hasRestoredSelectionRef.current) return;
    const stored = storedSelectionRef.current;
    if (!stored) {
      hasRestoredSelectionRef.current = true;
      return;
    }

    hasRestoredSelectionRef.current = true;
    if (stored.type === 'existing' && stored.templateId) {
      handleTemplateSelection(stored.templateId, { draftOverride: stored });
      return;
    }

    if (stored.type === 'new') {
      const localized = cloneLocalizedContent(stored.localized || defaultLocalizedContent());
      setSelectedTemplate({
        id: null,
        name: stored.name || stored.baseline?.name || 'New Template',
        status: 'Draft',
        language: 'English',
        subject: localized.en.subject || 'Subject line',
        htmlBody: localized.en.textBody || '',
        textBody: localized.en.textBody || ''
      });
      setLocalizedContent(localized);
      setActiveLanguage(stored.activeLanguage || 'en');
      selectionRef.current = {
        en: { start: 0, end: 0 },
        fr: { start: 0, end: 0 }
      };
      setBaselineTemplate({
        name: stored.baseline?.name || 'New Template',
        localized: cloneLocalizedContent(stored.baseline?.localized || defaultLocalizedContent())
      });
    }
  };

  const handleTemplateSelection = (templateId, options = {}) => {
    const draftOverride = options.draftOverride;
    apiFetch(`/api/templates/${templateId}`)
      .then((response) => response.json())
      .then((data) => {
        const nextTemplate = {
          ...data,
          name: draftOverride?.name || data.name
        };
        setSelectedTemplate(nextTemplate);
        const localized = defaultLocalizedContent();
        localized.en.subject = data.localized?.en?.subject || data.subject || '';
        localized.en.textBody = data.localized?.en?.textBody || data.textBody || data.content || '';
        localized.fr.subject = data.localized?.fr?.subject || '';
        localized.fr.textBody = data.localized?.fr?.textBody || '';
        setLocalizedContent(localized);
        setActiveLanguage(draftOverride?.activeLanguage || 'en');
        selectionRef.current = {
          en: { start: 0, end: 0 },
          fr: { start: 0, end: 0 }
        };
        setBaselineTemplate({
          name: data.name || '',
          localized: cloneLocalizedContent(localized)
        });
        if (draftOverride?.localized) {
          setLocalizedContent(cloneLocalizedContent(draftOverride.localized));
        }
        // status temporarily dropped from UI/payload
      })
      .catch((error) => console.error('Error fetching template details:', error));
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate || !baselineTemplate || !isDirty) return;
    const english = localizedContent.en;
    const payload = {
      name: selectedTemplate.name,
      localized: localizedContent,
      subject: english.subject,
      htmlBody: english.textBody,
      textBody: english.textBody,
      content: english.textBody
    };

    try {
      const response = await apiFetch(`/api/templates/${selectedTemplate.id ?? 'new'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error || 'Failed to save template.';
        throw new Error(message);
      }

      fetchTemplates();
      if (data) {
        setSelectedTemplate(data);
        setBaselineTemplate({
          name: data.name,
          localized: cloneLocalizedContent(data.localized || localizedContent)
        });
        setLocalizedContent(cloneLocalizedContent(data.localized || localizedContent));
      } else {
        setBaselineTemplate({
          name: selectedTemplate.name,
          localized: cloneLocalizedContent(localizedContent)
        });
      }
      setFeedbackModal({ status: 'success', message: 'Template saved successfully.' });
    } catch (error) {
      console.error('Error saving template:', error);
      setFeedbackModal({ status: 'error', message: error.message || 'Failed to save template.' });
    }
  };

  useEffect(() => {
    if (!selectedTemplate || !baselineTemplate) return;
    const payload = {
      type: selectedTemplate.id ? 'existing' : 'new',
      templateId: selectedTemplate.id || null,
      name: selectedTemplate.name || '',
      localized: localizedContent,
      baseline: baselineTemplate,
      activeLanguage
    };
    storedSelectionRef.current = payload;
    writeStoredSelection(payload);
  }, [selectedTemplate, localizedContent, baselineTemplate, activeLanguage]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const selection = selectionRef.current[activeLanguage] || { start: 0, end: 0 };
    requestAnimationFrame(() => {
      try {
        textarea.focus();
        textarea.setSelectionRange(selection.start, selection.end);
      } catch (_) {
        /* ignore */
      }
    });
  }, [activeLanguage, selectedTemplate]);

  const handleNewTemplate = () => {
    const newTemplate = {
      name: "New Template",
      status: "Draft",
      language: "English",
      subject: "Subject line",
      htmlBody: "<p>Write your email...</p>",
      textBody: "Write your email..."
    };
    setSelectedTemplate(newTemplate);
    setLocalizedContent({
      en: { subject: newTemplate.subject, textBody: newTemplate.textBody },
      fr: { subject: '', textBody: '' }
    });
    setActiveLanguage('en');
    selectionRef.current = {
      en: { start: 0, end: 0 },
      fr: { start: 0, end: 0 }
    };
    setBaselineTemplate({
      name: newTemplate.name,
      localized: cloneLocalizedContent({
        en: { subject: newTemplate.subject, textBody: newTemplate.textBody },
        fr: { subject: '', textBody: '' }
      })
    });
    // status temporarily dropped from UI/payload
  };

  const captureSelection = () => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    selectionRef.current[activeLanguage] = {
      start: textarea.selectionStart || 0,
      end: textarea.selectionEnd || 0
    };
  };

  const handleInsertToken = (token) => {
    if (!token) return;
    const textarea = textAreaRef.current;
    const currentValue = localizedContent[activeLanguage].textBody || '';
    const selection = selectionRef.current[activeLanguage] || { start: 0, end: 0 };
    if (textarea && typeof selection.start === 'number') {
      const { start, end } = selection;
      const nextValue =
        currentValue.slice(0, start) + token.value + currentValue.slice(end);
      setLocalizedContent((prev) => ({
        ...prev,
        [activeLanguage]: {
          ...prev[activeLanguage],
          textBody: nextValue
        }
      }));
      requestAnimationFrame(() => {
        const el = textAreaRef.current;
        if (!el) return;
        const cursor = start + token.value.length;
        el.focus();
        try {
          el.setSelectionRange(cursor, cursor);
        } catch (err) {
          console.warn('setSelectionRange failed', err);
        }
        selectionRef.current[activeLanguage] = { start: cursor, end: cursor };
      });
    } else {
      const nextValue = currentValue + token.value;
      setLocalizedContent((prev) => ({
        ...prev,
        [activeLanguage]: {
          ...prev[activeLanguage],
          textBody: nextValue
        }
      }));
    }
  };

  const handleDeleteTemplate = () => {
    if (!templateToDelete) return;

    apiFetch(`/api/templates/${templateToDelete.id}`, {
      method: 'DELETE'
    })
      .then((response) => {
        if (response.ok) {
          fetchTemplates();
          if (selectedTemplate && templateToDelete.id === selectedTemplate.id) {
            setSelectedTemplate(null);
            setLocalizedContent(defaultLocalizedContent());
            setBaselineTemplate(null);
            storedSelectionRef.current = null;
            clearStoredSelection();
          }
          setTemplateToDelete(null);
          setFeedbackModal({
            status: 'success',
            message: 'Template deleted successfully.'
          });
        } else {
          console.error("Error deleting template:", response.statusText);
          setFeedbackModal({
            status: 'error',
            message: 'Failed to delete template.'
          });
        }
      })
      .catch((error) => {
        console.error("Error deleting template:", error);
        setFeedbackModal({
          status: 'error',
          message: error.message || 'Failed to delete template.'
        });
      });
  };

  const previewSample = useMemo(() => ({
    applicant_name: 'Jamie Applicant',
    application_id: 'APP-2042',
    tracking_id: 'NWAC-1A2B3C',
    submission_date: 'Oct 24, 2025',
    assessor_name: 'Casey Assessor',
    portal_dashboard_url: 'https://portal.sample/dashboard',
    support_email: 'support@example.ca'
  }), []);

  const renderPreview = (body) => {
    if (!body) return '';
    return body.replace(/\{([^}]+)\}/g, (_, token) => previewSample[token] || `{${token}}`);
  };

  const isDirty = useMemo(() => {
    if (!selectedTemplate || !baselineTemplate) return false;
    const nameDirty = (selectedTemplate.name || '') !== (baselineTemplate.name || '');
    const localizedDirty = JSON.stringify(localizedContent) !== JSON.stringify(baselineTemplate.localized);
    return nameDirty || localizedDirty;
  }, [selectedTemplate, baselineTemplate, localizedContent]);

  const handleRevertChanges = () => {
    if (!baselineTemplate || !selectedTemplate) return;
    setSelectedTemplate((prev) => ({ ...prev, name: baselineTemplate.name }));
    setLocalizedContent(cloneLocalizedContent(baselineTemplate.localized));
    setActiveLanguage('en');
    selectionRef.current = {
      en: { start: 0, end: 0 },
      fr: { start: 0, end: 0 }
    };
    setTranslateModal(null);
  };

  const translateBatch = async (items) => {
    const system = {
      role: 'system',
      content: 'You are a translation assistant. Translate between English and Canadian French. Preserve placeholders like {token}, numbers, punctuation, and formatting. Respond ONLY with JSON matching the requested schema.'
    };
    const user = {
      role: 'user',
      content: JSON.stringify({
        instruction: 'For each item, translate text from `from` to `to`. Respond with { "translations": [{ "id": string, "lang": "en"|"fr", "text": string }] }',
        items
      })
    };
    const res = await apiFetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [system, user] })
    });
    if (res.status === 501) {
      const err = new Error('ai-disabled');
      err.code = 'ai-disabled';
      throw err;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);
    const translations = parsed?.translations;
    if (!Array.isArray(translations) || !translations.length) {
      throw new Error('unexpected-response');
    }
    return translations
      .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.text === 'string')
      .map((entry) => ({ id: entry.id, lang: entry.lang, text: entry.text }));
  };

  const openTranslateModal = (fromLang) => {
    if (translating) return;
    const targetLang = fromLang === 'en' ? 'fr' : 'en';
    const fromLabel = languages.find((l) => l.id === fromLang)?.label || fromLang;
    const targetLabel = languages.find((l) => l.id === targetLang)?.label || targetLang;
    const source = localizedContent[fromLang];
    const missing = [];
    if (!source.subject || !source.subject.trim()) missing.push('subject');
    if (!source.textBody || !source.textBody.trim()) missing.push('email body');
    if (missing.length) {
      setTranslateModal({
        mode: 'missing',
        message: `Provide the ${missing.join(' and ')} in ${fromLabel} before translating.`
      });
      return;
    }
    setTranslateModal({
      mode: 'confirm',
      fromLang,
      targetLang,
      fromLabel,
      targetLabel
    });
  };

  const performTranslation = async ({ fromLang, targetLang, fromLabel, targetLabel }) => {
    setTranslating(true);
    try {
      const source = localizedContent[fromLang];
      const items = [
        { id: 'subject', from: fromLang, to: targetLang, text: source.subject },
        { id: 'textBody', from: fromLang, to: targetLang, text: source.textBody }
      ];
      const translations = await translateBatch(items);
      setLocalizedContent((prev) => {
        const next = cloneLocalizedContent(prev);
        translations.forEach((entry) => {
          if (!entry || entry.lang !== targetLang) return;
          if (entry.id === 'subject') next[targetLang].subject = entry.text;
          if (entry.id === 'textBody') next[targetLang].textBody = entry.text;
        });
        return next;
      });
      selectionRef.current[targetLang] = { start: 0, end: 0 };
      setActiveLanguage(targetLang);
    } catch (error) {
      if (error.code === 'ai-disabled') {
        setTranslateModal({ mode: 'info', message: 'AI translation is disabled on this environment.' });
      } else if (error.message === 'unexpected-response') {
        setTranslateModal({ mode: 'info', message: 'Translation service returned an unexpected response.' });
      } else {
        setTranslateModal({ mode: 'info', message: `Translation failed: ${error.message || String(error)}` });
      }
      return;
    } finally {
      setTranslating(false);
    }
  };

  const handleSubjectChange = (lang, value) => {
    setLocalizedContent((prev) => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        subject: value
      }
    }));
  };

  const handleBodyChange = (lang, value) => {
    setLocalizedContent((prev) => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        textBody: value
      }
    }));
  };

  const renderLanguageSection = (lang) => {
    if (lang !== activeLanguage) {
      return null;
    }
    const langLabel = languages.find((l) => l.id === lang)?.label || lang;
    const targetLang = lang === 'en' ? 'fr' : 'en';
    const targetLabel = languages.find((l) => l.id === targetLang)?.label || targetLang;
    const content = localizedContent[lang];
    return (
      <SpaceBetween size="m">
        <Grid gridDefinition={[{ colspan: 9 }, { colspan: 3 }]}
          className="subject-row" alignItems="end">
          <FormField label={`Subject (${langLabel})`}>
            <Input value={content.subject} onChange={({ detail }) => handleSubjectChange(lang, detail.value)} />
          </FormField>
          <Box display="flex" alignItems="center" justifyContent="flex-end">
            <Button
              onClick={() => openTranslateModal(lang)}
              iconName="gen-ai"
              disabled={translating}
            >
              {lang === 'en' ? 'Translate to French' : 'Traduire en anglais'}
            </Button>
          </Box>
        </Grid>
        <ColumnLayout columns={2} variant="text-grid">
          <div style={{ border: '1px solid var(--color-border-divider-default)', borderRadius: '8px', padding: '16px', backgroundColor: 'var(--color-background-container-content)', minHeight: 280 }}>
            <FormField label={`Email body (${langLabel})`}>
              <textarea
                ref={lang === activeLanguage ? textAreaRef : null}
                rows={16}
                className="textarea-native"
                value={content.textBody}
                onChange={(event) => {
                  handleBodyChange(lang, event.target.value);
                  captureSelection();
                }}
                onClick={captureSelection}
                onKeyUp={captureSelection}
                onKeyDown={captureSelection}
                onSelect={captureSelection}
                onFocus={captureSelection}
                onMouseUp={captureSelection}
                placeholder="Write the message applicants or staff will receive."
                style={{ width: '100%', minHeight: 201.6, padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border-input-default)' }}
              />
            </FormField>
          </div>
          <div style={{ border: '1px solid var(--color-border-divider-default)', borderRadius: '8px', padding: '16px', backgroundColor: 'var(--color-background-container-content)', minHeight: 280 }}>
            <Header variant="h4">Preview (sample data)</Header>
            <Box padding="m" style={{ backgroundColor: 'var(--color-background-layout-panel, #f8f8f8)', minHeight: 220 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {renderPreview(content.textBody || 'No content yet.')}
              </pre>
            </Box>
          </div>
        </ColumnLayout>
      </SpaceBetween>
    );
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description="Draft localized email templates for applicant and staff events. Select a template, edit the bilingual subject and body tabs, then save to publish updates for Notification Settings."
          info={
            <Link
              variant="info"
              onFollow={() =>
                toggleHelpPanel &&
                ManageTemplatesWidgetHelp &&
                toggleHelpPanel(<ManageTemplatesWidgetHelp />, 'Template Editor Help')
              }
            >
              Info
            </Link>
          }
        >
          Template Editor
        </Header>
      }
      dragHandleAriaLabel={dragHandleAriaLabel}
      i18nStrings={i18nStrings}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions.removeItem()}
        />
      }
    >
      <Grid gridDefinition={[{ colspan: 4 }, { colspan: 8 }]}>
        <Table
          header={
            <Header
              variant="h3"
              description="Select a template to load it into the editor. Use the action column to remove unused entries."
              actions={<Button onClick={handleNewTemplate}>New Template</Button>}
            >
              Template Library
            </Header>
          }
          items={templates}
          loading={loading}
          trackBy="id"
          stripedRows
          columnDefinitions={[
            {
              id: 'name',
              header: 'Name',
              cell: item => (
                <Link onClick={() => handleTemplateSelection(item.id)}>
                  {item.name}
                </Link>
              )
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: item => (
                <Button
                  variant="icon"
                  iconName="close"
                  ariaLabel={`Delete ${item.name}`}
                  onClick={() => { setTemplateToDelete(item); setShowDeleteModal(true); }}
                />
              )
            }
          ]}
        />

        <Container
          header={
            <Header
              variant="h3"
              description="Edit subject lines and email bodies for each locale. Use the Insert field menu to drop placeholders, translate between English and French as needed, then save when both tabs look good."
              actions={
                selectedTemplate ? (
                  <SpaceBetween direction="horizontal" size="s">
                    <ButtonDropdown
                      items={tokenOptions.map(token => ({ id: token.value, text: token.label }))}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        captureSelection();
                      }}
                      onItemClick={({ detail }) => {
                        handleInsertToken({ value: detail.id });
                      }}
                    >
                      Insert field
                    </ButtonDropdown>
                    <Button
                      variant="primary"
                      onClick={handleSaveTemplate}
                      disabled={!isDirty}
                    >
                      Save changes
                    </Button>
                    <Button onClick={handleRevertChanges} disabled={!isDirty}>
                      Cancel
                    </Button>
                  </SpaceBetween>
                ) : null
              }
            >
              Editor
            </Header>
          }
        >
          {!selectedTemplate ? (
            <Box textAlign="center" padding="xxl">
              <SpaceBetween size="m">
                <Icon name="file" size="large" />
                <Box variant="strong">Select a template to start editing</Box>
                <Box variant="p">Pick an existing template or create a new one using the button above.</Box>
              </SpaceBetween>
            </Box>
          ) : (
            <SpaceBetween size="l">
              <SpaceBetween size="m">
                <FormField label="Template name">
                  <Input
                    value={selectedTemplate.name}
                    onChange={({ detail }) => setSelectedTemplate({ ...selectedTemplate, name: detail.value })}
                  />
                </FormField>
                <Tabs
                  activeTabId={activeLanguage}
                  onChange={({ detail }) => setActiveLanguage(detail.activeTabId)}
                  tabs={languages.map((lang) => ({
                    id: lang.id,
                    label: lang.label,
                    content: renderLanguageSection(lang.id)
                  }))}
                />
              </SpaceBetween>

            </SpaceBetween>
          )}
        </Container>
      </Grid>

      {feedbackModal && (
        <Modal
          visible
          onDismiss={() => setFeedbackModal(null)}
          closeAriaLabel="Close modal"
          header={feedbackModal.status === 'success' ? 'Template updated' : 'Action failed'}
          footer={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={() => setFeedbackModal(null)}>
                Close
              </Button>
            </SpaceBetween>
          }
        >
          <Box>
            {feedbackModal.message}
          </Box>
        </Modal>
      )}

      {translateModal && (
        <Modal
          onDismiss={() => setTranslateModal(null)}
          visible
          closeAriaLabel="Close modal"
          header={
            translateModal.mode === 'confirm'
              ? `Translate ${translateModal.fromLabel} content`
              : 'Translation notice'
          }
          footer={
            translateModal.mode === 'confirm' ? (
            <SpaceBetween direction="horizontal" size="s">
              <Button onClick={() => setTranslateModal(null)}>Cancel</Button>
              <Button
                variant="primary"
                loading={translating}
                disabled={translating}
                onClick={() => {
                  const payload = translateModal;
                  setTranslateModal(null);
                  performTranslation(payload);
                }}
              >
                {`Overwrite with ${translateModal.targetLabel === 'Français' ? 'French' : translateModal.targetLabel}`}
              </Button>
            </SpaceBetween>
            ) : (
              <Button onClick={() => setTranslateModal(null)}>Close</Button>
            )
          }
        >
          {translateModal.mode === 'confirm' ? (
            <SpaceBetween size="s">
              <p>
                {`This will overwrite the ${translateModal.targetLabel} subject and email body with AI-generated text based on the ${translateModal.fromLabel} version.`}
              </p>
              <p>AI translations can contain errors. Review the results before sending to applicants.</p>
            </SpaceBetween>
          ) : (
            <p>{translateModal.message}</p>
          )}
        </Modal>
      )}

      {showDeleteModal && (
        <Modal
          onDismiss={() => setShowDeleteModal(false)}
          visible={showDeleteModal}
          closeAriaLabel="Close modal"
          header="Delete Template"
          footer={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={() => { handleDeleteTemplate(); setShowDeleteModal(false); }}>Delete</Button>
              <Button variant="normal" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            </SpaceBetween>
          }
        >
          Are you sure you want to delete this template?
        </Modal>
      )}
    </BoardItem>
  );
};

export default ManageTemplates;
