import React, { useState, useEffect } from 'react';
import { apiFetch } from '../auth/apiClient';
import { Form, FormField, Input, Select, Grid, SpaceBetween, Header, Button, Flashbar, Box, ButtonDropdown } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useParams } from 'react-router-dom';

const GeneralInformation = () => {
  const { id: locationId } = useParams();
  const [location, setLocation] = useState({});
  const [initialLocation, setInitialLocation] = useState({});
  const [countries, setCountries] = useState([]);
  const [locationTypes, setLocationTypes] = useState([]);
  const [hubAndSpokeOptions] = useState([
    { label: 'Hub', value: 1 },
    { label: 'Spoke', value: 2 },
    { label: 'Standalone', value: 3 }
  ]);
  const [hubVacOptions, setHubVacOptions] = useState([]);
  const [statusOptions] = useState([
    { label: 'Active', value: 'Active' },
    { label: 'Suspended', value: 'Suspended' },
    { label: 'Inactive', value: 'Inactive' },
    { label: 'Planned', value: 'Planned' }
  ]);
  const [irccOfficeOptions, setIrccOfficeOptions] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [errors, setErrors] = useState({});
  const [isChanged, setIsChanged] = useState(false);

  useEffect(() => {
  apiFetch(`/api/locations/${locationId}`)
      .then(response => response.json())
      .then(data => {
        setLocation(data);
        setInitialLocation(data);
        console.log('Fetched location data:', data); // Add logging
      })
      .catch(error => console.error('Error fetching location:', error));

  apiFetch(`/api/countries`)
      .then(response => response.json())
      .then(data => setCountries(data.map(country => ({ label: country.name, value: country.id }))))
      .catch(error => console.error('Error fetching countries:', error));

  apiFetch(`/api/location-types`)
      .then(response => response.json())
      .then(data => setLocationTypes(data.map(type => ({ label: type.type_name, value: type.id }))))
      .catch(error => console.error('Error fetching location types:', error));

  apiFetch(`/api/locations`)
      .then(response => response.json())
      .then(data => setHubVacOptions(data.map(location => ({ label: location.location, value: location.id }))))
      .catch(error => console.error('Error fetching hub VACs:', error));

  apiFetch(`/api/ircc-offices`)
      .then(response => response.json())
      .then(data => setIrccOfficeOptions(data.map(office => ({ label: office.name, value: office.id })))) // Fetch IRCC offices
      .catch(error => console.error('Error fetching IRCC offices:', error));
  }, [locationId]);

  const validateInputs = () => {
    const newErrors = {};
    if (!location.location) newErrors.location = 'Location Name cannot be blank';
    if (!location.country_id) newErrors.country_id = 'A country must be assigned';
    if (!location.location_type_id) newErrors.location_type_id = 'A location type must be selected';
    if (!location.hub_and_spoke) newErrors.hub_and_spoke = 'Hub and Spoke must have a selected option';
    if (location.hub_and_spoke === 2 && !location.hub_vac_id) newErrors.hub_vac_id = 'Hub Vac cannot be blank if "spoke" is selected in Hub and Spoke';
    if (!location.status) newErrors.status = 'Status cannot be blank';
    if (!location.ircc_office_id) newErrors.ircc_office_id = 'Responsible IRCC Office cannot be blank'; // Update validation
    setErrors(newErrors);
    console.log('Validation errors:', newErrors); // Add logging
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    console.log('handleSave called'); // Add logging
    if (!validateInputs()) return;

    const updatedLocation = {
      ...location,
      country_id: location.country_id || countries.find(country => country.label === location.country)?.value,
      location_type_id: location.location_type_id || locationTypes.find(type => type.label === location.type)?.value
    };

    console.log('Saving general information:', updatedLocation); // Add logging
    console.log('Country:', updatedLocation.country_id, 'Location Type:', updatedLocation.location_type_id); // Add logging

  apiFetch(`/api/locations/${locationId}/general-information`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedLocation),
    })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => { throw new Error(text) }); // Add error handling
        }
        return response.json();
      })
      .then(data => {
        setLocation(data);
        setInitialLocation(data);
        setIsChanged(false);
        setFlashMessages([{ type: 'success', content: 'General information saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.log('General information saved successfully:', data);
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error saving general information', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error saving general information:', error);
      });
  };

  const handleCancel = () => {
    setLocation(initialLocation);
    setIsChanged(false);
  };

  const handleChange = (field, value) => {
    setLocation(prevLocation => {
      const updatedLocation = { ...prevLocation, [field]: value };
      setIsChanged(JSON.stringify(updatedLocation) !== JSON.stringify(initialLocation));
      return updatedLocation;
    });
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
          description="General information about the location"
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
            { colspan: 3 },
            { colspan: 3 },
            { colspan: 3 },
            { colspan: 3 },
            { colspan: 3 },
            { colspan: 3 },
            { colspan: 3 },
            { colspan: 3 },
            { colspan: 12 },
            { colspan: 12 },
          ]}
        >
          <FormField label="Location Name" errorText={errors.location}>
            <Input
              value={location.location || ''}
              onChange={e => handleChange('location', e.detail.value)}
            />
          </FormField>
          <FormField label="Country" errorText={errors.country_id}>
            <Select
              selectedOption={countries.find(country => country.value === location.country_id) || { label: location.country, value: location.country_id }}
              onChange={e => handleChange('country_id', e.detail.selectedOption.value)}
              options={countries}
              placeholder="Select a country"
            />
          </FormField>
          <FormField label="Type" errorText={errors.location_type_id}>
            <Select
              selectedOption={locationTypes.find(type => type.value === location.location_type_id) || { label: location.type, value: location.location_type_id }}
              onChange={e => handleChange('location_type_id', e.detail.selectedOption.value)}
              options={locationTypes}
              placeholder="Select a location type"
            />
          </FormField>
          <FormField label="IRCC Office" errorText={errors.ircc_office_id}>
            <Select
              selectedOption={irccOfficeOptions.find(option => option.value === location.ircc_office_id) || { label: location.ircc_office_name, value: location.ircc_office_id }}
              onChange={e => handleChange('ircc_office_id', e.detail.selectedOption.value)}
              options={irccOfficeOptions}
              placeholder="Select an IRCC office"
            />
          </FormField>
          <FormField label="Hub and Spoke" errorText={errors.hub_and_spoke}>
            <Select
              selectedOption={hubAndSpokeOptions.find(option => option.value === location.hub_and_spoke) || null}
              onChange={e => handleChange('hub_and_spoke', e.detail.selectedOption.value)}
              options={hubAndSpokeOptions}
              placeholder="Select an option"
            />
          </FormField>
          <FormField label="Hub VAC" errorText={errors.hub_vac_id}>
            <Select
              selectedOption={hubVacOptions.find(option => option.value === location.hub_vac_id) || null}
              onChange={e => handleChange('hub_vac_id', e.detail.selectedOption.value)}
              options={hubVacOptions}
              placeholder="Select a hub VAC"
              disabled={location.hub_and_spoke !== 2} // Disable if Hub and Spoke is not Spoke
            />
          </FormField>
          <FormField label="Status" errorText={errors.status}>
            <Select
              selectedOption={statusOptions.find(option => option.value === location.status) || null}
              onChange={e => handleChange('status', e.detail.selectedOption.value)}
              options={statusOptions}
              placeholder="Select a status"
            />
          </FormField>
          <FormField label="Walk-in Holdback">
            <Input
              type="number"
              value={location.walkin_holdback || ''}
              onChange={e => handleChange('walkin_holdback', e.detail.value)}
              placeholder="Enter percentage"
              step="0.01"
            />
          </FormField>
          <FormField label="Address">
            <Input
              value={location.address || ''}
              onChange={e => handleChange('address', e.detail.value)}
            />
          </FormField>
          <FormField label="Additional Notes">
            <Input
              value={location.additional_notes || ''}
              onChange={e => handleChange('additional_notes', e.detail.value)}
            />
          </FormField>
        </Grid>
      </Form>
    </BoardItem>
  );
};

export default GeneralInformation;
