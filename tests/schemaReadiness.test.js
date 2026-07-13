const { SchemaReadinessError, assertEnumValueReady, assertRuntimeTableReady } = require('../src/lib/schemaReadiness');
const {
  ADMIN_RUNTIME_SCHEMA_REQUIREMENTS,
  STAFF_PROFILE_RUNTIME_COLUMNS,
  assertAdminRuntimeSchemaReady,
} = require('../src/lib/adminRuntimeSchemaContract');

describe('runtime schema readiness', () => {
  test('representative runtime flows use read-only probes and need no DDL privilege', async () => {
    const statements = [];
    const connection = {
      query: jest.fn(async sql => {
        statements.push(String(sql));
        return [[], []];
      }),
    };
    await assertRuntimeTableReady(connection, 'staff_profiles', ['id', 'region_id']);
    await assertRuntimeTableReady(connection, 'message_item', ['message_id', 'owner_user_id']);
    expect(statements).toHaveLength(2);
    expect(statements.join('\n')).toMatch(/^SELECT/mu);
    expect(statements.join('\n')).not.toMatch(/\b(?:CREATE|ALTER|DROP|TRUNCATE)\b/iu);
  });

  test('missing schema fails with an actionable readiness error', async () => {
    const cause = Object.assign(new Error('table missing'), { code: 'ER_NO_SUCH_TABLE' });
    const connection = { query: jest.fn(async () => { throw cause; }) };
    await expect(assertRuntimeTableReady(connection, 'staff_profiles', ['id'])).rejects.toEqual(expect.objectContaining({
      code: 'schema_not_ready',
      table: 'staff_profiles',
      cause,
    }));
  });

  test('required enum values are verified without altering the column', async () => {
    const connection = { query: jest.fn(async () => [[{ column_type: "enum('created','prepared')" }], []]) };
    await expect(assertEnumValueReady(connection, 'esdc_participant_submission_history', 'event_type', 'prepared')).resolves.toBe(true);
    await expect(assertEnumValueReady(connection, 'esdc_participant_submission_history', 'event_type', 'missing')).rejects.toBeInstanceOf(SchemaReadinessError);
  });

  test('admin readiness probes the exact authenticated staff hydration contract', async () => {
    const statements = [];
    const connection = {
      query: jest.fn(async (sql) => {
        statements.push(String(sql));
        return String(sql).includes('information_schema.columns')
          ? [[{ column_type: "enum('validated','prepared')" }], []]
          : [[], []];
      }),
    };
    await expect(assertAdminRuntimeSchemaReady(connection)).resolves.toBe(true);
    const staffProbe = statements.find(sql => sql.includes('FROM `staff_profiles`'));
    STAFF_PROFILE_RUNTIME_COLUMNS.forEach(column => expect(staffProbe).toContain(`\`${column}\``));
    expect(ADMIN_RUNTIME_SCHEMA_REQUIREMENTS.find(([table]) => table === 'staff_profiles')[1])
      .toBe(STAFF_PROFILE_RUNTIME_COLUMNS);
    expect(statements.join('\n')).not.toMatch(/\b(?:CREATE|ALTER|DROP|TRUNCATE)\b/iu);
  });
});
