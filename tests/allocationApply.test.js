const { applyBudgetAllocationExactlyOnce } = require('../src/lib/allocationApply');

function createAllocationPool({ available = 100 } = {}) {
  const state = {
    allocation: {
      id: 7,
      source_pot_id: 1,
      dest_pot_id: 2,
      amount: 25,
      status: 'approved',
      metadata: JSON.stringify({ requestedBy: 'Fixture', evidence: [] }),
      approved_at: new Date('2026-07-12T10:00:00Z'),
    },
    pots: new Map([
      [1, { id: 1, name: 'Source', adjusted_amount: available, committed_amount: 0, actual_amount: 0, metadata: '{}' }],
      [2, { id: 2, name: 'Destination', adjusted_amount: 10, committed_amount: 0, actual_amount: 0, metadata: '{}' }],
    ]),
    commits: 0,
    rollbacks: 0,
  };
  let lockOwner = null;
  const lockWaiters = [];
  let nextConnectionId = 1;

  const releaseLock = connectionId => {
    if (lockOwner !== connectionId) return;
    lockOwner = null;
    const next = lockWaiters.shift();
    if (next) next();
  };

  const acquireLock = async connectionId => {
    while (lockOwner !== null && lockOwner !== connectionId) {
      await new Promise(resolve => lockWaiters.push(resolve));
    }
    lockOwner = connectionId;
  };

  const pool = {
    getConnection: jest.fn(async () => {
      const connectionId = nextConnectionId++;
      return {
        beginTransaction: jest.fn(async () => {}),
        commit: jest.fn(async () => {
          state.commits += 1;
          releaseLock(connectionId);
        }),
        rollback: jest.fn(async () => {
          state.rollbacks += 1;
          releaseLock(connectionId);
        }),
        release: jest.fn(() => releaseLock(connectionId)),
        query: jest.fn(async (statement, params = []) => {
          const sql = String(statement).replace(/\s+/gu, ' ').trim();
          if (sql.includes('FROM budget_allocation') && sql.includes('FOR UPDATE')) {
            await acquireLock(connectionId);
            return [[{ ...state.allocation }], []];
          }
          if (sql.includes('FROM budget_pot') && sql.includes('FOR UPDATE')) {
            return [[...state.pots.values()].sort((a, b) => a.id - b.id).map(row => ({ ...row }))];
          }
          if (sql.startsWith('UPDATE budget_pot SET adjusted_amount = adjusted_amount -')) {
            const [amount, metadata, id] = params;
            const row = state.pots.get(Number(id));
            row.adjusted_amount -= Number(amount);
            row.metadata = metadata;
            return [{ affectedRows: 1 }, []];
          }
          if (sql.startsWith('UPDATE budget_pot SET adjusted_amount = adjusted_amount +')) {
            const [amount, metadata, id] = params;
            const row = state.pots.get(Number(id));
            row.adjusted_amount += Number(amount);
            row.metadata = metadata;
            return [{ affectedRows: 1 }, []];
          }
          if (sql.startsWith('UPDATE budget_allocation')) {
            if (state.allocation.status !== 'approved') return [{ affectedRows: 0 }, []];
            const [metadata, appliedAt] = params;
            state.allocation.status = 'applied';
            state.allocation.metadata = metadata;
            state.allocation.applied_at = appliedAt;
            return [{ affectedRows: 1 }, []];
          }
          throw new Error(`Unexpected allocation query: ${sql}`);
        }),
      };
    }),
  };
  return { pool, state };
}

describe('budget allocation exactly-once apply', () => {
  test('two competing callers transfer the amount once', async () => {
    const { pool, state } = createAllocationPool();
    const results = await Promise.all([
      applyBudgetAllocationExactlyOnce({ pool, allocationId: 7 }),
      applyBudgetAllocationExactlyOnce({ pool, allocationId: 7 }),
    ]);

    expect(results.map(result => result.outcome).sort()).toEqual(['already_applied', 'applied']);
    expect(state.pots.get(1).adjusted_amount).toBe(75);
    expect(state.pots.get(2).adjusted_amount).toBe(35);
    expect(JSON.parse(state.pots.get(1).metadata).adjustments).toHaveLength(1);
    expect(JSON.parse(state.pots.get(2).metadata).adjustments).toHaveLength(1);
    expect(state.allocation.status).toBe('applied');
  });

  test('insufficient source authority rolls back without changing either pot', async () => {
    const { pool, state } = createAllocationPool({ available: 20 });

    await expect(applyBudgetAllocationExactlyOnce({ pool, allocationId: 7 })).rejects.toMatchObject({
      code: 'allocation_source_authority_insufficient',
    });
    expect(state.pots.get(1).adjusted_amount).toBe(20);
    expect(state.pots.get(2).adjusted_amount).toBe(10);
    expect(state.allocation.status).toBe('approved');
    expect(state.rollbacks).toBe(1);
  });
});
