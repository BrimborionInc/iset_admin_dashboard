import React, { useMemo } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Badge,
  Box,
  Button,
  ButtonDropdown,
  Cards,
  ColumnLayout,
  Container,
  Header,
  Link,
  SpaceBetween,
  Table
} from '@cloudscape-design/components';
import HomeWorkQueueHelp from '../../../helpPanelContents/homeWorkQueueHelp';

export const PROGRAM_ADMIN_BUCKETS = [
  {
    id: 'unassigned-applications',
    label: 'Unassigned Applications',
    description: 'Applications in your region that lack an owner.'
  },
  {
    id: 'unresolved-conflicts',
    label: 'Unresolved Conflicts',
    description: 'Conflicts of interest declarations that need resolution or reassignment.'
  },
  {
    id: 'ei-eligibility-checks',
    label: 'EI Eligibility Checks',
    description: 'Applications waiting for EI status validation by an Admin or Manager.'
  },
  {
    id: 'exceptions-escalations',
    label: 'Exceptions & Escalations',
    description: 'Applications escalated for your attention.'
  },
  {
    id: 'applications-awaiting-approval',
    label: 'Application Assessments',
    description: 'Assessed ISET applications awaiting your decision.'
  },
  {
    id: 'interventions-awaiting-approval',
    label: 'New Interventions',
    description: 'Proposed additional interventions awaiting approval.'
  },
  {
    id: 'payments-issues',
    label: 'Payments Issues',
    description: 'Interventions with missing evidence or needing attention.'
  },
  {
    id: 'ilmp-issues',
    label: 'Watchlist Hits',
    description: 'Applications with SIN numbers matching the watchlist.'
  },
  {
    id: 'marked-for-closure',
    label: 'Marked for Closure',
    description: 'Where the applicant has not responded to a request for information.'
  },
  {
    id: 'overdue',
    label: 'Overdue',
    description: 'SLA breaches and overdue actions.'
  }
];

export const PROGRAM_ADMIN_SAMPLE_ITEMS = [
  {
    id: 'APP-2045',
    title: 'APP-2045 · Northern Trades Training Society',
    bucketId: 'unassigned-applications',
    type: 'Application',
    applicant: 'Northern Trades Training Society',
    region: 'North',
    owner: 'Unassigned',
    status: 'Submitted',
    dueDate: '2025-02-28',
    submittedAt: '2025-02-12',
    summary: 'New submission without assessor; applicant asked for an update.',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'APP-2098',
    title: 'APP-2098 · Coastal Welding Program',
    bucketId: 'unassigned-applications',
    type: 'Application',
    applicant: 'Coastal Welding Program',
    region: 'Vancouver Island',
    owner: 'Unassigned',
    status: 'Submitted',
    dueDate: '2025-02-26',
    submittedAt: '2025-02-10',
    summary: 'Awaiting owner; flagged as high-priority by intake.'
  },
  {
    id: 'CONFLICT-77',
    title: 'Conflict · D. Serrano vs Lakeside Skills',
    bucketId: 'unresolved-conflicts',
    type: 'Conflict',
    applicant: 'Lakeside Skills Partnership',
    region: 'Fraser',
    owner: 'NWAC Administrator',
    status: 'Pending decision',
    dueDate: '2025-02-20',
    submittedAt: '2025-02-11',
    summary: 'Assessor declared COI; need reassignment decision.'
  },
  {
    id: 'ELIG-18',
    title: 'EI Validation · APP-1932',
    bucketId: 'ei-eligibility-checks',
    type: 'Eligibility',
    applicant: 'Prairie Pathfinders',
    region: 'Central',
    owner: 'EI Desk',
    status: 'Waiting on SIN verification',
    dueDate: '2025-02-19',
    submittedAt: '2025-02-08',
    summary: 'Missing employer contact and EI confirmation.'
  },
  {
    id: 'ESC-03',
    title: 'Exception · Out-of-province delivery',
    bucketId: 'exceptions-escalations',
    type: 'Exception',
    applicant: 'Frontier Aviation College',
    region: 'North',
    owner: 'Policy Board',
    status: 'In review',
    dueDate: '2025-02-21',
    submittedAt: '2025-02-09',
    summary: 'Exception request for cross-jurisdiction delivery.'
  },
  {
    id: 'APP-1984',
    title: 'APP-1984 · Apprenticeship Accelerator',
    bucketId: 'applications-awaiting-approval',
    type: 'Application',
    applicant: 'Apprenticeship Accelerator',
    region: 'Fraser',
    owner: 'T. Firth',
    status: 'Awaiting program approval',
    dueDate: '2025-02-18',
    submittedAt: '2025-02-04',
    summary: 'Assessment complete; pending approval decision.',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'INT-118',
    title: 'Intervention · Welding simulator upgrade',
    bucketId: 'interventions-awaiting-approval',
    type: 'InterventionApproval',
    applicant: 'Coastal Welding Program',
    region: 'Vancouver Island',
    owner: 'S. Chao',
    status: 'Awaiting approval',
    dueDate: '2025-02-22',
    submittedAt: '2025-02-06',
    summary: 'New intervention proposed by assessor.',
    workspacePath: '/iset/cases'
  },
  {
    id: 'PAY-220',
    title: 'Payment issue · Missing evidence (INT-1866)',
    bucketId: 'payments-issues',
    type: 'Payment',
    applicant: 'Summit Project Management',
    region: 'Central',
    owner: 'Payments Desk',
    status: 'Missing evidence',
    dueDate: '2025-02-23',
    submittedAt: '2025-02-07',
    summary: 'Intervention payment on hold pending receipts and attendance confirmation.'
  },
  {
    id: 'WATCH-12',
    title: 'Watchlist · Returning applicant',
    bucketId: 'ilmp-issues',
    type: 'WatchlistHit',
    applicant: 'A. MacKenzie',
    region: 'North',
    owner: 'Unassigned',
    status: 'Submitted',
    sin: '123 456 789',
    notes: 'Prior overpayment; manual review required.',
    dueDate: null,
    submittedAt: '2025-02-05',
    summary: 'SIN matches a watchlist entry; review notes before assessment.'
  },
  {
    id: 'CLS-109',
    title: 'Closure · No response after info request (APP-2071)',
    bucketId: 'marked-for-closure',
    type: 'Closure',
    applicant: 'Community Training Hub',
    region: 'Fraser',
    owner: 'Regional Manager',
    status: 'Awaiting response',
    dueDate: '2025-02-17',
    submittedAt: '2025-02-11',
    summary: 'Applicant unresponsive after multiple requests; flagged for closure review.'
  }
];

const DISABLED_BUCKET_IDS = new Set([
  'payments-issues'
]);

const getWorkspacePath = item => {
  if (item?.workspacePath) return item.workspacePath;
  const caseId = item?.case_id || item?.caseId || null;
  if (!caseId) return null;
  const type = (item?.type || '').toString().trim().toLowerCase();
  if (type.includes('intervention') || type.includes('case')) {
    return `/cases/${caseId}`;
  }
  return `/application-case/${caseId}`;
};

const toBoardItemI18n = () => ({
  dragHandleAriaLabel: 'Drag handle',
  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
  resizeHandleAriaLabel: 'Resize handle',
  resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
});

const WorkQueueHeaderSettings = ({ actions }) =>
  actions?.removeItem ? (
    <ButtonDropdown
      ariaLabel="Board item settings"
      variant="icon"
      items={[{ id: 'remove', text: 'Remove' }]}
      onItemClick={({ detail }) => {
        if (detail.id === 'remove') {
          actions.removeItem();
        }
      }}
    />
  ) : undefined;

const ProgramAdminWorkQueueWidget = ({
  bucketDefinitions = PROGRAM_ADMIN_BUCKETS,
  selectedBucketId,
  onSelectBucket,
  items = PROGRAM_ADMIN_SAMPLE_ITEMS,
  countsByBucket = {},
  actions,
  onRefresh,
  toggleHelpPanel
}) => {
  const bucketCounts = useMemo(() => {
    return bucketDefinitions.map(bucket => {
      const derivedCount = items.filter(item => item.bucketId === bucket.id).length;
      const override = countsByBucket[bucket.id];
      const isDisabled = DISABLED_BUCKET_IDS.has(bucket.id);
      return {
        ...bucket,
        count: isDisabled ? '-' : (Number.isFinite(override) ? override : derivedCount)
      };
    });
  }, [bucketDefinitions, countsByBucket, items]);

  const selectedBucket =
    bucketCounts.find(bucket => bucket.id === selectedBucketId) || bucketCounts[0] || null;
  const infoLink = toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(<HomeWorkQueueHelp />, 'Work Queue', HomeWorkQueueHelp.aiContext || '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Select a work queue to show items in that queue."
          actions={
            typeof onRefresh === 'function'
              ? (
                <Button
                  iconName="refresh"
                  variant="icon"
                  ariaLabel="Refresh work queue"
                  onClick={() => onRefresh()}
                />
              )
              : undefined
          }
        >
          Work Queue
        </Header>
      }
      settings={<WorkQueueHeaderSettings actions={actions} />}
      i18nStrings={toBoardItemI18n()}
    >
      <SpaceBetween size="s">
        <Cards
          cardDefinition={{
            header: item => (
              <SpaceBetween size="xxs">
                <Box fontSize="display-l" fontWeight="bold">
                  {item.count}
                </Box>
                <Box fontWeight="bold" fontSize="body-m">
                  {item.label}
                </Box>
              </SpaceBetween>
            ),
            sections: [
              {
                id: 'description',
                content: item => (
                  <Box fontSize="body-s" color="text-status-inactive">
                    {item.description}
                  </Box>
                )
              }
            ]
          }}
          cardsPerRow={[
            { cards: 1 },
            { minWidth: 360, cards: 2 },
            { minWidth: 640, cards: 3 },
            { minWidth: 920, cards: 4 },
            { minWidth: 1200, cards: 5 }
          ]}
          items={bucketCounts}
          selectionType="single"
          trackBy="id"
          selectedItems={selectedBucket ? [selectedBucket] : []}
          entireCardClickable
          isItemDisabled={item => DISABLED_BUCKET_IDS.has(item.id)}
          onSelectionChange={({ detail }) => {
            const next = detail.selectedItems?.[0];
            if (next?.id && typeof onSelectBucket === 'function') {
              onSelectBucket(next.id);
            }
          }}
          empty={<Box variant="p">No queues available for this role.</Box>}
        />
      </SpaceBetween>
    </BoardItem>
  );
};

export const ProgramAdminWorkItemsWidget = ({
  bucketDefinitions = PROGRAM_ADMIN_BUCKETS,
  selectedBucketId,
  selectedItemId,
  onSelectItem,
  items = PROGRAM_ADMIN_SAMPLE_ITEMS,
  actions
}) => {
  const selectedBucket =
    bucketDefinitions.find(bucket => bucket.id === selectedBucketId) || bucketDefinitions[0] || null;

  const queueItems = useMemo(() => {
    if (!selectedBucket) return [];
    return items.filter(item => item.bucketId === selectedBucket.id);
  }, [items, selectedBucket]);

  const selectedItem =
    queueItems.find(item => item.id === selectedItemId) || queueItems[0] || null;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description="Selected queue items with quick context and placeholders for in-line actions."
        >
          Work Queue Items
        </Header>
      }
      settings={<WorkQueueHeaderSettings actions={actions} />}
      i18nStrings={toBoardItemI18n()}
    >
      <SpaceBetween size="m">
        <ColumnLayout columns={2} variant="text-grid" minColumnWidth={380}>
          <Table
            variant="embedded"
            trackBy="id"
            selectionType="single"
            items={queueItems}
            selectedItems={selectedItem ? [selectedItem] : []}
            onSelectionChange={({ detail }) => {
              const next = detail.selectedItems?.[0];
              if (typeof onSelectItem === 'function') {
                onSelectItem(next?.id || null);
              }
            }}
            columnDefinitions={[
              {
                id: 'title',
                header: 'Item',
                cell: item => {
                  const workspacePath = getWorkspacePath(item);
                  return (
                    <SpaceBetween size="xxs">
                      <Box fontWeight="bold">
                        <Link
                          href={workspacePath || '#'}
                          onFollow={event => {
                            if (!workspacePath) {
                              event.preventDefault();
                            }
                          }}
                        >
                          {item.title || '—'}
                        </Link>
                      </Box>
                      <Box fontSize="body-s" color="text-status-inactive">
                        {item.summary}
                      </Box>
                    </SpaceBetween>
                  );
                }
              },
              { id: 'type', header: 'Type', cell: item => item.type || '—' },
              { id: 'owner', header: 'Owner', cell: item => item.owner || 'Unassigned' },
              { id: 'region', header: 'Region', cell: item => item.region || '—' },
              { id: 'status', header: 'Status', cell: item => item.status || '—' },
              { id: 'dueDate', header: 'Due', cell: item => item.dueDate || '—' }
            ]}
            header={
              <Header
                variant="h3"
                description={
                  selectedBucket
                    ? `${queueItems.length || 0} item(s) in ${selectedBucket.label}`
                    : 'Select a queue from the summary widget.'
                }
              >
                Queue items
              </Header>
            }
            empty={
              <Box variant="p">
                {selectedBucket
                  ? 'No items are available for this bucket yet.'
                  : 'Select a queue to see its items.'}
              </Box>
            }
          />
          <Container
            header={
              <Header
                variant="h3"
                description={selectedItem ? 'Preview and quick actions' : 'Choose an item to see details.'}
              >
                Item details
              </Header>
            }
          >
            {selectedItem ? (
              <SpaceBetween size="s">
                <SpaceBetween size="xxs" direction="horizontal">
                  <Badge>{selectedBucket?.label || 'Queue'}</Badge>
                  <Badge>{selectedItem.type || 'Item'}</Badge>
                </SpaceBetween>
                <Box fontWeight="bold">
                  <Link
                    href={getWorkspacePath(selectedItem) || '#'}
                    onFollow={event => {
                      if (!getWorkspacePath(selectedItem)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    {selectedItem.title || '—'}
                  </Link>
                </Box>
                <Box fontSize="body-s">{selectedItem.summary}</Box>
                <ColumnLayout columns={2} variant="text-grid" minColumnWidth={200}>
                  <div>
                    <Box variant="awsui-key-label">Owner</Box>
                    <Box>{selectedItem.owner || 'Unassigned'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Region</Box>
                    <Box>{selectedItem.region || '—'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Status</Box>
                    <Box>{selectedItem.status || '—'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Due</Box>
                    <Box>{selectedItem.dueDate || '—'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Received</Box>
                    <Box>{selectedItem.submittedAt || '—'}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Applicant</Box>
                    <Box>
                      <Link
                        href={getWorkspacePath(selectedItem) || '#'}
                        onFollow={event => {
                          if (!getWorkspacePath(selectedItem)) {
                            event.preventDefault();
                          }
                        }}
                      >
                        {selectedItem.applicant || '—'}
                      </Link>
                    </Box>
                  </div>
                </ColumnLayout>
                <SpaceBetween size="xs" direction="horizontal">
                  <Button
                    iconName="status-positive"
                    disabled
                    ariaLabel="Mark complete placeholder"
                    title="Placeholder only; wire to approval / resolution flows."
                  >
                    Complete / resolve (placeholder)
                  </Button>
                  <Button
                    variant="primary"
                    iconName="external"
                    href={getWorkspacePath(selectedItem) || '#'}
                    onClick={event => {
                      if (!getWorkspacePath(selectedItem)) {
                        event.preventDefault();
                      }
                    }}
                    disabled={!getWorkspacePath(selectedItem)}
                  >
                    Open workspace
                  </Button>
                </SpaceBetween>
                <Box fontSize="body-s" color="text-status-inactive">
                  Actions are scaffolded; wire these buttons to the application or case workspace once the endpoints are ready.
                </Box>
                <Link href={getWorkspacePath(selectedItem) || '#'} onFollow={event => {
                  if (!getWorkspacePath(selectedItem)) {
                    event.preventDefault();
                  }
                }}>
                  View full record
                </Link>
              </SpaceBetween>
            ) : (
              <Box variant="p">Select an item from the list to see details.</Box>
            )}
          </Container>
        </ColumnLayout>
      </SpaceBetween>
    </BoardItem>
  );
};

export default ProgramAdminWorkQueueWidget;
