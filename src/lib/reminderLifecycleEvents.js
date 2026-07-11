const crypto = require('crypto');

function buildReminderLifecycleEventId({ reminderId, lifecycleGeneration, eventType }) {
  const reminder = Number(reminderId);
  const generation = Number(lifecycleGeneration);
  const type = String(eventType || '').trim();
  if (!Number.isInteger(reminder) || reminder <= 0 || !Number.isInteger(generation) || generation <= 0 || !type) {
    const error = new Error('Reminder lifecycle identity is incomplete.');
    error.code = 'invalid_reminder_lifecycle_identity';
    throw error;
  }
  return crypto.createHash('sha256')
    .update(`reminder:${reminder}:${generation}:${type}`, 'utf8')
    .digest('hex')
    .slice(0, 36);
}

async function claimReminderLifecycleEvent(connection, {
  reminderId,
  lifecycleGeneration,
  eventType,
} = {}) {
  const eventId = buildReminderLifecycleEventId({ reminderId, lifecycleGeneration, eventType });
  await connection.query(
    `INSERT INTO iset_reminder_lifecycle_event
       (reminder_id, lifecycle_generation, event_type, event_id, status, claimed_at, updated_at)
     VALUES (?, ?, ?, ?, 'claimed', NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE event_id = event_id`,
    [Number(reminderId), Number(lifecycleGeneration), String(eventType), eventId]
  );
  const [[claim]] = await connection.query(
    `SELECT event_id, status
       FROM iset_reminder_lifecycle_event
      WHERE reminder_id = ? AND lifecycle_generation = ? AND event_type = ?
      LIMIT 1`,
    [Number(reminderId), Number(lifecycleGeneration), String(eventType)]
  );
  return {
    eventId: claim?.event_id || eventId,
    emitted: claim?.status === 'emitted' || claim?.status === 'suppressed',
  };
}

async function markReminderLifecycleEventEmitted(connection, {
  reminderId,
  lifecycleGeneration,
  eventType,
  status = 'emitted',
} = {}) {
  const terminalStatus = status === 'suppressed' ? 'suppressed' : 'emitted';
  await connection.query(
    `UPDATE iset_reminder_lifecycle_event
        SET status = ?, emitted_at = COALESCE(emitted_at, NOW(3)), updated_at = NOW(3)
      WHERE reminder_id = ? AND lifecycle_generation = ? AND event_type = ?`,
    [terminalStatus, Number(reminderId), Number(lifecycleGeneration), String(eventType)]
  );
}

module.exports = {
  buildReminderLifecycleEventId,
  claimReminderLifecycleEvent,
  markReminderLifecycleEventEmitted,
};
