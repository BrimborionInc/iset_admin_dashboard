import React, { useState, useEffect } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Form, FormField, Input, Multiselect, Header, Box, SpaceBetween, Button, ButtonDropdown, Flashbar } from '@cloudscape-design/components';
import { useParams } from 'react-router-dom';

const ResourceRequirements = () => {
  const { id: serviceModuleId } = useParams(); // Get service module ID from URL parameters
  const [serviceModule, setServiceModule] = useState({}); // State to hold service module data
  const [initialServiceModule, setInitialServiceModule] = useState({}); // State to hold initial service module data
  const [facilityOptions] = useState([
    { label: 'Counter', value: 'Counter' },
    { label: 'Biometrics', value: 'Biometrics' },
    { label: 'Self-Service Workstation', value: 'Self-Service Workstation' },
    { label: 'Virtual Service', value: 'Virtual Service' }
  ]); // Hardcoded facility options
  const [selectedFacilities, setSelectedFacilities] = useState([]); // State to hold selected facilities
  const [flashMessages, setFlashMessages] = useState([]); // State to hold flash messages
  const [isChanged, setIsChanged] = useState(false); // State to track if form data has changed
  const [errors, setErrors] = useState({}); // State to hold validation errors

  useEffect(() => {
    // Fetch service module data when component mounts
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/service-modules/${serviceModuleId}`)
      .then(response => response.json())
      .then(data => {
        setServiceModule(data); // Set service module data
        setInitialServiceModule(data); // Set initial service module data
        if (data.requirements_json) {
          // Populate selected facilities based on requirements_json
          setSelectedFacilities(Object.keys(data.requirements_json).map(key => ({ label: key, value: key })));
        }
      })
      .catch(error => console.error('Error fetching service module:', error));

    // Fetch facility requirements for the specific service type
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/facility-requirements/${serviceModuleId}`)
      .then(response => response.json())
      .then(data => {
        const selected = Object.keys(data).map(key => ({ label: key, value: key }));
        setSelectedFacilities(selected);
      })
      .catch(error => console.error('Error fetching facility requirements:', error));
  }, [serviceModuleId]);

  const validateInputs = () => {
    const newErrors = {};
    if (!serviceModule.default_duration || isNaN(serviceModule.default_duration)) {
      newErrors.default_duration = 'Default Duration must be a number and cannot be blank';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateInputs()) return;

    // Save updated service module data
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
        setServiceModule(data); // Update service module data
        setInitialServiceModule(data); // Update initial service module data
        setIsChanged(false); // Reset change tracking
        setFlashMessages([{ type: 'success', content: 'Resource requirements saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error saving resource requirements', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error saving resource requirements:', error);
      });
  };

  const handleCancel = () => {
    // Reset form data to initial values
    setServiceModule(initialServiceModule);
    setSelectedFacilities(Object.keys(initialServiceModule.requirements_json || {}).map(key => ({ label: key, value: key })));
    setIsChanged(false);
    setErrors({});
  };

  const handleChange = (field, value) => {
    // Update service module data and track changes
    setServiceModule(prevServiceModule => {
      const updatedServiceModule = { ...prevServiceModule, [field]: value };
      setIsChanged(JSON.stringify(updatedServiceModule) !== JSON.stringify(initialServiceModule));
      return updatedServiceModule;
    });
  };

  const handleFacilityChange = (selected) => {
    // Update selected facilities and requirements_json
    setSelectedFacilities(selected);
    const requirements_json = selected.reduce((acc, item) => {
      acc[item.value] = true;
      return acc;
    }, {});
    handleChange('requirements_json', requirements_json);
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
          description="Resource requirements for the service module"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={handleSave} disabled={!isChanged}>Save</Button>
              <Button variant="link" onClick={handleCancel}>Cancel</Button>
            </SpaceBetween>
          }
        >
          Resource Requirements
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
        <FormField label="Default Duration (minutes)" errorText={errors.default_duration}>
          <Input
            type="number"
            value={serviceModule.default_duration || ''}
            onChange={e => handleChange('default_duration', e.detail.value)}
          />
        </FormField>
        <FormField label="Facility Requirements">
          <Multiselect
            selectedOptions={selectedFacilities}
            onChange={({ detail }) => handleFacilityChange(detail.selectedOptions)}
            options={facilityOptions}
            placeholder="Select facilities"
            tokenLimit={3}
            selectedAriaLabel="Selected"
          />
        </FormField>
      </Form>
    </BoardItem>
  );
};

export default ResourceRequirements;
