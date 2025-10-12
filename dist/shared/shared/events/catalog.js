const EVENT_SCOPE = 'events_capture';

const EVENT_CATEGORIES = [
  {
    id: 'application_lifecycle',
    label: 'Application Lifecycle',
    description: 'Submission, draft, and status changes driven by applicants.',
    severity: 'info',
    types: [
      { id: 'application_created', label: 'Application created', severity: 'success', source: 'portal' },
      { id: 'application_saved_draft', label: 'Draft saved', severity: 'info', source: 'portal' },
      { id: 'application_draft_deleted', label: 'Draft deleted', severity: 'warning', source: 'portal' },
      { id: 'application_submitted', label: 'Application submitted', severity: 'success', source: 'portal' }
    ]
  },
  {
    id: 'case_lifecycle',
    label: 'Case Lifecycle',
    description: 'Assignments and status changes managed by staff.',
    severity: 'info',
    types: [
      { id: 'status_changed', label: 'Status changed', severity: 'info', source: 'admin' },
      { id: 'case_assigned', label: 'Case assigned', severity: 'info', source: 'admin' },
      { id: 'case_reassigned', label: 'Case reassigned', severity: 'info', source: 'admin', draft: true },
    ]
  },
  {
    id: 'assessment',
    label: 'Assessments & Reviews',
    description: 'Coordinator and NWAC assessment milestones.',
    severity: 'info',
    types: [
      { id: 'assessment_submitted', label: 'Assessment submitted', severity: 'success', source: 'admin' },
      { id: 'nwac_review_submitted', label: 'NWAC review submitted', severity: 'info', source: 'admin' }
    ]
  },
  {
    id: 'documents',
    label: 'Documents & Tasks',
    description: 'Document uploads, overdue notices, and follow-ups.',
    severity: 'info',
    types: [
      { id: 'document_uploaded', label: 'Document uploaded', severity: 'success', source: 'portal' },
      { id: 'documents_overdue', label: 'Documents overdue', severity: 'warning', source: 'admin', draft: true },
      { id: 'followup_due', label: 'Follow-up due', severity: 'warning', source: 'admin', draft: true }
    ]
  },
  {
    id: 'messaging',
    label: 'Secure Messaging',
    description: 'Applicant/staff messaging events.',
    severity: 'info',
    types: [
      { id: 'message_sent', label: 'Message sent', severity: 'info', source: 'admin', draft: true },
      { id: 'message_received', label: 'Message received', severity: 'info', source: 'admin', draft: true },
      { id: 'message_deleted', label: 'Message deleted', severity: 'warning', source: 'admin', draft: true }
    ]
  },
  {
    id: 'notes',
    label: 'Case Notes',
    description: 'Internal note creation or updates.',
    severity: 'info',
    types: [
      { id: 'note_added', label: 'Note added', severity: 'info', source: 'admin', draft: true }
    ]
  },
  {
    id: 'system',
    label: 'System Events',
    description: 'Errors and automated system notifications.',
    severity: 'warning',
    types: [
      { id: 'system_error', label: 'System error', severity: 'error', source: 'system' }
    ]
  }
];

const EVENT_TYPE_INDEX = new Map();
for (const category of EVENT_CATEGORIES) {
  for (const type of category.types) {
    EVENT_TYPE_INDEX.set(type.id, { ...type, category: category.id });
  }
}

const DEFAULT_RULES = {};
for (const category of EVENT_CATEGORIES) {
  DEFAULT_RULES[category.id] = {
    enabled: true,
    types: category.types.reduce((acc, type) => {
      acc[type.id] = { enabled: !type.locked, locked: Boolean(type.locked) };
      return acc;
    }, {})
  };
}

function getEventCatalog() {
  return EVENT_CATEGORIES;
}

function getEventType(typeId) {
  return EVENT_TYPE_INDEX.get(typeId) || null;
}

module.exports = {
  EVENT_SCOPE,
  EVENT_CATEGORIES,
  DEFAULT_RULES,
  getEventCatalog,
  getEventType
};

