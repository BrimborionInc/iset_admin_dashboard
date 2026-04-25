const {
  evaluateCaseAccess,
  evaluateRegionalManagerCaseAccess,
  getCaseAccessError,
  getRegionalManagerCaseAccessError,
} = require('../src/lib/caseAccess');

describe('caseAccess', () => {
  test('allows a Regional Manager to access a directly assigned out-of-region case', () => {
    expect(
      evaluateRegionalManagerCaseAccess({
        requesterId: 54,
        regionIds: [4, 5, 7, 9, 10],
        caseRow: {
          assigned_to_user_id: 54,
          portfolio_region_id: 2,
          owner_region_id: null,
        },
      })
    ).toEqual({ allowed: true, reason: 'direct_assignment' });
  });

  test('allows an unassigned case when the Regional Manager has region scope', () => {
    expect(
      evaluateRegionalManagerCaseAccess({
        requesterId: 54,
        regionIds: [7],
        caseRow: {
          assigned_to_user_id: null,
          portfolio_region_id: 2,
          owner_region_id: null,
        },
      })
    ).toEqual({ allowed: true, reason: 'unassigned' });
  });

  test('allows a case when the portfolio region matches', () => {
    expect(
      evaluateRegionalManagerCaseAccess({
        requesterId: 54,
        regionIds: [7],
        caseRow: {
          assigned_to_user_id: 81,
          portfolio_region_id: 7,
          owner_region_id: null,
        },
      })
    ).toEqual({ allowed: true, reason: 'portfolio_region' });
  });

  test('returns region_scope_missing for a non-assigned case with no regions', () => {
    expect(
      getRegionalManagerCaseAccessError({
        requesterId: 54,
        regionIds: [],
        caseRow: {
          assigned_to_user_id: 81,
          portfolio_region_id: 2,
          owner_region_id: null,
        },
      })
    ).toEqual({
      status: 403,
      body: { error: 'forbidden', detail: 'region_scope_missing' },
    });
  });

  test('returns region_scope_mismatch when the case is neither assigned nor region-matched', () => {
    expect(
      getRegionalManagerCaseAccessError({
        requesterId: 54,
        regionIds: [7],
        caseRow: {
          assigned_to_user_id: 81,
          portfolio_region_id: 2,
          owner_region_id: 1,
        },
      })
    ).toEqual({
      status: 403,
      body: { error: 'forbidden', detail: 'region_scope_mismatch' },
    });
  });

  test('treats zero assignee values as unassigned', () => {
    expect(
      evaluateRegionalManagerCaseAccess({
        requesterId: 54,
        regionIds: [7],
        caseRow: {
          assigned_to_user_id: 0,
          portfolio_region_id: 2,
          owner_region_id: null,
        },
      })
    ).toEqual({ allowed: true, reason: 'unassigned' });
  });

  test('allows an ISET Coordinator only on directly assigned cases', () => {
    expect(
      evaluateCaseAccess({
        role: 'ISET Coordinator',
        requesterId: 54,
        caseRow: { assigned_to_user_id: 54 },
      })
    ).toEqual({ allowed: true, reason: 'direct_assignment' });

    expect(
      getCaseAccessError({
        role: 'ISET Coordinator',
        requesterId: 54,
        caseRow: { assigned_to_user_id: 81 },
      })
    ).toEqual({
      status: 403,
      body: { error: 'forbidden', detail: 'assessor_scope_mismatch' },
    });
  });

  test('normalizes Cognito-style role names for case access', () => {
    expect(
      evaluateCaseAccess({
        role: 'Regional_Manager',
        requesterId: 54,
        regionIds: [7],
        caseRow: {
          assigned_to_user_id: 81,
          portfolio_region_id: 7,
          owner_region_id: null,
        },
      })
    ).toEqual({ allowed: true, reason: 'portfolio_region' });
  });
});
