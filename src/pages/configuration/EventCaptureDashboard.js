import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Toggle from '@cloudscape-design/components/toggle';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Flashbar from '@cloudscape-design/components/flashbar';
import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import Container from '@cloudscape-design/components/container';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { apiFetch } from '../../auth/apiClient';

const severityToColor = (severity) => {
  switch (severity) {
    case 'success':
      return 'green';
    case 'warning':
      return 'yellow';
    case 'error':
      return 'red';
    default:
      return 'blue';
  }
};

const buildSourceBadgeList = (types = []) => {
  const sources = Array.from(new Set(types.map(type => type.source || 'admin')));
  return sources.join(', ');
};

const buildTypeItems = (category) => {
  return (category?.types || []).map(type => ({
    ...type,
    enabled: type.enabled !== false,
    locked: Boolean(type.locked),
    draft: Boolean(type.draft),
  }));
};

const buildCategoryItems = (categories = []) => {
  return categories.map(category => ({
    ...category,
    enabled: category.enabled !== false,
    locked: Boolean(category.locked),
    draft: Boolean(category.draft),
    types: buildTypeItems(category),
  }));
};

const EventCaptureDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState({ categories: [], updatedAt: null });
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [flashMessages, setFlashMessages] = useState([]);
  // TODO: add search/filter and pagination once the catalogue grows beyond a handful of categories.

  const pushFlash = useCallback((item) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFlashMessages(prev => [...prev, { ...item, id, dismissible: true }]);
  }, []);

  const dismissFlash = useCallback((id) => {
    setFlashMessages(prev => prev.filter(item => item.id !== id));
  }, []);

  const flashbarItems = useMemo(() => flashMessages.map(item => ({
    ...item,
    onDismiss: () => dismissFlash(item.id),
  })), [flashMessages, dismissFlash]);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/admin/event-capture-rules');
      if (!response.ok) {
        const message = await safeReadMessage(response);
        throw new Error(message || 'Failed to load capture rules');
      }
      const data = await response.json();
      setState({
        categories: buildCategoryItems(data.categories || []),
        updatedAt: data.updatedAt || null,
      });
      setSelectedCategoryId(prevId => {
        const categories = data.categories || [];
        if (!categories.length) return null;
        if (prevId && categories.some(cat => cat.id === prevId)) {
          return prevId;
        }
        return categories[0].id;
      });
    } catch (err) {
      pushFlash({ type: 'error', header: 'Unable to load event capture rules', content: err.message });
    } finally {
      setLoading(false);
    }
  }, [pushFlash]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const updateRules = useCallback(async (updates, successMessage) => {
    if (!Array.isArray(updates) || updates.length === 0) return;
    setSaving(true);
    try {
      const response = await apiFetch('/api/admin/event-capture-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) {
        const message = await safeReadMessage(response);
        throw new Error(message || 'Failed to update rules');
      }
      const data = await response.json();
      setState({
        categories: buildCategoryItems(data.categories || []),
        updatedAt: data.updatedAt || null,
      });
      if (successMessage) {
        pushFlash({ type: 'success', content: successMessage });
      }
    } catch (err) {
      pushFlash({ type: 'error', header: 'Update failed', content: err.message });
    } finally {
      setSaving(false);
    }
  }, [pushFlash]);

  const handleCategoryToggle = useCallback((category, nextEnabled) => {
    if (!category) return;
    updateRules([
      { categoryId: category.id, enabled: nextEnabled }
    ], `${category.label} capture ${nextEnabled ? 'enabled' : 'disabled'}.`);
  }, [updateRules]);

  const handleTypeToggle = useCallback((category, type, nextEnabled) => {
    if (!category || !type) return;
    updateRules([
      { categoryId: category.id, typeId: type.id, enabled: nextEnabled }
    ], `${type.label} ${nextEnabled ? 'enabled' : 'disabled'}.`);
  }, [updateRules]);

  const items = useMemo(() => buildCategoryItems(state.categories || []), [state]);

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return items.find(item => item.id === selectedCategoryId) || null;
  }, [items, selectedCategoryId]);

  const columns = useMemo(() => ([
    {
      id: 'category',
      header: 'Category',
      cell: item => (
        <SpaceBetween size="xs">
          <Box fontWeight="bold">{item.label}</Box>
          <Box color="text-label">{item.description || 'No description provided.'}</Box>
        </SpaceBetween>
      ),
      sortingField: 'label',
    },
    {
      id: 'severity',
      header: 'Default severity',
      cell: item => <Badge color={severityToColor(item.severity)}>{item.severity || 'info'}</Badge>,
    },
    {
      id: 'sources',
      header: 'Sources',
      cell: item => buildSourceBadgeList(item.types),
    },
    {
      id: 'types',
      header: 'Event types',
      cell: item => (
        <SpaceBetween size="xxs">
          <Box>{item.types.length} tracked</Box>
          {item.types.some(type => type.draft) && <Badge color="grey">Draft</Badge>}
        </SpaceBetween>
      ),
    },
    {
      id: 'enabled',
      header: 'Capture',
      cell: item => (
        <Toggle
          checked={item.enabled}
          disabled={item.locked || saving}
          onChange={({ detail }) => handleCategoryToggle(item, detail.checked)}
        >
          {item.enabled ? 'Enabled' : 'Disabled'}
        </Toggle>
      ),
    },
  ]), [handleCategoryToggle, saving]);

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Toggle which event categories and event types are written to the central event store. Changes apply immediately across admin and portal backends."
        >
          Event Capture Configuration
        </Header>
      }
    >
      <SpaceBetween size="l">
        {flashbarItems.length > 0 && <Flashbar items={flashbarItems} />}
        <Table
          items={items}
          loading={loading}
          loadingText="Loading event capture rules"
          selectionType="single"
          selectedItems={selectedCategory ? [selectedCategory] : []}
          onSelectionChange={({ detail }) => {
            const next = detail.selectedItems && detail.selectedItems[0] ? detail.selectedItems[0].id : null;
            setSelectedCategoryId(next);
          }}
          trackBy="id"
          columnDefinitions={columns}
          header={<Header variant="h2">Event Categories</Header>}
          empty={<Box textAlign="center">No event categories configured.</Box>}
          wrapLines
          resizableColumns
          stickyHeader
        />
        <Container
          header={<Header variant="h2">Event Types</Header>}
        >
          {loading ? (
            <Box padding="m" textAlign="center">
              <Spinner />
            </Box>
          ) : !selectedCategory ? (
            <Box padding="m">Select a category to manage event types.</Box>
          ) : (
            <SpaceBetween size="m">
              <Box>
                <Box fontWeight="bold">{selectedCategory.label}</Box>
                <Box color="text-label">{selectedCategory.description || 'No description provided.'}</Box>
                {selectedCategory.updatedAt && (
                  <Box variant="small" color="text-label">Last updated {new Date(selectedCategory.updatedAt).toLocaleString()}</Box>
                )}
              </Box>
              <SpaceBetween size="s">
                {selectedCategory.types.map(type => (
                  <Box key={type.id} padding={{ top: 'xs', bottom: 'xs' }}>
                    <SpaceBetween direction="horizontal" size="m" alignItems="center">
                      <SpaceBetween size="xxs">
                        <Box fontWeight="bold">{type.label}</Box>
                        <SpaceBetween direction="horizontal" size="s">
                          <Badge color={severityToColor(type.severity)}>{type.severity || 'info'}</Badge>
                          {type.draft && <Badge color="grey">Draft</Badge>}
                          {type.locked && <Badge color="grey">Locked</Badge>}
                          <Badge color="blue">{type.source || 'admin'}</Badge>
                        </SpaceBetween>
                      </SpaceBetween>
                      <Toggle
                        checked={type.enabled}
                        disabled={type.locked || saving}
                        onChange={({ detail }) => handleTypeToggle(selectedCategory, type, detail.checked)}
                      >
                        {type.enabled ? 'Enabled' : 'Disabled'}
                      </Toggle>
                    </SpaceBetween>
                    {type.updatedAt && (
                      <Box variant="small" color="text-label">
                        Last updated {new Date(type.updatedAt).toLocaleString()} {type.updatedBy ? `by ${type.updatedBy}` : ''}
                      </Box>
                    )}
                  </Box>
                ))}
                {selectedCategory.types.length === 0 && (
                  <Box color="text-label">No event types registered for this category.</Box>
                )}
              </SpaceBetween>
            </SpaceBetween>
          )}
        </Container>
        {state.updatedAt && (
          <StatusIndicator type="info">
            Runtime configuration last refreshed {new Date(state.updatedAt).toLocaleString()}
          </StatusIndicator>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
};

async function safeReadMessage(response) {
  try {
    const data = await response.json();
    return data?.message || data?.error || response.statusText;
  } catch {
    try {
      const text = await response.text();
      return text || response.statusText;
    } catch {
      return response.statusText;
    }
  }
}

export default EventCaptureDashboard;






