// Utility: Describe a MySQL table. Usage: node scripts/describe-table.js <schema.table or table>
// Loads credentials from environment (use env-cmd -f .env).

const mysql = require('mysql2/promise');

function quoteIdent(ident) {
  // Quote identifier with backticks and handle schema.table
  if (!ident) return ident;
  if (ident.includes('.')) {
    const [schema, table] = ident.split('.', 2);
    return `\`${schema}\`.\`${table}\``;
  }
  return `\`${ident}\``;
}

async function main() {
  const tableArg = process.argv[2];
  if (!tableArg) {
    console.error('Usage: node scripts/describe-table.js <schema.table or table>');
    process.exit(1);
  }

  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || undefined,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  };

  let conn;
  try {
    conn = await mysql.createConnection(config);
    const q = `DESCRIBE ${quoteIdent(tableArg)};`;
    const [rows] = await conn.query(q);
    // Print as a simple table
    console.log(`DESCRIBE ${tableArg}`);
    console.table(rows);

    // Also show create table for completeness (best-effort)
    try {
      const [crt] = await conn.query(`SHOW CREATE TABLE ${quoteIdent(tableArg)};`);
      const ddl = crt && crt[0] && (crt[0]['Create Table'] || crt[0]['Create View']);
      if (ddl) {
        console.log('\n-- SHOW CREATE TABLE --');
        console.log(ddl);
      }
    } catch (e) {
      // ignore if not supported
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 2;
  } finally {
    if (conn) await conn.end();
  }
}

main();
