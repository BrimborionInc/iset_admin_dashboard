# PROD Aurora Provisioned Downsize Runbook

Status: planned/revalidation runbook only; not yet executed in PROD.
Last reviewed: 2026-06-14 after live PROD revalidation.

Purpose: safely trial a smaller provisioned Aurora MySQL instance class for PROD without moving to Aurora Serverless and without modifying the only writer in place.

Do not execute this runbook without explicit Bill approval in the current thread and a scheduled maintenance window. This is not a normal `path:deploy` application release.

## Current PROD Baseline

Live read-only preflight on 2026-06-08 showed:

- Cluster: `nwac-prod-db`
- Writer instance: `nwac-prod-db-1`
- Engine: Aurora MySQL `8.0.mysql_aurora.3.10.3`
- Current class: `db.r6g.large`
- Topology: one cluster writer, no reader
- AZ: `ca-central-1d`
- Backups: 30-day retention, latest restorable time current within minutes
- Performance Insights: disabled
- Enhanced Monitoring: disabled

CloudWatch 15-minute datapoints for 2026-05-25 through 2026-06-08:

- CPU average `9.26%`, maximum `95.85%`; the highest burst was concentrated around 2026-05-27.
- Freeable memory average about `6.40 GB`, minimum about `6.25 GB`.
- Database connections average `15.34`, maximum `31`.
- Swap usage effectively zero, maximum `524288` bytes.
- Read IOPS `0`; write IOPS average `4.55`, maximum `196.33`.
- Read latency `0`; write latency average `0.00155s`, maximum `0.00558s`.

Original sizing decision from 2026-06-08:

- Do not trial `db.t4g.medium` first. It has only 4 GiB memory, which is too aggressive for the current free-memory profile.
- Conditional trial target: `db.t4g.large`. It keeps a provisioned instance model, is supported for Aurora MySQL 3.x, and gives an 8 GiB memory step-down while remaining easy to roll back. The 2026-06-14 revalidation below changes this from a recommended next action into an explicit-risk trial only.

## 2026-06-14 Revalidation Result

Bill approved prep/revalidation only on 2026-06-14. No RDS resources were mutated.

Live state:

- PROD operator identity: `arn:aws:sts::468278742295:assumed-role/nwac-prod-codex-operator/codex-prod-operator`.
- Cluster `nwac-prod-db` was `available`, Aurora MySQL `8.0.mysql_aurora.3.10.3`, backup retention `30` days, latest restorable time current within a few minutes.
- Topology remained one writer and no reader: `nwac-prod-db-1`.
- Writer `nwac-prod-db-1` was `available`, `db.r6g.large`, private, encrypted, in `ca-central-1d`.
- PROD public smoke returned `200` for admin and both portal hostnames.
- PROD ALB maintenance fallback was off.
- SQL through the app-host SSM path succeeded from replacement app host `i-034c7daa416ec6865`; live DB had `143` tables.
- `db.t4g.large` is orderable for Aurora MySQL `8.0.mysql_aurora.3.10.3` in `ca-central-1d`. `db.t4g.xlarge` is not listed as an orderable Aurora MySQL class in this engine/region; the orderable T-class options are `db.t3.medium`, `db.t3.large`, `db.t4g.medium`, and `db.t4g.large`.

CloudWatch 15-minute datapoints for 2026-05-31T16:02:57Z through 2026-06-14T16:02:57Z:

- CPU average `8.963%`, p95 average `9.188%`, maximum `12.425%`.
- Freeable memory average `5.958 GiB`, p95 average `5.972 GiB`, minimum `5.904 GiB`.
- Database connections average `16.33`, p95 `20`, maximum `31`.
- Swap usage `0`.
- Read IOPS `0`.
- Write IOPS average `4.042`, p95 `5.567`, maximum `36.361`.
- Read latency `0`.
- Write latency average `1.514 ms`, p95 `1.589 ms`, maximum `2.745 ms`.

Cost and pricing evidence:

- Cost Explorer for May 2026 showed `CAN1-InstanceUsage:db.r6g.large` at `744` hours and `$212.784` USD before tax.
- Cost Explorer for June 1-14, 2026 showed `312` hours and `$89.232` USD before tax, matching the same `$0.286/hr` run rate.
- Official AWS public price list for Aurora MySQL in `ca-central-1` showed:
  - `db.r6g.large`: `16 GiB`, `$0.286/hr`, about `$212.78/month` at 744 hours.
  - `db.t4g.large`: `8 GiB`, `$0.158/hr`, about `$117.55/month` at 744 hours.
  - Compute-only theoretical saving from `db.r6g.large` to `db.t4g.large`: about `$95.23/month` USD before tax.
  - Temporary overlap cost for adding the `db.t4g.large` reader before failover: about `$0.158/hr` while both instances run.

AWS Compute Optimizer evidence:

- `get-rds-database-recommendations` returned `instanceFinding: Optimized` for `nwac-prod-db-1`.
- It recommended staying on `db.r6g.large` with `0.0%` savings opportunity and `0.0` performance risk.
- Its utilization metrics included maximum CPU `12.425%`, maximum memory utilization `63.1007%`, maximum connections `31`, and no Aurora memory health/declined-SQL/kill-query events.

Prep conclusion:

- Do not execute the `db.t4g.large` trial as the next automatic cost-saving step.
- CPU, connections, I/O, and latency are low enough to support exploration, but memory is the limiting resource. Current maximum memory utilization is about `63.1%` on a `16 GiB` class, and CloudWatch freeable memory is only about `5.9 GiB`; dropping to an `8 GiB` class is a real trial, not a routine right-size.
- Keep `db.t4g.medium` out of scope.
- If Bill accepts the risk for about `$95/month` possible compute savings, execute only through the temporary-reader/failover path below and keep the old `db.r6g.large` instance until the trial is accepted or rolled back.
- If Bill does not want that risk, the better next cost topic is billing commitment review, such as a Reserved DB Instance/Savings-style commitment, not shrinking the database class.

## Safety Model

Avoid modifying the only writer in place. AWS documents DB instance class changes as outage-causing for the modified instance, while Aurora failover can promote an Aurora Replica to writer. Use that to make the risky move reversible:

1. Add a temporary smaller reader.
2. Fail over to the temporary reader during maintenance.
3. Keep the old `db.r6g.large` instance as a rollback target.
4. Monitor the smaller writer.
5. Only after acceptance, resize the old instance while it is a reader, fail back to the Terraform-managed instance ID, and delete the temporary trial reader.

This keeps the final steady state aligned with Terraform's current data module, which manages `nwac-prod-db-1` as the single cluster instance.

## Cost Exposure

This runbook temporarily increases DB instance-hours because it adds a second Aurora DB instance for the trial/rollback window. Aurora storage remains the same shared cluster volume, but database compute is billed per DB instance-hour, so the overlap is real cost.

Cost-sensitive default:

- Create the temporary reader immediately before the maintenance window.
- Fail over to it.
- Watch for 30 to 60 minutes under normal routing.
- If green, finalize in the same window or a second short window: resize `nwac-prod-db-1` while it is a reader, fail back, then delete the temporary reader.
- Target overlap: a few hours, not days.

Higher-safety option:

- Keep the old `db.r6g.large` reader overnight or through one business day for fast failback.
- This costs more because both DB instances run during the watch period.
- Use this only if the trial begins during an unusually quiet period or if Bill explicitly accepts the temporary extra cost for rollback comfort.

Do not leave the temporary reader running after the acceptance/rollback decision. The cleanup step is part of the cost-saving change, not optional housekeeping.

## Required Permissions

The reduced `nwac-prod` operator role may not currently include every mutation below. If permission expansion is needed, request a temporary policy for this runbook only.

2026-06-14 permission check:

- Read-only RDS, CloudWatch, Cost Explorer, Compute Optimizer, SSM SQL, fallback status, and public smoke checks worked.
- `pricing:GetProducts` was denied, so the official public AWS price-list feed was used for current hourly rates instead.
- `iam:SimulatePrincipalPolicy` was denied, so mutation permissions could not be conclusively simulated without calling mutating RDS APIs. Do not discover mutation permissions by trial-and-error against live PROD. Attach an explicit temporary execution policy before any scheduled run, then remove it after the rollback window.

Suggested temporary policy name: `NWACProdAuroraDownsizeTemporaryOperator`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadProdAuroraDownsizeState",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:DescribeAlarms",
        "cloudwatch:GetMetricData",
        "cloudwatch:GetMetricStatistics",
        "compute-optimizer:GetRDSDatabaseRecommendations",
        "ce:GetCostAndUsage",
        "rds:DescribeDBClusterSnapshots",
        "rds:DescribeDBClusters",
        "rds:DescribeDBInstances",
        "rds:DescribeEvents",
        "rds:DescribeOrderableDBInstanceOptions",
        "rds:ListTagsForResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "MutateProdAuroraDownsizeOnly",
      "Effect": "Allow",
      "Action": [
        "rds:AddTagsToResource",
        "rds:CreateDBClusterSnapshot",
        "rds:CreateDBInstance",
        "rds:DeleteDBInstance",
        "rds:FailoverDBCluster",
        "rds:ModifyDBInstance"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "ca-central-1"
        }
      }
    }
  ]
}
```

Expected RDS actions:

- `rds:CreateDBClusterSnapshot`
- `rds:CreateDBInstance`
- `rds:ModifyDBInstance`
- `rds:FailoverDBCluster`
- `rds:DeleteDBInstance`
- `rds:AddTagsToResource`
- `rds:DescribeDBClusters`
- `rds:DescribeDBInstances`
- `rds:DescribeEvents`

Expected CloudWatch/read actions:

- `cloudwatch:GetMetricStatistics`
- `cloudwatch:GetMetricData`
- `cloudwatch:DescribeAlarms`

The usual PROD maintenance and smoke helpers still need their existing ELB, SSM, Auto Scaling, and S3 permissions.

## Stop Conditions

Stop before mutation if any of these are true:

- `nwac-prod-db` or `nwac-prod-db-1` is not `available`.
- Latest restorable time is not current within the expected RDS lag.
- The app cannot run a successful read-only SQL check through `bash scripts/run-prod-sql-via-ssm.sh`.
- Target-group or public smoke is already failing.
- There is unresolved PROD app deployment or data-repair work in progress.
- AWS reports insufficient capacity for `db.t4g.large` in the target AZ and Bill has not approved using a different AZ.

Stop after failover and roll back if any of these appear:

- Public smoke fails after fallback is cleared.
- App logs show persistent DB connection failures after the normal reconnection window.
- `FreeableMemory` approaches or stays below `1 GiB`.
- `SwapUsage` grows materially or continues increasing.
- `CPUCreditBalance` drains quickly or approaches zero.
- `CPUUtilization` stays above `70%` outside an explained short burst.
- Write latency or user-visible save/submit latency becomes noticeably worse.

## Preflight

Work from the WSL admin repo:

```bash
cd /home/bill/ISET/admin-dashboard
export AWS_PROFILE=nwac-prod
export AWS_REGION=ca-central-1
```

Confirm identity:

```bash
aws sts get-caller-identity --profile "$AWS_PROFILE"
```

Confirm cluster and instance shape:

```bash
aws rds describe-db-clusters \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-identifier nwac-prod-db \
  --query 'DBClusters[0].{Status:Status,Engine:Engine,EngineVersion:EngineVersion,BackupRetentionPeriod:BackupRetentionPeriod,LatestRestorableTime:LatestRestorableTime,Members:DBClusterMembers[].{Id:DBInstanceIdentifier,Writer:IsClusterWriter}}' \
  --output table

aws rds describe-db-instances \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-instance-identifier nwac-prod-db-1 \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Class:DBInstanceClass,AZ:AvailabilityZone,Endpoint:Endpoint.Address}' \
  --output table
```

Confirm the target class is orderable:

```bash
aws rds describe-orderable-db-instance-options \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --engine aurora-mysql \
  --engine-version 8.0.mysql_aurora.3.10.3 \
  --query 'OrderableDBInstanceOptions[?DBInstanceClass==`db.t4g.large`].DBInstanceClass' \
  --output text
```

Confirm SQL path:

```bash
bash scripts/run-prod-sql-via-ssm.sh --sql "SELECT DATABASE() AS db, @@hostname AS host, @@port AS port, NOW() AS checked_at;"
```

Confirm public smoke before scheduling:

```bash
npm run path:deploy:smoke -- --env prod
```

Capture baseline metrics:

```bash
aws cloudwatch get-metric-statistics \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=nwac-prod-db-1 \
  --start-time <UTC_START> \
  --end-time <UTC_END> \
  --period 900 \
  --statistics Average Maximum \
  --output table

aws cloudwatch get-metric-statistics \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --namespace AWS/RDS \
  --metric-name FreeableMemory \
  --dimensions Name=DBInstanceIdentifier,Value=nwac-prod-db-1 \
  --start-time <UTC_START> \
  --end-time <UTC_END> \
  --period 900 \
  --statistics Average Minimum \
  --output table

aws cloudwatch get-metric-statistics \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=nwac-prod-db-1 \
  --start-time <UTC_START> \
  --end-time <UTC_END> \
  --period 900 \
  --statistics Average Maximum \
  --output table
```

## Phase 1 - Create Restore Point

Create a cluster snapshot before adding the reader:

```bash
SNAPSHOT_ID="path-prod-db-downsize-pre-$(date -u +%Y%m%d%H%M%S)"

aws rds create-db-cluster-snapshot \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-identifier nwac-prod-db \
  --db-cluster-snapshot-identifier "$SNAPSHOT_ID" \
  --tags Key=Environment,Value=prod Key=Purpose,Value=prod-db-downsize-preflight

aws rds wait db-cluster-snapshot-available \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-snapshot-identifier "$SNAPSHOT_ID"
```

Record `$SNAPSHOT_ID` in the maintenance notes.

## Phase 2 - Add Temporary Smaller Reader

Preferred trial reader ID:

```bash
TRIAL_INSTANCE_ID="nwac-prod-db-t4g-large-trial"
```

Create the reader. Prefer `ca-central-1d` to match the current app/DB locality unless AWS capacity blocks it:

```bash
aws rds create-db-instance \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-instance-identifier "$TRIAL_INSTANCE_ID" \
  --db-cluster-identifier nwac-prod-db \
  --engine aurora-mysql \
  --db-instance-class db.t4g.large \
  --availability-zone ca-central-1d \
  --promotion-tier 0 \
  --no-publicly-accessible \
  --tags Key=Environment,Value=prod Key=Purpose,Value=prod-db-downsize-trial

aws rds wait db-instance-available \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-instance-identifier "$TRIAL_INSTANCE_ID"
```

Verify cluster membership:

```bash
aws rds describe-db-clusters \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-identifier nwac-prod-db \
  --query 'DBClusters[0].DBClusterMembers[].{Id:DBInstanceIdentifier,Writer:IsClusterWriter,PromotionTier:PromotionTier}' \
  --output table
```

Do not delete or modify `nwac-prod-db-1` yet. It is the rollback target.

## Phase 3 - Maintenance Warning And ALB Fallback

Set a global PROD warning:

```bash
npm run path:maintenance -- set --env prod --surfaces all --start-in 5m --expected-duration 20m --yes
```

Wait through the warning window when practical, then enable the ALB fallback:

```bash
npm run path:maintenance:fallback -- set --env prod --surfaces all --yes
```

Keep the fallback active while the DB failover happens. This avoids users seeing raw application/database errors while existing DB connections are dropped and rebuilt.

## Phase 4 - Fail Over To Trial Reader

Promote the temporary reader:

```bash
aws rds failover-db-cluster \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-identifier nwac-prod-db \
  --target-db-instance-identifier "$TRIAL_INSTANCE_ID"
```

Wait for the cluster and both instances:

```bash
aws rds wait db-cluster-available \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-identifier nwac-prod-db

aws rds wait db-instance-available \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-instance-identifier "$TRIAL_INSTANCE_ID"

aws rds wait db-instance-available \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-instance-identifier nwac-prod-db-1
```

Confirm the trial instance is writer:

```bash
aws rds describe-db-clusters \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-identifier nwac-prod-db \
  --query 'DBClusters[0].DBClusterMembers[].{Id:DBInstanceIdentifier,Writer:IsClusterWriter}' \
  --output table
```

Run SQL through the app-host path while fallback remains active:

```bash
bash scripts/run-prod-sql-via-ssm.sh --sql "SELECT DATABASE() AS db, @@hostname AS host, @@port AS port, NOW() AS checked_at;"
```

Clear the ALB fallback, smoke normal routing, then clear the warning:

```bash
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
npm run path:deploy:smoke -- --env prod
npm run path:maintenance -- clear --env prod --surfaces all --yes
```

## Phase 5 - Trial Monitoring And Cost Window

Choose the trial duration before starting the maintenance.

Recommended cost-sensitive path:

- Monitor the new writer for 30 to 60 minutes after normal routing is restored.
- Include at least one real staff login/read path and one safe write path if practical.
- If metrics and smoke are clean, move to finalization instead of leaving the old reader running.

More conservative path:

- Monitor through a representative business period before finalizing.
- Accept that this temporarily runs both the trial writer and the old reader.

Key metrics on `$TRIAL_INSTANCE_ID`:

```bash
aws cloudwatch get-metric-statistics \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --namespace AWS/RDS \
  --metric-name FreeableMemory \
  --dimensions Name=DBInstanceIdentifier,Value="$TRIAL_INSTANCE_ID" \
  --start-time <UTC_START> \
  --end-time <UTC_END> \
  --period 300 \
  --statistics Average Minimum \
  --output table

aws cloudwatch get-metric-statistics \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --namespace AWS/RDS \
  --metric-name SwapUsage \
  --dimensions Name=DBInstanceIdentifier,Value="$TRIAL_INSTANCE_ID" \
  --start-time <UTC_START> \
  --end-time <UTC_END> \
  --period 300 \
  --statistics Average Maximum \
  --output table

aws cloudwatch get-metric-statistics \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --namespace AWS/RDS \
  --metric-name CPUCreditBalance \
  --dimensions Name=DBInstanceIdentifier,Value="$TRIAL_INSTANCE_ID" \
  --start-time <UTC_START> \
  --end-time <UTC_END> \
  --period 300 \
  --statistics Average Minimum \
  --output table
```

Also watch:

- `CPUUtilization`
- `DatabaseConnections`
- `WriteLatency`
- `ReadLatency`
- public `/healthz` smoke
- admin and portal application logs
- support reports of slow saves, failed submissions, or login/session instability

## Rollback During Trial

Rollback is straightforward as long as `nwac-prod-db-1` is still the original `db.r6g.large` reader.

Set warning and fallback:

```bash
npm run path:maintenance -- set --env prod --surfaces all --start-in 5m --expected-duration 20m --yes
npm run path:maintenance:fallback -- set --env prod --surfaces all --yes
```

Fail back to the original instance:

```bash
aws rds failover-db-cluster \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-identifier nwac-prod-db \
  --target-db-instance-identifier nwac-prod-db-1
```

Wait, verify `nwac-prod-db-1` is writer, run SQL smoke, clear fallback, run public smoke, and clear the warning:

```bash
aws rds wait db-cluster-available \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-identifier nwac-prod-db

aws rds describe-db-clusters \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-identifier nwac-prod-db \
  --query 'DBClusters[0].DBClusterMembers[].{Id:DBInstanceIdentifier,Writer:IsClusterWriter}' \
  --output table

bash scripts/run-prod-sql-via-ssm.sh --sql "SELECT 1 AS ok, NOW() AS checked_at;"
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
npm run path:deploy:smoke -- --env prod
npm run path:maintenance -- clear --env prod --surfaces all --yes
```

After rollback, either delete the failed trial reader or leave it only long enough for diagnosis:

```bash
aws rds delete-db-instance \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-instance-identifier "$TRIAL_INSTANCE_ID" \
  --skip-final-snapshot
```

## Phase 6 - Finalize After Successful Trial

Only do this after Bill accepts the trial result.

The goal is to return the writer role to the Terraform-managed instance ID `nwac-prod-db-1`, but with the smaller class.

1. Confirm `$TRIAL_INSTANCE_ID` is still writer and `nwac-prod-db-1` is reader.

2. Modify `nwac-prod-db-1` while it is a reader:

```bash
aws rds modify-db-instance \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-instance-identifier nwac-prod-db-1 \
  --db-instance-class db.t4g.large \
  --apply-immediately

aws rds wait db-instance-available \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-instance-identifier nwac-prod-db-1
```

3. During another maintenance warning/fallback window, fail back to `nwac-prod-db-1`:

```bash
npm run path:maintenance -- set --env prod --surfaces all --start-in 5m --expected-duration 20m --yes
npm run path:maintenance:fallback -- set --env prod --surfaces all --yes

aws rds failover-db-cluster \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-identifier nwac-prod-db \
  --target-db-instance-identifier nwac-prod-db-1

aws rds wait db-cluster-available \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-cluster-identifier nwac-prod-db

bash scripts/run-prod-sql-via-ssm.sh --sql "SELECT 1 AS ok, NOW() AS checked_at;"
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
npm run path:deploy:smoke -- --env prod
npm run path:maintenance -- clear --env prod --surfaces all --yes
```

4. Delete the temporary trial reader after `nwac-prod-db-1` is confirmed writer and stable:

```bash
aws rds delete-db-instance \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --db-instance-identifier "$TRIAL_INSTANCE_ID" \
  --skip-final-snapshot
```

5. Reconcile Terraform before the next PROD Terraform apply:

- Update `infra/terraform/environments/prod/variables.tf` / PROD tfvars so `db_instance_class` is `db.t4g.large`.
- Verify the PROD engine version variable matches live Aurora MySQL `8.0.mysql_aurora.3.10.3` or the current intended version.
- Run a careful prod Terraform plan with the elevated Terraform workflow. The plan must not recreate the cluster or surprise-replace the DB instance.
- Do not run unrelated PROD Terraform apply while the temporary trial reader exists unless the plan has been reviewed for that drift.

## Final Evidence To Record

Record these in `docs/meta/changelog.md` and the maintenance thread:

- Snapshot ID.
- Trial reader ID and class.
- Failover start/end time.
- Writer after failover.
- SQL smoke result.
- Public smoke result.
- Key post-failover CloudWatch readings.
- Rollback decision or acceptance decision.
- Final class of `nwac-prod-db-1`.
- Trial reader deletion confirmation.
- Terraform reconciliation status.

## AWS References

- Aurora failover promotes an Aurora Replica to writer and supports a target DB instance: <https://docs.aws.amazon.com/cli/latest/reference/rds/failover-db-cluster.html>
- AWS documents Aurora DB instance class modification as causing an outage for the modified instance: <https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Modifying.html>
- Aurora hardware specifications list memory for `db.r6g.large`, `db.t4g.large`, and related classes: <https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.DBInstanceClass.Summary.html>
- Aurora MySQL support matrix includes `db.t4g.large` and `db.t4g.medium` for currently available Aurora MySQL versions: <https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.DBInstanceClass.SupportAurora.html>
- Official AWS public price-list feed used for 2026-06-14 hourly pricing: <https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/ca-central-1/index.json>
