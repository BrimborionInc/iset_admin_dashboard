# Terraform Initial Runbook – NWAC Prod Environment

Status: elevated prod Terraform/bootstrap runbook. Not a normal reduced-role `nwac-prod` deploy path.
Last reviewed: 2026-04-29 during ops documentation cleanup.

For the public portal cutover to `iset.nwac.ca` while retaining `nwac-public.awentech.ca`, see [prod-portal-hostname-cutover.md](prod-portal-hostname-cutover.md).

## 0. Authenticate to the Prod Account
1. Assume the Organizations role in account 468278742295 and export credentials into your shell.
2. Verify the caller identity returns the prod account before running Terraform.

PowerShell example:
```
$creds = aws sts assume-role --role-arn arn:aws:iam::468278742295:role/OrganizationAccountAccessRole --role-session-name nwac-prod-terraform | ConvertFrom-Json
$env:AWS_ACCESS_KEY_ID = $creds.Credentials.AccessKeyId
$env:AWS_SECRET_ACCESS_KEY = $creds.Credentials.SecretAccessKey
$env:AWS_SESSION_TOKEN = $creds.Credentials.SessionToken
$env:AWS_DEFAULT_REGION = "ca-central-1"
aws sts get-caller-identity
```

## 1. Bootstrap Remote State
1. cd infra/terraform/environments/prod
2. Temporarily edit backend.hcl bucket/table names if different.
3. Run terraform init -backend-config=backend.hcl -reconfigure (this will fail until S3 bucket & DynamoDB exist).
4. Apply bootstrap module locally with terraform apply -target=module.bootstrap.
5. Re-run terraform init -backend-config=backend.hcl -reconfigure to migrate state into S3 backend.

## 2. Request ACM Certificate
1. terraform apply -target=module.acm -var-file=nwac-prod.tfvars -auto-approve
2. Add the DNS validation CNAME records at the awentech.ca DNS provider (HostPapa).
3. Ensure CAA records are in place for the root and both subdomains:
   - awentech.ca -> 0 issue "amazon.com"
   - nwac-console.awentech.ca -> 0 issue "amazon.com"
   - nwac-public.awentech.ca -> 0 issue "amazon.com"
4. Wait until the certificate is Issued, then set alb_certificate_arn in nwac-prod.tfvars.

## 3. Plan + Apply Core Infrastructure
1. Review nwac-prod.tfvars.example, save a local nwac-prod.tfvars copy if needed.
2. terraform plan -var-file=nwac-prod.tfvars
3. terraform apply -var-file=nwac-prod.tfvars

## 4. Post-Apply Checks
1. Verify VPC, subnets, NAT, flow logs, CloudTrail, and AWS Config in ca-central-1.
2. Confirm the ALB listener rules route nwac-console.awentech.ca and nwac-public.awentech.ca.
3. Confirm Aurora cluster, security groups, and backups are enabled.
4. Populate SSM parameters `/nwac/prod/admin/env` and `/nwac/prod/portal/env` (SecureString) using the Terraform outputs and the env config map (`docs/ops/environments/test-env-config-map.md`, updated for prod).
5. Confirm the artifacts bucket (nwac-prod-artifacts) exists and upload admin/portal/shared artifacts to the *-latest.zip keys referenced in `nwac-prod.tfvars`.
6. Set Secrets Manager values (OPENROUTER_API_KEY) out of band.
7. Raise app_min_size/app_desired_capacity when ready to launch instances.
