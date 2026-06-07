import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, Container, Header, Modal, SpaceBetween, StatusIndicator, Table, Toggle } from '@cloudscape-design/components';
import { apiFetch } from '../../auth/apiClient';
import { useAuth } from '../../context/AuthContext.js';
import { useTutorials } from '../../context/TutorialsContext';
import { isTutorialRelevantForRole } from '../../tutorials/tutorialPlatform';
import {
  TRAINING_SHORTS,
  getTrainingShortEmbedUrl,
  isTrainingShortWatchable,
} from '../../tutorials/trainingShorts';

const compareText = (left, right) => String(left || '').localeCompare(String(right || ''), undefined, { sensitivity: 'base' });

const TutorialsDashboardPage = () => {
  const { role } = useAuth();
  const { tutorials } = useTutorials();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [activeTrainingShort, setActiveTrainingShort] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [savingByTutorialId, setSavingByTutorialId] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [lastResetAt, setLastResetAt] = useState(null);
  const [trainingShortSortingColumnId, setTrainingShortSortingColumnId] = useState('title');
  const [trainingShortSortingDescending, setTrainingShortSortingDescending] = useState(false);

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

  const trainingShortRows = useMemo(
    () => TRAINING_SHORTS.map(short => ({
      ...short,
      watchable: isTrainingShortWatchable(short),
      embedUrl: getTrainingShortEmbedUrl(short),
    })),
    []
  );

  const trainingShortColumnDefinitions = useMemo(() => [
    {
      id: 'title',
      header: 'Short',
      width: 700,
      minWidth: 300,
      sortingComparator: (left, right) => compareText(left.title, right.title),
      cell: item => (
        <SpaceBetween size="xxs">
          <Box variant="strong">{item.title}</Box>
          <Box variant="small" color="text-body-secondary">{item.description}</Box>
        </SpaceBetween>
      ),
    },
    {
      id: 'duration',
      header: 'Length',
      width: 115,
      minWidth: 100,
      sortingComparator: (left, right) => Number(left.durationSeconds || 0) - Number(right.durationSeconds || 0),
      cell: item => <span style={{ whiteSpace: 'nowrap' }}>{item.duration || '-'}</span>,
    },
    {
      id: 'action',
      header: 'Action',
      width: 130,
      minWidth: 120,
      cell: item => (
        <Button
          disabled={!item.watchable}
          onClick={() => setActiveTrainingShort(item)}
        >
          Watch
        </Button>
      ),
    },
  ], []);

  const trainingShortSortingColumn = useMemo(
    () => trainingShortColumnDefinitions.find(column => column.id === trainingShortSortingColumnId) || trainingShortColumnDefinitions[0],
    [trainingShortColumnDefinitions, trainingShortSortingColumnId]
  );

  const sortedTrainingShortRows = useMemo(() => {
    const comparator = trainingShortSortingColumn?.sortingComparator;
    if (typeof comparator !== 'function') return trainingShortRows;
    const sorted = [...trainingShortRows].sort(comparator);
    return trainingShortSortingDescending ? sorted.reverse() : sorted;
  }, [trainingShortRows, trainingShortSortingColumn, trainingShortSortingDescending]);

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
            description="Short PATH training videos."
          >
            Training shorts
          </Header>
        }
      >
        <Table
          trackBy="id"
          items={sortedTrainingShortRows}
          variant="embedded"
          wrapLines
          resizableColumns
          sortingColumn={trainingShortSortingColumn}
          sortingDescending={trainingShortSortingDescending}
          onSortingChange={({ detail }) => {
            setTrainingShortSortingColumnId(detail?.sortingColumn?.id || 'title');
            setTrainingShortSortingDescending(Boolean(detail?.isDescending));
          }}
          empty={<Box padding="m">No training shorts are configured yet.</Box>}
          columnDefinitions={trainingShortColumnDefinitions}
        />
      </Container>

      <Container
        header={
          <Header
            variant="h2"
            description="In-app walkthroughs for supported PATH pages."
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
            Guided tours
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
            Toggle each guided tour to set completion state. Turning a tour off marks it incomplete and allows first-run prompts again, which can be useful for onboarding or refresher training.
          </Box>

          {tutorialRows.length ? (
            <Table
              trackBy="tutorialId"
              items={tutorialRows}
              variant="embedded"
              columnDefinitions={[
                {
                  id: 'title',
                  header: 'Guided tour',
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
            <Alert type="info">No guided tours are available for your role.</Alert>
          )}
        </SpaceBetween>
      </Container>

      <Modal
        visible={Boolean(activeTrainingShort)}
        onDismiss={() => setActiveTrainingShort(null)}
        header={activeTrainingShort?.title || 'Training short'}
        size="large"
        closeAriaLabel="Close training short"
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            {activeTrainingShort?.shareUrl ? (
              <Button
                iconName="external"
                onClick={() => window.open(activeTrainingShort.shareUrl, '_blank', 'noopener,noreferrer')}
              >
                Open in Synthesia
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => setActiveTrainingShort(null)}>Close</Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          {activeTrainingShort?.description ? (
            <Box variant="p">{activeTrainingShort.description}</Box>
          ) : null}
          {activeTrainingShort?.embedUrl ? (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden' }}>
              <iframe
                src={activeTrainingShort.embedUrl}
                title={`Synthesia video player - ${activeTrainingShort.title}`}
                allow="encrypted-media; fullscreen"
                allowFullScreen
                loading="lazy"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  border: 0,
                  padding: 0,
                  margin: 0,
                  overflow: 'hidden',
                }}
              />
            </div>
          ) : (
            <Alert type="info">
              This short is not published yet.
            </Alert>
          )}
        </SpaceBetween>
      </Modal>

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
          <Box variant="p">Tutorial prompts may appear again when you revisit supported pages, which is useful if you want staff to re-run the PATH walkthroughs from the beginning.</Box>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};

export default TutorialsDashboardPage;
