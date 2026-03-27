# Prod Portal Hostname Cutover

Goal: serve the prod public portal on `https://iset.nwac.ca` while keeping `https://nwac-public.awentech.ca` working.

As of March 27, 2026:
- Prod ALB DNS is `nwac-prod-alb-1905620738.ca-central-1.elb.amazonaws.com`
- Current prod cert covers `nwac-console.awentech.ca` and `nwac-public.awentech.ca`
- Current prod WAF CAPTCHA API key only covers `nwac-console.awentech.ca` and `nwac-public.awentech.ca`
- The repo is now patched so the portal build can use same-origin API calls. That is required if both portal hostnames are going to stay interactive, because auth cookies are `SameSite=Lax`

## 1. Rotate the CAPTCHA API key

Run from any PowerShell window with prod AWS access:

```powershell
aws wafv2 create-api-key `
  --profile nwac-prod-direct `
  --region ca-central-1 `
  --scope REGIONAL `
  --token-domains nwac-console.awentech.ca iset.nwac.ca nwac-public.awentech.ca
```

Copy the returned `APIKey` and replace `REACT_APP_WAF_CAPTCHA_API_KEY` in [ISET-intake/.env.production](/mnt/x/ISET/ISET-intake/.env.production).

## 2. Update prod runtime env and uploads CORS

From `X:\ISET\admin-dashboard`:

```powershell
npm run configure-prod-portal-hosts -- -Profile nwac-prod-direct
```

This updates:
- `/nwac/prod/portal/env`
- `/nwac/prod/admin/env`
- S3 CORS on `nwac-prod-uploads-b6bb`

## 3. Deploy the new admin and portal builds

From `X:\ISET\admin-dashboard`:

```powershell
npm run deploy-admin-to-prod -- -Profile nwac-prod-direct
```

From `X:\ISET\ISET-intake`:

```powershell
npm run deploy-portal-to-prod -- -Profile nwac-prod-direct
npm run refresh-prod -- -Profile nwac-prod-direct -Wait
```

## 4. Request the new ACM certificate

The prod Terraform now supports one primary portal hostname plus additional portal aliases.

From `X:\ISET\admin-dashboard\infra\terraform\environments\prod`:

```powershell
terraform init -backend-config=backend.hcl -reconfigure
terraform apply -target=module.acm -var-file=nwac-prod.tfvars
```

This should request a new cert for:
- `nwac-console.awentech.ca`
- `iset.nwac.ca`
- `nwac-public.awentech.ca`

## 5. Send the DNS validation record to NWAC

After the ACM request, send the exact validation CNAME for `iset.nwac.ca` to the `nwac.ca` DNS admin.

They need to create:
- the ACM validation CNAME you send them
- later, the live record:

```text
Host/Name: iset
Type: CNAME
Target: nwac-prod-alb-1905620738.ca-central-1.elb.amazonaws.com
TTL: 300
```

Do not ask them to add the live `iset` record until the AWS side is ready.

## 6. Switch the ALB to the new cert and dual-host listener rule

Once the new cert is `ISSUED`, put the new certificate ARN into [nwac-prod.tfvars](/mnt/x/ISET/admin-dashboard/infra/terraform/environments/prod/nwac-prod.tfvars) as `alb_certificate_arn`.

Then run:

```powershell
terraform apply -var-file=nwac-prod.tfvars
```

That apply should:
- attach the new cert to the ALB listener
- keep `nwac-console.awentech.ca` on admin
- route both `iset.nwac.ca` and `nwac-public.awentech.ca` to the portal target group
- update the portal Cognito client logout/callback URL lists in Terraform-managed identity

## 7. Ask NWAC to create the live `iset` record

Once step 6 is complete, ask the `nwac.ca` DNS admin to create:

```text
Host/Name: iset
Type: CNAME
Target: nwac-prod-alb-1905620738.ca-central-1.elb.amazonaws.com
TTL: 300
```

## 8. Verify both portal hostnames

Check:

```powershell
curl https://iset.nwac.ca/healthz
curl https://nwac-public.awentech.ca/healthz
curl https://nwac-console.awentech.ca/healthz
```

Then do a browser smoke test on both portal hostnames:
- load home page
- register or sign in
- upload a file
- sign out

## 9. Optional cleanup later

After cutover is stable, you can remove the old CAPTCHA API key:

```powershell
aws wafv2 delete-api-key `
  --profile nwac-prod-direct `
  --region ca-central-1 `
  --scope REGIONAL `
  --api-key <old-api-key>
```
