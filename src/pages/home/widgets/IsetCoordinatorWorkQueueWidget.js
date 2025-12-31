import React, { useMemo } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Box, Button, ButtonDropdown, Cards, Header, Link, SpaceBetween } from '@cloudscape-design/components';
import HomeCoordinatorWorkQueueHelp from '../../../helpPanelContents/homeCoordinatorWorkQueueHelp';

export const ISET_COORDINATOR_BUCKETS = [
  {
    id: 'my-new-applications',
    label: 'My Applications',
    description: 'Applications assigned to you that need action or follow-up.'
  },
  {
    id: 'missing-docs',
    label: 'Missing Docs / Follow-ups Needed',
    description: 'Applications waiting on documents or a response from the applicant.'
  },
  {
    id: 'ei-consent-verification',
    label: 'EI Verification Pending',
    description: 'Applications waiting on EI consent or verification before they can move forward.'
  },
  {
    id: 'file-complete-processing-due',
    label: 'Ready to assess',
    description: 'Assigned applications ready for assessment after EI verification is complete.'
  },
  {
    id: 'approvals-pipeline',
    label: 'Awaiting Approval',
    description: 'Assessments submitted for review and approval.'
  },
  {
    id: 'funding-agreements',
    label: 'Funding Agreements to Complete / Sign',
    description: 'NWAC-approved files where the Client Funding Agreement is still in progress or unsigned.'
  },
  {
    id: 'active-clients-checkins',
    label: 'Active Clients: Check-ins & Milestones Due',
    description: 'Active interventions with check-ins or milestone/start/end dates coming due or overdue.'
  },
  {
    id: 'payments-proof-due',
    label: 'Payments & Proof Due',
    description: 'Payment steps blocked by missing attendance reports or required receipts after advances.'
  },
  {
    id: 'followups-closure',
    label: 'Follow-ups & File Closure Due',
    description: 'Interventions that ended and now need outcomes follow-up and proper closure.'
  },
  {
    id: 'overdue',
    label: 'Overdue',
    description: 'Roll-up of any overdue actions from acknowledgement through processing, check-ins, or proofs.'
  }
];

const ENABLED_BUCKET_IDS = new Set([
  'my-new-applications',
  'missing-docs',
  'ei-consent-verification',
  'file-complete-processing-due',
  'approvals-pipeline',
  'funding-agreements',
  'active-clients-checkins'
]);
const DISABLED_BUCKET_IDS = new Set(
  ISET_COORDINATOR_BUCKETS.map(bucket => bucket.id).filter(id => !ENABLED_BUCKET_IDS.has(id))
);

export const ISET_COORDINATOR_SAMPLE_ITEMS = [
  {
    id: 'APP-3101',
    title: 'APP-3101 · S. Cardinal',
    bucketId: 'my-new-applications',
    type: 'Application',
    applicant: 'S. Cardinal',
    region: 'Prairies',
    owner: 'You',
    status: 'Submitted',
    dueDate: '2025-03-24',
    submittedAt: '2025-03-17',
    summary: 'Assigned application awaiting review.',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'APP-2980',
    title: 'APP-2980 · T. Antoine',
    bucketId: 'missing-docs',
    type: 'Application',
    applicant: 'T. Antoine',
    region: 'Atlantic',
    owner: 'You',
    status: 'Docs requested',
    dueDate: '2025-03-19',
    submittedAt: '2025-03-05',
    summary: 'Consent and band letter outstanding; 2 follow-ups sent.',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'APP-2955',
    title: 'APP-2955 · J. Morrison',
    bucketId: 'ei-consent-verification',
    type: 'Application',
    applicant: 'J. Morrison',
    region: 'North',
    owner: 'You',
    status: 'Awaiting EI verification',
    dueDate: '2025-03-18',
    submittedAt: '2025-03-04',
    summary: 'Signed EI consent missing; cannot submit EI request.',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'APP-2877',
    title: 'APP-2877 · K. Whitehorse',
    bucketId: 'file-complete-processing-due',
    type: 'Application',
    applicant: 'K. Whitehorse',
    region: 'Yukon',
    owner: 'You',
    status: 'In review',
    dueDate: '2025-03-28',
    submittedAt: '2025-02-28',
    summary: 'EI verification complete; ready for assessment.',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'APP-2803',
    title: 'APP-2803 · L. Stonechild',
    bucketId: 'approvals-pipeline',
    type: 'Application',
    applicant: 'L. Stonechild',
    region: 'Central',
    owner: 'You',
    status: 'Pending approval',
    dueDate: '2025-03-21',
    submittedAt: '2025-02-24',
    summary: 'Assessment submitted and awaiting approval decision.',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'INT-441',
    title: 'INT-441 · Welding diploma',
    bucketId: 'funding-agreements',
    type: 'Intervention',
    applicant: 'P. Wabano',
    region: 'Quebec',
    owner: 'You',
    status: 'Awaiting client signature',
    dueDate: '2025-03-25',
    submittedAt: '2025-02-26',
    summary: 'Funding agreement drafted; client signature pending.',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'INT-430',
    title: 'INT-430 · Training follow-up',
    bucketId: 'active-clients-checkins',
    type: 'InterventionMilestone',
    applicant: 'M. Petahtegoose',
    region: 'Ontario',
    owner: 'You',
    status: 'In progress',
    dueDate: '2025-03-20',
    submittedAt: '2025-02-10',
    summary: 'Monthly check-in due; milestone start next week.',
    intervention_label: 'Training follow-up',
    milestoneLabel: 'Start due in 6 days',
    milestoneStatus: 'severity-low',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'PAY-122',
    title: 'PAY-122 · Attendance report',
    bucketId: 'payments-proof-due',
    type: 'Payment',
    applicant: 'R. Fox',
    region: 'BC',
    owner: 'You',
    status: 'Awaiting attendance report',
    dueDate: '2025-03-18',
    submittedAt: '2025-03-01',
    summary: 'Living allowance blocked; attendance report outstanding.',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'INT-399',
    title: 'INT-399 · Follow-up & closure',
    bucketId: 'followups-closure',
    type: 'Intervention',
    applicant: 'C. Blackwater',
    region: 'Alberta',
    owner: 'You',
    status: 'Follow-up pending',
    dueDate: '2025-03-22',
    submittedAt: '2025-01-15',
    summary: 'Intervention ended; outcomes follow-up due.',
    workspacePath: '/case-assignment-dashboard'
  },
  {
    id: 'OVR-901',
    title: 'OVR-901 · SLA triage',
    bucketId: 'overdue',
    type: 'Application',
    applicant: 'T. Yellowbird',
    region: 'Prairies',
    owner: 'You',
    status: 'Overdue',
    dueDate: '2025-03-12',
    submittedAt: '2025-02-14',
    summary: 'Acknowledgement SLA breached; applicant awaiting contact.',
    workspacePath: '/case-assignment-dashboard'
  }
];

const boardItemI18n = {
  dragHandleAriaLabel: 'Drag handle',
  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
  resizeHandleAriaLabel: 'Resize handle',
  resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
};

const settingsDropdown = actions =>
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

const IsetCoordinatorWorkQueueWidget = ({
  selectedBucketId,
  onSelectBucket,
  countsByBucket = {},
  items = [],
  actions,
  onRefresh,
  toggleHelpPanel
}) => {
  const bucketCounts = useMemo(() => {
    return ISET_COORDINATOR_BUCKETS.map(bucket => {
      const override = countsByBucket[bucket.id];
      const parsed = Number(override);
      const derivedCount = items.filter(item => item.bucketId === bucket.id).length;
      const isDisabled = DISABLED_BUCKET_IDS.has(bucket.id);
      return {
        ...bucket,
        count: isDisabled ? '-' : (Number.isFinite(parsed) ? parsed : derivedCount)
      };
    });
  }, [countsByBucket, items]);

  const selectedBucket =
    bucketCounts.find(bucket => bucket.id === selectedBucketId) || bucketCounts[0] || null;
  const infoLink = toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(
          <HomeCoordinatorWorkQueueHelp />,
          'Work Queue (ISET Coordinator)',
          HomeCoordinatorWorkQueueHelp.aiContext || ''
        );
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
          description="Select a work queue to view the assigned items."
          actions={
            typeof onRefresh === 'function'
              ? (
                <Button iconName="refresh" onClick={() => onRefresh()}>
                  Refresh
                </Button>
              )
              : undefined
          }
        >
          Work Queue (ISET Coordinator)
        </Header>
      }
      settings={settingsDropdown(actions)}
      i18nStrings={boardItemI18n}
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
            if (next?.id && !DISABLED_BUCKET_IDS.has(next.id) && typeof onSelectBucket === 'function') {
              onSelectBucket(next.id);
            }
          }}
          empty={<Box variant="p">No queues available for this role.</Box>}
        />
        <Box fontSize="body-s" color="text-status-inactive">
          Additional queues will be enabled as their feeds are wired.
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
};

export default IsetCoordinatorWorkQueueWidget;
