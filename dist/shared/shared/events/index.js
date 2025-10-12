const {
  registerEventStorePool,
  emitEvent,
  getCaseEvents,
  getEventFeed,
  markEventRead,
  seedEvents,
  invalidateCaptureCache,
  EventValidationError,
  registerNotificationHook,
} = require('./emitter');
const { loadEventCaptureState, updateEventCaptureRules } = require('./service');
const { getEventCatalog } = require('./catalog');

let registeredPool = null;

function resolveLogger(logger) {
  if (logger && typeof logger.info === 'function' && typeof logger.warn === 'function') {
    return logger;
  }
  return console;
}

function createEventService({ pool, logger } = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('createEventService requires a MySQL pool with a query() method');
  }

  const log = resolveLogger(logger);

  if (registeredPool && registeredPool !== pool) {
    log.warn('[events] Re-registering event store pool; previous pool reference will be replaced.');
  }
  if (registeredPool !== pool) {
    registerEventStorePool(pool);
    registeredPool = pool;
    log.info ? log.info('[events] Event service initialised with shared pool.') : log.log('[events] Event service initialised with shared pool.');
  }

  async function emitCaseEvent({ caseId, actor, actorId, actorType = 'staff', actorName, payload, trackingId, correlationId, type, category }) {
    if (caseId === null || typeof caseId === 'undefined') {
      throw new EventValidationError('caseId is required to emit a case event', { caseId, type });
    }
    const resolvedActor = actor || {
      type: actorType || 'staff',
      id: typeof actorId === 'undefined' ? null : actorId,
      displayName: typeof actorName === 'undefined' ? null : actorName,
    };
    return emitEvent({
      type,
      category,
      subject: { type: 'case', id: caseId },
      actor: resolvedActor,
      payload,
      trackingId,
      correlationId,
    });
  }

  return {
    emit: emitEvent,
    emitCaseEvent,
    getCaseTimeline: (options = {}) => getCaseEvents({
      caseId: options.caseId,
      requesterId: options.requesterId,
      limit: options.limit,
      offset: options.offset,
      types: options.types,
      categories: options.categories,
      since: options.since,
      until: options.until,
    }),
    getEventFeed: (options = {}) => getEventFeed({
      limit: options.limit,
      offset: options.offset,
      requesterId: options.requesterId,
      types: options.types,
      categories: options.categories,
      subjectType: options.subjectType,
      subjectId: options.subjectId,
      since: options.since,
      until: options.until,
    }),
    markRead: ({ eventId, requesterId }) => markEventRead({ eventId, requesterId }),
    loadCaptureState: () => loadEventCaptureState(pool),
    updateCaptureRules: (updates, actorId) => updateEventCaptureRules(pool, updates, actorId),
    getCatalog: () => getEventCatalog(),
    invalidateCaptureCache,
    seedEvents: (list) => seedEvents(list),
  };
}

module.exports = {
  createEventService,
  EventValidationError,
  registerNotificationHook,
};
