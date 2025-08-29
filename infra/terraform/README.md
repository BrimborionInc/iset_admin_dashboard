# Terraform stack for Cognito + Pre-Token-Gen Lambda + SES wiring

This module provisions:
- Cognito User Pool, App Client, Hosted UI domain
- Cognito Groups: SysAdmin, ProgramAdmin, RegionalCoordinator, Adjudicator
- Lambda (Node.js 20) for Pre-Token-Generation to inject custom claims (role, region_id, user_id)
- IAM role + policy for the Lambda
- Optional SES email identity for the sender
- CloudWatch Logs with retention

## Inputs
See `variables.tf`. Important vars:
- aws_region
- environment (e.g., dev, test, prod)
- cognito_domain_prefix (globally unique)
- oidc_callback_urls (list)
- oidc_logout_urls (list)
- ses_sender
- ses_identity_arn (use identity or domain identity ARN)

## Outputs
- user_pool_id, user_pool_arn, user_pool_client_id
- issuer, jwks_url, hosted_ui_domain

## Usage
From this folder:
1) Ensure the Lambda source exists at `../lambda/pre-token-gen/index.js` and exports `handler`.
2) Configure a tfvars file, e.g. `dev.tfvars`:
```
aws_region          = "ca-central-1"
environment         = "dev"
app_name            = "iset-admin"
cognito_domain_prefix = "iset-admin-dev-xyz123"
oidc_callback_urls  = ["https://admin.dev.example.com/auth/callback"]
oidc_logout_urls    = ["https://admin.dev.example.com/"]
ses_sender          = "noreply@example.com"
ses_identity_arn    = "arn:aws:ses:ca-central-1:123456789012:identity/example.com"
create_ses_identity = false
log_retention_days  = 30
```
3) Initialize and plan/apply:
- `terraform init`
- `terraform plan -var-file=dev.tfvars`
- `terraform apply -var-file=dev.tfvars`

### Public Portal (Single-Pool Mode - legacy)
Originally the same user pool hosted a second (portal) app client (`aws_cognito_user_pool_client.portal`). Instructions retained here for reference if reverting to single pool.

Steps (legacy model): copy `portal.example.tfvars`, set `portal_*` callback/logout URLs, plan/apply, then map outputs (`portal_user_pool_client_id`, `issuer`, `hosted_ui_domain`) into portal `.env`.

### Split Applicant Pool (Current Model)
We now provision a completely separate applicant user pool + domain + client:
- Resources: `aws_cognito_user_pool.applicant`, `aws_cognito_user_pool_client.applicant_portal`, `aws_cognito_user_pool_domain.applicant`
- Variables: `applicant_app_name`, `applicant_cognito_domain_prefix`, `applicant_callback_urls`, `applicant_logout_urls`

After `terraform apply`, note new outputs:
- `applicant_user_pool_id`
- `applicant_user_pool_client_id`
- `applicant_issuer`
- `applicant_hosted_ui_domain`

Update public portal backend (`ISET-intake/.env`):
```
PUBLIC_AUTH_MODE=cognito
COGNITO_USER_POOL_ID=<applicant_user_pool_id>
COGNITO_PORTAL_CLIENT_ID=<applicant_user_pool_client_id>
COGNITO_ISSUER=<applicant_issuer>
COGNITO_DOMAIN=https://<applicant_hosted_ui_domain>.auth.<region>.amazoncognito.com
COGNITO_REDIRECT_URI=http://localhost:3000/auth/callback   # or deployed URL
COGNITO_REGION=<aws_region>
```
Frontend (`REACT_APP_`): same values prefixed with `REACT_APP_` (except `PUBLIC_AUTH_MODE`).

Security isolation:
- Admin dashboard validates tokens against original admin pool issuer.
- Public portal validates only the applicant pool issuer; no shared groups required.

If cleaning up legacy groups: remove Applicant group in admin pool (already done) — do NOT remove admin role groups.

Rollback strategy:
1. Keep both pools active temporarily.
2. Switch portal env vars back to admin pool outputs.
3. Remove applicant pool resources from Terraform once traffic drained.

Local dev: you can keep both pools; ensure distinct domain prefixes to avoid clashes.

## Wire outputs to the app
Set the following env vars in `admin-dashboard` when enabling the Cognito feature flag:
- AUTH_PROVIDER=cognito
- COGNITO_ISSUER = output `issuer`
- COGNITO_JWKS_URL = output `jwks_url`
- COGNITO_CLIENT_ID = output `user_pool_client_id`

On the frontend, configure Hosted UI using the domain, client id, and redirect URIs.# Terraform (skeleton)

This folder is reserved for Terraform stacks to provision:
- Cognito User Pool (ISET-Admin-Prod)
- App Client (iset-admin-console)
- Hosted UI Domain
- Pre Token Generation Lambda
- SES identity/verified sender
- CloudWatch Log Groups and retention
- Outputs: Pool ID, Client ID, Issuer URL, JWKS URL, Hosted UI URLs

Note: Not included here to avoid coupling to your AWS account details. I can generate a ready-to-apply stack when you confirm the target AWS region, domain prefix, and SES sender.
