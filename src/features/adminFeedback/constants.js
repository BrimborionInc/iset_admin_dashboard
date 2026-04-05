export const REPORT_TYPE_OPTIONS = [
  { label: 'Bug report', value: 'bug' },
  { label: 'Change request', value: 'change_request' },
];

export const REPORT_TYPE_FILTER_OPTIONS = [
  { label: 'All types', value: 'all' },
  ...REPORT_TYPE_OPTIONS,
];

export const SEVERITY_OPTIONS = [
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

export const STATUS_OPTIONS = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'Triaging', value: 'triaging' },
  { label: 'Planned', value: 'planned' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

export const STATUS_FILTER_OPTIONS = [
  { label: 'Open reports', value: 'open' },
  { label: 'All statuses', value: 'all' },
  ...STATUS_OPTIONS,
];

export const ACCEPTED_FILE_TYPES = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
];

export const MAX_ATTACHMENTS = 5;
export const MAX_SUMMARY_CHARS = 160;
export const MAX_DESCRIPTION_CHARS = 4000;
export const MAX_INTERNAL_NOTE_CHARS = 4000;

export function normalizeRequestedType(value) {
  return REPORT_TYPE_OPTIONS.some(option => option.value === value) ? value : 'bug';
}

export function normalizeSeverity(value) {
  return SEVERITY_OPTIONS.some(option => option.value === value) ? value : 'medium';
}

export function normalizeFeedbackStatus(value, fallback = 'submitted') {
  return STATUS_OPTIONS.some(option => option.value === value) ? value : fallback;
}

export function getReportTypeLabel(value) {
  return REPORT_TYPE_OPTIONS.find(item => item.value === value)?.label || 'Report';
}

export function getSeverityLabel(value) {
  return SEVERITY_OPTIONS.find(item => item.value === value)?.label || 'Medium';
}

export function getStatusLabel(value) {
  if (value === 'open') return 'Open reports';
  if (value === 'all') return 'All statuses';
  return STATUS_OPTIONS.find(item => item.value === value)?.label || 'Submitted';
}

export function getStatusIndicatorType(status) {
  switch (status) {
    case 'resolved':
      return 'success';
    case 'closed':
      return 'stopped';
    case 'triaging':
    case 'planned':
      return 'warning';
    case 'in_progress':
      return 'in-progress';
    case 'submitted':
    default:
      return 'info';
  }
}

export function formatFeedbackTimestamp(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-CA');
}

export function formatFeedbackRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export function formatFeedbackFileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
