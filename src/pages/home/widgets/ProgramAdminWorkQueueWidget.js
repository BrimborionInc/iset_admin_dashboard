import React, { useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Badge,
  Box,
  Button,
  ButtonDropdown,
  Cards,
  CollectionPreferences,
  ColumnLayout,
  Container,
  Header,
  Hotspot,
  Link,
  SpaceBetween,
  Table
} from '@cloudscape-design/components';
import HomeWorkQueueHelp from '../../../helpPanelContents/homeWorkQueueHelp';
import { preserveWorkQueueApplicationScope } from '../workQueueWorkspacePath';

export const PROGRAM_ADMIN_BUCKETS = [
  {
    id: 'new-applications',
    label: 'New Applications',
    description: 'Submitted applications not yet in active assessment.'
  },
  {
    id: 'pending-assessment',
    label: 'Pending Assessment',
    description: 'Assigned applications still waiting for EI status verification before assessment can begin.'
  },
  {
    id: 'in-assessment',
    label: 'In Assessment',
    description: 'Applications currently being assessed, excluding files that have been intentionally parked.'
  },
  {
    id: 'on-hold',
    label: 'On Hold',
    description: 'Parked applications waiting on an external answer, future start timing, applicant pause, or internal follow-up.'
  },
  {
    id: 'pending-decision',
    label: 'Pending Decision',
    description: 'Application assessments plus new and revised intervention proposals waiting for a decision.'
  },
  {
    id: 'pending-completion',
    label: 'Pending Completion',
    description: 'Post-decision application and intervention proposal work still waiting on letters, documents, signatures, or final completion.'
  },
  {
    id: 'unresolved-conflicts',
    label: 'Unresolved Conflicts',
    description: 'Conflicts of interest declarations that need resolution or reassignment.'
  },
  {
    id: 'exceptions-escalations',
    label: 'Exceptions & Escalations',
    description: 'Applications escalated for your attention.'
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
    id: 'overdue',
    label: 'Overdue',
    description: 'Past-target files and overdue actions.'
  }
];

export const PROGRAM_ADMIN_SAMPLE_ITEMS = [
  {
    id: 'APP-2045',
    title: 'APP-2045 · Northern Trades Training Society',
    bucketId: 'new-applications',
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
    bucketId: 'pending-assessment',
    type: 'Application',
    applicant: 'Coastal Welding Program',
    region: 'Vancouver Island',
    owner: 's.chao@nwac.ca',
    status: 'Submitted',
    dueDate: '2025-02-26',
    submittedAt: '2025-02-10',
    summary: 'Assigned and waiting for EI verification before assessment can begin.'
  },
  {
    id: 'APP-1932',
    title: 'APP-1932 · Prairie Pathfinders',
    bucketId: 'in-assessment',
    type: 'Application',
    applicant: 'Prairie Pathfinders',
    region: 'Central',
    owner: 'ei.desk@nwac.ca',
    status: 'In Review',
    dueDate: '2025-02-19',
    submittedAt: '2025-02-08',
    summary: 'Assessment has started and is waiting on supporting evidence from the applicant.'
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
    bucketId: 'pending-decision',
    type: 'AwaitingApproval',
    applicant: 'Apprenticeship Accelerator',
    region: 'Fraser',
    owner: 'T. Firth',
    status: 'Pending Decision',
    dueDate: '2025-02-18',
    submittedAt: '2025-02-04',
    summary: 'Assessment complete; pending application decision.',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'INT-118',
    title: 'Intervention · Welding simulator upgrade',
    bucketId: 'pending-decision',
    type: 'InterventionApproval',
    applicant: 'Coastal Welding Program',
    region: 'Vancouver Island',
    owner: 'S. Chao',
    status: 'Submitted',
    dueDate: '2025-02-22',
    submittedAt: '2025-02-06',
    summary: 'Intervention proposal is ready for decision.',
    workspacePath: '/iset/cases'
  },
  {
    id: 'APP-2006',
    title: 'APP-2006 · Aurora Skills Partnership',
    bucketId: 'pending-completion',
    type: 'Application',
    applicant: 'Aurora Skills Partnership',
    region: 'North',
    owner: 'mcoppola@nwac.ca',
    status: 'Approved',
    dueDate: null,
    submittedAt: '2025-02-03',
    summary: 'Approved file still needs post-decision completion work.',
    workspacePath: '/case-assignment-dashboard'
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
  }
];

const DISABLED_BUCKET_IDS = new Set([
  'payments-issues'
]);

const BUCKET_PREFERENCES_STORAGE_KEY_PREFIX = 'home-work-queue-preferences-v5';

const normalizeRoleKey = role => {
  const raw = String(role || '').trim().toLowerCase();
  if (!raw) return 'unknown';
  if (raw === 'regional manager') return 'regional manager';
  if (raw === 'program admin') return 'nwac administrator';
  return raw;
};

const buildBucketStorageKey = role => (
  `${BUCKET_PREFERENCES_STORAGE_KEY_PREFIX}.${normalizeRoleKey(role)}`
);

const sanitizeVisibleContent = (candidate, allowedIds) => {
  const asArray = Array.isArray(candidate) ? candidate : [];
  const allowed = new Set(Array.isArray(allowedIds) ? allowedIds : []);
  const deduped = [];
  const seen = new Set();
  asArray.forEach(value => {
    const rawId = typeof value === 'string' ? value : null;
    const id =
      rawId === 'applications-awaiting-approval' ||
      rawId === 'interventions-awaiting-approval' ||
      rawId === 'approvals'
        ? 'pending-decision'
        : rawId === 'pending-decision' && allowed.has('pending-review') && !allowed.has('pending-decision')
          ? 'pending-review'
        : rawId;
    if (!id || !allowed.has(id) || seen.has(id)) return;
    seen.add(id);
    deduped.push(id);
  });
  return deduped;
};

const loadStoredBucketPreferences = ({ storageKey, defaultVisibleIds }) => {
  const fallback = { visibleContent: defaultVisibleIds };
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const candidate = Array.isArray(parsed?.visibleContent)
      ? parsed.visibleContent
      : Array.isArray(parsed?.visibleBucketIds)
        ? parsed.visibleBucketIds
        : Array.isArray(parsed)
          ? parsed
          : null;
    const visibleContent = sanitizeVisibleContent(candidate, defaultVisibleIds);
    return { visibleContent: visibleContent.length ? visibleContent : defaultVisibleIds };
  } catch {
    return fallback;
  }
};

const storeBucketPreferences = ({ storageKey, visibleContent }) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        visibleContent: Array.isArray(visibleContent) ? visibleContent : []
      })
    );
  } catch {
    // ignore storage errors
  }
};

export const getWorkspacePath = item => {
  const caseId = item?.case_id || item?.caseId || null;
  if (item?.workspacePath) {
    return preserveWorkQueueApplicationScope(item.workspacePath, item);
  }
  if (!caseId) return null;
  const type = (item?.type || '').toString().trim().toLowerCase();
  if (type.includes('intervention') || type.includes('case')) {
    return preserveWorkQueueApplicationScope(`/cases/${caseId}`, item);
  }
  return preserveWorkQueueApplicationScope(`/application-case/${caseId}`, item);
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
  role,
  actions,
  toggleHelpPanel
}) => {
  const defaultVisibleBucketIds = useMemo(
    () => bucketDefinitions.map(bucket => bucket.id),
    [bucketDefinitions]
  );
  const storageKey = useMemo(() => buildBucketStorageKey(role), [role]);
  const [bucketPreferences, setBucketPreferences] = useState(() =>
    loadStoredBucketPreferences({
      storageKey,
      defaultVisibleIds: defaultVisibleBucketIds
    })
  );
  const visibleBucketIds = bucketPreferences?.visibleContent || defaultVisibleBucketIds;
  const visibleBucketIdSet = useMemo(() => new Set(visibleBucketIds), [visibleBucketIds]);

  useEffect(() => {
    const loaded = loadStoredBucketPreferences({
      storageKey,
      defaultVisibleIds: defaultVisibleBucketIds
    });
    setBucketPreferences(loaded);
  }, [storageKey, defaultVisibleBucketIds]);

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

  const visibleBucketCounts = useMemo(
    () => bucketCounts.filter(bucket => visibleBucketIdSet.has(bucket.id)),
    [bucketCounts, visibleBucketIdSet]
  );

  const firstSelectableBucketId = useMemo(() => {
    const first = visibleBucketCounts.find(bucket => !DISABLED_BUCKET_IDS.has(bucket.id));
    return first?.id || null;
  }, [visibleBucketCounts]);

  useEffect(() => {
    if (typeof onSelectBucket !== 'function') return;
    if (!firstSelectableBucketId) return;
    if (selectedBucketId && visibleBucketIdSet.has(selectedBucketId) && !DISABLED_BUCKET_IDS.has(selectedBucketId)) {
      return;
    }
    onSelectBucket(firstSelectableBucketId);
  }, [firstSelectableBucketId, onSelectBucket, selectedBucketId, visibleBucketIdSet]);

  const selectedBucket =
    visibleBucketCounts.find(bucket => bucket.id === selectedBucketId) || visibleBucketCounts[0] || null;
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
            <SpaceBetween direction="horizontal" size="xs">
              <CollectionPreferences
                title="Work queue preferences"
                confirmLabel="Confirm"
                cancelLabel="Cancel"
                preferences={bucketPreferences}
                contentBefore={
                  <Box variant="p" margin={{ bottom: 's' }}>
                    Choose which queues appear in this widget. Preferences are saved in this browser.
                  </Box>
                }
                onConfirm={({ detail }) => {
                  const nextVisible = sanitizeVisibleContent(detail?.visibleContent, defaultVisibleBucketIds);
                  const visibleContent = nextVisible.length ? nextVisible : defaultVisibleBucketIds;
                  const nextPreferences = { visibleContent };
                  setBucketPreferences(nextPreferences);
                  storeBucketPreferences({ storageKey, visibleContent });
                }}
                visibleContentPreference={{
                  title: 'Select visible queues',
                  options: [
                    {
                      label: 'Buckets',
                      options: bucketDefinitions.map(bucket => ({
                        id: bucket.id,
                        label: bucket.label
                      }))
                    }
                  ]
                }}
              />
            </SpaceBetween>
          }
        >
          <Hotspot hotspotId="home-program-work-queue" direction="right" />
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
          items={visibleBucketCounts}
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
                  ? 'No items are available for this queue yet.'
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
