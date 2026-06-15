# PROD App Instance Right-Size Runbook

Status: executed on 2026-06-14; keep for rollback and post-change watch.
Last reviewed: 2026-06-14 after live PROD execution.

This runbook records the 2026-06-14 right-size of the single PROD application host from `t3.large` to `t3.medium`. It was the first low-risk PROD cost-saving step identified after the TEST cost prune. It did not touch Aurora, schemas, data, S3 objects, Cognito, WAF, or NAT gateways.

## Decision

Target:

- ASG: `nwac-prod-asg`
- Launch template: `lt-056df7f45608b95ae`
- Previous instance type: `t3.large`
- Current instance type: `t3.medium`
- ASG steady state: min `1`, desired `1`, max `4`

Expected saving: roughly half the PROD EC2 compute line for the app host. In May 2026, the PROD EC2 compute line for `CAN1-BoxUsage:t3.large` was about `$68.76` USD before tax, so the rough saving is about `$34/month` USD before tax. Actual savings should be confirmed with Cost Explorer after one full billing cycle.

## Live Evidence Before Execution

Checked on 2026-06-14 before the change:

- PROD ASG `nwac-prod-asg` was min `1`, desired `1`, max `4`.
- Current app instance `i-07b1b6ede5bb88a6a` was `t3.large`, `InService`, and healthy.
- Current launch template latest/default version was `1`, instance type `t3.large`.
- PROD public smoke passed for:
  - `https://nwac-console.awentech.ca/healthz`
  - `https://iset.nwac.ca/healthz`
  - `https://nwac-public.awentech.ca/healthz`
- CloudWatch CPU, 2026-06-01 through 2026-06-14:
  - hourly average of hourly averages: `0.686%`
  - p95 hourly average: `1.135%`
  - max hourly average: `2.594%`
  - max short-period spike: `63.581%`
- Read-only SSM check on `i-07b1b6ede5bb88a6a`:
  - memory total `7823 MB`, available `6747 MB`
  - root disk `8.0G`, used `5.2G`, `65%`
  - local admin health `{"status":"ok"}`
  - local portal health `{"status":"ok"}`
  - PM2 memory: `nwac-admin` about `149 MB`, `nwac-portal` about `110 MB`

This evidence supports a first step to `t3.medium` rather than jumping directly to `t3.small`.

## Execution Evidence

Executed on 2026-06-14 with explicit Bill approval in the current thread.

- PROD operator identity: `arn:aws:sts::468278742295:assumed-role/nwac-prod-codex-operator/codex-prod-operator`.
- IAM dry-run for `ec2:CreateLaunchTemplateVersion` returned `DryRunOperation` after Bill attached temporary policy `NWACProdAppRightSizeTemporaryOperator`.
- Maintenance sequence used: in-app all-surface warning, five-minute wait, all-surface ALB fixed-response fallback, launch-template version creation, ASG instance refresh, local health, fallback clear, normal-routing smoke, warning clear.
- Launch template `lt-056df7f45608b95ae`:
  - previous version `1`: `t3.large`
  - new latest/default version `2`: `t3.medium`
  - ASG `nwac-prod-asg` uses launch-template version `$Latest`
  - after the ASG refresh, `aws ec2 modify-launch-template --default-version 2` aligned the launch-template default with Terraform's `update_default_version = true` pattern; this did not refresh or replace instances.
- ASG instance refresh `24c2eb5f-6843-4685-9df1-35d41eb193ec` completed `Successful` at `2026-06-14T15:48:53Z`.
- Replacement instance: `i-034c7daa416ec6865`, `t3.medium`, `ca-central-1d`, `InService`, `Healthy`, launch-template version `2`.
- Bootstrap on the new instance completed through `app-bootstrap.sh`; local SSM health returned `{"status":"ok"}` on both `127.0.0.1:5001/healthz` and `127.0.0.1:5000/healthz`.
- The first immediate smoke after clearing fallback hit a transient `503` while ALB rule/target health propagated; fallback was restored, then cleared again after a 20-second propagation wait.
- Final target health was healthy for:
  - `nwac-prod-admin-tg` target `i-034c7daa416ec6865:5001`
  - `nwac-prod-portal-tg` target `i-034c7daa416ec6865:5000`
- Final public smoke returned `200` for:
  - `https://nwac-console.awentech.ca/healthz`
  - `https://iset.nwac.ca/healthz`
  - `https://nwac-public.awentech.ca/healthz`
- Final fallback status was normal `forward` for all PROD host rules.
- Final runtime maintenance row check returned `active_announcements = 0`.
- Post-change SSM resource check on `i-034c7daa416ec6865`:
  - memory total `3839 MB`, available `2837 MB`
  - root disk `8.0G`, used `5.2G`, `65%`
  - PM2: `nwac-admin` and `nwac-portal` online

## Temporary IAM Policy

The reduced PROD operator profile `nwac-prod` can describe PROD and start normal deploy ASG refreshes, but it needed a temporary permission expansion to create the launch-template version.

Dry-run evidence from 2026-06-14:

```text
UnauthorizedOperation: not authorized to perform ec2:CreateLaunchTemplateVersion on launch-template/lt-056df7f45608b95ae
```

Bill attached this temporary policy before execution. Remove it after the post-change watch/rollback window is complete. Reattach it if rollback is needed after removal, because rollback also creates a new launch-template version.

Policy name: `NWACProdAppRightSizeTemporaryOperator`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadProdRightSizeState",
      "Effect": "Allow",
      "Action": [
        "autoscaling:DescribeAutoScalingGroups",
        "autoscaling:DescribeInstanceRefreshes",
        "cloudwatch:GetMetricStatistics",
        "ec2:DescribeInstanceStatus",
        "ec2:DescribeInstances",
        "ec2:DescribeLaunchTemplates",
        "ec2:DescribeLaunchTemplateVersions",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:DescribeTargetHealth"
      ],
      "Resource": "*"
    },
    {
      "Sid": "MutateProdAppLaunchTemplateAndRefresh",
      "Effect": "Allow",
      "Action": [
        "autoscaling:CancelInstanceRefresh",
        "autoscaling:StartInstanceRefresh",
        "ec2:CreateLaunchTemplateVersion",
        "ec2:ModifyLaunchTemplate"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "ca-central-1"
        }
      }
    },
    {
      "Sid": "PassExistingProdAppRoleOnly",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::468278742295:role/nwac-prod-app-role",
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": [
            "autoscaling.amazonaws.com",
            "ec2.amazonaws.com"
          ]
        }
      }
    }
  ]
}
```

## Safety Rules

- Get explicit Bill approval in the current thread before running mutating commands.
- Treat the ASG refresh as user-impacting unless proven otherwise.
- Use the PROD maintenance sequence: warning, wait, ALB fallback, launch-template change, ASG refresh, local health, clear fallback, normal-routing smoke, clear warning.
- Do not run a full Terraform apply from the current Codex shell. Terraform is not installed here, and PROD Terraform state is not fully reconciled for all resources. The repo defaults are updated to preserve the intended app-tier shape for future infra work, but this runbook uses a targeted AWS CLI change.
- Keep the old launch-template version. Rollback is a new launch-template version back to `t3.large` plus another ASG refresh.

## Preflight

These commands are retained as the first-execution checklist. After the 2026-06-14 execution, expected live state is one healthy `t3.medium` instance on launch-template version `2`; rollback uses the rollback section below rather than rerunning the forward change.

```bash
cd /home/bill/ISET/admin-dashboard
aws sts get-caller-identity --profile nwac-prod
npm run path:maintenance:fallback -- status --env prod --json
npm run path:deploy:smoke -- --env prod --json
aws autoscaling describe-auto-scaling-groups \
  --profile nwac-prod \
  --region ca-central-1 \
  --auto-scaling-group-names nwac-prod-asg \
  --query 'AutoScalingGroups[0].{Min:MinSize,Desired:DesiredCapacity,Max:MaxSize,LaunchTemplate:LaunchTemplate,Instances:Instances[*].{InstanceId:InstanceId,InstanceType:InstanceType,AZ:AvailabilityZone,Lifecycle:LifecycleState,Health:HealthStatus}}' \
  --output json
aws ec2 describe-launch-template-versions \
  --profile nwac-prod \
  --region ca-central-1 \
  --launch-template-id lt-056df7f45608b95ae \
  --versions '$Latest' \
  --query 'LaunchTemplateVersions[0].{VersionNumber:VersionNumber,DefaultVersion:DefaultVersion,InstanceType:LaunchTemplateData.InstanceType,ImageId:LaunchTemplateData.ImageId}' \
  --output json
```

Expected preflight:

- Fallback disabled.
- Public smoke green.
- Before first execution, current instance type still `t3.large`.
- ASG launch template version set to `$Latest`.
- Before first execution, latest launch-template instance type still `t3.large`.

## Maintenance Start

```bash
npm run path:maintenance -- set --env prod --surfaces all --start-in 5m --expected-duration 20m --yes
# wait through the warning window
npm run path:maintenance:fallback -- set --env prod --surfaces all --yes
```

## Create The Target Launch Template Version

Record the current launch-template version first:

```bash
PREVIOUS_LT_VERSION="$(aws ec2 describe-launch-template-versions \
  --profile nwac-prod \
  --region ca-central-1 \
  --launch-template-id lt-056df7f45608b95ae \
  --versions '$Latest' \
  --query 'LaunchTemplateVersions[0].VersionNumber' \
  --output text)"
echo "Previous launch template version: ${PREVIOUS_LT_VERSION}"
```

Create the `t3.medium` version:

```bash
NEW_LT_VERSION="$(aws ec2 create-launch-template-version \
  --profile nwac-prod \
  --region ca-central-1 \
  --launch-template-id lt-056df7f45608b95ae \
  --source-version '$Latest' \
  --launch-template-data '{"InstanceType":"t3.medium"}' \
  --query 'LaunchTemplateVersion.VersionNumber' \
  --output text)"
echo "New launch template version: ${NEW_LT_VERSION}"
```

The ASG uses `$Latest`, so a separate ASG launch-template version update should not be needed. Verify:

```bash
aws ec2 describe-launch-template-versions \
  --profile nwac-prod \
  --region ca-central-1 \
  --launch-template-id lt-056df7f45608b95ae \
  --versions "${NEW_LT_VERSION}" \
  --query 'LaunchTemplateVersions[0].{VersionNumber:VersionNumber,InstanceType:LaunchTemplateData.InstanceType}' \
  --output json
```

## Refresh The App Instance

```bash
REFRESH_ID="$(aws autoscaling start-instance-refresh \
  --profile nwac-prod \
  --region ca-central-1 \
  --auto-scaling-group-name nwac-prod-asg \
  --preferences MinHealthyPercentage=100,InstanceWarmup=180,SkipMatching=false \
  --query 'InstanceRefreshId' \
  --output text)"
echo "Instance refresh: ${REFRESH_ID}"
```

Poll:

```bash
aws autoscaling describe-instance-refreshes \
  --profile nwac-prod \
  --region ca-central-1 \
  --auto-scaling-group-name nwac-prod-asg \
  --instance-refresh-ids "${REFRESH_ID}" \
  --output table
aws autoscaling describe-auto-scaling-groups \
  --profile nwac-prod \
  --region ca-central-1 \
  --auto-scaling-group-names nwac-prod-asg \
  --query 'AutoScalingGroups[0].Instances[*].{InstanceId:InstanceId,InstanceType:InstanceType,AZ:AvailabilityZone,Lifecycle:LifecycleState,Health:HealthStatus}' \
  --output table
```

If the refresh appears to wait on ELB target health while fallback is still active, identify the new instance and run local health through SSM. Clear fallback only after local health passes.

Example local-health SSM command:

```bash
aws ssm send-command \
  --profile nwac-prod \
  --region ca-central-1 \
  --instance-ids <new-instance-id> \
  --document-name AWS-RunShellScript \
  --comment prod-app-rightsize-local-health \
  --parameters 'commands=["curl -fsS http://127.0.0.1:5001/healthz","curl -fsS http://127.0.0.1:5000/healthz","sudo env PM2_HOME=/root/.pm2 pm2 list"]'
```

## Restore Normal Routing And Verify

```bash
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
npm run path:deploy:smoke -- --env prod --json
aws autoscaling describe-auto-scaling-groups \
  --profile nwac-prod \
  --region ca-central-1 \
  --auto-scaling-group-names nwac-prod-asg \
  --query 'AutoScalingGroups[0].Instances[*].{InstanceId:InstanceId,InstanceType:InstanceType,AZ:AvailabilityZone,Lifecycle:LifecycleState,Health:HealthStatus}' \
  --output table
npm run path:maintenance -- clear --env prod --surfaces all --yes
bash scripts/run-prod-sql-via-ssm.sh --sql "SELECT COUNT(*) AS active_announcements FROM iset_runtime_config WHERE scope='runtime' AND k='service.announcement';"
```

Expected:

- One healthy `t3.medium` PROD app instance.
- Admin health `200`.
- Portal health `200` on both public portal hostnames.
- Fallback status normal/forward.
- Runtime maintenance row count `0` after warning clear.

## Rollback

Rollback is another launch-template version and ASG refresh back to `t3.large`. The known pre-change launch-template version is `1`; the forward change created version `2` with `t3.medium`. Because the ASG uses `$Latest`, rollback should create a new latest version based on the current latest while overriding only `InstanceType`.

```bash
ROLLBACK_LT_VERSION="$(aws ec2 create-launch-template-version \
  --profile nwac-prod \
  --region ca-central-1 \
  --launch-template-id lt-056df7f45608b95ae \
  --source-version '$Latest' \
  --launch-template-data '{"InstanceType":"t3.large"}' \
  --query 'LaunchTemplateVersion.VersionNumber' \
  --output text)"
aws autoscaling start-instance-refresh \
  --profile nwac-prod \
  --region ca-central-1 \
  --auto-scaling-group-name nwac-prod-asg \
  --preferences MinHealthyPercentage=100,InstanceWarmup=180,SkipMatching=false
```

Use the same maintenance warning/fallback, local-health, fallback-clear, and normal-routing smoke sequence as the forward change.

## Post-Change Watch

For the first business day after the change, watch:

- Admin and portal public `/healthz`.
- ASG instance health.
- ALB target health.
- EC2 CPU credit balance and CPU utilization.
- Instance memory and disk through SSM.
- User reports for slow page loads, failed PDF generation, or failed uploads.

If sustained CPU pressure, low CPU credits, memory pressure, or user-visible latency appears, roll back to `t3.large`.
