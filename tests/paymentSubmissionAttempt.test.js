const {
  claimPaymentSubmissionAttempt,
  completePaymentSubmissionAttempt,
  dispatchPaymentSubmissionWithAttempt,
} = require('../src/lib/paymentSubmissionAttempt');

function createAttemptPool() {
  const state = { row: null, nextId: 1 };
  let lockOwner = null;
  const waiters = [];
  let nextConnectionId = 1;
  const release = id => {
    if (lockOwner !== id) return;
    lockOwner = null;
    const next = waiters.shift();
    if (next) next();
  };
  const acquire = async id => {
    while (lockOwner !== null && lockOwner !== id) {
      await new Promise(resolve => waiters.push(resolve));
    }
    lockOwner = id;
  };
  const applyFields = (row, sql, params) => {
    const assignments = sql.slice(sql.indexOf('SET') + 3, sql.indexOf('WHERE')).split(',');
    assignments.forEach((assignment, index) => {
      const column = assignment.trim().split(/\s+/u)[0];
      if (column === 'attempt_count') row.attempt_count += 1;
      else row[column] = params[index];
    });
  };

  const pool = {
    getConnection: jest.fn(async () => {
      const id = nextConnectionId++;
      return {
        beginTransaction: jest.fn(async () => {}),
        commit: jest.fn(async () => release(id)),
        rollback: jest.fn(async () => release(id)),
        release: jest.fn(() => release(id)),
        query: jest.fn(async (statement, params = []) => {
          const sql = String(statement).replace(/\s+/gu, ' ').trim();
          if (sql.startsWith('SELECT * FROM payment_submission_attempt')) {
            await acquire(id);
            return [[state.row ? { ...state.row } : undefined], []];
          }
          if (sql.startsWith('INSERT IGNORE INTO payment_submission_attempt')) {
            if (state.row) return [{ affectedRows: 0 }, []];
            const [packetId, submissionKey, mode, requestJson, actorId, createdAt] = params;
            state.row = {
              id: state.nextId++,
              payment_packet_id: packetId,
              submission_key: submissionKey,
              mode,
              status: 'queued',
              attempt_count: 0,
              lease_owner: null,
              lease_expires_at: null,
              request_json: requestJson,
              result_json: null,
              error_json: null,
              created_by_user_id: actorId,
              created_at: createdAt,
              completed_at: null,
            };
            return [{ insertId: state.row.id, affectedRows: 1 }, []];
          }
          if (sql.startsWith('UPDATE payment_submission_attempt')) {
            if (sql.includes("status = 'ambiguous'")) {
              state.row.status = 'ambiguous';
              state.row.lease_owner = null;
              state.row.lease_expires_at = null;
              state.row.error_json = params[0];
            } else if (sql.includes("status = 'sending'")) {
              state.row.mode = params[0] || state.row.mode;
              state.row.status = 'sending';
              state.row.attempt_count += 1;
              state.row.lease_owner = params[1];
              state.row.lease_expires_at = params[2];
              state.row.request_json = params[3];
              state.row.error_json = null;
            } else {
              applyFields(state.row, sql, params);
            }
            return [{ affectedRows: 1 }, []];
          }
          throw new Error(`Unexpected attempt connection query: ${sql}`);
        }),
      };
    }),
    query: jest.fn(async (statement, params = []) => {
      const sql = String(statement).replace(/\s+/gu, ' ').trim();
      if (!state.row) return [{ affectedRows: 0 }, []];
      if (sql.includes("WHERE id = ? AND status = 'sending' AND lease_owner = ?")) {
        const attemptId = params[params.length - 2];
        const leaseOwner = params[params.length - 1];
        if (state.row.id !== attemptId || state.row.status !== 'sending' || state.row.lease_owner !== leaseOwner) {
          return [{ affectedRows: 0 }, []];
        }
        applyFields(state.row, sql, params);
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("status = 'completed'")) {
        state.row.status = 'completed';
        state.row.completed_at = new Date();
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected attempt pool query: ${sql}`);
    }),
  };
  return { pool, state };
}

describe('durable payment submission attempts', () => {
  test('concurrent dispatch and retry make one provider call and replay its accepted result', async () => {
    const { pool, state } = createAttemptPool();
    let releaseProvider;
    const providerGate = new Promise(resolve => { releaseProvider = resolve; });
    const dispatch = jest.fn(async () => {
      await providerGate;
      return { ok: true, mode: 'email', communication: { providerMessageId: 'ses-1' } };
    });
    const first = dispatchPaymentSubmissionWithAttempt({ pool, packetId: 9, dispatch });
    await new Promise(resolve => setImmediate(resolve));
    const competing = await dispatchPaymentSubmissionWithAttempt({ pool, packetId: 9, dispatch });
    expect(competing.error).toBe('payment_submission_in_progress');
    expect(dispatch).toHaveBeenCalledTimes(1);

    releaseProvider();
    const accepted = await first;
    expect(accepted.ok).toBe(true);
    const replay = await dispatchPaymentSubmissionWithAttempt({ pool, packetId: 9, dispatch });
    expect(replay).toMatchObject({ ok: true, replayed: true, submissionAttemptId: state.row.id });
    expect(dispatch).toHaveBeenCalledTimes(1);
    await completePaymentSubmissionAttempt(pool, state.row.id);
    expect(state.row.status).toBe('completed');
  });

  test('known failures may retry, while uncertain failures become non-retryable', async () => {
    const known = createAttemptPool();
    const dispatchKnown = jest
      .fn()
      .mockResolvedValueOnce({ error: 'finance_email_missing', message: 'No route' })
      .mockResolvedValueOnce({ ok: true, mode: 'email', suppressed: true });
    expect(await dispatchPaymentSubmissionWithAttempt({
      pool: known.pool,
      packetId: 10,
      dispatch: dispatchKnown,
    })).toMatchObject({ error: 'finance_email_missing' });
    expect(await dispatchPaymentSubmissionWithAttempt({
      pool: known.pool,
      packetId: 10,
      dispatch: dispatchKnown,
    })).toMatchObject({ ok: true, suppressed: true });
    expect(dispatchKnown).toHaveBeenCalledTimes(2);

    const uncertain = createAttemptPool();
    const dispatchUncertain = jest.fn(async () => {
      throw new Error('process_failed_after_provider_call');
    });
    await expect(dispatchPaymentSubmissionWithAttempt({
      pool: uncertain.pool,
      packetId: 11,
      dispatch: dispatchUncertain,
      now: new Date('2026-07-12T10:00:00Z'),
      leaseMs: 1000,
    })).rejects.toThrow('process_failed_after_provider_call');
    const expired = await claimPaymentSubmissionAttempt({
      pool: uncertain.pool,
      packetId: 11,
      now: new Date('2026-07-12T10:00:02Z'),
      leaseMs: 1000,
    });
    expect(expired.action).toBe('ambiguous');
    expect(uncertain.state.row.status).toBe('ambiguous');
    expect(dispatchUncertain).toHaveBeenCalledTimes(1);
  });
});
