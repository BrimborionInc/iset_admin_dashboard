# PROD NAT Gateway Consolidation Runbook

Status: executed on 2026-06-14 after Bill approved moving PROD to one NAT gateway and attached temporary policy `NWACProdNatConsolidationTemporaryOperator`.

Purpose: reduce PROD from three zonal NAT gateways to one NAT gateway while preserving the current single-AZ app/DB operating shape. This is a networking cost-saving change, not an app deploy, database change, or schema change.

## Decision

Keep the `ca-central-1d` NAT gateway because current live PROD app and DB placement is also in `ca-central-1d`.

Keeper:

- NAT gateway: `nat-061b3328c8a74487e`
- Name: `nwac-prod-nat-2`
- Public subnet: `subnet-06232beff7d56afc0` / `nwac-prod-public-2`
- AZ: `ca-central-1d`
- EIP allocation: `eipalloc-03a9b113f590757e9`
- Public IP: `15.222.143.60`

Remove after route changes:

- NAT gateway: `nat-009f7f0add87674f4`, `nwac-prod-nat-0`, `ca-central-1a`, EIP allocation `eipalloc-0b52e577cc52e143c`, public IP `16.52.211.232`
- NAT gateway: `nat-039421458cb225a44`, `nwac-prod-nat-1`, `ca-central-1b`, EIP allocation `eipalloc-0c1f5bfe99e1029bd`, public IP `16.54.58.86`

Expected saving from May 2026 actuals:

- NAT gateway hours before: `2232` hours, `$111.60` USD before tax.
- One NAT gateway steady state: about `744` hours, `$37.20` USD before tax.
- NAT gateway hourly saving: about `$74.40/month` USD before tax.
- Releasing two EIPs should save about `$7.44/month` USD before tax from public IPv4 in-use address charges.
- Total expected saving: about `$82/month` USD before tax.

## Live Evidence

Checked on 2026-06-14 before any mutation:

- Current app instance `i-034c7daa416ec6865` is in private subnet `subnet-0e60c0de4248ccdeb`, `ca-central-1d`, IP `10.58.45.73`.
- Current DB writer `nwac-prod-db-1` is in `ca-central-1d`.
- PROD ASG `nwac-prod-asg` still allows the three private subnets:
  - `subnet-01a4ab14935f7a040` / `nwac-prod-private-0` / `ca-central-1a`
  - `subnet-0054109ab51f4f19b` / `nwac-prod-private-1` / `ca-central-1b`
  - `subnet-0e60c0de4248ccdeb` / `nwac-prod-private-2` / `ca-central-1d`
- Network interface check across the three private app subnets found only one ENI: the current app instance ENI in `subnet-0e60c0de4248ccdeb`. There were no live ENIs in private-0 or private-1.
- Current private route tables:
  - `rtb-0448f405001135392` / `nwac-prod-rt-private-0` routes `0.0.0.0/0` to `nat-009f7f0add87674f4`
  - `rtb-0507d2829075a05d3` / `nwac-prod-rt-private-1` routes `0.0.0.0/0` to `nat-039421458cb225a44`
  - `rtb-02e4f1d20adc69f0c` / `nwac-prod-rt-private-2` routes `0.0.0.0/0` to `nat-061b3328c8a74487e`
- PROD public smoke returned `200` for admin and both portal hostnames.
- SQL-over-SSM from the current app host succeeded.

## Temporary Policy Used

The `nwac-prod` operator role could describe the networking state, but initially lacked the required EC2 mutations:

- `ec2:ReplaceRoute` on route tables `rtb-0448f405001135392` and `rtb-0507d2829075a05d3`
- `ec2:DeleteNatGateway` on the removable NAT gateways
- `ec2:ReleaseAddress` on the removable EIP allocations

Temporary policy name: `NWACProdNatConsolidationTemporaryOperator`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadProdNatConsolidationState",
      "Effect": "Allow",
      "Action": [
        "autoscaling:DescribeAutoScalingGroups",
        "ec2:DescribeAddresses",
        "ec2:DescribeInstances",
        "ec2:DescribeNatGateways",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeRouteTables",
        "ec2:DescribeSubnets",
        "rds:DescribeDBInstances"
      ],
      "Resource": "*"
    },
    {
      "Sid": "MutateProdNatRoutesAndGateways",
      "Effect": "Allow",
      "Action": [
        "ec2:AllocateAddress",
        "ec2:CreateNatGateway",
        "ec2:CreateRoute",
        "ec2:CreateTags",
        "ec2:DeleteNatGateway",
        "ec2:DeleteRoute",
        "ec2:ReleaseAddress",
        "ec2:ReplaceRoute"
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

Dry-run checks returned `DryRunOperation` for `ec2:ReplaceRoute`, `ec2:DeleteNatGateway`, and `ec2:ReleaseAddress` after Bill attached this policy. Remove this policy after the short rollback watch window.

## Execution

Executed on 2026-06-14 after explicit Bill approval in the current thread.

Repoint the two non-keeper private route tables to the keeper NAT:

```bash
aws ec2 replace-route \
  --profile nwac-prod \
  --region ca-central-1 \
  --route-table-id rtb-0448f405001135392 \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id nat-061b3328c8a74487e

aws ec2 replace-route \
  --profile nwac-prod \
  --region ca-central-1 \
  --route-table-id rtb-0507d2829075a05d3 \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id nat-061b3328c8a74487e
```

Verify all private route tables point to the keeper NAT:

```bash
aws ec2 describe-route-tables \
  --profile nwac-prod \
  --region ca-central-1 \
  --route-table-ids rtb-0448f405001135392 rtb-0507d2829075a05d3 rtb-02e4f1d20adc69f0c \
  --query 'RouteTables[].{RouteTableId:RouteTableId,Name:Tags[?Key==`Name`]|[0].Value,DefaultRoute:Routes[?DestinationCidrBlock==`0.0.0.0/0`]|[0].NatGatewayId}' \
  --output table
```

Run smoke checks before deleting NAT gateways:

```bash
npm run path:deploy:smoke -- --env prod --json
bash scripts/run-prod-sql-via-ssm.sh --sql "SELECT 1 AS ok, NOW() AS checked_at;"
```

Delete the unused NAT gateways:

```bash
aws ec2 delete-nat-gateway \
  --profile nwac-prod \
  --region ca-central-1 \
  --nat-gateway-id nat-009f7f0add87674f4

aws ec2 delete-nat-gateway \
  --profile nwac-prod \
  --region ca-central-1 \
  --nat-gateway-id nat-039421458cb225a44
```

Wait until both NAT gateways are deleted, then release their EIPs:

```bash
aws ec2 release-address \
  --profile nwac-prod \
  --region ca-central-1 \
  --allocation-id eipalloc-0b52e577cc52e143c

aws ec2 release-address \
  --profile nwac-prod \
  --region ca-central-1 \
  --allocation-id eipalloc-0c1f5bfe99e1029bd
```

## Final Evidence

Recorded after the route changes, NAT deletion, and EIP release on 2026-06-14:

- Available PROD NAT gateways tagged `nwac-prod-nat-*`: exactly one, `nat-061b3328c8a74487e` / `nwac-prod-nat-2`, state `available`, public IP `15.222.143.60`, EIP allocation `eipalloc-03a9b113f590757e9`.
- Deleted NAT gateways: `nat-009f7f0add87674f4` and `nat-039421458cb225a44`.
- Released NAT EIPs: `eipalloc-0b52e577cc52e143c` / `16.52.211.232` and `eipalloc-0c1f5bfe99e1029bd` / `16.54.58.86`.
- Private route tables now all route `0.0.0.0/0` to keeper NAT `nat-061b3328c8a74487e`:
  - `rtb-0448f405001135392` / `nwac-prod-rt-private-0`
  - `rtb-0507d2829075a05d3` / `nwac-prod-rt-private-1`
  - `rtb-02e4f1d20adc69f0c` / `nwac-prod-rt-private-2`
- PROD public smoke returned `200` for `https://nwac-console.awentech.ca/healthz`, `https://iset.nwac.ca/healthz`, and `https://nwac-public.awentech.ca/healthz`.
- SQL-over-SSM returned `SELECT 1` successfully at `2026-06-14 16:31:32`.
- SSM reported app instance `i-034c7daa416ec6865` online.
- ALB target health was healthy for `i-034c7daa416ec6865` on both target groups:
  - `nwac-prod-admin-tg`, port `5001`
  - `nwac-prod-portal-tg`, port `5000`
- Outbound egress from the app host via `curl https://checkip.amazonaws.com` returned `15.222.143.60`, confirming traffic exits through the keeper NAT.
- Three other associated, untagged PROD Elastic IPs were observed after release and intentionally left alone because they were not attached to the removed NAT gateways.

## Terraform Desired State

The PROD Terraform environment now passes the existing networking-module single-NAT variables:

- `enable_nat_gateway = true`
- `single_nat_gateway = true`
- `single_nat_gateway_subnet_index = 2`

This matches the live keeper NAT in public subnet index `2` / `ca-central-1d`. Run `terraform plan` before any future PROD Terraform apply and confirm it does not attempt to recreate NAT gateways `0` or `1`.

## Rollback

The original NAT gateways and EIPs have been deleted/released, so rollback now requires allocating new EIPs, creating new NAT gateways in public-0 and public-1, waiting until they are `available`, then repointing private-0 and private-1 route tables to the new NAT gateway IDs.

Historical pre-delete rollback would have been route replacement only:

```bash
aws ec2 replace-route \
  --profile nwac-prod \
  --region ca-central-1 \
  --route-table-id rtb-0448f405001135392 \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id nat-009f7f0add87674f4

aws ec2 replace-route \
  --profile nwac-prod \
  --region ca-central-1 \
  --route-table-id rtb-0507d2829075a05d3 \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id nat-039421458cb225a44
```

After the rollback watch window, remove temporary policy `NWACProdNatConsolidationTemporaryOperator`.
