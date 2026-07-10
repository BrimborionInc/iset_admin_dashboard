const { scopePredicate } = require('../src/lib/rbac');

describe('RBAC scopePredicate', () => {
  test('System Administrator sees all', () => {
    const { sql, params } = scopePredicate('a', { role: 'System Administrator' });
    expect(sql).toBe('1=1');
    expect(params).toEqual([]);
  });
  test('NWAC Administrator sees all', () => {
    const { sql, params } = scopePredicate('a', { role: 'NWAC Administrator' });
    expect(sql).toBe('1=1');
    expect(params).toEqual([]);
  });
  test('Regional Manager is scoped by region', () => {
    const { sql, params } = scopePredicate('a', { role: 'Regional Manager', regionId: 3 });
    expect(sql).toBe('a.region_id = ?');
    expect(params).toEqual([3]);
  });
  test('ISET Coordinator is scoped by region and staff-profile assignment', () => {
    const { sql, params } = scopePredicate('c', {
      role: 'ISET Coordinator',
      regionId: 2,
      staffProfileId: 42,
    });
    expect(sql).toBe('c.region_id = ? AND c.assigned_staff_profile_id = ?');
    expect(params).toEqual([2, 42]);
  });
  test.each(['SysAdmin', 'ProgramAdmin', 'RegionalCoordinator', 'Adjudicator', 'unknown'])(
    'retired or unknown role %s fails closed',
    role => {
      expect(scopePredicate('a', { role, regionId: 3, userId: 42 })).toEqual({ sql: '0=1', params: [] });
    }
  );
});
