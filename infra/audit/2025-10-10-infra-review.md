# NWAC Test Environment Review — 2025-10-10

## Context
- Account: 124355655255 (SES_backend user)
- Region: ca-central-1
- Terraform stack: `nwac-test`

## Findings So Far
- VPC `nwac-test-vpc` (10.48.0.0/16) present with expected public/private/isolated subnets across ca-central-1a/b/d.
- NAT gateways (x3) and VPC endpoints (S3, DynamoDB) in `available` state.
- ALB `nwac-test-alb` active (internet-facing) with admin/portal target groups on `/healthz`.
- Target groups report instances i-006f8488ef3b7de38 and i-0a1623354e8a10a1e healthy on ports 5001/5000.
- Auto Scaling group `nwac-test-asg` desired/min 2, max 4; both instances InService (two earlier launches terminated during rollout, all using AMI `ami-029c5475368ac7adc`). Cloud-init warned `Failed to run module scripts-user`; bootstrap log shows initial secret fetch failed (secret missing during first launch) but later reruns completed, though `npm install` produced extensive warnings about missing/corrupted modules under `/opt/nwac/admin-dashboard`. `pm2 jlist` on both running instances returns `[]`, so admin/portal processes never came online.
- Bootstrap script at `scripts/bootstrap/app-bootstrap.sh` updated (retries for SSM/Secrets/S3, cleans directories before unpack, uses npm ci/install with fresh node_modules). Uploaded to `s3://nwac-test-artifacts/bootstrap/app-bootstrap.sh` and ASG instance refresh `d282ff5e-2ce9-4061-9f90-8fae5bf8c30b` launched to roll changes out.
- Bootstrap script at `scripts/bootstrap/app-bootstrap.sh` updated (retries for SSM/Secrets/S3, cleans directories before unpack, uses npm ci/install with fresh node_modules). Uploaded to `s3://nwac-test-artifacts/bootstrap/app-bootstrap.sh` and ASG instance refresh `d282ff5e-2ce9-4061-9f90-8fae5bf8c30b` launched (new instance `i-0d52610f86e7d41d4` warming up).
- Aurora cluster `nwac-test-db` available; encrypted via KMS `c5304749-74e7-45a2-a625-60e2ed0009bc`.
- Secret `nwac-test-db-credentials` exists (last changed 2025-10-09T13:01:45-04:00); rotation not enabled; username `app_admin`, strong random password provisioned.
- Secret `nwac-test-db-credentials` exists (last changed 2025-10-09T13:01:45-04:00); rotation not enabled; username `app_admin`, strong random password provisioned.
- S3 bucket `nwac-test-artifacts` present with admin/portal/shared zip archives, bootstrap script (`bootstrap/app-bootstrap.sh`, dated 2025-10-10), and `db/BaselineDump.sql`.
- SSM params `/nwac/test/admin/env` and `/nwac/test/portal/env` populated with Cognito IDs, DB credentials, ALB URLs, and upload settings wired to current stack.
- Cognito pools `nwac-test-admin` (client `28pk6qvqhcmagvhoctas5578i3`, domain `nwac-test-admin-d34ebb`) and `nwac-test-portal` (client `1kjsaqoa7d72hd0s229lto723l`, domain `nwac-test-portal-1ee997`) active; values match SSM configs.
- ACM cert `arn:aws:acm:ca-central-1:124355655255:certificate/427d2bf9-5869-47cc-aa90-1f30e66b88a4` is ISSUED for both test hostnames (valid to 2026-11-06).

## Next Checks
- Verify secret values (username/password) align with Terraform outputs.
- Confirm artifacts bucket, bootstrap script, and SSM parameters exist and are current.
- Audit Cognito pools, SES configuration, and ALB listener rules.
- Identify orphaned resources (old launch templates, ASGs, security groups, etc.).
- Feed confirmed state back into Terraform modules (ensure no manual drift remains).
