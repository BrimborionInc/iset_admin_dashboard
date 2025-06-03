import React, { useState, useEffect } from 'react';
import { AnnotationContext, Hotspot, Multiselect, Button, ButtonDropdown, SpaceBetween, Header, Flashbar, Box, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useParams } from 'react-router-dom';
import aaaWidgetTemplateHelp from '../helpPanelContents/aaaWidgetTemplateHelp'; // Import the help panel content

const ServicesOffered = ({ toggleHelpPanel }) => {
  const [flashMessages, setFlashMessages] = useState([]);
  const [isChanged, setIsChanged] = useState(false);

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
            description="This is the help text for a blank template"
            actions={
              <SpaceBetween direction="horizontal" size="s">
                <Hotspot hotspotId="save-button-hotspot" direction="top">
                  <Button variant="primary" disabled={!isChanged}>Save</Button>
                </Hotspot>
                <Hotspot hotspotId="cancel-button-hotspot" direction="top">
                  <Button variant="normal">Cancel</Button>
                </Hotspot>
              </SpaceBetween>
            }
            info={<Link variant="info" onFollow={() => toggleHelpPanel(<aaaWidgetTemplateHelp />, "Blank Widget Help")}>Info</Link>}
          >
            Blank Widget
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
          {/* Content Goes Here */}
        </Hotspot>
      </BoardItem>
    </AnnotationContext>
  );
};

export default ServicesOffered;
