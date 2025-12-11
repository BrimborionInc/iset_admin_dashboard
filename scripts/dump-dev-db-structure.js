#!/usr/bin/env node
/**
 * Dump the structure (no data) for every table/view in the configured MySQL database.
 * Usage: env-cmd -f .env node scripts/dump-dev-db-structure.js
 *
 * Output: docs/data/DB-Structure-Dump/<db>_<table>.sql
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'docs', 'data', 'DB-Structure-Dump');

function getDbConfig() {
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  return {
    host: process.env.DB_HOST || 'localhost',
    port,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME,
  };
}

function ensureToolAvailable(cmd) {
  const probe = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  if (probe.error) {
    throw new Error(`Required tool "${cmd}" is not available on PATH. Install MySQL client tools or add them to PATH.`);
  }
}

async function listTables(conn, dbName) {
  const [rows] = await conn.query(
    'SHOW FULL TABLES FROM ?? WHERE Table_type IN ("BASE TABLE","VIEW")',
    [dbName]
  );
  if (!rows || rows.length === 0) return [];

  const nameKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes('tables_in'));
  if (!nameKey) {
    throw new Error('Could not determine table name column from SHOW FULL TABLES result.');
  }

  return rows
    .map((row) => row[nameKey])
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function dumpTable(dbConfig, table) {
  const outPath = path.join(OUTPUT_DIR, `${dbConfig.database}_${table}.sql`);
  const tempPath = `${outPath}.tmp`;
  const args = [
    '--no-data',
    '--single-transaction',
    '--skip-dump-date',
    '--set-gtid-purged=OFF',
    '-h',
    dbConfig.host,
    '-P',
    String(dbConfig.port),
    '-u',
    dbConfig.user,
    dbConfig.database,
    table,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn('mysqldump', args, {
      env: { ...process.env, MYSQL_PWD: dbConfig.password || '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const outStream = fs.createWriteStream(tempPath);
    let stderr = '';

    child.stdout.pipe(outStream);

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const finalize = (err) => {
      fs.unlink(tempPath, () => {
        reject(err);
      });
    };

    outStream.on('error', (err) => finalize(err));

    child.on('error', (err) => finalize(err));

    child.on('close', (code) => {
      outStream.close();

      if (code !== 0) {
        const msg = stderr ? stderr.trim() : `mysqldump exited with code ${code}`;
        return finalize(new Error(`[${table}] ${msg}`));
      }

      fs.rename(tempPath, outPath, (renameErr) => {
        if (renameErr) {
          return reject(renameErr);
        }

        if (stderr.trim()) {
          console.warn(`[mysqldump][${table}] ${stderr.trim()}`);
        }

        resolve(outPath);
      });
    });
  });
}

async function main() {
  ensureToolAvailable('mysqldump');

  const dbConfig = getDbConfig();
  if (!dbConfig.database) {
    throw new Error('DB_NAME is not set. Load your .env before running this script.');
  }

  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

  const conn = await mysql.createConnection(dbConfig);
  try {
    const tables = await listTables(conn, dbConfig.database);
    if (tables.length === 0) {
      console.warn(`No tables found in database "${dbConfig.database}".`);
      return;
    }

    console.log(
      `Dumping schema for ${tables.length} tables/views from "${dbConfig.database}" to ${OUTPUT_DIR}`
    );

    for (const table of tables) {
      const outPath = await dumpTable(dbConfig, table);
      console.log(`  • ${table} -> ${outPath}`);
    }

    console.log('Schema dump complete.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Schema dump failed:', err.message || err);
  process.exitCode = 1;
});
