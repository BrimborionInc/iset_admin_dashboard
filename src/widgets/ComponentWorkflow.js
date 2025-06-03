import React, { useState, useEffect } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Table, Header, Button, Box, SpaceBetween, ButtonDropdown, Flashbar, Grid, Wizard } from '@cloudscape-design/components';
import BookAppointmentQ1 from '../previews/bookAppointmentQ1'; // Import BookAppointmentQ1
import BookAppointmentQ2 from '../previews/bookAppointmentQ2'; // Import BookAppointmentQ2
import BookAppointmentQ3 from '../previews/bookAppointmentQ3'; // Import BookAppointmentQ3
import BookAppointmentQ4 from '../previews/bookAppointmentQ4'; // Import BookAppointmentQ4
import BookAppointmentQ5 from '../previews/bookAppointmentQ5'; // Import BookAppointmentQ5
import BookAppointmentQ6 from '../previews/bookAppointmentQ6'; // Import BookAppointmentQ6
import BookAppointmentQ7 from '../previews/bookAppointmentQ7'; // Import BookAppointmentQ7
import BookAppointmentQ8 from '../previews/bookAppointmentQ8'; // Import BookAppointmentQ8
import styles from '../css/ComponentWorkflow.module.css'; // Import CSS module

const ComponentWorkflow = ({ serviceModuleId }) => {
  const [components, setComponents] = useState([]);
  const [availableComponents, setAvailableComponents] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [isChanged, setIsChanged] = useState(false);
  const [initialComponents, setInitialComponents] = useState([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);  // Always starts at 0


  useEffect(() => {
    fetchComponents();
    fetchAvailableComponents();
  }, [serviceModuleId]);

  const fetchComponents = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/service-modules/${serviceModuleId}/components`);
      const data = await response.json();
      setComponents(data.sort((a, b) => a.step_number - b.step_number));
      setInitialComponents(data.sort((a, b) => a.step_number - b.step_number));
    } catch (error) {
      console.error('Error fetching components:', error);
    }
  };

  const fetchAvailableComponents = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/components`);
      const data = await response.json();
      setAvailableComponents(data);
    } catch (error) {
      console.error('Error fetching available components:', error);
    }
  };

  const handleAddComponent = (componentId) => {
    const componentToAdd = availableComponents.find(component => component.id === componentId);
    
    if (componentToAdd) {
      setComponents(prevComponents => {
        let insertIndex = prevComponents.length;

        const newComponent = { ...componentToAdd, step_number: insertIndex + 1 };

        const updatedComponents = [
          ...prevComponents.slice(0, insertIndex),
          newComponent,
          ...prevComponents.slice(insertIndex)
        ];

        const finalComponents = updatedComponents.map((component, index) => ({
          ...component,
          step_number: index + 1
        }));

        return finalComponents;
      });

      setIsChanged(true);
    }
  };

  const handleDeleteComponent = (id) => {
    setComponents(components.filter(component => component.id !== id));
    setIsChanged(true);
  };

  const handleMoveUp = (index) => {
    if (index <= 1) return;
    const newComponents = [...components];
    const targetIndex = index - 1;

    [newComponents[targetIndex], newComponents[index]] = [newComponents[index], newComponents[targetIndex]];
    setComponents(newComponents);
    setIsChanged(true);

      // Log the current active step
  console.log('Current activeStepIndex:', activeStepIndex);

  // If the current step is the one being moved, update the wizard step
  setActiveStepIndex(prevIndex => (prevIndex === index ? index - 1 : prevIndex));
  };

  const handleMoveDown = (index) => {
    if (index >= components.length - 2) return;
    const newComponents = [...components];
    const targetIndex = index + 1;

    [newComponents[targetIndex], newComponents[index]] = [newComponents[index], newComponents[targetIndex]];
    setComponents(newComponents);
    setIsChanged(true);
  };

  const handleSave = () => {
    setFlashMessages([{ type: 'success', content: 'Components saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
    setIsChanged(false);
  };

  const handleCancel = () => {
    setComponents(initialComponents);
    setIsChanged(false);
  };

  const getAvailableComponents = () => {
    return availableComponents.filter(component => !components.some(c => c.id === component.id));
  };

  const availableComponentsToAdd = getAvailableComponents();

  const wizardSteps = components.map((component, index) => ({
    title: component.name,
    content: (() => {
      switch (component.name) {
        case 'Service Type':
          return <BookAppointmentQ1 />;
        case 'Location':
          return <BookAppointmentQ2 />;
        case 'Group Booking':
          return <BookAppointmentQ3 />;
        case 'Extra Time':
          return <BookAppointmentQ4 />;
        case 'Language':
          return <BookAppointmentQ5 />;
        case 'AVS':
          return <BookAppointmentQ6 />;
        case 'Additional Notes':
          return <BookAppointmentQ7 />;
        case 'Appointment Summary':
          return <BookAppointmentQ8 />;
        default:
          return (
            <Box>
              <p>{component.description}</p>
            </Box>
          );
      }
    })(),
    isOptional: true, // Make all steps optional
  }));

  return (
    <div className={styles['component-workflow-container']}>
      <BoardItem
        i18nStrings={{
          dragHandleAriaLabel: "Drag handle",
          dragHandleAriaDescription: "Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.",
          resizeHandleAriaLabel: "Resize handle",
          resizeHandleAriaDescription: "Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard."
        }}
        header={
          <Header
            description="Select and change the order of questions in the workflow using components in the library.  Preview is shown on the right."
            actions={
              <SpaceBetween direction="horizontal" size="s">
                <ButtonDropdown
                  items={availableComponentsToAdd.map(component => ({
                    id: component.id,
                    text: component.name
                  }))}
                  onItemClick={({ detail }) => handleAddComponent(detail.id)}
                  disabled={availableComponentsToAdd.length === 0} // Disable if no components to add
                >
                  Add Component
                </ButtonDropdown>
                <Button variant="primary" onClick={handleSave} disabled={!isChanged}>Save</Button>
                <Button variant="link" onClick={handleCancel}>Cancel</Button>
              </SpaceBetween>
            }
          >
            Component Workflow
          </Header>
        }
        settings={
          <ButtonDropdown
            items={[{
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
        <Grid gridDefinition={[{ colspan: 1 }, { colspan: 11}]} disableGutters>
          <Table
            variant="embedded"
            renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
              `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
            }
            columnDefinitions={[
              {
                id: "actions",
                header: "Actions",
                width: "100%", // Adjust width to take full space
                cell: (item) => {
                  const rowIndex = components.findIndex(component => component.id === item.id);
                  return item.is_editable ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <span className={styles['custom-button']} onClick={() => handleMoveUp(rowIndex)} disabled={rowIndex <= 1}>↑</span>
                      <span className={styles['custom-button']} onClick={() => handleMoveDown(rowIndex)} disabled={rowIndex >= components.length - 2}>↓</span>
                      <span className={styles['custom-button']} onClick={() => handleDeleteComponent(item.id)}>✖</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      Locked
                    </div>
                  );
                }
              }
            ]}
            items={components.map((component, index) => ({ ...component, index }))
            }
          />
          <Box>
            <Wizard
              hideHeader
              steps={wizardSteps}
              allowSkipTo={true}
              i18nStrings={{
                stepNumberLabel: stepNumber => `Step ${stepNumber}`,
                collapsedStepsLabel: (stepNumber, stepsCount) => `Step ${stepNumber} of ${stepsCount}`,
                skipToButtonLabel: stepNumber => `Skip to Step ${stepNumber}`,
                navigationAriaLabel: 'Steps',
                optional: 'optional',
              }}
            />
          </Box>
        </Grid>
      </BoardItem>
    </div>
  );
};

export default ComponentWorkflow;
