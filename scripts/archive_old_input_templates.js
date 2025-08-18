#!/usr/bin/env node
/*
 Archives older versions of the 'input' component template, leaving only the latest version active.
 Usage:
   env-cmd -f .env.development node scripts/archive_old_input_templates.js
 or set DB_* env vars and run:
   node scripts/archive_old_input_templates.js
*/
const mysql = require('mysql2/promise');

async function main() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'iset_intake',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    multipleStatements: false,
  };

  let conn;
  try {
    conn = await mysql.createConnection(config);
    const [rows] = await conn.query(
      "SELECT id, template_key, version, status FROM iset_intake.component_template WHERE template_key = 'input' ORDER BY version"
    );
    if (!rows.length) {
      console.log("No 'input' templates found.");
      return;
    }
    const latest = Math.max(...rows.map(r => Number(r.version) || 0));
    const toArchive = rows.filter(r => Number(r.version) !== latest && r.status === 'active');
    if (!toArchive.length) {
      console.log(`Nothing to archive. Latest version is ${latest}; older versions are not active.`);
      return;
    }
    const ids = toArchive.map(r => r.id);
    const [res] = await conn.query(
      `UPDATE iset_intake.component_template SET status = 'archived' WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    console.log(`Archived ${res.affectedRows} rows. Latest version remains active: v${latest}.`);
  } catch (e) {
    console.error('Failed to archive old input templates:', e.message || e);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
}

main();
