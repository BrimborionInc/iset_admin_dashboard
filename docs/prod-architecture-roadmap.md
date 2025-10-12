# NWAC Production Architecture Roadmap

## Goal
Model the test environment so it mirrors the intended production deployment, while unblocking near-term testing with a simpler path.

## Near-Term (Test Fast Fix)
- Serve the admin SPA directly from the existing Express server using `express.static` and a catch-all route.
- Redeploy the admin artifact so `/` resolves without 404s.
- Keep PM2-based process management for now, but note the migration path below.

## Phase 1 – Static Asset Offload
1. **S3 Buckets**
   - Create dedicated buckets for admin and portal build artifacts (`nwac-prod-admin-static`, `nwac-prod-portal-static`).
   - Configure versioned object uploads and server-access logging.
2. **CloudFront Distributions**
   - One distribution per app, using the S3 buckets as origins for static assets.
   - Add a second origin that points to the internal ALB for `/api/*` and `/healthz` paths (origin request policy preserves headers/cookies).
   - Attach AWS WAF web ACL (baseline rule set + custom IP throttling as needed).
3. **Certificates/DNS**
   - Issue ACM certificates in `us-east-1` for the public CloudFront domains (`nwac-console.awentech.ca`, `nwac-portal.awentech.ca`).
   - Update Route 53 alias records to point to the CloudFront distributions.
4. **Terraform**
   - Extend existing modules to manage S3 buckets, CloudFront distributions, WAF, and DNS.
   - Expose outputs for the distribution domains so application configs can reference the new hostnames.

## Phase 2 – Compute Hardening
1. **Process Supervision**
   - Replace PM2 with systemd or containerize the services (ECS/Fargate or EKS) to improve restart semantics and observability.
   - Update launch templates / task definitions accordingly.
2. **Auto Scaling Strategy**
   - Define scaling policies based on CPU, memory, and request latency metrics.
   - Ensure Auto Scaling groups span at least three AZs.
   - Introduce warm-up/termination lifecycle hooks to drain in-flight requests (ALB connection draining).
3. **Observability**
   - Centralize logs in CloudWatch (application + access logs) with retention policies.
   - Add metrics/alarms for API error rates, latency, auth failures, DB connections.

## Phase 3 – Edge & Security Enhancements
1. **Session Handling**
   - Keep services stateless; if session data becomes necessary, introduce ElastiCache (Redis) and update the app to use it.
2. **Global Readiness**
   - Evaluate multi-region failover (Route 53 health checks, secondary deployment) once traffic patterns justify it.
3. **CI/CD Integration**
   - Automate artifact build, upload to S3, cache invalidation in CloudFront, and blue/green ASG refresh.
   - Incorporate infrastructure linting/tests (terraform validate, checkov, etc.).

## Alignment with Test Environment
- When ready, replicate these components in the test environment with `*-test` naming to validate the full production path before cutover.
- Maintain the simple Express static hosting workaround only as long as needed for testing; retire it once CloudFront/S3 is in place.
