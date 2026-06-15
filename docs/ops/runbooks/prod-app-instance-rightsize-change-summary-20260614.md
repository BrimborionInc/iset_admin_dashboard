# PROD App Instance Right-Size Change Summary

Date: 2026-06-14

- PROD EC2 app host resized: `t3.large` -> `t3.medium`.
  Why: very low observed load. CPU hourly average `0.686%`, p95 hourly average `1.135%`, max hourly average `2.594%`; pre-change memory had `6747 MB` available of `7823 MB`.

- PROD ASG instance replaced.
  `i-07b1b6ede5bb88a6a` retired; new `i-034c7daa416ec6865` is `t3.medium`, `InService`, `Healthy`.

- PROD launch template updated.
  `lt-056df7f45608b95ae` version `2` was created with only `InstanceType=t3.medium`; default version was aligned to version `2`.

- PROD ASG refresh completed.
  Refresh `24c2eb5f-6843-4685-9df1-35d41eb193ec` finished `Successful`.

- Maintenance safeguards used and cleared.
  Set in-app warning, enabled ALB fallback, then cleared both. Final maintenance announcement count: `0`.

- Final health verified.
  Admin and both portal health URLs returned `200`; admin and portal target groups were healthy.

- Post-change capacity checked.
  New `t3.medium` has `3839 MB` RAM, `2837 MB` available; disk remains `65%`; PM2 admin/portal are online at about `118 MB` and `87 MB`.

- Estimated saving.
  Roughly `$34/month USD before tax`, based on May PROD `t3.large` compute cost of about `$68.76`.

- Terraform PROD defaults updated.
  `app_instance_type = "t3.medium"`, min/desired capacity `1`, to keep IaC aligned with the live change.

- Documentation updated.
  Added/updated PROD right-size runbook, PROD environment guide, ops README, AGENTS map, operational access notes, changelog, and thread index.

- No database, schema, Cognito, S3, WAF, NAT, or application-code changes.
