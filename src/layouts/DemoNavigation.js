import React, { useState } from 'react';
import Button from "@cloudscape-design/components/button";
import Flashbar from "@cloudscape-design/components/flashbar";
import styles from './DemoNavigation.module.css'; // Import the CSS module

const TopHeader = ({ currentLanguage = 'en', onLanguageChange }) => {
  const [purgeCasesResult, setPurgeCasesResult] = useState(null);

  const handleClearCases = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/purge-cases`, { method: 'POST' });
      const result = await response.json();
      if (response.ok) {
        setPurgeCasesResult({ type: 'success', content: result.message });
      } else {
        setPurgeCasesResult({ type: 'error', content: result.error || 'Failed to purge cases' });
      }
    } catch (error) {
      setPurgeCasesResult({ type: 'error', content: 'Failed to purge cases' });
    }
  };

  const handleDismissPurgeCasesResult = () => {
    setPurgeCasesResult(null);
  };

  return (
    <div className={styles.demoNavigation}>
      <span>Demo Controls</span>
      <div className={styles.buttonGroup}>
        <Button variant="primary" onClick={handleClearCases}>Clear Cases</Button>
        <Button variant="primary" disabled>Clear Applications</Button> {/* Placeholder */}
      </div>
      {purgeCasesResult && (
        <Flashbar
          items={[{
            type: purgeCasesResult.type,
            header: purgeCasesResult.type === 'success' ? 'Success' : 'Error',
            content: purgeCasesResult.content,
            dismissible: true,
            onDismiss: handleDismissPurgeCasesResult,
          }]}
        />
      )}
    </div>
  );
};

export default TopHeader;
