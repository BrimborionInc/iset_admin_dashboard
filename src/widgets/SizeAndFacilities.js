import React, { useState, useEffect } from 'react';
import { 
    Form, 
    FormField, 
    Input, 
    Grid, 
    Box, 
    Multiselect, 
    SpaceBetween,
    Header,
    Button,
    Flashbar
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useParams } from 'react-router-dom';

const SizeAndFacilities = () => {
  const { id: locationId } = useParams();
  const facilityOptions = [
    { label: 'Private Room', value: 'private-room' },
    { label: 'Accessible Parking', value: 'accessible-parking' },
    { label: 'Step-free Access', value: 'step-free-access' },
  ];

  const [location, setLocation] = useState({});
  const [initialLocation, setInitialLocation] = useState({});
  const [selectedFacilities, setSelectedFacilities] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [isChanged, setIsChanged] = useState(false);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations/${locationId}`)
      .then(response => response.json())
      .then(data => {
        setLocation(data);
        setInitialLocation(data);
        setSelectedFacilities(data.facilities ? data.facilities.split(',').map(facility => facilityOptions.find(option => option.value === facility)) : []);
        console.log('Fetched location data:', data); // Add logging
      })
      .catch(error => console.error('Error fetching location data:', error));
  }, [locationId]);

  const handleSave = () => {
    const updatedLocation = {
      ...location,
      facilities: selectedFacilities.map(facility => facility.value).join(',')
    };

    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations/${locationId}/size-and-facilities`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedLocation),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setLocation(data);
        setInitialLocation(data);
        setIsChanged(false);
        setFlashMessages([{ type: 'success', content: 'Size and facilities saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.log('Location saved successfully:', data);
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error saving size and facilities', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error saving location:', error);
      });
  };

  const handleCancel = () => {
    setLocation(initialLocation);
    setSelectedFacilities(initialLocation.facilities ? initialLocation.facilities.split(',').map(facility => facilityOptions.find(option => option.value === facility)) : []);
    setIsChanged(false);
  };

  const handleChange = (field, value) => {
    setLocation(prevLocation => {
      const updatedLocation = { ...prevLocation, [field]: value };
      setIsChanged(JSON.stringify(updatedLocation) !== JSON.stringify(initialLocation));
      return updatedLocation;
    });
  };

  const handleFacilitiesChange = (selectedOptions) => {
    setSelectedFacilities(selectedOptions);
    const updatedLocation = {
      ...location,
      facilities: selectedOptions.map(facility => facility.value).join(',')
    };
    setIsChanged(JSON.stringify(updatedLocation) !== JSON.stringify(initialLocation));
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
          description="Size and facilities of the location"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={handleSave} disabled={!isChanged}>Save</Button>
              <Button variant="link" onClick={handleCancel}>Cancel</Button>
            </SpaceBetween>
          }
        >
          Size and Facilities
        </Header>
      }
    >
      <Flashbar items={flashMessages} />
      <Box margin={{ bottom: 's' }} /> {/* Add small space after Flashbar */}
      <Form>
        <Grid
          gridDefinition={[
            { colspan: 4 },
            { colspan: 4 },
            { colspan: 4 },
            { colspan: 4 },
            { colspan: 4 },
            { colspan: 4 },
            { colspan: 12 },
          ]}
        >
          <FormField label="Biometric Counters">
            <Input
              value={location.biometric_counters ?? '0'}
              onChange={e => handleChange('biometric_counters', e.detail.value)}
            />
          </FormField>
          <FormField label="Service Counters">
            <Input
              value={location.service_counters ?? '0'}
              onChange={e => handleChange('service_counters', e.detail.value)}
            />
          </FormField>
          <FormField label="Combi Counters">
            <Input
              value={location.combi_counters ?? '0'}
              onChange={e => handleChange('combi_counters', e.detail.value)}
            />
          </FormField>
          <FormField label="Waiting Room Capacity">
            <Input
              value={location.waiting_room_capacity ?? '0'}
              onChange={e => handleChange('waiting_room_capacity', e.detail.value)}
            />
          </FormField>

          <FormField label="BCS Spareholding">
            <Input
              value={location.bcs_spareholding ?? '0'}
              onChange={e => handleChange('bcs_spareholding', e.detail.value)}
            />
          </FormField>
          <FormField label="Service Staff">
            <Input
              value={location.staff_capacity ?? '0'}
              onChange={e => handleChange('staff_capacity', e.detail.value)}
            />
          </FormField>
          <FormField label="Additional Facilities">
            <Multiselect
              selectedOptions={selectedFacilities}
              onChange={({ detail }) => handleFacilitiesChange(detail.selectedOptions)}
              options={facilityOptions}
              placeholder="Select facilities"
              inlineTokens
            />
          </FormField>
        </Grid>
      </Form>
    </BoardItem>
  );
};

export default SizeAndFacilities;
