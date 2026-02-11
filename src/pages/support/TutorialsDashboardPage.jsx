import React, { useCallback, useState } from 'react';
import { Alert, Box, Button, Container, Header, Modal, SpaceBetween } from '@cloudscape-design/components';
import { apiFetch } from '../../auth/apiClient';

const TutorialsDashboardPage = () => {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState(null);
  const [lastResetAt, setLastResetAt] = useState(null);

  const resetAllTutorialProgress = useCallback(async () => {
    setConfirmVisible(false);
    setResetting(true);
    setError(null);
    try {
      const resp = await apiFetch('/api/me/tutorial-progress/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(data?.error || `Reset failed: ${resp.status}`);
      }

      // Ask AppContent to reload DB-backed progress and rebuild TutorialsContext.
      window.dispatchEvent(new CustomEvent('tutorials:refresh'));
      setLastResetAt(new Date().toISOString());
    } catch (err) {
      setError(err?.message || 'Failed to reset tutorial progress.');
    } finally {
      setResetting(false);
    }
  }, []);

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h2"
            description="Tutorials auto-prompt the first time you visit a page that supports a tour. Use this page to reset your tutorial progress."
          >
            Tutorials
          </Header>
        }
      >
        <SpaceBetween size="m">
          {error ? <Alert type="error">{error}</Alert> : null}
          {lastResetAt ? (
            <Alert type="success">
              Tutorial progress reset ({new Date(lastResetAt).toLocaleString()}).
            </Alert>
          ) : null}

          <Box variant="p">
            Resetting progress clears your completion and dismissal state so tutorials may prompt again when you revisit supported pages.
          </Box>

          <Button
            variant="primary"
            loading={resetting}
            disabled={resetting}
            onClick={() => setConfirmVisible(true)}
          >
            Reset tutorial progress
          </Button>
        </SpaceBetween>
      </Container>

      <Modal
        visible={confirmVisible}
        onDismiss={() => setConfirmVisible(false)}
        header="Reset tutorial progress"
        closeAriaLabel="Close reset confirmation"
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            <Button onClick={() => setConfirmVisible(false)}>Cancel</Button>
            <Button variant="primary" loading={resetting} disabled={resetting} onClick={resetAllTutorialProgress}>
              Reset
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          <Box variant="p">This will clear your tutorial completion and dismissal state.</Box>
          <Box variant="p">Tutorial prompts may appear again when you revisit supported pages.</Box>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};

export default TutorialsDashboardPage;

