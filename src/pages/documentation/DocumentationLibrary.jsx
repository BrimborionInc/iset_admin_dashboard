import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Board from '@cloudscape-design/board-components/board';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  Container,
  Header,
  SideNavigation,
  SpaceBetween,
  ButtonDropdown,
  Wizard,
  ExpandableSection,
  Link,
} from '@cloudscape-design/components';
import documentationCategories from '../../documentation/documentationLinks';
import runtimeDocuments from '../../documentation/runtime';

const STORAGE_KEY = 'documentation-dashboard-layout-v3';

const widgetRegistry = {
  library: {
    id: 'library',
    defaultRowSpan: 6,
    defaultColumnSpan: 1,
    title: 'Library',
    description: 'Browse guidance resources by category.',
    component: null, // injected later
  },
  reader: {
    id: 'reader',
    defaultRowSpan: 6,
    defaultColumnSpan: 3,
    title: 'Reader',
    description: 'View summary and key topics.',
    component: null, // injected later
  },
};

const defaultLayout = [
  { id: 'library', rowSpan: 6, columnSpan: 1 },
  { id: 'reader', rowSpan: 6, columnSpan: 3 },
];

const exportLayout = items =>
  items.map(({ id, rowSpan, columnSpan, columnOffset }) => ({
    id,
    rowSpan,
    columnSpan,
    columnOffset,
  }));

const toBoardItems = layout =>
  layout
    .filter(item => widgetRegistry[item.id])
    .map(item => {
      const definition = widgetRegistry[item.id];
      return {
        id: definition.id,
        rowSpan: item.rowSpan ?? definition.defaultRowSpan,
        columnSpan: item.columnSpan ?? definition.defaultColumnSpan,
        columnOffset: item.columnOffset,
        data: {
          title: definition.title,
          description: definition.description,
        },
      };
    });

const computePaletteItems = items =>
  Object.values(widgetRegistry)
    .filter(def => !items.some(item => item.id === def.id))
    .map(def => ({
      id: def.id,
      data: {
        title: def.title,
        description: def.description,
      },
    }));

const boardI18nStrings = {
  empty: 'No widgets on the Guidance Library dashboard. Use Add widget to add the library or reader.',
  loading: 'Loading widgets',
  columnAriaLabel: index => `Column ${index + 1}`,
  itemPositionAnnouncement: ({ currentColumn, currentIndex, currentRow }) =>
    `Widget moved to position ${currentIndex + 1}, column ${currentColumn + 1}, row ${currentRow + 1}`,
  liveAnnouncementDndStarted: operation => (operation === 'resize' ? 'Resizing' : 'Dragging'),
  liveAnnouncementDndItemReordered: operation => {
    const position =
      operation.direction === 'horizontal'
        ? `column ${operation.placement.x + 1}`
        : `row ${operation.placement.y + 1}`;
    return `Item moved to ${position}.`;
  },
  liveAnnouncementDndItemResized: operation => {
    const base =
      operation.direction === 'horizontal'
        ? `columns ${operation.placement.width}`
        : `rows ${operation.placement.height}`;
    const constraint =
      operation.direction === 'horizontal'
        ? operation.isMinimalColumnsReached
          ? ' (minimal)'
          : ''
        : operation.isMinimalRowsReached
        ? ' (minimal)'
        : '';
    return `Item resized to ${base}${constraint}.`;
  },
  liveAnnouncementDndItemInserted: operation => {
    const column = `column ${operation.placement.x + 1}`;
    const row = `row ${operation.placement.y + 1}`;
    return `Item inserted to ${column}, ${row}.`;
  },
  liveAnnouncementDndCommitted: operation => `${operation} committed`,
  liveAnnouncementDndDiscarded: operation => `${operation} discarded`,
  liveAnnouncementItemRemoved: op => `Removed item ${op.item.data.title}.`,
  navigationAriaLabel: 'Guidance Library dashboard navigation',
  navigationAriaDescription: 'Use arrow keys to move between widgets.',
  navigationItemAriaLabel: item => (item ? item.data.title : 'Empty'),
};

const boardItemI18nStrings = {
  dragHandleAriaLabel: 'Drag handle',
  dragHandleAriaDescription:
    'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
  resizeHandleAriaLabel: 'Resize handle',
  resizeHandleAriaDescription:
    'Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.',
};

const loadLayoutFromStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter(entry => entry && widgetRegistry[entry.id]);
      return filtered.length ? filtered : null;
    }
  } catch (error) {
    console.error('[DocumentationDashboard] failed to parse stored layout', error);
  }
  return null;
};

const areLayoutsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right || left.id !== right.id) return false;
    if ((left.rowSpan ?? null) !== (right.rowSpan ?? null)) return false;
    if ((left.columnSpan ?? null) !== (right.columnSpan ?? null)) return false;
  }
  return true;
};

const renderSettings = (actions, ariaLabel) => {
  if (typeof actions?.removeItem !== 'function') return undefined;
  return (
    <ButtonDropdown
      ariaLabel={ariaLabel}
      variant="icon"
      items={[{ id: 'remove', text: 'Remove widget' }]}
      onItemClick={({ detail }) => {
        if (detail.id === 'remove') actions.removeItem();
      }}
    />
  );
};

const LibraryWidget = ({ categories, activeDocId, onSelect, actions }) => {
  const navItems = useMemo(
    () =>
      categories.map(category => ({
        type: 'section',
        text: category.title,
        items: (category.items || []).map(doc => ({
          type: 'link',
          text: doc.title,
          href: `#${doc.id}`,
          info: doc.lastUpdated || undefined,
        })),
      })),
    [categories]
  );

  return (
    <BoardItem
      header={<Header variant="h2">Library</Header>}
      settings={renderSettings(actions, 'Library settings')}
      i18nStrings={boardItemI18nStrings}
    >
      <SideNavigation
        activeHref={activeDocId ? `#${activeDocId}` : undefined}
        header={null}
        items={navItems}
        onFollow={event => {
          event.preventDefault();
          const target = (event.detail?.href || '').replace('#', '');
          if (target) {
            onSelect(target);
          }
        }}
      />
    </BoardItem>
  );
};

const ReaderWidget = ({ doc, actions }) => {
  const runtimeDoc = doc?.runtimeId ? runtimeDocuments[doc.runtimeId] : null;

  const renderContentBlock = (block, key) => {
    if (!block) return null;
    if (typeof block === 'string') {
      return (
        <Box key={key} as="p">
          {block}
        </Box>
      );
    }

    switch (block.type) {
      case 'p':
        return (
          <Box key={key} as="p">
            {block.text}
          </Box>
        );
      case 'bullets':
        return (
          <Box key={key} as="div">
            <ul style={{ paddingLeft: '1.2rem', margin: '0.25rem 0' }}>
              {(block.items || []).map((item, idx) => (
                <li key={`${key}-item-${idx}`} style={{ marginBottom: '0.2rem' }}>
                  {item}
                </li>
              ))}
            </ul>
          </Box>
        );
      case 'contacts':
        return (
          <SpaceBetween key={key} size="xs">
            {(block.items || []).map((item, idx) => (
              <Box key={`${key}-contact-${idx}`}>
                <Box fontWeight="bold">{item.name}</Box>
                {item.email && (
                  <div>
                    <Link href={`mailto:${item.email}`}>{item.email}</Link>
                  </div>
                )}
                {item.phone && (
                  <div>
                    <Link href={`tel:${item.phone}`}>{item.phone}</Link>
                  </div>
                )}
              </Box>
            ))}
          </SpaceBetween>
        );
      default:
        return (
          <Box key={key} as="p">
            {block.text || ''}
          </Box>
        );
    }
  };

  const wizardSteps = useMemo(() => {
    if (!runtimeDoc) return [];
    return (runtimeDoc.chunks || []).map((chunk, index) => ({
      title: chunk.title,
      description: chunk.description || undefined,
      stepNumber: index + 1,
      isOptional: chunk.isOptional ?? index > 0,
      content: (
        <SpaceBetween size="m">
          {(chunk.slides || [])
            .filter(slide => (slide.title && slide.title.trim()) || (slide.content || []).length > 0)
            .map((slide, slideIdx) => (
              <ExpandableSection
                key={slide.id}
                headerText={slide.title || 'Details'}
                defaultExpanded={slideIdx === 0}
              >
                <SpaceBetween size="xs">
                  {(slide.content || []).map((block, blockIdx) =>
                    renderContentBlock(block, `${slide.id}-block-${blockIdx}`)
                  )}
                </SpaceBetween>
              </ExpandableSection>
            ))}
        </SpaceBetween>
      ),
    }));
  }, [runtimeDoc]);

  if (!doc) {
    return (
      <BoardItem
        header={<Header variant="h2">Reader</Header>}
        i18nStrings={boardItemI18nStrings}
        settings={renderSettings(actions, 'Reader settings')}
      >
        <Box variant="p" color="text-body-secondary">
          Choose a document from the library to preview its summary and key topics.
        </Box>
      </BoardItem>
    );
  }

  return (
    <BoardItem
      header={
        <Header variant="h2" description={doc.purpose || undefined}>
          {doc.title}
        </Header>
      }
      settings={renderSettings(actions, 'Reader settings')}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        {runtimeDoc ? (
          <Wizard
            key={doc.runtimeId || 'reader-wizard'}
            steps={wizardSteps}
            allowSkipTo
            onNavigate={({ detail }) => {
              // Uncontrolled wizard will manage active step; we only reset by key
            }}
            i18nStrings={{
              stepNumberLabel: stepNumber => `Step ${stepNumber}`,
              collapsedStepsLabel: (stepNumber, total) => `Step ${stepNumber} of ${total}`,
              navigationAriaLabel: 'Document sections',
              skipToButtonLabel: (step, stepNumber) => `Skip to ${step.title || `Step ${stepNumber}`}`,
              submitButton: 'Close',
              nextButton: 'Next',
              previousButton: 'Previous',
              cancelButton: 'Cancel',
              optional: 'Optional',
            }}
            isLoadingNextStep={false}
            showCollapsedSteps={false}
            secondaryActions={[]}
          />
        ) : (
          Array.isArray(doc.summary) && doc.summary.length > 0 && (
            <SpaceBetween size="xxs">
              <Box fontWeight="bold">Summary</Box>
              <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                {doc.summary.map(line => (
                  <li key={line} style={{ marginBottom: '4px' }}>{line}</li>
                ))}
              </ul>
            </SpaceBetween>
          )
        )}
        <Box color="text-body-secondary" fontSize="body-s">Source</Box>
        <Box fontFamily="monospace">{doc.sourcePath}</Box>
        {doc.sourceNote && (
          <Box color="text-body-secondary" fontSize="body-s">
            {doc.sourceNote}
          </Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

const DocumentationLibrary = ({
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
}) => {
  const allDocs = useMemo(
    () =>
      documentationCategories.flatMap(category =>
        (category.items || []).map(item => ({
          ...item,
          categoryId: category.id,
          categoryTitle: category.title,
        }))
      ),
    []
  );

  const [activeDocId, setActiveDocId] = useState(allDocs[0]?.id || null);
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? defaultLayout);
  const sanitizedLayout = useMemo(() => layout.filter(item => widgetRegistry[item.id]), [layout]);

  useEffect(() => {
    if (typeof updateBreadcrumbs === 'function') {
      updateBreadcrumbs([{ text: 'Home', href: '/' }, { text: 'Guidance Library', href: '/documentation' }]);
    }
  }, [updateBreadcrumbs]);

  useEffect(() => {
    if (layout.length !== sanitizedLayout.length) {
      setLayout(sanitizedLayout);
    }
  }, [layout, sanitizedLayout]);

  const boardItems = useMemo(() => toBoardItems(sanitizedLayout), [sanitizedLayout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems));

  useEffect(() => {
    const signature = JSON.stringify(paletteItems);
    if (paletteSignatureRef.current !== signature) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === 'function') {
        try {
          setAvailableItems(paletteItems);
        } catch {
          // ignore palette errors
        }
      }
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
      } catch {
        // ignore persistence errors
      }
    }
  }, [boardItems, paletteItems, setAvailableItems]);

  useEffect(() => {
    const handleAdd = event => {
      const id = event?.detail?.id;
      if (!id || !widgetRegistry[id]) return;
      setLayout(current => (current.some(item => item.id === id) ? current : [...current, { id }]));
    };
    window.addEventListener('palette:add', handleAdd);
    return () => window.removeEventListener('palette:add', handleAdd);
  }, []);

  const handleItemsChange = ({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) return;
    const next = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, next) ? current : next));
  };

  const resetLayout = useCallback(() => {
    setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : defaultLayout));
    const defaultPalette = computePaletteItems(toBoardItems(defaultLayout));
    paletteSignatureRef.current = JSON.stringify(defaultPalette);
    if (typeof setAvailableItems === 'function') {
      try {
        setAvailableItems(defaultPalette);
      } catch {
        // ignore palette errors
      }
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore persistence errors
      }
    }
    if (typeof setSplitPanelOpen === 'function') {
      setSplitPanelOpen(true);
    }
  }, [setAvailableItems, setSplitPanelOpen]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === 'function') {
      try {
        setAvailableItems(paletteItems);
      } catch {
        // ignore palette errors
      }
    }
    if (typeof setSplitPanelOpen === 'function') {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpen = () => openPalette();
    const handleReset = () => {
      resetLayout();
      openPalette();
    };
    window.addEventListener('documentation:openPalette', handleOpen);
    window.addEventListener('documentation:resetLayout', handleReset);
    return () => {
      window.removeEventListener('documentation:openPalette', handleOpen);
      window.removeEventListener('documentation:resetLayout', handleReset);
    };
  }, [openPalette, resetLayout]);

  const renderBoardItem = (item, actions) => {
    if (!item?.id) return null;
    if (item.id === 'library') {
      return (
        <LibraryWidget
          categories={documentationCategories}
          activeDocId={activeDocId}
          onSelect={setActiveDocId}
          actions={actions}
        />
      );
    }
    if (item.id === 'reader') {
      const activeDoc = allDocs.find(doc => doc.id === activeDocId) || null;
      return (
        <ReaderWidget
          doc={activeDoc}
          actions={actions}
        />
      );
    }
    return (
      <Container header={<Header variant="h2">Unknown widget</Header>}>
        <Box variant="p">This widget is not configured.</Box>
      </Container>
    );
  };

  return (
    <Board
      i18nStrings={boardI18nStrings}
      items={boardItems}
      onItemsChange={handleItemsChange}
      renderItem={renderBoardItem}
      empty={
        <Container header={<Header variant="h2">No widgets</Header>}>
          <Box variant="p" color="text-body-secondary">
            Add the library and reader widgets to start browsing the guidance resources.
          </Box>
        </Container>
      }
    />
  );
};

export default DocumentationLibrary;
