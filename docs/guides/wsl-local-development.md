# WSL Local Development

Purpose: durable local-development handoff for the Linux filesystem checkout used by Codex/VS Code.

Last updated: 2026-05-07

## Current Local Checkout

- Active WSL2 Ubuntu coding checkout: `/home/bill/ISET/admin-dashboard`
- Active WSL2 Ubuntu public portal checkout: `/home/bill/ISET/ISET-intake`
- Active WSL2 Ubuntu Sage Intacct mock checkout: `/home/bill/ISET/intacct-mock-service`
- Older Windows-mounted checkout: `/mnt/x/ISET/admin-dashboard`
- DEV MySQL host from WSL: `172.26.176.1`

Use the `/home/bill/ISET/*` copies for normal local coding, Git-heavy work, and VS Code/Codex sessions. Do not reopen the Windows-mounted `/mnt/x/ISET/admin-dashboard` copy for day-to-day development unless the task explicitly needs the old Windows tree.

The Windows checkout remains relevant for TEST/PROD app deploy flows that still shell into Windows `npm` / PowerShell. Follow the deployment guides before deploying; do not assume the WSL-only checkout is a supported deploy working directory. Before a TEST/PROD app deploy, sync or pull the intended WSL changes into `X:\ISET\...` and inspect the Windows checkout because the deploy scripts package that Windows working tree.

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

## Common Pitfall

The package scripts still include some Windows-oriented commands, including PowerShell launchers and `set PORT=...` syntax. Prefer the WSL VS Code tasks or the manual Linux commands above for local development from `/home/bill/ISET/admin-dashboard`.

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
