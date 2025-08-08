import React, { useEffect, useState } from 'react';
import {
  Box,
  Header,
  ButtonDropdown,
  Table,
  Spinner,
  TextFilter,
  Pagination,
  CollectionPreferences,
  SpaceBetween,
  Button
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useHistory } from 'react-router-dom';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const baseColumnDefinitions = [
  {
    id: 'tracking_id',
    header: 'Tracking ID',
    cell: item => item.tracking_id,
    minWidth: 120,
    maxWidth: 200,
    isRowHeader: true
  },
  {
    id: 'applicant_name',
    header: 'Applicant Name',
    cell: item => item.applicant_name,
    minWidth: 150,
    maxWidth: 250
  },
  {
    id: 'assigned_user_name',
    header: 'Assessor',
    cell: item => item.assigned_user_name,
    minWidth: 150,
    maxWidth: 250
  },
  {
    id: 'submitted_at',
    header: 'Submitted',
    cell: item => item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '',
    minWidth: 120,
    maxWidth: 180
  },
  {
    id: 'last_activity_at',
    header: 'Last Updated',
    cell: item => item.last_activity_at ? new Date(item.last_activity_at).toLocaleDateString() : '',
    minWidth: 120,
    maxWidth: 180
  },
  {
    id: 'priority',
    header: 'Priority',
    cell: item => item.priority,
    minWidth: 100,
    maxWidth: 120
  }
];

const defaultVisibleColumns = [
  'tracking_id',
  'applicant_name',
  'assigned_user_name',
  'submitted_at',
  'last_activity_at',
  'priority',
  'actions'
];

const AssessedCasesWidget = ({ actions, refreshKey }) => {
  const history = useHistory();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(defaultVisibleColumns);
  const [selectedItems, setSelectedItems] = useState([]);

  // Add the actions column with access to history
  const columnDefinitions = [
    ...baseColumnDefinitions,
    {
      id: 'actions',
      header: 'Actions',
      cell: item => <Button variant="inline-link" onClick={() => history.push(`/application-case/${item.id}`)}>Open</Button>,
      minWidth: 80,
      maxWidth: 100
    }
  ];

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/cases?stage=assessment_submitted`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch cases');
        return res.json();
      })
      .then(data => {
        setCases(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [refreshKey]);

  // Filtering
  const filteredItems = cases.filter(item => {
    const search = filteringText.toLowerCase();
    return (
      (item.tracking_id && item.tracking_id.toLowerCase().includes(search)) ||
      (item.applicant_name && item.applicant_name.toLowerCase().includes(search)) ||
      (item.assigned_user_name && item.assigned_user_name.toLowerCase().includes(search)) ||
      (item.priority && item.priority.toLowerCase().includes(search))
    );
  });

  // Pagination
  const pagesCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = filteredItems.slice((currentPageIndex - 1) * pageSize, currentPageIndex * pageSize);

  // Preferences
  const preferences = {
    pageSize,
    contentDisplay: columnDefinitions.map(col => ({ id: col.id, visible: visibleColumns.includes(col.id) }))
  };

  return (
    <BoardItem
      header={<Header variant="h2">Assessed Cases</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions?.removeItem?.()}
        />
      }
    >
      <SpaceBetween direction="vertical" size="xs">
        <Box variant="small">
          This widget lists cases that have completed the assessment stage and are ready for review. Use the table controls to filter, sort, and view details. Only cases with <b>stage = 'assessment_submitted'</b> are shown here.
        </Box>
        <Box>
          {loading ? (
            <Box textAlign="center" padding="m"><Spinner /> Loading...</Box>
          ) : error ? (
            <Box color="error" textAlign="center">{error}</Box>
          ) : (
            <Table
              columnDefinitions={columnDefinitions.filter(col => visibleColumns.includes(col.id))}
              items={pagedItems}
              loading={false}
              empty={<Box textAlign="center">No assessed cases found.</Box>}
              variant="embedded"
              wrapLines
              resizableColumns
              stickyHeader
              stripedRows
              selectionType="multi"
              selectedItems={selectedItems}
              onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
              ariaLabels={{
                selectionGroupLabel: 'Assessed cases',
                allItemsSelectionLabel: () => 'select all',
                itemSelectionLabel: ({ selectedItems }, item) => item.tracking_id,
                tableLabel: 'Assessed cases table',
                header: 'Assessed cases',
                rowHeader: 'Tracking ID',
              }}
              renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
                `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
              }
              filter={
                <TextFilter
                  filteringPlaceholder="Find cases"
                  filteringText={filteringText}
                  onChange={({ detail }) => {
                    setFilteringText(detail.filteringText);
                    setCurrentPageIndex(1);
                  }}
                  countText={
                    filteringText && filteredItems.length !== cases.length
                      ? `${filteredItems.length} match${filteredItems.length === 1 ? '' : 'es'}`
                      : ''
                  }
                />
              }
              header={
                <Header
                  counter={
                    selectedItems.length
                      ? `(${selectedItems.length}/${filteredItems.length})`
                      : `(${filteredItems.length})`
                  }
                >
                  Assessed Cases
                </Header>
              }
              pagination={
                <Pagination
                  currentPageIndex={currentPageIndex}
                  pagesCount={pagesCount}
                  onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
                />
              }
              preferences={
                <CollectionPreferences
                  title="Preferences"
                  confirmLabel="Confirm"
                  cancelLabel="Cancel"
                  preferences={preferences}
                  pageSizePreference={{
                    title: 'Page size',
                    options: PAGE_SIZE_OPTIONS.map(size => ({ value: size, label: `${size} cases` }))
                  }}
                  contentDisplayPreference={{
                    title: 'Select visible columns',
                    options: baseColumnDefinitions.map(col => ({
                      id: col.id,
                      label: col.header,
                      alwaysVisible: col.id === 'tracking_id',
                    })).concat([{ id: 'actions', label: 'Actions', alwaysVisible: true }])
                  }}
                  onConfirm={({ detail }) => {
                    setPageSize(detail.pageSize);
                    setVisibleColumns(detail.contentDisplay.filter(col => col.visible).map(col => col.id));
                    setCurrentPageIndex(1);
                  }}
                />
              }
            />
          )}
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
};

export default AssessedCasesWidget;
