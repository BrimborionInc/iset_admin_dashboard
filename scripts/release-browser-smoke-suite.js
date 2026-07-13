#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const BUILD_INFO_PATH = path.join(REPO_ROOT, 'src', 'generated', 'buildInfo.js');
const RELEASE_NOTES_PATH = path.join(REPO_ROOT, 'src', 'generated', 'publicReleaseNotes.js');
const BUILD_PATH = path.join(REPO_ROOT, 'tmp', 'release-qualification', 'admin-browser-build');

const SMOKES = Object.freeze([
  ['app-shell-navigation', 'app-shell-navigation-browser-smoke.js'],
  ['esdc-participants', 'esdc-participant-queue-browser-smoke.js'],
  ['case-assignment', 'case-assignment-dashboard-browser-smoke.js'],
  ['home-overdue', 'home-overdue-queue-browser-smoke.js'],
  ['manual-intake', 'manual-application-intake-browser-smoke.js'],
  ['manage-components', 'manage-components-dashboard-browser-smoke.js'],
  ['modify-component', 'modify-component-editor-browser-smoke.js'],
  ['application-overview', 'application-overview-docs-requested-browser-smoke.js'],
  ['application-workspace', 'application-workspace-dashboard-browser-smoke.js'],
  ['application-assessment', 'application-assessment-workflow-browser-smoke.js'],
  ['intervention-recall', 'intervention-assessment-recall-browser-smoke.js'],
  ['intervention-workflow', 'intervention-assessment-workflow-browser-smoke.js'],
]);

function parseArgs(argv) {
  const args = { json: false, only: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') args.json = true;
    else if (token === '--only') {
      args.only = new Set(String(argv[++index] || '').split(',').map(value => value.trim()).filter(Boolean));
    } else if (token === '--help' || token === '-h') {
      console.log([
        'Usage: node scripts/release-browser-smoke-suite.js [options]',
        '',
        'Builds the current admin frontend once, serves it on an isolated local port,',
        'runs the selected deterministic browser workflow smokes, and tears it down.',
        '',
        'Options:',
        `  --only IDS    Comma-separated subset: ${SMOKES.map(([id]) => id).join(', ')}`,
        '  --json        Emit JSON summary.',
      ].join('\n'));
      process.exit(0);
    } else throw new Error(`Unknown option: ${token}`);
  }
  if (args.only) {
    const known = new Set(SMOKES.map(([id]) => id));
    const unknown = Array.from(args.only).filter(id => !known.has(id));
    if (unknown.length) throw new Error(`Unknown browser smoke IDs: ${unknown.join(', ')}`);
  }
  return args;
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd || REPO_ROOT,
      env: options.env || process.env,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    const stdout = [];
    const stderr = [];
    child.stdout?.on('data', chunk => stdout.push(chunk));
    child.stderr?.on('data', chunk => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', code => {
      const result = {
        code: Number(code || 0),
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      };
      if (code === 0) resolve(result);
      else reject(Object.assign(new Error(`${command} exited with ${code}`), { result }));
    });
  });
}

function contentType(filename) {
  const extension = path.extname(filename).toLowerCase();
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  })[extension] || 'application/octet-stream';
}

function safeBuildFile(urlPath) {
  const pathname = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  const relative = pathname.replace(/^\/+/, '');
  const candidate = path.resolve(BUILD_PATH, relative || 'index.html');
  if (!candidate.startsWith(`${BUILD_PATH}${path.sep}`) && candidate !== path.join(BUILD_PATH, 'index.html')) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  return path.join(BUILD_PATH, 'index.html');
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const filename = safeBuildFile(req.url);
      if (!filename || !fs.existsSync(filename)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'content-type': contentType(filename), 'cache-control': 'no-store' });
      fs.createReadStream(filename).pipe(res);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(error.message || 'Server error');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = SMOKES.filter(([id]) => !args.only || args.only.has(id));
  if (!selected.length) throw new Error('No browser smokes selected');

  const originalBuildInfo = fs.existsSync(BUILD_INFO_PATH) ? fs.readFileSync(BUILD_INFO_PATH) : null;
  const originalReleaseNotes = fs.existsSync(RELEASE_NOTES_PATH) ? fs.readFileSync(RELEASE_NOTES_PATH) : null;
  let server = null;
  const results = [];
  try {
    fs.rmSync(BUILD_PATH, { recursive: true, force: true });
    await run('npm', ['run', 'build:test'], {
      env: {
        ...process.env,
        BUILD_PATH,
        PATH_DEPLOY_ENV: 'test',
        PATH_RELEASE_ID: 'local-release-qualification',
      },
    });

    server = await startServer();
    const address = server.address();
    const frontendBase = `http://127.0.0.1:${address.port}`;

    for (const [id, filename] of selected) {
      const startedAt = new Date().toISOString();
      try {
        await run(process.execPath, [path.join(REPO_ROOT, 'scripts', filename), '--frontend-base', frontendBase]);
        const finishedAt = new Date().toISOString();
        results.push({ id, status: 'passed', startedAt, finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt) });
      } catch (error) {
        const finishedAt = new Date().toISOString();
        results.push({
          id,
          status: 'failed',
          startedAt,
          finishedAt,
          durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
          error: error.message || String(error),
        });
        throw error;
      }
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(BUILD_PATH, { recursive: true, force: true });
    if (originalBuildInfo === null) fs.rmSync(BUILD_INFO_PATH, { force: true });
    else fs.writeFileSync(BUILD_INFO_PATH, originalBuildInfo);
    if (originalReleaseNotes === null) fs.rmSync(RELEASE_NOTES_PATH, { force: true });
    else fs.writeFileSync(RELEASE_NOTES_PATH, originalReleaseNotes);
  }

  const summary = { schemaVersion: 1, status: 'passed', checks: results };
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else console.log(`Release browser suite: PASS (${results.length}/${selected.length})`);
}

main().catch(error => {
  console.error(`Release browser suite: FAIL (${error.message || error})`);
  process.exitCode = 1;
});
