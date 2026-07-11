const { SchemaReadinessError, assertEnumValueReady, assertRuntimeTableReady } = require('../src/lib/schemaReadiness');

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
});
