import React, { useEffect, useState } from 'react';
import {
  Box,
  Header,
  ButtonDropdown,
  Table,
  Spinner,
  Button,
  TextFilter,
  Pagination,
  CollectionPreferences,
  SpaceBetween
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useHistory } from 'react-router-dom';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const columnDefinitions = [
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
    id: 'submitted_at',
    header: 'Submitted At',
    cell: item => new Date(item.submitted_at).toLocaleDateString(),
    minWidth: 140,
    maxWidth: 180
  },
  {
    id: 'assigned_user_name',
    header: 'Assigned To',
    cell: item => item.assigned_user_name,
    minWidth: 150,
    maxWidth: 250
  },
  {
    id: 'assigned_user_ptmas',
    header: 'PTMA Name',
    cell: item => item.assigned_user_ptmas || '',
    minWidth: 200,
    maxWidth: 350
  }
];

const defaultVisibleColumns = [
  'tracking_id',
  'applicant_name',
  'submitted_at',
  'assigned_user_name',
  'assigned_user_ptmas',
  'edit'
];

const AssignedCasesWidget = ({ actions, refreshKey }) => {
  const history = useHistory();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(defaultVisibleColumns);
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/cases`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setCases(data);
      } catch (err) {
        setError('Failed to load assigned cases.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshKey]);

  // Filtering
  const filteredItems = cases.filter(item => {
    const search = filteringText.toLowerCase();
    return (
      (item.tracking_id && item.tracking_id.toLowerCase().includes(search)) ||
      (item.applicant_name && item.applicant_name.toLowerCase().includes(search)) ||
      (item.assigned_user_name && item.assigned_user_name.toLowerCase().includes(search)) ||
      (item.assigned_user_ptmas && item.assigned_user_ptmas.toLowerCase().includes(search))
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

  // Inline action column
  const editColumn = {
    id: 'edit',
    header: '',
    cell: item => (
      <Button variant="inline-link" onClick={() => history.push(`/application-case/${item.id}`)}>Edit</Button>
    ),
    minWidth: 80,
    maxWidth: 100
  };

  const allColumns = [...columnDefinitions, editColumn];

  return (
    <BoardItem
      header={<Header variant="h2">Assigned Cases</Header>}
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
      <Box>
        {loading ? (
          <Box textAlign="center" padding="m"><Spinner /> Loading...</Box>
        ) : error ? (
          <Box color="error" textAlign="center">{error}</Box>
        ) : (
          <Table
            columnDefinitions={allColumns.filter(col => visibleColumns.includes(col.id) || col.id === 'edit')}
            items={pagedItems}
            loading={false}
            empty={<Box textAlign="center">No assigned cases</Box>}
            variant="embedded"
            wrapLines
            resizableColumns
            stickyHeader
            stripedRows
            selectionType="multi"
            selectedItems={selectedItems}
            onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
            ariaLabels={{
              selectionGroupLabel: 'Assigned cases',
              allItemsSelectionLabel: () => 'select all',
              itemSelectionLabel: ({ selectedItems }, item) => item.tracking_id,
              tableLabel: 'Assigned cases table',
              header: 'Assigned cases',
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
                Assigned Cases
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
                  options: columnDefinitions.map(col => ({
                    id: col.id,
                    label: col.header,
                    alwaysVisible: col.id === 'tracking_id',
                  })).concat({ id: 'edit', label: 'Edit', alwaysVisible: true })
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
    </BoardItem>
  );
};

export default AssignedCasesWidget;
