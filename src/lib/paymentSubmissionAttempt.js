const crypto = require('crypto');

const DEFAULT_SUBMISSION_KEY = 'packet-submit-v1';
const DEFAULT_LEASE_MS = 2 * 60 * 1000;

function safeJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function serializeJson(value) {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

function normalizeAttemptRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    packetId: Number(row.payment_packet_id),
    submissionKey: row.submission_key,
    mode: row.mode || null,
    status: row.status,
    attemptCount: Number(row.attempt_count || 0),
    leaseOwner: row.lease_owner || null,
    leaseExpiresAt: row.lease_expires_at || null,
    providerMessageId: row.provider_message_id || null,
    request: safeJson(row.request_json),
    result: safeJson(row.result_json),
    error: safeJson(row.error_json),
    completedAt: row.completed_at || null,
  };
}

function createAttemptError(code, message, attempt = null) {
  const error = new Error(message || code);
  error.code = code;
  error.attempt = attempt;
  return error;
}

async function claimPaymentSubmissionAttempt({
  pool,
  packetId,
  submissionKey = DEFAULT_SUBMISSION_KEY,
  mode = null,
  request = null,
  actorUserId = null,
  leaseOwner = crypto.randomUUID(),
  now = new Date(),
  leaseMs = DEFAULT_LEASE_MS,
} = {}) {
  if (!pool || typeof pool.getConnection !== 'function') {
    throw new TypeError('claimPaymentSubmissionAttempt requires a database pool');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT IGNORE INTO payment_submission_attempt
        (payment_packet_id, submission_key, mode, status, attempt_count, request_json,
         created_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, 'queued', 0, ?, ?, ?, ?)`,
      [packetId, submissionKey, mode, serializeJson(request), actorUserId, now, now]
    );
    const [[row]] = await connection.query(
      `SELECT * FROM payment_submission_attempt
        WHERE payment_packet_id = ? AND submission_key = ?
        LIMIT 1 FOR UPDATE`,
      [packetId, submissionKey]
    );
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    if (!row) throw createAttemptError('payment_submission_attempt_missing_after_claim');

    const attempt = normalizeAttemptRow(row);
    if (['accepted', 'completed', 'suppressed'].includes(attempt.status)) {
      await connection.commit();
      return { action: 'replay', attempt };
    }
    if (attempt.status === 'ambiguous') {
      await connection.commit();
      return { action: 'ambiguous', attempt };
    }
    if (attempt.status === 'sending') {
      const currentLease = row.lease_expires_at ? new Date(row.lease_expires_at) : null;
      if (currentLease && currentLease > now) {
        await connection.commit();
        return { action: 'in_progress', attempt };
      }
      await connection.query(
        `UPDATE payment_submission_attempt
            SET status = 'ambiguous', lease_owner = NULL, lease_expires_at = NULL,
                error_json = ?, updated_at = ?
          WHERE id = ?`,
        [serializeJson({ code: 'payment_submission_lease_expired' }), now, row.id]
      );
      await connection.commit();
      return {
        action: 'ambiguous',
        attempt: { ...attempt, status: 'ambiguous', leaseOwner: null, leaseExpiresAt: null },
      };
    }
    if (!['failed', 'queued'].includes(attempt.status)) {
      throw createAttemptError('payment_submission_attempt_state_invalid', null, attempt);
    }
    await connection.query(
      `UPDATE payment_submission_attempt
          SET mode = COALESCE(?, mode), status = 'sending', attempt_count = attempt_count + 1,
              lease_owner = ?, lease_expires_at = ?, request_json = ?, error_json = NULL,
              updated_at = ?
        WHERE id = ?`,
      [mode, leaseOwner, leaseExpiresAt, serializeJson(request), now, row.id]
    );
    await connection.commit();
    return {
      action: 'dispatch',
      attempt: {
        ...attempt,
        mode: mode || attempt.mode,
        status: 'sending',
        attemptCount: attempt.attemptCount + 1,
        leaseOwner,
        leaseExpiresAt,
        request,
        error: null,
      },
    };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

async function updatePaymentSubmissionAttempt(pool, attemptId, leaseOwner, fields) {
  const assignments = [];
  const params = [];
  Object.entries(fields).forEach(([column, value]) => {
    assignments.push(`${column} = ?`);
    params.push(value);
  });
  params.push(attemptId, leaseOwner);
  const [result] = await pool.query(
    `UPDATE payment_submission_attempt SET ${assignments.join(', ')}
      WHERE id = ? AND status = 'sending' AND lease_owner = ?`,
    params
  );
  if (Number(result?.affectedRows || 0) !== 1) {
    throw createAttemptError('payment_submission_attempt_claim_lost');
  }
}

function isAmbiguousProviderFailure(result) {
  const code = String(result?.error || '');
  return code.includes('unreachable') || code === 'finance_email_send_failed';
}

async function dispatchPaymentSubmissionWithAttempt({
  pool,
  packetId,
  mode = null,
  request = null,
  actorUserId = null,
  dispatch,
  now = new Date(),
  leaseMs = DEFAULT_LEASE_MS,
} = {}) {
  if (typeof dispatch !== 'function') throw new TypeError('dispatch callback is required');
  const claim = await claimPaymentSubmissionAttempt({
    pool,
    packetId,
    mode,
    request,
    actorUserId,
    now,
    leaseMs,
  });
  if (claim.action === 'replay') {
    return { ...(claim.attempt.result || {}), replayed: true, submissionAttemptId: claim.attempt.id };
  }
  if (claim.action === 'in_progress') {
    return {
      error: 'payment_submission_in_progress',
      message: 'This payment submission is already being dispatched.',
      submissionAttemptId: claim.attempt.id,
    };
  }
  if (claim.action === 'ambiguous') {
    return {
      error: 'payment_submission_outcome_ambiguous',
      message: 'The previous provider outcome is uncertain and must be reviewed before retry.',
      submissionAttemptId: claim.attempt.id,
    };
  }

  const { attempt } = claim;
  let result;
  try {
    result = await dispatch(attempt);
  } catch (error) {
    // A thrown error can occur after provider acceptance. Preserve the sending lease so
    // expiry becomes ambiguous instead of allowing a blind resend.
    throw error;
  }
  const finishedAt = new Date();
  if (result?.error) {
    const ambiguous = isAmbiguousProviderFailure(result);
    await updatePaymentSubmissionAttempt(pool, attempt.id, attempt.leaseOwner, {
      mode: result.mode || mode,
      status: ambiguous ? 'ambiguous' : 'failed',
      lease_owner: null,
      lease_expires_at: null,
      error_json: serializeJson(result),
      updated_at: finishedAt,
    });
    return { ...result, submissionAttemptId: attempt.id };
  }
  const providerMessageId =
    result?.billId ||
    result?.communication?.providerMessageId ||
    result?.communication?.provider_message_id ||
    null;
  await updatePaymentSubmissionAttempt(pool, attempt.id, attempt.leaseOwner, {
    mode: result?.mode || mode,
    status: result?.suppressed ? 'suppressed' : 'accepted',
    lease_owner: null,
    lease_expires_at: null,
    provider_message_id: providerMessageId,
    result_json: serializeJson(result || { ok: true }),
    error_json: null,
    updated_at: finishedAt,
  });
  return { ...(result || { ok: true }), submissionAttemptId: attempt.id };
}

async function completePaymentSubmissionAttempt(pool, attemptId) {
  if (!attemptId) return;
  await pool.query(
    `UPDATE payment_submission_attempt
        SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = ? AND status IN ('accepted', 'suppressed', 'completed')`,
    [attemptId]
  );
}

module.exports = {
  DEFAULT_SUBMISSION_KEY,
  claimPaymentSubmissionAttempt,
  completePaymentSubmissionAttempt,
  dispatchPaymentSubmissionWithAttempt,
};
