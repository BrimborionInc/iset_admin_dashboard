# Prod Deployment Guide

This is the shortest safe path to deploy the current prod stack.

## Before You Start

- Work from the repo roots on the same machine that has AWS prod access.
- If `shared` code changed, deploy `shared` before admin or portal.
- Uploading artifacts does not update the live instance by itself. You must trigger a prod instance refresh after the uploads.
- These examples use the working prod AWS CLI profile name `nwac-prod-direct`. Replace it only if your local prod profile uses a different name.

## Full Prod Deploy

From `X:\ISET\admin-dashboard`:

```powershell
npm run deploy-shared-to-prod -- -Profile nwac-prod-direct
npm run deploy-admin-to-prod -- -Profile nwac-prod-direct
```

From `X:\ISET\ISET-intake`:

```powershell
npm run deploy-portal-to-prod -- -Profile nwac-prod-direct
```

Then trigger the prod rollout from either repo:

```powershell
npm run refresh-prod -- -Profile nwac-prod-direct
```

If you want the refresh script to wait and print progress:

```powershell
npm run refresh-prod -- -Profile nwac-prod-direct -Wait
```

Current default refresh preferences:

```text
MinHealthyPercentage=100,InstanceWarmup=180,SkipMatching=false
```

The warmup is intentionally short because the real gate is ALB health; prod instances have been reaching healthy state well before 15 minutes.

## Partial Deploys

Admin only:

```powershell
cd X:\ISET\admin-dashboard
npm run deploy-admin-to-prod -- -Profile nwac-prod-direct
npm run refresh-prod -- -Profile nwac-prod-direct
```

Portal only:

```powershell
cd X:\ISET\ISET-intake
npm run deploy-portal-to-prod -- -Profile nwac-prod-direct
npm run refresh-prod -- -Profile nwac-prod-direct
```

Shared only:

```powershell
cd X:\ISET\admin-dashboard
npm run deploy-shared-to-prod -- -Profile nwac-prod-direct
npm run refresh-prod -- -Profile nwac-prod-direct
```

## Verify Prod

Check refresh status:

```powershell
aws autoscaling describe-instance-refreshes --region ca-central-1 --auto-scaling-group-name nwac-prod-asg --profile nwac-prod-direct --output table
```

Check health:

```powershell
curl https://nwac-console.awentech.ca/healthz
curl https://nwac-public.awentech.ca/healthz
```

Expected result for each health URL:

```json
{"status":"ok"}
```
