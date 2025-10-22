# Test Environment Deployment Automation – Outline

This note describes how the refreshed `deploy-test.ps1` scripts will render environment files, sync application assets, and restart services in AWS while keeping secrets in SSM/Secrets Manager.

## 1. Prerequisites
- IAM role `nwac-test-deployer` with permissions to:
  - Read SSM parameters under `/nwac/test/*`
  - Retrieve Secrets Manager secrets (`nwac-test/db/*`, `nwac-test/nginx/*`)
  - Start SSM Session Manager port-forwarding (optional break-glass)
  - Trigger CodeDeploy or interact with EC2 Auto Scaling groups as designed
- Workstation or CI runner configured with AWS CLI (`ca-central-1` profile) and PowerShell 7.
- Terraform has already populated:
  - `SSM: /nwac/test/admin/env` (JSON map of env vars)
  - `SSM: /nwac/test/portal/env`
  - `SSM: /nwac/test/nginx/basic_auth` (base64 htpasswd)
  - Secrets Manager entries for database credentials.

## 2. Script Flow (per application)
1. **Assume Role:** `aws sts assume-role --role-arn arn:aws:iam::<acct>:role/nwac-test-deployer`.
2. **Fetch Config:** `aws ssm get-parameter --name /nwac/test/admin/env --with-decryption` → convert JSON to hashtable.
3. **Materialize .env:** Merge template (`.env.test.template`) with values into `.env.test.rendered`. Validate required keys present.
4. **Package Assets:**
   - `npm run build` if needed (or consume pre-built artifacts).
   - Zip build output + `.env.test.rendered` + shared folders (`blocksteps`, `templates`).
5. **Transfer:**
   - Preferred: Upload to S3 (`nwac-test-artifacts`) with version tag.
   - Trigger CodeDeploy / SSM automation document to pull artifact onto EC2 Auto Scaling group.
   - Alternative (single host): `scp` to bastion if maintained.
6. **Configure Instance:**
   - User data or post-deploy hook places `.env.test.rendered` as `.env`.
   - Retrieve htpasswd secret and update `/etc/nginx/.htpasswd`.
   - Restart services (`pm2`, `nginx`).
7. **Clean Up:** Remove local rendered file; log deployment metadata (Git commit, artifact version, timestamp) to CloudWatch Logs or DynamoDB audit table.

## 3. Shared Utilities
- PowerShell module (`scripts/NwacDeployment.psm1`) providing:
  - `Get-NwacSecret` - wraps AWS CLI for SSM/Secrets retrieval.
  - `Expand-NwacEnvTemplate` - injects values into template files.
  - `Publish-NwacArtifact` - uploads zipped build to S3 with metadata tags.
  - `Invoke-NwacCodeDeploy` - triggers CodeDeploy deployment with wait.
- Optional Node.js helper to verify `.env` matches schema defined in `docs/test-env-config-map.md`.

## 3a. EC2 Bootstrap Requirements (Admin & Portal)

Before attempting another instance refresh, codify the exact work userdata (or an SSM automation document) must execute on every application node. The script needs to:

1. **Install prerequisites**
   - Ensure Node.js 18+ and npm are available on AL2023 (`dnf install nodejs18` or nvm).
   - Install `pm2` globally for process supervision (`npm install -g pm2`).
   - Confirm `awscli` v2 and `unzip`/`tar` are present.
2. **Fetch environment values**
   - Read `/nwac/test/admin/env` (and `/nwac/test/portal/env` if hosting both apps) via `aws ssm get-parameter --with-decryption`.
   - Retrieve Secrets Manager credentials (`arn:aws:secretsmanager:ca-central-1:124355655255:secret:nwac-test-db-credentials-rzri4o`) and merge password/username into the env map.
3. **Materialize configuration**
   - Render the env JSON into `.env` files under `/opt/nwac/admin-dashboard/.env` and `/opt/nwac/portal/.env` (matching the templates committed in Git).
   - Write redacted copies to `/opt/nwac/config/` for troubleshooting.
4. **Deploy application artifacts**
   - Download the pre-built admin dashboard bundle (to be published to `s3://nwac-test-artifacts/admin/<version>.zip`) and extract under `/opt/nwac/admin-dashboard`.
   - Do the same for the public portal bundle (`.../portal/<version>.zip`) under `/opt/nwac/portal`.
   - Run `npm ci --omit=dev` (or use pre-packaged `node_modules`) as required.
5. **Start services**
   - Launch the admin API with pm2 (`pm2 start isetadminserver.js --name nwac-admin --cwd /opt/nwac/admin-dashboard`).
   - Launch the portal server/static host (`pm2 start server.js --name nwac-portal --cwd /opt/nwac/portal`) or configure nginx to serve the built React assets.
   - Run `pm2 save` so processes restore on reboot.
6. **Expose health checks**
   - Ensure each service responds with `200 OK` on `/healthz` (add lightweight route middleware if missing).
   - Align listener ports: ALB target group currently hits port **3000**; adjust either the Node apps to listen on 3000 or update Terraform to use 5001 so health checks succeed.
7. **Post-start validation**
   - Wait for `/healthz` to return 200 before exiting userdata (retry loop with timeout).
   - Log bootstrap progress to `/var/log/nwac-bootstrap.log` for diagnostics.

Outstanding items before automation proceeds:
 - Define artifact packaging + S3 structure.
 - Add `/healthz` handlers to admin and portal servers.
 - Resolve port mismatch between ALB target (3000) and admin API default (5001) prior to next ASG refresh.

## 4. Error Handling & Observability
- Each deployment logs to CloudWatch (`nwac-test-deployments`) via `Write-AWSLogs`.
- Scripts exit non-zero on missing parameters, failed AWS CLI calls, or unsuccessful health checks.
- Post-deployment health check hits `/healthz` endpoint behind ALB to confirm success.

## 5. Next Steps
 - Implement PowerShell module + per-app `deploy-test.ps1`.
 - Added portal automation script at `scripts/deploy-portal-test.ps1` (run via `npm run deploy-portal-to-test` inside `ISET-intake`).
- Update Terraform to create `nwac-test-artifacts` bucket and SSM parameters.
- Wire CodeDeploy or SSM automation documents accordingly.

Owner: _(add name)_  
Last updated: _(add date)_
