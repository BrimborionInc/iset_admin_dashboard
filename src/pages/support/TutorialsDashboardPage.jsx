import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, Container, Header, Modal, SpaceBetween, StatusIndicator, Table, Toggle } from '@cloudscape-design/components';
import { apiFetch } from '../../auth/apiClient';
import { useAuth } from '../../context/AuthContext.js';
import { useTutorials } from '../../context/TutorialsContext';
import { isTutorialRelevantForRole } from '../../tutorials/tutorialPlatform';

const TutorialsDashboardPage = () => {
  const { role } = useAuth();
  const { tutorials } = useTutorials();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savingByTutorialId, setSavingByTutorialId] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [lastResetAt, setLastResetAt] = useState(null);

  const visibleTutorials = useMemo(() => (
    (tutorials || []).filter(tutorial => isTutorialRelevantForRole(tutorial, role))
  ), [tutorials, role]);

  const tutorialRows = useMemo(
    () => visibleTutorials.map(tutorial => ({
      tutorialId: tutorial?.tutorialId || '',
      title: tutorial?.title || tutorial?.tutorialId || 'Tutorial',
      completed: Boolean(tutorial?.completed),
    })),
    [visibleTutorials]
  );

  const setSaving = useCallback((tutorialId, value) => {
    setSavingByTutorialId(prev => ({ ...(prev || {}), [tutorialId]: Boolean(value) }));
  }, []);

  const updateTutorialCompletion = useCallback(async (tutorialId, markComplete) => {
    const id = typeof tutorialId === 'string' ? tutorialId.trim() : '';
    if (!id) return;
    setError(null);
    setSuccess(null);
    setSaving(id, true);
    try {
      if (markComplete) {
        const resp = await apiFetch('/api/me/tutorial-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tutorialId: id, status: 'completed' }),
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok) {
          throw new Error(data?.error || `Update failed: ${resp.status}`);
        }
      } else {
        const resp = await apiFetch('/api/me/tutorial-progress/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tutorialId: id }),
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok) {
          throw new Error(data?.error || `Reset failed: ${resp.status}`);
        }
      }

      window.dispatchEvent(new CustomEvent('tutorials:refresh'));
      setSuccess(`Updated "${id}" to ${markComplete ? 'complete' : 'incomplete'}.`);
    } catch (err) {
      setError(err?.message || 'Failed to update tutorial status.');
    } finally {
      setSaving(id, false);
    }
  }, [setSaving]);

  const resetAllTutorialProgress = useCallback(async () => {
    setConfirmVisible(false);
    setResetting(true);
    setError(null);
    setSuccess(null);
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
      setSuccess('All tutorial progress has been reset.');
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
            description="Tutorials auto-prompt the first time you visit a page that supports a tour. Use toggles to mark tutorials complete/incomplete."
            actions={
              <Button
                variant="primary"
                loading={resetting}
                disabled={resetting}
                onClick={() => setConfirmVisible(true)}
              >
                Reset all tutorial progress
              </Button>
            }
          >
            Tutorials
          </Header>
        }
      >
        <SpaceBetween size="m">
          {error ? <Alert type="error">{error}</Alert> : null}
          {success ? <Alert type="success">{success}</Alert> : null}
          {lastResetAt ? (
            <Alert type="success">
              Tutorial progress reset ({new Date(lastResetAt).toLocaleString()}).
            </Alert>
          ) : null}

          <Box variant="p">
            Toggle each tutorial to set completion state. Turning a tutorial off marks it incomplete and allows first-run prompts again.
          </Box>

          {tutorialRows.length ? (
            <Table
              trackBy="tutorialId"
              items={tutorialRows}
              variant="embedded"
              columnDefinitions={[
                {
                  id: 'title',
                  header: 'Tutorial',
                  cell: item => item.title,
                },
                {
                  id: 'status',
                  header: 'Status',
                  cell: item => (
                    <StatusIndicator type={item.completed ? 'success' : 'stopped'}>
                      {item.completed ? 'Completed' : 'Incomplete'}
                    </StatusIndicator>
                  ),
                },
                {
                  id: 'complete',
                  header: 'Complete',
                  cell: item => {
                    const saving = Boolean(savingByTutorialId[item.tutorialId]);
                    return (
                      <Toggle
                        checked={item.completed}
                        disabled={saving}
                        onChange={({ detail }) => {
                          updateTutorialCompletion(item.tutorialId, Boolean(detail?.checked));
                        }}
                      >
                        {item.completed ? 'On' : 'Off'}
                      </Toggle>
                    );
                  },
                },
              ]}
            />
          ) : (
            <Alert type="info">No tutorials are available for your role.</Alert>
          )}
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
