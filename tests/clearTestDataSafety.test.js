const { Blob, File } = require('buffer');
const { ReadableStream } = require('stream/web');
const { MessageChannel, MessagePort } = require('worker_threads');
const { createSyntheticTestEnvironment } = require('../scripts/run-test-all');

global.Blob = global.Blob || Blob;
global.File = global.File || File;
global.ReadableStream = global.ReadableStream || ReadableStream;
global.MessageChannel = global.MessageChannel || MessageChannel;
global.MessagePort = global.MessagePort || MessagePort;
global.DOMException = global.DOMException || class DOMException extends Error {
  constructor(message = '', name = 'Error') {
    super(message);
    this.name = name;
  }
};

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

describe('Clear Test Data dependency safety', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
  let syntheticTestEnvironment;
  let compileClearTestDataDeletionPlan;
  let buildClearTestDataDeletionPlan;
  let detachClearTestDataSelfReferences;
  let resolveClearTestDataEnvironmentSafety;
  let ISET_TEST_DATA_TABLE_ORDER;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;
    ({
      compileClearTestDataDeletionPlan,
      buildClearTestDataDeletionPlan,
      detachClearTestDataSelfReferences,
      resolveClearTestDataEnvironmentSafety,
      ISET_TEST_DATA_TABLE_ORDER,
    } = require('../isetadminserver'));
  });

  afterAll(() => {
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
    if (previousTestEnvironmentFile === undefined) delete process.env.PATH_TEST_ENV_FILE;
    else process.env.PATH_TEST_ENV_FILE = previousTestEnvironmentFile;
    if (syntheticTestEnvironment) {
      expect(syntheticTestEnvironment.cleanup()).toBe(true);
    }
  });

  const baseTable = table => ({
    TABLE_SCHEMA: 'iset_admin',
    TABLE_NAME: table,
    TABLE_TYPE: 'BASE TABLE',
  });
  const foreignKey = ({
    table,
    referencedTable,
    column = 'parent_id',
    referencedColumn = 'id',
    constraint = `fk_${table}_${referencedTable}`,
  }) => ({
    TABLE_SCHEMA: 'iset_admin',
    TABLE_NAME: table,
    CONSTRAINT_NAME: constraint,
    COLUMN_NAME: column,
    REFERENCED_TABLE_SCHEMA: 'iset_admin',
    REFERENCED_TABLE_NAME: referencedTable,
    REFERENCED_COLUMN_NAME: referencedColumn,
    ORDINAL_POSITION: 1,
  });

  test('environment proof rejects any production indicator and unknown environments', () => {
    expect(resolveClearTestDataEnvironmentSafety({
      ALLOWED_ORIGIN: 'https://test-admin.example.invalid',
      DB_HOST: 'nwac-prod-db.example.invalid',
    })).toMatchObject({
      allowed: false,
      label: 'Production',
      reason: 'production_indicator_present',
      indicators: ['DB_HOST'],
    });
    expect(resolveClearTestDataEnvironmentSafety({
      ALLOWED_ORIGIN: 'http://localhost:3001',
      NODE_ENV: 'production',
    })).toMatchObject({
      allowed: true,
      label: 'Development',
    });
    expect(resolveClearTestDataEnvironmentSafety({ NODE_ENV: 'production' })).toMatchObject({
      allowed: false,
      label: 'Unknown',
      reason: 'non_production_environment_not_proven',
    });
  });

  test('live metadata produces child-before-parent order and a transactional self-FK detachment plan', async () => {
    const calls = [];
    const connection = {
      query: jest.fn(async (sql, params = []) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: normalizedSql, params });
        if (normalizedSql === 'SELECT DATABASE()') {
          return [[{ 'DATABASE()': 'iset_admin' }], []];
        }
        if (normalizedSql.includes('FROM information_schema.TABLES')) {
          return [[baseTable('parent'), baseTable('self_version'), baseTable('child')], []];
        }
        if (normalizedSql.includes('FROM information_schema.COLUMNS')) {
          return [[{
            TABLE_SCHEMA: 'iset_admin',
            TABLE_NAME: 'self_version',
            COLUMN_NAME: 'supersedes_id',
            IS_NULLABLE: 'YES',
            ORDINAL_POSITION: 2,
          }], []];
        }
        if (normalizedSql.includes('FROM information_schema.KEY_COLUMN_USAGE')) {
          return [[
            foreignKey({ table: 'child', referencedTable: 'parent' }),
            foreignKey({
              table: 'self_version',
              referencedTable: 'self_version',
              column: 'supersedes_id',
              constraint: 'fk_self_version_supersedes',
            }),
          ], []];
        }
        if (normalizedSql === 'UPDATE `iset_admin`.`self_version` SET `supersedes_id` = NULL') {
          return [{ affectedRows: 2 }, []];
        }
        throw new Error(`unexpected_query:${normalizedSql}`);
      }),
    };

    const plan = await buildClearTestDataDeletionPlan(
      connection,
      ['parent', 'self_version', 'child']
    );
    const order = plan.deletionOrder.map(table => table.configuredName);
    expect(order.indexOf('child')).toBeLessThan(order.indexOf('parent'));
    expect(plan.selfReferenceDetachments).toMatchObject([{
      table: { configuredName: 'self_version' },
      columns: ['supersedes_id'],
    }]);
    expect(calls).toHaveLength(4);
    expect(calls.every(call => /^(SELECT)\b/i.test(call.sql))).toBe(true);
    expect(calls.some(call => call.sql.includes('FOREIGN_KEY_CHECKS'))).toBe(false);

    await expect(detachClearTestDataSelfReferences(connection, plan)).resolves.toEqual([{
      table: 'self_version',
      columns: ['supersedes_id'],
      detachedRows: 2,
    }]);
  });

  test('an unlisted table referencing a clear target fails before a deletion plan is returned', () => {
    expect(() => compileClearTestDataDeletionPlan({
      currentSchema: 'iset_admin',
      configuredTableNames: ['parent'],
      tableRows: [baseTable('parent'), baseTable('external_hold')],
      columnRows: [],
      foreignKeyRows: [foreignKey({ table: 'external_hold', referencedTable: 'parent' })],
    })).toThrow('clear_test_data_unlisted_referencing_tables');
  });

  test('durable message-send operations are listed and deleted before their messages', () => {
    expect(ISET_TEST_DATA_TABLE_ORDER).toContain('message_send_operation');
    expect(ISET_TEST_DATA_TABLE_ORDER.indexOf('message_send_operation'))
      .toBeLessThan(ISET_TEST_DATA_TABLE_ORDER.indexOf('iset_intake.messages'));

    const plan = compileClearTestDataDeletionPlan({
      currentSchema: 'iset_admin',
      configuredTableNames: ['messages', 'message_send_operation'],
      tableRows: [baseTable('messages'), baseTable('message_send_operation')],
      columnRows: [],
      foreignKeyRows: [foreignKey({
        table: 'message_send_operation',
        referencedTable: 'messages',
        column: 'message_id',
        constraint: 'fk_message_send_operation_message',
      })],
    });

    expect(plan.deletionOrder.map(table => table.configuredName)).toEqual([
      'message_send_operation',
      'messages',
    ]);
  });

  test('cross-table FK cycles and non-nullable self references fail closed', () => {
    expect(() => compileClearTestDataDeletionPlan({
      currentSchema: 'iset_admin',
      configuredTableNames: ['alpha', 'beta'],
      tableRows: [baseTable('alpha'), baseTable('beta')],
      columnRows: [],
      foreignKeyRows: [
        foreignKey({ table: 'alpha', referencedTable: 'beta' }),
        foreignKey({ table: 'beta', referencedTable: 'alpha' }),
      ],
    })).toThrow('clear_test_data_foreign_key_cycle');

    expect(() => compileClearTestDataDeletionPlan({
      currentSchema: 'iset_admin',
      configuredTableNames: ['self_locked'],
      tableRows: [baseTable('self_locked')],
      columnRows: [{
        TABLE_SCHEMA: 'iset_admin',
        TABLE_NAME: 'self_locked',
        COLUMN_NAME: 'parent_id',
        IS_NULLABLE: 'NO',
      }],
      foreignKeyRows: [foreignKey({
        table: 'self_locked',
        referencedTable: 'self_locked',
      })],
    })).toThrow('clear_test_data_self_reference_not_detachable');
  });
});
