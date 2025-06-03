import React, { useState, useEffect } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Form, FormField, Input, Select, Grid, SpaceBetween, Header, Button, ButtonDropdown, Box, Flashbar } from '@cloudscape-design/components';
import { useParams } from 'react-router-dom';

const GeneralServiceModuleInformation = () => {
  const { id: serviceModuleId } = useParams();
  const [serviceModule, setServiceModule] = useState({});
  const [initialServiceModule, setInitialServiceModule] = useState({});
  const [statusOptions] = useState([
    { label: 'Active', value: 'Active' },
    { label: 'Inactive', value: 'Inactive' }
  ]);
  const [isChanged, setIsChanged] = useState(false);
  const [serviceOwnerOptions, setServiceOwnerOptions] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/service-modules/${serviceModuleId}`)
      .then(response => response.json())
      .then(data => {
        setServiceModule(data);
        setInitialServiceModule(data);
      })
      .catch(error => console.error('Error fetching service module:', error));

    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin-users`)
      .then(response => response.json())
      .then(data => setServiceOwnerOptions(data.map(user => ({ label: user.name, value: user.id }))))
      .catch(error => console.error('Error fetching admin users:', error));
  }, [serviceModuleId]);

  const validateInputs = () => {
    const newErrors = {};
    if (!serviceModule.name) newErrors.name = 'Service Module Name cannot be blank';
    if (!serviceModule.status) newErrors.status = 'Status cannot be blank';
    if (!serviceModule.service_owner_id) newErrors.service_owner_id = 'Service Owner cannot be blank';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateInputs()) return;

    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/service-modules/${serviceModuleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serviceModule),
    })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => { throw new Error(text) });
        }
        return response.json();
      })
      .then(data => {
        setServiceModule(data);
        setInitialServiceModule(data);
        setIsChanged(false);
        setFlashMessages([{ type: 'success', content: 'Service module information saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error saving service module information', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error saving service module information:', error);
      });
  };

  const handleCancel = () => {
    setServiceModule(initialServiceModule);
    setIsChanged(false);
  };

  const handleChange = (field, value) => {
    setServiceModule(prevServiceModule => {
      const updatedServiceModule = { ...prevServiceModule, [field]: value };
      setIsChanged(JSON.stringify(updatedServiceModule) !== JSON.stringify(initialServiceModule));
      return updatedServiceModule;
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <BoardItem
      i18nStrings={{
        dragHandleAriaLabel: "Drag handle",
        dragHandleAriaDescription: "Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.",
        resizeHandleAriaLabel: "Resize handle",
        resizeHandleAriaDescription: "Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard."
      }}
      header={
        <Header
          description="General information about the service module"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={handleSave} disabled={!isChanged}>Save</Button>
              <Button variant="link" onClick={handleCancel}>Cancel</Button>
            </SpaceBetween>
          }
        >
          General Information
        </Header>
      }
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
    >
      <Flashbar items={flashMessages} />
      <Box margin={{ bottom: 's' }} /> {/* Add small space after Flashbar */}
      <Form>
        <Grid
          gridDefinition={[
            { colspan: 9 },
            { colspan: 3 },
            { colspan: 12 },
            { colspan: 4 },
            { colspan: 4 },
            { colspan: 4 },
          ]}
        >
          <FormField label="Service Module Name" errorText={errors.name}>
            <Input
              value={serviceModule.name || ''}
              onChange={e => handleChange('name', e.detail.value)}
            />
          </FormField>
          <FormField label="Status" errorText={errors.status}>
            <Select
              selectedOption={statusOptions.find(option => option.value === serviceModule.status) || null}
              onChange={e => handleChange('status', e.detail.selectedOption.value)}
              options={statusOptions}
              placeholder="Select a status"
            />
          </FormField>
          <FormField label="Service Description">
            <Input
              value={serviceModule.description || ''}
              onChange={e => handleChange('description', e.detail.value)}
            />
          </FormField>
          <FormField label="Created">
            <Input
              value={formatDate(serviceModule.created_date)}
              readOnly
            />
          </FormField>
          <FormField label="Last Updated">
            <Input
              value={formatDate(serviceModule.updated_date)}
              readOnly
            />
          </FormField>
          <FormField label="Service Owner" errorText={errors.service_owner_id}>
            <Select
              selectedOption={serviceOwnerOptions.find(option => option.value === serviceModule.service_owner_id) || null}
              onChange={e => handleChange('service_owner_id', e.detail.selectedOption.value)}
              options={serviceOwnerOptions}
              placeholder="Select a service owner"
            />
          </FormField>
        </Grid>
      </Form>
    </BoardItem>
  );
};

export default GeneralServiceModuleInformation;
