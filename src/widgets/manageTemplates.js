import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  Container,
  ExpandableSection,
  FormField,
  Grid,
  Header,
  Icon,
  Input,
  Link,
  Modal,
  Select,
  SpaceBetween,
  Table,
  Textarea
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { apiFetch } from '../auth/apiClient';

const tokenOptions = [
  { label: 'Applicant Name', value: '{applicant_name}' },
  { label: 'Application ID', value: '{application_id}' },
  { label: 'Tracking ID', value: '{tracking_id}' },
  { label: 'Submission Date', value: '{submission_date}' },
  { label: 'Assessor Name', value: '{assessor_name}' },
  { label: 'Portal Dashboard URL', value: '{portal_dashboard_url}' },
  { label: 'Support Email', value: '{support_email}' }
];

const statuses = ['Draft', 'For Review', 'For Approval', 'Approved', 'Released', 'Superseded', 'Archived'];
const languages = ['English'];

const debugLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[TemplateEditor]', ...args);
  }
};

const ManageTemplates = ({ actions, dragHandleAriaLabel, i18nStrings }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [textBody, setTextBody] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [status, setStatus] = useState('Draft');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const textAreaRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });

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
      })
      .catch((error) => {
        console.error('Error fetching templates:', error);
        setLoading(false);
      });
  };

  const handleTemplateSelection = (templateId) => {
    apiFetch(`/api/templates/${templateId}`)
      .then((response) => response.json())
      .then((data) => {
        setSelectedTemplate(data);
        setSubject(data.subject || '');
        setHtmlBody(data.htmlBody || data.content || '');
        setTextBody(data.textBody || data.text || '');
        setSelectedLanguage(data.language || 'English');
        setStatus(data.status || 'Draft');
      })
      .catch((error) => console.error('Error fetching template details:', error));
  };

  const handleSaveTemplate = () => {
    if (!selectedTemplate) return;
    const updatedTemplate = {
      name: selectedTemplate.name,
      status,
      language: selectedLanguage,
      subject,
      htmlBody,
      textBody,
      content: htmlBody
    };

    apiFetch(`/api/templates/${selectedTemplate.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTemplate)
    })
      .then((response) => response.json())
      .then(() => {
        alert("Template saved successfully!");
        fetchTemplates();
        setSelectedTemplate(null);
      })
      .catch((error) => console.error("Error saving template:", error));
  };

  const handleCancelEdit = () => {
    setSelectedTemplate(null);
  };

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
    setSubject(newTemplate.subject);
    setHtmlBody(newTemplate.htmlBody);
    setTextBody(newTemplate.textBody);
    setSelectedLanguage(newTemplate.language);
    setStatus(newTemplate.status);
  };

  const captureSelection = () => {
    const textarea = textAreaRef.current;
    if (textarea && typeof textarea.selectionStart === 'number') {
      selectionRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd
      };
      debugLog('Captured selection', selectionRef.current);
    }
  };

  const handleInsertToken = (token) => {
    if (!token) return;
    const textarea = textAreaRef.current;
    const currentValue = textBody || '';
    const selection = selectionRef.current;
    debugLog('Attempting insert', { token: token.value, selection, hasRef: !!textarea });
    if (textarea && typeof selection.start === 'number') {
      const { start, end } = selection;
      const nextValue =
        currentValue.slice(0, start) + token.value + currentValue.slice(end);
      setTextBody(nextValue);
      setHtmlBody(nextValue);
      setTimeout(() => {
        textarea.focus();
        const cursor = start + token.value.length;
        textarea.selectionStart = textarea.selectionEnd = cursor;
        selectionRef.current = { start: cursor, end: cursor };
        debugLog('Updated cursor after insert', selectionRef.current);
      }, 0);
    } else {
      const nextValue = currentValue + token.value;
      setTextBody(nextValue);
      setHtmlBody(nextValue);
      debugLog('Fallback append path used');
    }
  };

  const handleDeleteTemplate = () => {
    if (!templateToDelete) return;

    apiFetch(`/api/templates/${templateToDelete.id}`, {
      method: 'DELETE'
    })
      .then((response) => {
        if (response.ok) {
          alert("Template deleted successfully!");
          fetchTemplates();
          setTemplateToDelete(null);
        } else {
          console.error("Error deleting template:", response.statusText);
        }
      })
      .catch((error) => console.error("Error deleting template:", error));
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

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          actions={<Button onClick={handleNewTemplate}>New Template</Button>}
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
        <Container
          header={<Header variant="h3">Template Library</Header>}
          footer={
            <Alert statusIconAriaLabel="Info">
              Templates shown here feed the Notification Settings matrix. Select one to edit a draft.
            </Alert>
          }
        >
          <SpaceBetween size="m">
            <Table
              header={<Header variant="h4">Templates</Header>}
              items={templates}
              loading={loading}
              trackBy="id"
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
                { id: 'status', header: 'Status', cell: item => item.status || '—' },
                { id: 'language', header: 'Lang', cell: item => item.language || 'en' },
                {
                  id: 'actions',
                  header: ' ',
                  cell: item => (
                    <Button
                      variant="inline-link"
                      ariaLabel={`Delete ${item.name}`}
                      onClick={() => { setTemplateToDelete(item); setShowDeleteModal(true); }}
                    >
                      Delete
                    </Button>
                  )
                }
              ]}
            />
            <ExpandableSection header="Token reference" variant="footer">
              <SpaceBetween size="xs">
                {tokenOptions.map(token => (
                  <Badge key={token.value} color="blue">
                    {token.value}
                  </Badge>
                ))}
              </SpaceBetween>
            </ExpandableSection>
          </SpaceBetween>
        </Container>

        <Container header={<Header variant="h3">Editor</Header>}>
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
              <Grid gridDefinition={[{ colspan: 4 }, { colspan: 8 }]}>
                <SpaceBetween size="l">
                  <Container header={<Header variant="h4">Template details</Header>}>
                    <SpaceBetween size="m">
                      <FormField label="Template name">
                        <Input
                          value={selectedTemplate.name}
                          onChange={({ detail }) => setSelectedTemplate({ ...selectedTemplate, name: detail.value })}
                        />
                      </FormField>
                      <FormField label="Status">
                        <Select
                          options={statuses.map(value => ({ label: value, value }))}
                          selectedOption={{ label: status, value: status }}
                          onChange={({ detail }) => setStatus(detail.selectedOption.value)}
                        />
                      </FormField>
                      <FormField label="Language">
                        <Select
                          options={languages.map(lang => ({ label: lang, value: lang }))}
                          selectedOption={{ label: selectedLanguage, value: selectedLanguage }}
                          onChange={({ detail }) => setSelectedLanguage(detail.selectedOption.value)}
                        />
                      </FormField>
                      <FormField label="Insert field">
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
                      </FormField>
                    </SpaceBetween>
                  </Container>
                </SpaceBetween>

                <SpaceBetween size="l">
                  <Container header={<Header variant="h4">Content</Header>}>
                    <SpaceBetween size="m">
                      <FormField label="Subject">
                        <Input value={subject} onChange={({ detail }) => setSubject(detail.value)} />
                      </FormField>
                      <FormField label="Email body (plain text)">
                        <Textarea
                          ref={textAreaRef}
                          rows={14}
                          value={textBody}
                          onChange={({ detail }) => {
                            setTextBody(detail.value);
                            setHtmlBody(detail.value);
                            captureSelection();
                          }}
                          onClick={captureSelection}
                          onMouseUp={captureSelection}
                          onFocus={captureSelection}
                          onKeyUp={captureSelection}
                          onSelect={captureSelection}
                          placeholder="Write the message applicants or staff will receive."
                        />
                      </FormField>
                    </SpaceBetween>
                  </Container>

                  <Container header={<Header variant="h4">Preview (sample data)</Header>}>
                    <Box padding="m" style={{ backgroundColor: 'var(--color-background-layout-panel, #f8f8f8)' }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                        {renderPreview(textBody || 'No content yet.')}
                      </pre>
                    </Box>
                  </Container>

                  <SpaceBetween direction="horizontal" size="s">
                    <Button variant="primary" onClick={handleSaveTemplate}>Save changes</Button>
                    <Button onClick={handleCancelEdit}>Cancel</Button>
                  </SpaceBetween>
                </SpaceBetween>
              </Grid>

            </SpaceBetween>
          )}
        </Container>
      </Grid>

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
