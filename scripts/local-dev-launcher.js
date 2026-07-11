#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const adminRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(adminRoot, '..');

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function nodemonCommand() {
  return process.platform === 'win32' ? 'nodemon.cmd' : 'nodemon';
}

function readEnvFile(filename) {
  if (!fs.existsSync(filename)) return {};
  return Object.fromEntries(fs.readFileSync(filename, 'utf8').split(/\r?\n/u).map(line => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) return null;
    return [match[1], match[2].replace(/^['"]|['"]$/gu, '')];
  }).filter(Boolean));
}

function buildLaunchPlan({ root = workspaceRoot } = {}) {
  const admin = path.join(root, 'admin-dashboard');
  const portal = path.join(root, 'ISET-intake');
  const intacct = path.join(root, 'intacct-mock-service');
  const portalEnv = readEnvFile(path.join(portal, '.env'));
  const minioBinary = path.join(portal, 'minio', process.platform === 'win32' ? 'minio.exe' : 'minio');
  return [
    { name: 'portal-frontend', cwd: portal, command: npmCommand(), args: ['start'], env: { BROWSER: 'none' }, required: true },
    { name: 'portal-backend', cwd: portal, command: nodemonCommand(), args: ['server.js'], env: {}, required: true },
    {
      name: 'minio',
      cwd: portal,
      command: minioBinary,
      args: ['server', 'minio/data', '--address', ':9000', '--console-address', ':9001'],
      env: {
        MINIO_ROOT_USER: portalEnv.OBJECT_ACCESS_KEY || process.env.OBJECT_ACCESS_KEY || '',
        MINIO_ROOT_PASSWORD: portalEnv.OBJECT_SECRET_KEY || process.env.OBJECT_SECRET_KEY || '',
      },
      prepareDirectory: path.join(portal, 'minio', 'data'),
      required: true,
    },
    { name: 'admin-frontend', cwd: admin, command: npmCommand(), args: ['start'], env: { BROWSER: 'none', PORT: '3001' }, required: true },
    { name: 'admin-backend', cwd: admin, command: npmCommand(), args: ['run', 'server'], env: { ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES: 'true' }, required: true },
    { name: 'intacct-mock', cwd: intacct, command: npmCommand(), args: ['start'], env: {}, required: false },
  ];
}

function validateLaunchPlan(plan) {
  const missing = plan.filter(item => item.required && (!fs.existsSync(item.cwd) || (path.isAbsolute(item.command) && !fs.existsSync(item.command))));
  if (missing.length) throw new Error(`Missing required local service directories: ${missing.map(item => item.cwd).join(', ')}`);
  const minio = plan.find(item => item.name === 'minio');
  if (minio && (!minio.env.MINIO_ROOT_USER || !minio.env.MINIO_ROOT_PASSWORD)) {
    throw new Error('MinIO credentials are missing from the portal .env');
  }
  return plan.filter(item => fs.existsSync(item.cwd));
}

function describeLaunchPlan(plan) {
  return plan.map(item => ({
    name: item.name,
    cwd: item.cwd,
    command: item.command,
    args: item.args,
    envKeys: Object.keys(item.env || {}).sort(),
  }));
}

function run(plan) {
  const children = plan.map(item => {
    if (item.prepareDirectory) fs.mkdirSync(item.prepareDirectory, { recursive: true });
    const child = spawn(item.command, item.args, {
      cwd: item.cwd,
      env: { ...process.env, ...item.env },
      stdio: 'inherit',
    });
    child.on('error', error => console.error(`[dev:${item.name}] ${error.message}`));
    return { item, child };
  });
  const stop = signal => {
    children.forEach(({ child }) => { if (!child.killed) child.kill(signal); });
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  children.forEach(({ item, child }) => child.on('exit', (code, signal) => {
    if (code && code !== 0) console.error(`[dev:${item.name}] exited with code ${code}`);
    if (signal) console.error(`[dev:${item.name}] exited from ${signal}`);
  }));
}

if (require.main === module) {
  try {
    const plan = validateLaunchPlan(buildLaunchPlan());
    if (process.argv.includes('--dry-run')) {
      process.stdout.write(`${JSON.stringify(describeLaunchPlan(plan), null, 2)}\n`);
    } else {
      run(plan);
    }
  } catch (error) {
    console.error(`[local-dev] ${error.message}`);
    process.exit(1);
  }
}

module.exports = { buildLaunchPlan, describeLaunchPlan, validateLaunchPlan };
