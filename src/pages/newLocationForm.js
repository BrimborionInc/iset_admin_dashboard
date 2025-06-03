import React, { useState, useEffect } from 'react';
import { Form, FormField, Input, Select, Grid, SpaceBetween, Header, Button, Flashbar, Box } from '@cloudscape-design/components';
import { useHistory } from 'react-router-dom';

const NewLocationForm = () => {
  const history = useHistory();
  const [location, setLocation] = useState({});
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

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/countries`)
      .then(response => response.json())
      .then(data => setCountries(data.map(country => ({ label: country.name, value: country.id }))))
      .catch(error => console.error('Error fetching countries:', error));

    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/location-types`)
      .then(response => response.json())
      .then(data => setLocationTypes(data.map(type => ({ label: type.type_name, value: type.id }))))
      .catch(error => console.error('Error fetching location types:', error));

    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations`)
      .then(response => response.json())
      .then(data => setHubVacOptions(data.map(location => ({ label: location.location, value: location.id }))))
      .catch(error => console.error('Error fetching hub VACs:', error));

    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/ircc-offices`)
      .then(response => response.json())
      .then(data => setIrccOfficeOptions(data.map(office => ({ label: office.name, value: office.id }))))
      .catch(error => console.error('Error fetching IRCC offices:', error));
  }, []);

  const validateInputs = () => {
    const newErrors = {};
    if (!location.location) newErrors.location = 'Location Name cannot be blank';
    if (!location.country_id) newErrors.country_id = 'A country must be assigned';
    if (!location.location_type_id) newErrors.location_type_id = 'A location type must be selected';
    if (!location.hub_and_spoke) newErrors.hub_and_spoke = 'Hub and Spoke must have a selected option';
    if (location.hub_and_spoke === 2 && !location.hub_vac_id) newErrors.hub_vac_id = 'Hub Vac cannot be blank if "spoke" is selected in Hub and Spoke';
    if (!location.status) newErrors.status = 'Status cannot be blank';
    if (!location.ircc_office_id) newErrors.ircc_office_id = 'Responsible IRCC Office cannot be blank';
    if (!location.address) newErrors.address = 'Address cannot be blank'; // Add validation for address
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateInputs()) {
      setFlashMessages([{ type: 'error', content: 'Please correct the errors in the form.', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
      return;
    }

    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(location),
    })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => { throw new Error(text) });
        }
        return response.json();
      })
      .then(data => {
        setFlashMessages([{ type: 'success', content: 'Location created successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        history.push('/ptma-management');
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error creating location', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error creating location:', error);
      });
  };

  const handleCancel = () => {
    history.push('/ptma-management');
  };

  const handleChange = (field, value) => {
    setLocation(prevLocation => ({ ...prevLocation, [field]: value }));
  };

  return (
    <Box padding="l">
      <Header
        variant="h1"
        description="Fill out the form below to create a new location"
        actions={
          <SpaceBetween direction="horizontal" size="s">
            <Button variant="primary" onClick={handleSave}>Save</Button>
            <Button variant="link" onClick={handleCancel}>Cancel</Button>
          </SpaceBetween>
        }
      >
        New Location
      </Header>
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
              selectedOption={countries.find(country => country.value === location.country_id) || null}
              onChange={e => handleChange('country_id', e.detail.selectedOption.value)}
              options={countries}
              placeholder="Select a country"
            />
          </FormField>
          <FormField label="Type" errorText={errors.location_type_id}>
            <Select
              selectedOption={locationTypes.find(type => type.value === location.location_type_id) || null}
              onChange={e => handleChange('location_type_id', e.detail.selectedOption.value)}
              options={locationTypes}
              placeholder="Select a location type"
            />
          </FormField>
          <FormField label="IRCC Office" errorText={errors.ircc_office_id}>
            <Select
              selectedOption={irccOfficeOptions.find(option => option.value === location.ircc_office_id) || null}
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
          <FormField label="Address" errorText={errors.address}> {/* Add errorText for address */}
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
    </Box>
  );
};

export default NewLocationForm;
