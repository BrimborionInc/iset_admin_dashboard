# PROD Aurora Downsize Prep Summary

Date: 2026-06-14

Scope: read-only prep/revalidation for a possible PROD Aurora provisioned downsize. No RDS resources were changed.

- Current PROD DB shape.
  `nwac-prod-db` is available on Aurora MySQL `8.0.mysql_aurora.3.10.3`; `nwac-prod-db-1` is the only instance, writer, `db.r6g.large`, private, encrypted, in `ca-central-1d`.

- Current safety checks.
  Backups are retained for `30` days and latest restorable time was current within a few minutes. PROD public smoke returned `200` for admin and both portal hostnames. SQL through the app-host SSM path succeeded and found `143` live tables.

- Current 14-day load.
  CPU average `8.963%`, p95 average `9.188%`, maximum `12.425%`. Database connections average `16.33`, p95 `20`, maximum `31`. Write IOPS average `4.042`, maximum `36.361`. Write latency average `1.514 ms`, maximum `2.745 ms`. Swap usage `0`.

- Memory is the limiting risk.
  Freeable memory averaged `5.958 GiB` with minimum `5.904 GiB` on the current `16 GiB` `db.r6g.large`. AWS Compute Optimizer reported maximum memory utilization about `63.1%`.

- AWS recommendation.
  AWS Compute Optimizer marked `nwac-prod-db-1` as `Optimized`, recommended staying on `db.r6g.large`, and showed `0.0%` savings opportunity.

- Possible target and risk.
  `db.t4g.large` is orderable in `ca-central-1d` and would reduce memory to `8 GiB`. That makes it a genuine trial, not a routine right-size. `db.t4g.medium` remains out of scope. `db.t4g.xlarge` is not listed as orderable for this Aurora MySQL engine/region.

- Cost estimate.
  May 2026 actual `db.r6g.large` compute was `744` hours and `$212.784` USD before tax. Official AWS public pricing shows `db.t4g.large` at `$0.158/hr`, about `$117.55/month` at 744 hours, so the theoretical compute saving is about `$95.23/month` USD before tax. Temporary reader overlap would add about `$0.158/hr` while both DB instances run.

- Permission status.
  Read-only checks worked. `pricing:GetProducts` and `iam:SimulatePrincipalPolicy` were denied. Future execution should attach temporary policy `NWACProdAuroraDownsizeTemporaryOperator` from `prod-aurora-provisioned-downsize.md` instead of probing mutating permissions against live PROD.

- Recommendation.
  Do not automatically execute the DB downsize next. Execute only if Bill explicitly accepts the memory risk for about `$95/month` possible compute saving, using the temporary-reader/failover/rollback runbook. Otherwise, the next lower-risk cost path is a billing commitment review rather than shrinking the DB class.
