# Terraform Initial Runbook – NWAC Test Environment

## 1. Bootstrap Remote State
1. cd infra/terraform/environments/test
2. Temporarily edit backend.hcl bucket/table names if different.
3. Run terraform init -backend-config=backend.hcl -reconfigure (this will fail until S3 bucket & DynamoDB exist).
4. Apply bootstrap module locally with terraform apply -target=module.bootstrap to create the state bucket/table.
5. Re-run terraform init -backend-config=backend.hcl -reconfigure to migrate state into S3 backend.

## 2. Plan Core Infrastructure
1. Review/adjust nwac-test.tfvars.example, save personal copy without committing secrets.
2. terraform plan -var-file=nwac-test.tfvars (or supply inline vars).
3. Verify outputs: VPC IDs, subnets, endpoints, state bucket.

## 3. Apply Networking + Bootstrap
1. terraform apply -var-file=nwac-test.tfvars.
2. Validate in AWS console: VPC, subnets, NAT, flow logs, S3 bucket, Dynamo lock table.

## 4. Next Modules
- After confirming networking, extend plan to include KMS, logging, identity, data, compute, etc.

## Notes
- All modules tag resources with Environment=test, Project=NWAC, Classification=cccs-medium.
- NAT gateways incur cost; toggle enable_nat_gateway=false in tfvars for minimalist dry runs.
- Flow logs currently target CloudWatch Logs; ensure log group retention is set (future logging module).
- Leave Cognito callback/logout URLs in tfvars as placeholders initially. After the first apply, update them with the ALB DNS name (or custom domain) and rerun apply.
- **Certificate bootstrap workflow**
  1. `terraform apply -target=module.acm -var-file=nwac-test.tfvars -auto-approve`
  2. Add the two DNS validation CNAME records output by Terraform at the `awentech.ca` registrar.
  3. Ensure CAA records are in place for the root and both subdomains:
     - `awentech.ca` → `0 issue "amazon.com"`
     - `nwac-console-test.awentech.ca` → `0 issue "amazon.com"`
     - `nwac-public-test.awentech.ca` → `0 issue "amazon.com"`
  4. Monitor ACM until the certificate reports **Issued** (e.g., `aws acm describe-certificate --certificate-arn ...`).
  5. Record the certificate ARN (`arn:aws:acm:ca-central-1:124355655255:certificate/427d2bf9-5869-47cc-aa90-1f30e66b88a4` as of 2025‑10‑08) in `alb_certificate_arn` within `nwac-test.tfvars`.
  6. Proceed with the full `terraform apply -var-file=nwac-test.tfvars` to build the remaining stack.
