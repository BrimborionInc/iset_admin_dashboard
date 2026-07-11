#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
const {
  SERVICE_ANNOUNCEMENT_SCOPE,
  SERVICE_ANNOUNCEMENT_KEY,
  normaliseServiceAnnouncement,
} = require('../../shared/serviceAnnouncement');

const REPO_ROOT = path.resolve(__dirname, '..');
const REMOTE_TARGETS = {
  test: {
    targetEnv: 'test',
    defaultProfile: 'nwac-test',
    defaultRegion: 'ca-central-1',
    helperScript: path.join(REPO_ROOT, 'scripts', 'run-test-sql-via-ssm.sh'),
  },
  prod: {
    targetEnv: 'prod',
    defaultProfile: 'nwac-prod',
    defaultRegion: 'ca-central-1',
    helperScript: path.join(REPO_ROOT, 'scripts', 'run-prod-sql-via-ssm.sh'),
  },
};

function usage() {
  console.log([
    'Usage: node scripts/path-maintenance.js <set|clear> [options]',
    '',
    'Commands:',
    '  set      Publish a maintenance announcement',
    '  clear    Remove the active maintenance announcement',
    '',
    'Options:',
    '  --env NAME             Target environment: dev, test, or prod. Default: dev',
    '  --env-file PATH        Env file for dev mode. Default: .env',
    '  --profile NAME         AWS profile override for test/prod',
    '  --region REGION        AWS region override for test/prod. Default: ca-central-1',
    '  --start-now            Start immediately',
    '  --start-in DURATION    Relative lead time (examples: 5m, 30s, 1h)',
    '  --starts-at ISO        Absolute UTC/local timestamp for maintenance start',
    '  --expected-duration D  Expected downtime (examples: 20m, 45m, 2h)',
    '  --surfaces LIST        admin, portal, or all. Default: all',
    '  --title TEXT           Optional English banner title',
    '  --body TEXT            Optional English banner body',
    '  --message TEXT         Alias for --body',
    '  --unscheduled          Mark the event as unscheduled',
    '  --yes                  Required for prod mutations',
    '  --json                 Emit machine-readable JSON',
    '  --help                 Show this help',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = {
    command: null,
    env: 'dev',
    envFile: null,
    profile: null,
    region: null,
    startNow: false,
    startIn: null,
    startsAt: null,
    expectedDuration: null,
    surfaces: 'all',
    title: null,
    body: null,
    unscheduled: false,
    yes: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--env') {
      args.env = String(argv[++index] || '').toLowerCase();
    } else if (token === '--env-file') {
      args.envFile = argv[++index];
    } else if (token === '--profile') {
      args.profile = argv[++index];
    } else if (token === '--region') {
      args.region = argv[++index];
    } else if (token === '--start-now') {
      args.startNow = true;
    } else if (token === '--start-in') {
      args.startIn = argv[++index];
    } else if (token === '--starts-at') {
      args.startsAt = argv[++index];
    } else if (token === '--expected-duration') {
      args.expectedDuration = argv[++index];
    } else if (token === '--surfaces') {
      args.surfaces = argv[++index];
    } else if (token === '--title') {
      args.title = argv[++index];
    } else if (token === '--body' || token === '--message') {
      args.body = argv[++index];
    } else if (token === '--unscheduled') {
      args.unscheduled = true;
    } else if (token === '--yes') {
      args.yes = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--help' || token === '-h') {
      args.command = 'help';
    } else if (token.startsWith('-')) {
      throw new Error(`Unknown option: ${token}`);
    } else if (!args.command) {
      args.command = token;
    } else {
      throw new Error(`Unexpected argument: ${token}`);
    }
  }

  return args;
}

function toBashPath(filePath) {
  if (!filePath) return filePath;
  if (filePath.startsWith('/')) return filePath;
  if (/^[A-Za-z]:\\/.test(filePath)) {
    const drive = filePath[0].toLowerCase();
    const rest = filePath.slice(2).replace(/\\/g, '/').replace(/^\/+/, '');
    return `/mnt/${drive}/${rest}`;
  }
  return filePath.replace(/\\/g, '/');
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
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
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice(7) : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = normalized.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(normalized.slice(separatorIndex + 1));
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return absolutePath;
}

function parseDurationToMs(value) {
  if (value == null) return null;
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/);
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }
  const amount = Number(match[1]);
  const unit = match[2] || 'm';
  const multiplier = unit === 'ms'
    ? 1
    : unit === 's'
      ? 1000
      : unit === 'm'
        ? 60 * 1000
        : unit === 'h'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
  return Math.round(amount * multiplier);
}

function resolveStartTimestamp(args) {
  if (args.startNow) {
    return new Date().toISOString();
  }
  if (args.startIn) {
    return new Date(Date.now() + parseDurationToMs(args.startIn)).toISOString();
  }
  if (args.startsAt) {
    const date = new Date(args.startsAt);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid --starts-at value: ${args.startsAt}`);
    }
    return date.toISOString();
  }
  return null;
}

function resolveExpectedDurationMinutes(value) {
  if (!value) return null;
  const durationMs = parseDurationToMs(value);
  return Math.max(1, Math.round(durationMs / 60000));
}

function buildAnnouncementPayload(args) {
  const startsAt = resolveStartTimestamp(args);
  const expectedDurationMinutes = resolveExpectedDurationMinutes(args.expectedDuration);
  const payload = normaliseServiceAnnouncement({
    enabled: true,
    status: args.unscheduled ? 'unscheduled' : 'scheduled',
    severity: 'warning',
    surfaces: args.surfaces || 'all',
    startsAt,
    expectedDurationMinutes,
    title: { en: args.title || '' },
    body: { en: args.body || '' },
    updatedAt: new Date().toISOString(),
  });
  return payload;
}

function getDbConfig() {
  const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: 'utf8mb4_unicode_ci',
    multipleStatements: false,
  };
  if (!config.host || !config.user || !config.database) {
    throw new Error('DB_HOST, DB_USER, and DB_NAME must be set');
  }
  return config;
}

function isRemoteEnv(env) {
  return env === 'test' || env === 'prod';
}

function getRemoteTargetConfig(args) {
  const base = REMOTE_TARGETS[args.env];
  if (!base) {
    throw new Error(`Unsupported remote target environment: ${args.env}`);
  }
  return {
    ...base,
    profile: args.profile || base.defaultProfile,
    region: args.region || base.defaultRegion,
  };
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function buildSetSql(payload) {
  return [
    'SELECT scope, k, v, updated_at FROM iset_runtime_config LIMIT 0;',
    `INSERT INTO iset_runtime_config (scope, k, v) VALUES (${sqlLiteral(SERVICE_ANNOUNCEMENT_SCOPE)}, ${sqlLiteral(SERVICE_ANNOUNCEMENT_KEY)}, CAST(${sqlLiteral(JSON.stringify(payload))} AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;`,
  ].join('\n');
}

function buildClearSql() {
  return `DELETE FROM iset_runtime_config WHERE scope = ${sqlLiteral(SERVICE_ANNOUNCEMENT_SCOPE)} AND k = ${sqlLiteral(SERVICE_ANNOUNCEMENT_KEY)};`;
}

async function runLocalSql(sqlText) {
  const connection = await mysql.createConnection(getDbConfig());
  try {
    await connection.query(sqlText);
  } finally {
    await connection.end();
  }
}

function runRemoteSql(remoteConfig, sqlText) {
  const tempPath = path.join(
    os.tmpdir(),
    `path-maintenance-${remoteConfig.targetEnv}-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`
  );
  fs.writeFileSync(tempPath, sqlText, 'utf8');
  try {
    const args = [
      toBashPath(remoteConfig.helperScript),
      '--sql-file',
      toBashPath(tempPath),
      '--profile',
      remoteConfig.profile,
      '--region',
      remoteConfig.region,
    ];
    const result = spawnSync('bash', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      const failure = (result.stderr || result.stdout || 'Remote SQL execution failed').trim();
      throw new Error(failure);
    }
  } finally {
    try { fs.unlinkSync(tempPath); } catch (_) {}
  }
}

function printHumanResult(result) {
  console.log(`Command: ${result.command}`);
  console.log(`Environment: ${result.env}`);
  if (result.startsAt) console.log(`Starts at: ${result.startsAt}`);
  if (result.expectedDurationMinutes) console.log(`Expected downtime: ${result.expectedDurationMinutes} minutes`);
  if (result.surfaces?.length) console.log(`Surfaces: ${result.surfaces.join(', ')}`);
  if (result.status) console.log(`Status: ${result.status}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || args.command === 'help') {
    usage();
    return;
  }
  if (!['set', 'clear'].includes(args.command)) {
    throw new Error(`Unsupported command: ${args.command}`);
  }
  if (args.env === 'prod' && !args.yes) {
    throw new Error('Prod maintenance mutations require --yes');
  }
  if (args.command === 'set' && args.startNow && (args.startIn || args.startsAt)) {
    throw new Error('Use only one of --start-now, --start-in, or --starts-at');
  }
  if (!isRemoteEnv(args.env)) {
    loadEnvFile(args.envFile || '.env');
  }

  const announcementPayload = args.command === 'set' ? buildAnnouncementPayload(args) : null;
  const sqlText = args.command === 'set'
    ? buildSetSql(announcementPayload)
    : buildClearSql();

  if (isRemoteEnv(args.env)) {
    runRemoteSql(getRemoteTargetConfig(args), sqlText);
  } else {
    await runLocalSql(sqlText);
  }

  const result = args.command === 'set'
    ? {
        ok: true,
        command: 'set',
        env: args.env,
        ...announcementPayload,
      }
    : {
        ok: true,
        command: 'clear',
        env: args.env,
      };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  printHumanResult(result);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
