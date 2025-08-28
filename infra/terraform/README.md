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

### Adding the Public Portal (Applicants)
The same user pool now supports a second (portal) app client already defined in `main.tf` (`aws_cognito_user_pool_client.portal`).

1. Copy `portal.example.tfvars` to e.g. `dev.portal.tfvars` and adjust domains / callback URLs.
2. Ensure BOTH admin (`oidc_*`) and portal (`portal_*`) URL lists are set.
3. Run plan/apply with that tfvars file:
	- `terraform plan -var-file=dev.portal.tfvars`
	- `terraform apply -var-file=dev.portal.tfvars`
4. After apply, capture outputs:
	- `issuer`
	- `portal_user_pool_client_id`
	- `hosted_ui_domain`
5. Set environment for portal backend (`ISET-intake`):
```
PUBLIC_AUTH_MODE=cognito
COGNITO_ISSUER=<issuer output>
COGNITO_PORTAL_CLIENT_ID=<portal_user_pool_client_id output>
COGNITO_REDIRECT_URI=https://portal.dev.example.com/auth/callback   # or http://localhost:3000/auth/callback
COGNITO_REGION=<aws_region>
```
6. Rebuild the portal frontend with matching `REACT_APP_` variables.

Local Dev (mixed): you can include both localhost and production domains simultaneously in the callback & logout URL arrays.

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
