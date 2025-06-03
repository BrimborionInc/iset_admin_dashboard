import React from 'react';
import Alert from '@cloudscape-design/components/alert';
import TutorialPanel from '@cloudscape-design/components/tutorial-panel';
import Button from '@cloudscape-design/components/button';

const tutorialSteps = [
  {
    title: 'Services Offered Tutorial',
    content: (
      <div>
        <p>This tutorial will guide you through managing the services provided at a specific location.</p>
        <ol>
          <li>Select the services offered at this location from the predefined list using the multiselect dropdown.</li>
          <li>After selecting the services, click the "Save" button to update the services offered at the location.</li>
          <li>If you want to discard the changes, click the "Cancel" button to revert to the initial state.</li>
        </ol>
      </div>
    ),
  },
];

const ServicesOfferedHelp = () => (
  <div>
    <p>The Services Offered widget allows you to manage the services provided at a specific location. You can:</p>
    <ul>
      <li>Select services from a predefined list</li>
      <li>Add or remove services as needed</li>
      <li>Save changes to update the services offered at the location</li>
    </ul>
    <p>Use this widget to ensure that the services provided at each location are accurately reflected and up-to-date.</p>
    <Alert header="Dev notes">
      Still needs to integrate with the slot search query used in the public portal. Currently all VACs appear in all slot searches, not just the ones offering the service.
    </Alert>
    <TutorialPanel
      title="Services Offered Tutorial"
      description="Learn how to manage the services provided at a specific location."
      tutorials={tutorialSteps}
      learnMoreButton={<Button>Start Tutorial</Button>}
      i18nStrings={{
        tutorialListTitle: 'Tutorials',
        tutorialListDescription: 'Follow these steps to learn how to manage services.',
        learnMoreButtonText: 'Learn more',
        startTutorialButtonText: 'Start tutorial',
        completionScreenTitle: 'Tutorial completed',
        completionScreenDescription: 'You have successfully completed the tutorial.',
        feedbackLinkText: 'Provide feedback',
        dismissButtonText: 'Dismiss',
      }}
    />
  </div>
);

ServicesOfferedHelp.aiContext = "This section allows configuration of services offered at specific locations, synced with the applicant slot search system.";
export default ServicesOfferedHelp;
