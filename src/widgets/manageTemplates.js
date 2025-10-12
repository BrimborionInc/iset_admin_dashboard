import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Button,
  Textarea,
  Select,
  Input,
  FormField,
  Table,
  ButtonDropdown,
  Grid,
  Modal,
  Link
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { apiFetch } from '../auth/apiClient';

// Network calls now use apiFetch (handles auth + base URL) with relative paths
// const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; // no longer needed for these calls

const placeholders = [
  { label: 'Applicant Name', value: '{applicant_name}' },
  { label: 'Appointment Date', value: '{appointment_date}' },
  { label: 'VAC Address', value: '{VAC_address}' }
];

const statuses = [
  'Draft',
  'For Review',
  'For Approval',
  'Approved',
  'Released',
  'Superseded',
  'Archived'
];

const languages = ['English', 'French', 'Spanish', 'Mandarin', 'Hindi'];

const notificationTypes = ['Email', 'SMS', 'Robo-Caller'];

const ManageTemplates = ({ actions, dragHandleAriaLabel, i18nStrings }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateContent, setTemplateContent] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [status, setStatus] = useState('Draft');
  const [notificationType, setNotificationType] = useState('Email');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);

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
        setTemplateContent(data.content);
        setSelectedLanguage(data.language);
        setStatus(data.status);
        setNotificationType(data.type);
      })
      .catch((error) => console.error('Error fetching template details:', error));
  };

  const handleSaveTemplate = () => {
    if (!selectedTemplate) return;
    const updatedTemplate = {
      name: selectedTemplate.name,
      type: notificationType,
      status,
      language: selectedLanguage,
      subject: selectedTemplate.subject,
      content: templateContent,
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
      type: "Email",
      status: "Draft",
      language: "English",
      content: "Enter your template content here..."
    };
    setSelectedTemplate(newTemplate);
    setTemplateContent(newTemplate.content);
    setSelectedLanguage(newTemplate.language);
    setStatus(newTemplate.status);
    setNotificationType(newTemplate.type);
  };

  const handleInsertPlaceholder = (placeholder) => {
    setTemplateContent((prevContent) => prevContent + placeholder.value);
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
      <SpaceBetween size="l">
        <Table
          header={<Header variant="h2">Notification and Reminder Templates Library</Header>}
          items={templates}
          columnDefinitions={[
            {
              id: 'name',
              header: 'Template Name',
              cell: item => (
                <Link onClick={() => handleTemplateSelection(item.id)}>
                  {item.name}
                </Link>
              )
            },
            { id: 'type', header: 'Type', cell: item => item.type },
            { id: 'status', header: 'Status', cell: item => item.status },
            { id: 'language', header: 'Language', cell: item => item.language || '' },
            {
              id: 'actions',
              header: 'Actions',
              cell: item => (
                <Button
                  variant="inline-link"
                  ariaLabel={`Delete ${item.name}`}
                  onClick={() => { setTemplateToDelete(item); setShowDeleteModal(true); }}
                >
                  Delete
                </Button>
              ),
              minWidth: 170
            }
          ]}
          loading={loading}
        />

        {selectedTemplate && (
          <Container header={<Header variant="h2">Edit Template</Header>}>
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <SpaceBetween size="m">
                <FormField label="Subject">
                  <Input
                    value={selectedTemplate.subject}
                    onChange={({ detail }) => setSelectedTemplate({ ...selectedTemplate, subject: detail.value })}
                  />
                </FormField>
                <FormField label="Template Content">
                  <Textarea
                    value={templateContent}
                    onChange={({ detail }) => setTemplateContent(detail.value)}
                    placeholder="Enter template text here..."
                    rows={10}
                  />
                </FormField>
                <FormField label="Insert Field">
                  <Select
                    options={placeholders}
                    selectedOption={null}
                    onChange={({ detail }) => handleInsertPlaceholder(detail.selectedOption)}
                    placeholder="Select a field to insert"
                  />
                </FormField>
              </SpaceBetween>
              <SpaceBetween size="m">
                <FormField label="Template Name">
                  <Input
                    value={selectedTemplate.name}
                    onChange={({ detail }) => setSelectedTemplate({ ...selectedTemplate, name: detail.value })}
                  />
                </FormField>
                <FormField label="Language">
                  <Select
                    options={languages.map(lang => ({ label: lang, value: lang }))}
                    selectedOption={{ label: selectedLanguage, value: selectedLanguage }}
                    onChange={({ detail }) => setSelectedLanguage(detail.selectedOption.value)}
                  />
                </FormField>
                <FormField label="Notification Type">
                  <Select
                    options={notificationTypes.map(type => ({ label: type, value: type }))}
                    selectedOption={{ label: notificationType, value: notificationType }}
                    onChange={({ detail }) => setNotificationType(detail.selectedOption.value)}
                  />
                </FormField>
                <FormField label="Status">
                  <Select
                    options={statuses.map(status => ({ label: status, value: status }))}
                    selectedOption={{ label: status, value: status }}
                    onChange={({ detail }) => setStatus(detail.selectedOption.value)}
                  />
                </FormField>
                <SpaceBetween direction="horizontal" size="s">
                  <Button variant="primary" onClick={handleSaveTemplate}>Save Changes</Button>
                  <Button variant="normal" onClick={handleCancelEdit}>Cancel</Button>
                </SpaceBetween>
              </SpaceBetween>
            </Grid>
          </Container>
        )}
      </SpaceBetween>

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
