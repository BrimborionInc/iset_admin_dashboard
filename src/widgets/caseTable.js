import React, { useEffect, useState } from 'react';
import {
  Box,
  Header,
  ButtonDropdown,
  Table,
  TextFilter,
  Pagination,
  CollectionPreferences,
  Button,
  SpaceBetween,
  Toggle // Import Toggle component
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const CaseTable = ({ actions }) => {
  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [sortingColumn, setSortingColumn] = useState(null);
  const [isDescending, setIsDescending] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([
    'applicant_name',
    'tracking_id',
    'status',
    'priority',
    'last_activity_at',
    'actions' // ← Add this
  ]);
  const [showClosedCases, setShowClosedCases] = useState(true); // Default toggle off (show all cases)

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/cases`);
        const data = await response.json();
        setCases(data);
        setFilteredCases(data);
      } catch (error) {
        console.error('Error fetching cases:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  useEffect(() => {
    const lowercasedFilter = filterText.toLowerCase();
    const filtered = cases
      .filter(
        (item) =>
          item.applicant_name.toLowerCase().includes(lowercasedFilter) ||
          item.tracking_id.toLowerCase().includes(lowercasedFilter)
      )
      .filter((item) => !showClosedCases || item.status.toLowerCase() !== 'closed'); // Reverse logic for toggle
    setFilteredCases(filtered);
  }, [filterText, cases, showClosedCases]); // Add showClosedCases to dependencies

  useEffect(() => {
    if (sortingColumn) {
      const sorted = [...filteredCases].sort((a, b) => {
        const field = sortingColumn.sortingField;
        const aValue = a[field];
        const bValue = b[field];
        if (aValue < bValue) return isDescending ? 1 : -1;
        if (aValue > bValue) return isDescending ? -1 : 1;
        return 0;
      });
      setFilteredCases(sorted);
    }
  }, [sortingColumn, isDescending, filteredCases]);

  const handlePreferencesChange = (preferences) => {
    setVisibleColumns(preferences.contentDisplay.filter((col) => col.visible).map((col) => col.id));
    if (preferences.hideClosedCases !== undefined) {
      setShowClosedCases(preferences.hideClosedCases); // Persist the preference
      localStorage.setItem('showClosedCases', preferences.hideClosedCases); // Save to localStorage
    }
  };

  // Load the "Show Closed Cases" preference from localStorage on component mount
  useEffect(() => {
    const savedShowClosedCases = localStorage.getItem('showClosedCases');
    if (savedShowClosedCases !== null) {
      setShowClosedCases(savedShowClosedCases === 'true'); // Convert string to boolean
    }
  }, []);

  const filteredColumnDefinitions = [
    {
      id: 'applicant_name',
      header: 'Applicant Name',
      cell: (item) => item.applicant_name,
      sortingField: 'applicant_name',
      isRowHeader: true,
      minWidth: 150,
      maxWidth: 300
    },
    {
      id: 'tracking_id',
      header: 'Tracking ID',
      cell: (item) => item.tracking_id,
      sortingField: 'tracking_id',
      minWidth: 160,
      maxWidth: 200
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item) => item.status,
      sortingField: 'status',
      minWidth: 100,
      maxWidth: 150
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (item) => item.priority,
      sortingField: 'priority',
      minWidth: 100,
      maxWidth: 150
    },
    {
      id: 'last_activity_at',
      header: 'Last Activity',
      cell: (item) => new Date(item.last_activity_at).toLocaleString(),
      sortingField: 'last_activity_at',
      minWidth: 200,
      maxWidth: 300
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (item) => (
        <Button
          variant="inline-link"
          onClick={() => console.log(`Modify case ${item.tracking_id}`)}
          ariaLabel={`Modify case ${item.tracking_id}`}
        >
          Modify Case
        </Button>
      ),
      minWidth: 150,
      maxWidth: 200
    }
  ].filter((col) => visibleColumns.includes(col.id));

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          counter={selectedItems.length ? `(${selectedItems.length}/${cases.length})` : `(${cases.length})`}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Toggle
                checked={showClosedCases}
                onChange={({ detail }) => setShowClosedCases(detail.checked)} // Update state on toggle
              >
                {showClosedCases ? 'Hide Closed Cases' : 'Hide Closed Cases'}
              </Toggle>
              <ButtonDropdown
                items={[
                  { id: 'reassign', text: 'Reassign' },
                  { id: 'message_all', text: 'Message All' }
                ]}
                ariaLabel="Actions"
                disabled={selectedItems.length === 0}
                onItemClick={(event) => {
                  const action = event.detail.id;
                  if (action === 'reassign') {
                    // Handle reassign action
                  } else if (action === 'message_all') {
                    // Handle message all action
                  }
                }}
              >
                Actions
              </ButtonDropdown>
              <Button
                onClick={() => {
                  // Handle manual add action
                }}
              >
                Manual Add
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  // Handle next case action
                }}
              >
                Next Case
              </Button>
            </SpaceBetween>
          }
        >
          My Assigned Cases
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription:
          'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription:
          'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions.removeItem()}
        />
      }
    >
      <Table
        items={filteredCases}
        loading={loading}
        loadingText="Loading cases"
        stickyHeader
        resizableColumns
        filter={
          <TextFilter
            filteringPlaceholder="Find cases by applicant name or tracking ID"
            filteringText={filterText}
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        columnDefinitions={filteredColumnDefinitions}
        ariaLabels={{
          selectionGroupLabel: 'Case selection',
          allItemsSelectionLabel: () => 'Select all cases',
          itemSelectionLabel: ({ selectedItems }, item) => `Select case for ${item.applicant_name}`
        }}
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        onSortingChange={({ detail }) => {
          setSortingColumn(detail.sortingColumn);
          setIsDescending(detail.isDescending);
        }}
        sortingColumn={sortingColumn}
        sortingDescending={isDescending}
        pagination={
          <Pagination
            currentPageIndex={1}
            pagesCount={Math.ceil(filteredCases.length / 10)}
          />
        }
        preferences={null} // Remove preferences for "Show Closed Cases"
        renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
          `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
        }
      />
    </BoardItem>
  );
};

export default CaseTable;
