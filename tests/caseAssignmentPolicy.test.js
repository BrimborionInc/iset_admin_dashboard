const { ensureCanAssignCase } = require('../src/lib/caseAssignmentPolicy');

describe('caseAssignmentPolicy', () => {
  const activeCoordinator = {
    id: 81,
    role: 'ISET Coordinator',
    regionId: 2,
    status: 'active',
  };

  test('allows a Regional Manager to assign to active staff outside their regions', () => {
    expect(
      ensureCanAssignCase(
        { role: 'Regional Manager', regionId: 7, regionIds: [7, 9] },
        activeCoordinator
      )
    ).toBe(true);
  });

  test('allows a Regional Manager to assign to another active Regional Manager', () => {
    expect(
      ensureCanAssignCase(
        { role: 'Regional Manager', regionIds: [7] },
        { id: 54, role: 'Regional Manager', regionId: 11, status: 'active' }
      )
    ).toBe(true);
  });

  test('keeps ISET Coordinators from assigning cases', () => {
    expect(
      ensureCanAssignCase(
        { role: 'ISET Coordinator', regionIds: [2] },
        activeCoordinator
      )
    ).toBe(false);
  });

  test('rejects inactive or missing assignment targets', () => {
    expect(
      ensureCanAssignCase(
        { role: 'Regional Manager', regionIds: [7] },
        { ...activeCoordinator, status: 'inactive' }
      )
    ).toBe(false);
    expect(ensureCanAssignCase({ role: 'Regional Manager', regionIds: [7] }, null)).toBe(false);
  });

  test('supports Cognito-style assignment-capable role names', () => {
    expect(
      ensureCanAssignCase(
        { role: 'Regional_Manager', regionIds: [] },
        activeCoordinator
      )
    ).toBe(true);
  });
});
