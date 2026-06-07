# Production Environment Guide (NWAC / ISET)

Status: production environment snapshot with newer deployment/hostname notes folded in. Verify live AWS state before operations.
Last reviewed: 2026-04-29 during ops documentation cleanup; prefer `docs/ops/deployments/deployment-quick-guide.md` for current deploy commands.

Last updated: May 27, 2026

This guide summarizes what is currently deployed in the production environment, how it fits together, and where to look when you need to operate or change it. Each section starts with a non-technical overview, followed by technical details.

## 1) Scope and Purpose

Non-technical overview  
Production is the live environment that serves real users. It hosts the public portal and the admin console, connects to the production database, and uses production authentication and security settings.

Technical details  
The prod environment runs in a dedicated AWS account (ID `468278742295`) and uses the `ca-central-1` region. The public portal and admin console are deployed as separate artifacts but run on the same EC2 instance (managed by an Auto Scaling Group). DNS points the production domains to the AWS load balancer.

## 2) Accounts and Regions

Non-technical overview  
Everything in prod lives in its own AWS account, and we keep all services in Canada (Central) to meet data residency expectations.

Technical details  
- Account ID: `468278742295`  
- Region: `ca-central-1` (Canada Central)  
- Production services and data should remain in this region unless an explicit architectural change is approved.

## 3) Public URLs

Non-technical overview  
There are two public-facing sites: one for applicants (public portal) and one for staff (admin console).

Technical details  
- Public portal primary: `https://iset.nwac.ca/`
- Public portal legacy/alias: `https://nwac-public.awentech.ca/`
- Admin console: `https://nwac-console.awentech.ca/`  
- Cognito Hosted UI domains:  
  - Admin: `https://nwac-prod-admin-458181.auth.ca-central-1.amazoncognito.com`  
  - Portal: `https://nwac-prod-portal-8ac238.auth.ca-central-1.amazoncognito.com`

## 4) Compute and App Hosting

Non-technical overview  
The apps run on a production server managed by AWS. A load balancer routes web traffic to that server.

Technical details  
- Auto Scaling Group: `nwac-prod-asg` (desired capacity 1).  
- Load balancer: Application Load Balancer (ALB) fronting both apps.  
- ALB access logs are enabled to `s3://nwac-prod-alb-logs-468278742295-ca-central-1/prod/alb/AWSLogs/468278742295/` with 90-day lifecycle expiry. AWS created `ELBAccessLogTestFile` at `2026-05-27T17:30:44Z`, confirming log-delivery permissions.
- AWS WAF Web ACL `nwac-prod-alb-rate-guard` is associated with the PROD ALB. Rule `AdminHostRateLimitPerIp` blocks an IP after more than 2,000 requests in 5 minutes to host `nwac-console.awentech.ca`; rule `AdminCasesApiRateLimitPerIp` blocks an IP after more than 300 requests in 5 minutes to host `nwac-console.awentech.ca` when the URI path starts with `/api/cases`; default action is allow.
- The admin app and portal are deployed to the same EC2 instance and are started with `pm2`.  
- Paths on instance:  
  - Admin: `/opt/nwac/admin-dashboard`  
  - Portal: `/opt/nwac/portal`  
  - Shared modules: `/opt/nwac/shared`  

## 5) Deployment Artifacts and Bootstrap

Non-technical overview  
Builds are uploaded to an artifacts bucket. New instances pull the latest builds automatically when they start.

Technical details  
- Artifacts bucket: `nwac-prod-artifacts`  
- Standard artifact keys:  
  - `admin/admin-dashboard-latest.zip`  
  - `portal/portal-latest.zip`  
  - `shared/shared-latest.zip`  
- Bootstrap script (run at instance start): `s3://nwac-prod-artifacts/bootstrap/app-bootstrap.sh`  
- Local deploy scripts:  
  - `scripts/deploy-admin-prod.ps1` (admin)  
  - `../ISET-intake/scripts/deploy-portal-prod.ps1` (portal)

## 6) Configuration and Secrets

Non-technical overview  
App configuration and secrets are stored centrally so instances can pull them at boot without hard-coding secrets into code.

Technical details  
- SSM Parameter Store (JSON):  
  - `/nwac/prod/admin/env`  
  - `/nwac/prod/portal/env`  
- Database credentials are stored in Secrets Manager:  
  - Secret name: `nwac-prod-db-credentials`  
- The bootstrap script renders `.env` files from SSM, merges DB credentials from Secrets Manager, forces `DISABLE_AUTO_MIGRATIONS=true` for admin, and forces `AUTO_MIGRATE=false` for portal so schema mutation happens through the explicit deploy path instead of app startup.

## 7) Database

Non-technical overview  
The production database stores all operational data. It is protected inside the AWS network and is not publicly accessible.

Technical details  
- Engine: Aurora MySQL  
- Cluster: `nwac-prod-db`  
- Endpoint: `nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com`  
- Database name: `iset_intake`  
- Access is restricted to the VPC; use SSM on the instance to run SQL or load dumps.  
- Data was loaded from `Dump20260126.sql` on January 26, 2026.

## 8) Identity and Access (Cognito)

Non-technical overview  
Users sign in through AWS Cognito. Admin users are assigned roles using Cognito groups.

Technical details  
- Admin user pool: `ca-central-1_IBtdWzSIW` (`nwac-prod-admin`)  
  - Client: `vto9m0e32fkao737pva52on5h`  
  - MFA: optional, software token enabled  
  - Groups: `System_Administrator`, `NWAC_Administrator`, `Regional_Manager`, `ISET_Coordinator`  
- Portal user pool: `ca-central-1_1TMlyEAK5` (`nwac-prod-portal`)  
  - Client: `44ner8vmv1egcuntoln8vh4bfk`  
- OAuth code flow is enabled for the admin and portal Hosted UI clients, with callback/logout URLs set to the production domains.
- The app instance role (`nwac-prod-app-role`) has Cognito admin permissions for listing/managing admin users in the admin pool.

## 9) Storage (Uploads)

Non-technical overview  
Uploads and generated files are stored in AWS object storage rather than on the server.

Technical details  
- Upload bucket: `nwac-prod-uploads-b6bb`  
- Default encryption: SSE-KMS (AWS KMS key; prod policy requirement).  
- Access is via presigned URLs configured in the portal environment (`UPLOAD_MODE=s3`).
- The reduced `nwac-prod` operator role is not a general uploads-bucket admin role. Direct reads such as bucket encryption/public-access configuration and raw `HeadObject` can be denied even when the deployed app can write/read objects through its configured `s3Provider`; for one-off generated-document repairs, verify uploaded objects from the PROD app host through `/opt/nwac/portal/s3Provider.headObject()` via SSM.

## 10) Captcha / Bot Protection

Non-technical overview  
The public portal uses a CAPTCHA to reduce automated signups.

Technical details  
- CAPTCHA is AWS WAF CAPTCHA SDK.  
- A prod API key is configured for the prod domains.  
- If CAPTCHA fails, verify the API key token domains include both `iset.nwac.ca` and `nwac-public.awentech.ca`.
- The January 26, 2026 snapshot said there were no WAF WebACLs configured in prod; verify live WAF state before relying on that.

## 11) DNS and Certificates

Non-technical overview  
DNS maps the production domains to AWS. TLS is handled by AWS certificates.

Technical details  
- DNS is managed in HostPapa for `awentech.ca`; `iset.nwac.ca` depends on the NWAC DNS path.
- The production CNAME records point to the AWS load balancer.  

## 12) How the Pieces Fit Together

Non-technical overview  
Users visit the portal or admin site, authenticate through Cognito, and the apps read/write data in the Aurora database. File uploads go to S3. New deployments happen by uploading build artifacts and letting instances pull them on boot.

Technical details  
1. Browser hits `nwac-public.awentech.ca` or `nwac-console.awentech.ca`.  
2. ALB routes to the EC2 instance in the ASG.  
3. The apps use Cognito for authentication and get group roles from the ID token.  
4. The apps call backend routes hosted on the same instance.  
5. The backend connects to Aurora MySQL using credentials from Secrets Manager.  
6. Uploads are stored in the S3 uploads bucket using presigned URLs.

## 13) Operational Notes

Non-technical overview  
The main operational tasks are deployments, user access, and database migrations.

Technical details  
- Deployments: upload new artifacts, then refresh the ASG instance to pull them.  
- In the current Codex/operator sandbox, normal prod deploy and DB operator work should use the reduced role-backed profile `nwac-prod`; `default` is only the bootstrap IAM user and direct prod resource calls through it are expected to fail.  
- That reduced prod role covers artifact uploads, prod SQL/dump helpers via SSM, ASG refresh, restore-point snapshots, and the ALB maintenance fallback. Broader infra/admin changes such as WAF updates, SSM env parameter writes, uploads-bucket CORS changes, or Terraform/ACM changes still require a separate elevated prod role.  
- User access: add users to Cognito groups for admin roles.  
- Migrations: run SQL inside the VPC using SSM on the instance (not from the public internet).  
  - Helper: `scripts/run-prod-sql.ps1` runs ad-hoc SQL against prod via SSM and prints results.
  - Bash helper for Codex/WSL automation: `bash scripts/run-prod-sql-via-ssm.sh`
  - Higher-level allowlisted config promotion: `npm run data:sync:apply -- --dataset <name> --target-env prod --yes`
  - Legacy cleanup: run `db/migrations/20260127_0002_drop_evaluator_tables.sql` to drop unused evaluator/PTMA assignment tables if present.

## 14) Known Gaps / Future Work

Non-technical overview  
There are improvements that can be added later for scale and security, but they are not required for a working production system.

Technical details  
- CloudFront/WAF in front of the ALB is not yet configured.  
- Infrastructure state is not yet fully reconciled with Terraform for prod.  
