// Central source of development tasks metadata.
// This module can be used by the UI and migration tooling.

export const devTasks = [
  {
    id: 't1',
    category: 'Landing Page',
    label: 'Real data sources for My Work',
    status: 'planned',
    link: '/docs/landing-page-data-plan',
    notes: 'Replace mock counts with API-backed metrics for assigned, awaiting review, overdue.',
    nextSteps: [
      'Design lightweight metrics endpoint contract',
      'Implement backend aggregation query',
      'Wire front-end fetch with loading states'
    ]
  },
  {
    id: 't2',
    category: 'Landing Page',
    label: 'Personalized quick actions (pinning)',
    status: 'planned',
    link: '/docs/landing-page-pinning',
    notes: 'Allow users to pin preferred actions and reorder.',
    nextSteps: [
      'Add user_prefs table migration',
      'Create pin/unpin API',
      'Persist drag ordering'
    ]
  },
  {
    id: 't3',
    category: 'Auth',
    label: 'Impersonation banner for simulated roles',
    status: 'in-progress',
    link: '/docs/auth-impersonation',
    notes: 'Visual indicator when acting under simulated role or IAM bypass for safety.',
    nextSteps: [
      'Add global banner component',
      'Emit event on role simulation toggle',
      'Unit test signed-out simulation edge cases'
    ]
  },
  {
    id: 't4',
    category: 'Observability',
    label: 'Background job health endpoint',
    status: 'planned',
    link: '/docs/observability-jobs',
    notes: 'Expose cron / queue worker liveness & last run info.',
    nextSteps: [
      'Add /api/health/jobs endpoint',
      'Collect last success/fail timestamps',
      'Dashboard widget consumption'
    ]
  },
  {
    id: 't5',
    category: 'Notifications',
    label: 'Replace Alerts mock with API feed',
    status: 'planned',
    link: '/docs/alerts-feed',
    notes: 'Move static alerts to dynamic feed with read/unread state.',
    nextSteps: [
      'Design alerts table schema',
      'Implement list & mark-read endpoints',
      'Real-time push (long-poll or websocket later)'
    ]
  },
  {
    id: 't6',
    category: 'Security',
    label: 'Audit log surfacing widget',
    status: 'planned',
    link: '/docs/audit-log-widget',
    notes: 'Surface key audit events (config change, publish, impersonation).',
    nextSteps: [
      'Define event types & severity',
      'Implement secure paginated endpoint',
      'Add filtering UI'
    ]
  },
  {
    id: 't7',
    category: 'Conditional Visibility',
    label: 'Complete file-upload conditional rules',
    status: 'planned',
    link: '/docs/file-upload-conditional-rules',
    notes: 'Expand boolean logic (all/any/none/not) and add isNull/isNotNull operators.',
    nextSteps: [
      'Implement shared evaluator utility',
      'Refactor DynamicTest & WorkflowPreviewWidget to use it',
      'Add unit tests for nested logic & backward compatibility'
    ]
  },
  {
    id: 't8',
    category: 'Component Library',
    label: 'Signature acknowledgment component',
    status: 'planned',
    link: '/docs/signature-ack-component',
    notes: 'Add bespoke signature-ack component with name entry, Sign Now -> handwriting font lock, ability to clear. Stores boolean (signed) plus captured name for audit.',
    nextSteps: [
      'Define schema additions (componentType signature-ack, configurable labels)',
      'Implement renderer in portal',
      'Implement admin step editor preview & WorkflowPreviewWidget support',
      'Persist { signed: true, name } or equivalent normalized shape',
      'Add validation (require non-empty name before sign)'
    ]
  }
  ,
  {
    id: 't9',
    category: 'Component Library',
    label: 'Custom component macro/registry infrastructure',
    status: 'backlog',
    link: '/docs/custom-component-infra',
    notes: 'Introduce server-side Nunjucks macro directory + render registry to eliminate fragile client DOM surgery for non-GOV.UK components (starting with signature-ack).',
    nextSteps: [
      'Add local Nunjucks search path (e.g., src/server-macros)',
      'Create signature-ack.njk macro with final layout markup',
      'Implement registry: type -> { macro: name | customRenderer }',
      'Integrate /api/preview/step to consult registry before DB template',
      'Remove iframe DOM transformation once macro parity confirmed',
      'Document pattern & migration in project map'
    ]
  }
];
