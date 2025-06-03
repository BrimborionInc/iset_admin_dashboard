import React, { useState, useEffect } from 'react';
import { Form, FormField, Input, Select, Grid, SpaceBetween, Header, Button, Flashbar, Box, ButtonDropdown } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useParams } from 'react-router-dom';

const GeneralInformation = () => {
  const { id: ptmaId } = useParams();
  const [location, setLocation] = useState({});
  const [initialLocation, setInitialLocation] = useState({});
  const [statusOptions] = useState([
    { label: 'Active', value: 'Active' },
    { label: 'Inactive', value: 'Inactive' },
    { label: 'Planned', value: 'Planned' }
  ]);
  const [provinceOptions] = useState([
    { label: 'Alberta', value: 'AB' },
    { label: 'British Columbia', value: 'BC' },
    { label: 'Manitoba', value: 'MB' },
    { label: 'New Brunswick', value: 'NB' },
    { label: 'Newfoundland and Labrador', value: 'NL' },
    { label: 'Northwest Territories', value: 'NT' },
    { label: 'Nova Scotia', value: 'NS' },
    { label: 'Nunavut', value: 'NU' },
    { label: 'Ontario', value: 'ON' },
    { label: 'Prince Edward Island', value: 'PE' },
    { label: 'Quebec', value: 'QC' },
    { label: 'Saskatchewan', value: 'SK' },
    { label: 'Yukon', value: 'YT' }
  ]);
  const [indigenousGroupOptions] = useState([
    { label: 'First Nations', value: 'First Nations' },
    { label: 'Inuit', value: 'Inuit' },
    { label: 'Métis', value: 'Métis' },
    { label: 'Urban/Non-affiliated', value: 'Urban/Non-affiliated' }
  ]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [errors, setErrors] = useState({});
  const [isChanged, setIsChanged] = useState(false);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/ptmas/${ptmaId}`)
      .then(response => response.json())
      .then(data => {
        setLocation({
          full_name: data.full_name,
          code: data.code,
          status: data.status,
          province: data.province,
          indigenous_group: data.indigenous_group,
          full_address: data.full_address,
          agreement_id: data.agreement_id,
          notes: data.notes,
          website_url: data.website_url,
        });
        setInitialLocation({
          full_name: data.full_name,
          code: data.code,
          status: data.status,
          province: data.province,
          indigenous_group: data.indigenous_group,
          full_address: data.full_address,
          agreement_id: data.agreement_id,
          notes: data.notes,
          website_url: data.website_url,
        });
      })
      .catch(error => console.error('Error fetching PTMA:', error));
  }, [ptmaId]);

  const validateInputs = () => {
    const newErrors = {};
    if (!location.full_name) newErrors.full_name = 'Full Name cannot be blank';
    if (!location.code) newErrors.code = 'Code cannot be blank';
    if (!location.status) newErrors.status = 'Status cannot be blank';
    if (!location.province) newErrors.province = 'Province/Territory cannot be blank';
    if (!location.indigenous_group) newErrors.indigenous_group = 'Indigenous Group cannot be blank';
    // Website is optional
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateInputs()) return;
    const updatedPtma = {
      full_name: location.full_name,
      code: location.code,
      status: location.status,
      province: location.province,
      indigenous_group: location.indigenous_group,
      full_address: location.full_address,
      agreement_id: location.agreement_id,
      notes: location.notes,
      website_url: location.website_url,
    };
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/ptmas/${ptmaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(updatedPtma)
    })
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        setFlashMessages([{ content: 'PTMA information saved successfully', type: 'success', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        setIsChanged(false);
      })
      .catch(error => {
        setFlashMessages([{ content: 'Failed to save PTMA information', type: 'error', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error updating PTMA:', error);
      });
  };

  const handleCancel = () => {
    setLocation(initialLocation);
    setIsChanged(false);
    setErrors({});
    setFlashMessages([]);
  };

  const handleChange = (field, value) => {
    setLocation(prev => {
      const updated = { ...prev, [field]: value };
      setIsChanged(JSON.stringify(updated) !== JSON.stringify(initialLocation));
      return updated;
    });
  };

  return (
    <BoardItem
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.'
      }}
      header={
        <Header
          variant="h2"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={handleSave} disabled={!isChanged}>Save</Button>
              <Button variant="link" onClick={handleCancel} disabled={!isChanged}>Cancel</Button>
            </SpaceBetween>
          }
        >
          General Information
        </Header>
      }
      settings={
        <ButtonDropdown
          items={[
            { id: 'preferences', text: 'Preferences' },
            { id: 'remove', text: 'Remove' }
          ]}
          ariaLabel="Board item settings"
          variant="icon"
        />
      }
    >
      <Flashbar items={flashMessages} />
      <Box margin={{ bottom: 's' }} /> {/* Add small space after Flashbar for consistent layout */}
      <Form>
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 3 }, { colspan: 3 }]}> 
          <FormField label="Full Name" errorText={errors.full_name}>
            <Input value={location.full_name || ''} onChange={e => handleChange('full_name', e.detail.value)} />
          </FormField>
          <FormField label="Code" errorText={errors.code}>
            <Input value={location.code || ''} onChange={e => handleChange('code', e.detail.value)} />
          </FormField>
          <FormField label="Status" errorText={errors.status}>
            <Select
              selectedOption={statusOptions.find(option => option.value === location.status) || null}
              onChange={e => handleChange('status', e.detail.selectedOption.value)}
              options={statusOptions}
              placeholder="Select a status"
            />
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}> 
          <FormField label="Agreement ID">
            <Input value={location.agreement_id || ''} onChange={e => handleChange('agreement_id', e.detail.value)} />
          </FormField>
          <FormField label="Province/Territory" errorText={errors.province}>
            <Select
              selectedOption={provinceOptions.find(option => option.value === location.province) || null}
              onChange={e => handleChange('province', e.detail.selectedOption.value)}
              options={provinceOptions}
              placeholder="Select a province or territory"
            />
          </FormField>
          <FormField label="Indigenous Group" errorText={errors.indigenous_group}>
            <Select
              selectedOption={indigenousGroupOptions.find(option => option.value === location.indigenous_group) || null}
              onChange={e => handleChange('indigenous_group', e.detail.selectedOption.value)}
              options={indigenousGroupOptions}
              placeholder="Select an indigenous group"
            />
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Full Address">
            <Input value={location.full_address || ''} onChange={e => handleChange('full_address', e.detail.value)} />
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Website">
            <Input value={location.website_url || ''} onChange={e => handleChange('website_url', e.detail.value)} />
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Notes">
            <Input value={location.notes || ''} onChange={e => handleChange('notes', e.detail.value)} />
          </FormField>
        </Grid>
      </Form>
    </BoardItem>
  );
};

export default GeneralInformation;
