'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const { pipeline } = require('stream/promises');
const mysql = require('mysql2/promise');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SUPPORTED_SOURCE_ENVIRONMENTS = ['dev'];

const SAFE_DATA_TABLES = [
  '__migrations',
  'blockstep',
  'budget_allocation',
  'budget_pot',
  'budget_pot_draft',
  'budget_pot_region',
  'budget_snapshot',
  'budget_snapshot_pot',
  'budget_snapshot_pot_region',
  'budget_spend_curve',
  'canada_region',
  'cfa_series',
  'cfa_version',
  'cfa_version_documents',
  'component',
  'component_template',
  'component_template_backup',
  'document_type',
  'esdc_intervention_code',
  'esdc_intervention_outcome',
  'funding_stream',
  'iset_migration',
  'noc_code',
  'noc_version',
  'notification_template',
  'organization',
  'ptma',
  'schema_migrations',
  'sla_stage_target',
  'step',
  'step_component',
  'workflow',
  'workflow_route',
  'workflow_route_option',
  'workflow_step',
];

const FILTERED_DATA_TABLES = [
  {
    table: 'iset_runtime_config',
    where: "scope = 'publish' AND k = 'workflow.schema.intake'",
    description: 'Published intake runtime row only',
  },
];

function findWindowsMysqlDump() {
  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MySQL', 'MySQL Server 8.0', 'bin', 'mysqldump.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'MySQL', 'MySQL Server 8.0', 'bin', 'mysqldump.exe'),
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function quoteBashArgument(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function toBashPath(filePath) {
  if (!filePath) {
    return filePath;
  }
  if (filePath.startsWith('/')) {
    return filePath;
  }
  if (/^[A-Za-z]:\\/.test(filePath)) {
    const drive = filePath[0].toLowerCase();
    const rest = filePath.slice(2).replace(/\\/g, '/').replace(/^\/+/, '');
    return `/mnt/${drive}/${rest}`;
  }
  return filePath.replace(/\\/g, '/');
}

function unquoteEnvValue(value) {
  const trimmed = String(value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(envFilePath) {
  const absolutePath = path.isAbsolute(envFilePath)
    ? envFilePath
    : path.resolve(REPO_ROOT, envFilePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Env file not found: ${absolutePath}`);
  }

  const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  const values = {};
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const normalized = line.startsWith('export ') ? line.slice(7) : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = normalized.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(normalized.slice(separatorIndex + 1));
    if (key) {
      values[key] = value;
    }
  }

  return {
    absolutePath,
    values,
  };
}

function getSourceConnectionConfig(sourceEnv, envValues) {
  if (sourceEnv !== 'dev') {
    throw new Error(
      `Unsupported source environment: ${sourceEnv}. Current implementation supports ${SUPPORTED_SOURCE_ENVIRONMENTS.join(', ')} only.`
    );
  }

  const config = {
    host: envValues.DB_HOST,
    port: envValues.DB_PORT ? Number(envValues.DB_PORT) : 3306,
    user: envValues.DB_USER,
    password: envValues.DB_PASS || '',
    database: envValues.DB_NAME,
    charset: 'utf8mb4_unicode_ci',
  };

  if (!config.host || !config.user || !config.database) {
    throw new Error('Source env file must provide DB_HOST, DB_USER, and DB_NAME');
  }

  return config;
}

function ensureToolAvailable(command) {
  if (process.platform === 'win32') {
    if (command === 'mysqldump' && findWindowsMysqlDump()) {
      return;
    }
    const result = spawnSync('bash', ['-lc', `command -v ${quoteBashArgument(command)} >/dev/null 2>&1`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      throw new Error(`Required tool "${command}" is not available in the bash/WSL PATH`);
    }
    return;
  }
  const probe = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (probe.error || probe.status !== 0) {
    throw new Error(`Required tool "${command}" is not available on PATH`);
  }
}

async function listSourceTables(connectionConfig) {
  const connection = await mysql.createConnection(connectionConfig);
  try {
    const [rows] = await connection.query('SHOW FULL TABLES');
    if (!Array.isArray(rows) || !rows.length) {
      return [];
    }

    const tableNameKey = Object.keys(rows[0]).find(key => key.toLowerCase().includes('tables_in_'));
    const tableTypeKey = Object.keys(rows[0]).find(key => key.toLowerCase() === 'table_type');
    if (!tableNameKey || !tableTypeKey) {
      throw new Error('Could not determine table metadata from SHOW FULL TABLES');
    }

    return rows.map(row => ({
      name: row[tableNameKey],
      type: row[tableTypeKey],
    }));
  } finally {
    await connection.end();
  }
}

function resolveOutputPath(outputPath, sourceEnv) {
  if (outputPath) {
    return path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(REPO_ROOT, outputPath);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(os.tmpdir(), `path-test-db-refresh-${sourceEnv}-${stamp}.sql.gz`);
}

function appendFileText(filePath, text) {
  fs.appendFileSync(filePath, text, 'utf8');
}

function buildMysqlDumpArgs(connectionConfig, dumpOptions = [], tables = []) {
  return [
    '--single-transaction',
    '--skip-lock-tables',
    '--skip-dump-date',
    '--set-gtid-purged=OFF',
    '--protocol=TCP',
    ...dumpOptions,
    '-h',
    connectionConfig.host,
    '-P',
    String(connectionConfig.port),
    '-u',
    connectionConfig.user,
    connectionConfig.database,
    ...tables,
  ];
}

function appendMysqlDump(filePath, connectionConfig, dumpOptions = [], tables = []) {
  if (process.platform === 'win32') {
    const windowsMysqlDump = findWindowsMysqlDump();
    if (windowsMysqlDump) {
      const fileDescriptor = fs.openSync(filePath, 'a');
      try {
        const result = spawnSync(windowsMysqlDump, buildMysqlDumpArgs(connectionConfig, dumpOptions, tables), {
          env: {
            ...process.env,
            MYSQL_PWD: connectionConfig.password || '',
          },
          encoding: 'utf8',
          stdio: ['ignore', fileDescriptor, 'pipe'],
        });
        if (result.status !== 0) {
          throw new Error((result.stderr || 'mysqldump failed').trim());
        }
        return;
      } finally {
        fs.closeSync(fileDescriptor);
      }
    }

    const dumpArgs = buildMysqlDumpArgs(connectionConfig, dumpOptions, tables)
      .map(quoteBashArgument)
      .join(' ');
    const commandText = [
      `export MYSQL_PWD=${quoteBashArgument(connectionConfig.password || '')}`,
      `mysqldump ${dumpArgs} >> ${quoteBashArgument(toBashPath(filePath))}`,
    ].join(' && ');
    const result = spawnSync('bash', ['-lc', commandText], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'mysqldump failed').trim());
    }
    return;
  }

  const fileDescriptor = fs.openSync(filePath, 'a');
  try {
    const result = spawnSync('mysqldump', buildMysqlDumpArgs(connectionConfig, dumpOptions, tables), {
      env: {
        ...process.env,
        MYSQL_PWD: connectionConfig.password || '',
      },
      encoding: 'utf8',
      stdio: ['ignore', fileDescriptor, 'pipe'],
    });

    if (result.status !== 0) {
      throw new Error((result.stderr || 'mysqldump failed').trim());
    }
  } finally {
    fs.closeSync(fileDescriptor);
  }
}

async function gzipFile(inputPath, outputPath) {
  await pipeline(
    fs.createReadStream(inputPath),
    zlib.createGzip({ level: 9 }),
    fs.createWriteStream(outputPath)
  );
}

async function buildSourceSnapshotPlan({ sourceEnv = 'dev', envFile = '.env', outputPath = null } = {}) {
  const envInfo = loadEnvFile(envFile);
  const connectionConfig = getSourceConnectionConfig(sourceEnv, envInfo.values);

  ensureToolAvailable('mysqldump');

  const availableTables = await listSourceTables(connectionConfig);
  const availableTableNames = new Set(
    availableTables
      .filter(table => table.type === 'BASE TABLE')
      .map(table => table.name)
  );

  const includedDataTables = SAFE_DATA_TABLES.filter(table => availableTableNames.has(table));
  const filteredTableDumps = FILTERED_DATA_TABLES
    .filter(entry => availableTableNames.has(entry.table))
    .map(entry => ({
      table: entry.table,
      where: entry.where,
      description: entry.description,
    }));

  return {
    sourceEnv,
    loadedEnvFile: envInfo.absolutePath,
    outputPath: resolveOutputPath(outputPath, sourceEnv),
    snapshotMode: 'schema-plus-allowlisted-data',
    database: {
      host: connectionConfig.host,
      port: connectionConfig.port,
      database: connectionConfig.database,
      user: connectionConfig.user,
    },
    tableInventory: {
      total: availableTables.length,
      baseTables: availableTables.filter(table => table.type === 'BASE TABLE').length,
      views: availableTables.filter(table => table.type === 'VIEW').length,
    },
    dataSelection: {
      safeTables: includedDataTables,
      filteredTables: filteredTableDumps,
      excludedTableCount: Math.max(
        availableTables.filter(table => table.type === 'BASE TABLE').length
          - includedDataTables.length
          - filteredTableDumps.length,
        0
      ),
    },
  };
}

async function buildSourceSnapshot({ sourceEnv = 'dev', envFile = '.env', outputPath = null } = {}) {
  const plan = await buildSourceSnapshotPlan({ sourceEnv, envFile, outputPath });
  const envInfo = loadEnvFile(envFile);
  const connectionConfig = getSourceConnectionConfig(sourceEnv, envInfo.values);
  const finalOutputPath = plan.outputPath;
  const gzipOutput = finalOutputPath.endsWith('.gz');
  const sqlOutputPath = gzipOutput ? finalOutputPath.replace(/\.gz$/i, '') : finalOutputPath;

  fs.mkdirSync(path.dirname(finalOutputPath), { recursive: true });
  if (fs.existsSync(sqlOutputPath)) {
    fs.unlinkSync(sqlOutputPath);
  }
  if (gzipOutput && fs.existsSync(finalOutputPath)) {
    fs.unlinkSync(finalOutputPath);
  }

  appendFileText(
    sqlOutputPath,
    [
      '-- PATH TEST refresh source snapshot',
      `-- Source environment: ${plan.sourceEnv}`,
      `-- Source env file: ${plan.loadedEnvFile}`,
      `-- Snapshot mode: ${plan.snapshotMode}`,
      `-- Source database: ${plan.database.database}`,
      `-- Safe data tables: ${plan.dataSelection.safeTables.join(', ') || '(none)'}`,
      `-- Filtered tables: ${plan.dataSelection.filteredTables.map(entry => `${entry.table} [${entry.description}]`).join(', ') || '(none)'}`,
      '',
    ].join('\n')
  );

  appendMysqlDump(sqlOutputPath, connectionConfig, ['--no-data']);
  if (plan.dataSelection.safeTables.length) {
    appendMysqlDump(sqlOutputPath, connectionConfig, ['--no-create-info'], plan.dataSelection.safeTables);
  }
  plan.dataSelection.filteredTables.forEach(entry => {
    appendMysqlDump(
      sqlOutputPath,
      connectionConfig,
      ['--no-create-info', '--where', entry.where],
      [entry.table]
    );
  });

  let cleanupSqlPath = null;
  let finalStatsPath = sqlOutputPath;
  if (gzipOutput) {
    await gzipFile(sqlOutputPath, finalOutputPath);
    cleanupSqlPath = sqlOutputPath;
    finalStatsPath = finalOutputPath;
    fs.unlinkSync(sqlOutputPath);
  }

  const stats = fs.statSync(finalStatsPath);
  return {
    ...plan,
    generatedAt: new Date().toISOString(),
    outputPath: finalOutputPath,
    outputFormat: gzipOutput ? 'sql.gz' : 'sql',
    sizeBytes: stats.size,
    cleanupSqlPath,
  };
}

module.exports = {
  SAFE_DATA_TABLES,
  FILTERED_DATA_TABLES,
  SUPPORTED_SOURCE_ENVIRONMENTS,
  buildSourceSnapshotPlan,
  buildSourceSnapshot,
};
