const { scopePredicate } = require('../src/lib/rbac');

describe('RBAC scopePredicate', () => {
  test('SysAdmin sees all', () => {
    const { sql, params } = scopePredicate('a', { role: 'SysAdmin' });
    expect(sql).toBe('1=1');
    expect(params).toEqual([]);
  });
  test('ProgramAdmin sees all', () => {
    const { sql, params } = scopePredicate('a', { role: 'ProgramAdmin' });
    expect(sql).toBe('1=1');
    expect(params).toEqual([]);
  });
  test('RegionalCoordinator scoped by region', () => {
    const { sql, params } = scopePredicate('a', { role: 'RegionalCoordinator', regionId: 3 });
    expect(sql).toBe('a.region_id = ?');
    expect(params).toEqual([3]);
  });
  test('Adjudicator scoped by region and assignment', () => {
    const { sql, params } = scopePredicate('c', { role: 'Adjudicator', regionId: 2, userId: 42 });
    expect(sql).toBe('c.region_id = ? AND c.assigned_to_user_id = ?');
    expect(params).toEqual([2, 42]);
  });
});
