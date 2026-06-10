# NWAC Test Environment - Current Progress (2025-10-08)

Status: historical TEST environment build/progress log. Do not treat embedded resource state as current without live AWS verification.
Last reviewed: 2026-06-08 after TEST cost-pruning; literal DB credential redacted.

This log captures the state of the infrastructure setup so work can resume quickly if the session is interrupted.

## Domains & Certificates
- Subdomains reserved: `nwac-console-test.awentech.ca` (admin), `nwac-public-test.awentech.ca` (portal).
- CAA records present:
  - `awentech.ca` -> `0 issue "amazon.com"`
  - `nwac-console-test.awentech.ca` -> `0 issue "amazon.com"`
  - `nwac-public-test.awentech.ca` -> `0 issue "amazon.com"`
- ACM certificate issued and in use: `arn:aws:acm:ca-central-1:124355655255:certificate/427d2bf9-5869-47cc-aa90-1f30e66b88a4`
  - Validation method: DNS (CNAMEs already added at registrar).

## Current Cost-Pruned Shape (2026-06-08)
- TEST is no longer intended to rehearse a two-instance, three-NAT, three-AZ runtime topology. Keep TEST inexpensive unless a specific rehearsal requires temporarily scaling it back up.
- Live TEST was pruned on 2026-06-08:
  - ASG `nwac-test-asg`: min/desired/max `1`, constrained to private subnet `subnet-0806c0c17fb286162` (`ca-central-1d`), running instance `i-0a8be782ed8604211` (`t3.small`).
  - NAT: only `nwac-test-nat-2` / `nat-055caa7ca6e0e0e74` remains in public subnet `subnet-04d8965bc390a8686` (`ca-central-1d`); all private route tables send `0.0.0.0/0` through that NAT.
  - Removed NAT gateways `nat-0e7985e0a277a4b5f` and `nat-09c8c9d1ec970f602`; released their EIPs plus two previously idle unassociated EIPs.
  - ALB `nwac-test-alb` is attached to two public subnets (`subnet-0b593d6252c11dc37` in `ca-central-1a`, `subnet-04d8965bc390a8686` in `ca-central-1d`) because keeping an ALB healthy should not be modeled as a one-subnet resource.
  - Aurora `nwac-test-db` remains Aurora Serverless v2 with instance `nwac-test-db-1` in `ca-central-1d`; the DB subnet group still spans multiple isolated subnets because subnet groups are not a meaningful cost driver.
- Terraform defaults were updated to preserve this pruned TEST shape: one NAT gateway at subnet index `2`, app subnet index `[2]`, ALB public subnet indexes `[0, 2]`, `t3.small`, and ASG min/desired/max `1`.

## Terraform Status (2025-10-08 16:35 EDT)
- Full `terraform apply -auto-approve -var-file=nwac-test.tfvars` completed successfully.
- Outstanding warnings resolved (S3 bucket logging now uses `aws_s3_bucket_logging`).
- AWS Config recorder is healthy; Security Hub CIS + FSBP standards both report `READY`.

### Key Outputs
- **ALB** `nwac-test-alb-635148606.ca-central-1.elb.amazonaws.com` (`sg-0c6df9a8301e2ae95`)
- **App autoscaling** group `nwac-test-asg`, launch template `lt-03103f9bb129be0a2`
- **DB cluster endpoint** `nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com` (reader: `nwac-test-db.cluster-ro-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com`)
- **Aurora secret** `arn:aws:secretsmanager:ca-central-1:124355655255:secret:nwac-test-db-credentials-ZHQOaz`
- **Cognito admin** domain `https://nwac-test-admin-d34ebb.auth.ca-central-1.amazoncognito.com`
- **Cognito portal** domain `https://nwac-test-portal-1ee997.auth.ca-central-1.amazoncognito.com`
- **Log buckets**
  - Archive: `s3://nwac-test-logs-41b3ea`
  - Access logs: `s3://nwac-test-logs-access-41b3ea`
  - CloudTrail log group: `/nwac/test/cloudtrail/nwac-test`

### Supporting Resources
- VPC `vpc-0e3ebaa9d1dfb6d9e` with three AZ layout (public/private/isolated).
- Current cost-pruned routing uses one NAT gateway/EIP in `ca-central-1d`; older per-AZ NAT notes are historical only.
- GuardDuty detector `f65cb6aedb6d4441a765c954d26af189`, Access Analyzer `nwac-test-access-analyzer`.
- KMS keys created for data, logging, identity, general purposes (aliases `alias/nwac-test/*`).

## Variables / Configuration Notes
- `infra/terraform/environments/test/nwac-test.tfvars` updated with certificate ARN and test domains.
- `alb_allowed_ingress_cidrs` currently `["0.0.0.0/0"]` – tighten before go-live.
- `app_user_data` placeholder still empty; deployment scripts need to render userdata before launch.

## Progress Update (2025-10-09)
### Database
- Imported `BaselineDump.sql` (stored at `s3://nwac-test-artifacts/db/BaselineDump.sql`) into Aurora `iset_intake` via SSM.
- Verified critical tables (`component_template`, `step`, etc.) now exist; admin runtime starts without schema errors.
- Portal runtime no longer halts on migrations, but logs a warning when `migrationRunner.js` runs with the non-privileged user (acceptable for now; revisit if we re-enable runtime migrations).

### Compute / Bootstrap Automation
- Latest bootstrap script (`scripts/bootstrap/app-bootstrap.sh`) uploads to `s3://nwac-test-artifacts/bootstrap/app-bootstrap.sh`.
- Launch template `lt-03103f9bb129be0a2` updated to version **3** with user data that pulls the bootstrap script from S3 and executes it at first boot (logs to `/var/log/nwac-userdata.log`).
- Auto Scaling instance refresh started (ID `3e70ebde-d6b3-4924-8cb5-1b4ce18a9e7c`): new instances now come up with Node 20, pm2, env render, artifacts, and the `/opt/nwac/ISET-intake` symlink without manual SSM intervention. Health checks are stabilising while the refresh completes.

### Validation
- ALB target-group health is the reliable operator signal for TEST (`nwac-test-admin-tg` on `5001`, `nwac-test-portal-tg` on `5000`). As re-verified on 2026-04-04, unauthenticated public requests to `nwac-console-test.awentech.ca/healthz` and `nwac-public-test.awentech.ca/healthz` currently return `403`, so Codex/operator smoke checks should use target-group health instead of public curl.
- Post-prune verification on 2026-06-08: `path:deploy:smoke` reported one healthy admin target (`i-0a8be782ed8604211:5001`) and one healthy portal target (`i-0a8be782ed8604211:5000`); `run-test-sql-via-ssm.sh` selected the same host and returned `SELECT 1` from `iset_intake`.
- Live AWS readback on 2026-06-08 showed ASG min/desired/max `1`, all private route-table defaults pointing to `nat-055caa7ca6e0e0e74`, ALB subnets and service ENIs limited to `subnet-04d8965bc390a8686` / `ca-central-1d` and `subnet-0b593d6252c11dc37` / `ca-central-1a`, and Aurora `nwac-test-db-1` `db.serverless` available in `ca-central-1d`.
- pm2 on refreshed nodes shows `nwac-admin` and `nwac-portal` online with no MODULE_NOT_FOUND errors; admin error log down to the AI-key warning only.

### Historical Outstanding Follow-ups
These 2025 bootstrap follow-ups are retained for context. Verify live AWS and current runbooks before acting on them.

1. Allow the ASG instance refresh to finish; confirm ALB target groups report all registered target(s) `healthy`.
2. Once stable, prune temporary SSM diagnostic outputs in S3 (if any) and ensure `BaselineDump.sql` is versioned/archived as the canonical seed.
3. Run a Terraform apply to record the new launch-template user data in state (plan currently shows in-place updates for LT/ASG/SG).
4. Build a scripted deploy (PowerShell/CI) that packages artifacts, uploads to S3, and triggers either SSM bootstrap reruns or an ASG instance-refresh.
5. Tighten ALB ingress CIDRs before exposing test broadly; add GuardDuty/Security Hub baselines after environment settles.

### 2025-10-09 (Cluster Rebuild)
- Destroyed the test Aurora cluster and related security/secrets resources (no snapshot) per directive; updated the Terraform data module to honour `skip_final_snapshot` so future destroys succeed without manual CLI calls.
- Re-ran `terraform apply -var-file=nwac-test.tfvars` to recreate the subnet group, security group, cluster, and the `nwac-test-db-credentials` secret (new ARN suffix `ZHQOaz`).
- Captured the regenerated master password and pushed it into `/nwac/test/admin/env` and `/nwac/test/portal/env`; the literal value was removed from this historical note. Retrieve current credentials from AWS secrets/SSM only.
- From a freshly launched app instance, confirmed connectivity with the new credentials, then recreated the host-specific grant: `GRANT ALL ON iset_intake.* TO 'app_admin'@'10.48.%'` (role grant still blocked, but schema privileges now in place).
- Full, untargeted Terraform apply run afterward to reinstate the app->DB security-group ingress rule and sync launch template metadata.
- Refactored the compute Terraform module so the ALB now manages dedicated admin (port 5001) and portal (port 5000) target groups, attaches both to the ASG, and adds host-based listener rules; the legacy `nwac-test-tg` target group has been removed.
- Pending: re-import `BaselineDump.sql`, rerun application smoke checks once ASG stabilises, and consider re-adding the `rds_superuser_role` grant if elevated operations are required.

## Reference Commands
```powershell
# Full apply (run from infra/terraform/environments/test)
terraform plan -var-file=nwac-test.tfvars
terraform apply -auto-approve -var-file=nwac-test.tfvars

# AWS Config recorder health
aws configservice describe-configuration-recorder-status

# Security Hub enabled standards
aws securityhub get-enabled-standards
```

Keep this document updated whenever significant progress is made.

---

## Secrets Migration Plan – OPENROUTER_API_KEY (Test → Prod)

Purpose: move AI key handling into AWS-managed secrets so the key never lives in git or AMIs. Code already reads `process.env.OPENROUTER_API_KEY`, so changes are limited to deployment/bootstrap.

### Plan
1) Inventory current env render flow for admin (test/prod) to confirm where `.env` is built (SSM `/nwac/<env>/admin/env`, user data, CI).  
2) Create SecureString parameter or secret: `/nwac/<env>/admin/openrouter_api_key` (Parameter Store) or a Secrets Manager secret if rotation is desired.  
3) IAM: grant the admin instance/profile read-only access to that single path/ARN (`ssm:GetParameter` or `secretsmanager:GetSecretValue`).  
4) Bootstrap/deploy update: fetch the secret during env render and write `OPENROUTER_API_KEY=<value>` into the runtime `.env` (server-side only; no `REACT_APP_*`).  
5) Apply to test: create the test secret, update bootstrap script, redeploy/restart `nwac-admin`; verify logs no longer show the missing-key warning.  
6) Apply to prod: repeat with a distinct prod secret path/key and matching IAM.  
7) Rotation/ops: set rotation cadence (Secrets Manager rotation or manual) and document owner/location.

### Status
- Current: `.env.test` leaves `OPENROUTER_API_KEY` blank by design; admin logs show AI disabled warning. Env render confirmed via deploy scripts: `.env.test` is copied to instances and becomes `.env` (no secret fetch). Terraform now defines a Secrets Manager placeholder (`aws_secretsmanager_secret.openrouter_api_key`) using the general KMS key; value intentionally set out-of-band to avoid storing in state.  
- Next action: (console path) secret created manually as `nwac-test-admin-openrouter-api-key` with OPENROUTER_API_KEY set. The current WSL-native TEST app deploy path in `scripts/path-deploy.js` fetches this secret via AWS CLI during deploy, parses JSON secrets that include `{"OPENROUTER_API_KEY": "..."}`, and injects OPENROUTER_API_KEY into the runtime `.env` files before pm2 restart. Apply by rerunning TEST `path:deploy` so instances pick up the secretised env. Terraform placeholder still exists; consider importing or reconciling later to avoid drift.

