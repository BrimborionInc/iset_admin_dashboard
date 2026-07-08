# WSL Local Development

Purpose: durable local-development handoff for the Linux filesystem checkout used by Codex/VS Code.

Last updated: 2026-07-08

## Current Local Checkout

- Active WSL2 Ubuntu coding checkout: `/home/bill/ISET/admin-dashboard`
- Active WSL2 Ubuntu public portal checkout: `/home/bill/ISET/ISET-intake`
- Active WSL2 Ubuntu shared runtime checkout: `/home/bill/ISET/shared`
- Active WSL2 Ubuntu Sage Intacct mock checkout: `/home/bill/ISET/intacct-mock-service`
- Older Windows-mounted checkout: stale/archive only if present; do not use for deploy decisions
- DEV MySQL host from WSL: `172.26.176.1`

Use the `/home/bill/ISET/*` copies for normal local coding, Git-heavy work, VS Code/Codex sessions, and TEST deployments. Do not reopen a Windows-mounted `/mnt/x/ISET/admin-dashboard` copy for day-to-day development or deployment unless the task explicitly asks to inspect a stale archive.

TEST and PROD `path:deploy` are WSL-native: run them from `/home/bill/ISET/admin-dashboard`, and the orchestrator packages the WSL admin, portal, and shared trees. The legacy PowerShell component deploy scripts remain as lower-level historical references, but Windows `npm.cmd` is not reliable from a `\\wsl.localhost\...` working directory; do not resurrect old `X:\ISET` instructions as a shortcut.

`/home/bill/ISET/shared` is now its own local Git repo for shared runtime code consumed by both apps. It should be clean before deploys. At creation time it did not yet have a GitHub remote, so it has local dirty-state/history protection but still needs a remote for off-machine backup/recovery.

## Opening VS Code

Preferred morning entry point: open the saved multi-root WSL workspace:

```bash
code /home/bill/ISET/path-dev-wsl.code-workspace
```

That workspace shows the active local development tree:

- `admin-dashboard`
- `ISET-intake`
- `shared`
- `intacct-mock-service`

If needed, open the admin repo folder directly:

```bash
code /home/bill/ISET/admin-dashboard
```

Confirm VS Code is connected to WSL before starting Codex or local dev tasks. The lower-left corner should say `WSL: Ubuntu`; if Explorer shows `X:\ISET` or `/mnt/x/ISET`, close that window and open `/home/bill/ISET/path-dev-wsl.code-workspace`.

## Starting The Full Local Dev Stack

From VS Code:

1. Open `Terminal -> Run Task...`.
2. Select `dev:all`.

In Codex, the morning shorthand is:

```text
Open the DEV Environment
```

That request means: use the WSL workspace, then start the same full local stack as task `dev:all`.
When launching the stack from Codex rather than VS Code tasks, use the manual commands below under a real detached session such as `setsid -f bash -lc '...'`, write logs to `/tmp/iset-dev`, and verify the HTTP endpoints after startup. A plain backgrounded `nohup ... &` from the Codex shell runner can be reaped before services bind their ports.

The WSL-native task group starts:

- Public portal frontend: `http://localhost:3000`
- Public portal backend: `http://localhost:5000`
- Admin frontend: `http://localhost:3001`
- Admin backend: `http://localhost:5001`
- MinIO console: `http://localhost:9001`
- Sage Intacct mock service: `http://localhost:4000`
- Sage Intacct mock dashboard: `http://localhost:4000/dashboard`

The task definitions live in `.vscode/tasks.json` in the WSL checkout. They use Linux environment-variable syntax, the Linux MinIO binary at `../ISET-intake/minio/minio`, and the sibling Sage Intacct mock service at `../intacct-mock-service`.

The WSL `.env` files use `DB_HOST=172.26.176.1` so Node processes in Ubuntu reach the Windows-hosted DEV MySQL service. If WSL networking changes after a reboot, re-check the Windows host IP with `ip route | awk '/default/ {print $3; exit}'` and update the local `.env` files and `.vscode/tasks.json` together.

## Manual Startup Equivalent

Use separate terminals if VS Code tasks are unavailable:

```bash
cd /home/bill/ISET/ISET-intake
BROWSER=none npm start
```

```bash
cd /home/bill/ISET/ISET-intake
DB_HOST=172.26.176.1 nodemon server.js
```

```bash
cd /home/bill/ISET/ISET-intake
mkdir -p minio/data
MINIO_ROOT_USER="$(grep -m1 '^OBJECT_ACCESS_KEY=' .env | cut -d= -f2-)" \
MINIO_ROOT_PASSWORD="$(grep -m1 '^OBJECT_SECRET_KEY=' .env | cut -d= -f2-)" \
./minio/minio server minio/data --address :9000 --console-address :9001
```

```bash
cd /home/bill/ISET/admin-dashboard
PORT=3001 BROWSER=none node scripts/write-build-info.js --build-target local-start
PORT=3001 BROWSER=none ./node_modules/.bin/react-scripts start
```

```bash
cd /home/bill/ISET/admin-dashboard
DB_HOST=172.26.176.1 ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES=true nodemon isetadminserver.js
```

```bash
cd /home/bill/ISET/intacct-mock-service
DB_HOST=172.26.176.1 npm start
```

The Sage Intacct mock fills any missing `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, and `DB_NAME` values from `INTACCT_MOCK_ENV_FILE` or, by default, the sibling admin-dashboard `.env`. In the normal WSL checkout, `DB_HOST=172.26.176.1 npm start` is enough to make its DEV vendor store persistent and seed PATH payment vendor references. If the repos are moved out of the sibling layout, set `INTACCT_MOCK_ENV_FILE=/path/to/admin-dashboard/.env` or provide the DB variables explicitly.

## Common Pitfall

Some package scripts still include Windows-oriented commands, including legacy PowerShell launchers and `set PORT=...` syntax. Prefer the WSL VS Code tasks or the manual Linux commands above for local development from `/home/bill/ISET/admin-dashboard`. For TEST deployment, prefer `npm run path:deploy` from the WSL admin repo; do not call the legacy component PowerShell scripts directly from WSL.

## Puppeteer/Chrome Dependencies

The admin backend and public portal backend use Puppeteer's bundled Chrome for PDF generation during assessment, document, and signature workflows. In WSL, Chrome needs Linux shared libraries that were not required by the old Windows runtime.

Current WSL setup uses user-local Chrome libraries at:

```text
/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu
```

The admin and portal `.env` files, plus both backend tasks in `dev:all`, set:

```bash
LD_LIBRARY_PATH=/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu
```

This currently supplies `libnspr4.so`, `libnss3.so`, `libnssutil3.so`, and `libsmime3.so` for Puppeteer's downloaded Chrome. If Chrome fails with another missing-library error, run:

```bash
ldd /home/bill/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome | grep 'not found'
```

Preferred long-term fix is installing the needed Ubuntu packages system-wide, for example `libnspr4` and `libnss3`, when sudo access is available. The user-local extraction keeps DEV usable when Codex cannot run sudo.
