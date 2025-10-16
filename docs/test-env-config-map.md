# NWAC Test Environment Configuration Map

This guide documents every environment variable and secret the test environment must supply, along with the Terraform outputs or AWS services that will back each value. Use it as the source of truth when generating `.env.test` files, SSM parameters, and deployment scripts.

---

## 1. Admin Dashboard (`admin-dashboard/.env.test`)

| Category | Variable | Purpose | Source in AWS / Terraform |
|----------|----------|---------|---------------------------|
| Server | `NODE_ENV=production` | Ensure Node runs in prod mode | Static |
| Server | `PORT=5001` | Express listener (ALB targets) | Static |
| Server | `API_BASE` / `REACT_APP_API_BASE_URL` | Frontend→API base URL | ALB DNS output (`module.compute_admin.alb_dns_name`) |
| CORS | `ALLOWED_ORIGIN` | Allowed origins for admin SPA | ALB DNS + CloudFront URL (if added) |
| Database | `DB_HOST` | Aurora endpoint | `module.data.aurora_endpoint` |
| Database | `DB_PORT=3306` | Aurora port | Static |
| Database | `DB_USER` | Application DB user | Secrets Manager secret (`nwac-test/db/app-user`) |
| Database | `DB_PASS` | Application DB password | Secrets Manager secret (same as user) |
| Database | `DB_NAME=iset_intake` | Schema name | Static (matches migrations) |
| Auth | `AUTH_PROVIDER=cognito` | Enables Cognito middleware | Static |
| Cognito (staff) | `AWS_REGION` / `REACT_APP_AWS_REGION` | Region for SDK | Terraform var `aws_region` |
| Cognito (staff) | `COGNITO_USER_POOL_ID` | Admin pool ID | `module.identity.admin_user_pool_id` |
| Cognito (staff) | `COGNITO_CLIENT_ID` | Admin app client ID | `module.identity.admin_user_pool_client_id` |
| Cognito (staff) | `COGNITO_ISSUER` / `COGNITO_JWKS_URL` | Token validation | `module.identity.admin_user_pool_issuer` & derived JWKS URL |
| Cognito (staff) | `COGNITO_DOMAIN` | Hosted UI domain (`https://...`) | `module.identity.admin_hosted_ui_domain` |
| Cognito (staff) | `COGNITO_REDIRECT_URI` / `REACT_APP_COGNITO_REDIRECT_URI` | Redirect after Hosted UI login | Admin ALB + `/auth/callback` |
| Cognito (staff) | `REACT_APP_COGNITO_CLIENT_ID` | Frontend copy of client ID | Same as server |
| Cognito (staff) | `REACT_APP_COGNITO_LOGOUT_URI` | Hosted UI logout | Admin ALB root |
| Cognito (applicant trust) | `COGNITO_TRUSTED_POOLS` | Allow applicant tokens for messaging widgets | Concatenate applicant pool ID/client ID output |
| Cognito (applicant trust) | `COGNITO_STAFF_USER_POOL_ID` / `COGNITO_STAFF_CLIENT_ID` | Legacy compatibility | Same as admin pool values |
| IAM | `DEV_AUTH_BYPASS=false`, `DEV_DISABLE_AUTH=false` | Ensure real auth in test | Static |
| Storage | `UPLOAD_MODE=s3`, `UPLOAD_DRIVER=s3` | Force S3 driver | Static |
| Storage | `OBJECT_BUCKET` | Document bucket | `module.data.uploads_bucket_name` (must not be left blank; missing value triggers `{ error: 's3_presign_failed' }` during uploads) |
| Storage | `OBJECT_REGION=ca-central-1` | Bucket region | Terraform var |
| Storage | `OBJECT_KEY_PREFIX=uploads/` | Folder prefix | Static |
| Storage | `OBJECT_ENDPOINT` | Empty in AWS (uses real S3) | Leave unset |
| Storage | `OBJECT_FORCE_PATH_STYLE=false` | Native S3 | Static |
| Presign | `PRESIGN_PUT_EXPIRES_SECONDS=120` / `PRESIGN_GET_EXPIRES_SECONDS=120` | Link lifetime | Static |
| AWS creds | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | **Not used** in test; rely on instance profile. Leave unset. | N/A |
| SES | `AWS_SES_REGION=ca-central-1` | SES API region | Terraform var |
| AI (optional) | `OPENROUTER_*` | Only if needed in test | Skip unless explicitly approved |
| Migrations | `MIGRATION_STRICT=true` | Block startup if migrations fail | Static |

> **Note:** Store sensitive values (`DB_PASS`, Cognito client secrets if any) in AWS Secrets Manager or SSM Parameter Store SecureStrings. Deployment scripts should pull them at runtime rather than committing plaintext `.env.test`.

---

## 2. Public Portal (`ISET-intake/.env.test`)

| Category | Variable | Purpose | Source |
|----------|----------|---------|--------|
| Server | `NODE_ENV=production` | Express server mode | Static |
| Server | `REACT_APP_API_BASE_URL` | Browser→portal API base | Portal ALB DNS |
| Database | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | Same Aurora cluster as admin | Same sources as admin (shared Secrets Manager values) |
| CORS | `ALLOWED_ORIGIN` | Allowed origins (portal UI) | Portal ALB/CloudFront URLs |
| Cognito (applicant) | `COGNITO_USER_POOL_ID` | Applicant pool | `module.identity.applicant_user_pool_id` |
| Cognito (applicant) | `COGNITO_PORTAL_CLIENT_ID` | Applicant app client | `module.identity.applicant_user_pool_client_id` |
| Cognito (applicant) | `COGNITO_ISSUER` | Token issuer | `module.identity.applicant_user_pool_issuer` |
| Cognito (applicant) | `COGNITO_DOMAIN` | Hosted UI domain | `module.identity.applicant_hosted_ui_domain` |
| Cognito (applicant) | `COGNITO_REDIRECT_URI` | Hosted UI callback | Portal ALB + `/auth/callback` |
| Cognito (applicant) | `REACT_APP_COGNITO_*` variables | Frontend copies | Same as above |
| Cognito (shared) | `COGNITO_ADDITIONAL_CLIENT_IDS` | Trust admin client for shared messaging | Admin client ID |
| Cognito (shared) | `COGNITO_TRUSTED_POOLS` | Accept admin tokens for staff actions | `admin_pool_id:admin_client_id` |
| Storage | `UPLOAD_MODE=s3`, `OBJECT_BUCKET` etc. | Same uploads bucket (read/write via presigned URLs) | `module.data.uploads_bucket_name` |
| Storage | `OBJECT_KEY_PREFIX` | Keep consistent with admin | Static |
| Messaging | `DEV_CONFIRM_SECRET` | Turn off local bypass; leave empty in test | Static (blank) |
| DNS | `ADMIN_DOMAIN` / `PORTAL_DOMAIN` | External hostnames (`nwac-console-test.awentech.ca`, `nwac-public-test.awentech.ca`) | Terraform tfvars (`admin_domain_name`, `portal_domain_name`) |
| AWS creds | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Use instance profile; leave unset | N/A |

---

## 3. Shared Deployment Secrets

| Secret | Purpose | AWS Location |
|--------|---------|--------------|
| `.htpasswd` credentials | Protect Nginx welcome page | SSM Parameter Store SecureString (`/nwac/test/nginx/basic_auth`) |
| `deploy-test.ps1` SSH key or CodeDeploy token | Allow deployment host to reach EC2/CodeDeploy | AWS Systems Manager Session Manager (preferred) or Secrets Manager |
| Aurora admin credentials | Apply schema migrations/imports | RDS master secret managed by Terraform (`aws_secretsmanager_secret` + rotation) |
| SES SMTP credentials (if needed) | Email sending outside Cognito | Secrets Manager (optional when using IAM-signed API calls) |
| ACM validation | HTTPS certificate DNS validation records | Terraform output `module.acm.validation_records` (requires CAA records permitting `amazon.com`) |

Deployment scripts should:
1. Assume an IAM role with access to read the above parameters/secrets.
2. Render `.env.test` for each app into a temporary workspace.
3. Upload/configure via SSM, SCP, or CodeDeploy user data.

---

## 4. Terraform Output → Environment Variable Cheatsheet

| Terraform Output | Environment Variable(s) |
|------------------|-------------------------|
| `module.identity.admin_user_pool_id` | `COGNITO_USER_POOL_ID`, `COGNITO_STAFF_USER_POOL_ID` |
| `module.identity.admin_user_pool_client_id` | `COGNITO_CLIENT_ID`, `REACT_APP_COGNITO_CLIENT_ID`, `COGNITO_STAFF_CLIENT_ID` |
| `module.identity.admin_hosted_ui_domain` | `COGNITO_DOMAIN`, `REACT_APP_COGNITO_DOMAIN_PREFIX` (derive prefix) |
| `module.identity.admin_user_pool_issuer` | `COGNITO_ISSUER`, `COGNITO_JWKS_URL` |
| `module.identity.applicant_user_pool_id` | `COGNITO_ADDITIONAL_CLIENT_IDS` (part), portal `COGNITO_USER_POOL_ID` |
| `module.identity.applicant_user_pool_client_id` | Portal `COGNITO_PORTAL_CLIENT_ID`, admin `COGNITO_TRUSTED_POOLS` |
| `module.identity.applicant_hosted_ui_domain` | Portal `COGNITO_DOMAIN`, `REACT_APP_COGNITO_DOMAIN` |
| `module.data.aurora_endpoint` | `DB_HOST` |
| `module.data.uploads_bucket_name` | `OBJECT_BUCKET` |
| `module.compute_admin.alb_dns_name` | Admin `API_BASE`, `REACT_APP_API_BASE_URL`, redirect/logout URIs |
| `module.compute_portal.alb_dns_name` | Portal `REACT_APP_API_BASE_URL`, `COGNITO_REDIRECT_URI`, etc. |
| `module.monitoring.log_group_app` | (Optional) `CLOUDWATCH_LOG_GROUP` if needed |

---

## 5. `.env.test` Template Strategy

1. Store redacted templates (no secrets) at:
   - `admin-dashboard/.env.test.template`
   - `ISET-intake/.env.test.template`
2. Terraform writes actual values to SSM (`/nwac/test/admin/env` and `/nwac/test/portal/env`) in key-value form.
3. Deployment script pulls the parameter, writes `.env`, restarts services.
4. Database password and other secrets live in dedicated parameters referenced by the env templates.

---

## 6. Follow-Up Items

- Decide whether to inject WAF-protected URLs into `ALLOWED_ORIGIN` (depends on WAF/CloudFront design).
- Confirm SES sandbox recipients; if restricted, include `TEST_SES_ALLOWED_RECIPIENTS` variable for the backend.
- Validate that no static AWS access keys remain once EC2/containers assume roles.
- Maintain CAA records for root + subdomains to allow ACM: `0 issue "amazon.com"` (already provisioned for `awentech.ca`, `nwac-console-test.awentech.ca`, `nwac-public-test.awentech.ca`).

Document owner: _(add name)_  
Last updated: _(add date)_
