const { randomUUID } = require('crypto');
const { getEventType } = require('./catalog');
const { loadEventCaptureState } = require('./service');

const MAX_MEMORY_EVENTS = 200;
const memoryEvents = [];
const memoryReceipts = new Map();

const CAPTURE_CACHE_TTL_MS = 5000;
let captureCache = { ts: 0, data: null, promise: null };

let pool = null;
let notificationHook = null;

class EventValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'EventValidationError';
    this.code = 'EVENT_VALIDATION_FAILED';
    this.details = details;
  }
}

function registerEventStorePool(dbPool) {
  pool = dbPool;
}

function ensurePool() {
  if (!pool) {
    throw new Error('event store pool has not been registered');
  }
}

function registerNotificationHook(hook) {
  if (hook && typeof hook === 'function') {
    notificationHook = hook;
  } else {
    notificationHook = null;
  }
}

async function loadCaptureStateCached() {
  ensurePool();
  const now = Date.now();
  if (captureCache.data && (now - captureCache.ts) < CAPTURE_CACHE_TTL_MS) {
    return captureCache.data;
  }
  if (captureCache.promise) {
    return captureCache.promise;
  }
  const loadPromise = loadEventCaptureState(pool)
    .then(state => {
      captureCache = { data: state, ts: Date.now(), promise: null };
      return state;
    })
    .catch(err => {
      captureCache.promise = null;
      throw err;
    });
  captureCache.promise = loadPromise;
  return loadPromise;
}

function shouldBypassCaptureRules(catalogType) {
  if (!catalogType) return false;
  if (catalogType.locked) return true;
  return false;
}

async function isCaptureEnabled(categoryId, typeId, catalogType) {
  if (shouldBypassCaptureRules(catalogType)) {
    return true;
  }
  try {
    const state = await loadCaptureStateCached();
    const categories = Array.isArray(state?.categories) ? state.categories : [];
    if (!categories.length) {
      return true;
    }
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) {
      return true;
    }
    if (category.locked) {
      return true;
    }
    if (category.enabled === false) {
      return false;
    }
    const types = Array.isArray(category.types) ? category.types : [];
    if (!types.length) {
      return true;
    }
    const typeEntry = types.find(item => item.id === typeId);
    if (!typeEntry) {
      return true;
    }
    if (typeEntry.locked) {
      return true;
    }
    return typeEntry.enabled !== false;
  } catch (err) {
    console.warn('[events] capture rule lookup failed; defaulting to enabled', err?.message || err);
    return true;
  }
}

function invalidateCaptureCache() {
  captureCache = { ts: 0, data: null, promise: null };
}

function isMissingTableError(err) {
  if (!err) return false;
  if (err.code === 'ER_NO_SUCH_TABLE') return true;
  const message = err && typeof err.message === 'string' ? err.message : '';
  return /no such table/i.test(message) || /does not exist/i.test(message) || /doesn't exist/i.test(message);
}

function storeMemoryEvent(event) {
  if (!event) return null;
  for (let i = memoryEvents.length - 1; i >= 0; i -= 1) {
    if (memoryEvents[i] && memoryEvents[i].id === event.id) {
      memoryEvents.splice(i, 1);
    }
  }
  memoryEvents.push(event);
  if (memoryEvents.length > MAX_MEMORY_EVENTS) {
    memoryEvents.shift();
  }
  return event;
}

function seedPlaceholderEvents(defaultCaseId) {
  const fallbackCaseId = defaultCaseId != null ? String(defaultCaseId) : '1000';
  const hasEventsForCase = memoryEvents.some(event => event.subject_type === 'case' && String(event.subject_id) === fallbackCaseId);
  if (hasEventsForCase) return;
  const fallbackTracking = fallbackCaseId ? `CASE-${fallbackCaseId}` : 'CASE-1000';
  const now = Date.now();
  const definitions = [
    {
      suffix: 'status',
      type: 'status_changed',
      category: 'case_lifecycle',
      severity: 'info',
      source: 'admin',
      minutesAgo: 180,
      payload: { from: 'Submitted', to: 'In Review', tracking_id: fallbackTracking, message: 'Status moved from Submitted to In Review.' },
    },
    {
      suffix: 'assessment',
      type: 'assessment_submitted',
      category: 'assessment',
      severity: 'success',
      source: 'admin',
      minutesAgo: 90,
      payload: { evaluator_name: 'Coordinator Placeholder', tracking_id: fallbackTracking, message: 'Assessment submitted by Coordinator Placeholder.' },
    },
    {
      suffix: 'document',
      type: 'document_uploaded',
      category: 'documents',
      severity: 'success',
      source: 'portal',
      minutesAgo: 30,
      payload: { file_name: 'business-plan.pdf', tracking_id: fallbackTracking, message: 'Applicant uploaded business-plan.pdf.' },
    },
  ];

  for (const def of definitions) {
    const capturedAt = new Date(now - def.minutesAgo * 60000);
    const baseRow = {
      id: `placeholder-${fallbackCaseId}-${def.suffix}`,
      category: def.category,
      event_type: def.type,
      severity: def.severity,
      source: def.source,
      subject_type: 'case',
      subject_id: fallbackCaseId,
      actor_type: def.source === 'portal' ? 'applicant' : 'staff',
      actor_id: null,
      actor_display_name: def.source === 'portal' ? 'Applicant' : 'Placeholder Bot',
      payload_json: JSON.stringify(def.payload),
      tracking_id: fallbackTracking,
      correlation_id: null,
      captured_by: null,
      captured_at: capturedAt,
      read_at: null,
    };
    storeMemoryEvent(mapRow(baseRow));
  }
}

function getMemoryEvents({ caseId, limit, offset, recipientId, categories = [], types = [], since, until }) {
  if (memoryEvents.length === 0) {
    seedPlaceholderEvents(caseId);
  }
  const subjectKey = caseId == null ? null : String(caseId);
  let results = memoryEvents.filter(event => {
    if (subjectKey == null) return true;
    if (event.subject_type !== 'case') return false;
    return String(event.subject_id) === subjectKey;
  });
  results = applyMemoryFilters(results, {
    categories,
    types,
    sinceDate: since,
    untilDate: until,
    subjectTypes: ['case'],
    subjectId: subjectKey,
  });
  results = [...results].sort(compareEventsByCreatedAtDesc);
  if (offset) results = results.slice(offset);
  if (limit) results = results.slice(0, limit);
  return results.map(event => applyMemoryReadState(event, recipientId));
}

function getMemoryFeed({ limit, offset, recipientId, categories = [], types = [], since, until, subjectType, subjectId }) {
  if (memoryEvents.length === 0) {
    seedPlaceholderEvents(subjectId);
  }
  const subjectTypeList = normalizeFilterList(subjectType);
  const appliedSubjectTypes = subjectTypeList.length ? subjectTypeList : ['case'];
  const subjectIdValue = typeof subjectId === 'undefined' || subjectId === null ? null : String(subjectId);

  let results = [...memoryEvents];
  results = applyMemoryFilters(results, {
    categories,
    types,
    sinceDate: since,
    untilDate: until,
    subjectTypes: appliedSubjectTypes,
    subjectId: subjectIdValue,
  });
  results = results.sort(compareEventsByCreatedAtDesc);
  if (offset) results = results.slice(offset);
  if (limit) results = results.slice(0, limit);
  return results.map(event => applyMemoryReadState(event, recipientId));
}

function applyMemoryReadState(event, recipientId) {
  const clone = { ...event };
  if (!recipientId) {
    clone.is_read = 0;
    return clone;
  }
  const receipts = memoryReceipts.get(event.id);
  const isRead = receipts ? receipts.has(String(recipientId)) : false;
  clone.is_read = isRead ? 1 : 0;
  return clone;
}

function compareEventsByCreatedAtDesc(a, b) {
  const aTime = new Date(a.created_at).getTime();
  const bTime = new Date(b.created_at).getTime();
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) {
    return 0;
  }
  return bTime - aTime;
}

function assertKnownEventType(type, catalogType) {
  if (!catalogType) {
    throw new EventValidationError(`Unknown event type: ${type}`, { type });
  }
}

function assertValidSubject(subject, type) {
  if (!subject) {
    throw new EventValidationError('Event subject is required', { type });
  }
  if (subject.type === 'case') {
    const id = subject.id;
    if (id === null || typeof id === 'undefined' || String(id).trim() === '') {
      throw new EventValidationError('Case events require a subject id', { type });
    }
  }
}

function ensurePayloadObject(payload, type) {
  if (payload === null || typeof payload === 'undefined') {
    return {};
  }
  if (typeof payload !== 'object') {
    throw new EventValidationError('Event payload must be an object', { type });
  }
  return payload;
}

function normalizeFilterList(value) {
  if (typeof value === 'undefined' || value === null) return [];
  const raw = Array.isArray(value) ? value : [value];
  const tokens = [];
  for (const item of raw) {
    if (item === null || typeof item === 'undefined') continue;
    const str = String(item);
    const pieces = str.split(',');
    for (const piece of pieces) {
      const trimmed = piece.trim();
      if (trimmed) tokens.push(trimmed);
    }
  }
  return tokens;
}

function normalizeDateBound(value) {
  if (typeof value === 'undefined' || value === null || value === '') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = normalizeDateBound(item);
      if (candidate) return candidate;
    }
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function applyMemoryFilters(events, { categories = [], types = [], sinceDate = null, untilDate = null, subjectTypes = [], subjectId = null }) {
  const categorySet = categories.length ? new Set(categories.map(item => String(item))) : null;
  const typeSet = types.length ? new Set(types.map(item => String(item))) : null;
  const subjectTypeSet = subjectTypes.length ? new Set(subjectTypes.map(item => String(item))) : null;
  const subjectIdValue = subjectId != null ? String(subjectId) : null;
  const sinceMs = sinceDate ? new Date(sinceDate).getTime() : NaN;
  const untilMs = untilDate ? new Date(untilDate).getTime() : NaN;
  const sinceBound = Number.isNaN(sinceMs) ? null : sinceMs;
  const untilBound = Number.isNaN(untilMs) ? null : untilMs;

  return events.filter(event => {
    if (subjectTypeSet && !subjectTypeSet.has(event.subject_type)) return false;
    if (subjectIdValue !== null && String(event.subject_id) !== subjectIdValue) return false;
    if (categorySet && !categorySet.has(event.category)) return false;
    if (typeSet && !typeSet.has(event.event_type)) return false;
    const createdMs = new Date(event.created_at).getTime();
    if (sinceBound !== null && (Number.isNaN(createdMs) || createdMs < sinceBound)) return false;
    if (untilBound !== null && (Number.isNaN(createdMs) || createdMs > untilBound)) return false;
    return true;
  });
}

async function emitEvent({
  type,
  category: explicitCategory = null,
  subject,
  actor,
  payload,
  trackingId,
  correlationId,
  createdAt,
  capturedBy,
}) {
  ensurePool();
  if (!type) {
    throw new Error('Event type is required');
  }

  const catalogType = getEventType(type);
  assertKnownEventType(type, catalogType);
  const category = resolveCategory(catalogType, explicitCategory);
  const label = catalogType?.label || prettifyType(type);
  const severity = catalogType?.severity || 'info';
  const source = catalogType?.source || null;

  const captureAllowed = await isCaptureEnabled(category, type, catalogType);
  if (!captureAllowed) {
    return null;
  }

  const normalizedSubject = normalizeSubject(subject, category);
  assertValidSubject(normalizedSubject, type);
  const normalizedActor = normalizeActor(actor, source);
  const payloadObject = ensurePayloadObject(payload, type);

  const now = createdAt ? new Date(createdAt) : new Date();
  const capturedAt = Number.isNaN(now.getTime()) ? new Date() : now;
  const eventId = randomUUID();
  const tracking = trackingId ?? (payloadObject && payloadObject.tracking_id) ?? deriveTrackingId(normalizedSubject);

  const subjectType = normalizedSubject.type || 'case';
  const subjectId = normalizedSubject.id != null ? String(normalizedSubject.id) : 'unknown';
  const actorType = normalizedActor.type || 'system';
  const actorId = normalizedActor.id != null ? String(normalizedActor.id) : null;
  const actorDisplayName = normalizedActor.displayName || null;
  const payloadJson = JSON.stringify(payloadObject || {});
  const capturedAtSql = mysqlTimestamp(capturedAt);

  const baseRow = {
    id: eventId,
    category,
    event_type: type,
    severity,
    source,
    subject_type: subjectType,
    subject_id: subjectId,
    actor_type: actorType,
    actor_id: actorId,
    actor_display_name: actorDisplayName,
    payload_json: payloadJson,
    tracking_id: tracking || null,
    correlation_id: correlationId || null,
    captured_by: capturedBy || actorId || null,
    captured_at: capturedAt,
    read_at: null,
  };

  const insertEntrySql = [
    'INSERT INTO iset_event_entry (',
    '    id, category, event_type, severity, source,',
    '    subject_type, subject_id,',
    '    actor_type, actor_id, actor_display_name,',
    '    payload_json, tracking_id, correlation_id,',
    '    captured_by, captured_at, ingested_at',
    '  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?)'
  ].join('\n');

  try {
    await pool.query(insertEntrySql, [
      eventId,
      category,
      type,
      severity,
      source,
      subjectType,
      subjectId,
      actorType,
      actorId,
      actorDisplayName,
      payloadJson,
      tracking || null,
      correlationId || null,
      capturedBy || actorId || null,
      capturedAtSql,
      capturedAtSql,
    ]);
  } catch (err) {
    if (isMissingTableError(err)) {
      console.warn('[events] event store unavailable; using in-memory fallback');
      const fallbackEvent = mapRow(baseRow);
      storeMemoryEvent(fallbackEvent);
      return fallbackEvent;
    }
    throw err;
  }

  const outboxPayload = {
    id: eventId,
    type,
    label,
    category,
    severity,
    source,
    subject: normalizedSubject,
    actor: normalizedActor,
    payload: payloadObject || {},
    trackingId: tracking || null,
    correlationId: correlationId || null,
    capturedAt: capturedAt.toISOString(),
    capturedBy: capturedBy || actorId || null,
  };

  const insertOutboxSql = [
    'INSERT INTO iset_event_outbox (event_id, payload, status, attempts, next_attempt_at)',
    "   VALUES (?, CAST(? AS JSON), 'pending', 0, ?)"
  ].join('\n');

  try {
    await pool.query(insertOutboxSql, [eventId, JSON.stringify(outboxPayload), capturedAtSql]);
  } catch (err) {
    if (isMissingTableError(err)) {
      console.warn('[events] event outbox table missing; skipping async fan-out');
    } else {
      console.warn('[events] failed to enqueue event outbox payload', err?.message || err);
    }
  }

  const event = mapRow(baseRow);
  storeMemoryEvent(event);

  if (notificationHook) {
    try {
      const maybePromise = notificationHook(event);
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise;
      }
    } catch (hookErr) {
      console.warn('[events] notification hook failed', hookErr?.message || hookErr);
    }
  }

  return event;
}

async function getCaseEvents({ caseId, requesterId, limit = 50, offset = 0, types, categories, since, until }) {
  ensurePool();
  if (caseId == null) return [];
  const subjectId = String(caseId);
  const recipientId = requesterId != null ? String(requesterId) : '__none__';
  const rowLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Number(limit), 200) : 50;
  const rowOffset = Number.isFinite(offset) && offset >= 0 ? Number(offset) : 0;

  const typeList = normalizeFilterList(types);
  const categoryList = normalizeFilterList(categories);
  const sinceDate = normalizeDateBound(since);
  const untilDate = normalizeDateBound(until);

  const params = [recipientId, subjectId];
  let sql = `
    SELECT e.id, e.category, e.event_type, e.severity, e.source,
           e.subject_type, e.subject_id,
           e.actor_type, e.actor_id, e.actor_display_name,
           e.payload_json, e.tracking_id, e.correlation_id,
           e.captured_by, e.captured_at, r.read_at,
           sp.display_name AS staff_display_name, sp.email AS staff_email,
           u.name AS applicant_name, u.email AS applicant_email
      FROM iset_event_entry e
      LEFT JOIN iset_event_receipt r
        ON r.event_id = e.id AND r.recipient_id = ?
      LEFT JOIN staff_profiles sp
        ON sp.cognito_sub = e.actor_id OR sp.cognito_sub = e.captured_by
      LEFT JOIN user u
        ON e.actor_type = 'applicant' AND u.id = CAST(e.actor_id AS UNSIGNED)
     WHERE e.subject_type = 'case' AND e.subject_id = ?`;

  if (categoryList.length) {
    sql += ` AND e.category IN (${categoryList.map(() => '?').join(',')})`;
    params.push(...categoryList);
  }
  if (typeList.length) {
    sql += ` AND e.event_type IN (${typeList.map(() => '?').join(',')})`;
    params.push(...typeList);
  }
  if (sinceDate) {
    sql += ' AND e.captured_at >= ?';
    params.push(mysqlTimestamp(sinceDate));
  }
  if (untilDate) {
    sql += ' AND e.captured_at <= ?';
    params.push(mysqlTimestamp(untilDate));
  }

  sql += ' ORDER BY e.captured_at DESC LIMIT ? OFFSET ?';
  params.push(rowLimit, rowOffset);

  try {
    const [rows] = await pool.query(sql, params);
    return rows.map(row => mapRow(row));
  } catch (err) {
    if (isMissingTableError(err)) {
      return getMemoryEvents({
        caseId: subjectId,
        limit: rowLimit,
        offset: rowOffset,
        recipientId,
        categories: categoryList,
        types: typeList,
        since: sinceDate,
        until: untilDate,
      });
    }
    throw err;
  }
}


async function getEventFeed({ limit = 50, offset = 0, requesterId, types, categories, subjectType, subjectId, since, until } = {}) {
  ensurePool();
  const recipientId = requesterId != null ? String(requesterId) : '__none__';
  const rowLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Number(limit), 200) : 50;
  const rowOffset = Number.isFinite(offset) && offset >= 0 ? Number(offset) : 0;

  const typeList = normalizeFilterList(types);
  const categoryList = normalizeFilterList(categories);
  const subjectTypeList = normalizeFilterList(subjectType);
  const appliedSubjectTypes = subjectTypeList.length ? subjectTypeList : ['case'];
  const subjectIdValue = typeof subjectId === 'undefined' || subjectId === null ? null : String(subjectId);
  const sinceDate = normalizeDateBound(since);
  const untilDate = normalizeDateBound(until);

  const params = [recipientId];
  let sql = `
    SELECT e.id, e.category, e.event_type, e.severity, e.source,
           e.subject_type, e.subject_id,
           e.actor_type, e.actor_id, e.actor_display_name,
           e.payload_json, e.tracking_id, e.correlation_id,
           e.captured_by, e.captured_at, r.read_at,
           sp.display_name AS staff_display_name, sp.email AS staff_email,
           u.name AS applicant_name, u.email AS applicant_email
      FROM iset_event_entry e
      LEFT JOIN iset_event_receipt r
        ON r.event_id = e.id AND r.recipient_id = ?
      LEFT JOIN staff_profiles sp
        ON sp.cognito_sub = e.actor_id OR sp.cognito_sub = e.captured_by
      LEFT JOIN user u
        ON e.actor_type = 'applicant' AND u.id = CAST(e.actor_id AS UNSIGNED)
     WHERE 1=1`;

  if (appliedSubjectTypes.length) {
    sql += ` AND e.subject_type IN (${appliedSubjectTypes.map(() => '?').join(',')})`;
    params.push(...appliedSubjectTypes);
  }
  if (subjectIdValue !== null && subjectIdValue !== '') {
    sql += ' AND e.subject_id = ?';
    params.push(subjectIdValue);
  }
  if (categoryList.length) {
    sql += ` AND e.category IN (${categoryList.map(() => '?').join(',')})`;
    params.push(...categoryList);
  }
  if (typeList.length) {
    sql += ` AND e.event_type IN (${typeList.map(() => '?').join(',')})`;
    params.push(...typeList);
  }
  if (sinceDate) {
    sql += ' AND e.captured_at >= ?';
    params.push(mysqlTimestamp(sinceDate));
  }
  if (untilDate) {
    sql += ' AND e.captured_at <= ?';
    params.push(mysqlTimestamp(untilDate));
  }

  sql += ' ORDER BY e.captured_at DESC LIMIT ? OFFSET ?';
  params.push(rowLimit, rowOffset);

  try {
    const [rows] = await pool.query(sql, params);
    return rows.map(row => mapRow(row));
  } catch (err) {
    if (isMissingTableError(err)) {
      return getMemoryFeed({
        limit: rowLimit,
        offset: rowOffset,
        recipientId,
        categories: categoryList,
        types: typeList,
        subjectType: appliedSubjectTypes,
        subjectId: subjectIdValue,
        since: sinceDate,
        until: untilDate,
      });
    }
    throw err;
  }
}


async function markEventRead({ eventId, requesterId }) {
  ensurePool();
  if (!eventId || requesterId == null) return false;
  const recipientId = String(requesterId);
  try {
    const insertReceiptSql = [
      'INSERT INTO iset_event_receipt (event_id, recipient_id, read_at)',
      '   VALUES (?, ?, CURRENT_TIMESTAMP(3))',
      '   ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)'
    ].join('\n');

    const [result] = await pool.query(insertReceiptSql, [eventId, recipientId]);
    if (result.affectedRows > 0) {
      markMemoryEventRead(eventId, recipientId);
      return true;
    }
    return false;
  } catch (err) {
    if (isMissingTableError(err)) {
      return markMemoryEventRead(eventId, recipientId);
    }
    throw err;
  }
}


async function seedEvents(seedList = []) {
  ensurePool();
  if (!Array.isArray(seedList) || seedList.length === 0) return;
  for (const event of seedList) {
    await emitEvent(event);
  }
}

function mapRow(row) {
  const catalogType = getEventType(row.event_type);
  const severity = row.severity || catalogType?.severity || 'info';
  const label = catalogType?.label || prettifyType(row.event_type);
  const payload = parseJson(row.payload_json);

  const createdAt = row.captured_at instanceof Date
    ? row.captured_at
    : new Date(row.captured_at);

  const caseId = row.subject_type === 'case' ? parseNumeric(row.subject_id) : null;
  const staffDisplayName = row.staff_display_name || null;
  const staffEmail = row.staff_email || null;
  const applicantName = row.applicant_name || null;
  const applicantEmail = row.applicant_email || null;
  const actorDisplayName = row.actor_display_name || staffDisplayName || applicantName || staffEmail || applicantEmail || null;
  const actorEmail = staffEmail || applicantEmail || null;

  return {
    id: row.id,
    event_type: row.event_type,
    event_type_label: label,
    category: row.category,
    severity,
    source: row.source,
    alert_variant: toAlertVariant(severity),
    created_at: createdAt.toISOString(),
    event_data: payload,
    case_id: caseId,
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    tracking_id: row.tracking_id || null,
    actor: {
      type: row.actor_type,
      id: row.actor_id,
      displayName: actorDisplayName,
      email: actorEmail,
    },
    user_name: actorDisplayName,
    actor_email: actorEmail,
    correlation_id: row.correlation_id || null,
    captured_by: row.captured_by || null,
    is_read: row.read_at ? 1 : 0,
  };
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return {};
  }
}

function parseNumeric(value) {
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function resolveCategory(catalogType, explicitCategory) {
  if (explicitCategory) return explicitCategory;
  if (catalogType?.category) return catalogType.category;
  return 'uncategorized';
}

function normalizeSubject(subject, category) {
  if (!subject) {
    return { type: 'category', id: category };
  }
  if (typeof subject === 'object' && subject !== null) {
    const subjectType = subject.type || subject.subjectType || 'case';
    const subjectId = subject.id ?? subject.subjectId ?? subject.caseId ?? null;
    return { type: subjectType, id: subjectId };
  }
  return { type: 'case', id: subject };
}

function normalizeActor(actor, source) {
  if (!actor) {
    return {
      type: source === 'portal' ? 'applicant' : 'system',
      id: null,
      displayName: source === 'portal' ? 'Applicant' : 'System',
    };
  }
  if (typeof actor === 'object') {
    return {
      type: actor.type || actor.actorType || (source === 'portal' ? 'applicant' : 'staff'),
      id: actor.id ?? actor.actorId ?? null,
      displayName: actor.displayName || actor.name || null,
    };
  }
  return {
    type: 'staff',
    id: actor,
    displayName: null,
  };
}

function prettifyType(type) {
  return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function deriveTrackingId(subject) {
  if (subject?.type === 'case' && subject.id != null) {
    return `CASE-${subject.id}`;
  }
  return null;
}

function toAlertVariant(severity) {
  switch (severity) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'info';
  }
}

function mysqlTimestamp(date) {
  const iso = date.toISOString();
  return iso.replace('T', ' ').slice(0, 23);
}

module.exports = {
  registerEventStorePool,
  emitEvent,
  getCaseEvents,
  getEventFeed,
  markEventRead,
  seedEvents,
  invalidateCaptureCache,
  EventValidationError,
  registerNotificationHook,
};











