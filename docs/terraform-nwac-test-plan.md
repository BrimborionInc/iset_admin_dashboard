# Terraform Delivery Plan – NWAC Test Environment

## 1. Goals
- Stand up the complete AWS test footprint (networking, identity, data, compute, monitoring) from scratch in the existing company account.
- Bake CCCS Medium guardrails directly into Terraform so every stack is compliant-by-design.
- Keep deployment scripts manual (`deploy-test.ps1`, DB upload utility) while infrastructure remains codified.

## 2. Naming, Tagging, and State
- **Resource prefix:** `nwac-test-<service>-<purpose>` (e.g., `nwac-test-kms-data`, `nwac-test-vpc-core`).
- **Mandatory tags:** `Environment = test`, `Classification = cccs-medium`, `Owner = ISET`, `Project = NWAC`, plus `CostCenter` when available.
- **Terraform state:** create `infra/terraform/environments/test/` as the root. Use S3 backend (`nwac-terraform-state`) encrypted with the logging KMS CMK; enable DynamoDB table for state locking.

## 3. Repository Layout
```
infra/
  terraform/
    environments/
      test/
        backend.hcl       # S3/Dynamo backend config (created)
        providers.tf      # AWS provider + tags (created)
        main.tf           # wires bootstrap/kms/networking scaffolds
        variables.tf      # core inputs (region, cidrs)
        outputs.tf        # placeholder exports
        nwac-test.tfvars  # example vars file (to add, no secrets)
    modules/
      bootstrap/          # org/account-level guardrails, IAM password/MFA policies
      networking/         # VPC, subnets, endpoints, SG/NACL defaults, NAT
      kms/                # CMKs for data/logging/secrets + rotation + key policies
      logging/            # CloudTrail org trail, Config recorder/delivery S3, log buckets
      security/           # GuardDuty, Security Hub (CIS/AWS Foundations/CCCS), Audit Manager wiring
      identity/           # Cognito pools (admin/applicant), trigger Lambdas, SES configs
      data/               # Aurora MySQL cluster, subnet groups, parameter groups, backup plans
      compute/            # EC2 Auto Scaling groups + launch templates for admin & portal tiers
      iam/                # IAM roles, permission boundaries, SSM Parameter Store secrets
      monitoring/         # CloudWatch log groups, metrics/alarm sets, EventBridge rules
      compliance/         # Terraform Cloud/OPA policy packs, tfsec/checkov integrations (metadata)
```

## 4. Module Notes
- **bootstrap**
  - Enforce account password policy, root access key disable, default EBS encryption, default VPC teardown, S3 Block Public Access, IAM Access Analyzer, Config recorder enablement.
  - Outputs AWS account ID, log archive bucket name to downstream modules.
  - ✅ Initial implementation creates Terraform state S3 bucket + DynamoDB lock table (versioned, SSE-KMS, public access blocked).
- **networking**
  - Single VPC (`/16`) with three AZs. Private subnets for app tiers, isolated subnets for Aurora. NAT gateway per AZ (or shared pair if cost is critical). Interface VPC endpoints for STS, Logs, KMS, SSM; gateway endpoints for S3/Dynamo.
  - Security groups default deny egress except required AWS service ranges; no public inbound rules.
  - ✅ Initial cut provisions VPC, private/isolated/public subnets, NAT, gateway endpoints (S3/DynamoDB), VPC flow logs, and baseline egress SG.
- **kms**
  - CMKs: `data` (Aurora/S3 uploads), `logging` (CloudTrail/Config/CloudWatch), `identity` (Cognito, SES if supported), `general` (Secrets Manager/SSM). Automatic rotation on. Key policies limit admin to security role and allow respective AWS services via condition keys.
  - ✅ Module now provisions four CMKs with aliases (`alias/nwac-test/...`) and rotation enabled; policies currently grant account root pending fine-grained roles.
- **logging**
  - Org/Account-level CloudTrail with S3 bucket (KMS encrypted, immutable via Object Lock). CloudWatch log group for quick searches (retention ≥ 400 days). AWS Config delivery channel to the same log bucket.
  - S3 access logs aggregated into `nwac-test-logs` bucket with lifecycle (90-day hot, 1-year Glacier).
  - ✅ Module now provisions log/archive buckets (with lifecycle + access logs), CloudTrail (multi-region), CloudWatch delivery, and AWS Config recorder/delivery channel using the logging CMK.
- **security**
  - Enable GuardDuty, Security Hub (CIS AWS Foundations, AWS Foundational Security Best Practices, CCCS Medium custom standard), AWS Detective optional. Provision delegated admin roles for security team.
  - Configure Security Hub to ingest Config findings; set up EventBridge rules to raise SNS notifications for high/critical findings.
  - ✅ Module now enables GuardDuty, Security Hub standards (CIS/FSBP/Audit toggle), multi-region finding aggregation, Access Analyzer, and optional SNS alert routing via EventBridge.
- **acm**
  - Request ACM certificates for `nwac-console-test.awentech.ca` and `nwac-public-test.awentech.ca`, output DNS validation CNAMEs for manual entry.
- **identity**
  - Separate admin and applicant Cognito pools with `OPTIONAL` MFA for admins (software token) and `OFF` for applicants (toggle-able flag). Hosted UI domains, app clients, SES integration, Lambda triggers (pre-token, post-confirmation).
  - Output `.env.test` templates (rendered via Terraform local_file or data template) to feed deployment scripts.
  - ✅ Module provisions both pools, hosted domains, and app clients with configurable callbacks and MFA; SES wiring toggled via vars.
- **data**
  - Aurora MySQL (serverless v2 or provisioned multi-AZ) with parameter groups enabling `required_secure_transport`. Enforce IAM auth optional but TLS required. Automated backups retention 7+ days, snapshots replicated intra-Canada if needed.
  - AWS Backup plan/vault with KMS encryption and optional cross-region copy (still within Canada).
  - ✅ Module now provisions an Aurora MySQL cluster (encrypted via KMS), subnet group, SG, and Secrets Manager master credentials with configurable backup windows.
- **compute**
  - Launch templates using hardened AMIs (CIS Amazon Linux2 or custom). IMDSv2 required, EBS encryption via data CMK, SSM Agent installed. User data pulls app artifacts from S3 or CodeDeploy.
  - Application Load Balancers (public) with HTTPS listeners, ACM certificates, Nginx basic-auth in user data (`/etc/nginx/.htpasswd` seeded from SSM SecureString).
  - ✅ Module scaffolds ALB + HTTPS listener, target group, ASG/launch template, and security groups to connect app tier to the database.
- **iam**
  - Permission boundaries for app roles, Terraform execution role limited to prefixed resources, SSM Parameter Store for secrets (encrypted with general CMK), Session Manager enablement (even if not routinely used).
  - Define admin portal roles for deploy scripts (least privilege to read state bucket, assume deploy role).
- **monitoring**
  - CloudWatch dashboards, log metric filters (auth failures, WAF blocks), alarms feeding SNS (email + optional Slack webhook). X-Ray optional toggle.
- **compliance**
  - Audit Manager CCCS Medium assessment automation; map Config rules to required controls. Provide Terraform (`null_resource`) hooks or documentation for integrating Checkov/tfsec/OPA in CI.

## 5. Deployment Workflow Integration
- After Terraform apply, emit:
  - SSM parameters containing `.env.test` values for both apps (retrieved by deployment scripts).
  - Outputs for database endpoint, secrets ARN, ALB URLs, Cognito IDs.
- Update PowerShell deployment scripts to read from SSM/S3 instead of hard-coded `.env.production`.
- Database refresh script will import scrubbed dump into Aurora via Data API or RDS advanced export pipeline (define S3 staging bucket + Lambda/ECS task).

## 6. Outstanding Decisions / Follow-up
- Confirm Aurora sizing (serverless vs. provisioned) when load test targets are finalized.
- Decide whether WAF (AWS Managed Rules + rate limiting) is required on ALBs for CCCS Medium (likely yes).
- Determine if Audit Manager CCCS library is fully automatable or needs manual evidence uploads.
- Clarify how SES sandbox limitations affect applicant notifications; may need test recipient allow list.

Document owner: _(add name)_  
Last updated: _(add date)_
