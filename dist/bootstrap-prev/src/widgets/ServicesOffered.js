import React, { useState, useEffect } from 'react';
import { AnnotationContext, Hotspot, Multiselect, Button, ButtonDropdown, SpaceBetween, Header, Flashbar, Box, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useParams } from 'react-router-dom';
import ServicesOfferedHelp from '../helpPanelContents/servicesOfferedHelp'; // Import the help panel content

const ServicesOffered = ({ toggleHelpPanel }) => {
  const { id: locationId } = useParams();
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [initialServicesState, setInitialServicesState] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [isChanged, setIsChanged] = useState(false);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/services`)
      .then(response => response.json())
      .then(data => setServices(data.map(service => ({ label: service.name, value: service.id }))))
      .catch(error => console.error('Error fetching services:', error));

    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/location-services/${locationId}`)
      .then(response => response.json())
      .then(data => {
        const serviceOptions = data.map(service => ({ label: service.name, value: service.id }));
        setSelectedServices(serviceOptions);
        setInitialServicesState(serviceOptions);
      })
      .catch(error => console.error('Error fetching location services:', error));
  }, [locationId]);

  const handleSave = () => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/location-services/${locationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(selectedServices.map(service => service.value)),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setInitialServicesState(selectedServices);
        setIsChanged(false);
        setFlashMessages([{ type: 'success', content: 'Services saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.log('Services saved successfully:', data);
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error saving services', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error saving services:', error);
      });
  };

  const handleCancel = () => {
    setSelectedServices(initialServicesState);
    setIsChanged(false);
  };

  const handleChange = (selectedOptions) => {
    setSelectedServices(selectedOptions);
    setIsChanged(JSON.stringify(selectedOptions) !== JSON.stringify(initialServicesState));
  };

  return (
    <AnnotationContext
      onStepChange={({ detail }) => console.log('Step changed:', detail.stepId)}
      i18nStrings={{
        nextButtonText: 'Next',
        previousButtonText: 'Previous',
        finishButtonText: 'Finish',
        labelDismissAnnotation: 'Dismiss annotation',
        labelHotspot: 'Hotspot',
      }}
    >
      <BoardItem
        i18nStrings={{
          dragHandleAriaLabel: "Drag handle",
          dragHandleAriaDescription: "Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.",
          resizeHandleAriaLabel: "Resize handle",
          resizeHandleAriaDescription: "Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard."
        }}
        header={
          <Header
            description="Select the services offered at this location"
            actions={
              <SpaceBetween direction="horizontal" size="s">
                <Hotspot hotspotId="save-button-hotspot" direction="top">
                  <Button variant="primary" onClick={handleSave} disabled={!isChanged}>Save</Button>
                </Hotspot>
                <Hotspot hotspotId="cancel-button-hotspot" direction="top">
                  <Button variant="link" onClick={handleCancel}>Cancel</Button>
                </Hotspot>
              </SpaceBetween>
            }
            info={
              <Link
                variant="info"
                onFollow={() => toggleHelpPanel(
                  <ServicesOfferedHelp />,
                  "Services Offered Help",
                  ServicesOfferedHelp.aiContext // Use the static aiContext property
                )}
              >
                Info
              </Link>
            }
          >
            Services Offered
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
        <Hotspot hotspotId="multiselect-hotspot" direction="right">
          <Multiselect
            selectedOptions={selectedServices}
            onChange={({ detail }) => handleChange(detail.selectedOptions)}
            options={services}
            placeholder="Choose services"
          />
        </Hotspot>
      </BoardItem>
    </AnnotationContext>
  );
};

export default ServicesOffered;
