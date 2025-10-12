# AWS Test Environment Requirements

## 1. Purpose
- Validate the full ISET intake platform end to end: workflow authoring in the admin console, publish and render via public portal, applicant submissions, secure messaging, and adjudication.
- Enable a small internal user group to rehearse production-scale scenarios ahead of go-live, including higher-volume applicant/admin simulations.

## 2. Scope
- Dedicated AWS “test” environment covering both web applications (`ISET-intake` public portal, `admin-dashboard` console) plus shared services (databases, messaging, analytics).
- Must meet CCCS Medium Cloud Security profile; anything not required for CCCS Medium is out of scope unless it directly supports the above workloads.
- Regions: Canada-only; primary deployment must stay in `ca-central-1` (and any DR option must remain in Canada).

## 3. Stakeholders
- _Primary contacts for engineering, security, operations, and project management._
- _Approval process for requirement updates._

## 4. High-Level Architecture
- Two web applications (React SPA front ends) served via secure endpoints; Node.js backend (`isetadminserver.js`) handling API, workflow publishing, and MySQL access.
- MySQL-compatible relational database powering both admin and applicant data workflows.
- AWS Cognito used for identity (separate pools per applicant vs. staff) with supporting Lambda triggers, SES (optional), and KMS-backed secrets.
- Outbound messaging via Amazon SES; current implementation sends system emails for submission/secure-messaging/approval events with future expansion to configurable notifications.
- Shared assets and modules under `X:\ISET\` (e.g., workflow templates, block steps, Terraform scaffolding) are consumed by both applications; deployment pipeline must package these shared pieces for the test environment.
- Terraform provisions all AWS resources from scratch (Cognito pools, SES identities, RDS/Aurora, VPC guardrails) using a consistent prefix (e.g., `nwac-test-`) for traceability.
- Terraform provisions all AWS resources from scratch (Cognito pools, SES identities, RDS/Aurora, VPC guardrails); apply a consistent naming prefix (e.g., `nwac-test-`) for easy identification.
- _Topology diagram pending - to capture VPC, subnets, load balancers, database tier, and endpoints._
- Test environment will live alongside dev in the existing company AWS account; isolation handled via dedicated VPCs, tagging, and IAM boundaries rather than separate accounts.

## 5. Networking
- _VPC design (CIDR ranges, subnets, AZ distribution)._
- _Connectivity needs (VPN, Direct Connect, VPC peering)._
- _Routing, DNS, and load balancing considerations._
- Enforce Canada residency: ensure traffic, logs, backups, and disaster recovery replicas stay within Canadian regions/AZs.
- Public portals stay internet-facing but fronted by Nginx basic auth on welcome screens (consistent with existing `deploy.ps1` scripts); Terraform should wire up ALB/EC2 user data to install/manage the htpasswd credentials securely.
- Test domains reserved under `awentech.ca`: `nwac-console-test.awentech.ca` (admin) and `nwac-public-test.awentech.ca` (portal). CAA records (`0 issue "amazon.com"`) exist at the root and both subdomains to allow ACM certificates.

## 6. Security & Compliance
- _Security baselines, compliance frameworks, or data classifications._
- _IAM roles, least privilege requirements, and secrets handling._
- _Logging, auditing, and incident response expectations._

## 7. Compute & Containerization
- _Instance types, autoscaling policies, and AMI/OS standards._
- Must handle production-representative load tests: ~50 concurrent applicants + 15 staff routinely, with peaks up to 100 concurrent applicants.
- _ECS/EKS/Fargate requirements if relevant._
- _Build/deployment pipelines and artifact sources._

## 8. Data & Storage
- Primary transactional store: single shared Amazon Aurora MySQL cluster (multi-AZ) consumed by both admin console and public portal; use separate schemas/database users for least privilege while preserving shared data model.
- Application artifact storage (published workflows, form templates) currently file-based; evaluate S3 with KMS encryption and lifecycle policies.
- Test data strategy needs anonymized/representative applicant records with procedures for refresh.
- Email delivery: use Amazon SES (likely in sandbox mode) with verified sender/recipients for test notifications; ensure CCCS Medium logging/retention for outbound communications.
- Customer-managed KMS keys required for Aurora, S3 buckets, CloudTrail/CloudWatch Logs, Cognito, SES (where supported), and any Secrets Manager parameters; enforce rotation and restricted key policies.
- Initial dataset: scrubbed export of production schema (legacy tables retained) with applicant/admin PII removed; Cognito-linked tables must be cleared or reseeded so new test user pools can repopulate records on first login.
- TLS certificate: ACM certificate `arn:aws:acm:ca-central-1:124355655255:certificate/427d2bf9-5869-47cc-aa90-1f30e66b88a4` issued via DNS validation for the above subdomains.

## 9. Monitoring & Observability
- _Metrics, logging, and tracing tools (CloudWatch, X-Ray, third-party)._
- _Alerting thresholds and escalation paths._

## 10. Cost Management
- _Budget constraints, tagging standards, and cost allocation._
- _Rightsizing or scheduling expectations._

## 11. Operational Runbooks
- _Access management, onboarding, and offboarding procedures._
- Staff operate through the admin console (web access via hosted welcome/auth flow); no direct shell/RDP needed under normal operations—break-glass approach TBD if deeper access ever required.
- _Maintenance windows and change management cadence._
- Deployment workflow stays manual: refresh scripted CLI pushes for each web app (new `deploy-test.ps1` variants) plus automated database upload utility; maintain `.env.test` secrets outside the repo for reproducibility.

## 12. Testing & Validation
- _Acceptance criteria for environment readiness._
- _Smoke/regression test coverage and tooling._

## 13. Risks & Constraints
- _Known limitations, dependencies, or external integrations._
- _Regulatory or contractual obligations._

## 14. Open Questions
- _Unresolved decisions, follow-ups, and blockers._
- Track Terraform implementation details in `docs/terraform-nwac-test-plan.md`; revise both documents together as decisions finalize.
- Env and secrets mapping captured in `docs/test-env-config-map.md`; use it when building `.env.test` and SSM parameter automation.

---

_Version:_ 0.1  
_Last updated by:_ _(add name)_  
_Last updated on:_ _(add date)_
