import React from 'react';
import { Button } from '@cloudscape-design/components';

const ExperimentPage = ({ currentLanguage }) => {
  return (
    <div style={{ padding: '20px' }}>
      {/* Cloudscape Button (auto-localized if applicable) */}
      <Button variant="primary">Click Me</Button>

      {/* Custom message based on currentLanguage prop */}
      <h2 style={{ marginTop: '20px' }}>
        {currentLanguage === 'fr' ? 'Bienvenue à la page d\'expérimentation!' : 'Welcome to the Experiment Page!'}
      </h2>

      {/* Display current language */}
      <p>Current Language: {currentLanguage}</p>
    </div>
  );
};

export default ExperimentPage;
