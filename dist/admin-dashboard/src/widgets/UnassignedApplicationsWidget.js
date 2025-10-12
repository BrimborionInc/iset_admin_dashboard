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
  SpaceBetween,
  FormField,
  Checkbox
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import { apiFetch } from '../auth/apiClient';

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
    id: 'email',
    header: 'Email',
    cell: item => item.email,
    minWidth: 180,
    maxWidth: 300
  },
  {
    id: 'submitted_at',
    header: 'Submitted At',
    cell: item => new Date(item.submitted_at).toLocaleString(),
    minWidth: 180,
    maxWidth: 250
  }
];

const defaultVisibleColumns = [
  'tracking_id',
  'applicant_name',
  'email',
  'submitted_at'
];

const UnassignedApplicationsWidget = ({ actions, onCaseAssigned, refreshKey }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(defaultVisibleColumns);
  const [selectedItems, setSelectedItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [intakeOfficers, setIntakeOfficers] = useState([]);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [officersError, setOfficersError] = useState(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState(null);
  const [selectedPtmaId, setSelectedPtmaId] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
  const response = await apiFetch(`/api/case-assignment/unassigned-applications`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        // Sort by submitted_at descending
        data.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
        setApplications(data);
      } catch (err) {
        setError('Failed to load unassigned applications.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshKey]);

  // Fetch intake officers when modal opens
  useEffect(() => {
    if (modalVisible) {
      setOfficersLoading(true);
      setOfficersError(null);
  apiFetch(`/api/intake-officers`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch intake officers');
          return res.json();
        })
        .then(data => {
          setIntakeOfficers(data);
          setOfficersLoading(false);
        })
        .catch(err => {
          setOfficersError('Failed to load intake officers');
          setOfficersLoading(false);
        });
    }
  }, [modalVisible]);

  // Assign handler
  const handleAssign = async () => {
    if (!selectedOfficerId || !selectedApplication) return;
    setAssigning(true);
    setAssignError(null);
    try {
  const res = await apiFetch(`/api/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: selectedApplication.application_id,
          assigned_to_user_id: selectedOfficerId,
          ptma_id: selectedPtmaId, // Pass the selected PTMA ID (can be null)
          priority: urgent ? 'high' : 'medium'
        })
      });
      if (!res.ok) throw new Error('Failed to assign case');
      // Remove assigned application from table
      setApplications(applications => applications.filter(app => app.application_id !== selectedApplication.application_id));
      setModalVisible(false);
      setSelectedApplication(null);
      setSelectedOfficerId(null);
      setSelectedPtmaId(null);
      setUrgent(false);
      if (onCaseAssigned) onCaseAssigned();
    } catch (err) {
      setAssignError('Failed to assign application');
    } finally {
      setAssigning(false);
    }
  };

  // Filtering
  const filteredItems = applications.filter(item => {
    const search = filteringText.toLowerCase();
    return (
      item.tracking_id.toLowerCase().includes(search) ||
      item.applicant_name.toLowerCase().includes(search) ||
      item.email.toLowerCase().includes(search) ||
      new Date(item.submitted_at).toLocaleString().toLowerCase().includes(search)
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

  const assignColumn = {
    id: 'assign',
    header: 'Assign',
    cell: item => (
      <Button
        variant="inline-link"
        onClick={() => {
          setSelectedApplication(item);
          setModalVisible(true);
        }}
      >
        Assign
      </Button>
    ),
    minWidth: 100,
    maxWidth: 120
  };

  const allColumns = [...columnDefinitions, assignColumn];

  return (
    <BoardItem
      header={<Header variant="h2">Unassigned Applications</Header>}
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
      <SpaceBetween size="m">
        <Box variant="small">
          This widget shows applications that have not yet been assigned for assessment. NWAC Admins and Regional Coordinators can use the assign button to allocate the application to an assessor. Allocation is logged, and depending on notification settings may send a secure message and email alert to the person the application is being assigned to.
        </Box>
        <Box>
          {loading ? (
            <Box textAlign="center" padding="m"><Spinner /> Loading...</Box>
          ) : error ? (
            <Box color="error" textAlign="center">{error}</Box>
          ) : (
            <Table
              columnDefinitions={allColumns.filter(col => visibleColumns.includes(col.id) || col.id === 'assign')}
              items={pagedItems}
              loading={false}
              empty={<Box textAlign="center">No unassigned applications</Box>}
              variant="embedded"
              wrapLines
              resizableColumns
              stickyHeader
              stripedRows
              selectionType="multi"
              selectedItems={selectedItems}
              onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
              ariaLabels={{
                selectionGroupLabel: 'Unassigned applications',
                allItemsSelectionLabel: () => 'select all',
                itemSelectionLabel: ({ selectedItems }, item) => item.tracking_id,
                tableLabel: 'Unassigned applications table',
                header: 'Unassigned applications',
                rowHeader: 'Tracking ID',
              }}
              renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
                `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
              }
              filter={
                <TextFilter
                  filteringPlaceholder="Find applications"
                  filteringText={filteringText}
                  onChange={({ detail }) => {
                    setFilteringText(detail.filteringText);
                    setCurrentPageIndex(1);
                  }}
                  countText={
                    filteringText && filteredItems.length !== applications.length
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
                  # of Unassigned Applications
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
                    options: PAGE_SIZE_OPTIONS.map(size => ({ value: size, label: `${size} applications` }))
                  }}
                  contentDisplayPreference={{
                    title: 'Select visible columns',
                    options: columnDefinitions.map(col => ({
                      id: col.id,
                      label: col.header,
                      alwaysVisible: col.id === 'tracking_id',
                    }))
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

      {/* Modal for assignment */}
      {modalVisible && (
        <Modal
          visible={modalVisible}
          onDismiss={() => { setModalVisible(false); setSelectedOfficerId(null); setSelectedApplication(null); setAssignError(null); setUrgent(false); }}
          header="Assign to Regional Coordinator"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => { setModalVisible(false); setSelectedOfficerId(null); setSelectedApplication(null); setAssignError(null); setUrgent(false); }}>Cancel</Button>
              <Button
                variant="primary"
                loading={assigning}
                disabled={!selectedOfficerId}
                onClick={handleAssign}
              >
                Assign
              </Button>
            </SpaceBetween>
          }
        >
          {officersLoading ? (
            <Box textAlign="center"><Spinner /> Loading intake officers...</Box>
          ) : officersError ? (
            <Box color="error">{officersError}</Box>
          ) : (
            <SpaceBetween size="m">
              <Select
                selectedOption={
                  selectedOfficerId !== null && intakeOfficers.length > 0
                    ? {
                        value: `${selectedOfficerId}|${selectedPtmaId || ''}`,
                        label: (() => {
                          const officer = intakeOfficers.find(o => o.evaluator_id === selectedOfficerId && (o.ptma_id === selectedPtmaId || (!o.ptma_id && !selectedPtmaId)));
                          return officer ? `${officer.evaluator_name} — ${officer.ptma_label}` : '';
                        })()
                      }
                    : null
                }
                onChange={({ detail }) => {
                  const [evalId, ptmaId] = detail.selectedOption.value.split('|');
                  setSelectedOfficerId(Number(evalId));
                  setSelectedPtmaId(ptmaId ? Number(ptmaId) : null);
                }}
                options={intakeOfficers.map(o => ({
                  value: `${o.evaluator_id}|${o.ptma_id || ''}`,
                  label: `${o.evaluator_name} — ${o.ptma_label}`
                }))}
                placeholder="Select evaluator"
                disabled={officersLoading}
              />
              <FormField label="Urgent">
                <Checkbox
                  checked={urgent}
                  onChange={({ detail }) => setUrgent(detail.checked)}
                >
                  Mark as urgent (high priority)
                </Checkbox>
              </FormField>
              {assignError && <Box color="error">{assignError}</Box>}
            </SpaceBetween>
          )}
        </Modal>
      )}
    </BoardItem>
  );
};

export default UnassignedApplicationsWidget;
