const BLANK_SORT_STRINGS = new Set(['', '-', '\u2014']);

export const toSortTimestamp = value => {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
};

const normalizeSortText = value => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

const normalizeComparableValue = value => {
  if (value instanceof Date) {
    return toSortTimestamp(value);
  }
  return value;
};

const isBlankSortValue = value => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return !Number.isFinite(value);
  const text = normalizeSortText(value);
  return BLANK_SORT_STRINGS.has(text);
};

const toNumber = value => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/[$,\s]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const getDateSortValue = (...values) => {
  for (const value of values) {
    const timestamp = toSortTimestamp(value);
    if (timestamp !== null) return timestamp;
  }
  return null;
};

export const getWorkQueueSortValue = (item, columnId, options = {}) => {
  if (!item) return null;

  switch (columnId) {
    case 'watch':
      return item.__isWatched ? 1 : 0;
    case 'title':
      return normalizeSortText(item.applicant || item.applicant_name || item.applicantName || item.title || item.id);
    case 'recommendation':
      return normalizeSortText(item.recommendation);
    case 'intervention':
      return normalizeSortText(item.intervention_label || item.interventionLabel || item.intervention_code || item.interventionCode);
    case 'cost':
      return toNumber(item.intervention_cost_total ?? item.interventionCostTotal);
    case 'startDate':
      return getDateSortValue(item.intervention_start_date, item.interventionStartDate);
    case 'type':
      return normalizeSortText(item.type);
    case 'eiStatus':
      return normalizeSortText(item.assessment_esdc_eligibility || 'Not yet verified');
    case 'metricSubject':
      return normalizeSortText(item.metricSubject || item.summary);
    case 'eventDate':
      return getDateSortValue(item.metricEventDate, item.eventDate);
    case 'notes':
      return normalizeSortText(
        Array.isArray(item.notes_list)
          ? item.notes_list.filter(Boolean).join(' ')
          : item.notes
      );
    case 'sin':
      return normalizeSortText(item.sin ? String(item.sin).replace(/\s+/g, '') : '');
    case 'region':
      return normalizeSortText(
        typeof options.resolveProvinceCode === 'function'
          ? options.resolveProvinceCode(item.address_province || item.region || '')
          : item.address_province || item.region
      );
    case 'owner':
      return normalizeSortText(item.owner || 'Unassigned');
    case 'status':
      return normalizeSortText(
        typeof options.resolveStatusLabel === 'function'
          ? options.resolveStatusLabel(item)
          : item.status || item.application_status || item.case_status
      );
    case 'staff':
      return normalizeSortText(item.staffEmail || item.owner);
    case 'role':
      return normalizeSortText(
        typeof options.formatRoleDisplay === 'function'
          ? options.formatRoleDisplay(item.staffRole)
          : item.staffRole
      );
    case 'details':
      return normalizeSortText(item.details || item.summary);
    case 'signedAt':
      return getDateSortValue(item.signedAt, item.submittedAt);
    case 'dueDate':
      if (typeof options.resolveDueDateSortValue === 'function') {
        return options.resolveDueDateSortValue(item);
      }
      return getDateSortValue(item.dueDate, item.sla_due_at, item.nextActionDueAt, item.next_action_due_at);
    case 'approvalQueuedAt':
      if (typeof options.resolveApprovalTimelineSortValue === 'function') {
        return options.resolveApprovalTimelineSortValue(item);
      }
      return getDateSortValue(item.approvalQueuedAt, item.approval_queued_at, item.submittedAt, item.receivedAt);
    default:
      return item[columnId];
  }
};

export const compareWorkQueueItems = (left, right, columnId, options = {}) => {
  const leftValue = normalizeComparableValue(getWorkQueueSortValue(left, columnId, options));
  const rightValue = normalizeComparableValue(getWorkQueueSortValue(right, columnId, options));
  const leftBlank = isBlankSortValue(leftValue);
  const rightBlank = isBlankSortValue(rightValue);

  if (leftBlank && rightBlank) return 0;
  if (leftBlank) return 1;
  if (rightBlank) return -1;

  let result;
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    result = leftValue - rightValue;
  } else {
    result = String(leftValue).localeCompare(String(rightValue), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  return options.isDescending ? -result : result;
};

export const sortWorkQueueItems = (items, columnId, options = {}) => {
  if (!columnId || !Array.isArray(items)) return items;
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const result = compareWorkQueueItems(left.item, right.item, columnId, options);
      return result || left.index - right.index;
    })
    .map(entry => entry.item);
};

export const isSortableWorkQueueColumn = column =>
  Boolean(column?.id && column.id !== 'actions' && (column.sortingField || column.sortingComparator));
