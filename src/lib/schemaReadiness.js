class SchemaReadinessError extends Error {
  constructor({ table, columns = [], cause }) {
    super(`Required database schema is not ready: ${table}${columns.length ? ` (${columns.join(', ')})` : ''}`);
    this.name = 'SchemaReadinessError';
    this.code = 'schema_not_ready';
    this.table = table;
    this.columns = columns;
    this.cause = cause;
  }
}

function quoteIdentifier(value) {
  const identifier = String(value || '');
  if (!/^[A-Za-z0-9_]+$/u.test(identifier)) throw new Error(`Unsafe schema identifier: ${identifier}`);
  return `\`${identifier}\``;
}

async function assertRuntimeTableReady(connection, table, columns = []) {
  const selected = columns.length ? columns.map(quoteIdentifier).join(', ') : '1';
  try {
    await connection.query(`SELECT ${selected} FROM ${quoteIdentifier(table)} LIMIT 0`);
    return true;
  } catch (cause) {
    throw new SchemaReadinessError({ table, columns, cause });
  }
}

async function assertEnumValueReady(connection, table, column, requiredValue) {
  const [rows] = await connection.query(
    `SELECT column_type
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1`,
    [table, column]
  );
  const columnType = String(rows?.[0]?.column_type || rows?.[0]?.COLUMN_TYPE || '');
  if (!columnType || !columnType.includes(`'${requiredValue}'`)) {
    throw new SchemaReadinessError({ table, columns: [column] });
  }
  return true;
}

module.exports = { SchemaReadinessError, assertEnumValueReady, assertRuntimeTableReady };

