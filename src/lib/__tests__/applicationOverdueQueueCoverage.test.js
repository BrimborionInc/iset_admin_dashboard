const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(
  path.join(process.cwd(), 'isetadminserver.js'),
  'utf8'
);

const getFunctionSource = name => {
  const start = serverSource.indexOf(`async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = serverSource.indexOf('\nasync function ', start + 1);
  return serverSource.slice(start, next === -1 ? undefined : next);
};

describe('application overdue queue coverage', () => {
  it('counts program-admin overdue rows from SLA timing, not weekly decisions', () => {
    const source = getFunctionSource('countProgramAdminOverdue');

    expect(source).toContain('fetchAllApplicationSlaRows(pool)');
    expect(source).toContain('timing.diffHours !== null && timing.diffHours < 0');
    expect(source).not.toContain("LOWER(a.status) IN ('approved','rejected')");
    expect(source).not.toContain('DATE_SUB(CURDATE()');
  });

  it('uses all application SLA rows for the server-side overdue bucket filter', () => {
    const source = getFunctionSource('fetchApplicationIdsForSlaBucket');

    expect(source).toContain(
      "bucket === 'overdue' ? fetchAllApplicationSlaRows(pool) : fetchAllAssignedApplicationSlaRows(pool)"
    );
    expect(source).toContain("case 'overdue':");
    expect(source).toContain('return timing => timing.diffHours !== null && timing.diffHours < 0;');
  });

  it('does not discard unassigned application rows after calculating the overdue bucket', () => {
    const filterStart = serverSource.indexOf('const addWorkQueueBucketFilter =');
    expect(filterStart).toBeGreaterThanOrEqual(0);
    const filterSource = serverSource.slice(filterStart, serverSource.indexOf('const watchColumnName', filterStart));

    expect(filterSource).toContain("case 'overdue':");
    expect(filterSource).toContain('addApplicationIdFilter(clauses, values, slaBucketApplicationIds);');
  });
});
