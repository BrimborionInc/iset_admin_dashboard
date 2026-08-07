const fs = require('fs');
const path = require('path');
const {
  claimEventDeliveries,
  enqueueEmailDelivery,
  enqueueEventFanout,
  purgeDeliveredEventDeliveries,
  replayEventDelivery,
  runEventDeliveryWorkerOnce,
  startEventDeliveryWorker,
} = require('../../../../shared/events/deliveryQueue');
const {
  buildReminderLifecycleEventId,
} = require('../reminderLifecycleEvents');

function createDeliveryStore() {
  const deliveries = [];
  const events = new Map();
  let nextId = 1;
  let lock = Promise.resolve();

  const query = async (statement, params = []) => {
    const sql = String(statement).replace(/\s+/g, ' ').trim();
    if (sql.startsWith('INSERT INTO iset_event_delivery') && sql.includes("VALUES (?, 'fanout'")) {
      const [eventId, workerScope] = params;
      if (!deliveries.some(row => row.event_id === eventId && row.channel === 'fanout')) {
        deliveries.push({ id: nextId++, event_id: eventId, channel: 'fanout', audience_key: 'configured_audiences', worker_scope: workerScope, status: 'pending', attempt_count: 0, available_at: new Date(0), payload_json: null });
      }
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('INSERT INTO iset_event_delivery') && sql.includes("VALUES (?, 'email'")) {
      const [eventId, audienceKey, workerScope, payloadJson] = params;
      if (!deliveries.some(row => row.event_id === eventId && row.channel === 'email' && row.audience_key === audienceKey)) {
        deliveries.push({ id: nextId++, event_id: eventId, channel: 'email', audience_key: audienceKey, worker_scope: workerScope, status: 'pending', attempt_count: 0, available_at: new Date(0), payload_json: payloadJson });
      }
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('INSERT INTO iset_event_delivery') && sql.includes('SELECT e.id')) return [{ affectedRows: 0 }];
    if (sql.startsWith('UPDATE iset_event_delivery') && sql.includes("status = 'ambiguous'")) {
      const [scope, now] = params;
      deliveries.forEach(row => {
        if (row.worker_scope === scope && row.channel === 'email' && row.status === 'sending' && row.claim_expires_at < now) row.status = 'ambiguous';
      });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('UPDATE iset_event_delivery') && sql.includes("channel = 'fanout'") && sql.includes("status = 'processing'")) {
      const [scope, now] = params;
      deliveries.forEach(row => {
        if (row.worker_scope === scope && row.channel === 'fanout' && row.status === 'processing' && row.claim_expires_at < now) row.status = 'pending';
      });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('SELECT id, event_id, channel')) {
      const [scope, now, limit] = params;
      return [deliveries.filter(row => row.worker_scope === scope && row.status === 'pending' && row.available_at <= now).slice(0, limit).map(row => ({ ...row }))];
    }
    if (sql.startsWith('UPDATE iset_event_delivery') && sql.includes('attempt_count = attempt_count + 1')) {
      const [status, workerId, expiry, attemptedAt, id] = params;
      const row = deliveries.find(item => item.id === id && item.status === 'pending');
      if (row) Object.assign(row, { status, claimed_by: workerId, claim_expires_at: expiry, last_attempt_at: attemptedAt, attempt_count: row.attempt_count + 1 });
      return [{ affectedRows: row ? 1 : 0 }];
    }
    if (sql.startsWith('SELECT id, category, event_type')) {
      return [[events.get(params[0])].filter(Boolean)];
    }
    if (sql.startsWith('UPDATE iset_event_delivery') && sql.includes("status = 'delivered'")) {
      const row = deliveries.find(item => item.id === params[1]);
      Object.assign(row, { status: 'delivered', delivered_at: params[0], claim_expires_at: null });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('UPDATE iset_event_delivery') && sql.includes('available_at = ?') && sql.includes('last_error = ?')) {
      const [status, availableAt, error, id] = params;
      const row = deliveries.find(item => item.id === id);
      Object.assign(row, { status, available_at: availableAt, last_error: error, claim_expires_at: null });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('UPDATE iset_event_delivery') && sql.includes('replayed_by_staff_profile_id')) {
      const [reason, replayedBy, id] = params;
      const row = deliveries.find(item => item.id === id && ['dead_letter', 'ambiguous'].includes(item.status));
      if (row) Object.assign(row, { status: 'pending', replay_reason: reason, replayed_by_staff_profile_id: replayedBy, replay_count: Number(row.replay_count || 0) + 1 });
      return [{ affectedRows: row ? 1 : 0 }];
    }
    if (sql.startsWith('DELETE FROM iset_event_delivery')) {
      const [days, limit] = params;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const removable = deliveries.filter(row => row.status === 'delivered' && row.delivered_at?.getTime() < cutoff).slice(0, limit);
      removable.forEach(row => deliveries.splice(deliveries.indexOf(row), 1));
      return [{ affectedRows: removable.length }];
    }
    throw new Error(`Unexpected delivery SQL: ${sql}`);
  };

  const pool = {
    query,
    getConnection: async () => {
      let releaseLock;
      return {
        query,
        beginTransaction: async () => {
          const prior = lock;
          lock = new Promise(resolve => { releaseLock = resolve; });
          await prior;
        },
        commit: async () => releaseLock?.(),
        rollback: async () => releaseLock?.(),
        release: () => {},
      };
    },
  };
  return { pool, deliveries, events };
}

describe('durable event delivery and reminder lifecycle', () => {
  test('two workers claim one fanout delivery and a transient handler failure retries', async () => {
    const store = createDeliveryStore();
    const event = { id: 'event-1', source: 'admin' };
    store.events.set(event.id, { id: event.id, event_type: 'reminder_due', source: 'admin', subject_type: 'case', subject_id: '7', payload_json: '{}' });
    await enqueueEventFanout(store.pool, event);

    const [left, right] = await Promise.all([
      claimEventDeliveries(store.pool, { workerScope: 'admin', workerId: 'left', now: new Date(0) }),
      claimEventDeliveries(store.pool, { workerScope: 'admin', workerId: 'right', now: new Date(0) }),
    ]);
    expect(left.length + right.length).toBe(1);

    // Reset the claimed row to model a handler failure/retry through the real worker.
    Object.assign(store.deliveries[0], { status: 'pending', available_at: new Date(0), attempt_count: 0 });
    let calls = 0;
    await runEventDeliveryWorkerOnce({
      pool: store.pool,
      workerScope: 'admin',
      now: new Date(0),
      handler: async () => { calls += 1; throw new Error('temporary bell failure'); },
      sendEmail: jest.fn(),
      logger: { warn: jest.fn() },
    });
    expect(store.deliveries[0].status).toBe('pending');
    await runEventDeliveryWorkerOnce({
      pool: store.pool,
      workerScope: 'admin',
      now: new Date(10000),
      handler: async () => { calls += 1; },
      sendEmail: jest.fn(),
      logger: { warn: jest.fn() },
    });
    expect(calls).toBe(2);
    expect(store.deliveries[0].status).toBe('delivered');
  });

  test('the long-lived worker retains its schedule and processes fanout after startup', async () => {
    const store = createDeliveryStore();
    const scheduled = [];
    const cleared = [];
    const handler = jest.fn();
    const scheduleToken = { unref: jest.fn() };
    const worker = startEventDeliveryWorker({
      pool: store.pool,
      workerScope: 'admin',
      handler,
      sendEmail: jest.fn(),
      logger: { warn: jest.fn(), error: jest.fn() },
      scheduleInterval: (callback, intervalMs) => {
        scheduled.push({ callback, intervalMs });
        return scheduleToken;
      },
      clearScheduledInterval: token => cleared.push(token),
    });

    await worker.initialRun;
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].intervalMs).toBe(15000);
    expect(scheduleToken.unref).not.toHaveBeenCalled();

    const event = { id: 'event-after-startup', source: 'admin' };
    store.events.set(event.id, {
      id: event.id,
      event_type: 'rm_review_requested',
      source: 'admin',
      subject_type: 'case',
      subject_id: '76',
      payload_json: '{}',
    });
    await enqueueEventFanout(store.pool, event);
    await scheduled[0].callback();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(store.deliveries[0].status).toBe('delivered');
    worker.stop();
    expect(cleared).toEqual([scheduleToken]);
  });

  test('recipient email retries a known failure and succeeds once', async () => {
    const store = createDeliveryStore();
    await enqueueEmailDelivery(store.pool, {
      event: { id: 'event-2', source: 'admin' },
      recipientStaffProfileId: 42,
      to: 'staff@example.ca',
      subject: 'Notice',
      bodyText: 'Body',
    });
    const sendEmail = jest.fn()
      .mockRejectedValueOnce(new Error('temporary SES failure'))
      .mockResolvedValueOnce({ messageId: 'provider-1' });
    await runEventDeliveryWorkerOnce({ pool: store.pool, workerScope: 'admin', now: new Date(0), handler: jest.fn(), sendEmail, logger: { warn: jest.fn() } });
    await runEventDeliveryWorkerOnce({ pool: store.pool, workerScope: 'admin', now: new Date(10000), handler: jest.fn(), sendEmail, logger: { warn: jest.fn() } });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(store.deliveries[0].status).toBe('delivered');
    expect(store.deliveries[0].audience_key).toBe('staff:42');
  });

  test('an expired email send lease becomes ambiguous and is not resent automatically', async () => {
    const store = createDeliveryStore();
    await enqueueEmailDelivery(store.pool, {
      event: { id: 'event-3', source: 'portal' },
      recipientApplicantUserId: 9,
      to: 'applicant@example.ca',
      subject: 'Notice',
      bodyText: 'Body',
    });
    await claimEventDeliveries(store.pool, { workerScope: 'portal', now: new Date(0), leaseMs: 1000 });
    const sendEmail = jest.fn();
    await runEventDeliveryWorkerOnce({ pool: store.pool, workerScope: 'portal', now: new Date(2000), handler: jest.fn(), sendEmail, logger: { warn: jest.fn() } });
    expect(store.deliveries[0].status).toBe('ambiguous');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('operator replay records attribution and cleanup removes only old successful rows', async () => {
    const store = createDeliveryStore();
    store.deliveries.push(
      { id: 1, event_id: 'event-4', channel: 'email', status: 'ambiguous', replay_count: 0 },
      { id: 2, event_id: 'event-5', channel: 'email', status: 'delivered', delivered_at: new Date('2025-01-01T00:00:00Z') },
      { id: 3, event_id: 'event-6', channel: 'email', status: 'dead_letter', delivered_at: null },
    );
    await expect(replayEventDelivery(store.pool, {
      deliveryId: 1,
      reason: 'Provider status reviewed',
      replayedByStaffProfileId: 42,
    })).resolves.toBe(true);
    expect(store.deliveries[0]).toEqual(expect.objectContaining({
      status: 'pending',
      replay_reason: 'Provider status reviewed',
      replayed_by_staff_profile_id: 42,
    }));
    await purgeDeliveredEventDeliveries(store.pool, { retentionDays: 90 });
    expect(store.deliveries.map(row => row.id)).toEqual([1, 3]);
  });

  test('reminder lifecycle IDs are stable per generation and production uses the durable claim', () => {
    const first = buildReminderLifecycleEventId({ reminderId: 7, lifecycleGeneration: 1, eventType: 'reminder_due' });
    expect(first).toBe(buildReminderLifecycleEventId({ reminderId: 7, lifecycleGeneration: 1, eventType: 'reminder_due' }));
    expect(first).not.toBe(buildReminderLifecycleEventId({ reminderId: 7, lifecycleGeneration: 2, eventType: 'reminder_due' }));
    const server = fs.readFileSync(path.resolve(process.cwd(), 'isetadminserver.js'), 'utf8');
    expect(server).toContain('claimReminderLifecycleEvent(pool');
    expect(server).toContain('markReminderLifecycleEventEmitted(pool');
    expect(server).toContain("eventId: claim.eventId");
    expect(server).toContain("status: 'suppressed'");
    expect(server).toContain('lifecycle_generation = lifecycle_generation + 1');
  });

  test('the additive schema and both applications enforce the delivery readiness boundary', () => {
    const migration = fs.readFileSync(path.resolve(process.cwd(), 'sql/migrations/20260711_0003_add_durable_event_delivery.sql'), 'utf8');
    const admin = fs.readFileSync(path.resolve(process.cwd(), 'isetadminserver.js'), 'utf8');
    const adminSchemaReadiness = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/adminRuntimeSchemaContract.js'),
      'utf8'
    );
    const portal = fs.readFileSync(path.resolve(process.cwd(), '../ISET-intake/server.js'), 'utf8');
    const portalSchemaReadiness = fs.readFileSync(
      path.resolve(process.cwd(), '../ISET-intake/src/services/schemaReadiness.js'),
      'utf8'
    );
    expect(migration).toContain('UNIQUE KEY uq_event_delivery_audience_channel (event_id, channel, audience_key)');
    expect(migration).toContain('PRIMARY KEY (reminder_id, lifecycle_generation, event_type)');
    expect(migration).toContain('replayed_by_staff_profile_id');
    expect(admin).toContain('await assertAdminRuntimeSchemaReady(pool)');
    expect(adminSchemaReadiness).toContain("['iset_event_delivery', ['event_id', 'channel', 'audience_key', 'status']]");
    expect(adminSchemaReadiness).toContain('await assertRuntimeTableReady(connection, table, columns)');
    expect(portal).toContain('await assertPortalRuntimeSchemaReady(pool)');
    expect(portalSchemaReadiness).toContain("['iset_event_delivery', ['event_id', 'channel', 'audience_key', 'status']]");
    expect(portalSchemaReadiness).toContain('await assertRuntimeTableReady(connection, table, columns)');
    expect(admin).toContain("workerScope: 'admin'");
    expect(portal).toContain("workerScope: 'portal'");
  });
});
